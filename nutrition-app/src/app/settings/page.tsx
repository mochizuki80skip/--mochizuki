'use client';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { LogIn, LogOut, Settings as SettingsIcon, Trophy, User, RefreshCw } from 'lucide-react';
import * as storage from '@/lib/storage';
import { calcTargets, GOAL_PRESETS, ACTIVITY_FACTORS, bmi } from '@/lib/nutrition';
import { getLiff, liffIdToken, liffLogin, liffLogout, liffProfile } from '@/lib/liff';

export default function SettingsPage() {
  return (
    <AppShell user={null}>
      <SettingsView />
    </AppShell>
  );
}

function SettingsView() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [edit, setEdit] = useState<any>({});
  const [code, setCode] = useState('');

  useEffect(() => {
    (async () => {
      setLoggedIn(typeof document !== 'undefined' && document.cookie.includes('om_user='));
      const p = await storage.getProfile();
      if (p) { setProfile(p); setEdit(p); }
    })();
  }, []);

  const targets = profile ? calcTargets(profile) : null;

  // ---- LINE login flow ----
  const onLogin = async () => {
    const liff = await getLiff();
    if (!liff) {
      toast('LIFF未設定です（NEXT_PUBLIC_LIFF_ID）');
      return;
    }
    const ok = await liffLogin();
    if (!ok) return; // redirected
    const token = await liffIdToken();
    if (!token) { toast('IDトークン取得に失敗'); return; }
    const res = await fetch('/api/auth/line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });
    if (!res.ok) { toast('ログインに失敗しました'); return; }
    // Sync local data → server
    const sync = await storage.syncLocalToServer();
    if (sync.meals + sync.weights > 0) {
      toast(`ログイン完了。${sync.meals + sync.weights}件をサーバーに同期しました`);
    } else {
      toast('ログインしました');
    }
    setLoggedIn(true);
    location.reload();
  };

  const onLogout = async () => {
    if (!confirm('ログアウトしますか？')) return;
    await fetch('/api/auth/line', { method: 'DELETE' });
    await liffLogout();
    setLoggedIn(false);
    toast('ログアウトしました');
    location.reload();
  };

  // ---- Profile edit ----
  const saveEdit = async () => {
    await storage.saveProfile({
      ...profile,
      ...edit,
      age: +edit.age,
      heightCm: +edit.heightCm,
      weightKg: +edit.weightKg,
      targetWeight: +edit.targetWeight
    });
    const p = await storage.getProfile();
    setProfile(p);
    setShowEdit(false);
    toast('保存しました');
  };

  // ---- Member code ----
  const applyCode = async () => {
    if (!code.trim()) return toast('コードを入力してください');
    if (loggedIn) {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberCode: code.trim() })
      });
      const data = await res.json();
      if (data.isMember) {
        toast('会員認証完了！');
        setShowCode(false);
        setCode('');
        setProfile(data);
      } else {
        toast('コードが無効です');
      }
    } else {
      toast('LINEログイン後に有効化されます');
      // Save locally for now
      await storage.saveProfile({ ...profile, memberCode: code.trim() });
      const p = await storage.getProfile();
      setProfile(p);
      setShowCode(false);
      setCode('');
    }
  };

  if (!profile) return <div className="flex justify-center py-20"><span className="spinner" /></div>;

  return (
    <>
      {/* Profile header */}
      <div className="card mb-3 flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white font-bold text-xl">
          {profile.displayName ? profile.displayName.slice(0, 1) : <User className="w-6 h-6" />}
        </div>
        <div className="flex-1">
          <div className="font-bold">{profile.displayName || 'ゲストユーザー'}</div>
          <div className="text-xs text-ink-dim">
            {loggedIn ? 'LINE連携済み' : 'ゲストモード'}
            {profile.isMember && <span className="ml-2 px-2 py-0.5 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold">ONE'S BODY 会員</span>}
          </div>
        </div>
      </div>

      {/* Login / Logout */}
      {!loggedIn ? (
        <div className="card mb-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
          <div className="flex items-center gap-2 mb-2">
            <LogIn className="w-5 h-5" />
            <div className="font-bold">LINEでログインしてデータを保存</div>
          </div>
          <p className="text-xs opacity-90 mb-3">機種変更しても食事ログ・体重・目標が引き継がれます。</p>
          <button onClick={onLogin} className="bg-white text-brand-600 font-bold rounded-xl py-3 w-full flex items-center justify-center gap-2 active:scale-95 transition">
            <LogIn className="w-4 h-4" /> LINEでログイン
          </button>
        </div>
      ) : (
        <button onClick={onLogout} className="card mb-3 w-full text-left flex items-center gap-3">
          <LogOut className="w-5 h-5 text-ink-mute" />
          <span className="text-sm">ログアウト</span>
        </button>
      )}

      {/* Member code */}
      <button onClick={() => setShowCode(true)} className="card mb-3 w-full text-left flex items-center gap-3">
        <Trophy className="w-5 h-5 text-brand-500" />
        <div className="flex-1">
          <div className="text-sm font-semibold">{profile.isMember ? '会員モード' : '会員コードを入力'}</div>
          <div className="text-xs text-ink-mute">{profile.isMember ? `コード: ${profile.memberCode}` : 'ONE\'S BODY 会員の方はこちら'}</div>
        </div>
      </button>

      {/* Targets card */}
      {targets && (
        <div className="card mb-3">
          <h2 className="font-bold text-base mb-3">目標カロリーとPFC</h2>
          <Row label="基礎代謝" value={`${targets.bmr} kcal`} />
          <Row label="活動代謝 (TDEE)" value={`${targets.tdee} kcal`} />
          <Row label="目標カロリー" value={`${targets.kcal} kcal`} highlight />
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-ink-line">
            <Stat label="P" value={`${targets.protein}g`} color="text-blue-600 bg-blue-50" />
            <Stat label="F" value={`${targets.fat}g`} color="text-yellow-600 bg-yellow-50" />
            <Stat label="C" value={`${targets.carbs}g`} color="text-red-600 bg-red-50" />
          </div>
        </div>
      )}

      {/* Profile details */}
      <div className="card mb-3">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-base">プロフィール</h2>
          <button onClick={() => { setEdit(profile); setShowEdit(true); }} className="text-brand-600 text-xs font-bold">編集</button>
        </div>
        <Row label="性別" value={profile.sex === 'male' ? '男性' : '女性'} />
        <Row label="年齢" value={`${profile.age} 歳`} />
        <Row label="身長" value={`${profile.heightCm} cm`} />
        <Row label="現体重" value={`${profile.weightKg} kg`} />
        <Row label="目標体重" value={`${profile.targetWeight} kg`} />
        <Row label="活動量" value={({ low: '低', mid: '中', high: '高' })[profile.activity as 'low']} />
        <Row label="目標" value={GOAL_PRESETS[profile.goal as 'diet']?.label} />
        <Row label="BMI" value={String(bmi(profile.weightKg, profile.heightCm))} />
      </div>

      <div className="text-center text-[10px] text-ink-mute py-4">
        ONE'S MEAL · ONE'S BODY パーソナルジム
      </div>

      {/* Edit modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="プロフィール編集">
        <div className="mb-3">
          <label className="label">性別</label>
          <div className="flex gap-2">
            {[{k:'male',l:'男性'},{k:'female',l:'女性'}].map((o) => (
              <button key={o.k} onClick={() => setEdit({ ...edit, sex: o.k })} className={`chip flex-1 ${edit.sex === o.k ? 'chip-active' : ''}`}>{o.l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="label">年齢</label><input className="input" type="number" value={edit.age || ''} onChange={(e) => setEdit({ ...edit, age: e.target.value })} /></div>
          <div><label className="label">身長 (cm)</label><input className="input" type="number" step="0.1" value={edit.heightCm || ''} onChange={(e) => setEdit({ ...edit, heightCm: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="label">体重 (kg)</label><input className="input" type="number" step="0.1" value={edit.weightKg || ''} onChange={(e) => setEdit({ ...edit, weightKg: e.target.value })} /></div>
          <div><label className="label">目標体重 (kg)</label><input className="input" type="number" step="0.1" value={edit.targetWeight || ''} onChange={(e) => setEdit({ ...edit, targetWeight: e.target.value })} /></div>
        </div>
        <div className="mb-3">
          <label className="label">活動量</label>
          <div className="flex gap-2">
            {Object.keys(ACTIVITY_FACTORS).map((k) => (
              <button key={k} onClick={() => setEdit({ ...edit, activity: k })} className={`chip flex-1 ${edit.activity === k ? 'chip-active' : ''}`}>{({low:'低',mid:'中',high:'高'})[k as 'low']}</button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <label className="label">目標</label>
          <div className="flex gap-2">
            {Object.entries(GOAL_PRESETS).map(([k, v]) => (
              <button key={k} onClick={() => setEdit({ ...edit, goal: k })} className={`chip flex-1 ${edit.goal === k ? 'chip-active' : ''}`}>{v.label}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setShowEdit(false)}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={saveEdit}>保存</button>
        </div>
      </Modal>

      {/* Member code modal */}
      <Modal open={showCode} onClose={() => setShowCode(false)} title="会員コード入力">
        <p className="text-sm text-ink-dim mb-3">
          ONE'S BODYで配布された会員コードを入力すると、トレーナーがあなたの食事ログを閲覧してアドバイスできるようになります。
        </p>
        <div className="mb-4">
          <label className="label">会員コード</label>
          <input className="input" type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例: ONES2026" autoCapitalize="characters" />
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => setShowCode(false)}>キャンセル</button>
          <button className="btn-primary flex-1" onClick={applyCode}>適用する</button>
        </div>
      </Modal>
    </>
  );
}

function Row({ label, value, highlight }: { label: string; value: string | undefined; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-sm text-ink-dim">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-brand-600' : ''}`}>{value || '—'}</span>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`rounded-lg p-2 text-center ${color}`}>
      <div className="text-[10px] font-bold">{label}</div>
      <div className="text-sm font-bold mt-0.5">{value}</div>
    </div>
  );
}
