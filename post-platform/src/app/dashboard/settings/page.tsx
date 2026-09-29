import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/posts";
import { WEEKDAYS } from "@/lib/themes";
import { disconnectGoogleAction, updateSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

const GOOGLE_MSG: Record<string, string> = {
  ok: "Google アカウントを連携しました。",
  state_error: "連携に失敗しました（画面を開き直してもう一度お試しください）。",
  no_refresh_token: "連携に失敗しました。Google アカウントの「サードパーティ アクセス」からこのアプリを削除して、もう一度連携してください。",
  cancelled: "連携がキャンセルされました。",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  const [settings, conn] = await Promise.all([getSettings(), prisma.googleConnection.findUnique({ where: { id: "default" } })]);
  const input = "mt-1 w-full border rounded px-3 py-2 text-sm font-normal";

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">設定</h1>

      <section className="bg-white border rounded p-4 space-y-2">
        <h2 className="font-medium">Google アカウント連携</h2>
        {google && <div className={`text-sm ${google === "ok" ? "text-green-700" : "text-red-600"}`}>{GOOGLE_MSG[google] ?? `連携に失敗しました（${google}）`}</div>}
        {conn ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <div>
              連携中：<span className="font-medium">{conn.email ?? "（メール不明）"}</span>
              <span className="text-gray-500 ml-2">{conn.connectedAt.toLocaleDateString("ja-JP")}〜</span>
            </div>
            <div className="flex gap-2">
              <a href="/api/google/connect" className="border px-3 py-1.5 rounded">再連携</a>
              <form action={disconnectGoogleAction}>
                <button className="border px-3 py-1.5 rounded text-red-600">解除</button>
              </form>
            </div>
          </div>
        ) : (
          <a href="/api/google/connect" className="inline-block bg-brand text-white px-3 py-1.5 rounded text-sm">
            Google アカウントを連携する
          </a>
        )}
        <p className="text-xs text-gray-500">
          GBP の管理者（またはオーナー）権限を持つアカウントで連携してください。投稿されるのは「店舗」に取り込んだ店舗だけです。
        </p>
      </section>

      <form action={updateSettingsAction} className="bg-white border rounded p-4 space-y-3">
        <h2 className="font-medium">投稿スケジュール・内容</h2>
        <div className="text-sm font-medium">
          投稿する曜日（「翌週分を作成」で使用）
          <div className="flex flex-wrap gap-3 mt-1 font-normal">
            {WEEKDAYS.map((w, i) => (
              <label key={i} className="flex items-center gap-1">
                <input type="checkbox" name="postingDays" value={i} defaultChecked={settings.postingDays.includes(i)} />
                {w}
              </label>
            ))}
          </div>
        </div>
        <label className="block text-sm font-medium">
          投稿時刻
          <input type="time" name="postingTime" defaultValue={settings.postingTime} className="mt-1 border rounded px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-sm font-medium">
          全店舗共通のハッシュタグ（Instagram）
          <input name="commonHashtags" defaultValue={settings.commonHashtags} className={input} />
        </label>
        <label className="block text-sm font-medium">
          追加の NG ワード（1 行に 1 つ。含まれる投稿は承認できません）
          <textarea name="extraNgWords" defaultValue={settings.extraNgWords} rows={4} className={input} />
        </label>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">保存</button>
      </form>
    </div>
  );
}
