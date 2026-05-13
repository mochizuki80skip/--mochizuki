"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ParsedEntry = {
  date: string | null;
  customerMsg: string | null;
  staffReply: string;
  rawLine: string;
  warnings: string[];
};

const FORMAT_HELP = `1行 = 1件です。3つの形式に対応します。

【形式A】 スタッフ返信だけ(一番カンタン)
  お疲れさまでした！明日も水分こまめに🍵
  歩数達成お見事です✨

【形式B】 日付 | お客様メッセージ | スタッフ返信  (空欄もOK)
  2026-04-01 | 今日も達成しました | お見事です!明日も頑張りましょう
  2026-04-02 | | 忙しい中お疲れさまでした

【形式C】 お客様メッセージ | スタッフ返信  (日付なし)
  歩数達成しました! | 6500歩!すばらしいです
`;

function parseLines(text: string): ParsedEntry[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((line) => parseLine(line));
}

function parseLine(line: string): ParsedEntry {
  const warnings: string[] = [];
  const parts = line.split("|").map((p) => p.trim());

  if (parts.length === 1) {
    return {
      date: null,
      customerMsg: null,
      staffReply: parts[0],
      rawLine: line,
      warnings,
    };
  }

  if (parts.length === 2) {
    return {
      date: null,
      customerMsg: parts[0] || null,
      staffReply: parts[1],
      rawLine: line,
      warnings,
    };
  }

  // 3 fields以上: 日付 | お客様 | スタッフ
  const [datePart, customerPart, ...replyParts] = parts;
  const staffReply = replyParts.join(" | ").trim();
  let date: string | null = null;
  if (datePart) {
    const m = datePart.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (m) {
      const y = m[1];
      const mo = m[2].padStart(2, "0");
      const d = m[3].padStart(2, "0");
      date = `${y}-${mo}-${d}`;
    } else {
      warnings.push(`日付として認識できませんでした: "${datePart}" → 今日扱いにします`);
    }
  }
  return {
    date,
    customerMsg: customerPart || null,
    staffReply,
    rawLine: line,
    warnings,
  };
}

export function ImportForm({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<number | null>(null);

  const entries = useMemo(() => parseLines(text), [text]);
  const valid = entries.filter((e) => e.staffReply.length > 0);
  const invalid = entries.filter((e) => e.staffReply.length === 0);

  async function handleImport() {
    if (valid.length === 0) {
      setError("インポートできる返信がありません");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    const { data: userData } = await supabase.auth.getUser();
    const today = new Date().toISOString().slice(0, 10);

    const rows = valid.map((e) => ({
      customer_id: customerId,
      report_date: e.date ?? today,
      achievements: [],
      customer_msg: e.customerMsg,
      staff_reply: e.staffReply,
      tone_used: "import",
      created_by: userData.user?.id ?? null,
    }));

    const { error: insertError } = await supabase.from("reports").insert(rows);
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSuccess(rows.length);
    setText("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100">
        <h1 className="text-xl font-semibold">
          過去返信のインポート: {customerName} さん
        </h1>
        <p className="text-sm text-gray-600 mt-2">
          手元にある過去のやり取りをここに貼り付けると、AI が口調や絵文字の癖を
          学習し、次回からそれっぽい返信を出すようになります。
        </p>
      </section>

      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-3">
        <h2 className="font-semibold">フォーマット</h2>
        <pre className="text-xs bg-brand-50 border border-brand-100 rounded p-3 whitespace-pre-wrap leading-relaxed">
          {FORMAT_HELP}
        </pre>
      </section>

      <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-3">
        <h2 className="font-semibold">貼り付け欄</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={`例:\n2026-04-01 | 達成しました | お見事です!5000歩クリア✨\n2026-04-02 | | お疲れさまでした。ゆっくり休んでくださいね`}
          className="w-full border rounded px-3 py-2 font-mono text-sm"
        />
        <div className="text-xs text-gray-600">
          認識できた件数:{" "}
          <span className="font-semibold text-brand-700">{valid.length}</span> 件
          {invalid.length > 0 && (
            <span className="ml-2 text-orange-600">
              ({invalid.length} 件は空のためスキップ)
            </span>
          )}
        </div>
      </section>

      {valid.length > 0 && (
        <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100 space-y-2">
          <h2 className="font-semibold">プレビュー(最初の5件)</h2>
          <ul className="space-y-2 text-sm">
            {valid.slice(0, 5).map((e, i) => (
              <li
                key={i}
                className="border border-brand-100 rounded p-3 text-sm"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {e.date ?? "(今日扱い)"}
                  {e.customerMsg && (
                    <span className="ml-2">
                      お客様: {e.customerMsg}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{e.staffReply}</div>
                {e.warnings.map((w, j) => (
                  <div key={j} className="text-xs text-orange-600 mt-1">
                    ⚠ {w}
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {valid.length > 5 && (
            <p className="text-xs text-gray-500">
              ほか {valid.length - 5} 件...
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </p>
      )}
      {success !== null && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded p-3">
          ✓ {success} 件をインポートしました
        </p>
      )}

      <button
        onClick={handleImport}
        disabled={saving || valid.length === 0}
        className="w-full bg-brand-500 hover:bg-brand-600 text-white py-3 rounded-lg font-semibold disabled:opacity-60"
      >
        {saving
          ? "保存中…"
          : `📥 ${valid.length} 件をインポート`}
      </button>
    </div>
  );
}
