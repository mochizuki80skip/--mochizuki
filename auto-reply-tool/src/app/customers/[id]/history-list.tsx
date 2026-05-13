import { createClient } from "@/lib/supabase/server";

type Achievement = {
  title: string;
  status: string;
  value: number | null;
  unit: string | null;
};

type Report = {
  id: string;
  report_date: string;
  achievements: Achievement[] | null;
  customer_msg: string | null;
  staff_reply: string | null;
  tone_used: string | null;
  created_at: string;
};

const TONE_LABEL: Record<string, string> = {
  normal: "いつも通り",
  encourage: "背中を押す",
  praise: "しっかり褒める",
};

export async function HistoryList({ customerId }: { customerId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select(
      "id, report_date, achievements, customer_msg, staff_reply, tone_used, created_at"
    )
    .eq("customer_id", customerId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const reports = (data ?? []) as Report[];

  return (
    <section className="bg-white rounded-lg p-5 shadow-sm border border-brand-100">
      <h2 className="font-semibold mb-3">過去のやり取り</h2>
      {reports.length === 0 ? (
        <p className="text-sm text-gray-500">
          まだ履歴がありません。「返信を作る」から作成すると、ここに溜まっていきます。
        </p>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="border border-brand-100 rounded p-3 text-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">
                  {new Date(r.report_date).toLocaleDateString("ja-JP", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    weekday: "short",
                  })}
                </span>
                {r.tone_used && (
                  <span className="text-xs text-gray-500 bg-brand-50 px-2 py-0.5 rounded">
                    {TONE_LABEL[r.tone_used] ?? r.tone_used}
                  </span>
                )}
              </div>
              {r.achievements && r.achievements.length > 0 && (
                <div className="text-xs text-gray-600 mb-2">
                  {r.achievements.map((a, i) => (
                    <span key={i} className="mr-2">
                      <span className="font-medium">{a.title}:</span>{" "}
                      <span
                        className={
                          a.status === "done"
                            ? "text-green-600"
                            : "text-orange-500"
                        }
                      >
                        {a.status === "done" ? "達成" : "未達"}
                      </span>
                      {a.value !== null && (
                        <span className="text-gray-500">
                          {" "}
                          ({a.value}
                          {a.unit ?? ""})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              {r.customer_msg && (
                <div className="text-xs text-gray-500 italic mb-1">
                  お客様: {r.customer_msg}
                </div>
              )}
              {r.staff_reply && (
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {r.staff_reply}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
