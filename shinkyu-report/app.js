/* 鍼施術内容書 — 入力・保存・A4 1枚の印刷
 *
 * 保存の考え方（同時操作で上書きしない）
 *   - 内容書は 1件ずつ別のキー（shinq:rec:<id>）に保存する。一覧をまとめた1つのデータを
 *     書き換える方式ではないので、別の人が別の内容書を同時に保存しても互いに消えない。
 *   - 各内容書は rev（版番号）を持つ。開いた後に別の画面で同じ内容書が保存されていたら、
 *     自動保存を止めて知らせる（相手の内容を上書きしない）。
 *   - 担当者の選択はタブごと（sessionStorage）なので、1台を交代で使っても混ざらない。
 */
(function () {
  'use strict';

  const { REGIONS, BY_ID, GROUPS, figure, label, pinLabel, regionAt, esc } = window.Body;

  const KEY_REC = 'shinq:rec:';
  const KEY_SETTINGS = 'shinq:settings';
  const KEY_ME = 'shinq:me';

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
    },
    del(key) { localStorage.removeItem(key); },
    records() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEY_REC)) {
          const r = store.get(k);
          if (r && r.id) out.push(r);
        }
      }
      return out.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.updatedAt - a.updatedAt);
    },
  };

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

  const blankRecord = () => {
    const me = getMe();
    return {
      id: newId(), rev: 0, createdAt: Date.now(), updatedAt: Date.now(),
      staff: me, staffName: me,
      clinic: '', patient: '', date: today(), time: nowTime(),
      complaint: '', regions: {}, regionOrder: [], pins: [],
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
    rec = null;
    location.hash = hash;
    route();
  }

  function route() {
    flushSave();
    const h = location.hash;
    if (h === routed && rec) return;
    routed = h;
    const m = h.match(/^#\/edit\/(.+)$/);
    if (m) {
      const r = store.get(KEY_REC + m[1]);
      if (r) { openRecord(r); return; }
    }
    if (h === '#/settings') { renderSettings(); show('settings'); return; }
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
    $('#listBody').innerHTML = rows.map((r) => `
      <div class="card" data-id="${r.id}">
        <div class="card-main" data-act="open">
          <div class="card-date">${esc(fmtDate(r.date))} ${esc(r.time || '')}</div>
          <div class="card-name">${esc(r.patient || '（氏名未入力）')} <small>様</small></div>
          <div class="card-meta">${esc(r.clinic ? r.clinic + '接骨院' : '宛先未入力')} ／ 担当：${esc(r.staffName || r.staff || '-')} ／ 施術部位 ${r.regionOrder.length}か所${r.pins.length ? `・点 ${r.pins.length}` : ''}</div>
        </div>
        <div class="card-acts">
          <button type="button" class="btn small" data-act="open">開く</button>
          <button type="button" class="btn small" data-act="copy" title="同じ患者様の次回分を、今回の内容をもとに作成">コピーして新規</button>
          <button type="button" class="btn small" data-act="print">PDF</button>
          <button type="button" class="btn small danger" data-act="del">削除</button>
        </div>
      </div>`).join('');
  }

  $('#listBody').addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const card = e.target.closest('.card');
    if (!act || !card) return;
    const r = store.get(KEY_REC + card.dataset.id);
    if (!r) { renderList(); return; }
    if (act === 'open') go(`#/edit/${r.id}`);
    if (act === 'copy') {
      const me = getMe();
      const c = {
        ...JSON.parse(JSON.stringify(r)),
        id: newId(), rev: 0, createdAt: Date.now(), updatedAt: Date.now(),
        staff: me || r.staff, staffName: me || r.staffName,
        date: today(), time: nowTime(), next: '', nextTime: '',
        reactions: [], reaction: '', change: '',
      };
      store.set(KEY_REC + c.id, { ...c, rev: 1 });
      go(`#/edit/${c.id}`);
    }
    if (act === 'print') printRecord(r);
    if (act === 'del') {
      if (confirm(`${r.patient || '（氏名未入力）'} 様（${fmtDate(r.date)}）の内容書を削除しますか？`)) {
        store.del(KEY_REC + r.id);
        renderList();
      }
    }
  });
  $('#listSearch').addEventListener('input', renderList);
  $('#listMine').addEventListener('change', renderList);

  // ---------- 編集 ----------
  const FIELDS = ['clinic', 'patient', 'date', 'time', 'complaint', 'reaction', 'next', 'nextTime', 'change', 'guidance', 'request', 'staffName'];
  const fieldEl = (k) => $(`#f-${k === 'staffName' ? 'staff' : k}`);

  function openRecord(r) {
    rec = r;
    loadedRev = r.rev || 0;
    setConflict(false);
    FIELDS.forEach((k) => { fieldEl(k).value = r[k] || ''; });
    renderReactions();
    renderBody();
    $('#saveState').textContent = r.rev ? `保存済み` : '';
    show('edit');
  }

  function newRecord() {
    if (!getMe()) {
      alert('先に画面上の「担当者」を選んでください。');
      $('#staffSelect').focus();
      return;
    }
    const r = blankRecord();
    r.rev = 1;
    store.set(KEY_REC + r.id, r);
    go(`#/edit/${r.id}`);
  }
  $('#btnNew').addEventListener('click', newRecord);

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
    go(`#/edit/${c.id}`);
  });

  $('#form').addEventListener('input', scheduleSave);
  $('#form').addEventListener('change', scheduleSave);

  // 別のタブ・画面での変更を検知
  window.addEventListener('storage', (e) => {
    if (e.key === KEY_SETTINGS) { settings = loadSettings(); renderStaffSelect(); return; }
    if (!e.key || !e.key.startsWith(KEY_REC)) return;
    if (rec && e.key === KEY_REC + rec.id) {
      const r = store.get(e.key);
      if (!r) { alert('この内容書は別の画面で削除されました。'); go('#/list'); return; }
      if ((r.rev || 0) > loadedRev) setConflict(true);
    } else if (!$('#view-list').hidden) {
      renderList();
    }
  });

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

  function renderBody() {
    const st = { selected: numbers(), pins: rec.pins };
    $('#bodyFigs').innerHTML = figure('f', st) + figure('b', st);
    $('#bodyFigs').classList.toggle('pin-mode', mode === 'pin');
    renderRegionChecks();
    renderSummary();
  }

  function renderRegionChecks() {
    const nums = numbers();
    $('#regionChecks').innerHTML = GROUPS.map((g) => {
      // 前面→背面、上→下（定義順）、右→左の順に並べる
      const regs = REGIONS.filter((r) => r.group === g)
        .sort((a, b) => (a.view === b.view ? 0 : a.view === 'f' ? -1 : 1) || a.base - b.base || (a.side === '右' ? -1 : 1));
      return `<div class="rc-group"><div class="rc-title">${g}</div><div class="rc-items">${regs.map((r) =>
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

  function renderSummary() {
    const regs = rec.regionOrder.map((id, i) =>
      `<li data-id="${id}"><b class="num">${i + 1}</b>${esc(label(BY_ID[id]))}<span>${esc(detailText(rec.regions[id]))}</span></li>`);
    const pins = rec.pins.map((p, i) =>
      `<li data-pin="${i}"><b class="pinl">${pinLabel(i)}</b>${esc(p.region ? label(BY_ID[p.region]) : (p.view === 'f' ? '前面' : '背面'))}<span>${esc(p.note || '')}</span></li>`);
    $('#selectedSummary').innerHTML = regs.length || pins.length
      ? `<ul>${regs.join('')}${pins.join('')}</ul>`
      : '<p class="hint">まだ施術部位が選ばれていません。</p>';
  }

  $$('.mode-toggle [data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    $$('.mode-toggle [data-mode]').forEach((x) => x.classList.toggle('active', x === b));
    $('#modeHint').textContent = mode === 'pin'
      ? '刺した位置をタップすると点（A, B, C…）が打てます。点をタップすると名前の入力・削除ができます。'
      : '人体図の部位をタップすると選択され、詳細を入力できます。';
    $('#bodyFigs').classList.toggle('pin-mode', mode === 'pin');
  }));

  $('#bodyFigs').addEventListener('click', (e) => {
    if (!rec) return;
    const pinEl = e.target.closest('.pin');
    if (pinEl) { openPinDialog(Number(pinEl.dataset.pin)); return; }
    const svg = e.target.closest('svg');
    if (!svg) return;
    if (mode === 'pin') {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      const view = svg.dataset.view;
      const r = regionAt(view, p.x, p.y);
      if (!r) return; // 体の外は無視
      rec.pins.push({ view, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, region: r.id, note: '' });
      renderBody();
      scheduleSave();
      openPinDialog(rec.pins.length - 1);
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
    else openPinDialog(Number(li.dataset.pin));
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

  // 点ダイアログ
  let dlgPin = null;
  function openPinDialog(i) {
    const p = rec.pins[i];
    if (!p) return;
    dlgPin = i;
    $('#pd-title').textContent = `点 ${pinLabel(i)}（${p.region ? label(BY_ID[p.region]) : ''}）`;
    $('#pd-note').value = p.note || '';
    $('#pinDialog').showModal();
  }
  $('#pinDialog').addEventListener('close', () => {
    if (dlgPin == null || !rec.pins[dlgPin]) return;
    rec.pins[dlgPin].note = $('#pd-note').value.trim();
    dlgPin = null;
    renderBody();
    scheduleSave();
  });
  $('#pd-remove').addEventListener('click', () => {
    const i = dlgPin;
    dlgPin = null;
    rec.pins.splice(i, 1);
    $('#pinDialog').close();
    renderBody();
    scheduleSave();
  });

  // ---------- A4 シート ----------
  function sheetHtml(r) {
    const nums = Object.fromEntries(r.regionOrder.map((id, i) => [id, i + 1]));
    const st = { selected: nums, pins: r.pins };
    const regionItems = r.regionOrder.map((id, i) =>
      `<li><b class="num">${i + 1}</b><span class="nm">${esc(label(BY_ID[id]))}</span>${detailText(r.regions[id]) ? `<span class="dt">${esc(detailText(r.regions[id]))}</span>` : ''}</li>`);
    const pinItems = r.pins.map((p, i) =>
      `<li><b class="pinl">${pinLabel(i)}</b><span class="nm">${esc(p.region ? label(BY_ID[p.region]) : '')}</span>${p.note ? `<span class="dt">${esc(p.note)}</span>` : ''}</li>`);
    const reaction = [r.reactions.join('、'), r.reaction].filter(Boolean).join('\n');
    const next = r.next ? `${fmtDate(r.next)}${r.nextTime ? ' ' + r.nextTime : ''}` : '';
    return `
      <div class="sh-title">鍼施術内容書</div>
      <div class="sh-to"><span class="ul w-clinic">${esc(r.clinic)}</span>接骨院御中</div>
      <div class="sh-row">
        <div class="sh-patient"><span class="lbl">患者様氏名</span><span class="ul grow">${esc(r.patient)}</span><span>様</span></div>
        <div class="sh-visit"><span class="lbl">来院日時</span><span class="ul">${esc(fmtDate(r.date))}　${esc(r.time || '')}</span></div>
      </div>
      <div class="sh-box sh-complaint"><div class="lbl">主訴</div><div class="txt">${nl2br(r.complaint)}</div></div>
      <div class="sh-mid">
        <div class="sh-figs">
          <div class="lbl">施術部位</div>
          <div class="figs">${figure('f', st, { cls: 'print' })}${figure('b', st, { cls: 'print' })}</div>
        </div>
        <div class="sh-side">
          <div class="sh-box sh-regions"><div class="lbl">施術内容</div>
            ${regionItems.length || pinItems.length ? `<ul class="rlist">${regionItems.join('')}${pinItems.join('')}</ul>` : ''}
          </div>
          <div class="sh-box sh-reaction"><div class="lbl">好転反応</div><div class="txt">${nl2br(reaction)}</div></div>
          <div class="sh-box sh-next"><div class="lbl">次回予約日</div><div class="txt big">${esc(next)}</div></div>
        </div>
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

  function printRecord(r) {
    buildSheet(r);
    const title = document.title;
    document.title = `鍼施術内容書_${r.patient || '氏名未入力'}_${(r.date || '').replace(/-/g, '')}`;
    window.addEventListener('afterprint', () => { document.title = title; }, { once: true });
    window.print();
  }

  $('#btnPrint').addEventListener('click', () => { flushSave(); collect(); printRecord(rec); });
  $('#btnPreview').addEventListener('click', () => {
    flushSave();
    collect();
    const fits = buildSheet(rec);
    const host = $('#previewHost');
    host.innerHTML = '';
    if (!fits) host.insertAdjacentHTML('beforeend', '<p class="banner warn">文章が多く、A4 1枚に収まりきりません。文章を短くしてください。</p>');
    const clone = $('#sheet').cloneNode(true);
    clone.removeAttribute('id');
    host.appendChild(clone);
    $('#previewDialog').showModal();
  });
  $('#pv-close').addEventListener('click', () => $('#previewDialog').close());
  $('#pv-print').addEventListener('click', () => { $('#previewDialog').close(); printRecord(rec); });

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
    const data = { version: 1, exportedAt: new Date().toISOString(), settings, records: store.records() };
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
      alert(`読み込みました：${added}件（同じか新しい内容が既にあるため ${skipped}件はそのまま）`);
      renderList();
    } catch {
      alert('ファイルを読み込めませんでした。');
    }
  });

  // ---------- 上部メニュー ----------
  $$('.topbar-nav [data-view]').forEach((b) => b.addEventListener('click', () => {
    go(b.dataset.view === 'settings' ? '#/settings' : '#/list');
  }));
  $('#staffSelect').addEventListener('change', (e) => {
    setMe(e.target.value);
    if (!$('#view-list').hidden) renderList();
  });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

  applySettings();
  route();
})();
