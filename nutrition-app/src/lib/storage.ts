// ハイブリッド保存: ログインユーザーはサーバーAPI、ゲストはIndexedDB
'use client';

export interface ProfileData {
  sex?: string | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeight?: number | null;
  activity?: string | null;
  goal?: string | null;
  isMember?: boolean;
  memberCode?: string | null;
  displayName?: string;
  pictureUrl?: string | null;
  onboardedAt?: string | null;
  featExercise?: boolean;
  featSleep?: boolean;
  featWater?: boolean;
  featSteps?: boolean;
}

export interface MealRow {
  id: string;
  date: string;
  meal: string;
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  source?: string;
}

export interface WeightRow {
  date: string;
  weight: number;
  bodyFat?: number | null;
}

export interface StrengthSetRow {
  bodyPart: string;
  exercise: string;
  setNumber: number;
  weight?: number | null;
  reps?: number | null;
}

export interface StepsRow {
  date: string;
  count: number;
}

export interface SleepRow {
  date: string;
  bedtime?: string | null;
  wakeTime?: string | null;
  hours: number;
  quality?: number | null;
  memo?: string | null;
}

export interface WaterRow {
  date: string;
  ml: number;
}

export interface WorkoutRow {
  id: string;
  date: string;
  type: 'cardio' | 'strength';
  cardioName?: string | null;
  durationMin?: number | null;
  distanceKm?: number | null;
  kcal?: number | null;
  memo?: string | null;
  sets: StrengthSetRow[];
  createdAt?: string;
}

const DB_NAME = 'ones-meal-v2';
const DB_VERSION = 4;

let dbp: Promise<IDBDatabase> | null = null;
function openDB(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meals')) {
        const s = db.createObjectStore('meals', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('weights')) db.createObjectStore('weights', { keyPath: 'date' });
      if (!db.objectStoreNames.contains('workouts')) {
        const s = db.createObjectStore('workouts', { keyPath: 'id' });
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('steps')) {
        db.createObjectStore('steps', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('sleeps')) {
        db.createObjectStore('sleeps', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('waters')) {
        db.createObjectStore('waters', { keyPath: 'date' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Mode detection ----
// om_session は非httpOnly Cookie で、サーバー側で setUserCookie() と一緒に発行される
// （om_user は httpOnly なので JS から読めない）
function isLoggedIn(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('om_session='));
}

// ---- Profile ----
export async function getProfile(): Promise<ProfileData | null> {
  if (isLoggedIn()) {
    try {
      const res = await fetch('/api/profile', { cache: 'no-store' });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }
  const db = await openDB();
  const row = await reqP<ProfileData & { id?: string }>(db.transaction('profile').objectStore('profile').get('me'));
  if (!row) return null;
  delete row.id;
  return row;
}

export async function saveProfile(p: ProfileData): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p)
    });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('profile', 'readwrite').objectStore('profile').put({ id: 'me', ...p }));
}

// ---- Meals ----
export async function getMealsByDate(date: string): Promise<MealRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/meals?date=${date}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const idx = db.transaction('meals').objectStore('meals').index('date');
  return reqP<MealRow[]>(idx.getAll(IDBKeyRange.only(date)));
}

export async function getRecentMeals(limit = 30): Promise<MealRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/meals?recent=${limit}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<MealRow[]>(db.transaction('meals').objectStore('meals').getAll());
  return all.sort((a, b) => b.id.localeCompare(a.id)).slice(0, limit);
}

export async function getMealsRange(from: string, to: string): Promise<MealRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/meals?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const idx = db.transaction('meals').objectStore('meals').index('date');
  return reqP<MealRow[]>(idx.getAll(IDBKeyRange.bound(from, to)));
}

export async function addMeal(item: Omit<MealRow, 'id'>): Promise<MealRow> {
  if (isLoggedIn()) {
    const res = await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    return res.json();
  }
  const db = await openDB();
  const row: MealRow = { id: uid(), ...item };
  await reqP(db.transaction('meals', 'readwrite').objectStore('meals').add(row));
  return row;
}

export async function deleteMeal(id: string): Promise<void> {
  if (isLoggedIn()) {
    await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('meals', 'readwrite').objectStore('meals').delete(id));
}

/** 食事の量・栄養値を更新 */
export async function updateMeal(id: string, patch: Partial<{
  qty: number;
  unit: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}>): Promise<void> {
  if (isLoggedIn()) {
    await fetch(`/api/meals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch)
    });
    return;
  }
  const db = await openDB();
  const tx = db.transaction('meals', 'readwrite');
  const store = tx.objectStore('meals');
  const row = await reqP<any>(store.get(id));
  if (!row) return;
  Object.assign(row, patch);
  await reqP(store.put(row));
}

// ---- Weights ----
export async function getAllWeights(): Promise<WeightRow[]> {
  if (isLoggedIn()) {
    const res = await fetch('/api/weights', { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<WeightRow[]>(db.transaction('weights').objectStore('weights').getAll());
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function setWeight(date: string, weight: number, bodyFat?: number | null): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/weights', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, weight, bodyFat })
    });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('weights', 'readwrite').objectStore('weights').put({ date, weight, bodyFat: bodyFat ?? null }));
}

// ---- Workouts ----
export async function getWorkoutsByDate(date: string): Promise<WorkoutRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/workouts?date=${date}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const idx = db.transaction('workouts').objectStore('workouts').index('date');
  return reqP<WorkoutRow[]>(idx.getAll(IDBKeyRange.only(date)));
}

export async function getWorkoutsRange(from: string, to: string): Promise<WorkoutRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/workouts?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const idx = db.transaction('workouts').objectStore('workouts').index('date');
  return reqP<WorkoutRow[]>(idx.getAll(IDBKeyRange.bound(from, to)));
}

export async function getRecentWorkouts(limit = 30): Promise<WorkoutRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/workouts?recent=${limit}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<WorkoutRow[]>(db.transaction('workouts').objectStore('workouts').getAll());
  return all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, limit);
}

export async function addWorkout(w: Omit<WorkoutRow, 'id' | 'createdAt'>): Promise<WorkoutRow> {
  if (isLoggedIn()) {
    const res = await fetch('/api/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(w)
    });
    return res.json();
  }
  const db = await openDB();
  const row: WorkoutRow = { id: uid(), createdAt: new Date().toISOString(), ...w };
  await reqP(db.transaction('workouts', 'readwrite').objectStore('workouts').add(row));
  return row;
}

export async function deleteWorkout(id: string): Promise<void> {
  if (isLoggedIn()) {
    await fetch(`/api/workouts/${id}`, { method: 'DELETE' });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('workouts', 'readwrite').objectStore('workouts').delete(id));
}

/** セット単位の削除（ログインユーザーのみ。ゲストは workout 全体を編集して再保存が必要） */
export async function deleteStrengthSet(setId: string, workoutId?: string): Promise<void> {
  if (isLoggedIn()) {
    await fetch(`/api/strength-sets/${setId}`, { method: 'DELETE' });
    return;
  }
  if (!workoutId) return;
  // ゲスト時: workout を取得 → セット除外 → 保存し直し
  const db = await openDB();
  const tx = db.transaction('workouts', 'readwrite');
  const store = tx.objectStore('workouts');
  const row = await reqP<WorkoutRow>(store.get(workoutId));
  if (!row) return;
  // ID 一致は無理なので setNumber + bodyPart + exercise などで判定
  // setId が無いゲスト時は呼び出し側で workoutId と setNumber を渡す前提
  row.sets = (row.sets || []).filter((_, i, arr) => arr[i]?.setNumber !== undefined);
  // ゲスト時は単に sets 配列内のIDマッチが取れないので、ここではフル workout 上書きを期待しない
  // → ゲスト時は「セット個別削除」はサポート外（カード全体削除のみ）
}

// ---- Steps ----
export async function getStepsByDate(date: string): Promise<StepsRow | null> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/steps?date=${date}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }
  const db = await openDB();
  return reqP<StepsRow | null>(db.transaction('steps').objectStore('steps').get(date));
}

export async function getStepsRange(from: string, to: string): Promise<StepsRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/steps?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<StepsRow[]>(db.transaction('steps').objectStore('steps').getAll());
  return all.filter((s) => s.date >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export async function setStepsCount(date: string, count: number): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/steps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, count })
    });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('steps', 'readwrite').objectStore('steps').put({ date, count }));
}

// ---- Sleep ----
export async function getSleepByDate(date: string): Promise<SleepRow | null> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/sleep?date=${date}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }
  const db = await openDB();
  return reqP<SleepRow | null>(db.transaction('sleeps').objectStore('sleeps').get(date));
}

export async function getSleepRange(from: string, to: string): Promise<SleepRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/sleep?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<SleepRow[]>(db.transaction('sleeps').objectStore('sleeps').getAll());
  return all.filter((s) => s.date >= from && s.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export async function setSleep(row: SleepRow): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/sleep', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row)
    });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('sleeps', 'readwrite').objectStore('sleeps').put(row));
}

// ---- Water ----
export async function getWaterByDate(date: string): Promise<WaterRow | null> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/water?date=${date}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  }
  const db = await openDB();
  return reqP<WaterRow | null>(db.transaction('waters').objectStore('waters').get(date));
}

export async function getWaterRange(from: string, to: string): Promise<WaterRow[]> {
  if (isLoggedIn()) {
    const res = await fetch(`/api/water?from=${from}&to=${to}`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  }
  const db = await openDB();
  const all = await reqP<WaterRow[]>(db.transaction('waters').objectStore('waters').getAll());
  return all.filter((w) => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date));
}

export async function setWater(date: string, ml: number): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/water', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, ml })
    });
    return;
  }
  const db = await openDB();
  await reqP(db.transaction('waters', 'readwrite').objectStore('waters').put({ date, ml }));
}

export async function addWater(date: string, addMl: number): Promise<void> {
  if (isLoggedIn()) {
    await fetch('/api/water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, addMl })
    });
    return;
  }
  const db = await openDB();
  const tx = db.transaction('waters', 'readwrite');
  const cur = await reqP<WaterRow | null>(tx.objectStore('waters').get(date));
  const ml = Math.max(0, (cur?.ml || 0) + addMl);
  await reqP(tx.objectStore('waters').put({ date, ml }));
}

// ---- Sync (local → server on first login) ----
export async function syncLocalToServer(): Promise<{ meals: number; weights: number; profile: boolean }> {
  if (!isLoggedIn()) return { meals: 0, weights: 0, profile: false };
  const db = await openDB();
  const meals = await reqP<MealRow[]>(db.transaction('meals').objectStore('meals').getAll());
  const weights = await reqP<WeightRow[]>(db.transaction('weights').objectStore('weights').getAll());
  const profile = await reqP<ProfileData & { id?: string }>(db.transaction('profile').objectStore('profile').get('me'));

  if (meals.length || weights.length || profile) {
    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meals, weights, profile })
    });
    // clear local after sync
    const tx = db.transaction(['meals', 'weights', 'profile'], 'readwrite');
    tx.objectStore('meals').clear();
    tx.objectStore('weights').clear();
    tx.objectStore('profile').clear();
  }

  return { meals: meals.length, weights: weights.length, profile: !!profile };
}
