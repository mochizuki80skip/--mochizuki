"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { BlockInput } from "@/lib/campaign-blocks";
import { MAX_STEPS } from "@/lib/scenario-input";
import { cumulativeLabels } from "@/lib/scenario-labels";
import { MessageEditor } from "@/components/message/MessageEditor";
import { BlockPreview } from "@/components/message/BlockPreview";

type Tag = { id: string; name: string };
type Unit = "minute" | "hour" | "day";
type StepState = {
  mode: "elapsed" | "time"; // 経過時間後 / 日数＋時刻
  value: number; // elapsed: 数値
  unit: Unit;
  days: number; // time: 日数
  time: string; // time: HH:mm
  blocks: BlockInput[];
};

const UNIT_MIN: Record<Unit, number> = { minute: 1, hour: 60, day: 1440 };
const UNIT_LABEL: Record<Unit, string> = { minute: "分", hour: "時間", day: "日" };

export type InitialStep = { delayMinutes: number; sendTime: string | null; blocks: BlockInput[] };

function toState(s: InitialStep): StepState {
  if (s.sendTime) {
    return { mode: "time", value: 0, unit: "minute", days: Math.floor(s.delayMinutes / 1440), time: s.sendTime, blocks: s.blocks };
  }
  const unit: Unit = s.delayMinutes > 0 && s.delayMinutes % 1440 === 0 ? "day" : s.delayMinutes > 0 && s.delayMinutes % 60 === 0 ? "hour" : "minute";
  return { mode: "elapsed", value: s.delayMinutes / UNIT_MIN[unit], unit, days: 1, time: "10:00", blocks: s.blocks };
}

function blankStep(first: boolean): StepState {
  return first
    ? { mode: "elapsed", value: 0, unit: "minute", days: 0, time: "10:00", blocks: [{ type: "text", text: "" }] }
    : { mode: "time", value: 0, unit: "minute", days: 1, time: "10:00", blocks: [{ type: "text", text: "" }] };
}

// 接骨院向けのサンプル（初回来院後のフォロー）
const SAMPLE: InitialStep[] = [
  { delayMinutes: 0, sendTime: null, blocks: [{ type: "text", text: "友だち追加ありがとうございます！\n施術のご案内やお得な情報をお届けします。" }] },
  { delayMinutes: 1440, sendTime: "10:00", blocks: [{ type: "text", text: "先日はご来院ありがとうございました。\nその後、お身体の調子はいかがでしょうか？" }] },
  { delayMinutes: 6 * 1440, sendTime: "10:00", blocks: [{ type: "text", text: "お身体のメンテナンスは続けることが大切です。\n次回のご予約はお気軽にどうぞ。" }] },
];

export function ScenarioForm({
  channelId,
  tags,
  initial,
}: {
  channelId: string;
  tags: Tag[];
  initial?: {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    triggerTagId: string | null;
    isActive: boolean;
    steps: InitialStep[];
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "follow");
  const [triggerTagId, setTriggerTagId] = useState(initial?.triggerTagId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [steps, setSteps] = useState<StepState[]>(initial ? initial.steps.map(toState) : [blankStep(true)]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<StepState>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...p } : s)));
  const payloadSteps = steps.map((s) =>
    s.mode === "time"
      ? { delayMinutes: Math.max(0, Math.floor(s.days)) * 1440, sendTime: s.time || null, blocks: s.blocks }
      : { delayMinutes: Math.max(0, Math.floor(s.value)) * UNIT_MIN[s.unit], sendTime: null, blocks: s.blocks },
  );
  const cumulative = cumulativeLabels(payloadSteps);
  const triggerWord = triggerType === "follow" ? "友だち追加" : "タグ付与";

  function save() {
    setError(null);
    start(async () => {
      const body = {
        name,
        description: description || null,
        triggerType,
        triggerTagId: triggerType === "tag_added" ? triggerTagId || null : null,
        isActive,
        steps: payloadSteps,
      };
      const res = await fetch(
        initial ? `/api/channels/${channelId}/scenarios/${initial.id}` : `/api/channels/${channelId}/scenarios`,
        { method: initial ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      );
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "保存に失敗しました");
        return;
      }
      router.push(`/dashboard/c/${channelId}/scenarios`);
      router.refresh();
    });
  }

  const field = "mt-1 w-full border rounded px-3 py-2 text-sm";

  return (
    <div className="space-y-5 max-w-4xl">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">{error}</div>}

      <section className="bg-white border rounded p-5 space-y-4">
        <h2 className="font-semibold">1. 基本設定</h2>
        {!initial && (
          <button
            type="button"
            className="text-sm underline text-line-dark"
            onClick={() => {
              setName("初回来院フォロー");
              setDescription("友だち追加の直後・翌日・1週間後にメッセージを送る");
              setTriggerType("follow");
              setSteps(SAMPLE.map(toState));
            }}
          >
            サンプル（初回来院フォロー）を入れてみる
          </button>
        )}
        <div>
          <label className="block text-sm font-medium">シナリオ名（管理用）</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="例：初回来院フォロー" />
        </div>
        <div>
          <label className="block text-sm font-medium">メモ（任意）</label>
          <input value={description ?? ""} onChange={(e) => setDescription(e.target.value)} className={field} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          有効にする（オフの間は新しい友だちに対して開始されません）
        </label>
      </section>

      <section className="bg-white border rounded p-5 space-y-3">
        <h2 className="font-semibold">2. いつ開始する？（トリガー）</h2>
        <div className="flex flex-wrap gap-3 items-start">
          <label className={`border rounded px-4 py-3 text-sm cursor-pointer ${triggerType === "follow" ? "bg-line-light border-line" : ""}`}>
            <input type="radio" className="mr-2" checked={triggerType === "follow"} onChange={() => setTriggerType("follow")} />
            友だち追加されたとき
          </label>
          <label className={`border rounded px-4 py-3 text-sm cursor-pointer ${triggerType === "tag_added" ? "bg-line-light border-line" : ""}`}>
            <input type="radio" className="mr-2" checked={triggerType === "tag_added"} onChange={() => setTriggerType("tag_added")} />
            タグが付いたとき
          </label>
          {triggerType === "tag_added" && (
            <select value={triggerTagId ?? ""} onChange={(e) => setTriggerTagId(e.target.value)} className="border rounded px-3 py-2 text-sm self-center">
              <option value="">タグを選択</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <p className="text-xs text-gray-500">
          開始されるのは、有効にした<b>以降</b>に{triggerWord}された人からです。すでに友だちの人には送られません。同じ人に同じシナリオは 1 回だけ送られます。
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">3. 何を・いつ送る？（ステップ）</h2>
        {steps.map((s, i) => (
          <div key={i} className="bg-white border rounded p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">
                ステップ {i + 1}
                <span className="ml-2 text-xs font-normal text-gray-500">
                  {triggerWord}から {cumulative[i]}
                </span>
              </div>
              {steps.length > 1 && (
                <button type="button" aria-label="ステップを削除" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="p-1 text-gray-500 hover:text-red-600">
                  <Trash2 size={15} />
                </button>
              )}
            </div>

            <div className="bg-gray-50 rounded p-3 text-sm space-y-2">
              <div className="text-xs text-gray-500">送るタイミング（{i === 0 ? triggerWord : "前のステップ"}を起点にします）</div>
              <label className="flex flex-wrap items-center gap-2">
                <input type="radio" checked={s.mode === "elapsed"} onChange={() => patch(i, { mode: "elapsed" })} />
                経過時間で指定：{i === 0 ? triggerWord : "前のステップ"}から
                <input
                  type="number"
                  min={0}
                  value={s.value}
                  disabled={s.mode !== "elapsed"}
                  onChange={(e) => patch(i, { value: Number(e.target.value) })}
                  className="border rounded px-2 py-1 w-20 disabled:opacity-40"
                />
                <select value={s.unit} disabled={s.mode !== "elapsed"} onChange={(e) => patch(i, { unit: e.target.value as Unit })} className="border rounded px-2 py-1 disabled:opacity-40">
                  {(Object.keys(UNIT_LABEL) as Unit[]).map((u) => (
                    <option key={u} value={u}>
                      {UNIT_LABEL[u]}
                    </option>
                  ))}
                </select>
                後{s.mode === "elapsed" && s.value === 0 && <span className="text-xs text-gray-500">（0 = すぐ）</span>}
              </label>
              <label className="flex flex-wrap items-center gap-2">
                <input type="radio" checked={s.mode === "time"} onChange={() => patch(i, { mode: "time" })} />
                日数と時刻で指定：{i === 0 ? triggerWord : "前のステップ"}の
                <input
                  type="number"
                  min={0}
                  value={s.days}
                  disabled={s.mode !== "time"}
                  onChange={(e) => patch(i, { days: Number(e.target.value) })}
                  className="border rounded px-2 py-1 w-16 disabled:opacity-40"
                />
                日後の
                <input type="time" value={s.time} disabled={s.mode !== "time"} onChange={(e) => patch(i, { time: e.target.value })} className="border rounded px-2 py-1 disabled:opacity-40" />
                （日本時間）
              </label>
              {s.mode === "time" && s.days === 0 && (
                <div className="text-xs text-gray-500">0 日後で、その時刻をすでに過ぎている場合はすぐに送られます。</div>
              )}
            </div>

            <div className="grid md:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
              <MessageEditor blocks={s.blocks} onChange={(blocks) => patch(i, { blocks })} />
              <div className="space-y-1">
                <div className="text-xs text-gray-500">プレビュー</div>
                <BlockPreview blocks={s.blocks} />
              </div>
            </div>
          </div>
        ))}
        {steps.length < MAX_STEPS && (
          <button type="button" onClick={() => setSteps([...steps, blankStep(false)])} className="border rounded px-3 py-2 text-sm bg-white flex items-center gap-1">
            <Plus size={14} /> ステップを追加
          </button>
        )}
      </section>

      {initial && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs rounded p-3">
          編集の反映範囲：すでに開始している人の<b>未送信ステップ</b>は、本文が新しい内容に変わります（送信予定の日時は開始時に決まっているため変わりません）。
          ステップを新しく追加しても、すでに開始している人には送られません。
        </div>
      )}

      <button onClick={save} disabled={pending} className="bg-line text-white px-5 py-2 rounded text-sm disabled:opacity-50">
        {pending ? "保存中…" : "保存"}
      </button>
    </div>
  );
}
