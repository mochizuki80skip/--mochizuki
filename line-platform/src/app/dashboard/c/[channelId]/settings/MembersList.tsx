"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Member = {
  adminUserId: string;
  email: string;
  name: string | null;
  role: string;
};

export function MembersList({
  channelId,
  members,
  readOnly,
}: {
  channelId: string;
  members: Member[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"owner" | "operator">("operator");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const body: Record<string, unknown> = { email, role };
      if (name) body.name = name;
      if (password) body.password = password;

      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "追加に失敗しました");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      router.refresh();
    });
  }

  function remove(adminUserId: string) {
    if (!confirm("この担当者をこの LINE から外しますか？")) return;
    start(async () => {
      const res = await fetch(`/api/channels/${channelId}/members`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ adminUserId }),
      });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="bg-white border rounded p-5 space-y-4">
      <h2 className="font-medium">担当者</h2>

      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.adminUserId} className="flex items-center gap-3 text-sm border rounded p-3">
            <div className="flex-1">
              <div className="font-medium">{m.name ?? m.email}</div>
              <div className="text-xs text-gray-500">{m.email}</div>
            </div>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                m.role === "owner" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              {m.role}
            </span>
            {!readOnly && (
              <button
                onClick={() => remove(m.adminUserId)}
                className="text-red-600 text-xs hover:underline"
              >
                外す
              </button>
            )}
          </div>
        ))}
        {members.length === 0 && (
          <div className="text-sm text-gray-500">担当者が割り当てられていません。</div>
        )}
      </div>

      {!readOnly && (
        <>
          <hr />
          <h3 className="text-sm font-medium">担当者を追加</h3>
          <p className="text-xs text-gray-500">
            既存ユーザーは Email だけ入れて追加。新規ユーザーは Email + Password を入力すると新規作成されます。
          </p>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="氏名（新規時のみ）"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード（新規時のみ・8文字以上）"
              className="border rounded px-3 py-2 text-sm"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "owner" | "operator")}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="operator">operator</option>
              <option value="owner">owner</option>
            </select>
          </div>
          <button
            onClick={add}
            disabled={pending || !email}
            className="bg-line text-white px-4 py-2 rounded text-sm disabled:opacity-50"
          >
            追加
          </button>
        </>
      )}
    </div>
  );
}
