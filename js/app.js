import { getSetting, setSetting, onChange, findEntry, addEntry, updateEntry, removeEntry, exportData, importData, markBackup } from './store.js';
import { tasksForToday, toggleTask, levelInfo } from './progress.js';
import { totalPoints } from './store.js';
import { dayKey } from './time.js';
import { viewHeute, viewSoon, viewEinstellungen, viewVerlauf, tabbar, esc } from './views.js';
import { viewRauchfrei, viewSos, sheetLogCig, sheetQuitDate, awardMilestones, quitState, TRIGGERS, SOS_SECONDS } from './rauchfrei.js';
import { bindCharts } from './chart.js';
import { initInstall, promptInstall } from './install.js';
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

function route() {
  const id = (location.hash || '#heute').slice(1);
  return ['heute', 'rauchfrei', 'sos', 'training', 'essen', 'schlaf', 'einstellungen', 'verlauf'].includes(id) ? id : 'heute';
}

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
    case 'sos': $view.innerHTML = viewSos(sos); syncSos(); break;
    case 'einstellungen': $view.innerHTML = viewEinstellungen(); break;
    case 'verlauf': $view.innerHTML = viewVerlauf(verlaufFilter); break;
    default: $view.innerHTML = viewSoon(r);
  }
  const tab = ['einstellungen', 'verlauf'].includes(r) ? 'heute' : r === 'sos' ? 'rauchfrei' : r;
  $tabbar.innerHTML = tabbar(tab);
  window.scrollTo(0, scroll);
}

let lastRoute = route();
window.addEventListener('hashchange', () => {
  const r = route();
  if (lastRoute === 'sos' && r !== 'sos') sos = null;
  render();
  if (r !== lastRoute) window.scrollTo(0, 0);
  lastRoute = r;
});
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
