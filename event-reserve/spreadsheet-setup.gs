/**
 * 接骨院 出店イベント 予約空き状況スプレッドシート ひな型ビルダー
 * ------------------------------------------------------------------
 * 使い方：
 *   1. Google スプレッドシートを新規作成
 *   2. 拡張機能 → Apps Script を開く
 *   3. このファイルの中身を丸ごと貼り付けて保存
 *   4. メニュー「▶ 予約シート」→「① 初期セットアップ」を実行
 *      （初回だけ権限の許可を求められます）
 *   5. 設定シートに開催日・先生を入力したら
 *      「② 空き枠を再生成」を実行
 *
 * 前提（ヒアリング確定）：
 *   - 開催は複数日
 *   - 空き状況(〇△×)は先生数から自動算出
 *   - 1枠＝先生1人につきお客様1人
 */

const SHEETS = {
  SETTINGS: '設定',
  THERAPISTS: '先生マスタ',
  SLOTS: '空き状況',
  RESERVATIONS: '予約受付',
};

const COLORS = {
  header: '#1a1a1a',
  headerText: '#ffffff',
  accent: '#bfa572',
  cream: '#faf7f0',
};

/** スプレッドシートを開いたときにメニューを追加 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('▶ 予約シート')
    .addItem('① 初期セットアップ', 'setupAll')
    .addItem('② 空き枠を再生成', 'regenerateSlots')
    .addToUi();
}

/** ① 4シートを作成して初期化 */
function setupAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  buildSettings_(ss);
  buildTherapists_(ss);
  buildReservations_(ss);
  buildSlots_(ss);
  // デフォルトの「シート1」が残っていれば削除
  const def = ss.getSheetByName('シート1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheetByName(SHEETS.SETTINGS));
  SpreadsheetApp.getUi().alert(
    'セットアップ完了。\n\n①「設定」に開催日・受付時間を入力\n②「先生マスタ」に先生と勤務時間を入力（新規対応可にチェック）\n③ メニュー「② 空き枠を再生成」を実行してください。'
  );
}

/** シートを取得（無ければ作成）して中身をクリア */
function freshSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.clearConditionalFormatRules();
  return sh;
}

function styleHeader_(range) {
  range
    .setBackground(COLORS.header)
    .setFontColor(COLORS.headerText)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/* ====================== ① 設定シート ====================== */
function buildSettings_(ss) {
  const sh = freshSheet_(ss, SHEETS.SETTINGS);
  const rows = [
    ['項目', '値', '', '開催日リスト'],
    ['イベント名', '○○マルシェ出店', '', '2026/06/20'],
    ['会場・住所', '○○公園 特設ブース', '', '2026/06/21'],
    ['受付開始時間', '9:00', '', ''],
    ['受付終了時間', '15:00', '', '← この列に開催日を縦に追加'],
    ['1枠の長さ(分)', 15, '', ''],
    ['△にする残り枠(以下)', 1, '', ''],
    ['公式LINE URL', 'https://lin.ee/xxxxxxx', '', ''],
    ['問い合わせ電話', '055-000-0000', '', ''],
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  styleHeader_(sh.getRange(1, 1, 1, 2));
  styleHeader_(sh.getRange(1, 4, 1, 1));

  // 時間セルの書式
  sh.getRange('B4:B5').setNumberFormat('h:mm');
  sh.getRange('D2:D200').setNumberFormat('yyyy/mm/dd');

  // 名前付き範囲（数式から参照する設定値）
  setNamedCell_(ss, sh, 'CFG_START', 'B4');   // 受付開始
  setNamedCell_(ss, sh, 'CFG_END', 'B5');     // 受付終了
  setNamedCell_(ss, sh, 'CFG_STEP', 'B6');    // 1枠の長さ(分)
  setNamedCell_(ss, sh, 'CFG_THRESHOLD', 'B7'); // △閾値
  ss.setNamedRange('CFG_DATES', sh.getRange('D2:D200')); // 開催日リスト

  sh.setColumnWidth(1, 160);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(4, 180);
  sh.getRange('A1:D1').setBorder(true, true, true, true, true, true);
}

function setNamedCell_(ss, sh, name, a1) {
  ss.setNamedRange(name, sh.getRange(a1));
}

/* ====================== ② 先生マスタ ====================== */
function buildTherapists_(ss) {
  const sh = freshSheet_(ss, SHEETS.THERAPISTS);
  const header = ['先生名', '新規対応可', '勤務日', '勤務開始', '勤務終了', '備考'];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  styleHeader_(sh.getRange(1, 1, 1, header.length));

  // サンプル行（先生×日 で1行）
  const sample = [
    ['山田', true, '2026/06/20', '9:00', '15:00', ''],
    ['鈴木', true, '2026/06/20', '9:00', '13:00', '午前中心'],
    ['佐藤', false, '2026/06/20', '13:00', '15:00', '新規は不可'],
    ['山田', true, '2026/06/21', '9:00', '15:00', ''],
  ];
  sh.getRange(2, 1, sample.length, header.length).setValues(sample);

  // 新規対応可 列をチェックボックスに
  sh.getRange('B2:B500').insertCheckboxes();
  // 日付・時刻の書式
  sh.getRange('C2:C500').setNumberFormat('yyyy/mm/dd');
  sh.getRange('D2:E500').setNumberFormat('h:mm');

  [120, 90, 110, 90, 90, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(1);
}

/* ====================== ③ 予約受付 ====================== */
function buildReservations_(ss) {
  const sh = freshSheet_(ss, SHEETS.RESERVATIONS);
  const header = [
    '受付日時', 'お名前', '連絡先', '新規/再来',
    '第1希望 日', '第1希望 時間', '第2希望 日', '第2希望 時間',
    '確定 日', '確定 時間', '担当先生', '状態',
  ];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  styleHeader_(sh.getRange(1, 1, 1, header.length));

  // 状態のプルダウン
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['仮受付', '確定', 'キャンセル'], true)
    .build();
  sh.getRange('L2:L1000').setDataValidation(statusRule);

  // 新規/再来のプルダウン
  const visitRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['新規', '再来'], true)
    .build();
  sh.getRange('D2:D1000').setDataValidation(visitRule);

  // 書式
  sh.getRange('E2:E1000').setNumberFormat('yyyy/mm/dd'); // 第1希望日
  sh.getRange('G2:G1000').setNumberFormat('yyyy/mm/dd'); // 第2希望日
  sh.getRange('I2:I1000').setNumberFormat('yyyy/mm/dd'); // 確定日
  sh.getRange('F2:F1000').setNumberFormat('h:mm');
  sh.getRange('H2:H1000').setNumberFormat('h:mm');
  sh.getRange('J2:J1000').setNumberFormat('h:mm');

  sh.setFrozenRows(1);
  sh.autoResizeColumns(1, header.length);
}

/* ====================== ④ 空き状況（メイン） ====================== */
function buildSlots_(ss) {
  const sh = freshSheet_(ss, SHEETS.SLOTS);
  const header = ['日付', '時間', '対応可能枠', '予約済み', '残り枠', 'ステータス'];
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  styleHeader_(sh.getRange(1, 1, 1, header.length));
  sh.setFrozenRows(1);
  [110, 80, 110, 90, 80, 100].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  regenerateSlots(); // 初回は設定のサンプル日付で生成
}

/**
 * ② 空き枠を再生成
 * 設定の開催日リスト × 受付時間 から行を作り直し、各列に自動計算式を入れる。
 */
function regenerateSlots() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEETS.SLOTS);
  const cfg = ss.getSheetByName(SHEETS.SETTINGS);
  if (!sh || !cfg) {
    SpreadsheetApp.getUi().alert('先に「① 初期セットアップ」を実行してください。');
    return;
  }

  // 設定値を取得
  const start = cfg.getRange('B4').getValue(); // Date(時刻)
  const end = cfg.getRange('B5').getValue();
  const stepMin = Number(cfg.getRange('B6').getValue()) || 15;
  const dates = cfg.getRange('D2:D200').getValues()
    .map((r) => r[0])
    .filter((v) => v instanceof Date);

  if (!dates.length) {
    SpreadsheetApp.getUi().alert('「設定」シートの「開催日リスト」(D列) に開催日を入力してください。');
    return;
  }

  const startMin = toMinutes_(start);
  const endMin = toMinutes_(end);
  if (!(endMin > startMin)) {
    SpreadsheetApp.getUi().alert('受付終了時間は開始時間より後にしてください。');
    return;
  }

  // 既存データ行をクリア（ヘッダーは残す）
  if (sh.getMaxRows() > 1) sh.getRange(2, 1, sh.getMaxRows() - 1, 6).clearContent();

  // 行データ生成（日付 × 時間）
  const rows = [];
  dates.forEach((d) => {
    const dateStr = Utilities.formatDate(d, ss.getSpreadsheetTimeZone(), 'yyyy/MM/dd');
    for (let m = startMin; m < endMin; m += stepMin) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      rows.push([dateStr, timeValue_(h, mm)]);
    }
  });

  if (!rows.length) return;
  sh.getRange(2, 1, rows.length, 2).setValues(rows);
  sh.getRange(2, 1, rows.length, 1).setNumberFormat('yyyy/mm/dd');
  sh.getRange(2, 2, rows.length, 1).setNumberFormat('h:mm');

  // 自動計算式を一括投入
  const T = SHEETS.THERAPISTS;
  const R = SHEETS.RESERVATIONS;
  const formulas = [];
  for (let i = 0; i < rows.length; i++) {
    const r = i + 2;
    // 対応可能枠：その日・その時刻に勤務中で「新規対応可」にチェックの先生数
    const cap =
      `=COUNTIFS('${T}'!$B:$B,TRUE,'${T}'!$C:$C,$A${r},` +
      `'${T}'!$D:$D,"<="&$B${r},'${T}'!$E:$E,">"&$B${r})`;
    // 予約済み：確定枠が一致しキャンセル以外
    const booked =
      `=COUNTIFS('${R}'!$I:$I,$A${r},'${R}'!$J:$J,$B${r},'${R}'!$L:$L,"<>キャンセル")`;
    // 残り枠
    const remain = `=C${r}-D${r}`;
    // ステータス（〇△×）
    const status =
      `=IF($A${r}="","",IF(C${r}<=0,"×",IF(E${r}<=0,"×",` +
      `IF(E${r}<=CFG_THRESHOLD,"△","〇"))))`;
    formulas.push([cap, booked, remain, status]);
  }
  sh.getRange(2, 3, formulas.length, 4).setFormulas(formulas);

  // ステータス列の色分け
  applySlotColors_(sh, rows.length);

  SpreadsheetApp.getUi().alert(`空き枠を再生成しました（${rows.length} 枠）。`);
}

/** ステータス列(F)の条件付き書式 */
function applySlotColors_(sh, n) {
  sh.clearConditionalFormatRules();
  const range = sh.getRange(2, 6, Math.max(n, 1), 1);
  const rule = (text, bg, fg) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(text)
      .setBackground(bg)
      .setFontColor(fg)
      .setRanges([range])
      .build();
  sh.setConditionalFormatRules([
    rule('〇', '#e7f6e9', '#1b7a3d'),
    rule('△', '#fff6e0', '#9c6b00'),
    rule('×', '#fbe7e7', '#b33636'),
  ]);
  range.setHorizontalAlignment('center').setFontWeight('bold');
}

/* ====================== ユーティリティ ====================== */
/** Date(時刻) → 0:00からの分。数値や文字列にも一応対応 */
function toMinutes_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number') return Math.round(v * 24 * 60); // シリアル値
  const m = String(v).match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** h:mm をスプレッドシートの時刻シリアル値(0〜1)に */
function timeValue_(h, m) {
  return (h * 60 + m) / (24 * 60);
}
