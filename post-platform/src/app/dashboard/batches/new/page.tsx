import { THEMES } from "@/lib/themes";
import { createBatchAction } from "../../actions";

export default function NewBatchPage() {
  const tomorrow = new Date(Date.now() + 9 * 3600_000 + 86400_000).toISOString().slice(0, 10);
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-semibold">投稿を個別に作成</h1>
      <p className="text-sm text-gray-500">キャンペーンや休診のお知らせなど、定期分とは別に全店舗へ投稿したいときに使います。</p>
      <form action={createBatchAction} className="bg-white border rounded p-4 space-y-3">
        <label className="block text-sm font-medium">
          テーマ
          <input name="theme" list="themes" required className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal" />
          <datalist id="themes">
            {THEMES.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium">
          補足（AI への指示：伝えたい内容・期間・条件など）
          <textarea name="memo" rows={4} className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal" />
        </label>
        <label className="block text-sm font-medium">
          全店舗共通の画像 URL（任意。未入力なら各店舗の写真を使用）
          <input name="imageUrl" type="url" className="mt-1 w-full border rounded px-3 py-2 text-sm font-normal" />
        </label>
        <div className="flex gap-3">
          <label className="block text-sm font-medium">
            投稿日
            <input name="date" type="date" defaultValue={tomorrow} required className="mt-1 border rounded px-3 py-2 text-sm font-normal" />
          </label>
          <label className="block text-sm font-medium">
            時刻
            <input name="time" type="time" defaultValue="10:00" required className="mt-1 border rounded px-3 py-2 text-sm font-normal" />
          </label>
        </div>
        <button className="bg-brand text-white px-4 py-2 rounded text-sm">作成して確認画面へ</button>
      </form>
    </div>
  );
}
