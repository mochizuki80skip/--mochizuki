import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const scenarios = await prisma.scenario.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { steps: true, runs: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">ステップ配信</h1>
        <Link href="/dashboard/scenarios/new" className="bg-line text-white px-3 py-1.5 rounded text-sm">
          新規作成
        </Link>
      </div>
      <div className="bg-white border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">名前</th>
              <th className="px-4 py-2 font-medium">トリガー</th>
              <th className="px-4 py-2 font-medium">ステップ数</th>
              <th className="px-4 py-2 font-medium">起動済</th>
              <th className="px-4 py-2 font-medium">状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2">{s.triggerType}</td>
                <td className="px-4 py-2">{s._count.steps}</td>
                <td className="px-4 py-2">{s._count.runs}</td>
                <td className="px-4 py-2">
                  {s.isActive ? (
                    <span className="text-line-dark">有効</span>
                  ) : (
                    <span className="text-gray-400">無効</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/dashboard/scenarios/${s.id}`} className="text-line-dark hover:underline">
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {scenarios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-sm text-gray-500">
                  シナリオがありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
