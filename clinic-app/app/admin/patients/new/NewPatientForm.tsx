"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { listClinics } from "@/lib/clinics";

const CLINICS = listClinics();

export default function NewPatientForm() {
  const router = useRouter();
  const [chartNumber, setChartNumber] = useState("");
  const [name, setName] = useState("");
  const [furigana, setFurigana] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [clinicId, setClinicId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chart_number: chartNumber,
          name,
          furigana: furigana || null,
          birth_date: birthDate || null,
          notes: notes || null,
          clinic_id: clinicId || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "chart_number_taken") {
          setError("そのカルテ番号は既に登録されています");
        } else if (json?.error === "missing_fields") {
          setError("カルテ番号と氏名を入力してください");
        } else {
          setError("登録に失敗しました");
        }
        return;
      }
      router.replace(`/admin/patients/${json.id}`);
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
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
        placeholder="例: A0001"
      />
      <Field
        id="name"
        label="氏名"
        required
        value={name}
        onChange={setName}
        placeholder="例: 山田 花子"
      />
      <Field
        id="furigana"
        label="ふりがな"
        value={furigana}
        onChange={setFurigana}
        placeholder="例: やまだ はなこ"
      />
      <Field
        id="birth_date"
        label="生年月日"
        type="date"
        value={birthDate}
        onChange={setBirthDate}
      />

      <ClinicSelector value={clinicId} onChange={setClinicId} />

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
          href="/admin"
          className="flex-1 text-center rounded-full border border-ink-200 text-ink-700 font-bold py-3.5"
        >
          キャンセル
        </Link>
        <button
          type="submit"
          disabled={submitting || !chartNumber || !name}
          className="flex-[2] text-center rounded-full bg-accent text-ink-900 font-black tracking-widest py-3.5 shadow-soft hover:bg-accent-400 transition disabled:bg-ink-100 disabled:text-ink-300"
        >
          {submitting ? "登録中..." : "登録する"}
        </button>
      </div>
    </form>
  );
}

export function ClinicSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs tracking-widest text-ink-400 mb-1.5">
        通っている院
      </label>
      <div className="grid grid-cols-2 gap-2">
        {CLINICS.map((c) => {
          const selected = value === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(selected ? "" : c.id)}
              className={[
                "rounded-xl border px-3 py-3 text-sm font-bold transition text-center",
                selected
                  ? "border-accent bg-accent-50 text-ink-900"
                  : "border-ink-200 bg-white text-ink-700 hover:border-accent",
              ].join(" ")}
              aria-pressed={selected}
            >
              {selected && <span className="text-accent-600 mr-1">✓</span>}
              {c.name}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-400 mt-1">
        後から編集画面で変更できます
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
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
        placeholder={placeholder}
        required={required}
        className="block w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-base text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-accent"
      />
    </div>
  );
}
