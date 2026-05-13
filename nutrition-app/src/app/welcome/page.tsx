'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { getLiff, liffIdToken, liffLogin } from '@/lib/liff';
import * as storage from '@/lib/storage';
import { Utensils, BarChart3, Sparkles, Dumbbell, ChevronRight, LogIn, ArrowRight, Mail, Lock, User } from 'lucide-react';

export default function WelcomePage() {
  return (
    <ToastProvider>
      <Welcome />
    </ToastProvider>
  );
}

function Welcome() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  const [autoCompleting, setAutoCompleting] = useState(false);
  const [lineError, setLineError] = useState<{ message: string; detail?: string; reason?: string; status?: number; channelIdHint?: string } | null>(null);

  // LIFF 自動完了処理：戻ってきたときにログイン済みなら自動でAPI叩く
  useEffect(() => {
    (async () => {
      try {
        const liff = await getLiff();
        if (!liff) return;
        if (!liff.isLoggedIn()) return;
        setAutoCompleting(true);
        const token = await liffIdToken();
        if (!token) {
          setLineError({ message: 'IDトークンが取得できません。LIFFのScopeに "openid" が含まれているか確認してください。' });
          setAutoCompleting(false);
          return;
        }
        // クライアント側で LIFF Channel ID prefix も控える（デバッグ補助）
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '';
        const cidHint = liffId.split('-')[0] || '(未設定)';

        const res = await fetch('/api/auth/line', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token })
        });
        if (res.ok) {
          await storage.syncLocalToServer().catch(() => {});
          document.cookie = 'om_intro=1; path=/; max-age=2592000';
          const p = await storage.getProfile();
          if (!p || !p.sex) router.replace('/onboarding');
          else router.replace('/');
        } else {
          const data = await res.json().catch(() => ({}));
          setLineError({
            message: data.error || 'サーバー認証失敗',
            detail: data.detail,
            reason: data.reason,
            status: res.status,
            channelIdHint: cidHint
          });
          setAutoCompleting(false);
          try { liff.logout(); } catch {}
        }
      } catch (e: any) {
        setLineError({ message: '予期しないエラー: ' + (e?.message || String(e)) });
        setAutoCompleting(false);
      }
    })();
  }, [router]);

  // PWA standalone mode 検出
  const isPWA = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
     (window.navigator as any).standalone === true);

  const startAsGuest = async () => {
    document.cookie = 'om_intro=1; path=/';
    const p = await storage.getProfile();
    if (!p || !p.sex) router.replace('/onboarding');
    else router.replace('/');
  };

  const startWithLine = async () => {
    setLoading(true);
    try {
      const liff = await getLiff();
      if (!liff) {
        toast('LIFF未設定。メアド or ゲストで開始してください。');
        return;
      }
      const ok = await liffLogin();
      if (!ok) return; // ここでLIFFがリダイレクトする
      // 同一セッションでログイン成功した場合はここに到達
      const token = await liffIdToken();
      if (!token) { toast('IDトークン取得失敗'); return; }
      const res = await fetch('/api/auth/line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (!res.ok) { toast('ログインに失敗しました'); return; }
      await storage.syncLocalToServer().catch(() => {});
      document.cookie = 'om_intro=1; path=/';
      const p = await storage.getProfile();
      if (!p || !p.sex) router.replace('/onboarding');
      else router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    if (!email || !password) {
      toast('メールアドレスとパスワードを入力してください');
      return;
    }
    if (authMode === 'register' && !displayName.trim()) {
      toast('お名前を入力してください');
      return;
    }
    setBusy(true);
    try {
      const url = authMode === 'login' ? '/api/auth/email/login' : '/api/auth/email/register';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName })
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || '失敗しました');
        return;
      }
      await storage.syncLocalToServer().catch(() => {});
      document.cookie = 'om_intro=1; path=/';
      const p = await storage.getProfile();
      if (!p || !p.sex) router.replace('/onboarding');
      else router.replace('/');
    } finally {
      setBusy(false);
    }
  };

  // LIFF 自動ログイン中はオーバーレイ表示
  if (autoCompleting) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <span className="spinner mx-auto mb-3 block" />
          <div className="text-sm text-ink-dim">LINEログイン中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-50/30 pt-8 pb-10 md:pt-16 md:pb-16">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-brand-200/30 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-amber-200/30 blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-5 md:px-8 text-center">
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-fab">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <path d="M14 4 L15.5 12.5 L24 14 L15.5 15.5 L14 24 L12.5 15.5 L4 14 L12.5 12.5 Z" fill="#FFF" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl md:text-4xl font-bold leading-tight">
            ONE'S BODY<br className="md:hidden" />
            <span className="md:ml-2">食事管理サポート</span>
          </h1>
          <p className="mt-4 text-sm md:text-base text-ink-dim leading-relaxed">
            あなたの食事と体組成を、目標に合わせて最適化。<br />
            ジムのトレーナーと二人三脚で、ダイエットもバルクも。
          </p>

          <div className="mt-8 md:mt-10 max-w-md mx-auto">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* ログイン/新規登録セクション */}
      <section className="max-w-md mx-auto px-5 md:px-8 py-8">
        <div className="bg-white border border-ink-line rounded-2xl shadow-card p-5">
          {/* タブ: ログイン / 新規登録 */}
          <div className="bg-surface-alt rounded-xl p-1 grid grid-cols-2 mb-4">
            <button
              onClick={() => setAuthMode('login')}
              className={`py-2 text-sm font-bold rounded-md transition ${authMode === 'login' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
            >ログイン</button>
            <button
              onClick={() => setAuthMode('register')}
              className={`py-2 text-sm font-bold rounded-md transition ${authMode === 'register' ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}
            >新規登録</button>
          </div>

          {/* メアド入力 */}
          <div className="space-y-3 mb-4">
            {authMode === 'register' && (
              <div>
                <label className="label flex items-center gap-1"><User className="w-3 h-3" /> お名前</label>
                <input
                  className="input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="例: 田中太郎"
                  autoComplete="name"
                />
              </div>
            )}
            <div>
              <label className="label flex items-center gap-1"><Mail className="w-3 h-3" /> メールアドレス</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@example.com"
                autoComplete="email"
                inputMode="email"
              />
            </div>
            <div>
              <label className="label flex items-center gap-1"><Lock className="w-3 h-3" /> パスワード <span className="text-ink-mute font-normal">（8文字以上）</span></label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
            <button onClick={submitEmail} disabled={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? <span className="spinner" /> : (authMode === 'login' ? 'ログイン' : 'アカウント作成')}
            </button>
            {authMode === 'login' && (
              <p className="text-[10px] text-ink-mute text-center">
                パスワードを忘れた場合は、管理者にご連絡ください
              </p>
            )}
          </div>

          {/* 区切り */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-ink-line" />
            <span className="text-[10px] text-ink-mute">または</span>
            <div className="flex-1 h-px bg-ink-line" />
          </div>

          {/* LINEエラー表示 */}
          {lineError && (
            <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
              <div className="font-bold mb-2">⚠ LINEログイン失敗</div>
              <div className="space-y-1">
                <div><span className="font-bold">エラー:</span> {lineError.message}</div>
                {lineError.status && <div><span className="font-bold">HTTPステータス:</span> {lineError.status}</div>}
                {lineError.reason && <div><span className="font-bold">原因コード:</span> {lineError.reason}</div>}
                {lineError.detail && (
                  <div className="break-all whitespace-pre-wrap">
                    <span className="font-bold">詳細:</span> {lineError.detail}
                  </div>
                )}
                {lineError.detail && lineError.detail.includes('Audience') && (
                  <div className="mt-2 pt-2 border-t border-rose-200 text-rose-600 space-y-1">
                    <div className="font-bold">▼ 確認手順</div>
                    <div>① LINE Developers Console を開く</div>
                    <div>② プロバイダー → LINE Login チャネル（緑アイコン）</div>
                    <div>③ 「チャネル基本設定」タブの「チャネルID」（10桁の数字）</div>
                    <div>④ その値を Vercel の <code className="bg-rose-100 px-1 rounded">LINE_LOGIN_CHANNEL_ID</code> に設定</div>
                    <div className="text-rose-500 mt-1">※ LIFF ID の前半（{lineError.channelIdHint}）は Channel ID と<strong>別物</strong>です。</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PWAモード警告 */}
          {isPWA && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <div className="font-bold mb-1">💡 PWAアプリでご利用中</div>
              <div>iOS のホーム画面アプリではLINEログインが正しく完了しないことがあります。<br />
              <strong>メアド + パスワードでのログイン</strong>を推奨します。</div>
            </div>
          )}

          {/* LINE / ゲスト */}
          <div className="space-y-2">
            <button
              onClick={startWithLine}
              disabled={loading}
              className="w-full bg-[#06C755] text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition"
            >
              {loading ? <span className="spinner" /> : <LogIn className="w-4 h-4" />}
              LINEでログイン
            </button>
            <button
              onClick={startAsGuest}
              className="w-full bg-white border border-ink-line text-ink-dim font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition hover:bg-surface-alt"
            >
              ゲストとして始める <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[10px] text-ink-mute text-center mt-2">
              ゲストはこの端末のみで使用 · LINE/メアドでデータをサーバーに保存
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 py-8 md:py-12">
        <h2 className="text-xl md:text-2xl font-bold text-center mb-2">できること</h2>
        <p className="text-center text-sm text-ink-dim mb-8">機能はあとから自由にON/OFFできます</p>

        <div className="grid md:grid-cols-2 gap-4">
          <FeatureCard
            icon={<Utensils className="w-6 h-6" />}
            color="bg-orange-50 text-brand-600"
            badge="標準"
            title="毎日の食事を簡単記録"
            desc="食品検索・写真AI解析・手入力の3パターン。180品目の日本食品DBから素早く選べます。"
          />
          <FeatureCard
            icon={<BarChart3 className="w-6 h-6" />}
            color="bg-blue-50 text-blue-600"
            badge="標準"
            title="体組成を見える化"
            desc="体重と体脂肪率の推移をグラフで確認。摂取カロリーから予測ペースも表示。"
          />
          <FeatureCard
            icon={<Sparkles className="w-6 h-6" />}
            color="bg-amber-50 text-amber-600"
            badge="標準"
            title="AIがアドバイス"
            desc="今日の食事内容を分析。タンパク質が足りない・脂質が多すぎ等、具体的に助言します。"
          />
          <FeatureCard
            icon={<Dumbbell className="w-6 h-6" />}
            color="bg-rose-50 text-rose-600"
            badge="選択制"
            title="トレーニング記録"
            desc="有酸素＋筋トレを部位別に記録。総負荷を自動計算してフォーム改善メモも残せます。"
          />
        </div>
      </section>

      {/* Member section */}
      <section className="bg-gradient-to-br from-brand-500 to-brand-600 text-white py-10 md:py-14">
        <div className="max-w-3xl mx-auto px-5 md:px-8 text-center">
          <h2 className="text-xl md:text-2xl font-bold mb-3">ONE'S BODY 会員の方へ</h2>
          <p className="text-sm md:text-base opacity-95 leading-relaxed">
            会員コードを入力すると、トレーナーがあなたの食事ログを直接確認し<br />
            個別フィードバックを送れるようになります。
          </p>
          <p className="mt-4 text-xs opacity-80">
            ※ コードは設定画面からいつでも入力できます
          </p>
        </div>
      </section>

      <div className="text-center py-6 text-[11px] text-ink-mute">
        ONE'S BODY · 食事管理サポート
      </div>
    </div>
  );
}

function FeatureCard({ icon, color, badge, title, desc }: { icon: React.ReactNode; color: string; badge: string; title: string; desc: string }) {
  return (
    <div className="bg-white border border-ink-line rounded-2xl p-5 hover:shadow-card transition">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-alt text-ink-dim">{badge}</span>
      </div>
      <h3 className="font-bold text-base mb-1">{title}</h3>
      <p className="text-xs text-ink-dim leading-relaxed">{desc}</p>
    </div>
  );
}

function HeroIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="w-full h-auto">
      <defs>
        <linearGradient id="plateBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFF4F0" />
          <stop offset="1" stopColor="#FFE4DA" />
        </linearGradient>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF5F3D" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF5F3D" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g transform="translate(40, 30)">
        <circle cx="55" cy="70" r="60" fill="url(#plateBg)" stroke="#FFC4AF" strokeWidth="2" />
        <circle cx="55" cy="70" r="48" fill="#FFFFFF" stroke="#FFC4AF" strokeWidth="1" />
        <path d="M 55 70 L 55 22 A 48 48 0 0 1 96 60 Z" fill="#4C8BF5" opacity="0.85" />
        <path d="M 55 70 L 96 60 A 48 48 0 0 1 87 105 Z" fill="#F59E0B" opacity="0.9" />
        <path d="M 55 70 L 87 105 A 48 48 0 0 1 23 105 Z" fill="#EF4444" opacity="0.85" />
        <path d="M 55 70 L 23 105 A 48 48 0 0 1 55 22 Z" fill="#22C55E" opacity="0.85" />
        <circle cx="55" cy="70" r="8" fill="#FFFFFF" />
        <text x="55" y="74" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FF5F3D">PFC</text>
      </g>
      <g transform="translate(180, 50)">
        <rect x="0" y="0" width="110" height="90" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
        <text x="10" y="18" fontSize="9" fontWeight="700" fill="#5C6470">体重推移</text>
        <text x="100" y="18" textAnchor="end" fontSize="9" fontWeight="700" fill="#FF5F3D">-2.4kg</text>
        <path d="M 10 75 L 25 70 L 40 62 L 55 58 L 70 50 L 85 45 L 100 38" stroke="#FF5F3D" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 10 75 L 25 70 L 40 62 L 55 58 L 70 50 L 85 45 L 100 38 L 100 85 L 10 85 Z" fill="url(#chartGrad)" />
        {[[10,75],[25,70],[40,62],[55,58],[70,50],[85,45],[100,38]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.2" fill="#FF5F3D" />
        ))}
        <line x1="10" y1="42" x2="100" y2="42" stroke="#FFA284" strokeWidth="1" strokeDasharray="3,2" />
      </g>
    </svg>
  );
}
