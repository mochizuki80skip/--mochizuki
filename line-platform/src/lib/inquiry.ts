// シート連動モードの予約リクエスト処理：
// 「問い合わせ一覧」に追記 + LINE で「確認中」メッセージ送信 + DB 控え。
// 当日シートには書き込まない（スタッフが手動で確定）。

import { prisma } from "@/lib/prisma";
import { appendRow, writeRange, ensureSheetTabs, applyTabFormatting } from "@/lib/sheets";
import { pushTo } from "@/lib/line";
import type { Message } from "@line/bot-sdk";

const INQUIRY_HEADERS = [
  "受付日時", "区分", "メニュー", "第1希望", "第2希望", "第3希望",
  "お名前", "電話番号", "きっかけ", "LINE userId", "ステータス",
];

function nowJst(): string {
  return new Date(Date.now() + 9 * 60 * 60_000).toISOString().slice(0, 19).replace("T", " ");
}

export async function ensureInquiryHeader(spreadsheetId: string, tab: string) {
  await ensureSheetTabs(spreadsheetId, [tab]);
  await writeRange(spreadsheetId, `${tab}!A1:K1`, [INQUIRY_HEADERS]);
  await applyTabFormatting(spreadsheetId, tab, INQUIRY_HEADERS.length);
}

export type Preference = { date: string; time: string };

export type InquiryInput = {
  channelId: string;
  preferences: Preference[]; // 1〜3 件、[0]=第1希望
  visitType: "new" | "returning";
  customerName: string;
  customerPhone: string;
  referralSource?: string | null;
  lineUserId?: string | null;
};

const VISIT_LABEL = { new: "新規", returning: "2回目以降" } as const;

function formatDateJp(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getUTCDay()];
  return `${m}月${d}日(${w})`;
}

function prefLabel(p?: Preference): string {
  return p ? `${formatDateJp(p.date)} ${p.time}` : "";
}

export async function submitInquiry(
  input: InquiryInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await prisma.reservationSettings.findUnique({
    where: { lineChannelId: input.channelId },
  });
  if (!settings) return { ok: false, error: "予約設定が未作成です" };
  if (!settings.spreadsheetId) return { ok: false, error: "スプレッドシート未設定" };
  if (input.preferences.length === 0) return { ok: false, error: "希望日時がありません" };

  const duration =
    input.visitType === "new"
      ? settings.newPatientDurationMinutes
      : settings.returningDurationMinutes;
  const menuLabel = `${VISIT_LABEL[input.visitType]}（${duration}分）`;
  const p = input.preferences;

  // 0. DB 控え
  await prisma.inquiry
    .create({
      data: {
        lineChannelId: input.channelId,
        date: p[0].date,
        time: p[0].time,
        preferences: p,
        visitType: input.visitType,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        referralSource: input.referralSource ?? null,
        lineUserId: input.lineUserId ?? null,
        status: "pending",
      },
    })
    .catch((e) => console.error("[inquiry] DB save failed:", e));

  // 1. 問い合わせ一覧へ追記
  try {
    await ensureInquiryHeader(settings.spreadsheetId, settings.sheetTabInquiry);
    await appendRow(settings.spreadsheetId, settings.sheetTabInquiry, [
      nowJst(),
      VISIT_LABEL[input.visitType],
      menuLabel,
      prefLabel(p[0]),
      prefLabel(p[1]),
      prefLabel(p[2]),
      input.customerName,
      input.customerPhone,
      input.referralSource ?? "",
      input.lineUserId ?? "",
      "未対応",
    ]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "問い合わせ一覧への記録に失敗" };
  }

  await prisma.deliveryLog
    .create({ data: { lineChannelId: input.channelId, channel: "inquiry", status: "success" } })
    .catch(() => null);

  // 2. 「確認中」メッセージ送信
  if (input.lineUserId) {
    const prefLines = p.map((pref, i) => `第${i + 1}希望: ${prefLabel(pref)}`).join("\n");
    const template =
      settings.inquiryReplyMessage ??
      "ご予約リクエストありがとうございます。\n内容を確認のうえ、改めてご連絡いたします。少々お待ちくださいませ。\n\n▼ご希望\n{prefs}\nメニュー: {menu}\nお名前: {name}";
    const text = template
      .replace(/\{prefs\}/g, prefLines)
      .replace(/\{date\}/g, prefLabel(p[0]))
      .replace(/\{time\}/g, p[0].time)
      .replace(/\{menu\}/g, menuLabel)
      .replace(/\{name\}/g, input.customerName);
    try {
      await pushTo(input.channelId, input.lineUserId, [{ type: "text", text } as Message]);
    } catch (e) {
      console.error("[inquiry] LINE push failed:", e);
    }
  }

  return { ok: true };
}
