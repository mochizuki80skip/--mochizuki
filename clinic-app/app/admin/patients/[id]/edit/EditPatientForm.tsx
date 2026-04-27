"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Patient } from "@/lib/types";
import { getClinic } from "@/lib/clinics";
import { ClinicSelector } from "../../new/NewPatientForm";

type Props = {
  patient: Patient;
  /** Master can transfer between clinics and delete; clinic admins cannot. */
  masterMode: boolean;
};

export default function EditPatientForm({ patient, masterMode }: Props) {
  const router = useRouter();
  const [chartNumber, setChartNumber] = useState(patient.chart_number);
  const [name, setName] = useState(patient.name);
  const [furigana, setFurigana] = useState(patient.furigana || "");
  const [birthDate, setBirthDate] = useState(patient.birth_date || "");
  const [clinicId, setClinicId] = useState(patient.clinic_id || "");
  const [notes, setNotes] = useState(patient.notes || "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Clinic admins are not allowed to change clinic_id; we omit the field
      // entirely in their requests so the API doesn't even consider a change.
      const payload: Record<string, unknown> = {
        chart_number: chartNumber,
        name,
        furigana: furigana || null,
        birth_date: birthDate || null,
        notes: notes || null,
      };
      if (masterMode) payload.clinic_id = clinicId || null;
      const res = await fetch(`/api/admin/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "chart_number_taken") {
          setError("そのカルテ番号は既に同じ院で使われています");
        } else if (json?.error === "missing_fields") {
          setError("カルテ番号と氏名は必須です");
        } else if (json?.error === "clinic_change_master_only") {
          setError("院の変更は院長権限でのみ可能です");
        } else {
          setError("保存に失敗しました");
        }
        return;
      }
      router.replace(`/admin/patients/${patient.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete() {
    const ok = window.confirm(
      `${patient.name} さん（${patient.chart_number}）を削除します。\n\n` +
        `診断履歴もすべて削除されます。この操作は取り消せません。\n` +
        `本当に削除しますか？`,
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/patients/${patient.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("削除に失敗しました");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field
        id="chart_number"
        label="カルテ番号"
        required
        value={chartNumber}
        onChange={setChartNumber}
        hint="変更すると患者ログインに使う番号が変わります"
      />
      <Field
        id="name"
        label="氏名"
        required
        value={name}
        onChange={setName}
        hint="患者ログイン時の照合に使う名前です"
      />
      <Field
        id="furigana"
        label="ふりがな"
        value={furigana}
        onChange={setFurigana}
      />
      <Field
        id="birth_date"
        label="生年月日"
        type="date"
        value={birthDate}
        onChange={setBirthDate}
      />

      {masterMode ? (
        <ClinicSelector value={clinicId} onChange={setClinicId} />
      ) : (
        <div>
          <label className="block text-xs tracking-widest text-ink-400 mb-1.5">
            通っている院
          </label>
          <div className="rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-sm font-bold text-ink-900">
            {getClinic(patient.clinic_id)?.name || "（未設定）"}
          </div>
          <p className="text-[11px] text-ink-400 mt-1">
            院の変更（移籍）は院長権限が必要です
          </p>
        </div>
      )}

      <div>
        <label
          htmlFor="notes"
          className="block text-xs tracking-widest text-ink-400 mb-1.5"
        >
          メモ
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="既往歴、初診時の主訴など"
        />
      </div>

      {error && (
        <div className="rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Link
          href={`/admin/patients/${patient.id}`}
          className="flex-1 text-center rounded-full border border-ink-200 text-ink-700 font-bold py-3.5"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={submitting || !chartNumber || !name}
          className="flex-[2] text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
        >
          {submitting ? "保存中..." : "保存する"}
        </button>
      </div>

      {masterMode && (
        <div className="pt-8 mt-8 border-t border-ink-100">
          <h2 className="text-xs tracking-widest text-rose-500 mb-2">
            DANGER ZONE
          </h2>
          <p className="text-xs text-ink-500 mb-3 leading-relaxed">
            この患者と全ての診断履歴を削除します。元に戻せません。
            （削除は院長権限でのみ可能です）
          </p>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="block w-full text-center rounded-full border border-rose-300 text-rose-700 font-bold py-3 hover:bg-rose-50 transition disabled:opacity-50"
          >
            {deleting ? "削除中..." : "この患者を削除"}
          </button>
        </div>
      )}
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs tracking-widest text-ink-400 mb-1.5"
      >
        {label}
        {required && <span className="text-accent-600 ml-1">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
      />
      {hint && <p className="text-[11px] text-ink-400 mt-1">{hint}</p>}
    </div>
  );
}
