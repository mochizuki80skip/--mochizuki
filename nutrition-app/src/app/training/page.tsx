'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { Plus, Dumbbell, ChevronLeft, ChevronRight, Activity, ArrowLeft } from 'lucide-react';
import * as storage from '@/lib/storage';
import { BODY_PARTS, setVolume, maxRMFromSets } from '@/lib/training';
import { todayStr, daysAgo, fmtShortDate } from '@/lib/utils';
import { LineChart } from '@/components/ui/LineChart';
import type { UserFeatures } from '@/components/layout/Navigation';
import { ExerciseSelectModal } from '@/components/training/ExerciseSelectModal';
import { SetRecordModal } from '@/components/training/SetRecordModal';
import { CardioInputModal } from '@/components/training/CardioInputModal';
import { WorkoutListItem } from '@/components/training/WorkoutListItem';

type TabKey = 'record' | 'analysis';

export default function TrainingPage() {
  return <TrainingContent />;
}

function TrainingContent() {
  const router = useRouter();
  const { toast } = useToast?.() || ({ toast: () => {} } as any);
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>({ featExercise: false, featSleep: false, featWater: false, featSteps: false });
  const [tab, setTab] = useState<TabKey>('record');
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [bodyPartFilter, setBodyPartFilter] = useState<string>('all');
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showExerciseSelect, setShowExerciseSelect] = useState(false);
  const [showCardio, setShowCardio] = useState(false);
  const [pickedExercise, setPickedExercise] = useState<{ bodyPart: string; exercise: string } | null>(null);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { router.replace('/onboarding'); return; }
      setProfile(p);
      setFeatures({
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      });
      await refresh();
    })();
  }, [router]);

  const refresh = async () => setAllWorkouts(await storage.getRecentWorkouts(120));

  if (!profile) {
    return (
      <AppShell features={features}>
        <div className="flex justify-center py-20"><span className="spinner" /></div>
      </AppShell>
    );
  }

  if (!features.featExercise) {
    return (
      <AppShell features={features}>
        <div className="card text-center py-12">
          <Dumbbell className="w-12 h-12 text-brand-500 mx-auto mb-3" />
          <h2 className="font-bold text-lg mb-2">トレーニング機能はOFFです</h2>
          <p className="text-sm text-ink-dim mb-4">設定からONにすると、有酸素・筋トレを記録できます。</p>
          <button onClick={() => router.push('/settings')} className="btn-primary">設定へ</button>
        </div>
      </AppShell>
    );
  }

  // 日付詳細表示モード（添付1枚目の画面）
  if (selectedDate) {
    return (
      <AppShell user={null} features={features}>
        <DayDetailView
          date={selectedDate}
          workouts={allWorkouts.filter((w) => w.date === selectedDate)}
          bodyWeight={profile.weightKg}
          onBack={() => setSelectedDate(null)}
          onPickExercise={() => setShowExerciseSelect(true)}
          onPickCardio={() => setShowCardio(true)}
          onDelete={async (id: string) => { await storage.deleteWorkout(id); toast('削除'); await refresh(); }}
        />
        <ExerciseSelectModal
          open={showExerciseSelect}
          onClose={() => setShowExerciseSelect(false)}
          recentWorkouts={allWorkouts}
          onPick={(bodyPart, exercise) => { setPickedExercise({ bodyPart, exercise }); setShowExerciseSelect(false); }}
          onPickCardio={() => { setShowExerciseSelect(false); setShowCardio(true); }}
        />
        <SetRecordModal
          open={!!pickedExercise}
          onClose={() => setPickedExercise(null)}
          bodyPart={pickedExercise?.bodyPart || ''}
          exercise={pickedExercise?.exercise || ''}
          bodyWeight={profile.weightKg}
          targetDate={selectedDate}
          allWorkouts={allWorkouts}
          onSaved={async () => { setPickedExercise(null); await refresh(); toast('記録しました'); }}
        />
        <CardioInputModal
          open={showCardio}
          onClose={() => setShowCardio(false)}
          bodyWeight={profile.weightKg}
          targetDate={selectedDate}
          onSaved={async () => { setShowCardio(false); await refresh(); toast('記録しました'); }}
        />
      </AppShell>
    );
  }

  return (
    <AppShell user={null} features={features}>
      <h1 className="text-xl md:text-2xl font-bold mb-3">トレーニング</h1>

      {/* タブ */}
      <div className="bg-surface-alt rounded-xl p-1 grid grid-cols-2 mb-4">
        <TabBtn active={tab === 'record'} onClick={() => setTab('record')}>記録</TabBtn>
        <TabBtn active={tab === 'analysis'} onClick={() => setTab('analysis')}>分析</TabBtn>
      </div>

      {tab === 'record' && (
        <RecordTab
          allWorkouts={allWorkouts}
          calMonth={calMonth}
          onChangeMonth={setCalMonth}
          onSelectDate={setSelectedDate}
        />
      )}

      {tab === 'analysis' && (
        <AnalysisTab
          allWorkouts={allWorkouts}
          bodyPartFilter={bodyPartFilter}
          onChangeFilter={setBodyPartFilter}
        />
      )}
    </AppShell>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`py-2 text-sm font-bold rounded-md transition ${active ? 'bg-white text-brand-600 shadow-sm' : 'text-ink-mute'}`}>
      {children}
    </button>
  );
}

/* ---------- 記録タブ：カレンダー + サマリー ---------- */
function RecordTab({ allWorkouts, calMonth, onChangeMonth, onSelectDate }: any) {
  const monthStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const monthEnd = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const monthLabel = `${calMonth.getFullYear()}年${calMonth.getMonth() + 1}月`;
  const workoutDates = new Set(allWorkouts.map((w: any) => w.date));

  // 期間サマリー
  const days7Volume = volumeSumForRange(allWorkouts, 7);
  const days28Volume = volumeSumForRange(allWorkouts, 28);
  const totalVolume = allWorkouts.filter((w: any) => w.type === 'strength').flatMap((w: any) => w.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const totalDays = workoutDates.size;
  const monthArchive = Array.from(workoutDates).filter((d) => {
    const date = new Date(d as string);
    return date.getFullYear() === calMonth.getFullYear() && date.getMonth() === calMonth.getMonth();
  }).length;

  return (
    <>
      {/* サマリー4ステート（添付1枚目風） */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <SummaryStat label="7日間 総負荷" value={(days7Volume / 1000).toFixed(2)} unit="t" />
        <SummaryStat label="28日間 総負荷" value={(days28Volume / 1000).toFixed(2)} unit="t" />
        <SummaryStat label="月の記録日数" value={`${monthArchive}`} unit="日" />
        <SummaryStat label="総合 総負荷" value={(totalVolume / 1000).toFixed(2)} unit="t" />
      </div>

      {/* カレンダー */}
      <div className="card mb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => onChangeMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-2 hover:bg-surface-alt rounded-lg">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="font-bold">{monthLabel}</div>
          <button onClick={() => onChangeMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-2 hover:bg-surface-alt rounded-lg">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ink-mute font-bold mb-1">
          {['日','月','火','水','木','金','土'].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="aspect-square" />;
            const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const has = workoutDates.has(dateStr);
            const isToday = dateStr === todayStr();
            return (
              <button
                key={i}
                onClick={() => onSelectDate(dateStr)}
                className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition ${
                  has ? 'bg-brand-500 text-white' :
                  isToday ? 'border-2 border-brand-500 text-brand-600' :
                  'text-ink-dim hover:bg-surface-alt'
                }`}
              >{d}</button>
            );
          })}
        </div>
      </div>

      {/* 本日のトレを追加 */}
      <button
        onClick={() => onSelectDate(todayStr())}
        className="btn-primary w-full !py-4"
      >
        <Plus className="w-5 h-5" /> 本日のトレーニングを開く
      </button>
    </>
  );
}

function SummaryStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="card !p-3">
      <div className="text-[10px] font-bold text-ink-mute">{label}</div>
      <div className="text-lg font-bold mt-1">{value}<span className="text-xs font-normal text-ink-dim ml-1">{unit}</span></div>
    </div>
  );
}

function volumeSumForRange(all: any[], days: number) {
  const cutoff = daysAgo(days);
  return all
    .filter((w) => w.date >= cutoff && w.type === 'strength')
    .flatMap((w) => w.sets || [])
    .reduce((s, st) => s + setVolume(st.weight, st.reps), 0);
}

/* ---------- 日付詳細画面（添付1枚目風） ---------- */
function DayDetailView({ date, workouts, bodyWeight, onBack, onPickExercise, onPickCardio, onDelete }: any) {
  const totalExercises = new Set(
    workouts.filter((w: any) => w.type === 'strength')
      .flatMap((w: any) => (w.sets || []).map((s: any) => `${s.bodyPart}-${s.exercise}`))
  ).size + workouts.filter((w: any) => w.type === 'cardio').length;
  const totalSets = workouts.filter((w: any) => w.type === 'strength').reduce((s: number, w: any) => s + (w.sets || []).length, 0);
  const totalReps = workouts.filter((w: any) => w.type === 'strength').flatMap((w: any) => w.sets || []).reduce((s: number, st: any) => s + (st.reps || 0), 0);
  const totalVolume = workouts.filter((w: any) => w.type === 'strength').flatMap((w: any) => w.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  return (
    <>
      {/* ヘッダー（添付1枚目風） */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-sm text-brand-600 font-bold flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> 戻る
          </button>
          <div className="text-base font-bold">{date}</div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <DayStat label="種目数" value={totalExercises} />
          <DayStat label="セット数" value={totalSets} />
          <DayStat label="レップ数" value={totalReps} />
          <DayStat label="負荷量" value={totalVolume === 0 ? '0.0' : (totalVolume / 1000).toFixed(2) + 't'} large />
        </div>
      </div>

      {/* 記録 */}
      {workouts.length === 0 ? (
        <div className="card text-center py-12 mb-3">
          <Dumbbell className="w-14 h-14 text-rose-300 mx-auto mb-3" />
          <div className="text-sm font-bold text-ink-dim mb-2">タップしてトレーニング記録を追加</div>
          <div className="flex gap-2 justify-center">
            <button onClick={onPickExercise} className="btn-primary text-xs !py-2">
              <Plus className="w-3 h-3" /> 筋トレ
            </button>
            <button onClick={onPickCardio} className="btn-ghost text-xs !py-2">
              <Plus className="w-3 h-3" /> 有酸素
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="card mb-3">
            <h2 className="font-bold text-base mb-3">この日のワークアウト</h2>
            <div className="space-y-3">
              {workouts.map((w: any) => (
                <WorkoutListItem key={w.id} workout={w} expanded onDelete={() => onDelete(w.id)} />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={onPickExercise} className="btn-primary"><Plus className="w-4 h-4" /> 筋トレ追加</button>
            <button onClick={onPickCardio} className="btn-ghost"><Plus className="w-4 h-4" /> 有酸素追加</button>
          </div>
        </>
      )}
    </>
  );
}

function DayStat({ label, value, large }: { label: string; value: string | number; large?: boolean }) {
  return (
    <div className="bg-brand-500 text-white rounded-xl px-2 py-2 text-center">
      <div className="text-[10px] opacity-90 font-bold">{label}</div>
      <div className={`font-bold mt-0.5 ${large ? 'text-base' : 'text-lg'}`}>{value}</div>
    </div>
  );
}

/* ---------- 分析タブ ---------- */
function AnalysisTab({ allWorkouts, bodyPartFilter, onChangeFilter }: any) {
  const filtered = useMemo(() => {
    if (bodyPartFilter === 'all') return allWorkouts;
    if (bodyPartFilter === 'cardio') return allWorkouts.filter((w: any) => w.type === 'cardio');
    return allWorkouts.filter((w: any) =>
      w.type === 'strength' && (w.sets || []).some((s: any) => s.bodyPart === bodyPartFilter)
    );
  }, [allWorkouts, bodyPartFilter]);

  const volumeByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of filtered) {
      if (w.type !== 'strength') continue;
      const sets = bodyPartFilter === 'all'
        ? (w.sets || [])
        : (w.sets || []).filter((s: any) => s.bodyPart === bodyPartFilter);
      const vol = sets.reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);
      map.set(w.date, (map.get(w.date) || 0) + vol);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-20);
  }, [filtered, bodyPartFilter]);

  const maxRMByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of filtered) {
      if (w.type !== 'strength') continue;
      const sets = bodyPartFilter === 'all'
        ? (w.sets || [])
        : (w.sets || []).filter((s: any) => s.bodyPart === bodyPartFilter);
      const rm = maxRMFromSets(sets);
      if (rm > 0) map.set(w.date, Math.max(map.get(w.date) || 0, rm));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-20);
  }, [filtered, bodyPartFilter]);

  const totalDays = new Set(filtered.map((w: any) => w.date)).size;
  const totalVolume = filtered.filter((w: any) => w.type === 'strength').flatMap((w: any) =>
    bodyPartFilter === 'all' ? (w.sets || []) : (w.sets || []).filter((s: any) => s.bodyPart === bodyPartFilter)
  ).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  return (
    <>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-3 [scrollbar-width:none]">
        <FilterChip active={bodyPartFilter === 'all'} onClick={() => onChangeFilter('all')}>ALL</FilterChip>
        {BODY_PARTS.filter((p) => p.key !== 'other').map((p) => (
          <FilterChip key={p.key} active={bodyPartFilter === p.key} onClick={() => onChangeFilter(p.key)}>{p.label}</FilterChip>
        ))}
        <FilterChip active={bodyPartFilter === 'cardio'} onClick={() => onChangeFilter('cardio')}>有酸素</FilterChip>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="card !p-3">
          <div className="text-[10px] font-bold text-ink-mute">期間内 トレ日数</div>
          <div className="text-lg font-bold mt-1">{totalDays}<span className="text-xs font-normal text-ink-dim ml-1">日</span></div>
        </div>
        <div className="card !p-3">
          <div className="text-[10px] font-bold text-ink-mute">期間内 総負荷</div>
          <div className="text-lg font-bold mt-1">{(totalVolume / 1000).toFixed(2)}<span className="text-xs font-normal text-ink-dim ml-1">t</span></div>
        </div>
      </div>

      <div className="card mb-3">
        <h3 className="font-bold text-sm mb-2">総負荷推移</h3>
        {volumeByDate.length > 1 ? (
          <LineChart
            points={volumeByDate.map(([d, v]) => ({ y: v, label: fmtShortDate(d) }))}
            height={160}
          />
        ) : (
          <div className="text-xs text-ink-mute text-center py-6">記録を続けるとグラフが表示されます</div>
        )}
      </div>

      <div className="card">
        <h3 className="font-bold text-sm mb-2">最大1RM推移（推定）</h3>
        {maxRMByDate.length > 1 ? (
          <LineChart
            points={maxRMByDate.map(([d, v]) => ({ y: v, label: fmtShortDate(d) }))}
            height={160}
          />
        ) : (
          <div className="text-xs text-ink-mute text-center py-6">記録を続けるとグラフが表示されます</div>
        )}
      </div>
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 chip text-xs ${active ? 'chip-active' : ''}`}>{children}</button>
  );
}
