import { z } from "zod";
import { Blocks, buildMessages } from "@/lib/campaign-blocks";

export const MAX_STEPS = 30;

export const ScenarioInput = z
  .object({
    name: z.string().trim().min(1, "シナリオ名を入力してください").max(120),
    description: z.string().max(500).nullable().optional(),
    triggerType: z.enum(["follow", "tag_added"]),
    triggerTagId: z.string().nullable().optional(),
    isActive: z.boolean().default(true),
    steps: z
      .array(
        z.object({
          // 前のステップ（先頭はトリガー）からの待ち時間（分）。sendTime 指定時は日数×1440
          delayMinutes: z.number().int().min(0).max(60 * 24 * 365),
          sendTime: z
            .string()
            .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "送信時刻は HH:mm 形式で指定してください")
            .nullable()
            .optional(),
          blocks: Blocks,
        }),
      )
      .min(1, "ステップを 1 つ以上追加してください")
      .max(MAX_STEPS),
  })
  .superRefine((v, ctx) => {
    if (v.triggerType === "tag_added" && !v.triggerTagId) {
      ctx.addIssue({ code: "custom", message: "トリガーにするタグを選択してください", path: ["triggerTagId"] });
    }
  });

export type ScenarioInputT = z.infer<typeof ScenarioInput>;

// DB 保存用のステップ（LINE 形式に変換し、編集用ブロックも保持する）
export function buildStepRows(input: ScenarioInputT, baseUrl: string) {
  return input.steps.map((s, order) => ({
    order,
    delayMinutes: s.delayMinutes,
    sendTime: s.sendTime ?? null,
    blocks: s.blocks as object[],
    messages: buildMessages(s.blocks, baseUrl) as object[],
  }));
}
