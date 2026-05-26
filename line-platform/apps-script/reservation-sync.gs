/**
 * 予約連携 Apps Script（v2）
 * ─────────────────────────────────────────────
 * 「問い合わせ一覧」で 確定日 → 確定時間 → ベッド番号 を順にプルダウン選択すると、
 * 当日タブ（"M/D" で始まるシート）にお客様情報を自動転記する。
 *
 *  - 確定日   : 当日タブの日付からプルダウン選択
 *  - 確定時間 : その日の時間枠からプルダウン選択
 *  - ベッド番号: 空きベッドだけがプルダウンに出る
 *  - 変更も可（選び直すと、前の転記を消して新しい場所へ書き直す）
 *  - 転記内容：名前=時間行 / 電話=その下 / きっかけ=名前の右（新規のみ）
 *  - 新規(30分)は次の15分枠の「名前・電話・きっかけ」セルに斜め線（濃い黒）
 *
 * 【セットアップ】
 *  拡張機能 → Apps Script に貼り付けて保存 →
 *  スプレッドシートに戻って メニュー「予約連携」→「初期設定」
 */

// ===== 設定 =====
var INQUIRY_SHEET = '問い合わせ一覧';
var C = {
  受付日時: 1, 区分: 2, メニュー: 3,
  第1希望: 4, 第2希望: 5, 第3希望: 6,
  名前: 7, 電話: 8, きっかけ: 9,
  userId: 10, ステータス: 11,
  確定日: 12, 確定時間: 13, ベッド番号: 14,
  _転記先: 15, // 自動管理（変更検知用・非表示）
};
var DAILY_NAME_ROW = 6; // 当日タブ：施術者名の行
var DAILY_NEW_ROW  = 5; // 当日タブ：新規対応(TRUE/FALSE)の行
var MAX_BEDS = 8;
var DIAG = '=SPARKLINE({1,0},{"charttype","line";"color","#000000";"linewidth",1})';

// ===== LINE 送信（アプリ経由）設定 =====
var APP_URL = 'https://line-platform-skip.vercel.app'; // 本番URL
var CHANNEL_ID = 'cmp6adwyo0000mor0liuxc7ab';          // 接骨院チャネルID
var NEW_DURATION = 30, RETURN_DURATION = 15;            // 所要分（表示用）

function getPushSecret_() {
  return PropertiesService.getDocumentProperties().getProperty('PUSH_SECRET') || '';
}

// メニュー「送信用の合言葉を設定」
function setPushSecret() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('LINE送信の合言葉（CRON_SECRET）を貼り付けてください', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getDocumentProperties().setProperty('PUSH_SECRET', res.getResponseText().trim());
  ui.alert('保存しました。');
}

// メニュー「選択行に確認メッセージを送信」
function sendConfirmation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getActiveSheet();
  if (sh.getName() !== INQUIRY_SHEET) { ss.toast('問い合わせ一覧シートで実行してください', '予約連携', 6); return; }
  var row = sh.getActiveRange().getRow();
  if (row < 2) { ss.toast('お客様の行を選択してください', '予約連携', 6); return; }

  var secret = getPushSecret_();
  if (!secret) { SpreadsheetApp.getUi().alert('先にメニュー「送信用の合言葉を設定」を実行してください。'); return; }

  var userId  = String(sh.getRange(row, C.userId).getValue() || '').trim();
  var name    = String(sh.getRange(row, C.名前).getValue() || '').trim();
  var kubun   = String(sh.getRange(row, C.区分).getValue() || '');
  var dateStr = sh.getRange(row, C.確定日).getDisplayValue();
  var timeStr = sh.getRange(row, C.確定時間).getDisplayValue();
  if (!userId) { ss.toast('この行に LINE userId がありません（LINE経由の予約のみ送信可）', '予約連携', 7); return; }
  if (!dateStr || !timeStr) { ss.toast('確定日・確定時間を先に入力してください', '予約連携', 7); return; }

  var isNew = kubun.indexOf('新規') >= 0;
  var dur = isNew ? NEW_DURATION : RETURN_DURATION;
  var msg = name + '様\n'
    + 'ご予約ありがとうございます。\n'
    + '下記の日時で確定いたしました。\n\n'
    + '日時: ' + dateStr + ' ' + timeStr + '\n'
    + 'メニュー: ' + (isNew ? '新規' : '2回目以降') + '（' + dur + '分）\n\n'
    + '当日お待ちしております。';

  try {
    var resp = UrlFetchApp.fetch(APP_URL + '/api/integrations/line-push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + secret },
      payload: JSON.stringify({ channelId: CHANNEL_ID, lineUserId: userId, message: msg }),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    if (code === 200) {
      ss.toast(name + ' さんに確認メッセージを送信しました', '予約連携', 6);
    } else {
      ss.toast('送信失敗 (' + code + '): ' + resp.getContentText().slice(0, 120), '予約連携', 9);
    }
  } catch (err) {
    ss.toast('送信エラー: ' + err.message, '予約連携', 9);
  }
}

function bedNameCol(n) { return 2 + (n - 1) * 3; } // B,E,H,...

// ===== メニュー =====
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('予約連携')
    .addItem('初期設定（列・プルダウン）', 'setupInquiry')
    .addItem('確定日リストを更新', 'refreshDateDropdown')
    .addSeparator()
    .addItem('選択行に確認メッセージを送信', 'sendConfirmation')
    .addItem('送信用の合言葉を設定', 'setPushSecret')
    .addToUi();
  try { refreshDateDropdown(); } catch (e) {}
}

function setupInquiry() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INQUIRY_SHEET);
  if (!sh) { SpreadsheetApp.getUi().alert('「' + INQUIRY_SHEET + '」シートが見つかりません'); return; }
  sh.getRange(1, C.確定日).setValue('確定日');
  sh.getRange(1, C.確定時間).setValue('確定時間');
  sh.getRange(1, C.ベッド番号).setValue('ベッド番号');
  sh.getRange(1, C._転記先).setValue('_転記先(自動)');
  sh.hideColumns(C._転記先); // 管理用列は隠す
  refreshDateDropdown();
  SpreadsheetApp.getUi().alert('初期設定が完了しました。\n確定日・確定時間・ベッド番号 を順に選択してください。');
}

// 確定日プルダウンを当日タブの日付で更新
function refreshDateDropdown() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(INQUIRY_SHEET);
  if (!sh) return;
  var dates = listDailyDates();
  var last = Math.max(sh.getLastRow(), 2);
  var range = sh.getRange(2, C.確定日, last - 1 + 100, 1); // 余裕を持って下まで
  if (dates.length) {
    range.setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(dates, true).build()
    );
  }
}

// ===== 編集トリガー =====
function onEdit(e) {
  try {
    var sh = e.range.getSheet();
    if (sh.getName() !== INQUIRY_SHEET) return;
    var row = e.range.getRow();
    var col = e.range.getColumn();
    if (row < 2) return;

    var dateVal = sh.getRange(row, C.確定日).getValue();
    var timeStr = sh.getRange(row, C.確定時間).getDisplayValue();
    var kubun   = sh.getRange(row, C.区分).getValue();

    // 確定日 を選択 → 確定時間プルダウンをセット（下流をクリア）
    if (col === C.確定日) {
      var times = listTimesForDate(dateVal, kubun);
      var tCell = sh.getRange(row, C.確定時間);
      tCell.clearContent();
      if (times.length) {
        tCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(times, true).build());
      } else {
        tCell.clearDataValidations();
      }
      sh.getRange(row, C.ベッド番号).clearContent().clearDataValidations();
      e.source.toast(times.length ? 'この日の時間を選んでください' : 'この日の当日タブが見つかりません', '予約連携', 4);
      return;
    }

    // 確定時間 を選択 → ベッド番号プルダウン（空きベッド）をセット
    if (col === C.確定時間) {
      var bCell = sh.getRange(row, C.ベッド番号);
      bCell.clearContent();
      if (dateVal && timeStr) {
        var beds = availableBeds(dateVal, timeStr, kubun);
        if (beds.length) {
          bCell.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(beds.map(String), true).build());
          e.source.toast('空きベッド: ' + beds.join(', '), '予約連携', 5);
        } else {
          bCell.clearDataValidations();
          e.source.toast('この日時に空きベッドがありません', '予約連携', 5);
        }
      }
      return;
    }

    // ベッド番号 を選択 → 転記（前の転記があれば消してから）
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

// 当日タブ（M/D で始まる）の一覧 → ["5/26","5/27",...]
function listDailyDates() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var out = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().trim();
    var m = name.match(/^(\d{1,2})\/(\d{1,2})/);
    if (m) {
      var label = m[1] + '/' + m[2];
      if (out.indexOf(label) < 0) out.push(label);
    }
  }
  return out;
}

function findDailyTab(dateVal) {
  var md = toMD(dateVal);
  if (!md) return null;
  var cands = [
    md[0] + '/' + md[1],
    md[0] + '/' + ('0' + md[1]).slice(-2),
    ('0' + md[0]).slice(-2) + '/' + ('0' + md[1]).slice(-2),
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

function listTimesForDate(dateVal, kubun) {
  var tab = findDailyTab(dateVal);
  if (!tab) return [];
  var isNew = String(kubun || '').indexOf('新規') >= 0;
  var last = tab.getLastRow();
  var vals = tab.getRange(1, 1, last, 1).getDisplayValues();
  var times = [];
  for (var r = DAILY_NAME_ROW; r < vals.length; r++) {
    var t = normalizeTime(vals[r][0]);
    if (!/^\d{1,2}:\d{2}$/.test(t)) continue;
    if (isNew) {
      var mm = parseInt(t.split(':')[1], 10);
      if (mm % 30 !== 0) continue; // 新規は :00 / :30 のみ
    }
    times.push(t);
  }
  return times;
}

function findTimeRow(tab, timeStr) {
  var last = tab.getLastRow();
  var vals = tab.getRange(1, 1, last, 1).getDisplayValues();
  var target = normalizeTime(timeStr);
  for (var r = DAILY_NAME_ROW; r < vals.length; r++) {
    if (normalizeTime(vals[r][0]) === target) return r + 1;
  }
  return -1;
}

function nextTimeRow(tab, timeRow) {
  var last = tab.getLastRow();
  var vals = tab.getRange(1, 1, last, 1).getDisplayValues();
  for (var r = timeRow; r < vals.length; r++) {
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
    if (!String(nameRow[col - 1] || '').trim()) continue;
    if (isNew && String(newRow[col - 1] || '').trim().toUpperCase() !== 'TRUE') continue;
    if (String(tab.getRange(timeRow, col).getValue() || '').trim()) continue;
    if (isNew) {
      var nr = nextTimeRow(tab, timeRow);
      if (nr < 0 || String(tab.getRange(nr, col).getValue() || '').trim()) continue;
    }
    beds.push(n);
  }
  return beds;
}

function clearPlacement(token) {
  var p = String(token).split('|');
  if (p.length < 3) return;
  var tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(p[0]);
  if (!tab) return;
  var timeRow = +p[1], col = +p[2], isNew = p[3] === '1', slot2 = +p[4];
  tab.getRange(timeRow, col).clearContent();
  tab.getRange(timeRow + 1, col).clearContent();
  tab.getRange(timeRow, col + 1).clearContent();
  if (isNew && slot2) {
    tab.getRange(slot2, col).clearContent();
    tab.getRange(slot2 + 1, col).clearContent();
    tab.getRange(slot2, col + 1).clearContent();
    tab.getRange(slot2 + 1, col + 1).clearContent();
  }
}

function transfer(sh, row, dateVal, timeStr, bed) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tab = findDailyTab(dateVal);
  if (!tab) { ss.toast('当日タブが見つかりません', '予約連携', 8); return; }
  var timeRow = findTimeRow(tab, timeStr);
  if (timeRow < 0) { ss.toast('時間が見つかりません: ' + timeStr, '予約連携', 8); return; }

  // 前回の転記を消す（変更対応）
  var prev = sh.getRange(row, C._転記先).getValue();
  if (prev) clearPlacement(prev);

  var col = bedNameCol(bed);
  var name    = sh.getRange(row, C.名前).getValue();
  var phone   = sh.getRange(row, C.電話).getValue();
  var kikkake = sh.getRange(row, C.きっかけ).getValue();
  var isNew   = String(sh.getRange(row, C.区分).getValue()).indexOf('新規') >= 0;

  tab.getRange(timeRow, col).setValue(name);        // 名前
  tab.getRange(timeRow + 1, col).setValue(phone);   // 電話（名前の下）
  if (isNew && kikkake) tab.getRange(timeRow, col + 1).setValue(kikkake); // きっかけ（新規のみ）

  var slot2 = '';
  if (isNew) { // 次の15分枠：名前・電話・きっかけ欄に斜め線（濃い黒）
    var nr = nextTimeRow(tab, timeRow);
    if (nr > 0) {
      tab.getRange(nr, col).setFormula(DIAG);
      tab.getRange(nr + 1, col).setFormula(DIAG);
      tab.getRange(nr, col + 1).setFormula(DIAG);
      tab.getRange(nr + 1, col + 1).setFormula(DIAG);
      slot2 = nr;
    }
  }

  // 転記先を記録（変更時に消すため）
  sh.getRange(row, C._転記先).setValue(tab.getName() + '|' + timeRow + '|' + col + '|' + (isNew ? 1 : 0) + '|' + slot2);
  sh.getRange(row, C.ステータス).setValue('対応済');
  ss.toast(name + ' を ' + tab.getName() + ' ' + timeStr + ' ベッド' + bed + ' に転記しました', '予約連携', 6);
}
