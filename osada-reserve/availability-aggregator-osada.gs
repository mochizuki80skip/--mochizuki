/**
 * なつめ接骨院 静岡長田店 予約表 → サイト公開用 空き状況 集計（自動読み取り）
 * ==================================================================
 * 予約表スプレッドシート（build-osada-sheet.gs で生成した 8/28・8/29・8/30 タブ）を
 * 読み取り、各時刻の空き（〇△×）を JSON で配信する。個人情報（氏名・連絡先）は出さない。
 *
 * サイトは doGet の JSON を fetch して自動表示。時間主導トリガーで動かす必要はなく、
 * サイトがアクセスするたびに最新のシートを読むので「常時読み取り」で自動最新化される。
 *
 * 【判定ルール】各ベッド（＝1列グループ：氏名/連絡先/集客きっかけ/区分/来院）について
 *   ・稼働ベッド ＝ 見出しの「新規対応 ☑」が TRUE のベッド（＝新規受付の母数）
 *     （☑を外したベッドは休憩・不在・ブロック扱いで、空きに数えない）
 *   ・ある時刻に 氏名 が入っていれば埋まり。区分=「初」は30分＝下の15分も埋まり。
 *   ・はじめて(初診/30分) … 稼働ベッドで「その時刻＋次の15分」が両方空き → newFree
 *   ・2回目以降(15分)     … 稼働ベッドで「その時刻」が空き            → allFree
 *   ・空き数 0→×, 1〜2→△, 3以上→〇
 *
 * 【デプロイ】Apps Script → デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *   アクセスできるユーザー「全員」で発行 → その URL を osada-reserve/app.js の
 *   CONFIG.apiUrl に貼り付ける。
 *
 * ※ build-osada-sheet.gs と同じ Apps Script プロジェクトに置いてOK
 *   （関数名が衝突しないよう、このファイルの補助関数はすべて a_ 始まり）。
 */

const AGG = {
  days: [
    { tab: '8/28', date: '2026-08-28' },
    { tab: '8/29', date: '2026-08-29' },
    { tab: '8/30', date: '2026-08-30' },
  ],
  initialLabel: '初',   // 区分=初診（30分＝縦2枠）の値
  fewMax: 2,            // 空き 1〜2 → △
  channelSheet: '設定', // 集客きっかけリストのタブ
  channelCol: 2,        // 設定タブのB列（1始まり）
  stepMin: 15,
};

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify(a_build_()))
    .setMimeType(ContentService.MimeType.JSON);
}

function a_build_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const days = [];
  for (const d of AGG.days) {
    const sh = ss.getSheetByName(d.tab);
    if (!sh) { days.push({ date: d.date, stepMin: AGG.stepMin, slots: [] }); continue; }
    const board = a_readBoard_(sh);
    days.push({ date: d.date, stepMin: AGG.stepMin, slots: a_slots_(board) });
  }
  return { generatedAt: new Date().toISOString(), channels: a_channels_(ss), days: days };
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

/** 日タブを解析：新規対応ベッド列・時刻行を検出 */
function a_readBoard_(sh) {
  const values = sh.getDataRange().getValues();
  const nRows = values.length;
  const label = (r) => String((values[r] && values[r][0]) || '').trim();

  // 見出し行を検出（A列のラベルで）
  let bedRow = -1, newRow = -1, subRow = -1;
  for (let r = 0; r < Math.min(nRows, 12); r++) {
    const a = label(r);
    if (a === 'ベッド') bedRow = r;
    else if (a.indexOf('新規対応') === 0) newRow = r;
    else if (a === '時間' && r > bedRow) subRow = r; // データ直前の「時間」小見出し
  }
  if (bedRow < 0) bedRow = 5;
  if (newRow < 0) newRow = bedRow + 1;
  if (subRow < 0) subRow = bedRow + 3;

  // ベッド列（No.x のセル位置＝氏名列）と 新規対応☑
  const beds = [];
  const row = values[bedRow] || [];
  for (let c = 1; c < row.length; c++) {
    if (/^No\.?\s*\d+/.test(String(row[c]))) {
      const newOk = values[newRow][c] === true || /^true$/i.test(String(values[newRow][c]).trim());
      beds.push({ nameCol: c, visitCol: c + 3, active: newOk });
    }
  }

  // 時刻行（A列が h:mm）。昼休憩など時刻でない行はスキップ。
  const slots = [];
  for (let r = subRow + 1; r < nRows; r++) {
    const m = label(r).match(/^(\d{1,2}):(\d{2})$/);
    if (m) slots.push({ r: r, min: Number(m[1]) * 60 + Number(m[2]) });
  }
  return { values: values, beds: beds, slots: slots };
}

/** 各時刻の空き（はじめて=30分 / 2回目以降=15分）を計算 */
function a_slots_(board) {
  const out = [];
  for (let i = 0; i < board.slots.length; i++) {
    const cur = board.slots[i];
    const next = board.slots[i + 1];
    const adj = next && next.min === cur.min + AGG.stepMin; // 次の15分が連続しているか
    let allFree = 0, newFree = 0;
    for (const bed of board.beds) {
      if (!bed.active) continue;                         // 稼働（新規対応☑）ベッドのみ
      const free15 = !a_occupied_(board, bed, cur.r);
      if (free15) allFree++;
      if (free15 && adj && !a_occupied_(board, bed, next.r)) newFree++; // 30分（縦2枠）
    }
    out.push({
      time: a_hhmm_(cur.min),
      allFree: allFree, allStatus: a_status_(allFree),
      newFree: newFree, newStatus: a_status_(newFree),
    });
  }
  return out;
}

/** そのベッドがその行で埋まっているか。
 *  氏名が入っていれば埋まり。ひとつ上の行が「初」(30分)なら、この行も埋まり。 */
function a_occupied_(board, bed, r) {
  const name = board.values[r][bed.nameCol];
  if (name != null && String(name).trim() !== '') return true;
  // 直上の行が初診(30分)なら、この行は2枠目として埋まり
  const upName = board.values[r - 1] ? board.values[r - 1][bed.nameCol] : '';
  const upVisit = board.values[r - 1] ? board.values[r - 1][bed.visitCol] : '';
  if (upName != null && String(upName).trim() !== '' &&
      String(upVisit).trim() === AGG.initialLabel) return true;
  return false;
}

function a_status_(free) {
  if (free <= 0) return '×';
  if (free <= AGG.fewMax) return '△';
  return '〇';
}
function a_hhmm_(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}
