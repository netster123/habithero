import { getSetting, setSetting, onChange, findEntry, addEntry, updateEntry, removeEntry, exportData, importData, markBackup } from './store.js';
import { tasksForToday, toggleTask, levelInfo, isTaskDone } from './progress.js';
import { viewSchlaf, viewNightForm, nightDraftFrom, saveNight, durationFor, sleepSeries, goalMinutes } from './schlaf.js';
import { totalPoints } from './store.js';
import { dayKey } from './time.js';
import { viewHeute, viewSoon, viewEinstellungen, viewVerlauf, tabbar, esc } from './views.js';
import { viewRauchfrei, viewSos, sheetLogCig, sheetQuitDate, awardMilestones, quitState, TRIGGERS, SOS_SECONDS } from './rauchfrei.js';
import { bindCharts, lineChart } from './chart.js';
import { initInstall, promptInstall } from './install.js';
import { loadFoods, searchLocal, searchOnline, saveCustomFood, deleteCustomFood, foodById } from './foods.js';
import { saveRecipe, deleteRecipe, recipeById } from './recipes.js';
import {
  viewPlan, viewRecipes, viewRecipe, viewMealForm, viewRecipeForm, mealDraftFrom, recipeDraftFrom, meals, saveMeals,
  toggleMeal, logExtraMeal, mealValues, sheetIngredientSearch, ingredientResultsHtml, onlineResultsHtml, saveFoodFormHtml,
} from './essen.js';
import { viewTraining, logSet, undoSet, skipRest, setStage, finishTraining, draft, exerciseById, currentStage } from './training.js';

const $view = document.getElementById('view');
const $tabbar = document.getElementById('tabbar');
const $overlay = document.getElementById('overlay');
const $toast = document.getElementById('toast');

let verlaufFilter = 'alle';
let sosRange = 14;
let sos = null; // laufende SOS-Sitzung: { id, start, mode, squats }

// --- Theme -------------------------------------------------------------------

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

// Nachts (00–05 Uhr) automatisch dunkel – außer du schaltest in dieser Nacht bewusst auf hell
function nightForced() {
  return getSetting('darkAtNight') && new Date().getHours() < 5 && getSetting('nightOff') !== dayKey();
}

function resolveTheme() {
  const theme = getSetting('theme');
  let dark = theme === 'dark' || (theme === 'auto' && darkQuery.matches);
  if (nightForced()) dark = true;
  return dark ? 'dark' : 'light';
}

function applyTheme() {
  const t = resolveTheme();
  if (document.documentElement.dataset.theme !== t) document.documentElement.dataset.theme = t;
  // Statusleiste unter Android (und in Safari) passend einfärben
  const meta = document.getElementById('theme-color');
  if (meta) meta.content = t === 'dark' ? '#1C1C1A' : '#F7F6F2';
}

darkQuery.addEventListener('change', () => { applyTheme(); render(); });

// --- Routing & Rendern -----------------------------------------------------

const ROUTES = ['heute', 'rauchfrei', 'sos', 'training', 'essen', 'mahlzeit', 'rezept', 'rezept-bearbeiten', 'schlaf', 'nacht', 'einstellungen', 'verlauf'];

function route() {
  const id = (location.hash || '#heute').slice(1).split('/')[0];
  return ROUTES.includes(id) ? id : 'heute';
}

function routeParam() { return decodeURIComponent((location.hash.split('/')[1] || '')); }

// Bearbeitungsstände im Bereich Essen (nur im Speicher, bis gespeichert wird)
let essenTab = 'plan';
let recFilter = { cuisine: 'alle', main: null };
let mealDraft = null;
let recipeDraft = null;
let nightDraft = null;
let sleepRange = 14;

let rendering = false;
function render() {
  if (rendering) return;
  rendering = true;
  try { renderNow(); } finally { rendering = false; }
}

function renderNow() {
  applyTheme();
  const fresh = awardMilestones();
  if (fresh.length) toast(`Meilenstein erreicht: ${fresh[fresh.length - 1].title}`);
  let r = route();
  if (r === 'sos' && !sos) { location.replace('#rauchfrei'); r = 'rauchfrei'; }
  const scroll = window.scrollY;
  switch (r) {
    case 'heute': $view.innerHTML = viewHeute(); break;
    case 'rauchfrei': $view.innerHTML = viewRauchfrei(sosRange); break;
    case 'training': $view.innerHTML = viewTraining(); break;
    case 'essen': $view.innerHTML = essenTab === 'plan' ? viewPlan() : viewRecipes(recFilter); break;
    case 'mahlzeit': $view.innerHTML = viewMealForm(mealDraft); break;
    case 'rezept': $view.innerHTML = viewRecipe(routeParam()); break;
    case 'rezept-bearbeiten': $view.innerHTML = viewRecipeForm(recipeDraft); break;
    case 'schlaf': $view.innerHTML = viewSchlaf(tasksForToday().filter(t => t.evening), isTaskDone, sleepRange, sleepChart); break;
    case 'nacht': $view.innerHTML = viewNightForm(nightDraft); break;
    case 'sos': $view.innerHTML = viewSos(sos); syncSos(); break;
    case 'einstellungen': $view.innerHTML = viewEinstellungen(); break;
    case 'verlauf': $view.innerHTML = viewVerlauf(verlaufFilter); break;
    default: $view.innerHTML = viewSoon(r);
  }
  const tab = ['einstellungen', 'verlauf'].includes(r) ? 'heute' : r === 'sos' ? 'rauchfrei'
    : ['mahlzeit', 'rezept', 'rezept-bearbeiten'].includes(r) ? 'essen' : r === 'nacht' ? 'schlaf' : r;
  $tabbar.innerHTML = tabbar(tab);
  window.scrollTo(0, scroll);
}

let lastHash = location.hash;
let lastRoute = route();
function prepareRoute() {
  const r = route();
  if (r === 'mahlzeit' && (!mealDraft || location.hash !== lastHash)) mealDraft = mealDraftFrom(routeParam());
  if (r === 'nacht' && (!nightDraft || location.hash !== lastHash)) nightDraft = nightDraftFrom(routeParam());
  if (r === 'rezept-bearbeiten' && (!recipeDraft || location.hash !== lastHash)) {
    const p = routeParam();
    recipeDraft = p.startsWith('kopie:') ? recipeDraftFrom('neu', p.slice(6)) : recipeDraftFrom(p);
  }
}
window.addEventListener('hashchange', () => {
  const r = route();
  if (lastRoute === 'sos' && r !== 'sos') sos = null;
  if (r !== 'mahlzeit') mealDraft = null;
  if (r !== 'rezept-bearbeiten') recipeDraft = null;
  if (r !== 'nacht') nightDraft = null;
  prepareRoute();
  render();
  if (location.hash !== lastHash) window.scrollTo(0, 0);
  lastHash = location.hash;
  lastRoute = r;
});
prepareRoute();
loadFoods().then(render).catch(() => toast('Nährwerte konnten nicht geladen werden'));
onChange(render);

// --- Kleine Helfer -----------------------------------------------------------

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, 2600);
}
window.addEventListener('hh:error', e => toast(e.detail));

function confirmDialog({ title, text, confirm = 'Löschen', cancel = 'Behalten', danger = true }) {
  return new Promise(resolve => {
    $overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-t">
      <h2 id="dlg-t">${esc(title)}</h2><p>${esc(text)}</p>
      <div class="dialog-actions">
        <button type="button" class="btn" data-r="0">${esc(cancel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-r="1">${esc(confirm)}</button>
      </div></div>`;
    $overlay.hidden = false;
    const done = v => { $overlay.hidden = true; $overlay.innerHTML = ''; $overlay.onclick = null; resolve(v); };
    $overlay.onclick = e => {
      const b = e.target.closest('[data-r]');
      if (b) done(b.dataset.r === '1');
      else if (e.target === $overlay) done(false);
    };
  });
}

function openSheet(html, onClick) {
  $overlay.innerHTML = html;
  $overlay.hidden = false;
  const close = () => { $overlay.hidden = true; $overlay.innerHTML = ''; $overlay.onclick = null; };
  $overlay.onclick = e => {
    if (e.target === $overlay || e.target.closest('[data-close]')) return close();
    if (onClick(e) === true) close();
  };
}

// --- SOS Craving-Button --------------------------------------------------------

function startSos() {
  const entry = addEntry({ type: 'sos', label: 'SOS Craving-Button', points: 0, data: { outcome: null } });
  sos = { id: entry.id, start: Date.now(), mode: 'atmen', squats: 0 };
  location.hash = '#sos';
}

function syncSos() {
  if (!sos) return;
  const elapsed = (Date.now() - sos.start) / 1000;
  const remaining = Math.max(0, SOS_SECONDS - Math.floor(elapsed));
  const timer = document.getElementById('sos-timer');
  if (timer) timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  const sub = document.getElementById('sos-sub');
  if (sub) sub.textContent = remaining ? 'Restzeit' : 'Die Welle ist vorbei. Geschafft?';
  const core = document.querySelector('.breath-core');
  if (core) {
    core.style.animationDelay = `-${(elapsed % 10).toFixed(2)}s`;
    document.getElementById('breath-label').textContent = elapsed % 10 < 4 ? 'Einatmen' : 'Ausatmen';
  }
}
setInterval(() => { if (route() === 'sos') syncSos(); }, 250);

// Satzpause im Training herunterzählen
let restWasRunning = false;
setInterval(() => {
  const d = draft();
  const running = !!(d?.restUntil && d.restUntil > Date.now());
  const el = document.getElementById('rest-timer');
  if (running && el) {
    const left = Math.ceil((d.restUntil - Date.now()) / 1000);
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  }
  if (restWasRunning && !running && d?.restUntil) { // nicht nach „Überspringen“ oder Abschließen
    navigator.vibrate?.([200, 100, 200]);
    if (route() === 'training') { toast('Pause vorbei – nächster Satz'); render(); }
  }
  restWasRunning = running;
}, 500);

function finishSos(outcome) {
  if (!sos) return;
  const id = sos.id;
  sos = null;
  if (outcome === 'überstanden') {
    updateEntry(id, { points: 50, label: 'SOS Craving-Button: Verlangen überstanden', data: { outcome } });
    toast('Verlangen überstanden. +50 Punkte');
  } else {
    updateEntry(id, { label: 'SOS Craving-Button: geraucht', data: { outcome } });
    if (quitState().mode === 'rauchfrei') {
      addEntry({ type: 'rauchen', label: 'Ausrutscher: eine Zigarette', data: { slip: true } });
      toast('Ein Ausrutscher ist kein Rückfall. Dein Zähler beginnt neu, deine Punkte bleiben.');
    } else {
      addEntry({ type: 'rauchen', label: 'Zigarette erfasst', data: { situation: 'sonstiges' } });
    }
  }
  location.hash = '#rauchfrei';
}

function sleepChart(days) {
  const { values, labels } = sleepSeries(days);
  if (values.length < 2) return '<p class="hint">Trag mindestens zwei Nächte ein, dann erscheint hier dein Verlauf.</p>';
  return lineChart('schlaf', values, labels, { unit: 'Std.', target: Math.round(goalMinutes() / 6) / 10, variant: 'schlaf', decimals: 1, step: 2 });
}

// --- Essen: Speichern und Zutatensuche --------------------------------------------

function saveMealDraft() {
  const d = mealDraft;
  if (d.source === 'rezept' && !d.recipeId) { toast('Bitte ein Rezept wählen'); return; }
  const rec = d.recipeId && recipeById(d.recipeId);
  const name = d.name.trim() || rec?.name;
  if (!name) { toast('Bitte einen Namen eingeben'); return; }
  const meal = {
    id: d.id || `m${Date.now().toString(36)}`, name, time: d.time || '12:30', days: d.days,
    recipeId: d.source === 'rezept' ? d.recipeId : null, portions: d.portions || 1,
    kcal: Number(d.kcal) || 0, protein: Number(d.protein) || 0, groups: d.groups,
  };
  if (d.mode === 'heute') {
    logExtraMeal(meal);
    toast('Eingetragen');
  } else {
    const list = meals();
    saveMeals(d.id ? list.map(x => (x.id === d.id ? meal : x)) : [...list, meal]);
    toast('Gespeichert');
  }
  mealDraft = null;
  location.hash = '#essen';
}

function saveRecipeDraft() {
  const d = recipeDraft;
  if (!d.name.trim()) { toast('Bitte einen Namen eingeben'); return; }
  if (!d.ingredients.length) { toast('Bitte mindestens eine Zutat hinzufügen'); return; }
  const recipe = {
    id: d.id || `r${Date.now().toString(36)}`, name: d.name.trim(), cuisine: d.cuisine, main: d.main,
    portions: Math.max(1, Number(d.portions) || 1), minutes: Math.max(1, Number(d.minutes) || 1),
    ingredients: d.ingredients.map(x => ({ foodId: x.foodId, food: x.food, grams: Number(x.grams) || 0, note: x.note || '' })),
    steps: d.steps.split('\n').map(x => x.trim()).filter(Boolean),
  };
  saveRecipe(recipe);
  recipeDraft = null;
  toast('Rezept gespeichert');
  location.hash = `#rezept/${recipe.id}`;
}

function addIngredient(food) {
  recipeDraft.ingredients.push({ foodId: food.id, food: food.name, grams: food.portions && Object.values(food.portions)[0] || 100, note: '' });
  render();
}

function openIngredientSearch() {
  let online = null;
  let picked = null;
  openSheet(sheetIngredientSearch(), e => {
    const pick = e.target.closest('[data-pick]');
    if (pick) { addIngredient(foodById(pick.dataset.pick)); toast('Zutat hinzugefügt'); return true; }
    const q = document.getElementById('ing-query')?.value || '';
    const box = document.getElementById('ing-results');
    if (e.target.closest('[data-online]')) {
      box.innerHTML = '<p class="hint">Suche im Internet …</p>';
      searchOnline(q).then(res => { online = res; box.innerHTML = onlineResultsHtml(res, q); })
        .catch(() => { box.innerHTML = '<p class="hint">Die Suche hat nicht geklappt. Bist du online?</p>'; });
      return;
    }
    const op = e.target.closest('[data-online-pick]');
    if (op) { picked = online.results[Number(op.dataset.onlinePick)]; box.innerHTML = saveFoodFormHtml(picked, q); return; }
    const g = e.target.closest('[data-nf-group]');
    if (g) { box.querySelectorAll('[data-nf-group]').forEach(b => b.setAttribute('aria-pressed', String(b === g))); return; }
    if (e.target.closest('[data-nf-save]')) {
      const name = document.getElementById('nf-name').value.trim();
      if (!name) { toast('Bitte einen Namen eingeben'); return; }
      const group = box.querySelector('[data-nf-group][aria-pressed="true"]')?.dataset.nfGroup || 'sonstiges';
      const food = saveCustomFood({ name, group, desc: picked.desc, fdcId: picked.fdcId, v: picked.v });
      addIngredient(food);
      toast(`„${name}“ gespeichert`);
      return true;
    }
  });
  setTimeout(() => document.getElementById('ing-query')?.focus(), 50);
}

document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'ing-query') {
    document.getElementById('ing-results').innerHTML = el.value.trim() ? ingredientResultsHtml(searchLocal(el.value), el.value) : '<p class="hint">Tippe den Namen einer Zutat ein.</p>';
  } else if (el.dataset.nd && nightDraft) {
    nightDraft[el.dataset.nd] = el.value;
    const out = document.getElementById('nd-duration');
    if (out) out.textContent = durationFor(nightDraft);
  } else if (el.dataset.md && mealDraft) {
    mealDraft[el.dataset.md] = el.value;
  } else if (el.dataset.rd && recipeDraft) {
    recipeDraft[el.dataset.rd] = el.value;
  } else if (el.dataset.rdGrams && recipeDraft) {
    recipeDraft.ingredients[Number(el.dataset.rdGrams)].grams = Number(el.value) || 0;
  }
});

// --- Aktionen -----------------------------------------------------------------

async function backup() {
  const json = exportData();
  const name = `habithero-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'HabitHero-Sicherung' });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
    markBackup();
    toast('Sicherung erstellt');
  } catch (err) {
    if (err.name !== 'AbortError') toast('Sicherung fehlgeschlagen');
  }
}

async function restore(file) {
  try {
    const text = await file.text();
    const ok = await confirmDialog({
      title: 'Sicherung wiederherstellen?',
      text: 'Deine aktuellen Daten werden durch die Sicherung ersetzt.',
      confirm: 'Wiederherstellen', cancel: 'Abbrechen', danger: false,
    });
    if (!ok) return;
    importData(text);
    toast('Sicherung wiederhergestellt');
  } catch (err) {
    toast(err.message || 'Datei konnte nicht gelesen werden');
  }
}

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  if (a === 'toggle-theme') {
    const toLight = document.documentElement.dataset.theme === 'dark';
    if (toLight && nightForced()) setSetting('nightOff', dayKey());
    setSetting('theme', toLight ? 'light' : 'dark');
  } else if (a === 'toggle-task') {
    const task = tasksForToday().find(t => t.id === el.dataset.task);
    if (!task) return;
    const before = levelInfo(totalPoints()).level;
    const done = toggleTask(task);
    const after = levelInfo(totalPoints()).level;
    if (done) toast(after > before ? `Stark – Level ${after} erreicht!` : `+${task.points} Punkte`);
  } else if (a === 'sos') {
    startSos();
  } else if (a === 'sos-mode') {
    sos.mode = el.dataset.mode;
    render();
  } else if (a === 'squat') {
    sos.squats = Math.min(15, sos.squats + 1);
    render();
    if (sos.squats === 15) toast('15 Kniebeugen geschafft');
  } else if (a === 'sos-done') {
    finishSos('überstanden');
  } else if (a === 'sos-smoked') {
    finishSos('geraucht');
  } else if (a === 'sos-range') {
    sosRange = Number(el.dataset.range);
    render();
  } else if (a === 'log-cig') {
    openSheet(sheetLogCig(), ev => {
      const b = ev.target.closest('[data-situation]');
      if (!b) return;
      const t = TRIGGERS.find(x => x.id === b.dataset.situation);
      addEntry({ type: 'rauchen', label: `Zigarette: ${t.label}`, data: { situation: t.id } });
      toast('Erfasst');
      return true;
    });
  } else if (a === 'quit-date') {
    openSheet(sheetQuitDate(), ev => {
      const b = ev.target.closest('[data-quit]');
      if (!b) return;
      const kind = b.dataset.quit;
      if (kind === 'clear') { setSetting('quitDate', null); toast('Rauchstopp-Tag entfernt'); return true; }
      let date = new Date();
      if (kind === 'input') {
        const v = document.getElementById('quit-input').value;
        if (!v) { toast('Bitte Datum und Uhrzeit wählen'); return; }
        date = new Date(v);
      }
      setSetting('quitDate', date.toISOString());
      toast(date > new Date() ? 'Rauchstopp-Tag festgelegt' : 'Los geht’s – du bist jetzt rauchfrei!');
      return true;
    });
  } else if (a === 'save-goal') {
    const name = document.getElementById('goal-name').value.trim();
    const amount = parseFloat(document.getElementById('goal-amount').value.replace(',', '.'));
    if (!name || !(amount > 0)) { toast('Bitte Name und Betrag eingeben'); return; }
    setSetting('savingsGoal', { name, amount });
  } else if (a === 'clear-goal') {
    setSetting('savingsGoal', { name: '', amount: 0 });
  } else if (a === 'set') {
    setSetting(el.dataset.path, el.dataset.kind === 'number' ? Number(el.dataset.value) : el.dataset.value);
  } else if (a === 'rep-step') {
    const input = document.getElementById(`reps-${el.dataset.ex}`);
    input.value = Math.max(0, (Number(input.value) || 0) + Number(el.dataset.delta));
  } else if (a === 'log-set') {
    const v = Math.round(Number(document.getElementById(`reps-${el.dataset.ex}`).value));
    if (!(v > 0)) { toast('Bitte eine Zahl größer als 0 eingeben'); return; }
    logSet(el.dataset.ex, v);
    toast('Satz gespeichert – Pause läuft');
  } else if (a === 'undo-set') {
    undoSet(el.dataset.ex);
  } else if (a === 'skip-rest') {
    skipRest();
  } else if (a === 'stage-up') {
    const ex = exerciseById(el.dataset.ex);
    const to = currentStage(ex.id) + 1;
    setStage(ex.id, to, { levelUp: true });
    toast(`Stufe ${to + 1}: ${ex.stages[to].name} · +100 Punkte`);
  } else if (a === 'choose-stage') {
    const ex = exerciseById(el.dataset.ex);
    const to = Number(el.dataset.stage);
    const ok = await confirmDialog({ title: `${ex.name}: Stufe ${to + 1}?`, text: `Ab jetzt trainierst du „${ex.stages[to].name}“. Dafür gibt es keine Punkte – die gibt es fürs Aufsteigen.`, confirm: 'Stufe wählen', cancel: 'Abbrechen', danger: false });
    if (ok) setStage(ex.id, to);
  } else if (a === 'nd-wakeups') {
    nightDraft.wakeups = Math.max(0, Math.min(20, nightDraft.wakeups + Number(el.dataset.delta)));
    render();
  } else if (a === 'nd-awake') {
    nightDraft.awakeMin = Math.max(0, Math.min(600, (Number(nightDraft.awakeMin) || 0) + Number(el.dataset.delta)));
    render();
  } else if (a === 'sleep-range') {
    sleepRange = Number(el.dataset.range);
    render();
  } else if (a === 'nd-quality') {
    nightDraft.quality = el.dataset.quality;
    render();
  } else if (a === 'nd-save') {
    try {
      const res = saveNight(nightDraft);
      toast(res.regular ? 'Im Rhythmus geschlafen · +30 Punkte' : 'Nacht eingetragen · +10 Punkte');
      nightDraft = null;
      location.hash = '#schlaf';
    } catch (err) { toast(err.message); }
  } else if (a === 'essen-tab') {
    essenTab = el.dataset.tab;
    render();
  } else if (a === 'toggle-meal') {
    const m = meals().find(x => x.id === el.dataset.meal);
    if (!m) return;
    const done = toggleMeal(m);
    if (done) toast(`+${mealValues(m).kcal >= 300 ? 30 : 20} Punkte`);
  } else if (a === 'log-weight') {
    const kg = parseFloat(String(document.getElementById('weight-input').value).replace(',', '.'));
    if (!(kg >= 30 && kg <= 250)) { toast('Bitte ein Gewicht in kg eingeben'); return; }
    addEntry({ type: 'gewicht', label: `Gewicht ${kg.toLocaleString('de-DE')} kg`, data: { kg } });
    setSetting('body.weightKg', kg);
    toast('Gewicht eingetragen');
  } else if (a === 'md-days') {
    const day = el.dataset.day;
    if (day === 'all') mealDraft.days = [];
    else {
      const n = Number(day);
      mealDraft.days = mealDraft.days.includes(n) ? mealDraft.days.filter(x => x !== n) : [...mealDraft.days, n];
    }
    render();
  } else if (a === 'md-source') {
    mealDraft.source = el.dataset.source;
    render();
  } else if (a === 'md-portions') {
    mealDraft.portions = Math.max(0.5, Math.min(6, (mealDraft.portions || 1) + Number(el.dataset.delta)));
    render();
  } else if (a === 'md-group') {
    const k = el.dataset.group;
    const n = ((mealDraft.groups[k] || 0) + 1) % 4;
    mealDraft.groups = { ...mealDraft.groups, [k]: n };
    render();
  } else if (a === 'md-save') {
    saveMealDraft();
  } else if (a === 'md-delete') {
    const ok = await confirmDialog({ title: 'Mahlzeit entfernen?', text: `„${mealDraft.name}“ wird aus deinem Plan entfernt. Bereits abgehakte Einträge bleiben im Verlauf.`, confirm: 'Entfernen', cancel: 'Behalten' });
    if (!ok) return;
    saveMeals(meals().filter(x => x.id !== mealDraft.id));
    location.hash = '#essen';
  } else if (a === 'rec-filter') {
    recFilter.cuisine = el.dataset.cuisine;
    render();
  } else if (a === 'rec-main') {
    recFilter.main = recFilter.main === el.dataset.main ? null : el.dataset.main;
    render();
  } else if (a === 'delete-food') {
    const f = foodById(el.dataset.id);
    const ok = await confirmDialog({ title: 'Zutat löschen?', text: `„${f?.name}“ wird aus deinen gespeicherten Zutaten entfernt. Rezepte, die sie nutzen, zeigen sie dann als unbekannt.` });
    if (ok) deleteCustomFood(el.dataset.id);
  } else if (a === 'recipe-to-plan') {
    const rec = recipeById(el.dataset.id);
    mealDraft = { ...mealDraftFrom('neu'), name: rec.name, recipeId: rec.id };
    lastHash = '#mahlzeit/neu';
    location.hash = '#mahlzeit/neu';
  } else if (a === 'recipe-copy') {
    location.hash = `#rezept-bearbeiten/kopie:${el.dataset.id}`;
  } else if (a === 'recipe-delete') {
    const rec = recipeById(el.dataset.id);
    const ok = await confirmDialog({ title: 'Rezept löschen?', text: `„${rec.name}“ wird gelöscht. Mahlzeiten in deinem Plan, die es nutzen, behalten ihren Namen.` });
    if (!ok) return;
    deleteRecipe(rec.id);
    location.hash = '#essen';
  } else if (a === 'rd-set') {
    recipeDraft[el.dataset.key] = el.dataset.value;
    render();
  } else if (a === 'rd-remove') {
    recipeDraft.ingredients.splice(Number(el.dataset.idx), 1);
    render();
  } else if (a === 'rd-add-ingredient') {
    openIngredientSearch();
  } else if (a === 'rd-save') {
    saveRecipeDraft();
  } else if (a === 'finish-training') {
    const r = finishTraining();
    toast(r === 'ok' ? 'Training abgeschlossen · +100 Punkte' : r === 'extra' ? 'Zusatztraining gespeichert' : 'Speichere zuerst mindestens einen Satz');
  } else if (a === 'filter') {
    verlaufFilter = el.dataset.filter;
    render();
  } else if (a === 'delete-entry') {
    const entry = findEntry(x => x.id === el.dataset.id);
    if (!entry) return;
    const ok = await confirmDialog({
      title: 'Eintrag löschen?',
      text: `„${entry.label}“ wird entfernt.${entry.points ? ` Die ${entry.points} Punkte dafür werden abgezogen.` : ''}`,
    });
    if (ok) { removeEntry(entry.id); toast('Eintrag gelöscht'); }
  } else if (a === 'backup') {
    backup();
  } else if (a === 'restore') {
    document.getElementById('restore-file').click();
  } else if (a === 'install') {
    const ok = await promptInstall();
    if (ok) toast('HabitHero wird installiert');
    render();
  } else if (a === 'dismiss-install') {
    setSetting('installHintDismissed', true);
  } else if (a === 'apply-update') {
    applyUpdate();
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.md === 'recipeId' && mealDraft) { mealDraft.recipeId = el.value || null; render(); return; }
  if ((el.dataset.rdGrams || el.dataset.rd === 'portions') && recipeDraft) { render(); return; }
  if (el.dataset.md || el.dataset.rd || el.dataset.nd) return;
  if (el.id === 'restore-file' && el.files[0]) { restore(el.files[0]); el.value = ''; return; }
  if (el.dataset.plan) {
    const plans = { ...(getSetting('plans') || {}) };
    const text = el.value.trim();
    if (text) plans[el.dataset.plan] = text; else delete plans[el.dataset.plan];
    setSetting('plans', plans);
    toast('Plan gespeichert');
    return;
  }
  const path = el.dataset.setting;
  if (!path) return;
  if (el.dataset.kind === 'bool') return setSetting(path, el.checked);
  if (el.dataset.kind === 'number') {
    const n = parseFloat(String(el.value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { toast('Bitte eine Zahl größer als 0 eingeben'); render(); return; }
    return setSetting(path, n);
  }
  if (el.value) setSetting(path, el.value);
});

// --- Service Worker & Updates ------------------------------------------------

let waitingWorker = null;

function showUpdate(worker) {
  waitingWorker = worker;
  document.getElementById('update-banner').hidden = false;
}

function applyUpdate() {
  if (waitingWorker) waitingWorker.postMessage('skipWaiting');
  else location.reload();
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(err => console.warn('Service Worker nicht registriert', err));

  // Beim allerersten Start übernimmt der Service Worker ohne Neuladen
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    location.reload();
  });
}

// Dem Browser sagen, dass die Daten dauerhaft bleiben sollen
navigator.storage?.persist?.().catch(() => {});

// Tageswechsel, Uhrzeit-Anzeige und Nacht-Modus aktuell halten
const typing = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
setInterval(() => { if (!document.hidden && $overlay.hidden && !typing() && route() !== 'sos') render(); }, 60_000);
bindCharts();
initInstall(render);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

render();
