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
