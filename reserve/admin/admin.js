(function () {
  'use strict';

  const STORAGE_KEY = 'recovery-admin-pass';

  function $(id) { return document.getElementById(id); }

  function showAuthView() {
    $('login-card').hidden = true;
    $('auth-view').hidden = false;
    loadPromos();
  }

  function showLoginView() {
    $('login-card').hidden = false;
    $('auth-view').hidden = true;
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function getPass() {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  }

  async function apiFetch(path, opts = {}) {
    const headers = Object.assign(
      { 'Accept': 'application/json' },
      opts.headers || {},
      { 'X-Admin-Password': getPass() }
    );
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
      headers['Content-Type'] = 'application/json';
    }
    const r = await fetch(path, Object.assign({}, opts, { headers }));
    if (r.status === 401) {
      showLoginView();
      $('login-error').textContent = 'セッション切れです。再ログインしてください。';
      $('login-error').hidden = false;
      throw new Error('unauthorized');
    }
    return r;
  }

  // --- Login ---

  $('login-btn').addEventListener('click', async () => {
    const pass = $('login-pass').value;
    $('login-error').hidden = true;
    if (!pass) {
      $('login-error').textContent = 'パスワードを入力してください';
      $('login-error').hidden = false;
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, pass);
    const btn = $('login-btn');
    const orig = btn.textContent;
    btn.textContent = '確認中…';
    btn.disabled = true;
    try {
      const r = await apiFetch('/api/admin/promos');
      if (r.ok) {
        showAuthView();
      } else {
        const data = await r.json().catch(() => ({}));
        const msg = data.error || `ログインに失敗しました (HTTP ${r.status})`;
        const detail = data.message ? `\n${data.message}` : '';
        $('login-error').textContent = msg + detail;
        $('login-error').hidden = false;
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      if (e && e.message !== 'unauthorized') {
        $('login-error').textContent = '通信に失敗しました: ' + ((e && e.message) || e);
        $('login-error').hidden = false;
      }
    } finally {
      btn.textContent = orig;
      btn.disabled = false;
    }
  });

  $('login-pass').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('login-btn').click();
  });

  $('logout-btn').addEventListener('click', () => {
    showLoginView();
    $('login-pass').value = '';
  });

  // --- Promo CRUD ---

  async function loadPromos() {
    try {
      const r = await apiFetch('/api/admin/promos');
      if (!r.ok) {
        renderPromos([], 'コース取得に失敗');
        return;
      }
      const data = await r.json();
      renderPromos(data.items || []);
    } catch (e) {
      renderPromos([], (e && e.message) || 'エラー');
    }
  }

  function renderPromos(items, errorMsg) {
    const list = $('promo-list');
    if (errorMsg) {
      list.innerHTML = `<p class="admin-error">${escapeHtml(errorMsg)}</p>`;
      return;
    }
    if (!items.length) {
      list.innerHTML = '<p class="admin-help">登録されているキャンペーンはありません。</p>';
      renderUrls([]);
      return;
    }
    let html = '';
    for (const p of items) {
      const meta = [];
      if (p.duration != null) meta.push(`${p.duration}分`);
      if (p.price != null) meta.push('¥' + Number(p.price).toLocaleString('ja-JP'));
      const forClinic = p.forClinic === '192' ? '三島のみ'
        : p.forClinic === '193' ? '裾野のみ'
        : '両院';
      const forFt = p.forFirstTime === 'true' ? '初回のみ'
        : p.forFirstTime === 'false' ? '2回目以降のみ'
        : '初回 / 2回目以降';
      html += `<div class="promo-item" data-code="${escapeHtml(p.code)}">
        <div class="promo-item-main">
          <div class="promo-item-code">?promo=<strong>${escapeHtml(p.code)}</strong></div>
          <div class="promo-item-name">${escapeHtml(p.name)}</div>
          ${meta.length ? `<div class="promo-item-meta">${meta.join(' / ')}</div>` : ''}
          <div class="promo-item-tags">
            <span class="tag">${escapeHtml(forClinic)}</span>
            <span class="tag">${escapeHtml(forFt)}</span>
          </div>
        </div>
        <div class="promo-item-actions">
          <button type="button" class="admin-btn-mini" data-act="edit" data-code="${escapeHtml(p.code)}">編集</button>
          <button type="button" class="admin-btn-mini admin-btn-danger" data-act="del" data-code="${escapeHtml(p.code)}">削除</button>
        </div>
      </div>`;
    }
    list.innerHTML = html;
    list.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => onItemAction(b.dataset.act, b.dataset.code, items));
    });
    renderUrls(items);
  }

  function renderUrls(items) {
    const wrap = $('url-list');
    if (!items.length) { wrap.innerHTML = ''; return; }
    const origin = window.location.origin;
    wrap.innerHTML = items.map((p) => {
      const url = `${origin}/?promo=${encodeURIComponent(p.code)}`;
      return `<div class="url-item">
        <div class="url-name">${escapeHtml(p.name)}</div>
        <input type="text" readonly value="${escapeHtml(url)}" onfocus="this.select()">
        <button type="button" class="admin-btn-mini" data-copy="${escapeHtml(url)}">コピー</button>
      </div>`;
    }).join('');
    wrap.querySelectorAll('button[data-copy]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(b.dataset.copy);
          const o = b.textContent;
          b.textContent = 'コピー済';
          setTimeout(() => { b.textContent = o; }, 1200);
        } catch {}
      });
    });
  }

  function onItemAction(act, code, items) {
    if (act === 'edit') {
      const p = items.find((x) => x.code === code);
      if (!p) return;
      $('f-code').value = p.code;
      $('f-name').value = p.name || '';
      $('f-description').value = p.description || '';
      $('f-duration').value = p.duration ?? '';
      $('f-price').value = p.price ?? '';
      $('f-forClinic').value = p.forClinic || 'both';
      $('f-forFirstTime').value = p.forFirstTime || 'both';
      $('f-code').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (act === 'del') {
      if (!confirm(`「${code}」を削除しますか？`)) return;
      apiFetch('/api/admin/promos?code=' + encodeURIComponent(code), { method: 'DELETE' })
        .then((r) => r.json())
        .then((data) => renderPromos(data.items || []))
        .catch(() => alert('削除に失敗しました'));
    }
  }

  $('promo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      code: $('f-code').value.trim(),
      name: $('f-name').value.trim(),
      description: $('f-description').value.trim(),
      duration: $('f-duration').value === '' ? null : Number($('f-duration').value),
      price: $('f-price').value === '' ? null : Number($('f-price').value),
      forClinic: $('f-forClinic').value,
      forFirstTime: $('f-forFirstTime').value,
    };
    $('form-error').hidden = true;
    $('form-info').hidden = true;
    try {
      const r = await apiFetch('/api/admin/promos', { method: 'POST', body });
      const data = await r.json();
      if (!r.ok) {
        $('form-error').textContent = data.error || '保存に失敗しました';
        $('form-error').hidden = false;
        return;
      }
      $('form-info').textContent = '保存しました';
      $('form-info').hidden = false;
      $('promo-form').reset();
      renderPromos(data.items || []);
      setTimeout(() => { $('form-info').hidden = true; }, 2000);
    } catch (e) {
      // unauthorized handler will redirect
    }
  });

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Init: try to use stored password silently ---
  (async () => {
    if (getPass()) {
      try {
        const r = await apiFetch('/api/admin/promos');
        if (r.ok) showAuthView();
      } catch {}
    }
  })();
})();
