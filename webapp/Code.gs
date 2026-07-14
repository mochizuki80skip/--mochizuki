/**
 * ONE'S BODY 静岡安倍川店 オープン前体験会 予約サイト（Google Apps Script Web App）
 *
 * 仕組み:
 *  - 予約表（8月28/29/30日タブ）を読み込み、各時間枠の空き数から ◎△× を判定
 *      新規対応=TRUE のルームのうち、その時間に「氏名」が空いている数を数える
 *      2〜4枠 → ◎ ／ 1枠 → △ ／ 0枠（満員）→ ×
 *  - 予約を受けると、空いているルームへ 氏名/電話/きっかけ を自動で書き込み
 *  - 併せて「Web予約」タブへ 受付日時・体験日・時間・ルーム・氏名・電話・メール・きっかけ を記録
 */

// ==== 設定 ====
const SS_ID = '15an8h-Z4SeRlXKB1kceugg2hdX6tAjPUrori76pxpNQ'; // このスプレッドシートのID
const DAYS = [
  { sheet: '8月28日（金）', label: '8/28（金）' },
  { sheet: '8月29日（土）', label: '8/29（土）' },
  { sheet: '8月30日（日）', label: '8/30（日）' },
];
// 各ルームの列（1始まり）: 新規対応チェック / 氏名 / 連絡先 / 集客経路
const ROOMS = [
  { name: 'A', shinkiCol: 3,  nameCol: 3,  telCol: 4,  chCol: 5  },
  { name: 'B', shinkiCol: 8,  nameCol: 8,  telCol: 9,  chCol: 10 },
  { name: 'C', shinkiCol: 13, nameCol: 13, telCol: 14, chCol: 15 },
  { name: 'D', shinkiCol: 18, nameCol: 18, telCol: 19, chCol: 20 },
];
const SHINKI_ROW = 3;      // 新規対応チェックの行
const FIRST_ROW = 5;       // 時間枠の開始行
const LAST_ROW = 22;       // 時間枠の終了行（9:00〜18:00の30分×18枠）
const SETTINGS_SHEET = '設定';
const LOG_SHEET = 'Web予約';

// ==== 画面表示 ====
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle("ONE'S BODY 静岡安倍川店 体験会ご予約")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function ss_() {
  return SpreadsheetApp.openById(SS_ID);
}

// 初期データ（集客経路リスト＋空き状況）をまとめて返す
function getInitData() {
  return { channels: getChannels_(), days: getAvailability_() };
}

// 空き状況だけ再取得（予約後の更新用）
function getAvailability() {
  return getAvailability_();
}

function getChannels_() {
  const sh = ss_().getSheetByName(SETTINGS_SHEET);
  if (!sh) return [];
  return sh.getRange('C2:C50').getValues().map(r => r[0]).filter(v => v !== '' && v != null);
}

function getAvailability_() {
  const ss = ss_();
  return DAYS.map(day => {
    const sh = ss.getSheetByName(day.sheet);
    const data = sh.getDataRange().getValues(); // 0始まり
    const shinki = ROOMS.map(r => data[SHINKI_ROW - 1][r.shinkiCol - 1] === true);
    const slots = [];
    for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
      const time = String(data[row - 1][0] || '');
      if (!time) continue;
      let open = 0;
      ROOMS.forEach((r, i) => {
        if (!shinki[i]) return;
        const nm = data[row - 1][r.nameCol - 1];
        if (nm == null || String(nm).trim() === '') open++;
      });
      const mark = open >= 2 ? '◎' : (open === 1 ? '△' : '×');
      slots.push({ time: time, open: open, mark: mark });
    }
    return { sheet: day.sheet, label: day.label, slots: slots };
  });
}

// ==== 予約受付 ====
function submitBooking(payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (e) {
    return { ok: false, message: 'アクセスが集中しています。少し時間をおいて再度お試しください。' };
  }
  try {
    const errors = validate_(payload);
    if (errors.length) return { ok: false, message: errors.join('\n') };

    const ss = ss_();
    const day = DAYS.find(d => d.sheet === payload.sheet);
    if (!day) return { ok: false, message: '日付の指定が正しくありません。' };
    const sh = ss.getSheetByName(day.sheet);
    const data = sh.getDataRange().getValues();

    // 時間の行を特定
    let row = -1;
    for (let r = FIRST_ROW; r <= LAST_ROW; r++) {
      if (String(data[r - 1][0]) === String(payload.time)) { row = r; break; }
    }
    if (row === -1) return { ok: false, message: '選択された時間枠が見つかりません。' };

    // 空いているルームを探す（新規対応=TRUE かつ 氏名が空）
    let chosen = null;
    for (let i = 0; i < ROOMS.length; i++) {
      const r = ROOMS[i];
      const on = data[SHINKI_ROW - 1][r.shinkiCol - 1] === true;
      const nm = data[row - 1][r.nameCol - 1];
      if (on && (nm == null || String(nm).trim() === '')) { chosen = r; break; }
    }
    if (!chosen) {
      return { ok: false, message: '申し訳ありません。この時間枠はちょうど満員になりました。別の枠をお選びください。' };
    }

    // 予約表へ書き込み
    sh.getRange(row, chosen.nameCol).setValue(payload.name);
    sh.getRange(row, chosen.telCol).setValue(payload.tel);
    sh.getRange(row, chosen.chCol).setValue(payload.channel);
    SpreadsheetApp.flush();

    // ログへ記録
    appendLog_(ss, {
      label: day.label, time: payload.time, room: chosen.name,
      name: payload.name, tel: payload.tel, email: payload.email, channel: payload.channel,
    });

    return {
      ok: true,
      message: 'ご予約を承りました。\n' + day.label + '　' + payload.time + '　（ルーム' + chosen.name + '）',
      room: chosen.name,
    };
  } finally {
    lock.releaseLock();
  }
}

function appendLog_(ss, rec) {
  let sh = ss.getSheetByName(LOG_SHEET);
  if (!sh) {
    sh = ss.insertSheet(LOG_SHEET);
    sh.appendRow(['受付日時', '体験日', '時間', 'ルーム', '予約者名', '電話番号', 'メールアドレス', '予約のきっかけ']);
    sh.getRange('1:1').setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), rec.label, rec.time, rec.room, rec.name, rec.tel, rec.email, rec.channel]);
}

function validate_(p) {
  const errors = [];
  if (!p || !p.name || !String(p.name).trim()) errors.push('予約者名を入力してください。');
  if (!p.tel || !/^\d{2,4}-\d{2,4}-\d{3,4}$/.test(String(p.tel).trim())) {
    errors.push('電話番号は 000-0000-0000 の形式（ハイフンあり）で入力してください。');
  }
  if (!p.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(p.email).trim())) {
    errors.push('メールアドレスを正しく入力してください。');
  }
  if (!p.channel || !String(p.channel).trim()) errors.push('ご予約のきっかけを選択してください。');
  if (!p.sheet || !p.time) errors.push('ご希望の日時を選択してください。');
  return errors;
}
