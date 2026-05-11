import { prisma } from "@/lib/prisma";
import { TagManager } from "./TagManager";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { friends: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">タグ</h1>
      <TagManager
        initial={tags.map((t) => ({
          id: t.id,
          name: t.name,
          color: t.color,
          count: t._count.friends,
        }))}
      />
    </div>
  );
}
