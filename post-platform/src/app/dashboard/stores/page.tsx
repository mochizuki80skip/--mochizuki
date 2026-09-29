import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { storeChannels } from "@/lib/posts";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await prisma.store.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }] });
  const soon = Date.now() + 10 * 86400_000;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">店舗（接骨院）</h1>
        <Link href="/dashboard/stores/import" className="bg-brand text-white px-3 py-1.5 rounded text-sm">
          Google から取り込む
        </Link>
      </div>
      <p className="text-sm text-gray-500">
        ここに登録した店舗だけに投稿します。連携した Google アカウントで管理している鍼灸院・ジムなどは、取り込まない限り投稿されません。
      </p>
      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">店舗</th>
              <th className="px-3 py-2 font-medium">地域</th>
              <th className="px-3 py-2 font-medium">GBP</th>
              <th className="px-3 py-2 font-medium">Instagram</th>
              <th className="px-3 py-2 font-medium">写真</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => {
              const ch = storeChannels(s);
              const photos = s.photoUrls.split("\n").filter((x) => x.trim()).length;
              const expiring = s.igTokenExpiresAt && s.igTokenExpiresAt.getTime() < soon;
              return (
                <tr key={s.id} className={`border-t ${s.isActive ? "" : "text-gray-400"}`}>
                  <td className="px-3 py-2">{s.name}{!s.isActive && "（停止中）"}</td>
                  <td className="px-3 py-2">{s.area || <span className="text-amber-600">未入力</span>}</td>
                  <td className="px-3 py-2">{ch.gbp ? "○" : "—"}</td>
                  <td className="px-3 py-2">
                    {ch.instagram ? (expiring ? <span className="text-amber-600">期限間近</span> : "○") : "—"}
                  </td>
                  <td className="px-3 py-2">{photos ? `${photos} 枚` : <span className="text-gray-400">なし</span>}</td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/dashboard/stores/${s.id}`} className="text-brand hover:underline">
                      編集
                    </Link>
                  </td>
                </tr>
              );
            })}
            {stores.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  まだ店舗がありません。「Google から取り込む」から接骨院を選んでください。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
