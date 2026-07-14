/**
 * 予約ログ受信エンドポイント（Google Apps Script ウェブアプリ）
 *
 * 役割: 予約サイト（静的ページ）から送られた予約内容を、
 *       スプレッドシートの「Web予約」タブに1行ずつ追記して残します。
 *       ※ 予約サイト本体はこれまで通り静的ページのまま。これは「記録用の受け皿」だけです。
 *
 * 導入:
 *  1) 予約表スプレッドシートを開く →「拡張機能 → Apps Script」
 *  2) このファイルの内容を貼り付けて保存
 *  3)「デプロイ → 新しいデプロイ → ウェブアプリ」
 *       実行するユーザー: 自分 ／ アクセスできるユーザー: 全員
 *     → デプロイして「ウェブアプリのURL」をコピー
 *  4) 予約サイト（reservation.html）の CONFIG.logUrl にそのURLを貼り付け
 */

const SS_ID = '15an8h-Z4SeRlXKB1kceugg2hdX6tAjPUrori76pxpNQ'; // 予約表スプレッドシートのID
const LOG_SHEET = 'Web予約';

function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { data = (e && e.parameter) || {}; }
  return append_(data);
}

// 予備（クエリ付きGETでも受け付け）
function doGet(e) {
  return append_((e && e.parameter) || {});
}

function append_(d) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) {}
  try {
    var ss = SpreadsheetApp.openById(SS_ID);
    var sh = ss.getSheetByName(LOG_SHEET);
    if (!sh) {
      sh = ss.insertSheet(LOG_SHEET);
      sh.appendRow(['受付日時', '第1希望', '第2希望', '第3希望', '予約者名', '電話番号', 'メールアドレス', '予約のきっかけ']);
      sh.getRange('1:1').setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow([new Date(), d.p1 || d.day || '', d.p2 || '', d.p3 || '', d.name || '', d.tel || '', d.email || '', d.channel || '']);
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
