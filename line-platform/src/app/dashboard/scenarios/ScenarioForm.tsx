"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Tag = { id: string; name: string };
type Step = { delayMinutes: number; text: string };

export function ScenarioForm({
  tags,
  initial,
}: {
  tags: Tag[];
  initial?: {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    triggerTagId: string | null;
    isActive: boolean;
    steps: { delayMinutes: number; messages: unknown }[];
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [triggerType, setTriggerType] = useState(initial?.triggerType ?? "follow");
  const [triggerTagId, setTriggerTagId] = useState(initial?.triggerTagId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [steps, setSteps] = useState<Step[]>(
    initial?.steps.map((s) => {
      const m = (s.messages as Array<{ type: string; text?: string }>)[0];
      return { delayMinutes: s.delayMinutes, text: m?.text ?? "" };
    }) ?? [{ delayMinutes: 0, text: "" }],
  );
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateStep(i: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addStep() {
    setSteps((prev) => [...prev, { delayMinutes: 60, text: "" }]);
  }
  function removeStep(i: number) {
    setSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    start(async () => {
      const body = {
        name,
        description,
        triggerType,
        triggerTagId: triggerType === "tag_added" ? triggerTagId : null,
        isActive,
        steps: steps.map((s, i) => ({
          order: i,
          delayMinutes: s.delayMinutes,
          messages: [{ type: "text", text: s.text }],
        })),
      };
      const url = initial ? `/api/scenarios/${initial.id}` : "/api/scenarios";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setError(e.error ?? "保存に失敗しました");
        return;
      }
      router.push("/dashboard/scenarios");
      router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-5 max-w-2xl">
      {error && <div className="text-sm text-red-600">{error}</div>}

      <div>
        <label className="block text-sm font-medium">シナリオ名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">説明</label>
        <input
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <div>
          <label className="block text-sm font-medium">トリガー</label>
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="mt-1 border rounded px-3 py-2 text-sm"
          >
            <option value="follow">友だち追加時</option>
            <option value="tag_added">タグ付与時</option>
          </select>
        </div>
        {triggerType === "tag_added" && (
          <div>
            <label className="block text-sm font-medium">対象タグ</label>
            <select
              value={triggerTagId ?? ""}
              onChange={(e) => setTriggerTagId(e.target.value)}
              className="mt-1 border rounded px-3 py-2 text-sm"
            >
              <option value="">選択してください</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="flex items-center gap-2 mt-7 text-sm">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          有効
        </label>
      </div>

      <div className="space-y-3">
        <h2 className="font-medium">ステップ</h2>
        {steps.map((s, i) => (
          <div key={i} className="border rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Step {i + 1}</span>
              <input
                type="number"
                min={0}
                value={s.delayMinutes}
                onChange={(e) => updateStep(i, { delayMinutes: Number(e.target.value) })}
                className="border rounded px-2 py-1 text-sm w-20"
              />
              <span className="text-xs text-gray-500">分後に送信</span>
              <button onClick={() => removeStep(i)} className="ml-auto text-red-600 text-xs">
                削除
              </button>
            </div>
            <textarea
              value={s.text}
              onChange={(e) => updateStep(i, { text: e.target.value })}
              rows={3}
              placeholder="本文"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button onClick={addStep} className="text-sm text-line-dark hover:underline">
          + ステップを追加
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
        >
          保存
        </button>
      </div>
    </div>
  );
}
