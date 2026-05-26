/**
 * 予約連携 Apps Script
 * ─────────────────────────────────────────────
 * 「問い合わせ一覧」シートで、確定日・確定時間・ベッド番号を入力すると、
 * 当日タブ（"M/D" で始まるシート）にお客様情報を自動転記する。
 *
 *  - 確定日 / 確定時間 を入れると → ベッド番号のプルダウンに「空きベッド」だけが出る
 *  - ベッド番号を選ぶと → 当日タブに転記
 *      名前  : 時間行のセル
 *      電話  : その下のセル（名前の下）
 *      きっかけ: 名前の右隣（新規のみ）
 *      新規(30分)の場合 → 次の15分枠に斜め線（SPARKLINE）
 *
 * 【セットアップ】
 *  1. スプレッドシートを開く → 拡張機能 → Apps Script
 *  2. このコードを全て貼り付けて保存
 *  3. スプレッドシートに戻り、メニュー「予約連携」→「初期設定」を実行
 *     （確定日 / 確定時間 / ベッド番号 の列見出しを追加）
 *  4. あとは問い合わせ一覧で 確定日→確定時間→ベッド番号 の順に入力するだけ
 */

// ===== 設定（必要なら変更）=====
var INQUIRY_SHEET = '問い合わせ一覧';
var C = {
  受付日時: 1, 区分: 2, メニュー: 3,
  第1希望: 4, 第2希望: 5, 第3希望: 6,
  名前: 7, 電話: 8, きっかけ: 9,
  userId: 10, ステータス: 11,
  確定日: 12, 確定時間: 13, ベッド番号: 14,
};
var DAILY_NAME_ROW = 6; // 当日タブ：施術者名の行
var DAILY_NEW_ROW  = 5; // 当日タブ：新規対応(TRUE/FALSE)の行
var MAX_BEDS = 8;       // 施術者(ベッド)の最大数

// 施術者 n（1始まり）の「名前列」（1始まりの列番号）。B=2, E=5, H=8 ...（3列ごと）
function bedNameCol(n) { return 2 + (n - 1) * 3; }

// ===== メニュー =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('予約連携')
    .addItem('初期設定（列見出しを追加）', 'setupInquiry')
    .addToUi();
}

function setupInquiry() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INQUIRY_SHEET);
  if (!sh) { SpreadsheetApp.getUi().alert('「' + INQUIRY_SHEET + '」シートが見つかりません'); return; }
  sh.getRange(1, C.確定日).setValue('確定日');
  sh.getRange(1, C.確定時間).setValue('確定時間');
  sh.getRange(1, C.ベッド番号).setValue('ベッド番号');
  // 確定日 は日付、確定時間 は文字でOK。ベッド番号は入力時に空き候補を出す。
  SpreadsheetApp.getUi().alert('初期設定が完了しました。\n確定日 / 確定時間 / ベッド番号 の列を追加しました。');
}

// ===== 編集トリガー =====
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== INQUIRY_SHEET) return;
    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row < 2) return;
    if (col !== C.確定日 && col !== C.確定時間 && col !== C.ベッド番号) return;

    var dateVal = sh.getRange(row, C.確定日).getValue();
    var timeStr = sh.getRange(row, C.確定時間).getDisplayValue();
    var kubun   = sh.getRange(row, C.区分).getValue();

    // 確定日 or 確定時間 を編集 → 空きベッドをプルダウンにセット
    if (col === C.確定日 || col === C.確定時間) {
      if (dateVal && timeStr) {
        var beds = availableBeds(dateVal, timeStr, kubun);
        var cell = sh.getRange(row, C.ベッド番号);
        if (beds.length) {
          var rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(beds.map(String), true).build();
          cell.setDataValidation(rule);
          e.source.toast('空きベッド: ' + beds.join(', '), '予約連携', 5);
        } else {
          cell.clearDataValidations();
          e.source.toast('この日時に空きベッドがありません', '予約連携', 5);
        }
      }
      return;
    }

    // ベッド番号 を入力 → 当日タブへ転記
    if (col === C.ベッド番号) {
      var bed = parseInt(sh.getRange(row, C.ベッド番号).getValue(), 10);
      if (!bed || !dateVal || !timeStr) return;
      transfer(sh, row, dateVal, timeStr, bed);
    }
  } catch (err) {
    try { e.source.toast('エラー: ' + err.message, '予約連携', 8); } catch (_) {}
  }
}

// ===== ヘルパー =====
function toMD(dateVal) {
  if (dateVal instanceof Date) return [dateVal.getMonth() + 1, dateVal.getDate()];
  var s = String(dateVal).trim();
  var m = s.match(/(\d{1,2})\/(\d{1,2})/);
  if (m) return [parseInt(m[1], 10), parseInt(m[2], 10)];
  var d = new Date(s);
  if (!isNaN(d.getTime())) return [d.getMonth() + 1, d.getDate()];
  return null;
}

function findDailyTab(dateVal) {
  var md = toMD(dateVal);
  if (!md) return null;
  var m = md[0], day = md[1];
  var cands = [
    m + '/' + day,
    m + '/' + ('0' + day).slice(-2),
    ('0' + m).slice(-2) + '/' + ('0' + day).slice(-2),
  ];
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim();
    for (var j = 0; j < cands.length; j++) {
      if (name.indexOf(cands[j]) === 0) {
        var after = name.charAt(cands[j].length);
        if (after === '' || !/\d/.test(after)) return sheets[i];
      }
    }
  }
  return null;
}

function normalizeTime(s) {
  s = String(s || '').trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  return m ? (parseInt(m[1], 10) + ':' + m[2]) : s;
}

// 当日タブで指定時刻の行（1始まり）を返す
function findTimeRow(tab, timeStr) {
  var last = tab.getLastRow();
  var vals = tab.getRange(1, 1, last, 1).getDisplayValues();
  var target = normalizeTime(timeStr);
  for (var r = DAILY_NAME_ROW; r < vals.length; r++) {
    if (normalizeTime(vals[r][0]) === target) return r + 1;
  }
  return -1;
}

// 指定行の「次の時間枠」の行（1始まり）を返す
function nextTimeRow(tab, timeRow) {
  var last = tab.getLastRow();
  var vals = tab.getRange(1, 1, last, 1).getDisplayValues();
  for (var r = timeRow; r < vals.length; r++) { // r=timeRow(0始まり) → 1始まりでは timeRow+1（現在枠の次の行）から
    if (/^\d{1,2}:\d{2}$/.test(normalizeTime(vals[r][0]))) return r + 1;
  }
  return -1;
}

function availableBeds(dateVal, timeStr, kubun) {
  var tab = findDailyTab(dateVal);
  if (!tab) return [];
  var timeRow = findTimeRow(tab, timeStr);
  if (timeRow < 0) return [];
  var isNew = String(kubun).indexOf('新規') >= 0;
  var width = bedNameCol(MAX_BEDS) + 2;
  var nameRow = tab.getRange(DAILY_NAME_ROW, 1, 1, width).getValues()[0];
  var newRow  = tab.getRange(DAILY_NEW_ROW, 1, 1, width).getValues()[0];
  var beds = [];
  for (var n = 1; n <= MAX_BEDS; n++) {
    var col = bedNameCol(n);
    if (!String(nameRow[col - 1] || '').trim()) continue; // 非稼働
    if (isNew && String(newRow[col - 1] || '').trim().toUpperCase() !== 'TRUE') continue;
    if (String(tab.getRange(timeRow, col).getValue() || '').trim()) continue; // 当該枠 埋まり
    if (isNew) {
      var nr = nextTimeRow(tab, timeRow);
      if (nr < 0 || String(tab.getRange(nr, col).getValue() || '').trim()) continue; // 次枠 埋まり
    }
    beds.push(n);
  }
  return beds;
}

function transfer(sh, row, dateVal, timeStr, bed) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tab = findDailyTab(dateVal);
  if (!tab) { ss.toast('当日タブが見つかりません', '予約連携', 8); return; }
  var timeRow = findTimeRow(tab, timeStr);
  if (timeRow < 0) { ss.toast('時間が見つかりません: ' + timeStr, '予約連携', 8); return; }

  var col = bedNameCol(bed);
  var name    = sh.getRange(row, C.名前).getValue();
  var phone   = sh.getRange(row, C.電話).getValue();
  var kikkake = sh.getRange(row, C.きっかけ).getValue();
  var isNew   = String(sh.getRange(row, C.区分).getValue()).indexOf('新規') >= 0;

  tab.getRange(timeRow, col).setValue(name);          // 名前
  tab.getRange(timeRow + 1, col).setValue(phone);     // 電話（名前の下）
  if (isNew && kikkake) tab.getRange(timeRow, col + 1).setValue(kikkake); // きっかけ（新規のみ）

  if (isNew) { // 次の15分枠に斜め線（SPARKLINE）
    var nr = nextTimeRow(tab, timeRow);
    if (nr > 0) {
      tab.getRange(nr, col).setFormula('=SPARKLINE({1,0},{"charttype","line";"color","#999999";"linewidth",1})');
    }
  }

  sh.getRange(row, C.ステータス).setValue('対応済');
  ss.toast(name + ' を ' + tab.getName() + ' ' + timeStr + ' ベッド' + bed + ' に転記しました', '予約連携', 6);
}
