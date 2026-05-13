'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Copy, Check, Trash2 } from 'lucide-react';

interface CodesViewProps {
  codes: any[];
}

export function CodesView({ codes: initial }: CodesViewProps) {
  const router = useRouter();
  const [codes, setCodes] = useState(initial);
  const [showNew, setShowNew] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
    setNewCode(s);
  };

  const create = async () => {
    if (!newCode.trim()) return;
    const res = await fetch('/api/admin/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode.trim().toUpperCase(), note: newNote.trim() })
    });
    if (res.ok) {
      router.refresh();
      setShowNew(false);
      setNewCode('');
      setNewNote('');
    } else {
      alert('既に存在するコードです');
    }
  };

  const del = async (code: string) => {
    if (!confirm(`コード「${code}」を削除しますか？（未使用のもののみ削除可能）`)) return;
    const res = await fetch(`/api/admin/codes/${code}`, { method: 'DELETE' });
    if (res.ok) {
      setCodes(codes.filter((c) => c.code !== code));
    } else {
      alert('使用済みのコードは削除できません');
    }
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">招待コード</h1>
          <p className="text-ink-dim text-sm mt-1">
            {codes.filter((c) => !c.used).length} 未使用 / {codes.length} 件
          </p>
        </div>
        <button onClick={() => { setShowNew(true); generateCode(); }} className="btn-primary">
          <Plus className="w-4 h-4" /> 新規発行
        </button>
      </div>

      {showNew && (
        <div className="bg-white rounded-2xl shadow-card p-4 mb-4">
          <h2 className="font-bold mb-3">招待コードを発行</h2>
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">コード</label>
              <div className="flex gap-2">
                <input className="input font-mono" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} />
                <button onClick={generateCode} className="btn-secondary !min-h-[44px]">再生成</button>
              </div>
            </div>
            <div>
              <label className="label">メモ（任意）</label>
              <input className="input" value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="例: 山田様向け" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="btn-secondary flex-1">キャンセル</button>
            <button onClick={create} className="btn-primary flex-1">発行する</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card overflow-x-auto">
        {codes.length === 0 ? (
          <div className="text-center py-16 text-ink-mute text-sm">コードがありません</div>
        ) : (
          <table className="w-full">
            <thead className="bg-surface-alt border-b border-ink-line">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">コード</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">状態</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">メモ</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim hidden md:table-cell">使用者</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-ink-dim">発行日</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-ink-dim"></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code} className="border-b border-ink-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold">{c.code}</code>
                      <button onClick={() => copy(c.code)} className="text-ink-mute hover:text-brand-600">
                        {copied === c.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.used ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">使用済</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-600">有効</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-ink-dim">{c.note || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs">{c.usedByName || '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-dim">{new Date(c.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-right">
                    {!c.used && (
                      <button onClick={() => del(c.code)} className="text-ink-mute hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
