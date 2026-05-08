(function () {
  'use strict';

  const STORAGE_KEY = 'recovery-admin-pass';

  function $(id) { return document.getElementById(id); }

  function showAuthView() {
    $('login-card').hidden = true;
    $('auth-view').hidden = false;
    applyKindUI();
    refreshTargetCourseOptions();
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

  // --- Course list (for target dropdown) ---

  const courseCache = {}; // key = clinic + ':' + forNew(true/false) -> courses[]

  async function getCourses(clinic, forNew) {
    const key = `${clinic}:${forNew}`;
    if (courseCache[key]) return courseCache[key];
    try {
      const r = await fetch(`/api/courses?clinic=${clinic}&for_new=${forNew}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!r.ok) return [];
      const d = await r.json();
      courseCache[key] = d.courses || [];
      return courseCache[key];
    } catch { return []; }
  }

  async function refreshTargetCourseOptions(preserveValue) {
    const sel = $('f-targetCourseId');
    const help = $('f-target-help');
    const clinic = $('f-forClinic').value;
    const ft = $('f-forFirstTime').value;
    if (clinic === 'both' || ft === 'both') {
      sel.innerHTML = '<option value="">— 院と来院を「両方以外」に絞ってください —</option>';
      sel.disabled = true;
      help.textContent = '価格上書き／自動進行の場合は、対象院と対象来院を1つずつ選んでください。';
      return;
    }
    sel.disabled = false;
    help.textContent = '読み込み中…';
    const courses = await getCourses(clinic, ft === 'true');
    let html = '<option value="">— 選択してください —</option>';
    for (const c of courses) {
      const meta = [];
      if (c.duration) meta.push(`${c.duration}分`);
      if (typeof c.price === 'number') meta.push('¥' + Number(c.price).toLocaleString('ja-JP'));
      const label = `${c.name}${meta.length ? ' (' + meta.join('・') + ')' : ''}`;
      html += `<option value="${c.id}">${escapeHtml(label)}</option>`;
    }
    sel.innerHTML = html;
    if (preserveValue != null) sel.value = String(preserveValue);
    help.textContent = courses.length ? `${courses.length}件のコースがあります。` : 'コースが取得できませんでした。';
  }

  function getKind() {
    return document.querySelector('input[name="kind"]:checked')?.value || 'override';
  }
  function setKind(kind) {
    const r = document.querySelector(`input[name="kind"][value="${kind}"]`);
    if (r) r.checked = true;
    applyKindUI();
  }
  function applyKindUI() {
    const kind = getKind();
    const isOverride = kind === 'override';
    $('f-target-wrap').hidden = !isOverride;
    $('f-targetCourseId').required = isOverride;
    $('f-duration-wrap').hidden = isOverride;
    // Name field is required only for addon-type promos
    $('f-name').required = !isOverride;
    $('f-name-label').innerHTML = isOverride
      ? '表示名 <small>(任意・空欄なら元のコース名を使用)</small>'
      : 'メニュー名';
    const descLabel = document.getElementById('f-description-label');
    if (descLabel) {
      descLabel.innerHTML = isOverride
        ? '説明 <small>(任意・空欄なら元のコースの説明を使用)</small>'
        : '説明 <small>(任意)</small>';
    }
  }

  document.querySelectorAll('input[name="kind"]').forEach((r) => {
    r.addEventListener('change', applyKindUI);
  });
  $('f-forClinic').addEventListener('change', () => refreshTargetCourseOptions());
  $('f-forFirstTime').addEventListener('change', () => refreshTargetCourseOptions());
  $('f-code-rand').addEventListener('click', () => {
    $('f-code').value = generateRandomCode(6);
    $('f-code').focus();
  });

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
      const kindTag = p.targetCourseId ? '価格上書き' : '新メニュー追加';
      const autoTag = p.autoOpen ? '<span class="tag tag-auto">自動進行</span>' : '';
      const fullUrl = location.origin + '/?promo=' + encodeURIComponent(p.code);
      html += `<div class="promo-item" data-code="${escapeHtml(p.code)}">
        <div class="promo-item-main">
          <div class="promo-item-code">?promo=<strong>${escapeHtml(p.code)}</strong></div>
          <div class="promo-item-name">${escapeHtml(p.name || '(表示名なし=元のコース名)')}</div>
          ${meta.length ? `<div class="promo-item-meta">${meta.join(' / ')}</div>` : ''}
          <div class="promo-item-tags">
            <span class="tag">${escapeHtml(kindTag)}</span>
            <span class="tag">${escapeHtml(forClinic)}</span>
            <span class="tag">${escapeHtml(forFt)}</span>
            ${autoTag}
          </div>
          <div class="promo-item-url">
            <input type="text" readonly value="${escapeHtml(fullUrl)}" data-url-for="${escapeHtml(p.code)}">
            <div class="promo-item-url-actions">
              <button type="button" class="admin-btn-mini" data-act="copy" data-code="${escapeHtml(p.code)}">コピー</button>
              <button type="button" class="admin-btn-mini" data-act="open" data-code="${escapeHtml(p.code)}">開く</button>
            </div>
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
    list.querySelectorAll('input[data-url-for]').forEach((i) => {
      i.addEventListener('focus', () => i.select());
    });
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }

  function generateRandomCode(len = 6) {
    // Lowercase letters + digits, excluding visually confusing chars (0/o/1/l/i)
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let out = '';
    const buf = new Uint32Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
    return out;
  }

  function onItemAction(act, code, items) {
    const fullUrl = location.origin + '/?promo=' + encodeURIComponent(code);
    if (act === 'open') {
      window.open(fullUrl, '_blank', 'noopener');
      return;
    }
    if (act === 'copy') {
      const btn = document.querySelector(`.promo-item[data-code="${CSS.escape(code)}"] button[data-act="copy"]`);
      copyToClipboard(fullUrl).then((ok) => {
        if (btn) {
          const o = btn.textContent;
          btn.textContent = ok ? 'コピー済' : '失敗';
          setTimeout(() => { btn.textContent = o; }, 1200);
        }
      });
      return;
    }
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
      $('f-autoOpen').checked = !!p.autoOpen;
      setKind(p.targetCourseId ? 'override' : 'addon');
      refreshTargetCourseOptions(p.targetCourseId || null);
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
    const kind = getKind();
    const targetRaw = $('f-targetCourseId').value;
    const body = {
      code: $('f-code').value.trim(),
      name: $('f-name').value.trim(),
      description: $('f-description').value.trim(),
      duration: kind === 'addon' && $('f-duration').value !== '' ? Number($('f-duration').value) : null,
      price: $('f-price').value === '' ? null : Number($('f-price').value),
      forClinic: $('f-forClinic').value,
      forFirstTime: $('f-forFirstTime').value,
      targetCourseId: kind === 'override' && targetRaw !== '' ? Number(targetRaw) : null,
      autoOpen: $('f-autoOpen').checked,
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
      setKind('override');
      refreshTargetCourseOptions();
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
