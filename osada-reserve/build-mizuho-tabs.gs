/**
 * 学園みずほ接骨院 8/1-26 予約表タブ 一括生成
 * ============================================================
 * 既存の「8/1」タブを雛形として 8/2〜8/26 を複製する。
 *   ・新患列(5)の「開放(空白)/×」パターンは 8/1 のまま引き継がれる
 *   ・複製時に予約(氏名)をクリアし、日付表示を各日に更新
 *   ・定休日もタブは作る（サイト側の定休日リストで非表示にする方針）
 *
 * 【使い方】
 *   1. なつめ静岡長田の予約表スプレッドシートで 拡張機能 → Apps Script
 *   2. このファイルを新規追加して保存（関数名は mizuho 始まりで既存と衝突しません）
 *   3. 関数 buildMizuhoTabs を実行（雛形「8/1」を先に用意しておくこと）
 */
function buildMizuhoTabs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tmpl = ss.getSheetByName('8/1');
  if (!tmpl) throw new Error('雛形タブ「8/1」が見つかりません。先に8/1を用意してください。');

  for (let day = 2; day <= 26; day++) {
    const name = '8/' + day;
    const exist = ss.getSheetByName(name);
    if (exist) ss.deleteSheet(exist);
    const sh = tmpl.copyTo(ss).setName(name);
    mizuhoSetDate_(sh, day);
    mizuhoClearNames_(sh);
  }

  // 8/1 の直後に 8/2..8/26 を並べる
  let pos = ss.getSheets().indexOf(tmpl) + 1; // 8/1 の1-based位置
  for (let day = 2; day <= 26; day++) {
    const sh = ss.getSheetByName('8/' + day);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(++pos); }
  }
  try { SpreadsheetApp.getActive().toast('みずほ 8/2〜8/26 タブを生成しました'); } catch (e) {}
}

/** 日付表示を day に更新（「2026年8月N日」と「…月 N 日」の両方を書き換え） */
function mizuhoSetDate_(sh, day) {
  const vals = sh.getDataRange().getValues();
  for (let r = 0; r < vals.length; r++) {
    for (let c = 0; c < vals[r].length; c++) {
      const v = vals[r][c];
      if (typeof v === 'string' && /^2026年8月\d+日$/.test(v.trim())) {
        sh.getRange(r + 1, c + 1).setValue('2026年8月' + day + '日');
      }
      // 「… , 月 , <日番号> , 日 , …」の日番号セルを更新
      if (v === '日' && c >= 2 && vals[r][c - 2] === '月') {
        sh.getRange(r + 1, c).setValue(day); // 月と日の間のセル（1-based列 = c）
      }
    }
  }
}

/** 予約(氏名)をクリア。時刻行の「時間列より右」で ×・空白以外＝予約名を消す。
 *  見出し(氏名/新患/AM/PM等)は時刻行でないので触らない。×と空白は保持。 */
function mizuhoClearNames_(sh) {
  const vals = sh.getDataRange().getValues();
  // 時間列＝実際に時刻値が最も多い列（見出し「時間」の位置ズレを回避）
  let timeCol = -1, best = 0;
  const cols = vals.length ? Math.max.apply(null, vals.map(function (r) { return r.length; })) : 0;
  for (let c = 0; c < cols; c++) {
    let cnt = 0;
    for (let r = 0; r < vals.length; r++) if (mizuhoToMin_(vals[r][c]) != null) cnt++;
    if (cnt > best) { best = cnt; timeCol = c; }
  }
  if (timeCol < 0) return;
  for (let r = 0; r < vals.length; r++) {
    if (mizuhoToMin_(vals[r][timeCol]) == null) continue; // 時刻行のみ対象
    for (let c = timeCol + 1; c < vals[r].length; c++) {
      const s = vals[r][c] == null ? '' : String(vals[r][c]).trim();
      if (s === '' || s === '×' || s === 'x' || s === 'X') continue; // ×・空白は保持
      sh.getRange(r + 1, c + 1).clearContent(); // 予約名だけ消す
    }
  }
}

function mizuhoToMin_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number') return (v > 0 && v < 1) ? Math.round(v * 1440) : null;
  if (typeof v === 'string') {
    const m = v.replace('：', ':').trim().match(/^(\d{1,2}):(\d{2})/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  return null;
}
