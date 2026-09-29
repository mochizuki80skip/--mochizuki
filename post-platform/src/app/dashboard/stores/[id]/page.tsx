import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateStoreAction } from "../../actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full border rounded px-3 py-2 text-sm font-normal";

export default async function StoreEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await prisma.store.findUnique({ where: { id } });
  if (!s) notFound();
  const action = updateStoreAction.bind(null, s.id);
  const photos = s.photoUrls.split("\n").map((x) => x.trim()).filter(Boolean);
  const vars = Object.entries((s.vars ?? {}) as Record<string, unknown>).map(([k, v]) => [k, String(v ?? "")]);

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">{s.name}</h1>
      <form action={action} className="space-y-4">
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="font-medium">基本情報（AI が投稿文に使います）</h2>
          <label className="block text-sm font-medium">院名<input name="name" defaultValue={s.name} required className={input} /></label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block text-sm font-medium">地名 {"{地名}"}<input name="city" defaultValue={s.city} placeholder="静岡市葵区" className={input} /></label>
            <label className="block text-sm font-medium">エリア {"{エリア}"}<input name="area" defaultValue={s.area} placeholder="静岡駅北口 徒歩3分" className={input} /></label>
          </div>
          <label className="block text-sm font-medium">得意な施術・特徴<input name="features" defaultValue={s.features} placeholder="骨盤矯正、スポーツ外傷、交通事故治療、キッズスペースあり" className={input} /></label>
          <label className="block text-sm font-medium">
            投稿用写真の URL（1 行に 1 つ。投稿ごとに順番に使います）
            <textarea name="photoUrls" defaultValue={s.photoUrls} rows={4} className={input} />
          </label>
          <label className="block text-sm font-medium">
            写真を追加（JPEG / PNG、複数可。保存すると上の一覧に追加されます）
            <input name="photoFiles" type="file" multiple accept="image/jpeg,image/png" className="mt-1 text-sm font-normal" />
          </label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="w-20 h-20 object-cover rounded border" />
              ))}
            </div>
          )}
          <div className="text-sm font-medium">
            任意の差し込み項目（テンプレートで {"{項目名}"} と書くと値が入ります）
            <div className="space-y-1 mt-1 font-normal">
              {[...Object.entries(vars), ["", ""], ["", ""]].map(([k, v], i) => (
                <div key={i} className="flex gap-2">
                  <input name="varKey" defaultValue={k} placeholder="項目名（例：駐車場）" className="w-40 border rounded px-2 py-1 text-sm" />
                  <input name="varValue" defaultValue={v} placeholder="値（例：3台あり）" className="flex-1 border rounded px-2 py-1 text-sm" />
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={s.isActive} />投稿対象にする</label>
            <label className="block text-sm font-medium">表示順<input name="sortOrder" type="number" defaultValue={s.sortOrder} className="mt-1 w-24 border rounded px-2 py-1 text-sm" /></label>
          </div>
        </section>

        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="font-medium">Google ビジネスプロフィール</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="gbpEnabled" defaultChecked={s.gbpEnabled} />GBP に投稿する</label>
          <label className="block text-sm font-medium">
            ボタン
            <select name="ctaType" defaultValue={s.ctaType} className={input}>
              <option value="BOOK">予約</option>
              <option value="CALL">今すぐ電話</option>
              <option value="LEARN_MORE">詳細</option>
              <option value="NONE">なし</option>
            </select>
          </label>
          <label className="block text-sm font-medium">ボタンのリンク先（予約ページなど）<input name="bookingUrl" type="url" defaultValue={s.bookingUrl} className={input} /></label>
          <div className="text-xs text-gray-400">ロケーション ID：{s.gbpLocationId ?? "未連携"}</div>
        </section>

        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="font-medium">Instagram</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="igEnabled" defaultChecked={s.igEnabled} />Instagram に投稿する</label>
          <label className="block text-sm font-medium">Instagram ユーザー ID（数字）<input name="igUserId" defaultValue={s.igUserId ?? ""} className={input} /></label>
          <label className="block text-sm font-medium">
            長期アクセストークン（{s.igAccessToken ? `登録済み・期限 ${s.igTokenExpiresAt?.toLocaleDateString("ja-JP") ?? "不明"}。変更時のみ入力` : "未登録"}）
            <input name="igAccessToken" type="password" autoComplete="off" className={input} />
          </label>
          <label className="block text-sm font-medium">トークンの有効日数<input name="igTokenDays" type="number" defaultValue={60} className="mt-1 w-24 border rounded px-2 py-1 text-sm" /></label>
          <label className="block text-sm font-medium">店舗独自のハッシュタグ<input name="igHashtags" defaultValue={s.igHashtags} placeholder="#〇〇駅 #〇〇市接骨院" className={input} /></label>
        </section>

        <button className="bg-brand text-white px-4 py-2 rounded text-sm">保存</button>
      </form>
    </div>
  );
}
