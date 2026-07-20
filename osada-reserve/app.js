/* =========================================================================
 * 出店イベント 予約空き状況サイト
 *  - 「サイト公開用」シートを配信する GAS ウェブアプリ(JSON)を読み込み
 *  - 日付タブ × 時間グリッドで 〇△× を表示
 *  - 第1・第2希望を選んで LINE へ送信
 * ========================================================================= */

const CONFIG = {
  // 集計GAS（availability-aggregator-osada.gs）をウェブアプリ公開した URL を設定。
  // 空のままだとサンプル表示になります（見た目確認用）。
  apiUrl: 'https://script.google.com/macros/s/AKfycbwa2t08Dxcl44Cd6idCtwK4hkKWgor4HTspeUY8FVqQ60Wa6gNofZngQ8n74XZnubsQ/exec',

  // 公式LINE。lineOaId（@から始まるID）があるとメッセージが自動入力されます。
  lineOaId: '@881udugq',
  lineUrl: '',  // 友だち追加 / トークURL（oaId が無い場合に使用）

  clinicName: 'なつめ接骨院　静岡長田店',
  eventName: 'チャリティー施術会のご予約',
  venue: '',

  // この曜日は「はじめての方」専用（2回目以降を選べない）。0=日 … 6=土。今回は制限なし。
  newOnlyWeekdays: [],

  refreshMinutes: 10,  // この分数ごとに空き状況を自動再取得（0で無効）
};

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const state = { data: null, visitor: 'new', party: 1, companions: [], activeDate: null, choices: [null, null, null], activeChoice: 0 };
let lastFetch = 0;

/* ----------------------------- 初期化 ----------------------------- */
document.addEventListener('DOMContentLoaded', init);

async function init() {
  document.getElementById('eventName').textContent = CONFIG.eventName;
  if (CONFIG.clinicName) document.getElementById('clinicName').textContent = CONFIG.clinicName;
  if (CONFIG.venue) document.getElementById('venue').textContent = CONFIG.venue;

  bindVisitorToggle();
  bindChoices();
  bindParty();
  renderCompanions();
  document.getElementById('lineBtn').addEventListener('click', sendToLine);

  await refresh(true);
  startAutoRefresh();
  bindVisibilityRefresh();
}

async function loadData() {
  if (!CONFIG.apiUrl) return sampleData();
  const res = await fetch(CONFIG.apiUrl, { redirect: 'follow', cache: 'no-store' });
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

/** 空き状況を再取得して再描画（選択は保持。満員になった希望は外す）。 */
async function refresh(initial = false) {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    if (initial) {
      state.data = sampleData();
      toast('サンプル表示中（接続設定が未完了です）');
    }
    // 再取得の失敗時は、既存の表示をそのまま維持（黙って次回に任せる）
    if (initial) finishRender();
    return;
  }
  state.data = data;
  lastFetch = Date.now();
  // アクティブ日が無効なら、最初の有効な日へ
  const valid = data.days.filter((d) => (d.slots || []).length);
  if (!state.activeDate || !valid.some((d) => d.date === state.activeDate)) {
    state.activeDate = valid.length ? valid[0].date : null;
  }
  if (!initial) pruneChoices();
  finishRender();
}

function finishRender() {
  applyDateConstraints();
  renderTabs();
  renderGrid();
  renderChoices();
  renderChannels();
  showUpdated();
}

/** 集客経路（ご予約のきっかけ）の選択肢を「集客経路」タブから反映。
 *  リストが空（タブ未作成など）のときは項目自体を隠す。 */
function renderChannels() {
  const sel = document.getElementById('channelInput');
  if (!sel) return;
  const channels = (state.data && state.data.channels) || [];
  if (!channels.length) { sel.style.display = 'none'; return; }
  const cur = sel.value;
  sel.innerHTML = '<option value="">ご予約のきっかけを選択（必須）</option>' +
    channels.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if (cur && channels.includes(cur)) sel.value = cur;
  sel.style.display = 'block';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** 日付を切り替える（曜日制約を反映してから再描画） */
function switchDate(date) {
  state.activeDate = date;
  applyDateConstraints();
  renderTabs();
  renderGrid();
  renderChoices();
}

/** その日が「はじめての方」専用か（金曜など） */
function isNewOnly(iso) {
  if (!iso) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return (CONFIG.newOnlyWeekdays || []).includes(wd);
}

/** 専用日のとき「2回目以降の方」を選べないようにする */
function applyDateConstraints() {
  const allBtn = document.querySelector('#visitorType .seg-btn[data-type="all"]');
  const hint = document.getElementById('visitorHint');
  if (isNewOnly(state.activeDate)) {
    state.visitor = 'new';
    document.querySelectorAll('#visitorType .seg-btn')
      .forEach((x) => x.classList.toggle('is-active', x.dataset.type === 'new'));
    if (allBtn) allBtn.disabled = true;
    if (hint) hint.textContent = '※ この日は「はじめての方」専用です';
  } else {
    if (allBtn) allBtn.disabled = false;
    if (hint) hint.textContent = state.visitor === 'new'
      ? '※ 新規対応できる枠を30分単位で表示しています'
      : '※ 全体の空き状況（15分単位）を表示しています';
  }
}

/** 一定間隔で自動再取得 */
function startAutoRefresh() {
  const min = Number(CONFIG.refreshMinutes) || 0;
  if (min > 0) setInterval(() => refresh(false), min * 60 * 1000);
}

/** 画面に戻ってきた / フォーカスが当たったら再取得（直近30秒以内は省略） */
function bindVisibilityRefresh() {
  const maybe = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastFetch > 30 * 1000) {
      refresh(false);
    }
  };
  document.addEventListener('visibilitychange', maybe);
  window.addEventListener('focus', maybe);
}

/** 選択済みの希望が、最新データで満員/消滅していたら外して通知 */
function pruneChoices() {
  let removed = false;
  state.choices = state.choices.map((c) => {
    if (!c) return c;
    const day = state.data.days.find((d) => d.date === c.date);
    const slot = day && (day.slots || []).find((s) => s.time === c.time);
    if (!slot || statusOf(slot).mark === '×') { removed = true; return null; }
    return c;
  });
  if (removed) toast('選択していた枠が満員になりました。別の時間をお選びください');
}

/** 最終更新時刻を表示 */
function showUpdated() {
  const el = document.getElementById('loading');
  if (!el) return;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  el.textContent = `空き状況 最終更新 ${hh}:${mm}`;
  el.style.display = 'block';
}

/* ----------------------------- 描画 ----------------------------- */
function dateLabel(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const wd = WD[new Date(y, m - 1, d).getDay()];
  return { md: `${m}/${d}`, wd: `(${wd})` };
}

function renderTabs() {
  const nav = document.getElementById('dateTabs');
  nav.innerHTML = '';
  for (const day of state.data.days) {
    if (!(day.slots || []).length) continue;
    const { md, wd } = dateLabel(day.date);
    const btn = document.createElement('button');
    btn.className = 'tab' + (day.date === state.activeDate ? ' is-active' : '');
    btn.innerHTML = `${md}<small>${wd}</small>`;
    btn.addEventListener('click', () => switchDate(day.date));
    nav.appendChild(btn);
  }
}

function statusOf(slot) {
  const free = state.visitor === 'new' ? slot.newFree : slot.allFree;
  const base = state.visitor === 'new' ? slot.newStatus : slot.allStatus;
  // 人数ぶん空いていなければ×（お連れ様の人数に満たない時間は選べない）
  const mark = free < state.party ? '×' : base;
  return { mark, free };
}
function klass(mark) { return mark === '〇' ? 'ok' : mark === '△' ? 'few' : 'full'; }

function renderGrid() {
  const grid = document.getElementById('slotGrid');
  const note = document.getElementById('gridNote');
  grid.innerHTML = '';
  const day = state.data.days.find((d) => d.date === state.activeDate);
  if (!day) { note.textContent = ''; return; }
  const { md, wd } = dateLabel(day.date);
  const partyNote = state.party > 1 ? `（${state.party}名で入れる時間のみ）` : '';
  note.textContent = `${md}${wd} の空き状況${partyNote}（タップして希望時間を選択）`;

  for (const slot of day.slots) {
    // 「はじめての方（初診＝30分）」は30分刻みの枠だけ表示（9:00,9:30…）。
    // 「2回目以降（15分）」は15分刻みのまま全て表示。
    if (state.visitor === 'new' && Number(slot.time.split(':')[1]) % 30 !== 0) continue;
    const { mark } = statusOf(slot);
    const cls = klass(mark);
    const el = document.createElement('button');
    el.className = `slot ${cls}`;
    const selectedIdx = state.choices.findIndex(
      (c) => c && c.date === day.date && c.time === slot.time);
    if (selectedIdx >= 0) el.classList.add('selected');
    el.innerHTML = `<span class="t">${slot.time}</span><span class="s">${mark}</span>` +
      (selectedIdx >= 0 ? `<span class="badge">第${selectedIdx + 1}希望</span>` : '');
    if (cls === 'full') { el.disabled = true; }
    else el.addEventListener('click', () => onSlotTap(day.date, slot.time, mark));
    grid.appendChild(el);
  }
}

/* ----------------------------- 選択 ----------------------------- */
function onSlotTap(date, time, mark) {
  // すでに選択済みなら解除
  const existing = state.choices.findIndex((c) => c && c.date === date && c.time === time);
  if (existing >= 0) { state.choices[existing] = null; state.activeChoice = existing; afterChoiceChange(); return; }
  // アクティブな希望枠に入れる（埋まっていれば空いている枠へ）
  let idx = state.activeChoice;
  if (state.choices[idx]) {
    const empty = state.choices.findIndex((c) => !c);
    idx = empty >= 0 ? empty : state.activeChoice;
  }
  state.choices[idx] = { date, time, mark };
  const next = state.choices.findIndex((c) => !c);
  state.activeChoice = next >= 0 ? next : idx;
  afterChoiceChange();
}

function afterChoiceChange() {
  renderGrid();
  renderChoices();
}

function renderChoices() {
  state.choices.forEach((c, i) => {
    const btn = document.getElementById('choice' + i);
    const val = btn.querySelector('.choice-val');
    if (c) {
      const { md, wd } = dateLabel(c.date);
      val.textContent = `${md}${wd} ${c.time}`;
      btn.classList.add('filled');
    } else {
      val.textContent = 'タップして選択';
      btn.classList.remove('filled');
    }
    btn.classList.toggle('active', i === state.activeChoice && !c);
  });
  const ready = state.choices[0] && state.choices[1];
  document.getElementById('lineBtn').disabled = !ready;
}

function bindChoices() {
  for (let i = 0; i < 3; i++) {
    document.getElementById('choice' + i).addEventListener('click', () => {
      if (state.choices[i]) { state.choices[i] = null; }  // ✕ で解除
      state.activeChoice = i;
      afterChoiceChange();
    });
  }
}

/** ご予約人数（− / ＋ ボタン）。＋を押すたびにお連れ様の氏名欄が1つずつ増える。 */
function bindParty() {
  const minus = document.getElementById('partyMinus');
  const plus = document.getElementById('partyPlus');
  const num = document.getElementById('partyNum');
  if (!minus || !plus || !num) return;
  const set = (n) => {
    state.party = Math.max(1, n);
    num.textContent = state.party;
    renderCompanions();
    pruneChoices();
    renderGrid();
    renderChoices();
  };
  minus.addEventListener('click', () => set(state.party - 1));
  plus.addEventListener('click', () => set(state.party + 1));
}

/** お連れ様（人数-1名）のお名前入力欄を人数に合わせて表示 */
function renderCompanions() {
  const box = document.getElementById('companionFields');
  if (!box) return;
  const n = Math.max(0, state.party - 1);
  state.companions.length = n; // 人数に合わせて伸縮（既存の入力は保持）
  if (n === 0) { box.style.display = 'none'; box.innerHTML = ''; return; }
  box.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'ti companion';
    inp.placeholder = `お連れ様${i + 1} お名前（必須）`;
    inp.value = state.companions[i] || '';
    inp.addEventListener('input', () => { state.companions[i] = inp.value; });
    box.appendChild(inp);
  }
  box.style.display = 'flex';
}

function bindVisitorToggle() {
  document.querySelectorAll('#visitorType .seg-btn').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.disabled) return;  // 専用日は「2回目以降」を選べない
      document.querySelectorAll('#visitorType .seg-btn').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      state.visitor = b.dataset.type;
      applyDateConstraints();   // ヒント更新
      pruneChoices();           // 表示が変わって満員になった選択は外す
      renderGrid(); renderChoices();
    });
  });
}

/* ----------------------------- LINE 送信 ----------------------------- */
function fmtChoice(c) {
  const { md, wd } = dateLabel(c.date);
  return `${md}${wd} ${c.time}`;
}

function buildMessage() {
  const name = document.getElementById('nameInput').value.trim();
  const tel = document.getElementById('telInput').value.trim();
  const channel = document.getElementById('channelInput').value.trim();
  const visitor = state.visitor === 'new' ? 'はじめて' : '2回目以降';
  const lines = ['【予約希望】'];
  lines.push(`お名前：${name}`);
  lines.push(`電話番号：${tel}`);
  if (channel) lines.push(`ご予約のきっかけ：${channel}`);
  lines.push(`ご来院：${visitor}`);
  lines.push(state.party > 1
    ? `人数：${state.party}名（本人＋お連れ様${state.party - 1}名）`
    : '人数：1名');
  for (let i = 0; i < state.party - 1; i++) {
    lines.push(`お連れ様${i + 1}：${(state.companions[i] || '').trim()}`);
  }
  lines.push(`第1希望：${fmtChoice(state.choices[0])}`);
  lines.push(`第2希望：${fmtChoice(state.choices[1])}`);
  if (state.choices[2]) lines.push(`第3希望：${fmtChoice(state.choices[2])}`);
  return lines.join('\n');
}

async function sendToLine() {
  if (!(state.choices[0] && state.choices[1])) return;
  const name = document.getElementById('nameInput').value.trim();
  const tel = document.getElementById('telInput').value.trim();
  const channelSel = document.getElementById('channelInput');
  if (!name) { toast('お名前を入力してください'); document.getElementById('nameInput').focus(); return; }
  if (!tel) { toast('電話番号を入力してください'); document.getElementById('telInput').focus(); return; }
  // お連れ様がいる場合は全員のお名前を必須に
  for (let i = 0; i < state.party - 1; i++) {
    if (!(state.companions[i] || '').trim()) {
      toast(`お連れ様${i + 1}のお名前を入力してください`);
      const inp = document.querySelectorAll('#companionFields .companion')[i];
      if (inp) inp.focus();
      return;
    }
  }
  // 集客経路が表示されている（選択肢がある）ときは必須
  if (channelSel.style.display !== 'none' && !channelSel.value) {
    toast('ご予約のきっかけを選択してください'); channelSel.focus(); return;
  }
  const msg = buildMessage();

  // oaId があれば LINE のトークにメッセージを自動入力して開く
  if (CONFIG.lineOaId) {
    const url = `https://line.me/R/oaMessage/${encodeURIComponent(CONFIG.lineOaId)}/?${encodeURIComponent(msg)}`;
    window.location.href = url;
    return;
  }
  // 無ければ：本文をコピーして公式LINEを開く
  try { await navigator.clipboard.writeText(msg); } catch (e) { /* 失敗時もLINEは開く */ }
  toast('予約内容をコピーしました。LINEのトークに貼り付けて送信してください');
  setTimeout(() => { window.open(CONFIG.lineUrl, '_blank'); }, 900);
}

/* ----------------------------- ユーティリティ ----------------------------- */
let toastTimer = null;
function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ----------------------------- サンプルデータ ----------------------------- */
function sampleData() {
  const mk = (time, n) => ({
    time, newStatus: n >= 8 ? '〇' : n >= 1 ? (n <= 2 ? '△' : '〇') : '×', newFree: n,
    allStatus: n >= 8 ? '〇' : n >= 1 ? (n <= 2 ? '△' : '〇') : '×', allFree: n,
  });
  const gen = (hours, step) => {
    const out = [];
    for (const [o, c] of hours) {
      for (let t = o; t + 30 <= c; t += step) {
        const hh = String(Math.floor(t / 60)).padStart(2, '0');
        const mm = String(t % 60).padStart(2, '0');
        out.push(mk(`${hh}:${mm}`, Math.floor(Math.random() * 11)));
      }
    }
    return out;
  };
  return {
    channels: ['新聞折込', 'チラシ', 'のぼり', '家族の紹介', '友人の紹介', '職場の紹介',
      'Instagram広告', 'Facebook広告', 'ホームページを見た', 'Googleを見た',
      'みずほ接骨院からの紹介', 'その他'],
    days: [
      { date: '2026-08-28', stepMin: 15, slots: gen([[540, 720], [840, 1080]], 15) },
      { date: '2026-08-29', stepMin: 15, slots: gen([[540, 720], [840, 1080]], 15) },
      { date: '2026-08-30', stepMin: 15, slots: gen([[540, 1020]], 15) },
    ],
  };
}
