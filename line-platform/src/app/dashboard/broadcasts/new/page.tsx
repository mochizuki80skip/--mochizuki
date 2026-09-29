import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, listAccessibleChannels } from "@/lib/permissions";
import { getQuotaSummary } from "@/lib/line";
import { MultiBroadcastForm } from "./MultiBroadcastForm";

export const dynamic = "force-dynamic";

export default async function MultiBroadcastPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const channels = await listAccessibleChannels(user.id, user.role);
  const rows = await Promise.all(
    channels.map(async (c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      followers: await prisma.friend.count({ where: { lineChannelId: c.id, isFollowing: true } }),
      quota: await getQuotaSummary(c.id),
    })),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link href="/dashboard" className="text-lg font-bold text-line">
            ← LINE Platform
          </Link>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-semibold">複数アカウントへ一斉配信</h1>
        <p className="text-sm text-gray-500">
          選んだ LINE アカウントそれぞれの友だち全員に同じ内容を配信します。送信通数は各アカウントの枠から「友だち数 × 1 通」消費されます（吹き出し 5 つまでは 1 通扱い）。
        </p>
        <MultiBroadcastForm channels={rows} />
      </main>
    </div>
  );
}
