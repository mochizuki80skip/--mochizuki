/* カルテ枚数計算
 * レセコンの顧客リストを読み込み、カルテ番号の数字部分が同じもの（125・125a・125x）を
 * 1枚にまとめて正確なカルテ枚数（被りを除いた顧客数）を出す。ファイルはブラウザ内だけで処理する。
 * カルテ番号の決まりは「数字」「数字+a」「数字+x」。それ以外の形は確認用に一覧へ出す。
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

  // 院のカルテ番号の決まり：数字のみ・数字+a・数字+x
  const isStandard = (text) => /^\d+[ax]?$/i.test(text);

  /**
   * 集計
   * @param rows データ行（見出しを除く）
   * @param cols {no, name} 列番号（name は -1 で無し）
   */
  function analyze(rows, cols, ignoreZero) {
    const groups = new Map(); // key → {key, items:[{no, name}], names:Set}
    const bad = [];
    const odd = [];
    rows.forEach((r, i) => {
      const k = karteKey(r[cols.no], ignoreZero);
      const name = cols.name >= 0 ? String(r[cols.name] ?? '').trim() : '';
      if (!k) { bad.push({ row: i, no: String(r[cols.no] ?? ''), name }); return; }
      if (!isStandard(k.text)) odd.push({ row: i, no: k.text, key: k.key, name });
      let g = groups.get(k.key);
      if (!g) { g = { key: k.key, items: [], names: new Set() }; groups.set(k.key, g); }
      g.items.push({ no: k.text, name });
      if (name) g.names.add(name.replace(/[\s　]+/g, ''));
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

    return { rows: rows.length, list, merged, bad, odd, sameName };
  }

  const KC = { parseCsv, karteKey, isStandard, analyze };
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
    // 見出しが無い時（レセコンの書き出しは見出し無し）は、値の形から列を当てる
    const sample = table.slice(0, 300);
    const bestCol = (scoreOf) => {
      let best = -1;
      let bestScore = 0;
      for (let c = 0; c < width(); c++) {
        const score = sample.reduce((n, r) => n + scoreOf(String(r[c] ?? '').normalize('NFKC')), 0);
        if (score > bestScore) { best = c; bestScore = score; }
      }
      return best;
    };
    if (no < 0) {
      // カルテ番号：数字（+英字1文字）。英字付き（000054x）や 0 埋め（000054）を強く評価し、
      // 郵便番号・生年月日のような数字だけの列より優先する
      no = bestCol((v) => {
        if (!/^\s*\d+[a-z]?\s*$/i.test(v)) return 0;
        return 1 + (/\d[a-z]\s*$/i.test(v) ? 5 : 0) + (/^\s*0/.test(v) ? 2 : 0);
      });
      if (no < 0) no = 0;
    }
    let name = find(/氏名|患者名|名前|^名$/);
    if (name < 0) name = find(/カナ|フリガナ/);
    if (name < 0) {
      // 氏名：漢字を含み、姓と名の間に空白があり、数字を含まない値
      name = bestCol((v) => (/[\u4e00-\u9fff]/.test(v) && /\S[\s\u3000]+\S/.test(v) && !/\d/.test(v) && v.length <= 20 ? 1 : 0));
    }
    const looksHeader = h.some((c) => /[^\d\s./-]/.test(c)) && !/^\s*\d/.test(String(table[0]?.[no] ?? ''));
    return { no, name, looksHeader };
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
    $('#colNo').value = String(g.no);
    $('#colName').value = String(g.name);
  }

  function cols() {
    return { no: Number($('#colNo').value), name: Number($('#colName').value) };
  }

  function renderRawPreview() {
    const c = cols();
    const h = header();
    const body = table.slice(h ? 1 : 0, (h ? 1 : 0) + 6);
    const cls = (i) => (i === c.no || i === c.name ? ' class="sel"' : '');
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

  const TAB_HINT = {
    merged: '数字の部分が同じため1枚にまとめたカルテです。まとめ方が正しいか確認してください。',
    all: 'まとめた後の全カルテです。上の検索欄で番号（例：100）や氏名を入れると、枝番（000100x など）も含めて探せます。',
    names: '番号は違うが氏名が同じものです。同じ患者様の二重登録の可能性があります（自動ではまとめていません）。同姓同名の別人の場合もあります。',
    odd: '「数字」「数字+a」「数字+x」以外の形の番号です（例：125b、A125、125-2）。数字の部分でまとめて数えていますが、入力ミスの可能性があります。',
    bad: 'カルテ番号の列に数字が無い行です。枚数には入れていません。',
  };

  function renderDetail() {
    const r = result;
    $('#cntMerged').textContent = `(${num(r.merged.length)})`;
    $('#cntAll').textContent = `(${num(r.list.length)})`;
    $('#cntNames').textContent = `(${num(r.sameName.length)})`;
    $('#cntOdd').textContent = `(${num(r.odd.length)})`;
    $('#cntBad').textContent = `(${num(r.bad.length)})`;
    $$('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    $('#tabHint').textContent = TAB_HINT[tab];
    const LIMIT = 1000;
    // 検索（番号は数字部分で、氏名は空白を除いて部分一致）
    const q = $('#search').value.normalize('NFKC').replace(/[\s\u3000]+/g, '');
    const qNo = /^\d+[a-z]?$/i.test(q) ? karteKey(q, $('#optZero').checked).key : null;
    const hitGroup = (g) => !q || (qNo ? g.key === qNo : [...g.names].some((n) => n.normalize('NFKC').includes(q)));
    const hitItem = (it) => !q || (qNo ? it.key === qNo : String(it.name).normalize('NFKC').replace(/[\s\u3000]+/g, '').includes(q));
    const more = (n) => (n > LIMIT ? `<tr><td colspan="4">ほか ${num(n - LIMIT)} 件（CSV で全件を確認できます）</td></tr>` : '');
    let html = '';
    const groupRows = (gs) => '<tr><th>まとめた番号</th><th>レセコンの番号</th><th>氏名</th></tr>' +
      gs.slice(0, LIMIT).map((g) => `<tr><td><b>${esc(g.key)}</b></td>` +
        `<td>${g.items.map((i) => `<span class="tag">${esc(i.no)}</span>`).join('')}</td>` +
        `<td>${esc([...new Set(g.items.map((i) => i.name).filter(Boolean))].join('、'))}</td></tr>`).join('') + more(gs.length) +
      (gs.length ? '' : '<tr><td colspan="3">該当なし</td></tr>');
    if (tab === 'all') {
      html = groupRows(r.list.filter(hitGroup));
    } else if (tab === 'merged') {
      html = '<tr><th>まとめた番号</th><th>レセコンの番号</th><th>氏名</th></tr>' +
        r.merged.filter(hitGroup).slice(0, LIMIT).map((g) => `<tr><td><b>${esc(g.key)}</b></td>` +
          `<td>${g.items.map((i) => `<span class="tag">${esc(i.no)}</span>`).join('')}</td>` +
          `<td>${esc([...new Set(g.items.map((i) => i.name).filter(Boolean))].join('、'))}</td></tr>`).join('') + more(r.merged.length);
    } else if (tab === 'names') {
      html = '<tr><th>氏名</th><th>番号</th></tr>' +
        r.sameName.filter((s) => s.groups.some(hitGroup)).slice(0, LIMIT).map((s) => `<tr><td>${esc(s.groups[0].items.find((i) => i.name)?.name || s.name)}</td>` +
          `<td>${s.groups.map((g) => g.items.map((i) => `<span class="tag">${esc(i.no)}</span>`).join('')).join(' ／ ')}</td></tr>`).join('') + more(r.sameName.length);
      if (cols().name < 0) html = '<tr><td>氏名の列を選ぶと確認できます。</td></tr>';
    } else if (tab === 'odd') {
      html = '<tr><th>レセコンの番号</th><th>まとめた番号</th><th>氏名</th></tr>' +
        r.odd.filter(hitItem).slice(0, LIMIT).map((p) => `<tr><td>${esc(p.no)}</td><td>${esc(p.key)}</td><td>${esc(p.name)}</td></tr>`).join('') + more(r.odd.length);
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
    const lines = [['カルテ番号（まとめた番号）', 'レセコンの番号', '件数', '氏名'].map(q).join(',')];
    result.list.forEach((g) => lines.push([
      g.key, g.items.map((i) => i.no).join(' '), g.items.length,
      [...new Set(g.items.map((i) => i.name).filter(Boolean))].join(' '),
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
  ['#colNo', '#colName', '#optZero'].forEach((s) => $(s).addEventListener('change', run));
  $('#optHeader').addEventListener('change', () => { fillSelects(cols()); run(); });
  $('#cmpBooking').addEventListener('input', renderCompare);
  $$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; renderDetail(); }));
  $('#btnCsv').addEventListener('click', downloadCsv);
  $('#search').addEventListener('input', renderDetail);
})();
