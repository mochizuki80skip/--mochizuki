import { prisma } from "@/lib/prisma";
import { CredentialRow, NewCredential } from "./CredentialForms";

export const dynamic = "force-dynamic";

const SERVICE: Record<string, string> = { instagram: "Instagram", google: "Google", other: "その他" };

export default async function CredentialsPage() {
  const [stores, creds, logs] = await Promise.all([
    prisma.store.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.storeCredential.findMany({ include: { store: true }, orderBy: [{ store: { sortOrder: "asc" } }, { store: { name: "asc" } }] }),
    prisma.credentialAccessLog.findMany({ include: { credential: { include: { store: true } } }, orderBy: { at: "desc" }, take: 30 }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">ログイン情報</h1>
      <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900 space-y-1">
        <div>パスワードは暗号化して保存しています。表示するには本部ログインのパスワードの再入力が必要で、誰がいつ表示したかを記録します。</div>
        <div>自動投稿には ID・パスワードではなく各店舗の「アクセストークン」を使います（ID・パスワードでの自動ログインは Instagram の規約違反・アカウントロックの原因になるため行いません）。ここはスタッフの引き継ぎ・管理用です。</div>
        <div>Instagram は 2 段階認証を有効にし、パスワード変更時はここも更新してください。</div>
      </div>

      <NewCredential stores={stores} />

      <div className="bg-white border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">店舗</th>
              <th className="px-3 py-2 font-medium">種類</th>
              <th className="px-3 py-2 font-medium">ログイン ID</th>
              <th className="px-3 py-2 font-medium">パスワード</th>
              <th className="px-3 py-2 font-medium">メモ</th>
              <th className="px-3 py-2 font-medium">更新</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {creds.map((c) => (
              <CredentialRow
                key={c.id}
                c={{
                  id: c.id,
                  storeId: c.storeId,
                  storeName: c.store.name,
                  service: c.service,
                  serviceLabel: SERVICE[c.service] ?? c.service,
                  loginId: c.loginId,
                  hasPassword: !!c.passwordEnc,
                  note: c.note,
                  updated: `${c.updatedAt.toLocaleDateString("ja-JP")} ${c.updatedBy ?? ""}`,
                }}
              />
            ))}
            {creds.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">登録はまだありません。</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-white border rounded">
        <div className="px-3 py-2 border-b text-sm font-medium">操作の記録（直近 30 件）</div>
        <ul className="divide-y text-xs">
          {logs.map((l) => (
            <li key={l.id} className="px-3 py-1.5 flex gap-3">
              <span className="text-gray-500 w-36">{l.at.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
              <span className="w-48">{l.userEmail}</span>
              <span>{l.credential.store.name}（{SERVICE[l.credential.service] ?? l.credential.service}）を{l.action === "reveal" ? "表示" : "登録・更新"}</span>
            </li>
          ))}
          {logs.length === 0 && <li className="px-3 py-3 text-gray-500">記録はありません。</li>}
        </ul>
      </div>
    </div>
  );
}
