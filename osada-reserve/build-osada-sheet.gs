/**
 * なつめ接骨院 静岡長田店 チャリティー施術会 予約表ビルダー
 * ============================================================
 * 手動入力しやすい予約表を自動生成する Google Apps Script（初回1回だけ実行）。
 * 生成後は普通のスプレッドシート＝編集自由・承認不要・数式で自動集計。
 *
 *   上部ダッシュボード（すべて数式・自動計算）
 *     ・予約数 / 初診数（午前・午後・合計）
 *     ・既存数 / 来院数 / 来院なし
 *     ・新規対応ベッド数（母数）/ 最大予約枠 / 予約率
 *   見出し
 *     ・ベッド番号（No.1〜No.14）/ 新規対応☑ / 施術者
 *   本体
 *     ・A列=時間（15分）/ 1ベッド=5列（氏名/連絡先/集客きっかけ/区分/来院）
 *     ・初診=30分は縦2行を結合／2回目・3回目・既存=15分
 *     ・区分=初診→淡い赤 / 既存→淡い青
 *     ・集客きっかけ・施術者・区分は「設定」タブ参照ドロップダウン
 *
 * 【使い方】拡張機能→Apps Script に貼付→ buildReservationSheets を実行（オーナー初回のみ承認）。
 */

const CONFIG = {
  title: 'なつめ接骨院 静岡長田店 チャリティー施術会 予約表',
  days: [
    { tab: '8/28', date: '2026/8/28', wd: '金', hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { tab: '8/29', date: '2026/8/29', wd: '土', hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { tab: '8/30', date: '2026/8/30', wd: '日', hours: [['09:00', '17:00']] }, // 通し営業
  ],
  stepMin: 15,
  bedCount: 14,
  therapistByBed: [],
  staffList: [],   // 施術者候補（空。設定タブA列に院側で入力→全タブ反映）
  channels: [
    '新聞折込', 'チラシ', 'のぼり', '家族の紹介', '友人の紹介', '職場の紹介',
    'Instagram広告', 'Facebook広告', 'threads広告', 'ホームページを見た',
    'Googleを見た', 'みずほ接骨院からの紹介', 'その他',
  ],
  visitTypes: ['初診', '2回目', '3回目', '既存'],
  colorInitial: '#f4cccc',  // 初診=淡い赤
  colorExisting: '#cfe2f3', // 既存=淡い青
  noon: 720,                // 午前/午後の境界（12:00）
};

const COLS_PER_BED = 5;
const SUBHEAD = ['氏名', '連絡先', '集客きっかけ', '区分', '来院'];
// 行レイアウト（ダッシュボード4行＋見出し4行）
const R_TITLE = 1, R_DASH_H = 2, R_AM = 3, R_PM = 4, R_SUM = 5;
const R_BED = 6, R_NEW = 7, R_THER = 8, R_SUB = 9, R_DATA = 10;

/* ============================ メニュー ============================ */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('▶ 予約表')
      .addItem('予約表を生成/再生成', 'buildReservationSheets')
      .addItem('古い安倍川店タブを削除', 'cleanupOldTabs')
      .addToUi();
  } catch (e) {}
}

function buildReservationSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settings = ensureSettingsSheet_(ss);
  const staffRange = settings.getRange('A2:A200');
  const channelRange = settings.getRange('B2:B200');
  const visitRange = settings.getRange('C2:C200');
  CONFIG.days.forEach((d) => buildDay_(ss, d, staffRange, channelRange, visitRange));
  CONFIG.days.forEach((d, idx) => {
    const sh = ss.getSheetByName(d.tab);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(idx + 1); }
  });
  try { SpreadsheetApp.getActive().toast('予約表を生成しました（' + CONFIG.bedCount + 'ベッド）'); } catch (e) {}
}

function buildDay_(ss, day, staffRange, channelRange, visitRange) {
  let sh = ss.getSheetByName(day.tab);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(day.tab);

  const nBeds = CONFIG.bedCount;
  const totalCols = 1 + nBeds * COLS_PER_BED;
  const rows = dayRows_(day);                 // [{label, brk, min}]
  const nRows = rows.length;
  const lastDataRow = R_DATA + nRows - 1;
  const slotCount = rows.filter((r) => !r.brk).length;

  // 午前/午後の行範囲（休憩行は除外される）
  let amEnd = -1, pmStart = -1;
  rows.forEach((row, ri) => {
    const r = R_DATA + ri;
    if (row.brk) return;
    if (row.min <= CONFIG.noon) amEnd = r; else if (pmStart < 0) pmStart = r;
  });
  if (amEnd < 0) amEnd = R_DATA - 1;
  if (pmStart < 0) pmStart = lastDataRow + 1;

  // 数式ヘルパ：全ベッドの指定列（offset）を rs..re で合算
  const sumOver = (offset, rs, re, crit) => {
    const parts = [];
    for (let i = 0; i < nBeds; i++) {
      const L = columnLetter_(2 + i * COLS_PER_BED + offset);
      parts.push(crit == null ? `COUNTA(${L}${rs}:${L}${re})` : `COUNTIF(${L}${rs}:${L}${re},${crit})`);
    }
    return '=' + parts.join('+');
  };
  const OFF_NAME = 0, OFF_VISIT = 3, OFF_COME = 4;

  /* ---------- 行1: タイトル ---------- */
  sh.getRange(R_TITLE, 1, 1, totalCols).merge()
    .setValue(`${CONFIG.title}　${day.date}(${day.wd})　※初診=30分(縦2行結合)／2回目以降=15分`)
    .setFontWeight('bold').setFontSize(12)
    .setBackground('#1f6f43').setFontColor('#fff')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  /* ---------- 行2〜5: ダッシュボード（数式） ---------- */
  // 左：午前/午後/合計 × 予約数 / 実績 / 初診
  sh.getRange(R_DASH_H, 2).setValue('予約数');
  sh.getRange(R_DASH_H, 3).setValue('実績');   // ＝来院☑の数
  sh.getRange(R_DASH_H, 4).setValue('初診');
  sh.getRange(R_AM, 1).setValue('午前');
  sh.getRange(R_PM, 1).setValue('午後');
  sh.getRange(R_SUM, 1).setValue('合計');
  // 予約数（氏名の数）
  sh.getRange(R_AM, 2).setFormula(sumOver(OFF_NAME, R_DATA, amEnd, null));
  sh.getRange(R_PM, 2).setFormula(sumOver(OFF_NAME, pmStart, lastDataRow, null));
  sh.getRange(R_SUM, 2).setFormula(`=B${R_AM}+B${R_PM}`);
  // 実績（来院☑の数）
  sh.getRange(R_AM, 3).setFormula(sumOver(OFF_COME, R_DATA, amEnd, 'TRUE'));
  sh.getRange(R_PM, 3).setFormula(sumOver(OFF_COME, pmStart, lastDataRow, 'TRUE'));
  sh.getRange(R_SUM, 3).setFormula(`=C${R_AM}+C${R_PM}`);
  // 初診（区分=初診）
  sh.getRange(R_AM, 4).setFormula(sumOver(OFF_VISIT, R_DATA, amEnd, '"初診"'));
  sh.getRange(R_PM, 4).setFormula(sumOver(OFF_VISIT, pmStart, lastDataRow, '"初診"'));
  sh.getRange(R_SUM, 4).setFormula(`=D${R_AM}+D${R_PM}`);

  // 右：既存 / 来院なし / 新規対応ベッド
  sh.getRange(R_AM, 6).setValue('既存');
  sh.getRange(R_PM, 6).setValue('来院なし');
  sh.getRange(R_SUM, 6).setValue('新規対応ベッド');
  sh.getRange(R_AM, 7).setFormula(sumOver(OFF_VISIT, R_DATA, lastDataRow, '"既存"'));
  sh.getRange(R_PM, 7).setFormula(`=B${R_SUM}-C${R_SUM}`); // 来院なし＝予約数−実績
  sh.getRange(R_SUM, 7).setFormula(`=COUNTIF(${R_NEW}:${R_NEW},TRUE)&"/"&${nBeds}`);

  // ダッシュボードの見た目
  sh.getRange(R_DASH_H, 1, 4, 7).setHorizontalAlignment('center');
  [ [R_DASH_H, 2], [R_DASH_H, 3], [R_DASH_H, 4],
    [R_AM, 1], [R_PM, 1], [R_SUM, 1], [R_AM, 6], [R_PM, 6], [R_SUM, 6],
  ].forEach(([r, c]) => sh.getRange(r, c).setFontWeight('bold').setFontColor('#1f6f43'));
  sh.getRange(R_DASH_H, 1, 4, 7).setBackground('#f4f8f5')
    .setBorder(true, true, true, true, true, true, '#cfe0d5', SpreadsheetApp.BorderStyle.SOLID);

  /* ---------- 行6〜9: 見出し ---------- */
  sh.getRange(R_BED, 1).setValue('ベッド').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#e7f2ec');
  sh.getRange(R_NEW, 1).setFormula(`=CONCATENATE("新規対応 ",COUNTIF(${R_NEW}:${R_NEW},TRUE),"/",${nBeds})`)
    .setFontWeight('bold').setFontColor('#1f6f43').setHorizontalAlignment('center').setBackground('#f0f0f0');
  sh.getRange(R_THER, 1).setValue('施術者').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f0f0f0');
  sh.getRange(R_SUB, 1).setValue('時間').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f0f0f0');

  const staffRule = SpreadsheetApp.newDataValidation().requireValueInRange(staffRange, true).setAllowInvalid(true).build();
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    sh.getRange(R_BED, c, 1, COLS_PER_BED).merge().setValue('No.' + (i + 1))
      .setFontWeight('bold').setBackground('#e7f2ec').setHorizontalAlignment('center');
    sh.getRange(R_NEW, c, 1, COLS_PER_BED).setBackground('#fafafa').setHorizontalAlignment('center');
    sh.getRange(R_NEW, c).insertCheckboxes().setValue(true).setBackground('#ffffff');
    const ther = sh.getRange(R_THER, c, 1, COLS_PER_BED).merge().setDataValidation(staffRule).setHorizontalAlignment('center');
    if (CONFIG.therapistByBed[i]) ther.setValue(CONFIG.therapistByBed[i]);
    sh.getRange(R_SUB, c, 1, COLS_PER_BED).setValues([SUBHEAD])
      .setFontWeight('bold').setBackground('#f0f0f0').setHorizontalAlignment('center');
  }

  /* ---------- 行10〜: 時間行 / 休憩行 ---------- */
  const channelRule = SpreadsheetApp.newDataValidation().requireValueInRange(channelRange, true).setAllowInvalid(true).build();
  const visitRule = SpreadsheetApp.newDataValidation().requireValueInRange(visitRange, true).setAllowInvalid(true).build();
  rows.forEach((row, ri) => {
    const r = R_DATA + ri;
    if (row.brk) {
      sh.getRange(r, 1, 1, totalCols).setBackground('#eceff1');
      sh.getRange(r, 1).setValue(row.label).setFontColor('#888').setHorizontalAlignment('center');
      return;
    }
    sh.getRange(r, 1).setValue(row.label).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fafafa');
    for (let i = 0; i < nBeds; i++) {
      const c = 2 + i * COLS_PER_BED;
      sh.getRange(r, c + 2).setDataValidation(channelRule);
      sh.getRange(r, c + 3).setDataValidation(visitRule);
      sh.getRange(r, c + 4).insertCheckboxes();
    }
  });

  /* ---------- 区分による自動色分け（初診=淡い赤 / 既存=淡い青） ---------- */
  const cfRules = sh.getConditionalFormatRules();
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    const visitCol = columnLetter_(c + 3);
    const range = sh.getRange(R_DATA, c, nRows, COLS_PER_BED);
    cfRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${visitCol}${R_DATA}="初診"`).setBackground(CONFIG.colorInitial).setRanges([range]).build());
    cfRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${visitCol}${R_DATA}="既存"`).setBackground(CONFIG.colorExisting).setRanges([range]).build());
  }
  sh.setConditionalFormatRules(cfRules);

  /* ---------- 罫線・固定・列幅 ---------- */
  sh.getRange(R_BED, 1, lastDataRow - R_BED + 1, totalCols)
    .setBorder(true, true, true, true, true, true, '#cfcfcf', SpreadsheetApp.BorderStyle.SOLID);
  sh.setFrozenRows(R_SUB);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 60);
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    sh.setColumnWidth(c, 88); sh.setColumnWidth(c + 1, 104);
    sh.setColumnWidth(c + 2, 128); sh.setColumnWidth(c + 3, 64); sh.setColumnWidth(c + 4, 42);
  }

  sh.getRange(lastDataRow + 2, 1, 1, Math.min(totalCols, 12)).merge().setValue(
    '【使い方】初診=30分は該当ベッドの縦2行を選択して「セルを結合」して入力／2回目・3回目・既存=15分(1行)／' +
    '各ベッドの「新規対応」☑を外すと新規受付なし(休憩・不在ブロックにも使用)／上部の集計はすべて自動計算。'
  ).setFontColor('#555').setWrap(true);
}

/* ------- その日の行（時間 + 休憩） ------- */
function dayRows_(day) {
  const rows = [];
  day.hours.forEach((blk, bi) => {
    if (bi > 0) rows.push({ label: '昼休憩', brk: true, min: -1 });
    const open = toMin_(blk[0]), close = toMin_(blk[1]);
    for (let t = open; t <= close; t += CONFIG.stepMin) rows.push({ label: fromMin_(t), brk: false, min: t });
  });
  return rows;
}

/* ===================== 設定タブ ===================== */
function ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName('設定');
  if (!sh) sh = ss.insertSheet('設定');
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['施術者リスト', '集客きっかけリスト', '区分リスト']])
    .setFontWeight('bold').setBackground('#1f6f43').setFontColor('#fff');
  const maxLen = Math.max(CONFIG.staffList.length, CONFIG.channels.length, CONFIG.visitTypes.length);
  for (let r = 0; r < maxLen; r++) {
    if (CONFIG.staffList[r]) sh.getRange(r + 2, 1).setValue(CONFIG.staffList[r]);
    if (CONFIG.channels[r]) sh.getRange(r + 2, 2).setValue(CONFIG.channels[r]);
    if (CONFIG.visitTypes[r]) sh.getRange(r + 2, 3).setValue(CONFIG.visitTypes[r]);
  }
  sh.getRange(1, 5).setValue('※このタブを編集すると各予約表のドロップダウン候補も変わります').setFontColor('#888');
  sh.autoResizeColumns(1, 3);
  return sh;
}

/* ====== 古い安倍川店タブ（8月28日（金）/体験者一覧/Web予約）を削除 ====== */
function cleanupOldTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const keep = CONFIG.days.map((d) => d.tab).concat(['設定']);
  ss.getSheets().forEach((sh) => {
    const n = sh.getName();
    if (keep.indexOf(n) < 0 && /(月.*日|体験者一覧|Web予約)/.test(n) && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/* =========================== ユーティリティ =========================== */
function toMin_(s) { const m = String(s).replace('：', ':').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; }
function fromMin_(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function columnLetter_(col) { let s = ''; while (col > 0) { const r = (col - 1) % 26; s = String.fromCharCode(65 + r) + s; col = (col - r - 1) / 26; } return s; }
