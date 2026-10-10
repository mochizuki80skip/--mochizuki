/* カルテ枚数計算
 * レセコンの顧客リストを読み込み、カルテ番号の数字部分が同じもの（125・125a・125-2 など）を
 * 1枚にまとめて正確なカルテ枚数を出す。ファイルはブラウザ内だけで処理する。
 */
(function () {
  'use strict';

  // ---------- 計算（画面に依存しない部分） ----------

  // CSV / TSV を2次元配列に（ダブルクォート・改行入りの項目に対応）
  function parseCsv(text) {
    text = text.replace(/^﻿/, '');
    const firstLine = text.slice(0, text.indexOf('\n') >>> 0);
    const delim = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [];
    let cell = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; } else q = false;
        } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  // カルテ番号を「まとめる番号」に。全角→半角にして最初の数字のかたまりを使う
  function karteKey(raw, ignoreZero) {
    const s = String(raw == null ? '' : raw).normalize('NFKC').trim();
    const m = s.match(/\d+/);
    if (!m) return null;
    let digits = m[0];
    if (ignoreZero) digits = digits.replace(/^0+(?=\d)/, '');
    return { key: digits, prefix: s.slice(0, m.index).trim(), suffix: s.slice(m.index + m[0].length).trim(), text: s };
  }

  const ERAS = { R: 2018, '令和': 2018, H: 1988, '平成': 1988, S: 1925, '昭和': 1925 };

  // 日付を YYYY-MM-DD に（西暦・和暦・Excel の日付に対応）。読めなければ null
  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return fmt(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      // Excel のシリアル値
      const d = new Date(Math.round((v - 25569) * 86400000));
      return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const s = String(v).normalize('NFKC').trim();
    let m = s.match(/^(令和|平成|昭和|[RHS])\s*(\d{1,2}|元)\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/i);
    if (m) {
      const y = ERAS[m[1].toUpperCase()] ?? ERAS[m[1]];
      return fmt(y + (m[2] === '元' ? 1 : Number(m[2])), Number(m[3]), Number(m[4]));
    }
    m = s.match(/^(\d{4})\s*[年./-]\s*(\d{1,2})\s*[月./-]\s*(\d{1,2})/);
    if (m) return fmt(Number(m[1]), Number(m[2]), Number(m[3]));
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return fmt(Number(m[1]), Number(m[2]), Number(m[3]));
    return null;
  }
  function fmt(y, mo, d) {
    if (!(y > 1900 && y < 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  /**
   * 集計
   * @param rows データ行（見出しを除く）
   * @param cols {no, name, date} 列番号（name/date は -1 で無し）
   */
  function analyze(rows, cols, ignoreZero) {
    const groups = new Map(); // key → {key, items:[{no, name, date, row}], names:Set, minDate, dates:Set}
    const bad = [];
    const prefixed = [];
    rows.forEach((r, i) => {
      const k = karteKey(r[cols.no], ignoreZero);
      const name = cols.name >= 0 ? String(r[cols.name] ?? '').trim() : '';
      const date = cols.date >= 0 ? parseDate(r[cols.date]) : null;
      if (!k) { bad.push({ row: i, no: String(r[cols.no] ?? ''), name }); return; }
      if (k.prefix) prefixed.push({ row: i, no: k.text, key: k.key, name });
      let g = groups.get(k.key);
      if (!g) { g = { key: k.key, items: [], names: new Set(), minDate: null, months: new Set() }; groups.set(k.key, g); }
      g.items.push({ no: k.text, name, date });
      if (name) g.names.add(name.replace(/[\s　]+/g, ''));
      if (date) {
        if (!g.minDate || date < g.minDate) g.minDate = date;
        g.months.add(date.slice(0, 7));
      }
    });

    const list = [...groups.values()].sort((a, b) => Number(a.key) - Number(b.key) || a.key.localeCompare(b.key));
    const merged = list.filter((g) => g.items.length > 1);

    // 同じ氏名で別の番号（同一人物の可能性。自動ではまとめない）
    const byName = new Map();
    list.forEach((g) => g.names.forEach((n) => {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n).push(g);
    }));
    const sameName = [...byName.entries()].filter(([, gs]) => gs.length > 1)
      .map(([name, gs]) => ({ name, groups: gs }))
      .sort((a, b) => Number(a.groups[0].key) - Number(b.groups[0].key));

    // 月別
    const months = new Map();
    list.forEach((g) => {
      g.months.forEach((m) => { months.set(m, (months.get(m) || { total: 0, fresh: 0 })); months.get(m).total++; });
      if (g.minDate) {
        const m = g.minDate.slice(0, 7);
        if (!months.has(m)) months.set(m, { total: 0, fresh: 0 });
        months.get(m).fresh++;
      }
    });
    const monthly = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }));

    return { rows: rows.length, list, merged, bad, prefixed, sameName, monthly, datedRows: list.some((g) => g.minDate) };
  }

  function periodCount(list, from, to) {
    let total = 0;
    let fresh = 0;
    list.forEach((g) => {
      let hit = false;
      g.months.forEach((m) => { if ((!from || m >= from) && (!to || m <= to)) hit = true; });
      if (hit) total++;
      if (g.minDate) {
        const m = g.minDate.slice(0, 7);
        if ((!from || m >= from) && (!to || m <= to)) fresh++;
      }
    });
    return { total, fresh };
  }

  const KC = { parseCsv, karteKey, parseDate, analyze, periodCount };
  if (typeof module !== 'undefined') { module.exports = KC; return; }

  // ---------- 画面 ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (n) => Number(n).toLocaleString('ja-JP');

  let table = [];    // 読み込んだ全行（見出し含む）
  let result = null;
  let tab = 'merged';
  let fileName = '';

  async function readFile(file) {
    fileName = file.name.replace(/\.[^.]+$/, '');
    $('#dropText').textContent = `読み込み中… ${file.name}`;
    try {
      if (/\.xlsx?$/i.test(file.name)) {
        await loadXlsx();
        const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        table = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' })
          .filter((r) => r.some((c) => String(c).trim() !== ''));
      } else {
        table = parseCsv(decode(await file.arrayBuffer()));
      }
    } catch (e) {
      $('#dropText').textContent = `読み込めませんでした（${e.message}）。CSV か Excel ファイルを選んでください。`;
      return;
    }
    if (!table.length) { $('#dropText').textContent = 'データがありませんでした。'; return; }
    $('#drop').classList.add('done');
    $('#dropText').textContent = `${file.name} を読み込みました。別のファイルを選ぶ場合はここをタップ`;
    setupColumns();
  }

  // レセコンの CSV は Shift_JIS が多い。UTF-8 として読めなければ Shift_JIS で読む
  function decode(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { /* Shift_JIS へ */ }
    return new TextDecoder('shift_jis').decode(buf);
  }

  function loadXlsx() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Excel 読み込み用の部品を取得できませんでした。CSV で書き出してください'));
      document.head.appendChild(s);
    });
  }

  const width = () => Math.max(...table.slice(0, 50).map((r) => r.length));
  const header = () => ($('#optHeader').checked ? table[0] : null);

  function guessColumns() {
    const h = (table[0] || []).map((c) => String(c).normalize('NFKC'));
    const find = (re) => h.findIndex((c) => re.test(c));
    let no = find(/カルテ|患者(番号|No|ID|コード)|診察券|受付番号|^(No|ID|番号|コード)\.?$/i);
    if (no < 0) {
      // 見出しで分からなければ、数字で始まる値が一番多い列
      let best = -1;
      let bestScore = 0;
      for (let c = 0; c < width(); c++) {
        const score = table.slice(1, 200).filter((r) => /^\s*[0-9０-９]+[A-Za-zＡ-Ｚａ-ｚ\-ー]?\s*$/.test(String(r[c] ?? ''))).length;
        if (score > bestScore) { best = c; bestScore = score; }
      }
      no = best < 0 ? 0 : best;
    }
    const name = find(/氏名|患者名|名前|^名$|カナ|フリガナ/);
    const date = find(/初検|初診|最終来院|来院日|受診日|登録日|日付/);
    const looksHeader = h.some((c) => /[^\d\s./-]/.test(c)) && !/^\s*\d/.test(String(table[0]?.[no] ?? ''));
    return { no, name, date, looksHeader };
  }

  function setupColumns() {
    const g = guessColumns();
    $('#optHeader').checked = g.looksHeader;
    fillSelects(g);
    $('#secColumns').hidden = false;
    run();
  }

  function fillSelects(g) {
    const h = header();
    const opts = [];
    for (let c = 0; c < width(); c++) {
      const sample = table.slice(h ? 1 : 0, (h ? 1 : 0) + 3).map((r) => r[c]).filter((v) => v !== '' && v != null).join(' / ');
      const title = h ? String(h[c] ?? '').trim() || `${c + 1}列目` : `${c + 1}列目`;
      opts.push(`<option value="${c}">${esc(title)}${sample ? `（例：${esc(String(sample).slice(0, 30))}）` : ''}</option>`);
    }
    const none = '<option value="-1">（使わない）</option>';
    $('#colNo').innerHTML = opts.join('');
    $('#colName').innerHTML = none + opts.join('');
    $('#colDate').innerHTML = none + opts.join('');
    $('#colNo').value = String(g.no);
    $('#colName').value = String(g.name);
    $('#colDate').value = String(g.date);
  }

  function cols() {
    return { no: Number($('#colNo').value), name: Number($('#colName').value), date: Number($('#colDate').value) };
  }

  function renderRawPreview() {
    const c = cols();
    const h = header();
    const body = table.slice(h ? 1 : 0, (h ? 1 : 0) + 6);
    const cls = (i) => (i === c.no || i === c.name || i === c.date ? ' class="sel"' : '');
    const w = width();
    const head = h ? `<tr>${Array.from({ length: w }, (_, i) => `<th>${esc(h[i])}</th>`).join('')}</tr>` : '';
    $('#rawPreview').innerHTML = `<table class="kc-table">${head}${body.map((r) =>
      `<tr>${Array.from({ length: w }, (_, i) => `<td${cls(i)}>${esc(r[i] instanceof Date ? r[i].toLocaleDateString('ja-JP') : r[i])}</td>`).join('')}</tr>`).join('')}</table>`;
  }

  function run() {
    renderRawPreview();
    const rows = table.slice($('#optHeader').checked ? 1 : 0);
    result = analyze(rows, cols(), $('#optZero').checked);
    $('#secResult').hidden = false;
    $('#stRows').textContent = num(result.rows);
    $('#stUnique').textContent = num(result.list.length);
    $('#stMerged').textContent = num(result.rows - result.list.length - result.bad.length);
    $('#stNote').textContent = result.bad.length
      ? `※ カルテ番号が読めない行が ${num(result.bad.length)} 件あり、枚数に入れていません（下の「番号が読めない行」で確認できます）。`
      : '';
    renderCompare();
    renderMonthly();
    renderDetail();
  }

  function renderCompare() {
    const v = $('#cmpBooking').value;
    if (v === '' || !result) { $('#cmpResult').innerHTML = ''; return; }
    const diff = Number(v) - result.list.length;
    $('#cmpResult').innerHTML = diff === 0
      ? '予約システムとレセコン（まとめた後）の枚数は<b>一致</b>しています。'
      : `予約システムの方が <b>${num(Math.abs(diff))}</b> 枚${diff > 0 ? '多い' : '少ない'}です。` +
        `<br><small>参考：枝番をまとめる前のレセコンの件数（${num(result.rows)}）と比べると、予約システムの方が ${num(Math.abs(Number(v) - result.rows))} 枚${Number(v) >= result.rows ? '多い' : '少ない'}。</small>`;
  }

  function renderMonthly() {
    $('#secMonthly').hidden = !result.datedRows;
    if (!result.datedRows) return;
    const months = result.monthly.map((m) => m.month);
    if (!$('#from').value || !months.includes($('#from').value)) $('#from').value = months[Math.max(0, months.length - 12)];
    if (!$('#to').value || !months.includes($('#to').value)) $('#to').value = months[months.length - 1];
    const from = $('#from').value;
    const to = $('#to').value;
    const p = periodCount(result.list, from, to);
    $('#stPeriod').textContent = num(p.total);
    $('#stPeriodNew').textContent = num(p.fresh);
    const max = Math.max(1, ...result.monthly.map((m) => m.total));
    $('#monthTable').innerHTML = `<tr><th>月</th><th class="n">カルテ枚数</th><th class="n">うち新規</th><th></th></tr>` +
      result.monthly.slice().reverse().map((m) => {
        const inP = (!from || m.month >= from) && (!to || m.month <= to);
        const [y, mo] = m.month.split('-');
        return `<tr class="${inP ? 'in-period' : ''}"><td>${y}年${Number(mo)}月</td><td class="n">${num(m.total)}</td><td class="n">${num(m.fresh)}</td>` +
          `<td><span class="bar" style="width:${Math.round((m.total / max) * 160)}px"></span></td></tr>`;
      }).join('');
  }

  const TAB_HINT = {
    merged: '数字の部分が同じため1枚にまとめたカルテです。まとめ方が正しいか確認してください。',
    names: '番号は違うが氏名が同じものです。同じ患者様の二重登録の可能性があります（自動ではまとめていません）。同姓同名の別人の場合もあります。',
    prefix: '番号の前に文字が付いているものです（例：A125）。数字の部分だけでまとめているので、文字で別の患者様を区別している場合はお知らせください。',
    bad: 'カルテ番号の列に数字が無い行です。枚数には入れていません。',
  };

  function renderDetail() {
    const r = result;
    $('#cntMerged').textContent = `(${num(r.merged.length)})`;
    $('#cntNames').textContent = `(${num(r.sameName.length)})`;
    $('#cntPrefix').textContent = `(${num(r.prefixed.length)})`;
    $('#cntBad').textContent = `(${num(r.bad.length)})`;
    $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#tabHint').textContent = TAB_HINT[tab];
    const LIMIT = 1000;
    const more = (n) => (n > LIMIT ? `<tr><td colspan="4">ほか ${num(n - LIMIT)} 件（CSV で全件を確認できます）</td></tr>` : '');
    let html = '';
    if (tab === 'merged') {
      html = '<tr><th>まとめた番号</th><th>レセコンの番号</th><th>氏名</th><th>日付</th></tr>' +
        r.merged.slice(0, LIMIT).map((g) => `<tr><td><b>${esc(g.key)}</b></td>` +
          `<td>${g.items.map((i) => `<span class="tag">${esc(i.no)}</span>`).join('')}</td>` +
          `<td>${esc([...new Set(g.items.map((i) => i.name).filter(Boolean))].join('、'))}</td>` +
          `<td>${esc(g.items.map((i) => i.date || '').filter(Boolean).join('、'))}</td></tr>`).join('') + more(r.merged.length);
    } else if (tab === 'names') {
      html = '<tr><th>氏名</th><th>番号</th></tr>' +
        r.sameName.slice(0, LIMIT).map((s) => `<tr><td>${esc(s.groups[0].items.find((i) => i.name)?.name || s.name)}</td>` +
          `<td>${s.groups.map((g) => g.items.map((i) => `<span class="tag">${esc(i.no)}</span>`).join('')).join(' ／ ')}</td></tr>`).join('') + more(r.sameName.length);
      if (cols().name < 0) html = '<tr><td>氏名の列を選ぶと確認できます。</td></tr>';
    } else if (tab === 'prefix') {
      html = '<tr><th>レセコンの番号</th><th>まとめた番号</th><th>氏名</th></tr>' +
        r.prefixed.slice(0, LIMIT).map((p) => `<tr><td>${esc(p.no)}</td><td>${esc(p.key)}</td><td>${esc(p.name)}</td></tr>`).join('') + more(r.prefixed.length);
    } else {
      const off = $('#optHeader').checked ? 2 : 1;
      html = '<tr><th>行</th><th>カルテ番号の列の値</th><th>氏名</th></tr>' +
        r.bad.slice(0, LIMIT).map((b) => `<tr><td class="n">${b.row + off}</td><td>${esc(b.no) || '（空欄）'}</td><td>${esc(b.name)}</td></tr>`).join('') + more(r.bad.length);
    }
    $('#detailTable').innerHTML = html;
  }

  function downloadCsv() {
    if (!result) return;
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['カルテ番号（まとめた番号）', 'レセコンの番号', '件数', '氏名', '最初の日付'].map(q).join(',')];
    result.list.forEach((g) => lines.push([
      g.key, g.items.map((i) => i.no).join(' '), g.items.length,
      [...new Set(g.items.map((i) => i.name).filter(Boolean))].join(' '), g.minDate || '',
    ].map(q).join(',')));
    // Excel で文字化けしないよう BOM 付き UTF-8
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `正確なカルテ一覧_${fileName || 'レセコン'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- イベント ----------
  $('#file').addEventListener('change', (e) => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  ['#colNo', '#colName', '#colDate', '#optZero'].forEach((s) => $(s).addEventListener('change', run));
  $('#optHeader').addEventListener('change', () => { fillSelects(cols()); run(); });
  $('#cmpBooking').addEventListener('input', renderCompare);
  ['#from', '#to'].forEach((s) => $(s).addEventListener('change', renderMonthly));
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderDetail(); }));
  $('#btnCsv').addEventListener('click', downloadCsv);
})();
