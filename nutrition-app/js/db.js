/* IndexedDB wrapper for ONE'S MEAL */
const DB_NAME = 'ones-meal-db';
const DB_VERSION = 1;

const STORES = {
  profile: { key: 'id' },     // single row, id='me'
  meals:   { key: 'id', indexes: [['date', 'date']] },
  weights: { key: 'date' },
  kv:      { key: 'k' }
};

let dbp = null;
function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [name, conf] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const s = db.createObjectStore(name, { keyPath: conf.key });
          (conf.indexes || []).forEach(([idxName, keyPath]) => s.createIndex(idxName, keyPath));
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode = 'readonly') {
  return openDB().then((db) => db.transaction(store, mode).objectStore(store));
}

function reqP(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Profile
async function getProfile() {
  const s = await tx('profile');
  return reqP(s.get('me'));
}
async function saveProfile(p) {
  const s = await tx('profile', 'readwrite');
  return reqP(s.put({ id: 'me', ...p, updatedAt: Date.now() }));
}

// Meals
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function addMeal(item) {
  const s = await tx('meals', 'readwrite');
  const row = { id: uid(), createdAt: Date.now(), ...item };
  await reqP(s.add(row));
  return row;
}
async function updateMeal(id, patch) {
  const s = await tx('meals', 'readwrite');
  const cur = await reqP(s.get(id));
  if (!cur) return null;
  const next = { ...cur, ...patch };
  await reqP(s.put(next));
  return next;
}
async function deleteMeal(id) {
  const s = await tx('meals', 'readwrite');
  return reqP(s.delete(id));
}
async function getMealsByDate(date) {
  const s = await tx('meals');
  const idx = s.index('date');
  return reqP(idx.getAll(IDBKeyRange.only(date)));
}
async function getRecentMeals(limit = 30) {
  const s = await tx('meals');
  const all = await reqP(s.getAll());
  return all.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}
async function getMealsRange(fromDate, toDate) {
  const s = await tx('meals');
  const idx = s.index('date');
  return reqP(idx.getAll(IDBKeyRange.bound(fromDate, toDate)));
}

// Weights
async function setWeight(date, w, bodyFat) {
  const s = await tx('weights', 'readwrite');
  const row = { date, weight: w, bodyFat: bodyFat ?? null, updatedAt: Date.now() };
  await reqP(s.put(row));
  return row;
}
async function getWeight(date) {
  const s = await tx('weights');
  return reqP(s.get(date));
}
async function getAllWeights() {
  const s = await tx('weights');
  const all = await reqP(s.getAll());
  return all.sort((a, b) => a.date.localeCompare(b.date));
}
async function deleteWeight(date) {
  const s = await tx('weights', 'readwrite');
  return reqP(s.delete(date));
}

// KV
async function kvGet(k) {
  const s = await tx('kv');
  const row = await reqP(s.get(k));
  return row ? row.v : null;
}
async function kvSet(k, v) {
  const s = await tx('kv', 'readwrite');
  return reqP(s.put({ k, v }));
}

// Export / Import
async function exportAll() {
  const db = await openDB();
  const data = {};
  await Promise.all(Object.keys(STORES).map((name) => new Promise((resolve) => {
    const t = db.transaction(name).objectStore(name).getAll();
    t.onsuccess = () => { data[name] = t.result; resolve(); };
    t.onerror = () => resolve();
  })));
  return data;
}

async function importAll(data) {
  const db = await openDB();
  for (const [name, rows] of Object.entries(data)) {
    if (!db.objectStoreNames.contains(name)) continue;
    const t = db.transaction(name, 'readwrite').objectStore(name);
    for (const r of rows) t.put(r);
  }
}

async function clearAll() {
  const db = await openDB();
  for (const name of Object.keys(STORES)) {
    db.transaction(name, 'readwrite').objectStore(name).clear();
  }
}

window.db = {
  getProfile, saveProfile,
  addMeal, updateMeal, deleteMeal, getMealsByDate, getRecentMeals, getMealsRange,
  setWeight, getWeight, getAllWeights, deleteWeight,
  kvGet, kvSet, exportAll, importAll, clearAll
};
