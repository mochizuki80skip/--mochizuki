/**
 * なつめ接骨院 静岡長田店 チャリティー施術会 予約表ビルダー
 * ============================================================
 * 手動入力しやすい予約表を自動生成する Google Apps Script。
 *   ・A列 = 時間軸（15分刻み）
 *   ・見出し行 = ベッド番号 / 新規対応☑（可否） / 施術者名
 *   ・1ベッド = 5列（①氏名 ②連絡先 ③集客きっかけ ④区分 ⑤来院）
 *   ・ベッド14台
 *   ・初診 = 30分（該当ベッドの縦2行を手動で「結合」して使う）
 *   ・2回目/3回目/既存 = 15分（1行）
 *   ・③集客きっかけ・施術者・④区分は「設定」タブを参照するドロップダウン
 *   ・④区分=初診 → 行を淡い赤 / 既存 → 淡い青（自動色分け）
 *
 * 【使い方】
 *   1. 対象スプレッドシートで  拡張機能 → Apps Script
 *   2. このコードを貼り付けて保存
 *   3. 下の CONFIG を確認（施術者名などは「設定」タブで後から編集も可）
 *   4. 関数 buildReservationSheets を実行（初回は権限承認）
 *   5. （任意）cleanupOldTabs で安倍川店の古いタブを削除
 */

const CONFIG = {
  title: 'なつめ接骨院 静岡長田店 チャリティー施術会 予約表',
  // hours: 開催時間ブロック。最終時間も受付可（終了時刻ちょうどの枠まで作成）。
  days: [
    { tab: '8/28', date: '2026/8/28', wd: '金', hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { tab: '8/29', date: '2026/8/29', wd: '土', hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { tab: '8/30', date: '2026/8/30', wd: '日', hours: [['09:00', '17:00']] }, // 通し営業
  ],
  stepMin: 15,          // 行の刻み（分）
  bedCount: 14,         // ベッド台数
  therapistByBed: [],   // 各ベッドの既定施術者（空。院側で入力）
  staffList: [],        // 施術者ドロップダウン候補（空。設定タブA列に院側で入力→全タブ反映）
  channels: [           // ③集客きっかけの選択肢（設定タブに出力→ドロップダウンで参照）
    '新聞折込', 'チラシ', 'のぼり', '家族の紹介', '友人の紹介', '職場の紹介',
    'Instagram広告', 'Facebook広告', 'threads広告', 'ホームページを見た',
    'Googleを見た', 'みずほ接骨院からの紹介', 'その他',
  ],
  visitTypes: ['初診', '2回目', '3回目', '既存'], // ④区分（初診=30分 / それ以外=15分）
  colorInitial: '#f4cccc', // 初診の淡い赤
  colorExisting: '#cfe2f3', // 既存の淡い青
};

const COLS_PER_BED = 5;
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
  const settings = ensureSettingsSheet_(ss);
  ensureWebSheet_(ss);
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
  const rows = dayRows_(day);          // [{label, brk}]
  const nRows = rows.length;
  const firstDataRow = 6;              // 見出し: 1=タイトル 2=ベッド 3=新規対応 4=施術者 5=小見出し
  const lastDataRow = firstDataRow + nRows - 1;

  // 行1: タイトル
  sh.getRange(1, 1, 1, totalCols).merge()
    .setValue(`${CONFIG.title}　${day.date}(${day.wd})`)
    .setFontWeight('bold').setFontSize(13)
    .setBackground('#1f6f43').setFontColor('#fff')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');

  // 行2: ベッド番号（各5列を結合）
  sh.getRange(2, 1).setValue('ベッド').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#e7f2ec');
  // 行3: 新規対応（チェックボックス）。A3は新規対応=TRUEベッド数のライブカウント。
  sh.getRange(3, 1).setFormula('=CONCATENATE("新規対応 ",COUNTIF(3:3,TRUE),"/' + nBeds + '")')
    .setFontWeight('bold').setFontColor('#1f6f43').setHorizontalAlignment('center').setBackground('#f0f0f0');
  // 行4: 施術者（ドロップダウン）
  sh.getRange(4, 1).setValue('施術者').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f0f0f0');
  // 行5: 小見出し
  sh.getRange(5, 1).setValue('時間').setFontWeight('bold').setHorizontalAlignment('center').setBackground('#f0f0f0');

  const staffRule = SpreadsheetApp.newDataValidation().requireValueInRange(staffRange, true).setAllowInvalid(true).build();
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    // ベッド番号
    sh.getRange(2, c, 1, COLS_PER_BED).merge().setValue('No.' + (i + 1))
      .setFontWeight('bold').setBackground('#e7f2ec').setHorizontalAlignment('center');
    // 新規対応チェック（先頭列にチェック、残りは薄グレー）
    sh.getRange(3, c).insertCheckboxes().setValue(true);
    sh.getRange(3, c, 1, COLS_PER_BED).setBackground('#fafafa').setHorizontalAlignment('center');
    sh.getRange(3, c).setBackground('#ffffff');
    // 施術者ドロップダウン（5列結合）
    const ther = sh.getRange(4, c, 1, COLS_PER_BED).merge().setDataValidation(staffRule).setHorizontalAlignment('center');
    if (CONFIG.therapistByBed[i]) ther.setValue(CONFIG.therapistByBed[i]);
    // 小見出し
    sh.getRange(5, c, 1, COLS_PER_BED).setValues([SUBHEAD])
      .setFontWeight('bold').setBackground('#f0f0f0').setHorizontalAlignment('center');
  }

  // 行6〜: 時間行 / 休憩行
  const channelRule = SpreadsheetApp.newDataValidation().requireValueInRange(channelRange, true).setAllowInvalid(true).build();
  const visitRule = SpreadsheetApp.newDataValidation().requireValueInRange(visitRange, true).setAllowInvalid(true).build();

  rows.forEach((row, ri) => {
    const r = firstDataRow + ri;
    if (row.brk) {
      sh.getRange(r, 1, 1, totalCols).setBackground('#eceff1');
      sh.getRange(r, 1).setValue(row.label).setFontColor('#888').setHorizontalAlignment('center');
      return;
    }
    sh.getRange(r, 1).setValue(row.label).setFontWeight('bold').setHorizontalAlignment('center').setBackground('#fafafa');
    for (let i = 0; i < nBeds; i++) {
      const c = 2 + i * COLS_PER_BED;
      sh.getRange(r, c + 2).setDataValidation(channelRule); // 集客きっかけ
      sh.getRange(r, c + 3).setDataValidation(visitRule);   // 区分
      sh.getRange(r, c + 4).insertCheckboxes();             // 来院
    }
  });

  // 区分による自動色分け（初診=淡い赤 / 既存=淡い青）。各ベッドの5列に対して。
  const cfRules = sh.getConditionalFormatRules();
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    const visitCol = columnLetter_(c + 3);
    const range = sh.getRange(firstDataRow, c, nRows, COLS_PER_BED);
    cfRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${visitCol}${firstDataRow}="初診"`)
      .setBackground(CONFIG.colorInitial).setRanges([range]).build());
    cfRules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${visitCol}${firstDataRow}="既存"`)
      .setBackground(CONFIG.colorExisting).setRanges([range]).build());
  }
  sh.setConditionalFormatRules(cfRules);

  // 罫線・固定・列幅
  sh.getRange(2, 1, lastDataRow - 1, totalCols)
    .setBorder(true, true, true, true, true, true, '#cfcfcf', SpreadsheetApp.BorderStyle.SOLID);
  sh.setFrozenRows(5);
  sh.setFrozenColumns(1);
  sh.setColumnWidth(1, 58);
  for (let i = 0; i < nBeds; i++) {
    const c = 2 + i * COLS_PER_BED;
    sh.setColumnWidth(c, 88);       // 氏名
    sh.setColumnWidth(c + 1, 104);  // 連絡先
    sh.setColumnWidth(c + 2, 128);  // 集客きっかけ
    sh.setColumnWidth(c + 3, 64);   // 区分
    sh.setColumnWidth(c + 4, 42);   // 来院
  }

  // 使い方メモ
  sh.getRange(lastDataRow + 2, 1, 1, Math.min(totalCols, 12)).merge().setValue(
    '【使い方】A列=時間(15分)。1ベッド=5列(氏名/連絡先/集客きっかけ/区分/来院)。' +
    '初診=30分は該当ベッドの縦2行を選択して「セルを結合」して入力。2回目/3回目/既存=15分(1行)。' +
    '各ベッドの「新規対応」☑を外すと新規受付なし(休憩・不在のブロックにも使用)。区分=初診→淡い赤/既存→淡い青。'
  ).setFontColor('#555').setWrap(true);
}

/* ------- その日の行（時間 + 休憩）を作る ------- */
function dayRows_(day) {
  const rows = [];
  day.hours.forEach((blk, bi) => {
    if (bi > 0) rows.push({ label: '昼休憩', brk: true }); // ブロック間に休憩行
    const open = toMin_(blk[0]), close = toMin_(blk[1]);
    for (let t = open; t <= close; t += CONFIG.stepMin) rows.push({ label: fromMin_(t), brk: false }); // 最終時間も含む
  });
  return rows;
}

/* ===================== 設定 / Web予約 タブ ===================== */
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
    if (keep.indexOf(n) < 0 && /(月.*日|体験者一覧)/.test(n) && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/* =========================== ユーティリティ =========================== */
function toMin_(s) { const m = String(s).replace('：', ':').match(/(\d{1,2}):(\d{2})/); return m ? +m[1] * 60 + +m[2] : 0; }
function fromMin_(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function columnLetter_(col) { let s = ''; while (col > 0) { const r = (col - 1) % 26; s = String.fromCharCode(65 + r) + s; col = (col - r - 1) / 26; } return s; }
