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

const DB_NAME = 'ones-meal-v2';
const DB_VERSION = 1;

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
function isLoggedIn(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((c) => c.trim().startsWith('om_user='));
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
