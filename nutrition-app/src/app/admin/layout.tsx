// 管理サイト全体のラッパー（最小限）。各ページで認証チェック + AdminShell を使用。
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
