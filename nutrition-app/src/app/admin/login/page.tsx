'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { getLiff, liffIdToken, liffLogin } from '@/lib/liff';
import { ShieldCheck, LogIn, Copy, Check } from 'lucide-react';

export default function AdminLoginPage() {
  return (
    <ToastProvider>
      <Login />
    </ToastProvider>
  );
}

function Login() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [notAllowed, setNotAllowed] = useState<{ lineUserId: string; displayName?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    setNotAllowed(null);
    try {
      const liff = await getLiff();
      if (!liff) { toast('LIFF未設定（NEXT_PUBLIC_LIFF_ID 環境変数）'); return; }
      const ok = await liffLogin();
      if (!ok) return; // redirected by LIFF
      const token = await liffIdToken();
      if (!token) { toast('IDトークン取得失敗'); return; }
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      const data = await res.json();
      if (res.ok) {
        toast('認証成功');
        router.replace('/admin');
      } else if (res.status === 403 && data.lineUserId) {
        setNotAllowed({ lineUserId: data.lineUserId, displayName: data.displayName });
      } else {
        toast(data.error || '認証に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-card p-8 max-w-sm w-full">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center mb-1">ONE'S MEAL 管理サイト</h1>
        <p className="text-sm text-ink-dim text-center mb-6">トレーナー専用 / LINE許可リスト方式</p>

        {notAllowed ? (
          <>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <div className="text-sm font-bold text-orange-700 mb-2">⚠ 許可リストに含まれていません</div>
              <p className="text-xs text-orange-700 leading-relaxed mb-3">
                {notAllowed.displayName && <>こんにちは、<strong>{notAllowed.displayName}</strong> さん。<br /></>}
                あなたのLINE userIdは以下です。コピーしてVercelの環境変数<br />
                <code className="bg-orange-100 px-1 py-0.5 rounded">OWNER_LINE_USER_IDS</code> に追加し、Redeploy してください。
              </p>
              <div className="bg-white border border-orange-300 rounded-lg p-2 flex items-center gap-2">
                <code className="flex-1 font-mono text-xs break-all">{notAllowed.lineUserId}</code>
                <button
                  onClick={() => copy(notAllowed.lineUserId)}
                  className="shrink-0 p-2 rounded-lg hover:bg-orange-50"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-orange-600" />}
                </button>
              </div>
              <p className="text-[10px] text-orange-600 mt-2">
                ※ env変数 OWNER_LINE_USER_IDS と TRAINER_LINE_USER_IDS が両方とも未設定の場合、初回ログインの方が自動的に owner になります。
              </p>
            </div>
            <button
              onClick={() => { setNotAllowed(null); onLogin(); }}
              className="w-full text-sm text-brand-600 font-bold py-2"
            >再試行する</button>
          </>
        ) : (
          <>
            <button
              onClick={onLogin}
              disabled={loading}
              className="w-full bg-[#06C755] text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition"
            >
              {loading ? <span className="spinner" /> : <LogIn className="w-4 h-4" />}
              LINEでログイン
            </button>
            <p className="text-[10px] text-ink-mute text-center mt-4">
              許可されたトレーナーのみアクセス可能です。<br />
              アクセスをご希望の方はオーナーまでご連絡ください。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
