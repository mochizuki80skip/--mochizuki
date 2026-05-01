"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ChartEditor from "./ChartEditor";
import type { ChartMarker } from "@/lib/types";

type Props = {
  visitId: string;
  patientId: string;
  /** カルテが存在する場合の初期値 */
  initialMarkers: ChartMarker[];
  initialFreeNote: string;
  /** 保存後の遷移先 (例: /admin/patients/<id>/charts/<chartId>) */
  redirectTo: string;
};

export default function ChartEditClient({
  visitId,
  patientId,
  initialMarkers,
  initialFreeNote,
  redirectTo,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(markers: ChartMarker[], freeNote: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/charts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visit_id: visitId,
          patient_id: patientId,
          markers,
          free_note: freeNote,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.id) {
        throw new Error(json.error || "保存に失敗しました");
      }
      const target = redirectTo.includes("__id__")
        ? redirectTo.replace("__id__", json.id)
        : redirectTo;
      router.push(target);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700 mb-3">
          {error}
        </div>
      )}
      <ChartEditor
        initialMarkers={initialMarkers}
        initialFreeNote={initialFreeNote}
        onSave={handleSave}
        saving={saving}
      />
    </>
  );
}
