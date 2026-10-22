import { getSetting, setSetting, onChange, findEntry, removeEntry, exportData, importData, markBackup } from './store.js';
import { tasksForToday, toggleTask, levelInfo } from './progress.js';
import { totalPoints } from './store.js';
import { dayKey } from './time.js';
import { viewHeute, viewSoon, viewEinstellungen, viewVerlauf, tabbar, esc } from './views.js';

const $view = document.getElementById('view');
const $tabbar = document.getElementById('tabbar');
const $overlay = document.getElementById('overlay');
const $toast = document.getElementById('toast');

let verlaufFilter = 'alle';

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
}

darkQuery.addEventListener('change', () => { applyTheme(); render(); });

// --- Routing & Rendern -----------------------------------------------------

function route() {
  const id = (location.hash || '#heute').slice(1);
  return ['heute', 'rauchfrei', 'training', 'essen', 'schlaf', 'einstellungen', 'verlauf'].includes(id) ? id : 'heute';
}

function render() {
  applyTheme();
  const r = route();
  const scroll = window.scrollY;
  switch (r) {
    case 'heute': $view.innerHTML = viewHeute(); break;
    case 'einstellungen': $view.innerHTML = viewEinstellungen(); break;
    case 'verlauf': $view.innerHTML = viewVerlauf(verlaufFilter); break;
    default: $view.innerHTML = viewSoon(r);
  }
  const tab = ['einstellungen', 'verlauf'].includes(r) ? 'heute' : r;
  $tabbar.innerHTML = tabbar(tab);
  window.scrollTo(0, scroll);
}

let lastRoute = route();
window.addEventListener('hashchange', () => {
  const r = route();
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
    location.hash = '#rauchfrei';
    toast('Der SOS Craving-Button kommt im nächsten Schritt');
  } else if (a === 'set') {
    setSetting(el.dataset.path, el.dataset.value);
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
  } else if (a === 'apply-update') {
    applyUpdate();
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'restore-file' && el.files[0]) { restore(el.files[0]); el.value = ''; return; }
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

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

// Dem Browser sagen, dass die Daten dauerhaft bleiben sollen
navigator.storage?.persist?.().catch(() => {});

// Tageswechsel, Uhrzeit-Anzeige und Nacht-Modus aktuell halten
const typing = () => ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
setInterval(() => { if (!document.hidden && $overlay.hidden && !typing()) render(); }, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

render();
