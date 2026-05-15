'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { Plus, Dumbbell, ChevronLeft, ChevronRight, Activity, ArrowLeft, Trash2 } from 'lucide-react';
import * as storage from '@/lib/storage';
import { BODY_PARTS, setVolume, maxRMFromSets } from '@/lib/training';
import { todayStr, daysAgo, fmtShortDate } from '@/lib/utils';
import { LineChart } from '@/components/ui/LineChart';
import type { UserFeatures } from '@/components/layout/Navigation';
import { getInitialFeatures, saveFeatures } from '@/lib/features-cache';
import { useRequireLogin } from '@/lib/use-login-check';
import { ExerciseSelectModal } from '@/components/training/ExerciseSelectModal';
import { SetRecordModal } from '@/components/training/SetRecordModal';
import { CardioInputModal } from '@/components/training/CardioInputModal';
import { ExerciseCard } from '@/components/training/ExerciseCard';
import { WeeklyVolumeBars } from '@/components/training/WeeklyVolumeBars';
import { groupDayWorkouts, dayExerciseLabels } from '@/lib/strength-set-grouping';

type TabKey = 'record' | 'analysis';

export default function TrainingPage() {
  return <TrainingContent />;
}

function TrainingContent() {
  useRequireLogin();
  const router = useRouter();
  const { toast } = useToast?.() || ({ toast: () => {} } as any);
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>(getInitialFeatures());
  const [tab, setTab] = useState<TabKey>('record');
  const [allWorkouts, setAllWorkouts] = useState<any[]>([]);
  const [bodyPartFilter, setBodyPartFilter] = useState<string>('all');
  const [calMonth, setCalMonth] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [showExerciseSelect, setShowExerciseSelect] = useState(false);
  const [showCardio, setShowCardio] = useState(false);
  const [pickedExercise, setPickedExercise] = useState<{ bodyPart: string; exercise: string; existingSets?: any[] } | null>(null);

  useEffect(() => {
    (async () => {
      const p = await storage.getProfile();
      if (!p || !p.sex) { router.replace('/onboarding'); return; }
      setProfile(p);
      const nf = {
        featExercise: !!(p as any).featExercise,
        featSleep: !!(p as any).featSleep,
        featWater: !!(p as any).featWater,
        featSteps: !!(p as any).featSteps
      };
      setFeatures(nf);
      saveFeatures(nf);
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
          allWorkouts={allWorkouts}
          bodyWeight={profile.weightKg}
          onBack={() => setSelectedDate(null)}
          onPickExercise={() => setShowExerciseSelect(true)}
          onPickCardio={() => setShowCardio(true)}
          onChangeDate={(d: string) => setSelectedDate(d)}
          onAddSetToExercise={(bodyPart: string, exercise: string) => setPickedExercise({ bodyPart, exercise })}
          onEditExercise={(bodyPart: string, exercise: string, existingSets: any[]) => setPickedExercise({ bodyPart, exercise, existingSets })}
          onDeleteSet={async (setId: string | undefined, workoutId: string) => {
            if (setId) {
              await storage.deleteStrengthSet(setId, workoutId);
            } else {
              await storage.deleteWorkout(workoutId);
            }
            toast('削除');
            await refresh();
          }}
          onDeleteCardio={async (workoutId: string) => {
            await storage.deleteWorkout(workoutId);
            toast('削除');
            await refresh();
          }}
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
          existingSets={pickedExercise?.existingSets}
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

/* ---------- 記録タブ：カレンダー + 週別棒グラフ ---------- */
function RecordTab({ allWorkouts, calMonth, onChangeMonth, onSelectDate }: any) {
  const monthStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const monthEnd = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0);
  const firstDay = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const monthLabel = `${calMonth.getFullYear()}年${calMonth.getMonth() + 1}月`;

  // 日付ごとの種目名（カレンダーホバー/タップで見せる用）
  const labelsByDate = new Map<string, string[]>();
  for (const w of allWorkouts) {
    if (!labelsByDate.has(w.date)) labelsByDate.set(w.date, []);
    if (w.type === 'cardio') labelsByDate.get(w.date)!.push(w.cardioName || '有酸素');
    else if (w.type === 'strength') {
      const exs = new Set<string>();
      for (const s of (w.sets || [])) exs.add(s.exercise);
      exs.forEach((e) => labelsByDate.get(w.date)!.push(e));
    }
  }

  // 期間サマリー
  const days7Volume = volumeSumForRange(allWorkouts, 7);
  const days28Volume = volumeSumForRange(allWorkouts, 28);
  const totalVolume = allWorkouts.filter((w: any) => w.type === 'strength').flatMap((w: any) => w.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const workoutDates = new Set(allWorkouts.map((w: any) => w.date));
  const monthArchive = Array.from(workoutDates).filter((d) => {
    const date = new Date(d as string);
    return date.getFullYear() === calMonth.getFullYear() && date.getMonth() === calMonth.getMonth();
  }).length;

  return (
    <>
      {/* カレンダー + 週別棒グラフ（左右2列 on md+） */}
      <div className="grid md:grid-cols-2 gap-3 mb-3">
        {/* カレンダー */}
        <div className="card">
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

        {/* 週別棒グラフ */}
        <div className="card">
          <h3 className="font-bold text-sm mb-3">週別 総負荷</h3>
          <WeeklyVolumeBars allWorkouts={allWorkouts} weeks={6} />
        </div>
      </div>

      {/* 直近の種目（カレンダーで日付なしでも見える） */}
      <div className="card mb-3">
        <h3 className="font-bold text-sm mb-2">最近の種目</h3>
        {allWorkouts.length === 0 ? (
          <div className="text-xs text-ink-mute text-center py-4">まだ記録がありません</div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {Array.from(new Set(allWorkouts.map((w: any) => w.date as string))).slice(0, 14).map((date) => {
              const d = date as string;
              const labels = labelsByDate.get(d) || [];
              return (
                <button
                  key={d}
                  onClick={() => onSelectDate(d)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-surface-alt rounded-lg hover:bg-ink-line/30 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold">{d}</div>
                    <div className="text-[11px] text-ink-dim truncate">{labels.join(' · ')}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ink-mute shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={() => onSelectDate(todayStr())} className="btn-primary w-full !py-4">
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
function DayDetailView({ date, workouts, allWorkouts, bodyWeight, onBack, onPickExercise, onPickCardio, onAddSetToExercise, onEditExercise, onDeleteSet, onDeleteCardio, onChangeDate }: any) {
  const groups = groupDayWorkouts(workouts);

  // 自己ベストを過去全データから取得
  const bestRMByExercise = computeBestRMs(allWorkouts);

  // 前日/翌日の日付計算
  const shiftDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    onChangeDate?.(s);
  };

  return (
    <>
      {/* ヘッダー：1行コンパクトナビ（戻る・前日/日付/翌日） */}
      <div className="bg-brand-500 -mx-4 md:-mx-8 px-3 md:px-8 pt-2 pb-3 mb-4">
        <div className="flex items-center mb-3 text-white gap-1">
          <button
            onClick={onBack}
            className="text-white flex items-center gap-0.5 text-[11px] font-medium hover:bg-white/15 active:bg-white/25 rounded px-1.5 py-1 transition shrink-0"
            aria-label="カレンダーへ戻る"
          >
            <ArrowLeft className="w-3.5 h-3.5" />カレンダー
          </button>
          <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0">
            <button
              onClick={() => shiftDate(-1)}
              className="text-white p-1 hover:bg-white/15 active:bg-white/25 rounded transition"
              aria-label="前日"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-bold tabular-nums px-1">{date}</div>
            <button
              onClick={() => shiftDate(1)}
              className="text-white p-1 hover:bg-white/15 active:bg-white/25 rounded transition"
              aria-label="翌日"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="w-[68px] shrink-0" />
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <DayStat label="合計種目数" value={groups.totalExercises} />
          <DayStat label="合計セット数" value={groups.totalSets} />
          <DayStat label="合計レップ数" value={groups.totalReps} />
          <DayStat label="合計負荷量" value={String(groups.totalVolume)} />
        </div>
      </div>

      {/* 記録 */}
      {workouts.length === 0 ? (
        <div className="card text-center py-12 mb-3">
          <Dumbbell className="w-14 h-14 text-rose-300 mx-auto mb-3" />
          <div className="text-sm font-bold text-ink-dim mb-2">タップしてトレーニング記録を追加</div>
          <div className="flex gap-2 justify-center mt-3">
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
          <div className="space-y-3 mb-3">
            {groups.exercises.map((g) => (
              <ExerciseCard
                key={`${g.bodyPart}-${g.exercise}`}
                group={g}
                bestRM={bestRMByExercise.get(`${g.bodyPart}-${g.exercise}`) || 0}
                onAddSet={() => onAddSetToExercise(g.bodyPart, g.exercise)}
                onEdit={() => onEditExercise(g.bodyPart, g.exercise, g.sets)}
                onDeleteSet={(setId, workoutId) => onDeleteSet(setId, workoutId)}
              />
            ))}

            {groups.cardios.map((c) => (
              <div key={c.workoutId} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="bg-emerald-500 text-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-base">{c.cardioName}</div>
                    <div className="text-[10px] opacity-90">
                      {c.durationMin ? `${c.durationMin}分` : ''}
                      {c.distanceKm ? ` · ${c.distanceKm}km` : ''}
                      {c.kcal ? ` · ${c.kcal}kcal` : ''}
                    </div>
                  </div>
                  <button onClick={() => onDeleteCardio(c.workoutId)} className="text-white/80 hover:text-white p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {c.memo && (
                  <div className="px-4 py-2 text-xs text-ink-dim italic">{c.memo}</div>
                )}
              </div>
            ))}
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

function computeBestRMs(allWorkouts: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of allWorkouts) {
    if (w.type !== 'strength') continue;
    for (const s of (w.sets || [])) {
      const key = `${s.bodyPart}-${s.exercise}`;
      const rm = (s.weight || 0) * 36 / Math.max(1, 37 - Math.min(s.reps || 0, 12));
      if (!isFinite(rm) || rm <= 0) continue;
      if ((map.get(key) || 0) < rm) map.set(key, rm);
    }
  }
  return map;
}

function DayStat({ label, value, large }: { label: string; value: string | number; large?: boolean }) {
  return (
    <div className="bg-white/15 border border-white/30 text-white rounded-xl px-2 py-2 text-center">
      <div className="text-[10px] opacity-90 font-medium">{label}</div>
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
        {volumeByDate.length > 0 ? (
          <LineChart
            points={volumeByDate.map(([d, v]) => ({ y: v, label: fmtShortDate(d) }))}
            height={160}
          />
        ) : (
          <div className="text-xs text-ink-mute text-center py-6">記録するとグラフが表示されます</div>
        )}
      </div>

      <div className="card">
        <h3 className="font-bold text-sm mb-2">最大1RM推移（推定）</h3>
        {maxRMByDate.length > 0 ? (
          <LineChart
            points={maxRMByDate.map(([d, v]) => ({ y: v, label: fmtShortDate(d) }))}
            height={160}
          />
        ) : (
          <div className="text-xs text-ink-mute text-center py-6">記録するとグラフが表示されます</div>
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
