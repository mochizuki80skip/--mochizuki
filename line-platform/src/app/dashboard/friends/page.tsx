import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;

  const friends = await prisma.friend.findMany({
    where: {
      AND: [
        q
          ? {
              OR: [
                { displayName: { contains: q, mode: "insensitive" } },
                { lineUserId: { contains: q } },
              ],
            }
          : {},
        tag ? { tags: { some: { tagId: tag } } } : {},
      ],
    },
    include: { tags: { include: { tag: true } } },
    orderBy: { followedAt: "desc" },
    take: 200,
  });

  const allTags = await prisma.tag.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">友だち</h1>
        <span className="text-sm text-gray-500">{friends.length} 件</span>
      </div>

      <form className="flex gap-2 items-center">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="名前 / userId で検索"
          className="border rounded px-3 py-1.5 text-sm w-64"
        />
        <select name="tag" defaultValue={tag ?? ""} className="border rounded px-2 py-1.5 text-sm">
          <option value="">タグ：すべて</option>
          {allTags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button className="bg-line text-white px-3 py-1.5 rounded text-sm">検索</button>
      </form>

      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">名前</th>
              <th className="px-4 py-2 font-medium">タグ</th>
              <th className="px-4 py-2 font-medium">状態</th>
              <th className="px-4 py-2 font-medium">追加日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {friends.map((f) => (
              <tr key={f.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  {f.displayName ?? <span className="text-gray-400">(no name)</span>}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {f.tags.map((ft) => (
                      <span
                        key={ft.tagId}
                        className="px-2 py-0.5 rounded text-xs"
                        style={{ background: ft.tag.color + "20", color: ft.tag.color }}
                      >
                        {ft.tag.name}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {f.isFollowing ? (
                    <span className="text-line-dark">フォロー中</span>
                  ) : (
                    <span className="text-gray-400">ブロック</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {new Date(f.followedAt).toLocaleDateString("ja-JP")}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/dashboard/friends/${f.id}`} className="text-line-dark hover:underline">
                    詳細
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {friends.length === 0 && (
          <div className="px-4 py-6 text-sm text-gray-500">該当する友だちはいません。</div>
        )}
      </div>
    </div>
  );
}
