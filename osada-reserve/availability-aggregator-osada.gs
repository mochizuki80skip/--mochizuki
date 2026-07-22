/**
 * チャリティー予約 空き状況 集計（自動読み取り）2店舗対応
 * ==================================================================
 * 1つのスプレッドシート内の2形式のタブを読み取り、店舗ごとに空きJSONを配信。
 *   ・学園みずほ接骨院 8/1-26 … 「新患列(5)」の空白＝受入可（〇）／×・名前＝不可
 *   ・なつめ接骨院 静岡長田店 8/28-30 … 14ベッド形式（新規対応☑ベッドの空きを算出）
 * 個人情報（氏名・連絡先）は出さず、時刻と〇△×のみ配信。
 *
 * 【デプロイ】Apps Script → デプロイ → 新しいデプロイ → ウェブアプリ（全員）
 *   → 発行URLを osada-reserve/app.js の CONFIG.apiUrl に設定（既存URLのまま新バージョンでも可）。
 */

const AGG = {
  stores: [
    { id: 'mizuho', name: '学園みずほ接骨院', note: '（移転前）', period: '8/1〜8/26',
      format: 'mizuho', days: null /* mizuhoDays_() を後で設定 */ },
    { id: 'natsume', name: 'なつめ接骨院 静岡長田店', note: '（移転後）', period: '8/28〜8/30',
      format: 'natsume', days: [
        { tab: '8/28', date: '2026-08-28' },
        { tab: '8/29', date: '2026-08-29' },
        { tab: '8/30', date: '2026-08-30' },
      ] },
  ],
  initialLabel: '初',   // なつめ：区分=初診（30分＝縦2枠）の値
  existingLabel: '既',  // なつめ：区分=既存
  fewMax: 2,            // 空き 1〜2 → △
  channelSheet: '設定', channelCol: 2, stepMin: 15,
};

function mizuhoDays_() {
  const out = [];
  for (let d = 1; d <= 26; d++) out.push({ tab: '8/' + d, date: '2026-08-' + (d < 10 ? '0' + d : d) });
  return out;
}

// 30秒キャッシュ：直近30秒はシートを読み直さず即返す（速度改善／古さは最大30秒）
const AGG_CACHE_KEY = 'avail_v1';
const AGG_CACHE_SEC = 30;

function doGet() {
  const cache = CacheService.getScriptCache();
  let json = cache.get(AGG_CACHE_KEY);
  if (!json) {
    json = JSON.stringify(a_build_());
    try { if (json.length < 95000) cache.put(AGG_CACHE_KEY, json, AGG_CACHE_SEC); } catch (e) {}
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function a_build_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const storeMeta = {}, storeOrder = [], days = [];
  for (const store of AGG.stores) {
    const list = store.format === 'mizuho' ? mizuhoDays_() : store.days;
    storeMeta[store.id] = { name: store.name, note: store.note, period: store.period };
    storeOrder.push(store.id);
    for (const d of list) {
      const sh = ss.getSheetByName(d.tab);
      if (!sh) continue;
      const slots = store.format === 'mizuho' ? a_mizuhoSlots_(sh) : a_slots_(a_readBoard_(sh));
      days.push({ store: store.id, date: d.date, slots: slots });
    }
  }
  return { generatedAt: new Date().toISOString(), channels: a_channels_(ss),
           storeMeta: storeMeta, storeOrder: storeOrder, days: days };
}

/* ===================== みずほ形式（新患列を読む） ===================== */
/** 新患列が空白の時刻＝受入可（〇）。×・名前入りは出さない（＝サイトに非表示）。 */
function a_mizuhoSlots_(sh) {
  const values = sh.getDataRange().getValues();
  const nRows = values.length;
  // 新患列：ラベル「新患」を探す。無ければヘッダ「5」。
  let shinkanCol = -1;
  for (let r = 0; r < Math.min(nRows, 12) && shinkanCol < 0; r++) {
    const row = values[r] || [];
    for (let c = 0; c < row.length; c++) if (String(row[c]).trim() === '新患') { shinkanCol = c; break; }
  }
  if (shinkanCol < 0) {
    for (let r = 0; r < Math.min(nRows, 12) && shinkanCol < 0; r++) {
      const row = values[r] || [];
      for (let c = 0; c < row.length; c++) if (String(row[c]).trim() === '5') { shinkanCol = c; break; }
    }
  }
  if (shinkanCol < 0) return [];
  // 時間列：新患列より左で「実際に時刻値が最も多く入っている列」を採用。
  // （見出し「時間」の位置ズレや、日付セルを0:00と誤認する問題を回避）
  let timeCol = -1, best = 0;
  for (let c = 0; c < shinkanCol; c++) {
    let cnt = 0;
    for (let r = 0; r < nRows; r++) if (a_toMin_(values[r][c]) != null) cnt++;
    if (cnt > best) { best = cnt; timeCol = c; }
  }
  if (timeCol < 0) return [];
  const out = [];
  for (let r = 0; r < nRows; r++) {
    const min = a_toMin_(values[r][timeCol]);
    if (min == null) continue;                 // 時刻行のみ
    const cell = values[r][shinkanCol];
    if (cell == null || String(cell).trim() === '') { // 新患列が空白＝開放中＝受入可
      out.push({ time: a_hhmm_(min), newFree: 1, newStatus: '〇', allFree: 1, allStatus: '〇' });
    }
  }
  return out;
}

/** 設定タブの集客きっかけリスト（B2以降）を選択肢として返す */
function a_channels_(ss) {
  const sh = ss.getSheetByName(AGG.channelSheet);
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, AGG.channelCol, last - 1, 1).getValues()
    .map((r) => String(r[0]).trim()).filter((s) => s !== '');
}

/* ===================== なつめ形式（14ベッド） ===================== */
function a_readBoard_(sh) {
  const values = sh.getDataRange().getValues();
  const nRows = values.length;
  const label = (r) => String((values[r] && values[r][0]) || '').trim();
  let bedRow = -1, newRow = -1, subRow = -1;
  for (let r = 0; r < Math.min(nRows, 12); r++) {
    const a = label(r);
    if (a === 'ベッド') bedRow = r;
    else if (a.indexOf('新規対応') === 0) newRow = r;
    else if (a === '時間' && r > bedRow) subRow = r;
  }
  if (bedRow < 0) bedRow = 5;
  if (newRow < 0) newRow = bedRow + 1;
  if (subRow < 0) subRow = bedRow + 3;
  const beds = [];
  const row = values[bedRow] || [];
  for (let c = 1; c < row.length; c++) {
    if (/^No\.?\s*\d+/.test(String(row[c]))) {
      const newOk = values[newRow][c] === true || /^true$/i.test(String(values[newRow][c]).trim());
      beds.push({ nameCol: c, visitCol: c + 3, active: newOk });
    }
  }
  const slots = [];
  for (let r = subRow + 1; r < nRows; r++) {
    const min = a_toMin_(values[r][0]);
    if (min != null) slots.push({ r: r, min: min });
  }
  return { values: values, beds: beds, slots: slots };
}

function a_slots_(board) {
  const out = [];
  for (let i = 0; i < board.slots.length; i++) {
    const cur = board.slots[i];
    const next = board.slots[i + 1];
    const adj = next && next.min === cur.min + AGG.stepMin;
    let allFree = 0, newFree = 0;
    for (const bed of board.beds) {
      if (!bed.active) continue;
      const free15 = !a_occupied_(board, bed, cur.r);
      if (!free15) continue;
      allFree++;
      // 各営業ブロックの最終枠（次の15分が無い）は運営として受け付けるため15分空きで新規OK
      if (!adj || !a_occupied_(board, bed, next.r)) newFree++;
    }
    out.push({ time: a_hhmm_(cur.min),
      allFree: allFree, allStatus: a_status_(allFree),
      newFree: newFree, newStatus: a_status_(newFree) });
  }
  return out;
}

function a_occupied_(board, bed, r) {
  const name = board.values[r][bed.nameCol];
  if (name != null && String(name).trim() !== '') return true;
  const upName = board.values[r - 1] ? board.values[r - 1][bed.nameCol] : '';
  const upVisit = board.values[r - 1] ? board.values[r - 1][bed.visitCol] : '';
  if (upName != null && String(upName).trim() !== '' &&
      String(upVisit).trim() === AGG.initialLabel) return true;
  return false;
}

/* =========================== 共通ユーティリティ =========================== */
function a_status_(free) {
  if (free <= 0) return '×';
  if (free <= AGG.fewMax) return '△';
  return '〇';
}
function a_hhmm_(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}
function a_toMin_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number') return (v > 0 && v < 1) ? Math.round(v * 1440) : null;
  if (typeof v === 'string') {
    const m = v.replace('：', ':').trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  return null;
}
