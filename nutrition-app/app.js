/* ONE'S MEAL - main app */
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  profile: null,
  targets: null,
  member: null,
  mode: 'guest',
  currentDate: todayStr(),
  currentMeal: 'breakfast',
  catFilter: 'すべて',
  selectedFood: null,
  weightRange: 7,
  adviceMode: 'daily',
  adviceCache: { daily: null, weekly: null }
};

function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fmtDateJp(s) {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}（${'日月火水木金土'[d.getDay()]}）`;
}
function fmtShortDate(s) {
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

/* ---------- Routing ---------- */
function showPage(name) {
  $$('.page').forEach((p) => p.classList.remove('active'));
  const target = $(`#page-${name}`);
  if (target) target.classList.add('active');
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.page === name));
  if (name === 'home') renderHome();
  if (name === 'log') renderLog();
  if (name === 'weight') renderWeight();
  if (name === 'advice') renderAdvice();
  if (name === 'settings') renderSettings();
}

/* ---------- Onboarding ---------- */
let ob = { step: 0, data: { sex: null, activity: null, goal: null } };

function renderObDots() {
  const c = $('#ob-dots');
  c.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    if (i <= ob.step) s.classList.add('active');
    c.appendChild(s);
  }
}
function showObStep(s) {
  ob.step = s;
  [0, 1, 2].forEach((i) => $(`#ob-step-${i}`).classList.toggle('hidden', i !== s));
  renderObDots();
}

function bindObChips() {
  $$('[data-chip]').forEach((group) => {
    const key = group.dataset.chip;
    group.addEventListener('click', (e) => {
      const btn = e.target.closest('.chip');
      if (!btn) return;
      group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      btn.classList.add('active');
      ob.data[key] = btn.dataset.val;
    });
  });
}

function getObInputs() {
  return {
    sex: ob.data.sex,
    age: +($('#ob-age').value),
    height: +($('#ob-height').value),
    weight: +($('#ob-weight').value),
    target: +($('#ob-target').value),
    activity: ob.data.activity,
    goal: ob.data.goal
  };
}

function renderObSummary() {
  const inp = getObInputs();
  const profile = { sex: inp.sex, age: inp.age, height: inp.height, weight: inp.weight, activity: inp.activity, goal: inp.goal };
  const t = nutrition.calcTargets(profile);
  $('#ob-summary').innerHTML = `
    <div class="row"><span class="label">基礎代謝 (BMR)</span><span class="value">${t.bmr} kcal</span></div>
    <div class="row"><span class="label">活動代謝 (TDEE)</span><span class="value">${t.tdee} kcal</span></div>
    <div class="row"><span class="label">目標カロリー</span><span class="value" style="color:var(--accent-2)">${t.kcal} kcal</span></div>
    <div class="row"><span class="label">タンパク質</span><span class="value">${t.p} g</span></div>
    <div class="row"><span class="label">脂質</span><span class="value">${t.f} g</span></div>
    <div class="row"><span class="label">炭水化物</span><span class="value">${t.c} g</span></div>
    <div class="row"><span class="label">想定ペース</span><span class="value">${t.weeklyKg >= 0 ? '+' : ''}${t.weeklyKg} kg/週</span></div>
  `;
}

function validateStep0() {
  const i = getObInputs();
  if (!i.sex) return '性別を選択してください';
  if (!i.age || i.age < 14 || i.age > 90) return '年齢を正しく入力してください';
  if (!i.height || i.height < 120) return '身長を正しく入力してください';
  if (!i.weight) return '体重を正しく入力してください';
  if (!i.target) return '目標体重を入力してください';
  return null;
}
function validateStep1() {
  if (!ob.data.activity) return '活動量を選択してください';
  if (!ob.data.goal) return '目標を選択してください';
  return null;
}

async function finishOnboard() {
  const i = getObInputs();
  const profile = {
    sex: i.sex, age: i.age, height: i.height, weight: i.weight,
    targetWeight: i.target, activity: i.activity, goal: i.goal
  };
  await db.saveProfile(profile);
  await db.setWeight(todayStr(), i.weight, null);

  const code = $('#ob-code').value.trim();
  if (code) {
    const r = await auth.activateMember({ code });
    if (!r.ok) toast(r.error || '会員コードが無効');
  }
  await boot();
  showApp();
  showPage('home');
}

/* ---------- App shell ---------- */
function showApp() {
  $('#page-onboard').classList.remove('active');
  $('#appbar').style.display = '';
  $('#tabbar').style.display = '';
}
function showOnboard() {
  $('#appbar').style.display = 'none';
  $('#tabbar').style.display = 'none';
  $$('.page').forEach((p) => p.classList.remove('active'));
  $('#page-onboard').classList.add('active');
  showObStep(0);
}

/* ---------- Home ---------- */
async function renderHome() {
  if (!state.profile) return;
  $('#today-label').textContent = `今日 · ${fmtDateJp(state.currentDate)}`;

  const meals = await db.getMealsByDate(state.currentDate);
  const sum = nutrition.sumDay(meals);
  const t = state.targets;

  $('#kcal-eaten').innerHTML = `${Math.round(sum.kcal)}<small>/${t.kcal} kcal</small>`;
  const rem = t.kcal - sum.kcal;
  $('#kcal-remaining').textContent = rem >= 0 ? `残り ${rem} kcal` : `${Math.abs(rem)} kcal オーバー`;
  const pill = $('#kcal-pill');
  pill.className = 'pill';
  if (sum.kcal === 0) { pill.textContent = '記録を始めましょう'; pill.classList.add('under'); }
  else if (sum.kcal > t.kcal * 1.05) { pill.textContent = 'オーバー'; pill.classList.add('over'); }
  else if (sum.kcal < t.kcal * 0.85) { pill.textContent = 'やや不足'; pill.classList.add('under'); }
  else { pill.textContent = 'ペース良好'; pill.classList.add('ok'); }

  charts.drawRing($('#ring-p'), sum.p, t.p, getComputedStyle(document.documentElement).getPropertyValue('--p').trim() || '#4c8bf5');
  charts.drawRing($('#ring-f'), sum.f, t.f, getComputedStyle(document.documentElement).getPropertyValue('--f').trim() || '#e0a82a');
  charts.drawRing($('#ring-c'), sum.c, t.c, getComputedStyle(document.documentElement).getPropertyValue('--c').trim() || '#e0594d');
  $('#val-p').textContent = `${sum.p.toFixed(1)}g`;
  $('#val-f').textContent = `${sum.f.toFixed(1)}g`;
  $('#val-c').textContent = `${sum.c.toFixed(1)}g`;
  $('#tgt-p').textContent = `/ ${t.p}g`;
  $('#tgt-f').textContent = `/ ${t.f}g`;
  $('#tgt-c').textContent = `/ ${t.c}g`;

  // meals preview
  const byMeal = nutrition.sumByMeal(meals);
  const labels = { breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' };
  const html = ['breakfast', 'lunch', 'dinner', 'snack'].map((m) => {
    const items = byMeal[m];
    const kcal = items.reduce((a, b) => a + b.kcal, 0);
    if (items.length === 0) return '';
    const top = items.slice(0, 3).map((it) => `<span>${it.name}</span>`).join('');
    return `
      <div class="meal-section">
        <div class="meal-header"><span class="name">${labels[m]}</span><span class="kcal">${kcal} kcal</span></div>
        ${items.map((it) => `
          <div class="meal-item">
            <div class="info">
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="meta"><span>${it.kcal} kcal</span><span>P ${it.p}g</span><span>F ${it.f}g</span><span>C ${it.c}g</span></div>
            </div>
          </div>`).join('')}
      </div>`;
  }).join('');
  $('#home-meals').innerHTML = html || '<div class="meal-empty">まだ記録がありません</div>';

  // weight
  const weights = await db.getAllWeights();
  if (weights.length) {
    const last = weights[weights.length - 1];
    $('#home-weight').textContent = `${last.weight} kg`;
    const target = state.profile.targetWeight;
    const diff = +(last.weight - target).toFixed(1);
    $('#home-weight-diff').textContent = diff === 0 ? '目標到達 🎯' : `${diff > 0 ? '−' : '+'}${Math.abs(diff)} kg`;
    const recent = weights.slice(-14);
    charts.drawLine($('#weight-chart-mini'), recent.map((w) => ({ y: w.weight, label: fmtShortDate(w.date) })), { target });
  } else {
    $('#home-weight').textContent = '— kg';
    $('#home-weight-diff').textContent = '—';
  }

  // advice (rule-only fast on home; full AI on advice page)
  const recent7 = await getRecent7DaysSummary();
  const ad = await ai.fetchAdvice({ profile: state.profile, targets: state.targets, today: sum, recent7 });
  $('#advice-body').innerHTML = formatAdvice(ad.text);
}

function formatAdvice(text) {
  return escapeHtml(text).replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function getRecent7DaysSummary() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = todayStr(d);
    const meals = await db.getMealsByDate(date);
    const sum = nutrition.sumDay(meals);
    if (sum.kcal > 0) days.push({ date, ...sum });
  }
  return days;
}

/* ---------- Log ---------- */
async function renderLog() {
  // category chips
  const cc = $('#cat-chips');
  if (!cc.children.length) {
    cc.innerHTML = FOOD_CATEGORIES.map((c) => `<button class="chip${c === state.catFilter ? ' active' : ''}" data-cat="${c}">${c}</button>`).join('');
    cc.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cat]');
      if (!b) return;
      state.catFilter = b.dataset.cat;
      cc.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.cat === state.catFilter));
      doSearch();
    });
  }

  // history chips
  const recent = await db.getRecentMeals(8);
  const hist = $('#history-row');
  if (recent.length) {
    hist.style.display = '';
    $('#history-chips').innerHTML = recent.map((r) => `<button class="chip" data-recent='${escapeJson(r)}'>${escapeHtml(r.name)}</button>`).join('');
  } else hist.style.display = 'none';

  // render today's log
  const meals = await db.getMealsByDate(state.currentDate);
  const byMeal = nutrition.sumByMeal(meals);
  const labels = { breakfast: '朝', lunch: '昼', dinner: '夕', snack: '間食' };
  const html = ['breakfast', 'lunch', 'dinner', 'snack'].map((m) => {
    const items = byMeal[m];
    const kcal = items.reduce((a, b) => a + b.kcal, 0);
    return `
      <div class="meal-section">
        <div class="meal-header"><span class="name">${labels[m]}</span><span class="kcal">${kcal} kcal</span></div>
        ${items.length ? items.map((it) => `
          <div class="meal-item">
            <div class="info">
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="meta"><span>${it.kcal} kcal</span><span>P ${it.p}g</span><span>F ${it.f}g</span><span>C ${it.c}g</span></div>
            </div>
            <div class="actions">
              <button class="btn sm secondary" data-del="${it.id}">削除</button>
            </div>
          </div>`).join('') : '<div class="meal-empty">未記録</div>'}
      </div>`;
  }).join('');
  $('#log-list').innerHTML = html;

  doSearch();
}

function escapeJson(o) {
  return escapeHtml(JSON.stringify(o));
}

function doSearch() {
  const q = $('#food-search').value;
  const list = searchFoods(q, state.catFilter);
  $('#search-results').innerHTML = list.length
    ? list.map((f) => `
        <div class="item" data-food="${f.id}">
          <div class="name">${escapeHtml(f.name)}</div>
          <div class="meta">${f.kcal} kcal · P ${f.p}g · F ${f.f}g · C ${f.c}g · ${escapeHtml(f.unit)}</div>
        </div>`).join('')
    : '<div class="meal-empty">該当する食品が見つかりません</div>';
}

/* ---------- Add meal modal ---------- */
function openAddModal(food, presetQty = 1) {
  state.selectedFood = food;
  $('#modal-title').textContent = food.name;
  $('#modal-body').innerHTML = `
    <div class="row" style="margin-bottom:12px"><span class="dim">${escapeHtml(food.unit)} あたり</span><span class="muted">${food.kcal} kcal · P ${food.p}g · F ${food.f}g · C ${food.c}g</span></div>
    <div class="field">
      <label>量</label>
      <div class="flex">
        <button class="btn sm secondary" data-qty="-0.5">−</button>
        <input type="number" id="add-qty" step="0.1" value="${presetQty}" inputmode="decimal" class="flex-1"/>
        <button class="btn sm secondary" data-qty="+0.5">＋</button>
      </div>
      <p class="hint">単位の倍数（例: 1.5 = ${escapeHtml(food.unit)} × 1.5）</p>
    </div>
    <div class="card" id="add-preview" style="margin-bottom:14px"></div>
    <div class="btn-row">
      <button class="btn secondary flex-1" id="add-cancel">キャンセル</button>
      <button class="btn flex-1" id="add-save">${({breakfast:'朝',lunch:'昼',dinner:'夕',snack:'間食'})[state.currentMeal]}に追加</button>
    </div>
  `;
  refreshAddPreview();
  $('#modal-add').classList.add('show');
}
function refreshAddPreview() {
  const qty = +($('#add-qty').value) || 0;
  const f = state.selectedFood;
  const scaled = nutrition.scaleItem(f, qty);
  $('#add-preview').innerHTML = `
    <div class="row"><span class="label">カロリー</span><span class="value">${scaled.kcal} kcal</span></div>
    <div class="row"><span class="label">タンパク質</span><span class="value">${scaled.p} g</span></div>
    <div class="row"><span class="label">脂質</span><span class="value">${scaled.f} g</span></div>
    <div class="row"><span class="label">炭水化物</span><span class="value">${scaled.c} g</span></div>
  `;
}
function closeAddModal() { $('#modal-add').classList.remove('show'); }

async function saveAddedMeal() {
  const f = state.selectedFood;
  if (!f) return;
  const qty = +($('#add-qty').value) || 0;
  if (qty <= 0) return toast('量を入力してください');
  const scaled = nutrition.scaleItem(f, qty);
  await db.addMeal({ date: state.currentDate, meal: state.currentMeal, ...scaled });
  closeAddModal();
  toast(`「${f.name}」を追加しました`);
  await renderLog();
}

/* ---------- Manual entry ---------- */
function openManualModal() {
  ['man-name', 'man-kcal', 'man-p', 'man-f', 'man-c'].forEach((id) => $('#' + id).value = '');
  $('#modal-manual').classList.add('show');
}
async function saveManualMeal() {
  const name = $('#man-name').value.trim();
  const kcal = +($('#man-kcal').value) || 0;
  const p = +($('#man-p').value) || 0;
  const f = +($('#man-f').value) || 0;
  const c = +($('#man-c').value) || 0;
  if (!name) return toast('食品名を入力してください');
  await db.addMeal({ date: state.currentDate, meal: state.currentMeal, name, kcal, p, f, c, qty: 1, unit: '1人前' });
  $('#modal-manual').classList.remove('show');
  toast('追加しました');
  await renderLog();
}

/* ---------- Photo (AI vision) ---------- */
async function handlePhoto(file) {
  const compressed = await compressImage(file, 1024);
  toast('AI解析中...');
  try {
    const result = await ai.analyzePhoto(compressed);
    if (!result.items || !result.items.length) {
      toast('検出できませんでした。手入力で追加してください。');
      openManualModal();
      return;
    }
    for (const it of result.items) {
      await db.addMeal({
        date: state.currentDate, meal: state.currentMeal,
        name: it.name, kcal: Math.round(it.kcal || 0),
        p: +((it.p || 0).toFixed(1)), f: +((it.f || 0).toFixed(1)), c: +((it.c || 0).toFixed(1)),
        qty: it.qty || 1, unit: it.unit || '1人前'
      });
    }
    toast(`${result.items.length}件を追加しました`);
    await renderLog();
  } catch (e) {
    toast('AI解析に失敗。手入力で追加してください。');
    openManualModal();
  }
}

function compressImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = h * (maxDim / w); w = maxDim; }
        else if (h > maxDim) { w = w * (maxDim / h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Weight ---------- */
async function renderWeight() {
  $('#weight-date').value = state.currentDate;
  const weights = await db.getAllWeights();
  if (state.profile?.targetWeight) {
    $('#weight-target-disp').textContent = `${state.profile.targetWeight} kg`;
  }
  if (weights.length === 0) {
    charts.drawLine($('#weight-chart'), [], {});
    $('#weight-change').textContent = '—';
    return;
  }
  const range = state.weightRange;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  const cutoffStr = todayStr(cutoff);
  const filtered = weights.filter((w) => w.date >= cutoffStr);
  const pts = filtered.map((w) => ({ y: w.weight, label: fmtShortDate(w.date) }));
  charts.drawLine($('#weight-chart'), pts, { target: state.profile?.targetWeight });
  if (filtered.length >= 2) {
    const change = +(filtered[filtered.length - 1].weight - filtered[0].weight).toFixed(1);
    $('#weight-change').textContent = `${change > 0 ? '+' : ''}${change} kg`;
  } else {
    $('#weight-change').textContent = '—';
  }
}

async function saveWeight() {
  const date = $('#weight-date').value;
  const w = +($('#weight-input').value);
  const bf = $('#bodyfat-input').value ? +$('#bodyfat-input').value : null;
  if (!date || !w) return toast('日付と体重を入力してください');
  await db.setWeight(date, w, bf);
  toast('保存しました');
  $('#weight-input').value = '';
  $('#bodyfat-input').value = '';
  // refresh targets if today's weight changed -> profile updates
  if (date === todayStr() && state.profile) {
    await db.saveProfile({ ...state.profile, weight: w });
    state.profile = await db.getProfile();
    state.targets = nutrition.calcTargets(state.profile);
  }
  await renderWeight();
}

/* ---------- Advice ---------- */
async function renderAdvice() {
  const mode = state.adviceMode;
  $$('#advice-seg button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  $('#advice-content').innerHTML = '<div class="loading"><span class="spinner"></span> 分析中...</div>';

  const meals = await db.getMealsByDate(state.currentDate);
  const today = nutrition.sumDay(meals);
  const recent7 = await getRecent7DaysSummary();
  const weights = await db.getAllWeights();
  const recentWeights = weights.slice(-14);

  const payload = {
    profile: state.profile,
    targets: state.targets,
    today,
    recent7,
    weights: recentWeights,
    mode
  };

  if (!state.adviceCache[mode]) {
    const r = await ai.fetchAdvice(payload);
    state.adviceCache[mode] = r;
  }
  const r = state.adviceCache[mode];

  const sourceLabel = r.source === 'ai' ? 'Claude AIによる分析' : 'ルールベース分析';
  $('#advice-content').innerHTML = `
    <div class="advice">
      <div class="head">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" stroke-linejoin="round"/></svg>
        <span class="title">${mode === 'daily' ? '今日のアドバイス' : '週次レポート'}</span>
      </div>
      <div class="body">${formatAdvice(r.text)}</div>
    </div>
    <div class="card">
      <h3>本日の収支</h3>
      <div class="row"><span class="label">摂取カロリー</span><span class="value">${Math.round(today.kcal)} kcal</span></div>
      <div class="row"><span class="label">目標カロリー</span><span class="value">${state.targets.kcal} kcal</span></div>
      <div class="row"><span class="label">差分</span><span class="value">${(today.kcal - state.targets.kcal).toFixed(0)} kcal</span></div>
      <div class="row mt-1"><span class="label">P / F / C</span><span class="value">${today.p.toFixed(1)} / ${today.f.toFixed(1)} / ${today.c.toFixed(1)} g</span></div>
    </div>
    <div class="card center"><div class="muted" style="font-size:11px">${sourceLabel}</div></div>
  `;
}

/* ---------- Settings ---------- */
async function renderSettings() {
  const p = state.profile;
  const t = state.targets;
  if (p) {
    $('#settings-profile').innerHTML = `
      <div class="row"><span class="label">性別</span><span class="value">${p.sex === 'male' ? '男性' : '女性'}</span></div>
      <div class="row"><span class="label">年齢</span><span class="value">${p.age} 歳</span></div>
      <div class="row"><span class="label">身長</span><span class="value">${p.height} cm</span></div>
      <div class="row"><span class="label">体重</span><span class="value">${p.weight} kg</span></div>
      <div class="row"><span class="label">目標体重</span><span class="value">${p.targetWeight} kg</span></div>
      <div class="row"><span class="label">活動量</span><span class="value">${({low:'低',mid:'中',high:'高'})[p.activity]}</span></div>
      <div class="row"><span class="label">目標</span><span class="value">${nutrition.GOAL_PRESETS[p.goal]?.label}</span></div>
      <div class="row"><span class="label">BMI</span><span class="value">${nutrition.bmi(p.weight, p.height)}</span></div>
    `;
  }
  if (t) {
    $('#settings-targets').innerHTML = `
      <div class="row"><span class="label">基礎代謝</span><span class="value">${t.bmr} kcal</span></div>
      <div class="row"><span class="label">活動代謝</span><span class="value">${t.tdee} kcal</span></div>
      <div class="row"><span class="label">目標カロリー</span><span class="value" style="color:var(--accent-2)">${t.kcal} kcal</span></div>
      <div class="row"><span class="label">タンパク質</span><span class="value">${t.p} g</span></div>
      <div class="row"><span class="label">脂質</span><span class="value">${t.f} g</span></div>
      <div class="row"><span class="label">炭水化物</span><span class="value">${t.c} g</span></div>
    `;
  }
  const m = await auth.getMember();
  if (m) {
    $('#settings-member').innerHTML = `
      <div class="row"><span class="label">ステータス</span><span class="value" style="color:var(--accent-2)">会員認証済み</span></div>
      ${m.displayName ? `<div class="row"><span class="label">LINE名</span><span class="value">${escapeHtml(m.displayName)}</span></div>` : ''}
      ${m.code ? `<div class="row"><span class="label">コード</span><span class="value">${escapeHtml(m.code)}</span></div>` : ''}
    `;
    $('#btn-member-activate').classList.add('hidden');
    $('#btn-member-logout').classList.remove('hidden');
  } else {
    $('#settings-member').innerHTML = `<div class="dim">ゲストモード。一般機能のみ利用可能です。</div>`;
    $('#btn-member-activate').classList.remove('hidden');
    $('#btn-member-logout').classList.add('hidden');
  }
}

function openProfileEdit() {
  const p = state.profile;
  $('#modal-profile-body').innerHTML = `
    <div class="field">
      <label>性別</label>
      <div class="chip-group" data-edit="sex">
        <button class="chip${p.sex==='male'?' active':''}" data-val="male">男性</button>
        <button class="chip${p.sex==='female'?' active':''}" data-val="female">女性</button>
      </div>
    </div>
    <div class="field-row">
      <div class="field"><label>年齢</label><input type="number" id="ep-age" value="${p.age}"/></div>
      <div class="field"><label>身長 (cm)</label><input type="number" id="ep-height" step="0.1" value="${p.height}"/></div>
    </div>
    <div class="field-row">
      <div class="field"><label>体重 (kg)</label><input type="number" id="ep-weight" step="0.1" value="${p.weight}"/></div>
      <div class="field"><label>目標体重 (kg)</label><input type="number" id="ep-target" step="0.1" value="${p.targetWeight}"/></div>
    </div>
    <div class="field">
      <label>活動量</label>
      <div class="chip-group" data-edit="activity">
        <button class="chip${p.activity==='low'?' active':''}" data-val="low">低</button>
        <button class="chip${p.activity==='mid'?' active':''}" data-val="mid">中</button>
        <button class="chip${p.activity==='high'?' active':''}" data-val="high">高</button>
      </div>
    </div>
    <div class="field">
      <label>目標</label>
      <div class="chip-group" data-edit="goal">
        <button class="chip${p.goal==='diet'?' active':''}" data-val="diet">ダイエット</button>
        <button class="chip${p.goal==='bodymake'?' active':''}" data-val="bodymake">体型維持</button>
        <button class="chip${p.goal==='bulk'?' active':''}" data-val="bulk">バルクアップ</button>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn secondary flex-1" id="ep-cancel">キャンセル</button>
      <button class="btn flex-1" id="ep-save">保存</button>
    </div>
  `;
  const body = $('#modal-profile-body');
  body.querySelectorAll('[data-edit]').forEach((grp) => {
    grp.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      grp.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      b.classList.add('active');
    });
  });
  $('#ep-cancel').addEventListener('click', () => $('#modal-profile').classList.remove('show'));
  $('#ep-save').addEventListener('click', async () => {
    const get = (grp) => body.querySelector(`[data-edit="${grp}"] .chip.active`)?.dataset.val;
    const upd = {
      ...p,
      sex: get('sex') || p.sex,
      age: +$('#ep-age').value || p.age,
      height: +$('#ep-height').value || p.height,
      weight: +$('#ep-weight').value || p.weight,
      targetWeight: +$('#ep-target').value || p.targetWeight,
      activity: get('activity') || p.activity,
      goal: get('goal') || p.goal
    };
    await db.saveProfile(upd);
    state.profile = await db.getProfile();
    state.targets = nutrition.calcTargets(state.profile);
    $('#modal-profile').classList.remove('show');
    toast('プロフィールを更新しました');
    await renderSettings();
    state.adviceCache = { daily: null, weekly: null };
  });
  $('#modal-profile').classList.add('show');
}

/* ---------- Member ---------- */
function openMemberModal() {
  $('#member-code').value = '';
  $('#modal-member').classList.add('show');
}

async function submitMemberCode() {
  const code = $('#member-code').value.trim();
  const r = await auth.activateMember({ code });
  if (!r.ok) return toast(r.error || '認証に失敗しました');
  toast('会員認証が完了しました');
  $('#modal-member').classList.remove('show');
  await refreshMember();
  await renderSettings();
}

async function memberLineLogin() {
  const liffId = await db.kvGet('liffId');
  if (!liffId) {
    toast('LIFF IDが未設定です（設定→データから設定可能）');
    return;
  }
  const r = await liffHelper.initLiff(liffId);
  if (!r.ok) return toast('LINE連携に失敗: ' + (r.reason || ''));
  if (!r.loggedIn) { liff.login(); return; }
  const ar = await auth.activateMember({ lineProfile: r.profile });
  if (!ar.ok) return toast(ar.error || '認証失敗');
  toast(`${r.profile.displayName} さんとして認証`);
  $('#modal-member').classList.remove('show');
  await refreshMember();
  await renderSettings();
}

async function refreshMember() {
  state.member = await auth.getMember();
  state.mode = await auth.getMode();
  $('#mode-badge').textContent = state.mode === 'member' ? '会員' : 'ゲスト';
  $('#mode-badge').style.background = state.mode === 'member' ? 'var(--accent-soft)' : 'var(--bg-3)';
  $('#mode-badge').style.color = state.mode === 'member' ? 'var(--accent-2)' : 'var(--text-mute)';
}

/* ---------- Data export/import ---------- */
async function exportData() {
  const all = await db.exportAll();
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ones-meal-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
function importData(file) {
  const r = new FileReader();
  r.onload = async () => {
    try {
      const data = JSON.parse(r.result);
      await db.importAll(data);
      toast('インポートしました');
      await boot();
      await renderSettings();
    } catch (e) {
      toast('JSONの形式が不正です');
    }
  };
  r.readAsText(file);
}

async function resetAll() {
  if (!confirm('すべてのデータを削除します。よろしいですか？')) return;
  await db.clearAll();
  location.reload();
}

/* ---------- Event wiring ---------- */
function wireEvents() {
  // Onboarding chips
  bindObChips();
  $('#ob-next-0').addEventListener('click', () => {
    const err = validateStep0();
    if (err) return toast(err);
    showObStep(1);
  });
  $('#ob-back-1').addEventListener('click', () => showObStep(0));
  $('#ob-next-1').addEventListener('click', () => {
    const err = validateStep1();
    if (err) return toast(err);
    renderObSummary();
    showObStep(2);
  });
  $('#ob-back-2').addEventListener('click', () => showObStep(1));
  $('#ob-finish').addEventListener('click', finishOnboard);

  // Tabbar
  $('#tabbar').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-page]');
    if (!b) return;
    showPage(b.dataset.page);
  });

  // Home quick add
  $('#btn-quick-add').addEventListener('click', () => {
    // pick best meal slot based on time
    const h = new Date().getHours();
    state.currentMeal = h < 10 ? 'breakfast' : h < 14 ? 'lunch' : h < 18 ? 'snack' : 'dinner';
    showPage('log');
    $$('#meal-seg button').forEach((b) => b.classList.toggle('active', b.dataset.meal === state.currentMeal));
  });

  // Meal segment
  $('#meal-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-meal]');
    if (!b) return;
    state.currentMeal = b.dataset.meal;
    $$('#meal-seg button').forEach((x) => x.classList.toggle('active', x === b));
  });

  // Search
  $('#food-search').addEventListener('input', () => doSearch());
  $('#search-results').addEventListener('click', (e) => {
    const it = e.target.closest('[data-food]');
    if (!it) return;
    const food = getFood(it.dataset.food);
    if (food) openAddModal(food);
  });

  // History click
  $('#history-chips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recent]');
    if (!b) return;
    const meal = JSON.parse(b.dataset.recent.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    db.addMeal({ date: state.currentDate, meal: state.currentMeal, name: meal.name, kcal: meal.kcal, p: meal.p, f: meal.f, c: meal.c, qty: meal.qty || 1, unit: meal.unit || '' })
      .then(() => { toast('再追加しました'); renderLog(); });
  });

  // Log delete
  $('#log-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    await db.deleteMeal(b.dataset.del);
    toast('削除しました');
    await renderLog();
  });

  // Manual / Photo
  $('#btn-manual').addEventListener('click', openManualModal);
  $('#btn-photo').addEventListener('click', () => $('#photo-input').click());
  $('#photo-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) handlePhoto(f);
    e.target.value = '';
  });

  // Modal-add
  $('#modal-add').addEventListener('click', (e) => {
    if (e.target.id === 'modal-add') closeAddModal();
    const qb = e.target.closest('[data-qty]');
    if (qb) {
      const inp = $('#add-qty');
      inp.value = Math.max(0.1, (+inp.value + +qb.dataset.qty).toFixed(1));
      refreshAddPreview();
    }
    if (e.target.id === 'add-cancel') closeAddModal();
    if (e.target.id === 'add-save') saveAddedMeal();
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'add-qty') refreshAddPreview(); });

  // Manual modal
  $('#man-cancel').addEventListener('click', () => $('#modal-manual').classList.remove('show'));
  $('#man-save').addEventListener('click', saveManualMeal);
  $('#modal-manual').addEventListener('click', (e) => { if (e.target.id === 'modal-manual') $('#modal-manual').classList.remove('show'); });

  // Weight
  $('#btn-save-weight').addEventListener('click', saveWeight);
  $('#weight-range-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-range]');
    if (!b) return;
    state.weightRange = +b.dataset.range;
    $$('#weight-range-seg button').forEach((x) => x.classList.toggle('active', x === b));
    renderWeight();
  });

  // Advice
  $('#advice-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-mode]');
    if (!b) return;
    state.adviceMode = b.dataset.mode;
    renderAdvice();
  });
  $('#btn-refresh-advice').addEventListener('click', () => {
    state.adviceCache = { daily: null, weekly: null };
    renderAdvice();
  });

  // Settings
  $('#btn-edit-profile').addEventListener('click', openProfileEdit);
  $('#modal-profile').addEventListener('click', (e) => { if (e.target.id === 'modal-profile') $('#modal-profile').classList.remove('show'); });
  $('#btn-member-activate').addEventListener('click', openMemberModal);
  $('#btn-member-logout').addEventListener('click', async () => {
    await auth.deactivateMember();
    await refreshMember();
    await renderSettings();
    toast('会員モードを解除しました');
  });
  $('#member-cancel').addEventListener('click', () => $('#modal-member').classList.remove('show'));
  $('#member-submit').addEventListener('click', submitMemberCode);
  $('#member-line').addEventListener('click', memberLineLogin);
  $('#modal-member').addEventListener('click', (e) => { if (e.target.id === 'modal-member') $('#modal-member').classList.remove('show'); });

  $('#btn-export').addEventListener('click', exportData);
  $('#btn-import').addEventListener('click', () => $('#import-input').click());
  $('#import-input').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) importData(f);
    e.target.value = '';
  });
  $('#btn-reset').addEventListener('click', resetAll);
}

/* ---------- Boot ---------- */
async function boot() {
  state.profile = await db.getProfile();
  if (state.profile) state.targets = nutrition.calcTargets(state.profile);
  await refreshMember();
}

async function init() {
  wireEvents();
  await boot();

  if (!state.profile) {
    showOnboard();
  } else {
    showApp();
    showPage('home');
  }

  // Auto-init LIFF if available and configured
  const liffId = await db.kvGet('liffId');
  if (liffId && typeof liff !== 'undefined') {
    liffHelper.initLiff(liffId).then((r) => {
      if (r.ok && r.loggedIn && r.profile && state.mode !== 'member') {
        // optionally auto-activate
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
