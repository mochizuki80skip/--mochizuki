import { redirect } from 'next/navigation';
import { getCurrentTrainer } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '../admin-shell';
import { CodesView } from './codes-view';

export const dynamic = 'force-dynamic';

export default async function CodesPage() {
  const trainer = await getCurrentTrainer();
  if (!trainer) redirect('/admin/login');

  const codes = await prisma.memberCode.findMany({
    orderBy: { createdAt: 'desc' }
  });

  // Resolve usedByUser displayNames
  const userIds = codes.filter((c) => c.usedByUser).map((c) => c.usedByUser!) as string[];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  return (
    <AdminShell trainer={trainer}>
      <CodesView codes={codes.map((c) => ({
        code: c.code,
        note: c.note,
        used: c.used,
        usedByUser: c.usedByUser,
        usedByName: c.usedByUser ? userMap[c.usedByUser] : null,
        usedAt: c.usedAt ? c.usedAt.toISOString() : null,
        createdAt: c.createdAt.toISOString()
      }))} />
    </AdminShell>
  );
}
