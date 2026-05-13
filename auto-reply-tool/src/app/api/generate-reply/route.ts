import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gemini, GEMINI_MODEL } from "@/lib/gemini";

/**
 * 返信案 3 つを生成。
 *
 * トレーナー個性 + お客様背景 + お約束背景 + 過去会話 + トレンドを統合して
 * 「あなたが書いた風」の返信を作る。
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

  // --- Fetch all context in parallel ---------------------------------
  const [customerRes, promisesRes, reportsRes, trainerRes] = await Promise.all(
    [
      supabase
        .from("customers")
        .select("name, goal, tone_memo, notes")
        .eq("id", body.customerId)
        .single(),
      supabase
        .from("promises")
        .select("title, unit, target, is_active, notes, started_at")
        .eq("customer_id", body.customerId)
        .eq("is_active", true),
      supabase
        .from("reports")
        .select(
          "customer_msg, staff_reply, achievements, report_date, created_by"
        )
        .eq("customer_id", body.customerId)
        .not("staff_reply", "is", null)
        .order("report_date", { ascending: false })
        .limit(15),
      supabase
        .from("trainers")
        .select(
          "display_name, personality_memo, characteristic_phrases, signature_emoji"
        )
        .eq("id", user.id)
        .maybeSingle(),
    ]
  );

  const customer = customerRes.data;
  if (!customer) {
    return NextResponse.json({ error: "customer not found" }, { status: 404 });
  }

  const activePromises = (promisesRes.data ?? []) as Array<{
    title: string;
    unit: string | null;
    target: number | null;
    notes: string | null;
    started_at: string | null;
  }>;

  type PastReport = {
    customer_msg: string | null;
    staff_reply: string;
    achievements:
      | Array<{
          title: string;
          status: string;
          value: number | null;
          unit: string | null;
        }>
      | null;
    report_date: string;
    created_by: string | null;
  };
  const pastReports = (reportsRes.data ?? []) as PastReport[];

  const trainer = trainerRes.data;

  // --- Compute conversation continuity hints -------------------------
  const myPastReports = pastReports.filter((r) => r.created_by === user.id);
  const otherPastReports = pastReports.filter((r) => r.created_by !== user.id);

  let daysSinceLast: number | null = null;
  if (pastReports.length > 0) {
    const last = new Date(pastReports[0].report_date);
    const today = new Date();
    last.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    daysSinceLast = Math.round(
      (today.getTime() - last.getTime()) / 86400000
    );
  }

  // Per-promise streaks from past reports
  const streakLines: string[] = [];
  for (const p of activePromises) {
    let streak = 0;
    for (const r of pastReports) {
      const hit = (r.achievements ?? []).find((a) => a.title === p.title);
      if (!hit) break;
      if (hit.status === "done") streak += 1;
      else break;
    }
    if (streak >= 2) {
      streakLines.push(`- ${p.title}: ${streak} 回連続達成中`);
    }
  }

  // --- Build prompts -------------------------------------------------
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

  const trainerBlock = trainer
    ? [
        `あなたの名前は「${trainer.display_name}」です。返信は必ずあなた自身の声で書きます。`,
        trainer.personality_memo
          ? `\n## あなたの個性\n${trainer.personality_memo}`
          : "",
        trainer.characteristic_phrases
          ? `\n## あなたがよく使う言い回し\n${trainer.characteristic_phrases}`
          : "",
        trainer.signature_emoji
          ? `\n## あなたがよく使う絵文字\n${trainer.signature_emoji}\n(これら以外の絵文字は控えめに)`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "あなたはパーソナルジム「ONE'S BODY」のトレーナーです。";

  const systemPrompt = [
    trainerBlock,
    "",
    "## ルール",
    "- 過去の自分の返信例があれば、口調・絵文字の頻度・改行の癖を最優先で真似る",
    "- 他のトレーナーの返信例は会話の流れ把握用。口調は真似しない",
    "- 数値が出ているときは具体的に触れる",
    "- 連続達成中ならそれを必ず触れて称える",
    "- 未達でも責めず、お客様の事情を踏まえて小さな次の一歩を提案",
    "- 距離感メモ・背景ノートがあれば最優先で守る",
    "- 1返信あたり 2〜4 文程度",
    "- 出力は JSON 配列で 3 案返す: [\"案1\", \"案2\", \"案3\"]",
    "  ※ 余計な前置きや説明は不要、JSON 配列だけ",
  ].join("\n");

  const promisesText =
    activePromises.length === 0
      ? "(有効なお約束なし)"
      : activePromises
          .map((p) => {
            const lines = [
              `- ${p.title}${
                p.target !== null
                  ? ` (目標: ${p.target}${p.unit ?? ""})`
                  : ""
              }${p.started_at ? ` / ${p.started_at} から取り組み中` : ""}`,
            ];
            if (p.notes) lines.push(`  背景: ${p.notes.replace(/\n/g, " ")}`);
            return lines.join("\n");
          })
          .join("\n");

  const fewShotText = (() => {
    if (pastReports.length === 0) return "(過去履歴なし)";
    return pastReports
      .slice()
      .reverse()
      .map((r, i) => {
        const isMine = r.created_by === user.id;
        const tag = isMine ? "【あなた本人の返信】" : "【他のトレーナーの返信】";
        const achText =
          Array.isArray(r.achievements) && r.achievements.length > 0
            ? r.achievements
                .map(
                  (a) =>
                    `${a.title}: ${a.status === "done" ? "達成" : "未達"}${
                      a.value !== null ? ` (${a.value}${a.unit ?? ""})` : ""
                    }`
                )
                .join(", ")
            : "(達成状況なし)";
        return [
          `### 例 ${i + 1} (${r.report_date}) ${tag}`,
          `達成状況: ${achText}`,
          `お客様コメント: ${r.customer_msg ?? "(なし)"}`,
          `スタッフ返信: ${r.staff_reply}`,
        ].join("\n");
      })
      .join("\n\n");
  })();

  const continuityHints: string[] = [];
  if (daysSinceLast !== null) {
    if (daysSinceLast === 0) continuityHints.push("- 今日すでに1度やり取りしている");
    else if (daysSinceLast === 1)
      continuityHints.push("- 前回の返信から1日");
    else if (daysSinceLast <= 7)
      continuityHints.push(`- 前回の返信から ${daysSinceLast} 日`);
    else if (daysSinceLast <= 30)
      continuityHints.push(
        `- 前回の返信から ${daysSinceLast} 日 (少し間が空いた)`
      );
    else
      continuityHints.push(
        `- 前回の返信から ${daysSinceLast} 日 (久しぶりの再開)`
      );
  }
  continuityHints.push(
    `- 過去履歴: 自分の返信 ${myPastReports.length} 件 / 他トレーナー ${otherPastReports.length} 件`
  );
  if (streakLines.length > 0) {
    continuityHints.push(...streakLines);
  }

  const userPrompt = [
    `# お客様プロフィール`,
    `- 名前: ${customer.name}`,
    `- 目標: ${customer.goal ?? "(未登録)"}`,
    `- 距離感メモ: ${customer.tone_memo ?? "(未登録)"}`,
    customer.notes ? `- 背景ノート:\n${indent(customer.notes, "  ")}` : "",
    "",
    `# お客様のお約束`,
    promisesText,
    "",
    `# 直近の流れ`,
    continuityHints.join("\n"),
    "",
    `# 過去のスタッフ返信 (時系列順、古→新)`,
    `※「あなた本人の返信」は口調を最優先で真似ること`,
    "",
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
    `上記をすべて踏まえて、返信案を 3 つ JSON 配列で出力してください。`,
    `必ずあなた (${trainer?.display_name ?? "トレーナー"}) の口調で書くこと。`,
  ]
    .filter((s) => s !== "")
    .join("\n");

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

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
}
