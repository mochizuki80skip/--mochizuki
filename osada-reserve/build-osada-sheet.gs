/**
 * なつめ接骨院 静岡長田店 チャリティー施術会 予約表ビルダー
 * ============================================================
 * 手動入力しやすい予約表を自動生成する Google Apps Script。
 *   ・1行 = 1予約（①氏名 / ②連絡先 / ③集客きっかけ / ④区分 / ⑤来院）
 *   ・15分刻み（2回目・3回目・既存 = 15分 = 1行）
 *   ・初診 = 30分（入力は1行、次の15分もそのルームは埋まり扱い）
 *   ・③集客きっかけ・④区分はドロップダウン、新規対応・⑤来院はチェックボックス
 *
 * 【使い方】
 *   1. 対象スプレッドシートで  拡張機能 → Apps Script
 *   2. このコードを貼り付けて保存
 *   3. 下の CONFIG を実際の開催内容に合わせて調整
 *   4. 関数 buildReservationSheets を選んで実行（初回は権限承認）
 *   5. （任意）古い「8月28日（金）」等の安倍川店タブは cleanupOldTabs で削除
 */

const CONFIG = {
  title: 'なつめ接骨院 静岡長田店 チャリティー施術会 予約表',
  days: [
    { tab: '8/28', date: '2026/8/28', wd: '金' },
    { tab: '8/29', date: '2026/8/29', wd: '土' },
    { tab: '8/30', date: '2026/8/30', wd: '日' },
  ],
  // 開催時間ブロック。昼休みで分ける場合は [['09:00','12:00'],['14:00','18:00']] のように複数指定。
  hours: [['09:00', '18:00']],
  stepMin: 15,                                        // 行の刻み（分）
  rooms: ['ルームA', 'ルームB', 'ルームC', 'ルームD'],   // 部屋（施術者）数ぶん。増減OK。
  therapistByRoom: ['', '', '', ''],                  // 各ルームの既定対応者（空でOK）
  staffList: ['加藤', '沼田', '佐々木', '谷口', '中島', '黒川'],  // 対応者ドロップダウン候補
  channels: [                                         // ③集客きっかけの選択肢
    '新聞折込', 'チラシ', 'のぼり', '家族の紹介', '友人の紹介', '職場の紹介',
    'Instagram広告', 'Facebook広告', 'threads広告', 'ホームページを見た',
    'Googleを見た', 'みずほ接骨院からの紹介', 'その他',
  ],
  visitTypes: ['初診', '2回目', '3回目', '既存'],       // ④区分（初診=30分 / それ以外=15分）
  colorInitial: '#fff3e0',                            // 初診の行のハイライト色
};

const COLS_PER_ROOM = 5;                              // ①氏名 ②連絡先 ③きっかけ ④区分 ⑤来院
const SUBHEAD = ['氏名', '連絡先', '集客きっかけ', '区分', '来院'];

/* ============================ メニュー ============================ */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('▶ 予約表')
      .addItem('予約表を生成/再生成', 'buildReservationSheets')
      .addItem('古い安倍川店タブを削除', 'cleanupOldTabs')
      .addToUi();
  } catch (e) { /* UIが無い場合は無視 */ }
}

/* ========================= 生成メイン ========================= */
function buildReservationSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSettingsSheet_(ss);
  ensureWebSheet_(ss);
  CONFIG.days.forEach((d) => buildDay_(ss, d));
  CONFIG.days.forEach((d, idx) => {
    const sh = ss.getSheetByName(d.tab);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(idx + 1); }
  });
  try { SpreadsheetApp.getActive().toast('予約表を生成しました'); } catch (e) {}
}

function buildDay_(ss, day) {
  let sh = ss.getSheetByName(day.tab);
  if (sh) ss.deleteSheet(sh);
  sh = ss.insertSheet(day.tab);

  const nRooms = CONFIG.rooms.length;
  const totalCols = 1 + nRooms * COLS_PER_ROOM;
  const times = timeLabels_();
  const nRows = times.length;
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + nRows - 1;

  // 行1: タイトル
  sh.getRange(1, 1, 1, totalCols).merge()
    .setValue(`${CONFIG.title}　${day.date}(${day.wd})`)
    .setFontWeight('bold').setFontSize(13)
    .setBackground('#1f6f43').setFontColor('#fff')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 行2: ルーム名（各5列を結合）
  sh.getRange(2, 1).setValue('時間').setFontWeight('bold').setHorizontalAlignment('center');
  CONFIG.rooms.forEach((name, i) => {
    const c = 2 + i * COLS_PER_ROOM;
    sh.getRange(2, c, 1, COLS_PER_ROOM).merge()
      .setValue(name).setFontWeight('bold')
      .setBackground('#e7f2ec').setHorizontalAlignment('center');
  });

  // 行3: 対応者ドロップダウン ＋ 新規対応チェック
  const staffRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.staffList, true).setAllowInvalid(true).build();
  CONFIG.rooms.forEach((name, i) => {
    const c = 2 + i * COLS_PER_ROOM;
    sh.getRange(3, c).setValue('対応者').setFontColor('#666').setHorizontalAlignment('right');
    const pick = sh.getRange(3, c + 1, 1, 2).merge().setDataValidation(staffRule);
    if (CONFIG.therapistByRoom[i]) pick.setValue(CONFIG.therapistByRoom[i]);
    sh.getRange(3, c + 3).setValue('新規対応').setFontColor('#666').setHorizontalAlignment('right');
    sh.getRange(3, c + 4).insertCheckboxes().setValue(true);
  });

  // 行4: 小見出し（氏名/連絡先/集客きっかけ/区分/来院）
  sh.getRange(4, 1).setValue('時間').setFontWeight('bold').setBackground('#f0f0f0').setHorizontalAlignment('center');
  CONFIG.rooms.forEach((name, i) => {
    const c = 2 + i * COLS_PER_ROOM;
    sh.getRange(4, c, 1, COLS_PER_ROOM).setValues([SUBHEAD])
      .setFontWeight('bold').setBackground('#f0f0f0').setHorizontalAlignment('center');
  });

  // 行5〜: 時刻ラベル
  sh.getRange(firstDataRow, 1, nRows, 1).setValues(times.map((t) => [t]))
    .setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fafafa');

  // ドロップダウン & チェックボックス
  const channelRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.channels, true).setAllowInvalid(true).build();
  const visitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(CONFIG.visitTypes, true).setAllowInvalid(true).build();
  CONFIG.rooms.forEach((name, i) => {
    const c = 2 + i * COLS_PER_ROOM;           // 氏名列
    sh.getRange(firstDataRow, c + 2, nRows, 1).setDataValidation(channelRule); // 集客きっかけ
    sh.getRange(firstDataRow, c + 3, nRows, 1).setDataValidation(visitRule);   // 区分
    sh.getRange(firstDataRow, c + 4, nRows, 1).insertCheckboxes();             // 来院
  });

  // 初診の行を薄オレンジで色付け（区分=初診 のとき、その部屋の5列）
  const rules = sh.getConditionalFormatRules();
  CONFIG.rooms.forEach((name, i) => {
    const c = 2 + i * COLS_PER_ROOM;
    const visitCol = columnLetter_(c + 3);
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${visitCol}${firstDataRow}="初診"`)
      .setBackground(CONFIG.colorInitial)
      .setRanges([sh.getRange(firstDataRow, c, nRows, COLS_PER_ROOM)]).build());
  });
  sh.setConditionalFormatRules(rules);

  // 罫線・固定・列幅
  sh.getRange(2, 1, lastDataRow - 1, totalCols)
    .setBorder(true, true, true, true, true, true, '#cfcfcf', SpreadsheetApp.BorderStyle.SOLID);
  sh.setFrozenRows(4);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 64);
  for (let i = 0; i < nRooms; i++) {
    const c = 2 + i * COLS_PER_ROOM;
    sh.setColumnWidth(c, 96); sh.setColumnWidth(c + 1, 112);
    sh.setColumnWidth(c + 2, 150); sh.setColumnWidth(c + 3, 72); sh.setColumnWidth(c + 4, 48);
  }

  // 使い方メモ
  sh.getRange(lastDataRow + 2, 1, 1, totalCols).merge().setValue(
    '【使い方】1行=1予約。氏名・連絡先・集客きっかけ・区分・来院を入力／' +
    '区分=初診は30分（次の15分もそのルームは埋まり扱い）／2回目・3回目・既存は15分／' +
    '新規対応☑を外すとそのルームは新規受付なし（休憩・不在のブロックにも使用）'
  ).setFontColor('#555').setWrap(true);
}

/* ===================== 設定 / Web予約 タブ ===================== */
function ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName('設定');
  if (!sh) sh = ss.insertSheet('設定');
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['担当者リスト', '集客経路リスト', '区分リスト']])
    .setFontWeight('bold').setBackground('#1f6f43').setFontColor('#fff');
  const maxLen = Math.max(CONFIG.staffList.length, CONFIG.channels.length, CONFIG.visitTypes.length);
  for (let r = 0; r < maxLen; r++) {
    if (CONFIG.staffList[r]) sh.getRange(r + 2, 1).setValue(CONFIG.staffList[r]);
    if (CONFIG.channels[r]) sh.getRange(r + 2, 2).setValue(CONFIG.channels[r]);
    if (CONFIG.visitTypes[r]) sh.getRange(r + 2, 3).setValue(CONFIG.visitTypes[r]);
  }
  sh.autoResizeColumns(1, 3);
}

function ensureWebSheet_(ss) {
  let sh = ss.getSheetByName('Web予約');
  if (!sh) sh = ss.insertSheet('Web予約');
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 9).setValues([[
      '受付日時', '第1希望', '第2希望', '第3希望', '予約者名', '電話番号', 'メールアドレス', '予約のきっかけ', '区分',
    ]]).setFontWeight('bold').setBackground('#1f6f43').setFontColor('#fff');
    sh.setFrozenRows(1);
  }
}

/* ============ 古い安倍川店タブ（8月28日（金）等）を削除 ============ */
function cleanupOldTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const keep = CONFIG.days.map((d) => d.tab).concat(['設定', 'Web予約']);
  ss.getSheets().forEach((sh) => {
    const n = sh.getName();
    if (keep.indexOf(n) < 0 && /(月.*日|体験者一覧)/.test(n)) {
      if (ss.getSheets().length > 1) ss.deleteSheet(sh);
    }
  });
}

/* =========================== ユーティリティ =========================== */
function timeLabels_() {
  const out = [];
  CONFIG.hours.forEach(([open, close]) => {
    for (let t = toMin_(open), end = toMin_(close); t < end; t += CONFIG.stepMin) out.push(fromMin_(t));
  });
  return out;
}
function toMin_(s) { const m = String(s).replace('：', ':').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; }
function fromMin_(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function columnLetter_(col) { let s = ''; while (col > 0) { const r = (col - 1) % 26; s = String.fromCharCode(65 + r) + s; col = (col - r - 1) / 26; } return s; }
