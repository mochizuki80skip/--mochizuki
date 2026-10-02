import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email: string;
  role: "super_admin" | "operator";
};

// セッションから AdminUser を解決（無ければ null）
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const u = session.user as { id?: string; email?: string; role?: string };
  if (!u.id || !u.email) return null;
  return {
    id: u.id,
    email: u.email,
    role: (u.role === "super_admin" ? "super_admin" : "operator"),
  };
}

// 指定チャネルへのアクセス権を確認
export async function canAccessChannel(userId: string, role: string, channelId: string): Promise<boolean> {
  if (role === "super_admin") return true;
  const m = await prisma.channelMembership.findUnique({
    where: { adminUserId_lineChannelId: { adminUserId: userId, lineChannelId: channelId } },
  });
  return !!m;
}

// 「現在のユーザーがアクセス可能なチャネルの一覧」を返す
export async function listAccessibleChannels(userId: string, role: string) {
  if (role === "super_admin") {
    return prisma.lineChannel.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  }
  const memberships = await prisma.channelMembership.findMany({
    where: { adminUserId: userId },
    include: { lineChannel: true },
    orderBy: { createdAt: "asc" },
  });
  return memberships.filter((m) => m.lineChannel.isActive).map((m) => m.lineChannel);
}

// 認可チェック付きでチャネルを取得（権限なしなら例外）
export async function requireChannel(channelId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("unauthorized");
  const ok = await canAccessChannel(user.id, user.role, channelId);
  if (!ok) throw new Error("forbidden");
  const ch = await prisma.lineChannel.findUnique({ where: { id: channelId } });
  if (!ch) throw new Error("not_found");
  return { user, channel: ch };
}

// super_admin 必須
export async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error("unauthorized");
  if (user.role !== "super_admin") throw new Error("forbidden");
  return user;
}
