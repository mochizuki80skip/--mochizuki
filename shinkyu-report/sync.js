/* サーバー同期（Xサーバー等に置いた api.php とやり取りする）
 *
 * 画面側は今まで通り localStorage を読み書きし、このファイルがその変更をサーバーへ送り、
 * 他の端末の変更を取り込む。api.php が無い場所（パソコンで直接開いた時など）では
 * 何もせず、端末内だけで動く。
 *
 * - 送信待ちは 1キーずつ「shinq-sync:out:<キー>」に記録（タブ同士で消し合わない）。
 *   通信できない間も溜めておき、つながったら送る。
 * - サーバーが受け付けなかった（別の端末が先に保存していた）内容書は、サーバーの内容に戻して
 *   画面に知らせる（conflict）。相手の内容は上書きしない。
 */
(function () {
  'use strict';

  const API = 'api.php';
  const SYNCED = /^shinq:(settings$|(rec|pat|log):)/;
  const K_OUT = 'shinq-sync:out:';
  const K_SEQ = 'shinq-sync:seq';
  const K_SERVER = 'shinq-sync:server'; // 一度でもサーバーにつながった端末
  const POLL_MS = 10000;

  let mode = 'local'; // 'local' | 'server'
  let online = true;
  let flushing = null;
  let pulling = null;
  let flushTimer = null;
  const handlers = { change: [], conflict: [], status: [] };
  const emit = (ev, arg) => handlers[ev].forEach((fn) => { try { fn(arg); } catch (e) { console.error(e); } });

  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { localStorage.setItem(k, v); },
    del(k) { try { localStorage.removeItem(k); } catch { /* noop */ } },
    keys() {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch { /* noop */ }
      return out;
    },
  };
  const pendingKeys = () => ls.keys().filter((k) => k && k.startsWith(K_OUT)).map((k) => k.slice(K_OUT.length));
  const isPending = (key) => ls.get(K_OUT + key) != null;

  function status() {
    emit('status', { mode, online, pending: mode === 'server' ? pendingKeys().length : 0 });
  }

  class HttpError extends Error {
    constructor(status, msg) { super(msg); this.status = status; }
  }

  async function api(action, { body, query = '' } = {}) {
    const res = await fetch(`${API}?a=${action}${query}`, {
      method: body ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json', 'X-Shinq': '1' } : { 'X-Shinq': '1' },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* JSON 以外 */ }
    if (!res.ok || !data) throw new HttpError(res.status, data?.error || `HTTP ${res.status}`);
    return data;
  }

  // ---------- ログイン画面 ----------
  let loginWaiter = null;
  function needLogin() {
    if (loginWaiter) return loginWaiter.promise;
    const box = document.getElementById('login');
    const form = document.getElementById('loginForm');
    const pw = document.getElementById('loginPassword');
    const err = document.getElementById('loginError');
    box.hidden = false;
    err.textContent = '';
    setTimeout(() => pw.focus(), 50);
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    loginWaiter = { promise };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      btn.disabled = true;
      err.textContent = '';
      try {
        await api('login', { body: { password: pw.value } });
        pw.value = '';
        box.hidden = true;
        loginWaiter = null;
        resolve();
      } catch (ex) {
        err.textContent = ex.status === 401 ? 'パスワードが違います。' : `ログインできませんでした（${ex.message}）`;
      } finally {
        btn.disabled = false;
      }
    };
    return promise;
  }

  // 401 ならログインしてからやり直す
  async function call(action, opts) {
    try {
      return await api(action, opts);
    } catch (e) {
      if (e.status === 401) { await needLogin(); return api(action, opts); }
      throw e;
    }
  }

  // ---------- 取り込み ----------
  function pull() {
    if (mode !== 'server') return Promise.resolve();
    if (pulling) return pulling;
    pulling = (async () => {
      let more = true;
      while (more) {
        const since = Number(ls.get(K_SEQ) || 0);
        const data = await call('pull', { query: `&since=${since}` });
        for (const it of data.items) {
          if (!SYNCED.test(it.key)) continue;
          // こちらに送信待ちの変更があるキーは、送信の結果（受付 or 競合）で決める
          if (isPending(it.key)) continue;
          if (ls.get(it.key) === it.value) continue;
          if (it.value == null) ls.del(it.key);
          else ls.set(it.key, it.value);
          emit('change', it.key);
        }
        ls.set(K_SEQ, String(data.seq));
        more = data.more;
      }
      online = true;
    })().catch((e) => {
      online = false;
      throw e;
    }).finally(() => { pulling = null; status(); });
    return pulling;
  }

  // ---------- 送信 ----------
  function flush() {
    if (mode !== 'server') return Promise.resolve();
    if (flushing) return flushing.then(() => (pendingKeys().length ? flush() : null));
    flushing = (async () => {
      let keys = pendingKeys();
      while (keys.length) {
        const batch = keys.slice(0, 100);
        const sent = batch.map((key) => ({ key, value: ls.get(key) }));
        const data = await call('push', { body: { items: sent } });
        data.results.forEach((r, i) => {
          const s = sent[i];
          if (r.ok) {
            // 送った後にさらに書き換えられていたら、次の回で送る
            if (ls.get(s.key) === s.value) ls.del(K_OUT + s.key);
          } else if (r.conflict) {
            ls.del(K_OUT + s.key);
            if (r.current == null) ls.del(s.key);
            else ls.set(s.key, r.current);
            emit('conflict', s.key);
            emit('change', s.key);
          } else {
            console.warn('同期できないデータ', s.key, r.error);
            ls.del(K_OUT + s.key);
          }
        });
        const rest = pendingKeys();
        // 同じキーが書き換え続けられている場合も、1回の flush で止まるように
        keys = rest.filter((k) => !batch.includes(k));
      }
      online = true;
    })().catch((e) => {
      online = false;
      throw e;
    }).finally(() => { flushing = null; status(); });
    return flushing;
  }

  async function syncNow() {
    if (mode !== 'server') return;
    try {
      await flush();
      await pull();
    } catch (e) {
      console.warn('同期できませんでした', e.message);
    }
  }

  function changed(key) {
    if (mode !== 'server' || !SYNCED.test(key)) return;
    try { ls.set(K_OUT + key, '1'); } catch { /* 容量不足 */ }
    status();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => { flush().catch(() => {}); }, 300);
  }

  // ---------- 起動 ----------
  async function start() {
    let me = null;
    try {
      me = await api('me');
    } catch (e) {
      if (e.status === 401) me = { loggedIn: false };
      else if (ls.get(K_SERVER)) {
        // サーバー運用中の端末が一時的につながらない：端末内のデータで動かし、つながったら送る
        mode = 'server';
        online = false;
        status();
        return;
      } else {
        mode = 'local'; // api.php が無い（端末内だけで使う）
        status();
        return;
      }
    }
    mode = 'server';
    if (!me.loggedIn) await needLogin();
    if (!ls.get(K_SERVER)) {
      // この端末で初めてサーバーにつなぐ：今まで端末内に入力した分もサーバーへ送る
      ls.keys().filter((k) => k && SYNCED.test(k)).forEach((k) => ls.set(K_OUT + k, '1'));
      ls.set(K_SERVER, '1');
    }
    try {
      await flush();
      await pull();
    } catch (e) {
      console.warn('同期できませんでした', e.message);
    }
    status();
  }

  const ready = start();

  ready.then(() => {
    setInterval(() => { if (!document.hidden) syncNow(); }, POLL_MS);
    window.addEventListener('online', syncNow);
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
  });

  async function logout() {
    if (pendingKeys().length) {
      try { await flush(); } catch { /* noop */ }
      if (pendingKeys().length && !confirm('まだサーバーに送れていない変更があります。ログアウトしますか？（変更はこの端末に残り、次回ログイン時に送られます）')) return;
    }
    try { await api('logout', { body: {} }); } catch { /* noop */ }
    location.reload();
  }

  window.Sync = {
    ready,
    changed,
    syncNow,
    logout,
    on(ev, fn) { handlers[ev].push(fn); },
    get mode() { return mode; },
  };
})();
