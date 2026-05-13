'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { getLiff, liffIdToken, liffLogin } from '@/lib/liff';
import * as storage from '@/lib/storage';
import { Utensils, BarChart3, Sparkles, Dumbbell, ChevronRight, LogIn, ArrowRight } from 'lucide-react';

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
        toast('LIFF未設定。一旦ゲストで開始してください。');
        return;
      }
      const ok = await liffLogin();
      if (!ok) return;
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

  return (
    <div className="min-h-screen bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-50/30 pt-10 pb-12 md:pt-20 md:pb-20">
        {/* Decorative blobs */}
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

          {/* Hero illustration (SVG only) */}
          <div className="mt-8 md:mt-10 max-w-md mx-auto">
            <HeroIllustration />
          </div>

          {/* CTA buttons */}
          <div className="mt-8 md:mt-10 max-w-sm mx-auto space-y-3">
            <button
              onClick={startWithLine}
              disabled={loading}
              className="w-full bg-[#06C755] text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50 shadow-soft"
            >
              {loading ? <span className="spinner" /> : <LogIn className="w-5 h-5" />}
              LINEでログイン
            </button>
            <button
              onClick={startAsGuest}
              className="w-full bg-white border border-ink-line text-ink font-bold rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition hover:bg-surface-alt"
            >
              ゲストとして始める
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-[11px] text-ink-mute mt-2">
              ゲストはこの端末のみで使用 · LINEログインでデータをサーバーに保存
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-16">
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
            desc="体重と体脂肪率の推移をグラフで確認。目標体重までの距離が一目でわかります。"
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

      {/* Closing CTA */}
      <section className="max-w-3xl mx-auto px-5 md:px-8 py-10 md:py-14 text-center">
        <h2 className="text-lg md:text-xl font-bold mb-4">今すぐ始めましょう</h2>
        <div className="max-w-sm mx-auto space-y-3">
          <button
            onClick={startAsGuest}
            className="w-full bg-brand-500 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-soft"
          >
            ゲストとして始める
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={startWithLine}
            disabled={loading}
            className="w-full bg-white border border-ink-line text-ink font-bold rounded-2xl py-3 text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" /> LINEでログイン
          </button>
        </div>
        <p className="text-[11px] text-ink-mute mt-6">
          ONE'S BODY · 食事管理サポート
        </p>
      </section>
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

      {/* Plate left */}
      <g transform="translate(40, 30)">
        <circle cx="55" cy="70" r="60" fill="url(#plateBg)" stroke="#FFC4AF" strokeWidth="2" />
        <circle cx="55" cy="70" r="48" fill="#FFFFFF" stroke="#FFC4AF" strokeWidth="1" />
        {/* food sections */}
        <path d="M 55 70 L 55 22 A 48 48 0 0 1 96 60 Z" fill="#4C8BF5" opacity="0.85" />
        <path d="M 55 70 L 96 60 A 48 48 0 0 1 87 105 Z" fill="#F59E0B" opacity="0.9" />
        <path d="M 55 70 L 87 105 A 48 48 0 0 1 23 105 Z" fill="#EF4444" opacity="0.85" />
        <path d="M 55 70 L 23 105 A 48 48 0 0 1 55 22 Z" fill="#22C55E" opacity="0.85" />
        <circle cx="55" cy="70" r="8" fill="#FFFFFF" />
        <text x="55" y="74" textAnchor="middle" fontSize="9" fontWeight="700" fill="#FF5F3D">PFC</text>
      </g>

      {/* Chart right */}
      <g transform="translate(180, 50)">
        <rect x="0" y="0" width="110" height="90" rx="14" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="1" />
        <text x="10" y="18" fontSize="9" fontWeight="700" fill="#5C6470">体重推移</text>
        <text x="100" y="18" textAnchor="end" fontSize="9" fontWeight="700" fill="#FF5F3D">-2.4kg</text>
        {/* chart line */}
        <path d="M 10 75 L 25 70 L 40 62 L 55 58 L 70 50 L 85 45 L 100 38" stroke="#FF5F3D" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 10 75 L 25 70 L 40 62 L 55 58 L 70 50 L 85 45 L 100 38 L 100 85 L 10 85 Z" fill="url(#chartGrad)" />
        {/* dots */}
        {[[10,75],[25,70],[40,62],[55,58],[70,50],[85,45],[100,38]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.2" fill="#FF5F3D" />
        ))}
        {/* target line */}
        <line x1="10" y1="42" x2="100" y2="42" stroke="#FFA284" strokeWidth="1" strokeDasharray="3,2" />
      </g>

      {/* Sparkle decorations */}
      <g opacity="0.6">
        <circle cx="160" cy="25" r="3" fill="#FF5F3D" />
        <circle cx="290" cy="160" r="4" fill="#F59E0B" />
        <circle cx="20" cy="170" r="3" fill="#4C8BF5" />
      </g>
    </svg>
  );
}
