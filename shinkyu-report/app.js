/* 鍼施術内容書 — 入力・保存・A4 1枚の印刷
 *
 * 保存の考え方（同時操作で上書きしない）
 *   - 内容書は 1件ずつ別のキー（shinq:rec:<id>）に保存する。一覧をまとめた1つのデータを
 *     書き換える方式ではないので、別の人が別の内容書を同時に保存しても互いに消えない。
 *   - 各内容書は rev（版番号）を持つ。開いた後に別の画面で同じ内容書が保存されていたら、
 *     自動保存を止めて知らせる（相手の内容を上書きしない）。
 *   - Xサーバー等に api.php を置いた場合は sync.js がこれらのキーをサーバーと同期し、
 *     4人の端末で同じデータを共有する（サーバー側でも内容書は rev が進んだ時だけ受け付ける）。
 *   - 担当者の選択はタブごと（sessionStorage）なので、1台を交代で使っても混ざらない。
 *   - 患者様（shinq:pat:<氏名>）とログ（shinq:log:<時刻+乱数>）も1件ずつ別キー。
 *     ログは追記のみで、作成・PDF出力・削除のたびに残る（PDF出力・削除はその時点の内容も保存）。
 */
(function () {
  'use strict';

  const { REGIONS, BY_ID, SETS, VIEWS, figure, label, regionAt, esc } = window.Body;

  const KEY_REC = 'shinq:rec:';
  const KEY_SETTINGS = 'shinq:settings';
  const KEY_ME = 'shinq:me';
  const KEY_PAT = 'shinq:pat:';
  const KEY_LOG = 'shinq:log:';

  const LOG_ACTIONS = { create: '新規作成', copy: 'コピーして作成', pdf: 'PDF出力', share: 'LINE等で共有', del: '削除' };

  const METHODS = ['置鍼', '単刺', 'パルス（低周波）', '灸', '円皮鍼'];
  const PHRASE_CATS = [
    ['complaint', '主訴'],
    ['reaction', '好転反応'],
    ['change', '術後の変化'],
    ['guidance', '通院指導'],
    ['request', '貴院へのお願い・申し送り'],
  ];

  const DEFAULT_SETTINGS = {
    staff: ['スタッフA', 'スタッフB', 'スタッフC', 'スタッフD'],
    clinics: [],
    name: 'ミツカル接骨院',
    tel: '054-262-6040',
    fax: '054-262-6090',
    phrases: {
      complaint: ['肩こり', '腰痛', '首の痛み', '背部痛', '頭痛', '膝の痛み', '坐骨神経痛', '眼精疲労', '自律神経の乱れ'],
      reaction: ['だるさ', '眠気', '筋肉痛のような痛み', '一時的な痛みの増強', '内出血の可能性', '特になし'],
      change: ['痛みが軽減', '可動域が改善', '筋緊張が緩和', '身体が軽くなったとの声', '大きな変化なし'],
      guidance: ['週1回の通院を推奨', '2週間に1回の通院を推奨', '当日の激しい運動・飲酒は控える', '水分を多めに摂る', '入浴で温める', 'ストレッチの継続'],
      request: ['引き続き手技でのフォローをお願いします', '温熱・電気でのケアをお願いします', '施術部位への強い刺激は避けてください', '次回来院時の状態をお聞かせください'],
    },
  };

  // ---------- 保存 ----------
  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, val) {
      localStorage.setItem(key, JSON.stringify(val));
      window.Sync.changed(key);
    },
    del(key) {
      localStorage.removeItem(key);
      window.Sync.changed(key);
    },
    all(prefix) {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const v = store.get(k);
          if (v) out.push(v);
        }
      }
      return out;
    },
    records() {
      return store.all(KEY_REC).filter((r) => r.id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
    },
    patients() {
      return store.all(KEY_PAT).filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    },
    logs() {
      return store.all(KEY_LOG).filter((l) => l.id).sort((a, b) => b.at - a.at);
    },
  };

  // 氏名の空白（全角・半角）を除いたものを患者様のキーにする（「山田 花子」と「山田花子」を同一人物に）
  const patKey = (name) => String(name || '').replace(/[\s\u3000]+/g, '');

  // 患者様を登録・更新。自動保存のたびではなく、氏名欄の入力確定時・内容書を閉じる時・出力時に呼ぶ
  // （入力途中の「山」「山田」などが登録されないように）
  function upsertPatient(r) {
    if (conflict) return;
    const key = patKey(r.patient);
    if (!key) return;
    const cur = store.get(KEY_PAT + key);
    const name = r.patient.trim();
    if (cur && cur.name === name && (cur.clinic === r.clinic || !r.clinic)) return;
    store.set(KEY_PAT + key, {
      key, memo: '', createdAt: Date.now(), ...(cur || {}),
      name, clinic: r.clinic || cur?.clinic || '', updatedAt: Date.now(),
    });
  }

  // ログは1件ずつ別キーに追記する（既存のログを書き換えない）
  function addLog(action, r, withSnapshot, extra = {}) {
    const at = Date.now();
    const id = at.toString(36) + Math.random().toString(36).slice(2, 8);
    const entry = {
      id, at, action, staff: getMe(),
      recId: r.id, patient: r.patient || '', clinic: r.clinic || '', date: r.date || '',
    };
    Object.assign(entry, extra);
    if (withSnapshot) entry.snapshot = JSON.parse(JSON.stringify(r));
    try { store.set(KEY_LOG + id, entry); } catch { /* 容量不足でも本来の操作は止めない */ }
  }

  const loadSettings = () => {
    const s = store.get(KEY_SETTINGS) || {};
    return { ...DEFAULT_SETTINGS, ...s, phrases: { ...DEFAULT_SETTINGS.phrases, ...(s.phrases || {}) } };
  };
  let settings = loadSettings();

  const getMe = () => {
    try { return sessionStorage.getItem(KEY_ME) || localStorage.getItem(KEY_ME) || ''; } catch { return ''; }
  };
  const setMe = (v) => {
    try { sessionStorage.setItem(KEY_ME, v); localStorage.setItem(KEY_ME, v); } catch { /* 保存できなくても動作は続ける */ }
  };

  // ---------- ユーティリティ ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = (n) => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`; };
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const wd = WD[new Date(y, m - 1, d).getDay()];
    return `${y}/${m}/${d}（${wd}）`;
  };
  const nl2br = (t) => esc(t || '').replace(/\n/g, '<br>');
  const lines = (t) => String(t || '').split('\n').map((s) => s.trim()).filter(Boolean);

  const blankRecord = (init = {}) => {
    const me = getMe();
    return {
      id: newId(), rev: 0, createdAt: Date.now(), updatedAt: Date.now(),
      staff: me, staffName: me,
      clinic: '', patient: '', date: today(), time: nowTime(),
      complaint: '', regions: {}, regionOrder: [], pins: [], links: [], diagram: 'body',
      ...init,
      reactions: [], reaction: '', next: '', nextTime: '',
      change: '', guidance: '', request: '',
    };
  };

  // ---------- 状態 ----------
  let rec = null;        // 編集中の内容書
  let loadedRev = 0;     // 開いた（最後に保存した）時点の rev
  let conflict = false;
  let mode = 'region';
  let saveTimer = null;

  // ---------- 画面切替 ----------
  function show(view) {
    $$('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
    $$('.topbar-nav [data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    window.scrollTo(0, 0);
  }

  // 画面遷移は同期で行う（hashchange を待つ間の入力が前の内容書に保存されないように）
  let routed = null;
  function go(hash) {
    flushSave();
    if (rec) upsertPatient(rec);
    rec = null;
    location.hash = hash;
    route();
  }

  function route() {
    flushSave();
    if (rec) upsertPatient(rec);
    const h = location.hash;
    if (h === routed && rec) return;
    routed = h;
    const m = h.match(/^#\/edit\/(.+)$/);
    if (m) {
      const r = store.get(KEY_REC + m[1]);
      if (r) { openRecord(r); return; }
    }
    if (h === '#/settings') { renderSettings(); show('settings'); return; }
    const pm = h.match(/^#\/patient\/(.+)$/);
    if (pm) {
      rec = null;
      if (renderPatient(decodeURIComponent(pm[1]))) { show('patient'); return; }
    }
    if (h === '#/patients') { rec = null; renderPatients(); show('patients'); return; }
    if (h === '#/log') { rec = null; renderLog(); show('log'); return; }
    rec = null;
    renderList();
    show('list');
  }

  // ---------- 担当者 ----------
  function renderStaffSelect() {
    const sel = $('#staffSelect');
    const me = getMe();
    const names = settings.staff.slice();
    if (me && !names.includes(me)) names.push(me);
    sel.innerHTML = '<option value="">（選択）</option>' + names.map((n) => `<option${n === me ? ' selected' : ''}>${esc(n)}</option>`).join('');
  }

  // ---------- 一覧 ----------
  function renderList() {
    const q = $('#listSearch').value.trim();
    const mine = $('#listMine').checked;
    const me = getMe();
    const rows = store.records().filter((r) =>
      (!mine || !me || r.staff === me) &&
      (!q || (r.patient || '').includes(q) || (r.clinic || '').includes(q)));
    if (!rows.length) {
      $('#listBody').innerHTML = `<p class="empty">内容書はまだありません。「＋ 新規作成」から作成してください。</p>`;
      return;
    }
    $('#listBody').innerHTML = rows.map((r) => recordCard(r)).join('');
  }

  // 一覧・患者様ページ共通のカード操作
  function cardAction(e, after) {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const card = e.target.closest('.card[data-id]');
    if (!act || !card) return;
    const r = store.get(KEY_REC + card.dataset.id);
    if (!r) { after(); return; }
    if (act === 'open') go(`#/edit/${r.id}`);
    if (act === 'copy') {
      const me = getMe();
      const c = {
        ...JSON.parse(JSON.stringify(r)),
        id: newId(), rev: 1, createdAt: Date.now(), updatedAt: Date.now(),
        staff: me || r.staff, staffName: me || r.staffName,
        date: today(), time: nowTime(), next: '', nextTime: '',
        reactions: [], reaction: '', change: '',
      };
      store.set(KEY_REC + c.id, c);
      addLog('copy', c);
      go(`#/edit/${c.id}`);
    }
    if (act === 'print') printRecord(r);
    if (act === 'del') {
      if (confirm(`${r.patient || '（氏名未入力）'} 様（${fmtDate(r.date)}）の内容書を削除しますか？\n（削除前の内容はログに残ります）`)) {
        addLog('del', r, true);
        store.del(KEY_REC + r.id);
        after();
      }
    }
  }

  const recordCard = (r, showPatient = true) => `
      <div class="card" data-id="${r.id}">
        <div class="card-main" data-act="open">
          <div class="card-date">${esc(fmtDate(r.date))} ${esc(r.time || '')}</div>
          ${showPatient ? `<div class="card-name">${esc(r.patient || '（氏名未入力）')} <small>様</small></div>` : ''}
          <div class="card-meta">${esc(r.clinic ? r.clinic + '接骨院' : '宛先未入力')} ／ 担当：${esc(r.staffName || r.staff || '-')} ／ 施術部位 ${r.regionOrder.length}か所${r.pins.length ? `・鍼 ${r.pins.length}` : ''}${(r.links || []).length ? `・電気 ${r.links.length}` : ''}</div>
          ${showPatient ? '' : recordDigest(r)}
        </div>
        <div class="card-acts">
          <button type="button" class="btn small" data-act="open">開く</button>
          <button type="button" class="btn small" data-act="copy" title="同じ患者様の次回分を、今回の内容をもとに作成">コピーして新規</button>
          <button type="button" class="btn small" data-act="print">PDF</button>
          <button type="button" class="btn small danger" data-act="del">削除</button>
        </div>
      </div>`;

  // 患者様ページで経過を見返すための要約
  const recordDigest = (r) => {
    const rows = [
      ['主訴', r.complaint],
      ['部位', r.regionOrder.map((id) => label(BY_ID[id])).join('、')],
      ['好転反応', [r.reactions.join('、'), r.reaction].filter(Boolean).join(' ')],
      ['術後', r.change],
      ['次回', r.next ? fmtDate(r.next) + (r.nextTime ? ' ' + r.nextTime : '') : ''],
    ].filter(([, v]) => v);
    return rows.length ? `<dl class="digest">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : '';
  };

  $('#listBody').addEventListener('click', (e) => cardAction(e, renderList));
  $('#listSearch').addEventListener('input', renderList);
  $('#listMine').addEventListener('change', renderList);

  // ---------- 編集 ----------
  const FIELDS = ['clinic', 'patient', 'date', 'time', 'complaint', 'reaction', 'next', 'nextTime', 'change', 'guidance', 'request', 'staffName'];
  const fieldEl = (k) => $(`#f-${k === 'staffName' ? 'staff' : k}`);

  // 以前の内容書（鍼に id が無い・電気が無い）を今の形にそろえる
  function normalizePins(r) {
    r.pins = (r.pins || []).map((p) => (p.id ? p : { ...p, id: newId() }));
    r.links = (r.links || []).filter((l) => r.pins.some((p) => p.id === l.a) && r.pins.some((p) => p.id === l.b));
    return r;
  }

  function openRecord(r) {
    rec = normalizePins(r);
    undoStack = [];
    linkSel = null;
    updateUndo();
    loadedRev = r.rev || 0;
    setConflict(false);
    FIELDS.forEach((k) => { fieldEl(k).value = r[k] || ''; });
    renderReactions();
    renderBody();
    $('#saveState').textContent = r.rev ? `保存済み` : '';
    show('edit');
  }

  function newRecord(init) {
    if (!getMe()) {
      alert('先に画面上の「担当者」を選んでください。');
      $('#staffSelect').focus();
      return;
    }
    const r = blankRecord(init);
    r.rev = 1;
    store.set(KEY_REC + r.id, r);
    addLog('create', r);
    go(`#/edit/${r.id}`);
  }
  $('#btnNew').addEventListener('click', () => newRecord());

  // 登録済みの患者様を選んだら、宛先の接骨院が空なら前回の接骨院を入れる
  $('#f-patient').addEventListener('change', () => {
    const p = store.get(KEY_PAT + patKey($('#f-patient').value));
    if (p && p.clinic && !$('#f-clinic').value) {
      $('#f-clinic').value = p.clinic;
      scheduleSave();
    }
    collect();
    upsertPatient(rec);
    renderPatientList();
  });
  $('#f-clinic').addEventListener('change', () => { collect(); upsertPatient(rec); });

  function collect() {
    FIELDS.forEach((k) => { rec[k] = fieldEl(k).value; });
  }

  function scheduleSave() {
    if (!rec) return;
    $('#saveState').textContent = '入力中…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 500);
  }
  function flushSave() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; save(); }
  }

  function save() {
    saveTimer = null;
    if (!rec || conflict) return;
    collect();
    const cur = store.get(KEY_REC + rec.id);
    if (cur && (cur.rev || 0) > loadedRev) { setConflict(true); return; }
    rec.rev = loadedRev + 1;
    rec.updatedAt = Date.now();
    try {
      store.set(KEY_REC + rec.id, rec);
    } catch (err) {
      $('#saveState').textContent = '保存できませんでした（端末の空き容量を確認してください）';
      return;
    }
    loadedRev = rec.rev;
    const d = new Date();
    $('#saveState').textContent = `保存しました ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function setConflict(on) {
    conflict = on;
    $('#conflictBanner').hidden = !on;
    if (on) $('#saveState').textContent = '自動保存を停止中';
  }
  $('#btnReload').addEventListener('click', () => {
    const r = store.get(KEY_REC + rec.id);
    if (r) openRecord(r);
  });
  $('#btnSaveAsNew').addEventListener('click', () => {
    collect();
    const c = { ...JSON.parse(JSON.stringify(rec)), id: newId(), rev: 1, createdAt: Date.now(), updatedAt: Date.now() };
    store.set(KEY_REC + c.id, c);
    addLog('create', c);
    go(`#/edit/${c.id}`);
  });

  $('#form').addEventListener('input', scheduleSave);
  $('#form').addEventListener('change', scheduleSave);

  // 別のタブ・画面での変更を検知
  // 別のタブ（storage イベント）や別の端末（サーバー同期）での変更を画面に反映
  let refreshTimer = null;
  function refreshLater() {
    // 同期で一度に何件も届いても、描き直しは1回にまとめる
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      renderPatientList();
      if (!$('#view-list').hidden) renderList();
      else if (!$('#view-patients').hidden) renderPatients();
      else if (!$('#view-log').hidden) renderLog();
      else if (!$('#view-patient').hidden && curPatKey) renderPatient(curPatKey);
    }, 80);
  }
  function onExternalChange(key) {
    if (!key) { refreshLater(); return; }
    if (key === KEY_SETTINGS) { settings = loadSettings(); applySettings(); return; }
    if (rec && key === KEY_REC + rec.id) {
      const r = store.get(key);
      if (!r) { alert('この内容書は別の画面で削除されました。'); go('#/list'); return; }
      if ((r.rev || 0) > loadedRev) setConflict(true);
      return;
    }
    if (key.startsWith(KEY_REC) || key.startsWith(KEY_PAT) || key.startsWith(KEY_LOG)) refreshLater();
  }
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('shinq-sync:')) return;
    onExternalChange(e.key);
  });
  window.Sync.on('change', onExternalChange);
  // サーバーが受け付けなかった（別の端末が先に同じ内容書を保存していた）
  window.Sync.on('conflict', (key) => { if (rec && key === KEY_REC + rec.id) setConflict(true); });

  // ---------- 定型文ボタン ----------
  function renderPhraseChips() {
    $$('.chips[data-phrases]').forEach((box) => {
      const list = settings.phrases[box.dataset.phrases] || [];
      box.innerHTML = list.map((p) => `<button type="button" class="chip" data-phrase="${esc(p)}">${esc(p)}</button>`).join('');
    });
  }
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chips[data-target] .chip');
    if (!chip) return;
    const ta = $('#' + chip.parentElement.dataset.target);
    const p = chip.dataset.phrase;
    const v = ta.value.trimEnd();
    ta.value = v ? (v.endsWith('。') || v.endsWith('\n') ? `${v}${p}` : `${v}、${p}`) : p;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ---------- 好転反応 ----------
  function renderReactions() {
    const list = settings.phrases.reaction || [];
    const all = list.concat((rec?.reactions || []).filter((x) => !list.includes(x)));
    $('#reactionChips').innerHTML = all.map((p) =>
      `<button type="button" class="chip${rec?.reactions.includes(p) ? ' on' : ''}" data-r="${esc(p)}">${esc(p)}</button>`).join('');
  }
  $('#reactionChips').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (!c || !rec) return;
    const v = c.dataset.r;
    const i = rec.reactions.indexOf(v);
    if (i >= 0) rec.reactions.splice(i, 1);
    else {
      // 「特になし」と他は同時に選ばない
      if (v === '特になし') rec.reactions = [];
      else rec.reactions = rec.reactions.filter((x) => x !== '特になし');
      rec.reactions.push(v);
    }
    renderReactions();
    scheduleSave();
  });

  // ---------- 人体図 ----------
  const numbers = () => Object.fromEntries(rec.regionOrder.map((id, i) => [id, i + 1]));

  // 身体／頭部のどちらの人体図に印があるか
  const setOfView = (view) => (SETS.head.views.includes(view) ? 'head' : 'body');
  const usedSets = (r) => Object.keys(SETS).filter((k) =>
    r.regionOrder.some((id) => BY_ID[id]?.set === k) || r.pins.some((p) => setOfView(p.view) === k));
  const diagramOf = (r) => r.diagram || (usedSets(r).length === 1 ? usedSets(r)[0] : 'body');

  function renderBody() {
    const st = { selected: numbers(), pins: rec.pins, links: rec.links, linkSel };
    const d = diagramOf(rec);
    $('#bodyFigs').innerHTML = SETS[d].views.map((v) => figure(v, st)).join('');
    $('#bodyFigs').className = `body-figs figs-${d} mode-${mode}`;
    // 切り替えボタン：選択中の種類と、それぞれの印の数
    $$('.diagram-toggle [data-diagram]').forEach((b) => {
      const k = b.dataset.diagram;
      const n = rec.regionOrder.filter((id) => BY_ID[id]?.set === k).length + rec.pins.filter((p) => setOfView(p.view) === k).length;
      b.classList.toggle('active', k === d);
      b.innerHTML = `${SETS[k].name}${n ? ` <span class="cnt">${n}</span>` : ''}`;
    });
    renderRegionChecks();
    renderSummary();
  }

  $$('.diagram-toggle [data-diagram]').forEach((b) => b.addEventListener('click', () => {
    if (!rec) return;
    rec.diagram = b.dataset.diagram;
    renderBody();
    scheduleSave();
  }));

  function renderRegionChecks() {
    const nums = numbers();
    const d = diagramOf(rec);
    const views = SETS[d].views;
    // 身体は部位のグループごと、頭部は図ごとに並べる
    const sections = SETS[d].byView
      ? views.map((v) => [VIEWS[v].cap, (r) => r.view === v])
      : SETS[d].groups.map((g) => [g, (r) => r.group === g]);
    const GROUP_ORDER = SETS[d].groups;
    $('#regionChecks').innerHTML = sections.map(([title, match]) => {
      // 図の順、グループ順、上→下（定義順）、右→左の順に並べる
      const regs = REGIONS.filter((r) => r.set === d && match(r))
        .sort((a, b) => views.indexOf(a.view) - views.indexOf(b.view) ||
          (SETS[d].byView ? GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) : 0) ||
          a.base - b.base || (a.side === '右' ? -1 : 1));
      return `<div class="rc-group"><div class="rc-title">${title}</div><div class="rc-items">${regs.map((r) =>
        `<button type="button" class="rc${nums[r.id] ? ' on' : ''}" data-id="${r.id}">${nums[r.id] ? `<b>${nums[r.id]}</b>` : '<i></i>'}${esc(label(r))}</button>`
      ).join('')}</div></div>`;
    }).join('');
  }

  const detailText = (d) => {
    if (!d) return '';
    const parts = [];
    if (d.methods?.length) parts.push(d.methods.join('・'));
    if (d.count) parts.push(`${d.count}本`);
    if (d.minutes) parts.push(`${d.minutes}分`);
    if (d.note) parts.push(d.note);
    return parts.join('／');
  };

  // 部位ごとの鍼の本数と電気の組数（電気はどちらかの端がその部位にあれば数える）
  function needleStats(r) {
    const map = new Map();
    const get = (region) => {
      if (!map.has(region)) map.set(region, { region, needles: 0, links: 0 });
      return map.get(region);
    };
    r.pins.forEach((p) => { if (p.region) get(p.region).needles++; });
    const pinById = Object.fromEntries(r.pins.map((p) => [p.id, p]));
    (r.links || []).forEach((l) => {
      const regs = new Set([pinById[l.a]?.region, pinById[l.b]?.region].filter(Boolean));
      regs.forEach((reg) => get(reg).links++);
    });
    // 人体図の部位の順に並べる
    return [...map.values()].sort((a, b) => REGIONS.indexOf(BY_ID[a.region]) - REGIONS.indexOf(BY_ID[b.region]));
  }
  const needleText = (n) => `鍼 ${n.needles}本${n.links ? `・電気 ${n.links}組` : ''}`;

  function renderSummary() {
    const regs = rec.regionOrder.map((id, i) =>
      `<li data-id="${id}"><b class="num">${i + 1}</b>${esc(label(BY_ID[id]))}<span>${esc(detailText(rec.regions[id]))}</span></li>`);
    // 鍼・電気は部位ごとにまとめて表示
    const pins = needleStats(rec).filter((n) => !rec.regions[n.region]).map((n) =>
      `<li class="nd"><i class="mk-needle"></i>${esc(label(BY_ID[n.region]))}<span>${esc(needleText(n))}</span></li>`);
    const total = rec.pins.length ? `<p class="hint">鍼 ${rec.pins.length}本${rec.links.length ? `・電気 ${rec.links.length}組` : ''}</p>` : '';
    $('#selectedSummary').innerHTML = regs.length || pins.length
      ? `<ul>${regs.join('')}${pins.join('')}</ul>${total}`
      : '<p class="hint">まだ施術部位が選ばれていません。</p>';
  }

  const MODE_HINT = {
    region: '人体図の部位をタップすると選択され、詳細を入力できます。',
    needle: '刺した位置をタップすると鍼（赤）が付きます。付いた鍼をもう一度タップすると消えます。',
    electric: '鍼を2つ順にタップすると電気（青い線）でつながります。線をタップすると消えます。',
  };

  // 鍼・電気の「1つ戻す」
  let undoStack = [];
  let linkSel = null; // 電気でつなぐ途中の鍼
  const updateUndo = () => { $('#btnUndo').disabled = !undoStack.length; };
  function pushUndo() {
    undoStack.push(JSON.stringify({ pins: rec.pins, links: rec.links }));
    if (undoStack.length > 50) undoStack.shift();
    updateUndo();
  }
  $('#btnUndo').addEventListener('click', () => {
    if (!rec || !undoStack.length) return;
    const prev = JSON.parse(undoStack.pop());
    rec.pins = prev.pins;
    rec.links = prev.links;
    linkSel = null;
    updateUndo();
    renderBody();
    scheduleSave();
  });

  $$('.mode-toggle [data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    $$('.mode-toggle [data-mode]').forEach((x) => x.classList.toggle('active', x === b));
    linkSel = null;
    $('#modeHint').textContent = MODE_HINT[mode];
    if (rec) renderBody();
  }));

  $('#bodyFigs').addEventListener('click', (e) => {
    if (!rec) return;
    const pinEl = e.target.closest('.pin');
    const linkEl = e.target.closest('.link');
    const svg = e.target.closest('svg');
    if (!svg) return;
    if (mode === 'needle') {
      if (pinEl) {
        // 付いている鍼をタップ → 消す（つながっていた電気も消す）
        pushUndo();
        const id = pinEl.dataset.pin;
        rec.pins = rec.pins.filter((p) => p.id !== id);
        rec.links = rec.links.filter((l) => l.a !== id && l.b !== id);
      } else {
        const pt = svg.createSVGPoint();
        pt.x = e.clientX; pt.y = e.clientY;
        const p = pt.matrixTransform(svg.getScreenCTM().inverse());
        const view = svg.dataset.view;
        const r = regionAt(view, p.x, p.y);
        if (!r) return; // 体の外は無視
        pushUndo();
        rec.pins.push({ id: newId(), view, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, region: r.id });
      }
      renderBody();
      scheduleSave();
      return;
    }
    if (mode === 'electric') {
      if (linkEl) {
        pushUndo();
        rec.links.splice(Number(linkEl.dataset.link), 1);
        linkSel = null;
      } else if (pinEl) {
        const id = pinEl.dataset.pin;
        const a = rec.pins.find((p) => p.id === linkSel);
        const b = rec.pins.find((p) => p.id === id);
        if (!a || id === linkSel || a.view !== b.view) {
          linkSel = id === linkSel ? null : id; // 1本目を選ぶ（もう一度押すと取り消し）
        } else {
          if (!rec.links.some((l) => (l.a === a.id && l.b === id) || (l.b === a.id && l.a === id))) {
            pushUndo();
            rec.links.push({ a: a.id, b: id });
            scheduleSave();
          }
          linkSel = null;
        }
      } else {
        linkSel = null;
      }
      renderBody();
      return;
    }
    const rg = e.target.closest('.rg');
    if (rg) openRegion(rg.dataset.id);
  });
  $('#regionChecks').addEventListener('click', (e) => {
    const b = e.target.closest('.rc');
    if (b) openRegion(b.dataset.id);
  });
  $('#selectedSummary').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    if (li.dataset.id) openRegion(li.dataset.id);
  });

  // 部位ダイアログ
  let dlgRegion = null;
  $('#rd-methods').innerHTML = METHODS.map((m) => `<button type="button" class="chip" data-m="${m}">${m}</button>`).join('');
  $('#rd-methods').addEventListener('click', (e) => {
    const c = e.target.closest('.chip');
    if (c) c.classList.toggle('on');
  });

  function openRegion(id) {
    if (!rec.regions[id]) {
      rec.regions[id] = { methods: [], count: '', minutes: '', note: '' };
      rec.regionOrder.push(id);
      renderBody();
      scheduleSave();
    }
    dlgRegion = id;
    const d = rec.regions[id];
    const n = rec.regionOrder.indexOf(id) + 1;
    $('#rd-title').textContent = `${n}．${label(BY_ID[id])}`;
    $$('#rd-methods .chip').forEach((c) => c.classList.toggle('on', d.methods.includes(c.dataset.m)));
    $('#rd-count').value = d.count;
    $('#rd-minutes').value = d.minutes;
    $('#rd-note').value = d.note;
    $('#regionDialog').showModal();
  }
  $('#regionDialog').addEventListener('close', () => {
    if (!dlgRegion || !rec.regions[dlgRegion]) return;
    rec.regions[dlgRegion] = {
      methods: $$('#rd-methods .chip.on').map((c) => c.dataset.m),
      count: $('#rd-count').value,
      minutes: $('#rd-minutes').value,
      note: $('#rd-note').value.trim(),
    };
    dlgRegion = null;
    renderBody();
    scheduleSave();
  });
  $('#rd-remove').addEventListener('click', () => {
    const id = dlgRegion;
    dlgRegion = null;
    delete rec.regions[id];
    rec.regionOrder = rec.regionOrder.filter((x) => x !== id);
    $('#regionDialog').close();
    renderBody();
    scheduleSave();
  });


  // ---------- A4 シート ----------
  function sheetHtml(r) {
    const nums = Object.fromEntries(r.regionOrder.map((id, i) => [id, i + 1]));
    normalizePins(r);
    const st = { selected: nums, pins: r.pins, links: r.links };
    // 印のある人体図（身体・頭部）を載せる。両方に印があれば両方
    const sets = usedSets(r).length ? usedSets(r) : [diagramOf(r)];
    // 施術内容は表にする（番号・部位・施術方法・本数・時間・ツボを列で揃えて読みやすく）
    const shortMethod = (m) => m.replace('（低周波）', '');
    // 鍼（赤）・電気（青）は部位ごとに本数・組数を表に入れる。部位を選んでいる行にはまとめて書く
    const stats = Object.fromEntries(needleStats(r).map((n) => [n.region, n]));
    const methodsWith = (methods, n) => {
      const m = (methods || []).map(shortMethod);
      if (n && n.needles && !m.some((x) => /鍼/.test(x))) m.unshift('鍼');
      if (n && n.links && !m.includes('パルス')) m.push('電気');
      return m.join('・');
    };
    const regionRows = r.regionOrder.map((id, i) => {
      const d = r.regions[id] || {};
      const n = stats[id];
      const count = d.count || (n && n.needles) || '';
      return `<tr><td class="c-no"><b class="num">${i + 1}</b></td><td class="c-part">${esc(label(BY_ID[id]))}</td>` +
        `<td>${esc(methodsWith(d.methods, n))}</td><td class="c-n">${count ? esc(count) + '本' : ''}</td>` +
        `<td class="c-n">${d.minutes ? esc(d.minutes) + '分' : ''}</td><td>${esc(d.note || '')}</td></tr>`;
    });
    const needleRows = needleStats(r).filter((n) => !r.regions[n.region]).map((n) =>
      `<tr class="pin-row"><td class="c-no"><i class="mk-needle"></i></td><td class="c-part">${esc(label(BY_ID[n.region]))}</td>` +
      `<td>${esc(methodsWith([], n))}</td><td class="c-n">${n.needles}本</td><td class="c-n"></td><td>${n.links ? `電気 ${n.links}組` : ''}</td></tr>`);
    const rows = regionRows.concat(needleRows);
    const reaction = [r.reactions.join('、'), r.reaction].filter(Boolean).join('\n');
    const next = r.next ? `${fmtDate(r.next)}${r.nextTime ? ' ' + r.nextTime : ''}` : '';
    return `
      <div class="sh-title">鍼施術内容書</div>
      <div class="sh-to"><span class="ul w-clinic">${esc(r.clinic)}</span>接骨院御中</div>
      <div class="sh-row">
        <div class="sh-patient"><span class="lbl">患者様氏名</span><span class="ul grow">${esc(r.patient)}</span><span>様</span></div>
        <div class="sh-visit"><span class="lbl">来院日時</span><span class="ul">${esc(fmtDate(r.date))}　${esc(r.time || '')}</span></div>
      </div>
      <div class="sh-mid${sets.length > 1 ? ' both' : ''}">
        <div class="sh-figs">
          <div class="lbl">施術部位${r.pins.length ? `<span class="legend"><i class="mk-needle"></i>鍼${r.links.length ? '<i class="mk-electric"></i>電気' : ''}</span>` : ''}</div>
          <div class="figs">${sets.map((k) => `<div class="figset figset-${k}">${SETS[k].views.map((v) => figure(v, st, { cls: 'print' })).join('')}</div>`).join('')}</div>
        </div>
        <div class="sh-side">
          <div class="sh-box sh-complaint"><div class="lbl">主訴</div><div class="txt">${nl2br(r.complaint)}</div></div>
          <div class="sh-box sh-reaction"><div class="lbl">好転反応</div><div class="txt">${nl2br(reaction)}</div></div>
          <div class="sh-box sh-next"><div class="lbl">次回予約日</div><div class="txt big">${esc(next)}</div></div>
        </div>
      </div>
      <div class="sh-box sh-regions"><div class="lbl">施術内容</div>
        <table class="rtable">
          <thead><tr><th class="c-no">No</th><th class="c-part">部位</th><th class="c-m">施術方法</th><th class="c-n">本数</th><th class="c-n">時間</th><th>メモ</th></tr></thead>
          <tbody>${rows.length ? rows.join('') : '<tr><td class="c-no"></td><td class="c-part"></td><td></td><td></td><td></td><td></td></tr>'}</tbody>
        </table>
      </div>
      <div class="sh-box"><div class="lbl">術後の変化</div><div class="txt">${nl2br(r.change)}</div></div>
      <div class="sh-box"><div class="lbl">通院指導</div><div class="txt">${nl2br(r.guidance)}</div></div>
      <div class="sh-box"><div class="lbl">貴院へのお願い・申し送り</div><div class="txt">${nl2br(r.request)}</div></div>
      <div class="sh-foot">
        <div class="sh-staff"><span class="lbl">担当者名</span><span class="ul">${esc(r.staffName)}</span></div>
        <div class="sh-org">
          <div class="org-name">${esc(settings.name)}</div>
          <div>TEL : ${esc(settings.tel)}</div>
          <div>FAX : ${esc(settings.fax)}</div>
        </div>
      </div>`;
  }

  // 文字と人体図を少しずつ小さくして A4 1枚に収める。収まったら true
  function fitSheet(sheet) {
    for (let s = 1; s >= 0.62; s -= 0.02) {
      sheet.style.setProperty('--s', s.toFixed(2));
      if (sheet.scrollHeight <= sheet.clientHeight + 1) return true;
    }
    return false;
  }

  function buildSheet(r) {
    const sheet = $('#sheet');
    sheet.innerHTML = sheetHtml(r);
    return fitSheet(sheet);
  }

  // PDF出力のたびに、その時点の内容をログに残す（後から同じ内容を見返せる）
  // フォントの読み込みを待ってから文字サイズを合わせる（読み込み前に測ると1枚に収まらないことがある）
  async function buildSheetReady(r) {
    buildSheet(r);
    await window.Fonts.ready();
    return fitSheet($('#sheet'));
  }

  async function printRecord(r, { log = true } = {}) {
    if (log) addLog('pdf', r, true);
    await buildSheetReady(r);
    const title = document.title;
    document.title = `鍼施術内容書_${r.patient || '氏名未入力'}_${(r.date || '').replace(/-/g, '')}`;
    window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
    window.print();
  }

  $('#btnPrint').addEventListener('click', () => { flushSave(); collect(); upsertPatient(rec); printRecord(rec); });
  let previewRec = null;
  let previewNote = '';
  async function showPreview(r, note = '') {
    previewRec = r;
    previewNote = note;
    const fits = await buildSheetReady(r);
    const host = $('#previewHost');
    host.innerHTML = '';
    if (note) host.insertAdjacentHTML('beforeend', `<p class="banner">${esc(note)}</p>`);
    if (!fits) host.insertAdjacentHTML('beforeend', '<p class="banner warn">文章が多く、A4 1枚に収まりきりません。文章を短くしてください。</p>');
    const clone = $('#sheet').cloneNode(true);
    clone.removeAttribute('id');
    host.appendChild(clone);
    $('#previewDialog').showModal();
  }
  $('#btnPreview').addEventListener('click', () => {
    flushSave();
    collect();
    upsertPatient(rec);
    showPreview(rec);
  });
  // ---------- LINE などで送る ----------
  // スマホの共有画面（LINE・メール・AirDrop など）に内容書の PDF を渡す。送り先は LINE の画面で選ぶ。
  // 共有画面はボタンを押した直後にしか開けないため、①PDF を作る ②「送信先を選ぶ」を押す の2段階にする。
  const loadScript = (src) => new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('PDF を作る部品（lib フォルダ）を読み込めませんでした'));
    document.head.appendChild(s);
  });

  // 内容書（A4 1枚）を PDF にする。見た目は印刷と同じ（画像として PDF に貼る）
  // 部品（html2canvas 1.4.1 / jsPDF 2.5.1、どちらも MIT ライセンス）は lib/ に同梱
  async function sheetPdfBlob(r) {
    await loadScript('lib/html2canvas.min.js');
    await loadScript('lib/jspdf.umd.min.js');
    await buildSheetReady(r);
    const canvas = await window.html2canvas($('#sheet'), { scale: 2.5, backgroundColor: '#ffffff', logging: false });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
    return pdf.output('blob');
  }

  const pdfName = (r) => `鍼施術内容書_${r.patient || '氏名未入力'}_${(r.date || '').replace(/-/g, '')}.pdf`;
  let shareFile = null;
  let shareRec = null;

  async function openShare(r) {
    shareRec = r;
    shareFile = null;
    $('#sh-go').disabled = true;
    $('#sh-error').textContent = '';
    $('#sh-status').textContent = '内容書の PDF を作っています…';
    $('#shareDialog').showModal();
    try {
      const blob = await sheetPdfBlob(r);
      shareFile = new File([blob], pdfName(r), { type: 'application/pdf' });
      const canShare = navigator.canShare && navigator.canShare({ files: [shareFile] });
      if (canShare) {
        $('#sh-status').textContent = `準備ができました：${shareFile.name}`;
        $('#sh-go').disabled = false;
      } else {
        // パソコンなど共有画面が使えない端末：PDF を保存して、LINE のアプリで送ってもらう
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = shareFile.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        $('#sh-status').textContent = 'この端末では共有画面が使えないため、PDF を保存しました。スマホで操作するか、保存した PDF を LINE のアプリで送ってください。';
        addLog('share', r, true, { via: 'download' });
      }
    } catch (e) {
      $('#sh-error').textContent = e.message;
    }
  }

  $('#sh-go').addEventListener('click', async () => {
    if (!shareFile) return;
    try {
      await navigator.share({ files: [shareFile], title: shareFile.name });
      addLog('share', shareRec, true);
      $('#shareDialog').close();
    } catch (e) {
      // 共有画面で「キャンセル」した時は何もしない
      if (e.name !== 'AbortError') $('#sh-error').textContent = `共有できませんでした（${e.message}）`;
    }
  });
  $('#sh-cancel').addEventListener('click', () => $('#shareDialog').close());
  $('#btnShare').addEventListener('click', () => { flushSave(); collect(); upsertPatient(rec); openShare(rec); });

  $('#pv-close').addEventListener('click', () => $('#previewDialog').close());
  $('#pv-print').addEventListener('click', () => {
    $('#previewDialog').close();
    // ログから開いた過去の内容を再出力した場合もログに残す
    printRecord(previewRec);
  });

  // ---------- 患者様 ----------
  function renderPatientList() {
    $('#patientList').innerHTML = store.patients().map((p) => `<option value="${esc(p.name)}">${esc(p.clinic ? p.clinic + '接骨院' : '')}</option>`).join('');
  }

  function renderPatients() {
    const q = patKey($('#patSearch').value);
    const recs = store.records();
    const rows = store.patients().filter((p) => !q || p.key.includes(q) || (p.clinic || '').includes(q)).map((p) => {
      const mine = recs.filter((r) => patKey(r.patient) === p.key);
      const next = mine.map((r) => r.next).filter(Boolean).sort().pop() || '';
      return { p, count: mine.length, last: mine[0]?.date || '', next };
    });
    if (!rows.length) {
      $('#patBody').innerHTML = '<p class="empty">登録された患者様はまだいません。内容書に患者様氏名を入力すると自動で登録されます。</p>';
      return;
    }
    $('#patBody').innerHTML = rows.map(({ p, count, last, next }) => `
      <a class="card link" href="#/patient/${encodeURIComponent(p.key)}">
        <div class="card-main">
          <div class="card-name">${esc(p.name)} <small>様</small></div>
          <div class="card-meta">${esc(p.clinic ? p.clinic + '接骨院' : '宛先未登録')} ／ 内容書 ${count}件${last ? ` ／ 最終来院 ${esc(fmtDate(last))}` : ''}${next ? ` ／ 次回 ${esc(fmtDate(next))}` : ''}</div>
          ${p.memo ? `<div class="card-memo">${esc(p.memo)}</div>` : ''}
        </div>
        <span class="chev">›</span>
      </a>`).join('');
  }
  $('#patSearch').addEventListener('input', renderPatients);

  let curPatKey = null;
  function renderPatient(key) {
    const p = store.get(KEY_PAT + key);
    if (!p) return false;
    curPatKey = key;
    $('#pt-name').textContent = p.name;
    $('#pt-clinic').value = p.clinic || '';
    $('#pt-memo').value = p.memo || '';
    const recs = store.records().filter((r) => patKey(r.patient) === key);
    $('#pt-count').textContent = `内容書 ${recs.length}件`;
    $('#pt-records').innerHTML = recs.length
      ? recs.map((r) => recordCard(r, false)).join('')
      : '<p class="empty">この患者様の内容書はありません。</p>';
    const all = store.logs();
    const logs = all.filter((l) => patKey(logPatient(l, all)) === key);
    $('#pt-logs').innerHTML = logs.length ? logTable(logs) : '<p class="hint">ログはまだありません。</p>';
    return true;
  }
  $('#pt-records').addEventListener('click', (e) => cardAction(e, () => renderPatient(curPatKey)));
  $('#pt-logs').addEventListener('click', logAction);
  $('#pt-new').addEventListener('click', () => {
    const p = store.get(KEY_PAT + curPatKey);
    if (p) newRecord({ patient: p.name, clinic: p.clinic || '' });
  });
  $('#pt-save').addEventListener('click', () => {
    const p = store.get(KEY_PAT + curPatKey);
    if (!p) return;
    store.set(KEY_PAT + curPatKey, {
      ...p, clinic: $('#pt-clinic').value.trim().replace(/接骨院(御中)?$/, ''), memo: $('#pt-memo').value.trim(), updatedAt: Date.now(),
    });
    renderPatientList();
    alert('保存しました。');
  });
  $('#pt-del').addEventListener('click', () => {
    const p = store.get(KEY_PAT + curPatKey);
    if (!p) return;
    if (!confirm(`${p.name} 様を患者様一覧から外しますか？\n（内容書とログは消えません）`)) return;
    store.del(KEY_PAT + curPatKey);
    renderPatientList();
    go('#/patients');
  });

  // ---------- ログ ----------
  const fmtAt = (t) => {
    const d = new Date(t);
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // ログに残る患者様氏名。作成時は氏名が空なので、今の内容書か同じ内容書の他のログ（PDF出力・削除）から引く
  function logPatient(l, all) {
    const r = store.get(KEY_REC + l.recId);
    if (r?.patient) return r.patient;
    if (l.patient) return l.patient;
    const other = all.find((x) => x.recId === l.recId && x.patient);
    return other ? other.patient : '';
  }

  function logTable(logs) {
    const all = store.logs();
    return `<div class="log-list">${logs.map((l) => {
      const r = store.get(KEY_REC + l.recId);
      const patient = logPatient(l, all) || '（氏名未入力）';
      return `<div class="log-row" data-log="${l.id}">
        <span class="log-at">${esc(fmtAt(l.at))}</span>
        <span class="log-act act-${l.action}">${esc(LOG_ACTIONS[l.action] || l.action)}</span>
        <span class="log-who">${esc(l.staff || '-')}</span>
        <span class="log-what">${esc(patient)} 様${l.date ? `（${esc(fmtDate(l.date))}来院分）` : ''}</span>
        <span class="log-btns">
          ${l.snapshot ? '<button type="button" class="btn small" data-lact="view">その時の内容</button>' : ''}
          ${r ? '<button type="button" class="btn small" data-lact="open">開く</button>' : '<span class="log-gone">内容書は削除済み</span>'}
        </span>
      </div>`;
    }).join('')}</div>`;
  }

  function logAction(e) {
    const act = e.target.closest('[data-lact]')?.dataset.lact;
    const row = e.target.closest('.log-row');
    if (!act || !row) return;
    const l = store.get(KEY_LOG + row.dataset.log);
    if (!l) return;
    if (act === 'open') go(`#/edit/${l.recId}`);
    if (act === 'view' && l.snapshot) {
      showPreview(l.snapshot, `${fmtAt(l.at)} に${LOG_ACTIONS[l.action] || ''}した時点の内容です（担当：${l.staff || '-'}）`);
    }
  }

  function renderLog() {
    const q = $('#logSearch').value.trim();
    const act = $('#logAction').value;
    const who = $('#logStaff').value;
    const staffs = [...new Set(settings.staff.concat(store.logs().map((l) => l.staff).filter(Boolean)))];
    $('#logStaff').innerHTML = '<option value="">全員</option>' + staffs.map((s) => `<option${s === who ? ' selected' : ''}>${esc(s)}</option>`).join('');
    const all = store.logs();
    const logs = all.filter((l) =>
      (!act || l.action === act) && (!who || l.staff === who) &&
      (!q || patKey(logPatient(l, all)).includes(patKey(q))));
    $('#logBody').innerHTML = logs.length ? logTable(logs.slice(0, 500)) : '<p class="empty">ログはまだありません。</p>';
  }
  ['#logSearch', '#logAction', '#logStaff'].forEach((s) => $(s).addEventListener('input', renderLog));
  $('#logBody').addEventListener('click', logAction);

  // ---------- 設定 ----------
  function renderSettings() {
    $('#s-staff').value = settings.staff.join('\n');
    $('#s-clinics').value = settings.clinics.join('\n');
    $('#s-name').value = settings.name;
    $('#s-tel').value = settings.tel;
    $('#s-fax').value = settings.fax;
    $('#phraseEdit').innerHTML = PHRASE_CATS.map(([k, n]) =>
      `<label class="field">${n}<textarea rows="3" data-cat="${k}">${esc((settings.phrases[k] || []).join('\n'))}</textarea></label>`).join('');
  }
  $('#btnSaveSettings').addEventListener('click', () => {
    const phrases = {};
    $$('#phraseEdit textarea').forEach((t) => { phrases[t.dataset.cat] = lines(t.value); });
    settings = {
      staff: lines($('#s-staff').value),
      clinics: lines($('#s-clinics').value).map((c) => c.replace(/接骨院(御中)?$/, '')),
      name: $('#s-name').value.trim(),
      tel: $('#s-tel').value.trim(),
      fax: $('#s-fax').value.trim(),
      phrases,
    };
    store.set(KEY_SETTINGS, settings);
    applySettings();
    alert('設定を保存しました。');
  });

  function applySettings() {
    renderStaffSelect();
    renderPhraseChips();
    $('#clinicList').innerHTML = settings.clinics.map((c) => `<option value="${esc(c)}">`).join('');
  }

  // バックアップ
  $('#btnExport').addEventListener('click', () => {
    const data = {
      version: 2, exportedAt: new Date().toISOString(), settings,
      records: store.records(), patients: store.patients(), logs: store.logs(),
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `鍼施術内容書_バックアップ_${today().replace(/-/g, '')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#importFile').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const recs = Array.isArray(data.records) ? data.records.filter((r) => r && r.id) : [];
      let added = 0;
      let skipped = 0;
      recs.forEach((r) => {
        const cur = store.get(KEY_REC + r.id);
        // 端末にある方が新しければ残す（上書きしない）
        if (cur && (cur.rev || 0) >= (r.rev || 0)) { skipped++; return; }
        store.set(KEY_REC + r.id, r);
        added++;
      });
      // 患者様は端末に無いもの・新しいものだけ、ログは無いものだけ追加（どちらも上書きで消さない）
      let pats = 0;
      let logs = 0;
      (Array.isArray(data.patients) ? data.patients : []).forEach((p) => {
        if (!p || !p.name) return;
        const key = patKey(p.name);
        const cur = store.get(KEY_PAT + key);
        if (cur && (cur.updatedAt || 0) >= (p.updatedAt || 0)) return;
        store.set(KEY_PAT + key, { ...p, key });
        pats++;
      });
      (Array.isArray(data.logs) ? data.logs : []).forEach((l) => {
        if (!l || !l.id || store.get(KEY_LOG + l.id)) return;
        store.set(KEY_LOG + l.id, l);
        logs++;
      });
      // 古いバックアップ（患者様一覧が無い）からも患者様を登録する
      recs.forEach((r) => { if (r.patient && !store.get(KEY_PAT + patKey(r.patient))) { upsertPatient(r); pats++; } });
      alert(`読み込みました：内容書 ${added}件・患者様 ${pats}件・ログ ${logs}件（同じか新しい内容が既にある内容書 ${skipped}件はそのまま）`);
      renderPatientList();
      renderList();
    } catch {
      alert('ファイルを読み込めませんでした。');
    }
  });

  // ---------- 上部メニュー ----------
  $$('.topbar-nav [data-view]').forEach((b) => b.addEventListener('click', () => {
    go(`#/${b.dataset.view}`);
  }));
  $('#staffSelect').addEventListener('change', (e) => {
    setMe(e.target.value);
    if (!$('#view-list').hidden) renderList();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

  // ---------- 同期の状態表示 ----------
  window.Sync.on('status', ({ mode: m, online, pending }) => {
    const el = $('#syncState');
    el.hidden = m !== 'server';
    el.className = `sync-state ${!online ? 'off' : pending ? 'wait' : 'ok'}`;
    el.textContent = !online ? `オフライン${pending ? `（未送信 ${pending}件）` : ''}` : pending ? `送信中 ${pending}件` : '同期済み';
    el.title = !online ? 'サーバーにつながっていません。入力は端末に保存され、つながると自動で送信されます。' : '';
    $('#serverBox').hidden = m !== 'server';
    $('#localBox').hidden = m === 'server';
  });
  $('#syncState').addEventListener('click', () => window.Sync.syncNow());
  $('#btnLogout').addEventListener('click', () => { flushSave(); window.Sync.logout(); });

  // サーバーからの取り込みが済んでから画面を出す
  window.Sync.ready.then(() => {
    settings = loadSettings();
    // 患者様一覧ができる前に作った内容書の氏名も登録しておく
    store.records().forEach((r) => { if (r.patient && !store.get(KEY_PAT + patKey(r.patient))) upsertPatient(r); });
    applySettings();
    renderPatientList();
    route();
    document.body.classList.remove('loading');
  });
})();
