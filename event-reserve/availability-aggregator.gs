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
 *   - 空き数 0→×, 1〜2→△, 8以上→〇, 3〜7→CONFIG.midStatus
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
  treatmentMin: 30,       // 初回（新患）の施術時間＝必要な連続枠(30分=15分×2)
  repeatTreatmentMin: 15, // 2回目以降の施術時間（15分＝1枠空いていればOK）
  // 空き枠数 → 〇△× の判定しきい値
  okMin: 8,               // 空きが 8 以上 → 〇（空きあり）
  fewMax: 2,              // 空きが 1〜2 → △（残り枠少／要問合せ）
  midStatus: '〇',        // 空きが 3〜7 のときの表示（'〇' か '△'）
  // ×（空き無し）は 0
  publishSheet: 'サイト公開用',
  // 集客経路（ご予約のきっかけ）の選択肢タブ名。A2以降を読み込んでサイトに出す。
  channelSheet: '集客経路',
};

/* ============================ メニュー ============================ */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('▶ 空き集計')
      .addItem('いますぐ集計', 'aggregateAvailability')
      .addItem('構造を診断', 'diagnoseStructure')
      .addToUi();
  } catch (e) { /* エディタからの手動実行など UI が無い場合は無視 */ }
}

/** UI があればダイアログ、無ければログに出す（エディタ実行でも落ちない） */
function notify_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); }
  catch (e) { Logger.log(msg); }
}

/* ===================== 集計本体（メニュー用） ===================== */
function aggregateAvailability() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = buildAvailability_(ss);
  writePublishSheet_(ss, result);
  const total = result.days.reduce((n, d) => n + d.slots.length, 0);
  notify_(
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
    const mins = Object.keys(board.timeRowByMin).map(Number).sort((a, b) => a - b);
    days.push({ date: day.date, tab: day.tab, stepMin: day.stepMin,
                beds: board.beds.length,
                activeBeds: board.beds.filter((b) => b.active).length,
                newBeds: board.beds.filter((b) => b.active && b.newOk).length,
                timeRows: mins.length,
                timeFrom: mins.length ? fromMinutes_(mins[0]) : '-',
                timeTo: mins.length ? fromMinutes_(mins[mins.length - 1]) : '-',
                slots });
  }
  return { generatedAt: new Date().toISOString(), channels: readChannels_(ss), days };
}

/** 「集客経路」タブの A2 以降を選択肢リストとして読み込む（空欄は除外） */
function readChannels_(ss) {
  const sh = ss.getSheetByName(CONFIG.channelSheet);
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 1).getValues()
    .map((r) => String(r[0]).trim())
    .filter((s) => s !== '');
}

/** タブを解析して、ベッド一覧と「時刻→占有状況」を取り出す */
function readBoard_(sh) {
  const values = sh.getDataRange().getValues();
  const nRows = values.length;
  const nCols = values.length ? values[0].length : 0;

  // --- ① ベッドヘッダ行（No.x が3つ以上並ぶ行）を先に検出 ---
  let headerRow = -1;
  let heads = [];
  for (let r = 0; r < Math.min(nRows, 20); r++) {
    const cols = [];
    for (let c = 0; c < nCols; c++) {
      const m = String(values[r][c]).match(/^No\.?\s*(\d+)/);
      if (m) cols.push({ no: Number(m[1]), col: c });
    }
    if (cols.length >= 3) { headerRow = r; heads = cols; break; }
  }
  heads.sort((a, b) => a.col - b.col);
  // 各ベッドの列範囲 [col, endCol)（次のベッド列の手前まで／最後は3列ぶん）
  const beds0 = heads.map((b, i) => ({
    no: b.no, col: b.col,
    endCol: i + 1 < heads.length ? heads[i + 1].col : b.col + 3,
  }));

  // --- ② ヘッダ直後の数行から 新規対応行(チェック/TRUE)・施術者行(文字列) を検出 ---
  let newRow = -1, therRow = -1;
  for (let r = headerRow + 1; r < Math.min(nRows, headerRow + 6); r++) {
    let bools = 0, texts = 0;
    for (const b of beds0) {
      for (let c = b.col; c < b.endCol; c++) {
        const v = values[r][c];
        // チェックボックス(boolean) でも、文字の "TRUE"/"FALSE" でも新規対応行として数える
        if (typeof v === 'boolean' || /^(true|false)$/i.test(String(v).trim())) bools++;
        else if (typeof v === 'string' && v.trim() !== '') texts++;
      }
    }
    if (bools >= 2 && newRow === -1) newRow = r;
    else if (texts >= 2 && therRow === -1) therRow = r;
  }

  // --- ③ 時刻行はヘッダ（施術者行）より下だけを対象に検出 ---
  //  上部の集計セル(0 など)を 00:00 と誤認識しないため。
  const startScan = Math.max(headerRow, newRow, therRow) + 1;
  const timeRowByMin = {}; // 分 -> 行index
  for (let r = startScan; r < nRows; r++) {
    const min = toMinutes_(values[r][0]) ?? toMinutes_(values[r][1]);
    if (min != null && timeRowByMin[min] === undefined) timeRowByMin[min] = r;
  }

  // --- ④ ベッド定義（1列目=名前欄、範囲内に施術者名・新規対応チェック）---
  const beds = beds0.map((b) => {
    let therapist = '', newOk = false;
    for (let c = b.col; c < b.endCol; c++) {
      if (therRow >= 0 && !therapist) {
        const tv = values[therRow][c];
        if (typeof tv === 'string' && tv.trim() !== '') therapist = tv.trim();
      }
      // 新規対応可：チェックボックスのTRUE でも 文字の "TRUE" でもOK
      if (newRow >= 0) {
        const nv = values[newRow][c];
        if (nv === true || /^true$/i.test(String(nv).trim())) newOk = true;
      }
    }
    return { no: b.no, col: b.col, endCol: b.endCol, therapist, newOk, active: therapist !== '' };
  });

  return { values, beds, timeRowByMin };
}

/** その日の営業時間・刻みに沿って、各開始時刻の空き数とステータスを計算 */
function computeSlots_(board, day) {
  const slots = [];
  day.hours.forEach(([open, close]) => {
    const openMin = toMinutes_(open);
    const closeMin = toMinutes_(close);
    // 各営業ブロックの「終了時刻ぴったり」まで予約可
    // （午前は昼休み前の終了時刻まで、午後は閉店時刻まで）
    for (let t = openMin; t <= closeMin; t += day.stepMin) {
      let freeAll = 0, freeNew = 0;
      for (const bed of board.beds) {
        if (!bed.active) continue;
        // 2回目以降：15分（1枠）空いていればOK（全ベッド対象）
        if (isBedFree_(board, bed, t, CONFIG.repeatTreatmentMin)) freeAll++;
        // 初回：30分（15分×2連続）が取れる新規対応ベッドのみ
        if (bed.newOk && isBedFree_(board, bed, t, CONFIG.treatmentMin)) freeNew++;
      }
      slots.push({
        time: fromMinutes_(t),
        allFree: freeAll, allStatus: statusOf_(freeAll),
        newFree: freeNew, newStatus: statusOf_(freeNew),
      });
    }
  });
  return slots;
}

/** ベッドが開始時刻 t から durationMin 分、空いているか
 *  判定は「各ベッドの1列目（名前欄）」のみ。
 *  [t, t+durationMin) に入るボードの時刻行すべてで名前欄が空なら空き。
 *  （初回=30分→15分×2連続、2回目=15分→1枠）
 *  営業終了ぴったりの枠などボードに該当行が無い場合は、窓内の行で判断。
 *  ※ 15分刻み・30分刻み・空行ありの全パターンに対応。 */
function isBedFree_(board, bed, startMin, durationMin) {
  const keys = Object.keys(board.timeRowByMin);
  if (keys.length === 0) return false; // ボードの時刻が全く読めない時は安全側で×
  const endMin = startMin + durationMin;
  for (const key of keys) {
    const m = Number(key);
    if (m >= startMin && m < endMin) {
      if (isBookedCell_(board.values[board.timeRowByMin[m]][bed.col])) return false;
    }
  }
  return true;
}

/** そのセルが「予約で埋まっている」入力か。
 *  空欄・boolean・チェックボックスの "TRUE"/"FALSE" 文字列は埋まりとみなさない。 */
function isBookedCell_(v) {
  if (v == null || v === '') return false;
  if (typeof v === 'boolean') return false;
  const s = String(v).trim();
  if (s === '') return false;
  if (/^(true|false)$/i.test(s)) return false; // 来院済みチェック等
  return true;
}

function statusOf_(free) {
  if (free <= 0) return '×';                 // 空き無し
  if (free <= CONFIG.fewMax) return '△';     // 残り 1〜2
  if (free >= CONFIG.okMin) return '〇';      // 8 以上
  return CONFIG.midStatus;                    // 3〜7
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
  // --- 診断ブロック（H列〜）: 各日で何台・何時刻を検出したかを表示 ---
  const diag = [['日付', 'ベッド', '稼働', '新患可', '時刻行', '時刻範囲', 'メモ']];
  for (const d of result.days) {
    diag.push([
      d.date, d.beds || 0, d.activeBeds || 0, d.newBeds || 0,
      d.timeRows || 0, `${d.timeFrom || '-'}〜${d.timeTo || '-'}`, d.error || '',
    ]);
  }
  sh.getRange(1, 8, diag.length, diag[0].length).setValues(diag);
  sh.getRange(1, 8, 1, diag[0].length)
    .setBackground('#444').setFontColor('#fff').setFontWeight('bold');
  sh.getRange(diag.length + 2, 8)
    .setValue('最終更新: ' + new Date().toLocaleString('ja-JP'));
  sh.autoResizeColumns(1, 14);
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
  notify_('構造診断\n\n' + lines.join('\n\n'));
}

/* =========================== ユーティリティ =========================== */
/** Date(時刻) / "9:00" / "9：00" / "9:00:00" / シリアル値 → 0:00からの分。該当なしは null */
function toMinutes_(v) {
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === 'number') {
    if (v > 0 && v < 1) return Math.round(v * 1440); // 時刻シリアル(0〜1)
    return null;
  }
  if (typeof v === 'string') {
    const s = v.replace(/：/g, ':').trim();         // 全角コロン対応
    const m = s.match(/^(\d{1,2}):(\d{2})/);          // 末尾の :SS 等は無視
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  return null;
}
function fromMinutes_(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
