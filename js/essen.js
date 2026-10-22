// Bereich Essen: eigener Mahlzeitenplan, Rezepte mit Nährwerten und der Tageswert 1–10.
import { getSetting, setSetting, entries, addEntry, removeEntry, findEntry, getState } from './store.js';
import { dayKey, weekday, formatNumber } from './time.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { quitState } from './rauchfrei.js';
import { foodsReady, foodById, foodByName, sumNutrients, REFERENCE, GROUP_LABELS, customFoods } from './foods.js';
import { allRecipes, recipeById, CUISINES, MAINS } from './recipes.js';

const DAY = 864e5;
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

// --- Ziele ---------------------------------------------------------------------------

// Startet bei 2.200 kcal und steigt alle 2 Wochen um 200 kcal bis 2.700 kcal.
// Nach dem Rauchstopp liegt das Ziel 200 kcal niedriger (2.500 kcal), weil Rauchen den Energieverbrauch erhöht (Hofstetter et al., NEJM 1986).
export function targets() {
  const override = getSetting('nutrition.kcal');
  let kcal = override;
  if (!override) {
    const weeks = Math.max(0, (Date.now() - new Date(getState().createdAt).getTime()) / DAY / 14);
    const goal = quitState().mode === 'rauchfrei' ? 2500 : 2700;
    kcal = Math.min(goal, 2200 + Math.floor(weeks) * 200);
  }
  const weight = getSetting('body.weightKg') || 68;
  const protein = Math.round(weight * 1.9 / 5) * 5; // 1,6–2,2 g/kg (Morton et al., BJSM 2018)
  const fat = Math.round(kcal * 0.3 / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, fiber: 30, auto: !override };
}

// --- Rezepte: Nährwerte und Lebensmittelgruppen --------------------------------------

export function resolveFood(ing) { return (ing.foodId && foodById(ing.foodId)) || foodByName(ing.food); }

export function recipeNutrition(recipe, portions = 1) {
  const items = recipe.ingredients.map(ing => ({ food: resolveFood(ing), grams: ing.grams / recipe.portions * portions }));
  const { total, missing } = sumNutrients(items);
  const groups = groupsFromItems(items);
  return { total, missing, groups, unknown: items.filter(x => !x.food).length };
}

function groupsFromItems(items) {
  const g = {};
  for (const { food, grams } of items) {
    if (!food) continue;
    g[food.group] = (g[food.group] || 0) + grams;
  }
  return {
    gemuese: round1((g.gemuese || 0) / 80),
    obst: round1((g.obst || 0) / 80),
    vollkorn: round1((g.vollkorn || 0) / 30),
    huelsen: (g.huelsen || 0) >= 30 ? 1 : 0,
    nuesse: (g.nuesse || 0) >= 15 ? 1 : 0,
    fisch: (g.fisch || 0) >= 50 ? 1 : 0,
    wurst: g.wurst ? 1 : 0,
    suessgetraenk: g.suessgetraenk ? 1 : 0,
    hochverarbeitet: g.hochverarbeitet ? 1 : 0,
  };
}
const round1 = n => Math.round(n * 2) / 2;

// --- Mahlzeitenplan ----------------------------------------------------------------------

const DEFAULT_MEALS = [
  { id: 'm1', name: 'Haferflocken mit Quark', time: '12:30', days: [], recipeId: 'hafer-quark', portions: 1 },
  { id: 'm2', name: 'Apfel mit Mandeln', time: '15:00', days: [], recipeId: 'apfel-mandeln', portions: 1 },
  { id: 'm3', name: 'Masoor Dal mit Reis', time: '16:30', days: [], recipeId: 'dal', portions: 1 },
  { id: 'm4', name: 'Shakshuka', time: '20:30', days: [], recipeId: 'shakshuka', portions: 1 },
  { id: 'm5', name: 'Skyr mit Walnüssen und Beeren', time: '23:00', days: [], recipeId: 'skyr-walnuss', portions: 1 },
];

export function meals() {
  const m = getSetting('meals');
  return Array.isArray(m) ? m : DEFAULT_MEALS;
}

export function saveMeals(list) { setSetting('meals', list); }

export function mealsForToday() {
  const wd = weekday();
  return meals().filter(m => !m.days?.length || m.days.includes(wd));
}

export function mealValues(meal) {
  const rec = meal.recipeId && recipeById(meal.recipeId);
  if (rec && foodsReady()) {
    const n = recipeNutrition(rec, meal.portions || 1);
    return { kcal: Math.round(n.total.kcal), protein: Math.round(n.total.protein), groups: n.groups };
  }
  return { kcal: meal.kcal || 0, protein: meal.protein || 0, groups: meal.groups || {} };
}

export const mealPoints = kcal => (kcal >= 300 ? 30 : 20);

export function mealEntry(mealId, day = dayKey()) {
  return findEntry(e => e.type === 'essen' && e.data.meal === mealId && e.data.day === day);
}

export function toggleMeal(meal) {
  const done = mealEntry(meal.id);
  if (done) { removeEntry(done.id); return false; }
  const v = mealValues(meal);
  addEntry({ type: 'essen', label: meal.name, points: mealPoints(v.kcal), data: { meal: meal.id, day: dayKey(), recipeId: meal.recipeId || null, portions: meal.portions || 1, ...v } });
  return true;
}

export function logExtraMeal(meal) {
  const v = mealValues(meal);
  addEntry({ type: 'essen', label: meal.name, points: mealPoints(v.kcal), data: { meal: null, day: dayKey(), recipeId: meal.recipeId || null, portions: meal.portions || 1, ...v } });
}

// --- Tageswert 1–10 ---------------------------------------------------------------------

export const SCORE_SOURCES = [
  'Aune D et al. Fruit and vegetable intake and the risk of cardiovascular disease, total cancer and all-cause mortality. International Journal of Epidemiology 2017;46(3):1029–1056.',
  'Aune D et al. Whole grain consumption and risk of cardiovascular disease, cancer, and all cause and cause specific mortality. BMJ 2016;353:i2716.',
  'Aune D et al. Nut consumption and risk of cardiovascular disease, total cancer, all-cause and cause-specific mortality. BMC Medicine 2016;14:207.',
  'Schwingshackl L et al. Food groups and risk of all-cause mortality: a systematic review and meta-analysis of prospective studies. American Journal of Clinical Nutrition 2017;105(6):1462–1473.',
  'Lane MM et al. Ultra-processed food exposure and adverse health outcomes: umbrella review of epidemiological meta-analyses. BMJ 2024;384:e077310.',
  'Morton RW et al. A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength. British Journal of Sports Medicine 2018;52:376–384.',
];

function dayTotals(day) {
  const list = entries('essen').filter(e => e.data.day === day);
  const sum = { kcal: 0, protein: 0, groups: {} };
  list.forEach(e => {
    sum.kcal += e.data.kcal || 0;
    sum.protein += e.data.protein || 0;
    Object.entries(e.data.groups || {}).forEach(([k, v]) => { sum.groups[k] = (sum.groups[k] || 0) + v; });
  });
  return { ...sum, count: list.length };
}

// Tage dieser Woche bis heute (offset 0) oder die ganze Vorwoche (offset 1); Woche beginnt am Montag
function weekDays(offset = 0) {
  const wd = (weekday() + 6) % 7;
  const monday = Date.now() - wd * DAY - offset * 7 * DAY;
  const len = offset ? 7 : wd + 1;
  return Array.from({ length: len }, (_, i) => dayKey(new Date(monday + i * DAY)));
}

export function dayScore(day = dayKey()) {
  const t = dayTotals(day);
  if (!t.count) return null;
  const g = t.groups;
  const tg = targets();
  const fishDays = weekDays().filter(d => dayTotals(d).groups.fisch > 0).length;
  const crit = [
    { label: 'Gemüse', have: g.gemuese || 0, need: 3, unit: 'Portionen', ok: (g.gemuese || 0) >= 3 },
    { label: 'Obst', have: g.obst || 0, need: 2, unit: 'Portionen', ok: (g.obst || 0) >= 2 },
    { label: 'Vollkorn', have: g.vollkorn || 0, need: 2, unit: 'Portionen', ok: (g.vollkorn || 0) >= 2 },
    { label: 'Hülsenfrüchte', ok: (g.huelsen || 0) >= 1 },
    { label: 'Nüsse, eine Handvoll', ok: (g.nuesse || 0) >= 1 },
    { label: `Fisch, ${fishDays} von 2 diese Woche`, ok: (g.fisch || 0) >= 1 || fishDays >= 2, note: 'Wochenziel' },
    { label: 'Keine Wurst, kein Speck', ok: !(g.wurst > 0), bad: true },
    { label: 'Keine gesüßten Getränke', ok: !(g.suessgetraenk > 0), bad: true },
    { label: `Hochverarbeitet: ${g.hochverarbeitet || 0} ×, höchstens 1 ×`, ok: (g.hochverarbeitet || 0) <= 1, bad: true },
    { label: 'Kalorien- und Proteinziel', ok: t.kcal >= tg.kcal * 0.9 && t.protein >= tg.protein * 0.9 },
  ];
  const score = Math.max(1, crit.filter(c => c.ok).length);
  return { score, crit, totals: t };
}

export function scoreLabel(s) {
  return s >= 9 ? 'Sehr gut' : s >= 7 ? 'Gut' : s >= 4 ? 'Ordentlich' : 'Ausbaufähig';
}

function weekAverage(offset = 0) {
  const scores = weekDays(offset).map(d => dayScore(d)?.score).filter(Boolean);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
}

// --- Gewicht --------------------------------------------------------------------------------

export function weightInfo() {
  const list = entries('gewicht');
  if (!list.length) return null;
  const now = Date.now();
  const avg = from => {
    const xs = list.filter(e => { const t = new Date(e.ts).getTime(); return t <= now - from && t > now - from - 7 * DAY; }).map(e => e.data.kg);
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  return { latest: list[0].data.kg, avg7: avg(0), avgPrev: avg(30 * DAY) };
}

// --- Gemeinsame Bausteine ---------------------------------------------------------------

export function hbars(rows) {
  return `<div class="hbars">${rows.map(r => {
    const pct = r.ref ? r.value / r.ref * 100 : 0;
    const w = Math.min(pct, 150) / 150 * 100;
    const val = r.missing ? 'keine Daten' : `${formatNumber(r.value, r.value < 10 && r.unit !== 'kcal' ? 1 : 0)} ${r.unit} · ${Math.round(pct)} %`;
    return `<div class="hbar${r.missing ? ' hbar-missing' : ''}" title="${esc(r.label)}: ${esc(val)} (Tagesbedarf ${formatNumber(r.ref, r.ref < 10 ? 2 : 0)} ${esc(r.unit)})">
      <span class="hbar-label">${esc(r.label)}</span>
      <span class="hbar-track"><i style="width:${r.missing ? 0 : w}%"></i><b></b></span>
      <span class="hbar-value">${esc(val)}</span></div>`;
  }).join('')}</div>
  <p class="hint small">Gestrichelte Linie: 100 % des Tagesbedarfs</p>`;
}

function macroRows(total) {
  const t = targets();
  return [
    { label: 'Kalorien', value: total.kcal, ref: t.kcal, unit: 'kcal' },
    { label: 'Protein', value: total.protein, ref: t.protein, unit: 'g' },
    { label: 'Kohlenhydrate', value: total.carbs, ref: t.carbs, unit: 'g' },
    { label: 'Fett', value: total.fat, ref: t.fat, unit: 'g' },
    { label: 'Ballaststoffe', value: total.fiber, ref: t.fiber, unit: 'g' },
  ];
}

const microRows = (list, total, missing) => list.map(n => ({ label: n.label, value: total[n.key], ref: n.ref, unit: n.unit, missing: missing.has(n.key) && !total[n.key] }));

function segmented(active) {
  return `<div class="segmented" role="group">
    <button type="button" data-action="essen-tab" data-tab="plan" aria-pressed="${active === 'plan'}">Mein Plan</button>
    <button type="button" data-action="essen-tab" data-tab="rezepte" aria-pressed="${active === 'rezepte'}">Rezepte</button></div>`;
}

const loadingCard = '<section class="card"><p class="hint">Nährwerte werden geladen …</p></section>';

// --- Ansicht: Mein Plan -----------------------------------------------------------------------

export function viewPlan() {
  if (!foodsReady()) return `<header class="head"><h1>Essen</h1></header>${segmented('plan')}${loadingCard}`;
  const t = targets();
  const today = dayTotals(dayKey());
  const sc = dayScore();
  const wAvg = weekAverage(), wPrev = weekAverage(1);
  const sorted = mealsForToday().slice().sort((a, b) => minutes(a.time) - minutes(b.time));
  const firstMissing = sc?.crit.find(c => !c.ok && !c.bad && c.need);
  const wi = weightInfo();

  return `
    <header class="head"><div class="head-title"><h1>Essen</h1><div class="sub">Ziel heute: ${formatNumber(t.kcal)} kcal · ${t.protein} g Protein</div></div></header>
    ${segmented('plan')}

    <section class="card">
      <div class="row-between" style="align-items:flex-end">
        <div><div class="card-label">Wie gesund hast du heute gegessen?</div>
          <div><span class="hero-number" style="font-size:40px">${sc ? sc.score : '–'}</span><span class="sub"> / 10</span></div></div>
        ${sc ? `<span class="badge badge-accent">${scoreLabel(sc.score)}</span>` : ''}
      </div>
      <div class="scale" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<span class="${sc && i < sc.score ? 'on' : ''}"></span>`).join('')}</div>
      <div class="row-between"><span class="hint small">1 sehr schlecht</span><span class="hint small">10 sehr gut</span></div>
      ${!sc ? '<p class="hint" style="margin-top:8px">Hake deine erste Mahlzeit ab, dann berechnet HabitHero deinen Wert.</p>' : ''}
      ${firstMissing ? `<p class="good small" style="margin-top:8px;font-weight:600">Noch ${formatNumber(Math.max(0.5, firstMissing.need - firstMissing.have), 1)} ${firstMissing.unit} ${firstMissing.label} für +1</p>` : ''}
      <div class="row-between" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
        <span class="hint">Ø diese Woche</span>
        <span style="font-weight:600">${wAvg == null ? '–' : formatNumber(wAvg, 1)}${wAvg != null && wPrev != null ? ` <span class="${wAvg >= wPrev ? 'good' : ''}" style="font-weight:400">${wAvg >= wPrev ? '+' : '−'}${formatNumber(Math.abs(wAvg - wPrev), 1)} zur Vorwoche</span>` : ''}</span>
      </div>
      ${sc ? `<details class="score-details"><summary>So setzt sich dein Wert zusammen</summary>
        <div class="list" style="margin-top:8px">${sc.crit.map(c => `<div class="list-item"><span class="check" style="color:${c.ok ? 'var(--accent)' : c.bad ? 'var(--danger)' : 'var(--border-strong)'}">${icon(c.ok ? 'check' : c.bad ? 'x' : 'circle', 'check')}</span>
          <span class="list-main">${esc(c.label)}${c.need ? ` <span class="sub">(${formatNumber(c.have, 1)} von ${c.need})</span>` : ''}</span><span class="list-points">${c.ok ? '+1' : '0'}</span></div>`).join('')}</div>
        <p class="hint small" style="margin-top:8px">Die Skala ist eine Vereinfachung auf Grundlage dieser Studien, kein geprüftes Messinstrument. Ein einzelner Tag sagt wenig – achte auf den Wochenschnitt.</p>
        <ul class="sources">${SCORE_SOURCES.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      </details>` : ''}
    </section>

    <div class="grid-2">
      <div class="card card-tight"><div class="card-label">Kalorien</div><div class="card-value" style="font-size:18px">${formatNumber(today.kcal)} / ${formatNumber(t.kcal)}</div>
        <div class="progress"><span style="width:${Math.min(100, Math.round(today.kcal / t.kcal * 100))}%;background:var(--warn)"></span></div></div>
      <div class="card card-tight"><div class="card-label">Protein</div><div class="card-value" style="font-size:18px">${formatNumber(today.protein)} / ${t.protein} g</div>
        <div class="progress"><span style="width:${Math.min(100, Math.round(today.protein / t.protein * 100))}%"></span></div></div>
    </div>

    <h2 class="section-title">Deine Mahlzeiten heute</h2>
    <div class="list">${sorted.length ? sorted.map(m => {
      const done = !!mealEntry(m.id);
      const v = mealValues(m);
      return `<div class="list-item ${done ? 'task-done' : ''}">
        <button type="button" class="check-btn" data-action="toggle-meal" data-meal="${esc(m.id)}" aria-pressed="${done}" aria-label="${esc(m.name)} abhaken">${icon(done ? 'check' : 'circle', 'check')}</button>
        <a class="list-main" href="#mahlzeit/${esc(m.id)}" style="color:inherit;text-decoration:none"><span class="list-title">${m.time} ${esc(m.name)}</span>
          <div class="sub">${formatNumber(v.kcal)} kcal · ${formatNumber(v.protein)} g Protein${m.recipeId ? ' · Rezept' : ''}</div></a>
        <a class="icon-btn" style="width:36px;height:36px;border:0" href="#mahlzeit/${esc(m.id)}" aria-label="Bearbeiten">${icon('chevronRight', 'icon icon-sm')}</a>
      </div>`;
    }).join('') : '<div class="list-empty">Für heute ist keine Mahlzeit geplant.</div>'}</div>
    ${entries('essen').filter(e => e.data.day === dayKey() && !e.data.meal).map(e => `<div class="list"><div class="list-item task-done">
      <span class="check" style="color:var(--accent)">${icon('check', 'check')}</span><span class="list-main"><span class="list-title">${esc(e.label)}</span><div class="sub">zusätzlich · ${formatNumber(e.data.kcal)} kcal</div></span>
      <button type="button" class="trash" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="Löschen">${icon('trash')}</button></div></div>`).join('')}
    <div class="grid-2">
      <a class="btn" href="#mahlzeit/neu">${icon('plus', 'icon icon-sm')} Zum Plan</a>
      <a class="btn" href="#mahlzeit/heute">${icon('plus', 'icon icon-sm')} Etwas anderes</a>
    </div>

    <section class="card">
      <div class="row-between"><h2>Gewicht</h2>${wi ? `<span class="sub">Ziel: 73–75 kg</span>` : ''}</div>
      ${wi ? `<div class="row-between" style="margin-top:6px"><span><span class="card-value">${formatNumber(wi.avg7 ?? wi.latest, 1)} kg</span> <span class="sub">Ø 7 Tage</span></span>
        ${wi.avgPrev ? `<span class="${wi.avg7 >= wi.avgPrev ? 'good' : ''}">${wi.avg7 >= wi.avgPrev ? '+' : '−'}${formatNumber(Math.abs(wi.avg7 - wi.avgPrev), 1)} kg zum Vormonat</span>` : ''}</div>` : '<p class="hint" style="margin-top:4px">Wieg dich einmal pro Woche direkt nach dem Aufstehen. Gut sind etwa 0,5 kg Zunahme pro Monat.</p>'}
      <div class="logger" style="grid-template-columns:minmax(0,1fr) auto;margin-top:10px">
        <input class="input" id="weight-input" type="number" inputmode="decimal" step="0.1" min="30" max="250" placeholder="${formatNumber(getSetting('body.weightKg'), 1)} kg" aria-label="Gewicht in kg">
        <button type="button" class="btn btn-primary" data-action="log-weight">Eintragen</button>
      </div>
    </section>`;
}

const minutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return ((h - 5 + 24) % 24) * 60 + m; };

// --- Ansicht: Mahlzeit bearbeiten -------------------------------------------------------------

export function mealDraftFrom(id) {
  if (id === 'neu' || id === 'heute') return { id: null, mode: id, name: '', time: '12:30', days: [], recipeId: null, portions: 1, kcal: 0, protein: 0, groups: {}, source: 'rezept' };
  const m = meals().find(x => x.id === id);
  return m ? { ...m, mode: 'edit', source: m.recipeId ? 'rezept' : 'manuell', groups: { ...(m.groups || {}) } } : null;
}

const MANUAL_GROUPS = ['gemuese', 'obst', 'vollkorn', 'huelsen', 'nuesse', 'fisch', 'wurst', 'suessgetraenk', 'hochverarbeitet'];

export function viewMealForm(d) {
  if (!d) return '<header class="head"><a class="back" href="#essen">‹ Essen</a></header><section class="card">Diese Mahlzeit gibt es nicht mehr.</section>';
  const recipes = allRecipes();
  const rec = d.recipeId && recipeById(d.recipeId);
  const v = d.source === 'rezept' && rec && foodsReady() ? recipeNutrition(rec, d.portions) : null;
  const title = d.mode === 'heute' ? 'Etwas anderes gegessen' : d.mode === 'neu' ? 'Neue Mahlzeit' : 'Mahlzeit bearbeiten';
  return `
    <header class="head"><div class="head-title"><a class="back" href="#essen">${icon('chevronLeft', 'icon icon-sm')} Essen</a><h1>${title}</h1></div></header>
    <section class="card form-stack">
      <div class="field"><label for="md-name">Name</label><input class="input" id="md-name" data-md="name" value="${esc(d.name)}" placeholder="${rec ? esc(rec.name) : 'Linsen-Bolognese'}" maxlength="60"></div>
      ${d.mode !== 'heute' ? `<div class="form-grid">
        <div class="field"><label for="md-time">Uhrzeit</label><input class="input" id="md-time" type="time" data-md="time" value="${esc(d.time)}"></div>
      </div>
      <div class="field"><span class="label">Wiederholen</span><div class="chips">
        <button type="button" class="chip" data-action="md-days" data-day="all" aria-pressed="${!d.days.length}">Täglich</button>
        ${WEEK_ORDER.map(wd => `<button type="button" class="chip" data-action="md-days" data-day="${wd}" aria-pressed="${d.days.includes(wd)}">${WEEKDAYS[wd]}</button>`).join('')}
      </div></div>` : ''}
      <div class="segmented" role="group">
        <button type="button" data-action="md-source" data-source="rezept" aria-pressed="${d.source === 'rezept'}">Aus Rezept</button>
        <button type="button" data-action="md-source" data-source="manuell" aria-pressed="${d.source === 'manuell'}">Eigene Angaben</button>
      </div>
      ${d.source === 'rezept' ? `
        <div class="field"><label for="md-recipe">Rezept</label>
          <select class="input" id="md-recipe" data-md="recipeId"><option value="">Rezept wählen …</option>
            ${CUISINES.map(c => `<optgroup label="${c.label}">${recipes.filter(x => x.cuisine === c.id).map(x => `<option value="${esc(x.id)}" ${x.id === d.recipeId ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('')}
          </select></div>
        <div class="field"><span class="label">Portionen</span>
          <div class="logger" style="grid-template-columns:44px 80px 44px">
            <button type="button" class="stepper" data-action="md-portions" data-delta="-0.5" aria-label="Weniger">−</button>
            <input class="input rep-input" value="${formatNumber(d.portions, 1)}" readonly aria-label="Portionen">
            <button type="button" class="stepper" data-action="md-portions" data-delta="0.5" aria-label="Mehr">+</button></div></div>
        ${v ? `<div class="kcal-box"><span>Pro Mahlzeit, automatisch berechnet</span><strong>${formatNumber(v.total.kcal)} kcal · ${formatNumber(v.total.protein)} g Protein</strong></div>` : ''}`
      : `
        <div class="form-grid">
          <div class="field"><label for="md-kcal">Kalorien</label><input class="input" id="md-kcal" type="number" inputmode="numeric" min="0" data-md="kcal" value="${d.kcal || ''}" placeholder="kcal"></div>
          <div class="field"><label for="md-protein">Protein (g)</label><input class="input" id="md-protein" type="number" inputmode="numeric" min="0" data-md="protein" value="${d.protein || ''}" placeholder="g"></div>
        </div>
        <div class="field"><span class="label">Was war drin? Mehrfach tippen für mehrere Portionen</span>
          <div class="chips">${MANUAL_GROUPS.map(k => { const n = d.groups[k] || 0; const bad = ['wurst', 'suessgetraenk', 'hochverarbeitet'].includes(k);
            return `<button type="button" class="chip ${bad ? 'chip-bad' : ''}" data-action="md-group" data-group="${k}" aria-pressed="${n > 0}">${GROUP_LABELS[k]}${n > 1 ? ` ×${n}` : ''}</button>`; }).join('')}</div>
          <p class="hint small">Tipp: Mit einem Rezept rechnet HabitHero Kalorien und Gruppen selbst aus.</p></div>`}
    </section>
    <button type="button" class="btn btn-primary btn-block" data-action="md-save">${d.mode === 'heute' ? 'Als gegessen eintragen' : 'Speichern'}</button>
    ${d.mode === 'edit' ? `<button type="button" class="btn btn-block" data-action="md-delete" style="color:var(--danger)">${icon('trash', 'icon icon-sm')} Aus dem Plan entfernen</button>` : ''}`;
}

// --- Ansicht: Rezepte --------------------------------------------------------------------------

export function viewRecipes(filter) {
  if (!foodsReady()) return `<header class="head"><h1>Essen</h1></header>${segmented('rezepte')}${loadingCard}`;
  const list = allRecipes().filter(x =>
    (filter.cuisine === 'alle' || (filter.cuisine === 'eigene' ? !x.builtin : x.cuisine === filter.cuisine)) &&
    (!filter.main || x.main === filter.main));
  const own = customFoods();
  return `
    <header class="head"><div class="head-title"><h1>Essen</h1><div class="sub">Einfache Rezepte mit Nährwerten</div></div></header>
    ${segmented('rezepte')}
    <div class="chips">${[{ id: 'alle', label: 'Alle' }, ...CUISINES, { id: 'eigene', label: 'Eigene' }].map(c => `
      <button type="button" class="chip" data-action="rec-filter" data-cuisine="${c.id}" aria-pressed="${filter.cuisine === c.id}">${c.label}</button>`).join('')}</div>
    <div class="chips">${MAINS.map(m => `
      <button type="button" class="chip" data-action="rec-main" data-main="${m.id}" aria-pressed="${filter.main === m.id}">${m.label}</button>`).join('')}</div>
    <div class="list">${list.length ? list.map(x => {
      const n = recipeNutrition(x, 1);
      return `<a class="list-item" href="#rezept/${esc(x.id)}">
        <span class="list-main"><span class="list-title">${esc(x.name)}</span>
          <div class="sub">${x.minutes} Min. · ${formatNumber(n.total.kcal)} kcal · ${formatNumber(n.total.protein)} g Protein</div></span>
        <span class="tag tag-${x.main}">${esc(MAINS.find(m => m.id === x.main)?.label.replace('Vegetarisch', 'Veg.') || '')}</span>
      </a>`;
    }).join('') : '<div class="list-empty">Keine Rezepte für diesen Filter.</div>'}</div>
    <a class="btn btn-block" href="#rezept-bearbeiten/neu">${icon('plus', 'icon icon-sm')} Eigenes Rezept anlegen</a>
    ${own.length ? `<h2 class="section-title">Deine gespeicherten Zutaten</h2>
      <div class="list">${own.map(f => `<div class="list-item"><span class="list-main"><span class="list-title">${esc(f.name)}</span>
        <div class="sub">${esc(f.src)} · ${formatNumber(f.v[0])} kcal/100 g</div></span>
        <button type="button" class="trash" data-action="delete-food" data-id="${esc(f.id)}" aria-label="Zutat löschen">${icon('trash')}</button></div>`).join('')}</div>` : ''}
    <p class="hint small" style="padding:0 2px">Nährwerte: USDA FoodData Central (gemeinfrei). Pro Portion berechnet.</p>`;
}

export function viewRecipe(id) {
  const x = recipeById(id);
  if (!x) return '<header class="head"><a class="back" href="#essen">‹ Essen</a></header><section class="card">Dieses Rezept gibt es nicht mehr.</section>';
  if (!foodsReady()) return loadingCard;
  const n = recipeNutrition(x, 1);
  const all = [...REFERENCE.vitamins, ...REFERENCE.minerals, ...REFERENCE.trace];
  const pct = k => { const ref = all.find(a => a.key === k).ref; return n.total[k] / ref; };
  const strong = all.filter(a => pct(a.key) >= 0.4).map(a => a.label);
  const weak = all.filter(a => pct(a.key) < 0.1 && !n.missing.has(a.key)).map(a => a.label);
  return `
    <header class="head"><div class="head-title"><a class="back" href="#essen">${icon('chevronLeft', 'icon icon-sm')} Rezepte</a>
      <h1>${esc(x.name)}</h1><div class="sub">${esc(CUISINES.find(c => c.id === x.cuisine)?.label || '')} · ${x.portions} ${x.portions === 1 ? 'Portion' : 'Portionen'} · ${x.minutes} Min.</div></div></header>
    <div class="grid-3">
      <div class="card card-tight"><div class="card-label">Kalorien</div><div class="card-value" style="font-size:18px">${formatNumber(n.total.kcal)}</div><div class="sub">pro Portion</div></div>
      <div class="card card-tight"><div class="card-label">Protein</div><div class="card-value" style="font-size:18px">${formatNumber(n.total.protein)} g</div><div class="sub">pro Portion</div></div>
      <div class="card card-tight"><div class="card-label">Zeit</div><div class="card-value" style="font-size:18px">${x.minutes} Min.</div><div class="sub">${x.builtin ? 'einfach' : 'eigenes'}</div></div>
    </div>
    <section class="card"><h2>Makronährstoffe pro Portion</h2><p class="hint small" style="margin:2px 0 8px">Im Verhältnis zu deinem Tagesziel</p>${hbars(macroRows(n.total))}</section>
    <section class="card"><h2>Vitamine</h2>${hbars(microRows(REFERENCE.vitamins, n.total, n.missing))}</section>
    <section class="card"><h2>Mineralstoffe</h2>${hbars(microRows(REFERENCE.minerals, n.total, n.missing))}</section>
    <section class="card"><h2>Spurenelemente</h2>${hbars(microRows(REFERENCE.trace, n.total, n.missing))}</section>
    ${strong.length || weak.length ? `<section class="card">${strong.length ? `<p><strong>Stark bei:</strong> ${esc(strong.join(', '))}.</p>` : ''}${weak.length ? `<p style="margin-top:4px"><strong>Wenig:</strong> ${esc(weak.join(', '))}.</p>` : ''}</section>` : ''}
    <section class="card"><h2>Zutaten</h2><div class="ing-list">${x.ingredients.map(ing => {
      const f = resolveFood(ing);
      return `<div class="row-between"><span>${esc(f ? f.name : ing.food || 'Unbekannte Zutat')}</span><span class="sub">${ing.note ? esc(ing.note) + ' · ' : ''}${formatNumber(ing.grams)} g</span></div>`;
    }).join('')}</div></section>
    <section class="card"><h2>Zubereitung</h2><ol class="steps">${x.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></section>
    <button type="button" class="btn btn-primary btn-block" data-action="recipe-to-plan" data-id="${esc(x.id)}">${icon('plus', 'icon icon-sm')} Zu meinem Plan hinzufügen</button>
    ${x.builtin ? `<button type="button" class="btn btn-block" data-action="recipe-copy" data-id="${esc(x.id)}">Kopieren und anpassen</button>`
      : `<div class="grid-2"><a class="btn" href="#rezept-bearbeiten/${esc(x.id)}">Bearbeiten</a><button type="button" class="btn" style="color:var(--danger)" data-action="recipe-delete" data-id="${esc(x.id)}">Löschen</button></div>`}
    <p class="hint small" style="padding:0 2px">${esc(REFERENCE.source)}${n.missing.size ? ' Für einzelne Zutaten fehlen manche Werte in der Datenbank – angezeigt wird die Summe der vorhandenen Werte.' : ''} Jod wird nicht angezeigt, weil die USDA-Datenbank dafür kaum Werte enthält.</p>`;
}

// --- Ansicht: Rezept bearbeiten ----------------------------------------------------------------

export function recipeDraftFrom(id, copyOf) {
  const src = copyOf ? recipeById(copyOf) : id !== 'neu' ? recipeById(id) : null;
  if (src) {
    return {
      id: copyOf ? null : src.id, name: copyOf ? `${src.name} (eigene Variante)` : src.name, cuisine: src.cuisine, main: src.main,
      portions: src.portions, minutes: src.minutes, steps: src.steps.join('\n'),
      ingredients: src.ingredients.map(ing => { const f = resolveFood(ing); return { foodId: f?.id, food: f?.name || ing.food, grams: ing.grams, note: ing.note || '' }; }),
    };
  }
  return { id: null, name: '', cuisine: 'indisch', main: 'veg', portions: 2, minutes: 20, steps: '', ingredients: [] };
}

export function viewRecipeForm(d) {
  const n = foodsReady() ? recipeNutrition({ ...d, steps: [] }, 1) : null;
  return `
    <header class="head"><div class="head-title"><a class="back" href="#essen">${icon('chevronLeft', 'icon icon-sm')} Rezepte</a><h1>${d.id ? 'Rezept bearbeiten' : 'Neues Rezept'}</h1></div></header>
    <section class="card form-stack">
      <div class="field"><label for="rd-name">Name</label><input class="input" id="rd-name" data-rd="name" value="${esc(d.name)}" placeholder="Linsen-Bolognese" maxlength="60"></div>
      <div class="field"><span class="label">Küche</span><div class="chips">${CUISINES.map(c => `<button type="button" class="chip" data-action="rd-set" data-key="cuisine" data-value="${c.id}" aria-pressed="${d.cuisine === c.id}">${c.label}</button>`).join('')}</div></div>
      <div class="field"><span class="label">Hauptzutat</span><div class="chips">${MAINS.map(m => `<button type="button" class="chip" data-action="rd-set" data-key="main" data-value="${m.id}" aria-pressed="${d.main === m.id}">${m.label}</button>`).join('')}</div></div>
      <div class="form-grid">
        <div class="field"><label for="rd-portions">Portionen</label><input class="input" id="rd-portions" type="number" inputmode="numeric" min="1" max="12" data-rd="portions" value="${d.portions}"></div>
        <div class="field"><label for="rd-minutes">Zeit (Min.)</label><input class="input" id="rd-minutes" type="number" inputmode="numeric" min="1" data-rd="minutes" value="${d.minutes}"></div>
      </div>
    </section>
    <h2 class="section-title">Zutaten</h2>
    <div class="list">${d.ingredients.length ? d.ingredients.map((ing, idx) => {
      const f = ing.foodId ? foodById(ing.foodId) : foodByName(ing.food);
      return `<div class="list-item ing-row">
        <span class="list-main"><span class="list-title">${esc(f?.name || ing.food)}</span><div class="sub">${f ? formatNumber(f.v[0] * ing.grams / 100) + ' kcal' : 'unbekannt'}</div></span>
        <input class="input grams" type="number" inputmode="decimal" min="0" step="1" value="${ing.grams}" data-rd-grams="${idx}" aria-label="Gramm">
        <span class="sub">g</span>
        <button type="button" class="trash" data-action="rd-remove" data-idx="${idx}" aria-label="Zutat entfernen">${icon('trash')}</button>
      </div>`;
    }).join('') : '<div class="list-empty">Noch keine Zutaten.</div>'}</div>
    <button type="button" class="btn btn-block" data-action="rd-add-ingredient">${icon('plus', 'icon icon-sm')} Zutat hinzufügen</button>
    ${n ? `<div class="kcal-box"><span>Pro Portion, automatisch berechnet</span><strong>${formatNumber(n.total.kcal)} kcal · ${formatNumber(n.total.protein)} g Protein</strong></div>
      <section class="card"><h2>Makronährstoffe pro Portion</h2>${hbars(macroRows(n.total))}</section>` : ''}
    <section class="card"><div class="field"><label for="rd-steps">Zubereitung – ein Schritt pro Zeile</label>
      <textarea class="input" id="rd-steps" rows="6" data-rd="steps" placeholder="Zwiebel anbraten.&#10;Linsen dazugeben …">${esc(d.steps)}</textarea></div></section>
    <button type="button" class="btn btn-primary btn-block" data-action="rd-save">Rezept speichern</button>`;
}

// --- Zutatensuche (Bottom-Sheet) -------------------------------------------------------------

export function sheetIngredientSearch() {
  return `<div class="dialog sheet search-sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">Zutat hinzufügen</h2>
    <input class="input" id="ing-query" type="search" placeholder="z. B. Kokosmilch" autocomplete="off" enterkeyhint="search" style="margin:10px 0">
    <div id="ing-results"><p class="hint">Tippe den Namen einer Zutat ein.</p></div>
    <button type="button" class="btn btn-block" data-close style="margin-top:10px">Schließen</button>
  </div>`;
}

export function ingredientResultsHtml(local, query) {
  const rows = local.map(f => `<button type="button" class="list-item" data-pick="${esc(f.id)}">
    <span class="list-main"><span class="list-title">${esc(f.name)}</span><div class="sub">${formatNumber(f.v[0])} kcal/100 g${f.custom ? ' · gespeichert' : ''}</div></span>${icon('plus', 'icon icon-sm')}</button>`).join('');
  return `${rows ? `<div class="list">${rows}</div>` : `<p class="hint">„${esc(query)}“ ist noch nicht in der App.</p>`}
    ${query.trim().length >= 2 ? `<button type="button" class="btn btn-block" data-online="1" style="margin-top:8px">${icon('download', 'icon icon-sm')} „${esc(query)}“ im Internet suchen</button>` : ''}`;
}

export function onlineResultsHtml({ english, translated, results }, query) {
  if (!results.length) return `<p class="hint">Keine Treffer für „${esc(english)}“. Versuch es mit einem einfacheren Wort, z. B. nur „Kokos“.</p>`;
  return `<p class="hint small">${translated ? `Gesucht als „${esc(english)}“ in der USDA-Datenbank. ` : ''}Wähle den passenden Eintrag:</p>
    <div class="list">${results.map((r, idx) => `<button type="button" class="list-item" data-online-pick="${idx}">
      <span class="list-main"><span class="list-title" style="font-size:14px">${esc(r.desc)}</span><div class="sub">${formatNumber(r.v[0])} kcal · ${formatNumber(r.v[1], 1)} g Protein pro 100 g</div></span></button>`).join('')}</div>`;
}

export function saveFoodFormHtml(result, query) {
  return `<p class="hint small">${esc(result.desc)}</p>
    <div class="field" style="margin-top:8px"><label for="nf-name">Name in der App</label><input class="input" id="nf-name" value="${esc(query)}" maxlength="50"></div>
    <div class="field" style="margin-top:8px"><span class="label">Gruppe (für deinen Tageswert)</span><div class="chips" id="nf-groups">${Object.entries(GROUP_LABELS).map(([k, l]) => `
      <button type="button" class="chip" data-nf-group="${k}" aria-pressed="${k === 'sonstiges'}">${l}</button>`).join('')}</div></div>
    <button type="button" class="btn btn-primary btn-block" data-nf-save="1" style="margin-top:12px">Speichern und hinzufügen</button>`;
}
