/**
 * 接骨院 出店イベント 予約ボード → サイト公開用 空き状況 自動集計
 * ==================================================================
 * 院スタッフが使う「予約ボード（日付ごとのタブ）」を読み取り、
 * 各時刻の空き状況（〇△×）を「サイト公開用」シートに書き出す。
 * サイトはこの公開用シート（または doGet の JSON）だけを参照するので、
 * お客様の名前・連絡先・来院きっかけなどの個人情報はサイトに出ない。
 *
 * 【判定ルール】
 *   ある開始時刻に対し、各ベッドで
 *     「その時刻の行」と「(施術時間)分後の行」の “名前列” が両方とも空
 *   なら、そのベッドはその時刻に空き。
 *   - 施術者が未割当のベッドは数えない
 *   - 新患向けは「新規対応 ☑」のベッドだけ数える
 *   - 空き数 0→×, 1〜閾値→△, それ以上→〇
 *
 * 【使い方】
 *   1. 予約ボードのスプレッドシートで 拡張機能 → Apps Script
 *   2. このファイルを貼り付けて保存
 *   3. 下の CONFIG をイベントに合わせて調整（タブ名・刻み・営業時間）
 *   4. メニュー「▶ 空き集計」→「いますぐ集計」で実行
 *   5. うまく読めない場合は「▶ 空き集計」→「構造を診断」で
 *      検出結果（ベッド列・施術者・予約数）を確認して CONFIG を調整
 */

const CONFIG = {
  // 開催日。tab = 実際のタブ（シート）名と完全一致させること。
  days: [
    { date: '2026-07-24', tab: '7/24', stepMin: 30,
      hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { date: '2026-07-25', tab: '7/25', stepMin: 15,
      hours: [['09:00', '12:00'], ['14:00', '18:00']] },
    { date: '2026-07-26', tab: '7/26', stepMin: 15,
      hours: [['09:00', '17:00']] },
  ],
  treatmentMin: 30,       // 1施術の長さ（=何分ぶんの行を占有するか）
  fewLeftThreshold: 1,    // 残り枠がこの数以下なら △
  nameColOffset: 0,       // ベッド列グループの先頭から名前列までのオフセット（0=先頭列）
  publishSheet: 'サイト公開用',
};

/* ============================ メニュー ============================ */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('▶ 空き集計')
    .addItem('いますぐ集計', 'aggregateAvailability')
    .addItem('構造を診断', 'diagnoseStructure')
    .addToUi();
}

/* ===================== 集計本体（メニュー用） ===================== */
function aggregateAvailability() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = buildAvailability_(ss);
  writePublishSheet_(ss, result);
  const total = result.days.reduce((n, d) => n + d.slots.length, 0);
  SpreadsheetApp.getUi().alert(
    `集計完了。「${CONFIG.publishSheet}」を更新しました（${result.days.length}日分 / ${total}枠）。`
  );
}

/**
 * Web アプリとして公開すると、サイトがこの URL を fetch して JSON を取得できる。
 * デプロイ：Apps Script → デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *   アクセス「全員」にして発行された URL をサイトに設定する。
 */
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = buildAvailability_(ss);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ====================== 1時間ごと自動更新 ======================
 * 「トリガー」画面で aggregateAvailability を時間主導(例:5分/1時間)で
 * 動かすと、ボードの更新が自動で公開用シートに反映される。            */

/* ========================= 集計ロジック ========================= */
function buildAvailability_(ss) {
  const days = [];
  for (const day of CONFIG.days) {
    const sh = ss.getSheetByName(day.tab);
    if (!sh) {
      days.push({ date: day.date, tab: day.tab, stepMin: day.stepMin,
                  error: `タブ「${day.tab}」が見つかりません`, slots: [] });
      continue;
    }
    const board = readBoard_(sh);
    const slots = computeSlots_(board, day);
    days.push({ date: day.date, tab: day.tab, stepMin: day.stepMin,
                beds: board.beds.length,
                activeBeds: board.beds.filter((b) => b.active).length,
                newBeds: board.beds.filter((b) => b.active && b.newOk).length,
                slots });
  }
  return { generatedAt: new Date().toISOString(), days };
}

/** タブを解析して、ベッド一覧と「時刻→占有状況」を取り出す */
function readBoard_(sh) {
  const values = sh.getDataRange().getValues();
  const nRows = values.length;
  const nCols = values.length ? values[0].length : 0;

  // --- 時刻行を検出（A列〜B列に HH:MM がある行）---
  const timeRowByMin = {}; // 分 -> 行index
  for (let r = 0; r < nRows; r++) {
    const min = toMinutes_(values[r][0]) ?? toMinutes_(values[r][1]);
    if (min != null && timeRowByMin[min] === undefined) timeRowByMin[min] = r;
  }

  // --- ベッドヘッダ行（No.x が3つ以上並ぶ行）を検出 ---
  let headerRow = -1;
  const bedCols = [];
  for (let r = 0; r < Math.min(nRows, 12); r++) {
    const cols = [];
    for (let c = 0; c < nCols; c++) {
      const m = String(values[r][c]).match(/^No\.?\s*(\d+)/);
      if (m) cols.push({ no: Number(m[1]), col: c });
    }
    if (cols.length >= 3) { headerRow = r; bedCols.push(...cols); break; }
  }

  // --- 新規対応行（boolean が並ぶ）と施術者行（文字列が並ぶ）を検出 ---
  let newRow = -1, therRow = -1;
  const firstTimeRow = Math.min(...Object.values(timeRowByMin).concat([nRows]));
  for (let r = headerRow + 1; r < firstTimeRow; r++) {
    let bools = 0, texts = 0;
    for (const b of bedCols) {
      const v = values[r][b.col];
      if (typeof v === 'boolean') bools++;
      else if (typeof v === 'string' && v.trim() !== '') texts++;
    }
    if (bools >= 2 && newRow === -1) newRow = r;
    else if (texts >= 2 && therRow === -1) therRow = r;
  }

  // --- ベッド定義 ---
  const beds = bedCols.map((b) => {
    const nameCol = b.col + CONFIG.nameColOffset;
    const therapist = therRow >= 0 ? String(values[therRow][b.col] || '').trim() : '';
    const newOk = newRow >= 0 ? values[newRow][b.col] === true : false;
    return { no: b.no, col: b.col, nameCol, therapist, newOk, active: therapist !== '' };
  });

  return { values, beds, timeRowByMin };
}

/** その日の営業時間・刻みに沿って、各開始時刻の空き数とステータスを計算 */
function computeSlots_(board, day) {
  const slots = [];
  const span = Math.max(1, Math.round(CONFIG.treatmentMin / 15)); // 施術は何行ぶんか(15分=1行前提)
  for (const [open, close] of day.hours) {
    const openMin = toMinutes_(open);
    const closeMin = toMinutes_(close);
    // 施術が閉店までに収まる開始時刻のみ
    for (let t = openMin; t + CONFIG.treatmentMin <= closeMin; t += day.stepMin) {
      let freeAll = 0, freeNew = 0;
      for (const bed of board.beds) {
        if (!bed.active) continue;
        if (isBedFree_(board, bed, t, span)) {
          freeAll++;
          if (bed.newOk) freeNew++;
        }
      }
      slots.push({
        time: fromMinutes_(t),
        allFree: freeAll, allStatus: statusOf_(freeAll),
        newFree: freeNew, newStatus: statusOf_(freeNew),
      });
    }
  }
  return slots;
}

/** ベッドが開始時刻 t から施術時間ぶん、連続で空いているか */
function isBedFree_(board, bed, startMin, span) {
  for (let k = 0; k < span; k++) {
    const r = board.timeRowByMin[startMin + k * 15];
    if (r === undefined) return false;            // その行が存在しない＝取れない
    const v = board.values[r][bed.nameCol];
    if (v !== '' && v != null && typeof v !== 'boolean') return false; // 名前/連絡先あり＝埋まり
  }
  return true;
}

function statusOf_(free) {
  if (free <= 0) return '×';
  if (free <= CONFIG.fewLeftThreshold) return '△';
  return '〇';
}

/* ===================== 公開用シートへ書き出し ===================== */
function writePublishSheet_(ss, result) {
  let sh = ss.getSheetByName(CONFIG.publishSheet);
  if (!sh) sh = ss.insertSheet(CONFIG.publishSheet);
  sh.clear();
  sh.clearConditionalFormatRules();

  const header = ['日付', '時刻', '新規_状態', '新規_空き', '全体_状態', '全体_空き'];
  const rows = [header];
  for (const d of result.days) {
    for (const s of d.slots) {
      rows.push([d.date, s.time, s.newStatus, s.newFree, s.allStatus, s.allFree]);
    }
  }
  sh.getRange(1, 1, rows.length, header.length).setValues(rows);
  sh.getRange(1, 1, 1, header.length)
    .setBackground('#1a1a1a').setFontColor('#fff').setFontWeight('bold')
    .setHorizontalAlignment('center');
  sh.setFrozenRows(1);

  // 状態列の色分け（新規=C列, 全体=E列）
  [3, 5].forEach((col) => {
    const range = sh.getRange(2, col, Math.max(rows.length - 1, 1), 1);
    range.setHorizontalAlignment('center').setFontWeight('bold');
    const rule = (t, bg, fg) => SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(t).setBackground(bg).setFontColor(fg).setRanges([range]).build();
    const existing = sh.getConditionalFormatRules();
    sh.setConditionalFormatRules(existing.concat([
      rule('〇', '#e7f6e9', '#1b7a3d'),
      rule('△', '#fff6e0', '#9c6b00'),
      rule('×', '#fbe7e7', '#b33636'),
    ]));
  });
  sh.getRange(1, 8).setValue('最終更新: ' + new Date().toLocaleString('ja-JP'));
  sh.autoResizeColumns(1, header.length);
}

/* ======================= 構造の診断（補助） ======================= */
function diagnoseStructure() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];
  for (const day of CONFIG.days) {
    const sh = ss.getSheetByName(day.tab);
    if (!sh) { lines.push(`【${day.tab}】タブが見つかりません`); continue; }
    const b = readBoard_(sh);
    const times = Object.keys(b.timeRowByMin).map(Number).sort((a, z) => a - z);
    const bedInfo = b.beds.map((x) =>
      `No.${x.no}(${x.therapist || '空'}${x.newOk ? '/新患可' : ''})`).join(' ');
    lines.push(
      `【${day.tab}】ベッド ${b.beds.length} / 稼働 ${b.beds.filter((x) => x.active).length}` +
      ` / 新患可 ${b.beds.filter((x) => x.active && x.newOk).length}\n` +
      `  時刻行 ${times.length}個 (${times.length ? fromMinutes_(times[0]) + '〜' + fromMinutes_(times[times.length - 1]) : '-'})\n` +
      `  ${bedInfo}`
    );
  }
  SpreadsheetApp.getUi().alert('構造診断\n\n' + lines.join('\n\n'));
}

/* =========================== ユーティリティ =========================== */
/** Date(時刻) / "9:00" / シリアル値 → 0:00からの分。該当なしは null */
function toMinutes_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number' && v > 0 && v < 1) return Math.round(v * 24 * 60);
  if (typeof v === 'string') {
    const m = v.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  return null;
}
function fromMinutes_(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
