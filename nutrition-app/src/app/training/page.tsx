'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useToast } from '@/components/ui/Toast';
import { Plus, Dumbbell, Calendar as CalendarIcon, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import * as storage from '@/lib/storage';
import { BODY_PARTS, setVolume, maxRMFromSets } from '@/lib/training';
import { todayStr, daysAgo, fmtShortDate } from '@/lib/utils';
import { LineChart } from '@/components/ui/LineChart';
import type { UserFeatures } from '@/components/layout/Navigation';
import { ExerciseSelectModal } from '@/components/training/ExerciseSelectModal';
import { SetRecordModal } from '@/components/training/SetRecordModal';
import { CardioInputModal } from '@/components/training/CardioInputModal';
import { WorkoutListItem } from '@/components/training/WorkoutListItem';

type TabKey = 'today' | 'history' | 'analysis';

export default function TrainingPage() {
  return <TrainingContent />;
}

function TrainingContent() {
  const router = useRouter();
  const { toast } = useToast?.() || ({ toast: () => {} } as any);
  const [profile, setProfile] = useState<any>(null);
  const [features, setFeatures] = useState<UserFeatures>({ featExercise: false, featSleep: false, featWater: false, featSteps: false });
  const [tab, setTab] = useState<TabKey>('today');
  const [todayWorkouts, setTodayWorkouts] = useState<any[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [bodyPartFilter, setBodyPartFilter] = useState<string>('all'); // for analysis
  const [historyMonth, setHistoryMonth] = useState<Date>(() => new Date());

  // モーダル状態
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

  const refresh = async () => {
    setTodayWorkouts(await storage.getWorkoutsByDate(todayStr()));
    setRecentWorkouts(await storage.getRecentWorkouts(60));
  };

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

  return (
    <AppShell user={null} features={features}>
      <h1 className="text-xl md:text-2xl font-bold mb-3">トレーニング</h1>

      {/* タブ */}
      <div className="bg-surface-alt rounded-xl p-1 grid grid-cols-3 mb-4">
        <TabBtn active={tab === 'today'} onClick={() => setTab('today')}>本日</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>履歴</TabBtn>
        <TabBtn active={tab === 'analysis'} onClick={() => setTab('analysis')}>分析</TabBtn>
      </div>

      {tab === 'today' && (
        <TodayTab
          workouts={todayWorkouts}
          allWorkouts={recentWorkouts}
          bodyWeight={profile.weightKg}
          onPickExercise={() => setShowExerciseSelect(true)}
          onPickCardio={() => setShowCardio(true)}
          onDelete={async (id: string) => { await storage.deleteWorkout(id); toast('削除'); await refresh(); }}
        />
      )}

      {tab === 'history' && (
        <HistoryTab
          month={historyMonth}
          onChangeMonth={setHistoryMonth}
          allWorkouts={recentWorkouts}
        />
      )}

      {tab === 'analysis' && (
        <AnalysisTab
          allWorkouts={recentWorkouts}
          bodyPartFilter={bodyPartFilter}
          onChangeFilter={setBodyPartFilter}
        />
      )}

      <ExerciseSelectModal
        open={showExerciseSelect}
        onClose={() => setShowExerciseSelect(false)}
        recentWorkouts={recentWorkouts}
        onPick={(bodyPart, exercise) => {
          setPickedExercise({ bodyPart, exercise });
          setShowExerciseSelect(false);
        }}
        onPickCardio={() => {
          setShowExerciseSelect(false);
          setShowCardio(true);
        }}
      />

      <SetRecordModal
        open={!!pickedExercise}
        onClose={() => setPickedExercise(null)}
        bodyPart={pickedExercise?.bodyPart || ''}
        exercise={pickedExercise?.exercise || ''}
        bodyWeight={profile.weightKg}
        allWorkouts={recentWorkouts}
        onSaved={async () => {
          setPickedExercise(null);
          await refresh();
          toast('記録しました');
        }}
      />

      <CardioInputModal
        open={showCardio}
        onClose={() => setShowCardio(false)}
        bodyWeight={profile.weightKg}
        onSaved={async () => {
          setShowCardio(false);
          await refresh();
          toast('記録しました');
        }}
      />
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

/* ---------- 本日タブ ---------- */
function TodayTab({ workouts, allWorkouts, bodyWeight, onPickExercise, onPickCardio, onDelete }: any) {
  const todayKcal = workouts.reduce((s: number, w: any) => s + (w.kcal || 0), 0);
  const todayMin = workouts.reduce((s: number, w: any) => s + (w.durationMin || 0), 0);
  const todayVolume = workouts.filter((w: any) => w.type === 'strength').flatMap((w: any) => w.sets || []).reduce((s: number, st: any) => s + setVolume(st.weight, st.reps), 0);

  // 7日・28日サマリー
  const days7 = volumeSumForRange(allWorkouts, 7);
  const days28 = volumeSumForRange(allWorkouts, 28);

  return (
    <>
      {/* 今日のサマリー */}
      <div className="card mb-3 bg-gradient-to-br from-brand-500 to-brand-600 text-white">
        <div className="text-xs opacity-90 font-medium">今日の運動</div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <div className="text-[10px] opacity-90">時間</div>
            <div className="text-xl font-bold mt-0.5">{todayMin}<span className="text-[10px] font-normal opacity-80 ml-0.5">分</span></div>
          </div>
          <div>
            <div className="text-[10px] opacity-90">消費</div>
            <div className="text-xl font-bold mt-0.5">{todayKcal}<span className="text-[10px] font-normal opacity-80 ml-0.5">kcal</span></div>
          </div>
          <div>
            <div className="text-[10px] opacity-90">総負荷</div>
            <div className="text-xl font-bold mt-0.5">{todayVolume}<span className="text-[10px] font-normal opacity-80 ml-0.5">kg</span></div>
          </div>
        </div>
      </div>

      {/* 期間サマリー（筋トレMEMO風） */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="card !p-3">
          <div className="text-[10px] font-bold text-ink-mute">7日間 総負荷</div>
          <div className="text-lg font-bold mt-1">{(days7 / 1000).toFixed(2)}<span className="text-xs font-normal text-ink-dim ml-1">t</span></div>
        </div>
        <div className="card !p-3">
          <div className="text-[10px] font-bold text-ink-mute">28日間 総負荷</div>
          <div className="text-lg font-bold mt-1">{(days28 / 1000).toFixed(2)}<span className="text-xs font-normal text-ink-dim ml-1">t</span></div>
        </div>
      </div>

      {/* ボタン */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={onPickExercise} className="btn-primary"><Plus className="w-4 h-4" /> 筋トレ記録</button>
        <button onClick={onPickCardio} className="btn-ghost"><Plus className="w-4 h-4" /> 有酸素記録</button>
      </div>

      {/* 今日のリスト */}
      {workouts.length > 0 ? (
        <div className="card">
          <h2 className="font-bold text-base mb-3">今日のワークアウト</h2>
          <div className="space-y-3">
            {workouts.map((w: any) => (
              <WorkoutListItem key={w.id} workout={w} expanded onDelete={() => onDelete(w.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <Dumbbell className="w-10 h-10 text-ink-mute mx-auto mb-2" />
          <div className="text-sm text-ink-mute">今日のワークアウトはまだありません</div>
        </div>
      )}
    </>
  );
}

function volumeSumForRange(all: any[], days: number) {
  const cutoff = daysAgo(days);
  return all
    .filter((w) => w.date >= cutoff && w.type === 'strength')
    .flatMap((w) => w.sets || [])
    .reduce((s, st) => s + setVolume(st.weight, st.reps), 0);
}

/* ---------- 履歴タブ：カレンダー ---------- */
function HistoryTab({ month, onChangeMonth, allWorkouts }: any) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const firstDay = monthStart.getDay(); // 0=Sun
  const daysInMonth = monthEnd.getDate();
  const monthLabel = `${month.getFullYear()}年${month.getMonth() + 1}月`;

  const workoutDates = new Set(allWorkouts.map((w: any) => w.date));

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goPrev = () => onChangeMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const goNext = () => onChangeMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedWorkouts = selectedDate ? allWorkouts.filter((w: any) => w.date === selectedDate) : [];

  return (
    <>
      <div className="card mb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={goPrev} className="p-2 hover:bg-surface-alt rounded-lg"><ChevronLeft className="w-4 h-4" /></button>
          <div className="font-bold">{monthLabel}</div>
          <button onClick={goNext} className="p-2 hover:bg-surface-alt rounded-lg"><ChevronRight className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-ink-mute font-bold mb-1">
          {['日','月','火','水','木','金','土'].map((d) => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} className="aspect-square" />;
            const dateStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const has = workoutDates.has(dateStr);
            const isSel = selectedDate === dateStr;
            const isToday = dateStr === todayStr();
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={`aspect-square rounded-full flex items-center justify-center text-xs font-bold transition ${
                  isSel ? 'bg-brand-500 text-white' :
                  has ? 'bg-brand-100 text-brand-700' :
                  isToday ? 'border border-brand-500 text-brand-600' :
                  'text-ink-dim hover:bg-surface-alt'
                }`}
              >{d}</button>
            );
          })}
        </div>
      </div>

      {selectedDate && (
        <div className="card">
          <h3 className="font-bold text-sm mb-3">{selectedDate} の記録</h3>
          {selectedWorkouts.length === 0 ? (
            <div className="text-xs text-ink-mute text-center py-4">記録なし</div>
          ) : (
            <div className="space-y-3">
              {selectedWorkouts.map((w: any) => (
                <WorkoutListItem key={w.id} workout={w} expanded />
              ))}
            </div>
          )}
        </div>
      )}

      {!selectedDate && (
        <div className="card">
          <h3 className="font-bold text-sm mb-3">最近のワークアウト</h3>
          {allWorkouts.length === 0 ? (
            <div className="text-xs text-ink-mute text-center py-4">記録なし</div>
          ) : (
            <div className="space-y-2">
              {allWorkouts.slice(0, 10).map((w: any) => (
                <WorkoutListItem key={w.id} workout={w} expanded={false} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- 分析タブ：グラフ ---------- */
function AnalysisTab({ allWorkouts, bodyPartFilter, onChangeFilter }: any) {
  const filtered = useMemo(() => {
    if (bodyPartFilter === 'all') return allWorkouts;
    if (bodyPartFilter === 'cardio') return allWorkouts.filter((w: any) => w.type === 'cardio');
    return allWorkouts.filter((w: any) =>
      w.type === 'strength' && (w.sets || []).some((s: any) => s.bodyPart === bodyPartFilter)
    );
  }, [allWorkouts, bodyPartFilter]);

  // 日別総負荷推移
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

  // 最大RM推移
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
      {/* フィルタ */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-2 mb-3 [scrollbar-width:none]">
        <FilterChip active={bodyPartFilter === 'all'} onClick={() => onChangeFilter('all')}>ALL</FilterChip>
        {BODY_PARTS.filter((p) => p.key !== 'other').map((p) => (
          <FilterChip key={p.key} active={bodyPartFilter === p.key} onClick={() => onChangeFilter(p.key)}>{p.label}</FilterChip>
        ))}
        <FilterChip active={bodyPartFilter === 'cardio'} onClick={() => onChangeFilter('cardio')}>有酸素</FilterChip>
      </div>

      {/* サマリー */}
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

      {/* 総負荷推移 */}
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

      {/* 最大RM推移 */}
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
