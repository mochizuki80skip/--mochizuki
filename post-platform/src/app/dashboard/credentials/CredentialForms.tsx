"use client";

import { useState, useTransition } from "react";
import { deleteCredentialAction, revealCredentialAction, saveCredentialAction } from "../actions";

const input = "border rounded px-2 py-1 text-sm";

export function NewCredential({ stores }: { stores: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  if (!open) return <button onClick={() => setOpen(true)} className="bg-brand text-white px-3 py-1.5 rounded text-sm">ログイン情報を追加</button>;
  return (
    <form
      action={(f) => start(async () => { await saveCredentialAction(f); setOpen(false); })}
      className="bg-white border rounded p-3 flex flex-wrap gap-2 items-end"
    >
      <select name="storeId" required className={input}>
        {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select name="service" className={input}>
        <option value="instagram">Instagram</option>
        <option value="google">Google</option>
        <option value="other">その他</option>
      </select>
      <input name="loginId" placeholder="ログイン ID" required autoComplete="off" className={input} />
      <input name="password" type="password" placeholder="パスワード" autoComplete="new-password" className={input} />
      <input name="note" placeholder="メモ（2 段階認証の方法など）" className={`${input} flex-1 min-w-40`} />
      <button disabled={busy} className="bg-brand text-white px-3 py-1 rounded text-sm">保存</button>
      <button type="button" onClick={() => setOpen(false)} className="px-3 py-1 text-sm text-gray-500">閉じる</button>
    </form>
  );
}

type Cred = { id: string; storeId: string; storeName: string; service: string; serviceLabel: string; loginId: string; hasPassword: boolean; note: string; updated: string };

export function CredentialRow({ c }: { c: Cred }) {
  const [shown, setShown] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();

  function reveal() {
    const pw = prompt("確認のため、本部ログインのパスワードを入力してください");
    if (!pw) return;
    start(async () => {
      try {
        const r = await revealCredentialAction(c.id, pw);
        setShown(r.password || "（未登録）");
        setTimeout(() => setShown(null), 30_000); // 30 秒で隠す
      } catch (e) {
        alert(e instanceof Error ? e.message : "表示できませんでした");
      }
    });
  }

  if (editing) {
    return (
      <tr className="border-t bg-gray-50">
        <td colSpan={7} className="p-2">
          <form action={(f) => start(async () => { await saveCredentialAction(f); setEditing(false); })} className="flex flex-wrap gap-2 items-center">
            <input type="hidden" name="storeId" value={c.storeId} />
            <input type="hidden" name="service" value={c.service} />
            <span className="text-sm">{c.storeName}（{c.serviceLabel}）</span>
            <input name="loginId" defaultValue={c.loginId} required className={input} />
            <input name="password" type="password" placeholder="変更時のみ入力" autoComplete="new-password" className={input} />
            <input name="note" defaultValue={c.note} className={`${input} flex-1 min-w-40`} />
            <button disabled={busy} className="bg-brand text-white px-3 py-1 rounded text-sm">保存</button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500">キャンセル</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2">{c.storeName}</td>
      <td className="px-3 py-2">{c.serviceLabel}</td>
      <td className="px-3 py-2 font-mono">{c.loginId}</td>
      <td className="px-3 py-2">
        {shown ? (
          <span className="font-mono bg-yellow-50 px-1">{shown}</span>
        ) : c.hasPassword ? (
          <button onClick={reveal} disabled={busy} className="text-brand hover:underline">●●●●●● 表示</button>
        ) : (
          <span className="text-gray-400">未登録</span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">{c.note}</td>
      <td className="px-3 py-2 text-xs text-gray-500">{c.updated}</td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="text-brand hover:underline text-xs mr-2">編集</button>
        <button
          onClick={() => confirm(`${c.storeName} の ${c.serviceLabel} ログイン情報を削除しますか？`) && start(() => deleteCredentialAction(c.id))}
          className="text-red-600 hover:underline text-xs"
        >
          削除
        </button>
      </td>
    </tr>
  );
}
