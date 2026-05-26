// Google Sheets 連携：認証はサービスアカウント JSON を環境変数で受け取る
// GOOGLE_SERVICE_ACCOUNT_JSON: サービスアカウントの JSON 全文（一行 or base64）

import { google, sheets_v4 } from "googleapis";

let cachedClient: sheets_v4.Sheets | null = null;

function loadServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    // base64 で渡されている場合のフォールバック
    const json = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as { client_email: string; private_key: string };
    // 改行文字が \n リテラルで来る場合の対策
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    return parsed;
  } catch (e) {
    console.error("[sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", e);
    return null;
  }
}

export function isSheetsConfigured(): boolean {
  return loadServiceAccount() !== null;
}

function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const sa = loadServiceAccount();
  if (!sa) throw new Error("Google Sheets 認証情報（GOOGLE_SERVICE_ACCOUNT_JSON）が未設定です");
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}

export async function appendRow(
  spreadsheetId: string,
  tabName: string,
  values: (string | number | null)[],
): Promise<{ rowNumber: number | null }> {
  const sheets = getSheetsClient();
  const range = `${tabName}!A:Z`;
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values.map((v) => (v ?? "")) ] },
  });
  // updatedRange は "予約!A12:J12" のような形式。最後の行番号を抽出
  const match = /![A-Z]+(\d+):/.exec(res.data.updates?.updatedRange ?? "");
  return { rowNumber: match ? Number(match[1]) : null };
}

// 範囲を 2D 配列で書き込み（既存内容を上書き）
export async function writeRange(
  spreadsheetId: string,
  range: string,
  values: (string | number | null)[][],
): Promise<void> {
  const sheets = getSheetsClient();
  const cleaned = values.map((row) => row.map((v) => (v ?? "")));
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: cleaned },
  });
}

// タブの全データをクリア
export async function clearTab(spreadsheetId: string, tabName: string): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${tabName}!A:Z`,
  });
}

// シートID取得（書式設定で使う）
async function getSheetIdByTitle(spreadsheetId: string, title: string): Promise<number | null> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const found = (meta.data.sheets ?? []).find((s) => s.properties?.title === title);
  return found?.properties?.sheetId ?? null;
}

// タブの書式設定：ヘッダー行を太字＋背景色、1 行目固定
export async function applyTabFormatting(
  spreadsheetId: string,
  tabName: string,
  headerColumnCount: number,
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = await getSheetIdByTitle(spreadsheetId, tabName);
  if (sheetId === null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // ヘッダー行のスタイル
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: headerColumnCount,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.86, green: 0.97, blue: 0.94 },
                textFormat: { bold: true },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        // 1 行目を固定
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        // 列幅を自動
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: "COLUMNS",
              startIndex: 0,
              endIndex: headerColumnCount,
            },
          },
        },
      ],
    },
  });
}

// スケジュールタブのカラー塗り分け（残数 0=赤系, 1+=緑系, 空文字=灰系）
export async function applyScheduleFormatting(
  spreadsheetId: string,
  tabName: string,
  startRow: number, // データ開始行（0 始まり）
  rowCount: number,
  colCount: number, // 日付列数（時間ラベル列を除く）
): Promise<void> {
  const sheets = getSheetsClient();
  const sheetId = await getSheetIdByTitle(spreadsheetId, tabName);
  if (sheetId === null) return;

  const dataRange = {
    sheetId,
    startRowIndex: startRow,
    endRowIndex: startRow + rowCount,
    startColumnIndex: 1,
    endColumnIndex: 1 + colCount,
  };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        // 既存の条件付き書式をクリア（タブ全体）
        // ※ Sheets API では条件付き書式の一括削除が難しいので、まず空セル＝灰のみ追加
        // 「-」 → 灰色
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [dataRange],
              booleanRule: {
                condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "-" }] },
                format: {
                  backgroundColor: { red: 0.95, green: 0.95, blue: 0.95 },
                  textFormat: { foregroundColor: { red: 0.6, green: 0.6, blue: 0.6 } },
                },
              },
            },
            index: 0,
          },
        },
        // 「×」 → 赤
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [dataRange],
              booleanRule: {
                condition: { type: "TEXT_EQ", values: [{ userEnteredValue: "×" }] },
                format: {
                  backgroundColor: { red: 0.99, green: 0.92, blue: 0.92 },
                  textFormat: { foregroundColor: { red: 0.7, green: 0.2, blue: 0.2 } },
                },
              },
            },
            index: 0,
          },
        },
        // 「○」始まり → 緑
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [dataRange],
              booleanRule: {
                condition: { type: "TEXT_STARTS_WITH", values: [{ userEnteredValue: "○" }] },
                format: {
                  backgroundColor: { red: 0.88, green: 0.96, blue: 0.92 },
                  textFormat: {
                    foregroundColor: { red: 0.1, green: 0.55, blue: 0.35 },
                    bold: true,
                  },
                },
              },
            },
            index: 0,
          },
        },
        // セル中央寄せ
        {
          repeatCell: {
            range: dataRange,
            cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
            fields: "userEnteredFormat.horizontalAlignment",
          },
        },
        // ヘッダー行（日付）
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: startRow - 1,
              endRowIndex: startRow,
              startColumnIndex: 0,
              endColumnIndex: 1 + colCount,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.86, green: 0.97, blue: 0.94 },
                textFormat: { bold: true },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        // 凍結
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: { frozenRowCount: startRow, frozenColumnCount: 1 },
            },
            fields: "gridProperties.frozenRowCount,gridProperties.frozenColumnCount",
          },
        },
      ],
    },
  });
}

// 当日タブの「本文（予約記入域）」だけを消す：値とデータ検証を削除し、枠線・列Aの時間・見出しは残す
function colLetter(col1: number): string {
  let s = "";
  let col = col1;
  while (col > 0) {
    const r = (col - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

export async function clearReservationBody(
  spreadsheetId: string,
  tabName: string,
  firstRow1: number,
  lastRow1: number,
  firstCol1: number,
  lastCol1: number,
): Promise<void> {
  const sheets = getSheetsClient();
  const range = `${tabName}!${colLetter(firstCol1)}${firstRow1}:${colLetter(lastCol1)}${lastRow1}`;
  await sheets.spreadsheets.values.clear({ spreadsheetId, range });

  const sheetId = await getSheetIdByTitle(spreadsheetId, tabName);
  if (sheetId === null) return;
  // データ検証（プルダウン等）を解除してから書けるようにする
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: firstRow1 - 1,
              endRowIndex: lastRow1,
              startColumnIndex: firstCol1 - 1,
              endColumnIndex: lastCol1,
            },
          },
        },
      ],
    },
  });
}

export async function readRange(
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return (res.data.values ?? []) as string[][];
}

export async function updateCell(
  spreadsheetId: string,
  range: string,
  value: string,
): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[value]] },
  });
}

// シートの存在確認 + 雛形作成
export async function ensureSheetTabs(
  spreadsheetId: string,
  tabs: string[],
): Promise<{ created: string[]; existing: string[] }> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ""));
  const toCreate = tabs.filter((t) => !existingTabs.has(t));
  if (toCreate.length === 0) {
    return { created: [], existing: tabs };
  }
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toCreate.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });
  return { created: toCreate, existing: tabs.filter((t) => existingTabs.has(t)) };
}

// スプレッドシート全体への書き込み権があるかテスト
export async function verifySpreadsheetAccess(spreadsheetId: string): Promise<
  { ok: true; title: string } | { ok: false; error: string }
> {
  try {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title" });
    return { ok: true, title: res.data.properties?.title ?? "(no title)" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// 全タブ名を取得
export async function listTabs(spreadsheetId: string): Promise<string[]> {
  const sheets = getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? "")
    .filter((t) => t.length > 0);
}
