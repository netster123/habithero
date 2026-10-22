// Lebensmittel, Nährwerte und Zutatensuche.
// Grundliste: data/foods-de.json (deutsche Namen). Fehlt eine Zutat, wird der Suchbegriff online
// ins Englische übersetzt und in der vollständigen USDA-Datenbank (data/usda.json) gesucht.
import { getSetting, setSetting } from './store.js';

export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'vitA', 'b1', 'b6', 'b12', 'folate', 'vitC',
  'vitD', 'vitE', 'potassium', 'magnesium', 'calcium', 'iron', 'zinc', 'copper', 'selenium', 'iodine', 'sodium'];
const IDX = Object.fromEntries(NUTRIENTS.map((k, i) => [k, i]));

// D-A-CH-Referenzwerte für Männer von 25 bis unter 51 Jahren (Deutsche, Österreichische und
// Schweizerische Gesellschaft für Ernährung). Makronährstoffe kommen aus dem persönlichen Ziel.
export const REFERENCE = {
  vitamins: [
    { key: 'folate', label: 'Folat', unit: 'µg', ref: 300 },
    { key: 'b1', label: 'Vitamin B1', unit: 'mg', ref: 1.2 },
    { key: 'b6', label: 'Vitamin B6', unit: 'mg', ref: 1.6 },
    { key: 'b12', label: 'Vitamin B12', unit: 'µg', ref: 4 },
    { key: 'vitA', label: 'Vitamin A', unit: 'µg', ref: 850 },
    { key: 'vitC', label: 'Vitamin C', unit: 'mg', ref: 110 },
    { key: 'vitD', label: 'Vitamin D', unit: 'µg', ref: 20 },
    { key: 'vitE', label: 'Vitamin E', unit: 'mg', ref: 14 },
  ],
  minerals: [
    { key: 'potassium', label: 'Kalium', unit: 'mg', ref: 4000 },
    { key: 'magnesium', label: 'Magnesium', unit: 'mg', ref: 350 },
    { key: 'calcium', label: 'Calcium', unit: 'mg', ref: 1000 },
  ],
  trace: [
    { key: 'iron', label: 'Eisen', unit: 'mg', ref: 11 },
    { key: 'zinc', label: 'Zink', unit: 'mg', ref: 14 },
    { key: 'copper', label: 'Kupfer', unit: 'mg', ref: 1.25 },
    { key: 'selenium', label: 'Selen', unit: 'µg', ref: 70 },
  ],
  source: 'D-A-CH-Referenzwerte für die Nährstoffzufuhr (DGE, ÖGE, SGE), Mann 25 bis unter 51 Jahre. Nährwerte: USDA FoodData Central, SR Legacy.',
};

let base = null;          // Grundliste
let full = null;          // vollständige USDA-Daten (wird erst bei Bedarf geladen)
let loading = null;

export function foodsReady() { return !!base; }

export function loadFoods() {
  if (!loading) {
    loading = fetch('data/foods-de.json').then(r => r.json()).then(d => { base = d.foods; return base; });
  }
  return loading;
}

async function loadFull() {
  if (!full) full = (await (await fetch('data/usda.json')).json()).foods;
  return full;
}

export function customFoods() { return getSetting('customFoods') || []; }

export function allFoods() { return [...(base || []), ...customFoods()]; }

export function foodById(id) { return allFoods().find(f => f.id === id); }

export function foodByName(name) { return allFoods().find(f => f.name === name); }

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');

export function searchLocal(query, limit = 20) {
  const q = norm(query.trim());
  if (!q) return [];
  const words = q.split(/\s+/);
  return allFoods()
    .map(f => {
      const n = norm(f.name);
      if (!words.every(w => n.includes(w))) return null;
      return { f, score: (n.startsWith(q) ? 0 : 1) + n.length / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(x => x.f);
}

// Deutsch → Englisch über den kostenlosen Übersetzungsdienst MyMemory (nur der Suchbegriff wird gesendet)
async function translate(query) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(query)}&langpair=de%7Cen`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Übersetzung nicht erreichbar');
  const data = await res.json();
  return (data.responseData?.translatedText || query).replace(/[^\p{L}\p{N} -]/gu, ' ').trim();
}

// Rohes Lebensmittel bevorzugen, verarbeitete Varianten nach hinten
const PENALTY = ['canned', 'fried', 'frozen', 'dry mix', 'prepared', 'sweetened', 'babyfood', 'restaurant', 'with salt'];

export async function searchOnline(query) {
  let english = query;
  let translated = false;
  try { english = await translate(query); translated = english.toLowerCase() !== query.toLowerCase(); } catch { /* offline: englisch probieren */ }
  const foods = await loadFull();
  const words = english.toLowerCase().split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/s$/, ''));
  const results = foods
    .map(row => {
      const d = row[1].toLowerCase();
      if (!words.every(w => d.includes(w))) return null;
      let score = d.length / 40 + (d.startsWith(words[0]) ? 0 : 2) + (d.includes('raw') ? -1 : 0);
      PENALTY.forEach(p => { if (d.includes(p)) score += 1; });
      return { row, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 15)
    .map(({ row }) => ({ fdcId: row[0], desc: row[1], v: row.slice(3) }));
  return { english, translated, results };
}

export function saveCustomFood({ name, group, desc, fdcId, v }) {
  const food = { id: `u${fdcId}-${Date.now().toString(36)}`, name: name.trim(), group, src: desc, portions: {}, v, custom: true };
  setSetting('customFoods', [...customFoods(), food]);
  return food;
}

export function deleteCustomFood(id) {
  setSetting('customFoods', customFoods().filter(f => f.id !== id));
}

export function value(food, key) {
  const v = food.v[IDX[key]];
  return v == null ? null : v;
}

// Summe der Nährwerte für [{ food, grams }]; missing zählt Nährstoffe mit fehlenden Daten
export function sumNutrients(items) {
  const total = Object.fromEntries(NUTRIENTS.map(k => [k, 0]));
  const missing = new Set();
  for (const { food, grams } of items) {
    if (!food) continue;
    NUTRIENTS.forEach(k => {
      const v = value(food, k);
      if (v == null) { if (grams >= 20) missing.add(k); return; }
      total[k] += v * grams / 100;
    });
  }
  return { total, missing };
}

export const GROUP_LABELS = {
  gemuese: 'Gemüse', obst: 'Obst', vollkorn: 'Vollkorn', getreide: 'Getreide', huelsen: 'Hülsenfrüchte', nuesse: 'Nüsse und Samen',
  fisch: 'Fisch', rind: 'Rind', milch: 'Milchprodukte', ei: 'Ei', fett: 'Fette und Öle', gewuerz: 'Gewürze und Soßen',
  suess: 'Süßes', getraenk: 'Getränk', suessgetraenk: 'Gesüßtes Getränk', wurst: 'Wurst und Speck', hochverarbeitet: 'Hochverarbeitet', sonstiges: 'Sonstiges',
};
