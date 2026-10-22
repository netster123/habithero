// Alle Daten liegen nur lokal auf dem Gerät (localStorage).
// Jede Änderung am Datenformat bekommt eine neue SCHEMA-Nummer und einen Schritt in migrate().

const KEY = 'habithero';
export const SCHEMA = 1;

function defaults() {
  return {
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'auto',            // 'light' | 'dark' | 'auto'
      darkAtNight: true,        // 00:00–05:00 automatisch dunkel
      nightOff: null,           // Tag, an dem der Nacht-Modus bewusst abgeschaltet wurde
      sleep: { bed: '01:00', wake: '12:00' },
      body: { age: 49, heightCm: 180, weightKg: 68 },
      tobacco: { gramsPerPack: 30, pricePerPack: 3.75, daysPerPack: 3, cigsPerDay: 30 },
      quitDate: null,
      plans: {},                // Wenn-Dann-Pläne je Auslöser
      savingsGoal: { name: '', amount: 0 },
      awarded: [],              // bereits vergebene Rauchfrei-Meilensteine
      installHintDismissed: false,
      lastBackup: null,
    },
    // Jeder Eintrag: { id, type, ts, label, points, data }
    entries: [],
  };
}

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function mergeDefaults(def, val) {
  if (!isObj(val)) return def;
  const out = { ...val };
  for (const k of Object.keys(def)) {
    out[k] = isObj(def[k]) ? mergeDefaults(def[k], val[k]) : (k in val ? val[k] : def[k]);
  }
  return out;
}

function migrate(data) {
  const d = defaults();
  const s = isObj(data) ? data : {};
  // Schema 1 ist das Ausgangsformat; spätere Umstellungen kommen hier dazu.
  return {
    ...s,
    schema: SCHEMA,
    createdAt: s.createdAt || d.createdAt,
    settings: mergeDefaults(d.settings, s.settings),
    entries: Array.isArray(s.entries) ? s.entries.filter(e => e && e.id && e.type) : [],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : defaults();
  } catch (err) {
    console.warn('Daten konnten nicht gelesen werden', err);
    return defaults();
  }
}

let state = load();
const listeners = new Set();

export function getState() { return state; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error(err);
    window.dispatchEvent(new CustomEvent('hh:error', { detail: 'Speichern fehlgeschlagen. Ist der Speicher voll?' }));
  }
  listeners.forEach(fn => fn(state));
}

function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.floor(performance.now() * 1000).toString(36);
}

// --- Einstellungen -------------------------------------------------------

export function getSetting(path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), state.settings);
}

export function setSetting(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = isObj(o[k]) ? o[k] : {}), state.settings);
  target[last] = value;
  commit();
}

// --- Einträge ------------------------------------------------------------

export function addEntry({ type, label, points = 0, data = {}, ts = new Date().toISOString() }) {
  const entry = { id: newId(), type, ts, label, points, data };
  state.entries.push(entry);
  commit();
  return entry;
}

export function updateEntry(id, changes) {
  const e = state.entries.find(x => x.id === id);
  if (!e) return;
  Object.assign(e, changes, changes.data ? { data: { ...e.data, ...changes.data } } : {});
  commit();
}

export function removeEntry(id) {
  const before = state.entries.length;
  state.entries = state.entries.filter(e => e.id !== id);
  if (state.entries.length !== before) commit();
}

export function findEntry(pred) { return state.entries.find(pred); }

export function entries(type) {
  const list = type ? state.entries.filter(e => e.type === type) : state.entries.slice();
  return list.sort((a, b) => b.ts.localeCompare(a.ts));
}

export function totalPoints() {
  return state.entries.reduce((sum, e) => sum + (Number(e.points) || 0), 0);
}

// --- Sicherung -------------------------------------------------------------

export function exportData() {
  return JSON.stringify({ app: 'HabitHero', exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importData(text) {
  const parsed = JSON.parse(text);
  if (!isObj(parsed) || parsed.app !== 'HabitHero' || !Array.isArray(parsed.entries)) {
    throw new Error('Das ist keine HabitHero-Sicherung.');
  }
  const { app, exportedAt, ...rest } = parsed;
  state = migrate(rest);
  commit();
}

export function markBackup() { setSetting('lastBackup', new Date().toISOString()); }
