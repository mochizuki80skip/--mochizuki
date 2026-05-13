import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";

/**
 * 返信案 3 つを生成。
 *
 * リクエスト body:
 *   {
 *     customerId: string,
 *     achievements?: Array<{ promiseTitle: string; status: "done" | "miss"; value?: number; unit?: string }>,
 *     customerMsg?: string,
 *     tone?: "normal" | "encourage" | "praise",
 *   }
 *
 * 過去 5 件の採用済み返信を few-shot として注入して、口調を学習させる。
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    customerId?: string;
    achievements?: Array<{
      promiseTitle: string;
      status: "done" | "miss";
      value?: number;
      unit?: string;
    }>;
    customerMsg?: string;
    tone?: "normal" | "encourage" | "praise";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("name, goal, tone_memo")
    .eq("id", body.customerId)
    .single();

  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const { data: pastReports } = await supabase
    .from("reports")
    .select("customer_msg, staff_reply, achievements, report_date")
    .eq("customer_id", body.customerId)
    .not("staff_reply", "is", null)
    .order("report_date", { ascending: false })
    .limit(5);

  const toneLabel: Record<string, string> = {
    normal: "いつも通りの距離感",
    encourage: "少し背中を押すように",
    praise: "しっかり褒めて喜ぶ",
  };

  const achievementsText =
    (body.achievements ?? [])
      .map((a) => {
        const v = a.value !== undefined ? ` (${a.value}${a.unit ?? ""})` : "";
        return `- ${a.promiseTitle}: ${a.status === "done" ? "達成" : "未達"}${v}`;
      })
      .join("\n") || "(達成状況の入力なし)";

  const fewShotText =
    pastReports && pastReports.length > 0
      ? pastReports
          .reverse()
          .map((r, i) => {
            const achText = Array.isArray(r.achievements)
              ? (r.achievements as Array<{
                  title: string;
                  status: string;
                  value: number | null;
                  unit: string | null;
                }>)
                  .map(
                    (a) =>
                      `${a.title}: ${a.status === "done" ? "達成" : "未達"}${
                        a.value !== null ? ` (${a.value}${a.unit ?? ""})` : ""
                      }`
                  )
                  .join(", ") || "(達成状況なし)"
              : "(達成状況なし)";
            return [
              `## 例 ${i + 1} (${r.report_date})`,
              `達成状況: ${achText}`,
              `お客様コメント: ${r.customer_msg ?? "(なし)"}`,
              `スタッフ返信: ${r.staff_reply}`,
            ].join("\n");
          })
          .join("\n\n")
      : "(過去履歴なし)";

  const systemPrompt = [
    "あなたはパーソナルジム「ONE'S BODY」のトレーナーです。",
    "kaloko アプリの「お約束」(歩数や水分摂取など) に対する報告に、",
    "お客様一人ひとりに寄り添った、人間味のある返信を作ります。",
    "",
    "ルール:",
    "- 数値が出ているときは具体的に触れる",
    "- 未達のときも責めず、小さな次の一歩を提案する",
    "- 距離感メモがあればそれを最優先に守る",
    "- 過去のスタッフ返信例があれば、その口調・絵文字の使い方・改行の癖をできるだけ真似る",
    "- 1返信あたり 2〜4 文程度。長すぎない",
    "- 出力は JSON 配列で 3 案返す: [\"案1\", \"案2\", \"案3\"]",
    "  ※ 余計な前置きや説明は不要、JSON 配列だけを返す",
  ].join("\n");

  const userPrompt = [
    `# お客様プロフィール`,
    `- 名前: ${customer.name}`,
    `- 目標: ${customer.goal ?? "(未登録)"}`,
    `- 距離感メモ: ${customer.tone_memo ?? "(未登録)"}`,
    "",
    `# 過去のスタッフ返信例 (口調をできるだけ真似ること)`,
    fewShotText,
    "",
    `# 今回のトーン指示`,
    `- ${toneLabel[body.tone ?? "normal"]}`,
    "",
    `# 今日の達成状況`,
    achievementsText,
    "",
    `# 今日のお客様コメント`,
    body.customerMsg?.trim() || "(なし)",
    "",
    `上記を踏まえて返信案を 3 つ JSON 配列で出力してください。`,
  ].join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const text = (response.text ?? "").trim();

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) suggestions = parsed.map(String);
    } catch {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          suggestions = JSON.parse(match[0]);
        } catch {
          suggestions = [text];
        }
      } else {
        suggestions = [text];
      }
    }

    return NextResponse.json({ suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "gemini_api_failed", detail: msg },
      { status: 500 }
    );
  }
}
