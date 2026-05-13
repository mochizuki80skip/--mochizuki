'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { getLiff, liffIdToken, liffLogin } from '@/lib/liff';
import { ShieldCheck, LogIn } from 'lucide-react';

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

  const onLogin = async () => {
    setLoading(true);
    try {
      const liff = await getLiff();
      if (!liff) { toast('LIFF未設定（NEXT_PUBLIC_LIFF_ID）'); return; }
      const ok = await liffLogin();
      if (!ok) return; // redirected by LIFF
      const token = await liffIdToken();
      if (!token) { toast('IDトークン取得失敗'); return; }
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (res.ok) {
        toast('認証成功');
        router.replace('/admin');
      } else {
        const data = await res.json().catch(() => ({}));
        toast(data.error || '認証に失敗しました（許可リストに含まれていません）');
      }
    } finally {
      setLoading(false);
    }
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
        <p className="text-sm text-ink-dim text-center mb-6">トレーナー専用 / 許可リスト方式</p>
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
      </div>
    </div>
  );
}
