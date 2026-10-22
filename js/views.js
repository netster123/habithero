import { getState, getSetting, entries, totalPoints } from './store.js';
import { levelInfo, tasksForToday, isTaskDone, pointsOnDay } from './progress.js';
import { greeting, longDate, dayKey, dayLabel, clock, formatNumber, formatEuro } from './time.js';
import { icon } from './icons.js';
import { quitState, shortDuration } from './rauchfrei.js';
import { installInfo } from './install.js';

export const APP_VERSION = '0.6.2';

import { esc } from './util.js';
export { esc };

export const TABS = [
  { id: 'heute', label: 'Heute', icon: 'home' },
  { id: 'rauchfrei', label: 'Rauchfrei', icon: 'smokeFree' },
  { id: 'training', label: 'Training', icon: 'barbell' },
  { id: 'essen', label: 'Essen', icon: 'food' },
  { id: 'schlaf', label: 'Schlaf', icon: 'moon' },
];

export function tabbar(current) {
  return TABS.map(t => `
    <a class="tab" href="#${t.id}" aria-label="${t.label}" ${t.id === current ? 'aria-current="page"' : ''}>
      ${icon(t.icon)}<span>${t.label}</span>
    </a>`).join('');
}

function themeToggle(isDark) {
  return `<button type="button" class="icon-btn" data-action="toggle-theme"
    aria-label="${isDark ? 'Zum hellen Modus wechseln' : 'Zum dunklen Modus wechseln'}">${icon(isDark ? 'sun' : 'moon')}</button>`;
}

// --- Installations-Hilfe ------------------------------------------------------

function installSteps(info) {
  if (info.ios) return `<ol>
      <li>Tippe in Safari auf <strong>Teilen</strong> (Quadrat mit Pfeil; bei neuen iOS-Versionen zuerst auf <strong>•••</strong>).</li>
      <li>Wähle <strong>Zum Home-Bildschirm</strong> und dann <strong>Hinzufügen</strong>.</li></ol>`;
  if (info.android) return `<ol>
      <li>Öffne das Browser-Menü <strong>⋮</strong> (Samsung Internet: <strong>≡</strong>).</li>
      <li>Wähle <strong>App installieren</strong> oder <strong>Zum Startbildschirm hinzufügen</strong>.</li></ol>`;
  return `<ol><li>Öffne das Browser-Menü und wähle <strong>Zum Startbildschirm hinzufügen</strong> oder <strong>Installieren</strong>.</li></ol>`;
}

export function installCard({ force = false } = {}) {
  const info = installInfo();
  if (info.standalone || (!force && (!info.touch || getSetting('installHintDismissed')))) return '';
  return `<section class="card install">
    ${icon('download')}
    <div style="flex:1;min-width:0">
      <h2>HabitHero als App installieren</h2>
      <p class="hint" style="margin-top:4px">So startet HabitHero wie eine richtige App, im Vollbild und auch ohne Internet.</p>
      ${info.canPrompt ? '' : installSteps(info)}
      <div class="install-actions">
        ${info.canPrompt ? `<button type="button" class="btn btn-small btn-primary" data-action="install">Jetzt installieren</button>` : ''}
        ${force ? '' : `<button type="button" class="btn btn-small" data-action="dismiss-install">Später</button>`}
      </div>
    </div></section>`;
}

// --- Heute -----------------------------------------------------------------

function smokeCard() {
  const qs = quitState();
  const link = (label, value, sub) => `<a class="card card-tight" href="#rauchfrei" style="color:inherit;text-decoration:none">
    <div class="card-label">${label}</div><div class="card-value"${value.length > 10 ? ' style="font-size:18px"' : ''}>${value}</div><div class="sub">${sub}</div></a>`;
  if (qs.mode === 'vorbereitung') return link('Rauchfrei', 'Vorbereitung', 'Rauchstopp-Tag noch offen');
  if (qs.mode === 'countdown') return link('Rauchstopp in', shortDuration(qs.quit - Date.now()), 'Vorbereitung läuft');
  return link('Rauchfrei', shortDuration(qs.streakMs), `${formatEuro(qs.euro)} gespart`);
}

export function viewHeute() {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const pts = totalPoints();
  const lv = levelInfo(pts);
  const tasks = tasksForToday();
  const doneCount = tasks.filter(isTaskDone).length;

  const taskRows = tasks.map(t => {
    const done = isTaskDone(t);
    if (t.link) {
      return `<a class="list-item ${done ? 'task-done' : ''}" href="${t.link}">
      <span class="check">${icon(done ? 'check' : 'circle', 'check')}</span>
      <span class="list-main"><span class="list-title">${esc(t.title)}</span><div class="sub">${t.time} Uhr · ${done ? 'erledigt' : 'öffnen'}</div></span>
      <span class="list-points">+${t.points}</span></a>`;
    }
    return `<button type="button" class="list-item ${done ? 'task-done' : ''}" data-action="toggle-task" data-task="${t.id}" aria-pressed="${done}">
      <span class="check">${icon(done ? 'check' : 'circle', 'check')}</span>
      <span class="list-main"><span class="list-title">${esc(t.title)}</span><div class="sub">${t.time} Uhr</div></span>
      <span class="list-points">+${t.points}</span>
    </button>`;
  }).join('');

  return `
    <header class="head">
      <div class="head-title">
        <h1>${greeting(getSetting('sleep.wake'))}</h1>
        <div class="sub">${longDate()}</div>
      </div>
      <div class="head-actions">
        <span class="badge badge-level">Level ${lv.level}</span>
        ${themeToggle(isDark)}
        <a class="icon-btn" href="#einstellungen" aria-label="Einstellungen">${icon('gear')}</a>
      </div>
    </header>

    ${installCard()}

    <section class="card">
      <div class="row-between">
        <span class="card-label">Fortschritt zu Level ${lv.level + 1}</span>
        <span style="font-size:14px;font-weight:600">${formatNumber(lv.into)} / ${formatNumber(lv.span)} Punkte</span>
      </div>
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.span}" aria-valuenow="${lv.into}">
        <span style="width:${Math.round(lv.pct * 100)}%"></span>
      </div>
      <div class="sub" style="margin-top:6px">Insgesamt ${formatNumber(pts)} Punkte</div>
    </section>

    <div class="grid-2">
      ${smokeCard()}
      <div class="card card-tight">
        <div class="card-label">Punkte heute</div>
        <div class="card-value">${formatNumber(pointsOnDay())}</div>
        <div class="sub">${doneCount} von ${tasks.length} Aufgaben</div>
      </div>
    </div>

    <h2 class="section-title">Deine Aufgaben heute</h2>
    <div class="list">${taskRows}</div>

    <button type="button" class="btn-sos" data-action="sos">${icon('alert')} SOS Craving-Button</button>
  `;
}

// --- Platzhalter für die noch kommenden Bereiche -------------------------

const COMING = {
};

export function viewSoon(id) {
  const c = COMING[id];
  return `
    <header class="head"><div class="head-title"><h1>${c.title}</h1></div></header>
    <section class="card soon">
      ${icon(c.icon)}
      <h2>Dieser Bereich kommt als Nächstes</h2>
      <ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </section>`;
}

// --- Einstellungen -------------------------------------------------------

function seg(path, value, options) {
  return `<div class="segmented" role="group">${options.map(o => `
    <button type="button" data-action="set" data-path="${path}" data-value="${o.value}" aria-pressed="${value === o.value}">
      ${o.icon ? icon(o.icon, 'icon icon-sm') : ''}${o.label}</button>`).join('')}</div>`;
}

function numField(path, label, value, { step = 1, min = 0, unit = '' } = {}) {
  return `<div class="field"><label for="f-${path}">${label}${unit ? ` (${unit})` : ''}</label>
    <input class="input" id="f-${path}" type="number" inputmode="decimal" step="${step}" min="${min}" value="${esc(value)}" data-setting="${path}" data-kind="number"></div>`;
}

function timeField(path, label, value) {
  return `<div class="field"><label for="f-${path}">${label}</label>
    <input class="input" id="f-${path}" type="time" value="${esc(value)}" data-setting="${path}"></div>`;
}

export function viewEinstellungen() {
  const s = getState().settings;
  const lastBackup = s.lastBackup ? new Date(s.lastBackup).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'noch nie';
  return `
    <header class="head">
      <div class="head-title"><a class="back" href="#heute">${icon('chevronLeft', 'icon icon-sm')} Heute</a><h1>Einstellungen</h1></div>
    </header>

    <h2 class="section-title">Darstellung</h2>
    <section class="card" style="display:flex;flex-direction:column;gap:12px">
      ${seg('theme', s.theme, [{ value: 'light', label: 'Hell', icon: 'sun' }, { value: 'dark', label: 'Dunkel', icon: 'moon' }, { value: 'auto', label: 'Automatisch', icon: 'phone' }])}
      <div class="hint">Automatisch folgt der Einstellung deines iPhones.</div>
      <label class="row-between" style="align-items:center">
        <span><span style="display:block">Ab Schlafenszeit dunkel</span><span class="hint">Von 00:00 bis 05:00 automatisch dunkel</span></span>
        <span class="switch"><input type="checkbox" data-setting="darkAtNight" data-kind="bool" ${s.darkAtNight ? 'checked' : ''}><span></span></span>
      </label>
    </section>

    <h2 class="section-title">Schlafrhythmus</h2>
    <section class="card form-grid">
      ${timeField('sleep.bed', 'Schlafen gehen', s.sleep.bed)}
      ${timeField('sleep.wake', 'Aufstehen', s.sleep.wake)}
    </section>

    <h2 class="section-title">Körperdaten</h2>
    <section class="card form-grid">
      ${numField('body.weightKg', 'Gewicht', s.body.weightKg, { step: 0.1, unit: 'kg' })}
      ${numField('body.heightCm', 'Größe', s.body.heightCm, { unit: 'cm' })}
      ${numField('body.age', 'Alter', s.body.age, { unit: 'Jahre' })}
    </section>

    <h2 class="section-title">Tabak und Preis</h2>
    <section class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="form-grid">
        ${numField('tobacco.gramsPerPack', 'Packung', s.tobacco.gramsPerPack, { unit: 'g' })}
        ${numField('tobacco.pricePerPack', 'Preis', s.tobacco.pricePerPack, { step: 0.01, unit: '€' })}
        ${numField('tobacco.daysPerPack', 'Reicht für', s.tobacco.daysPerPack, { step: 0.5, unit: 'Tage' })}
        ${numField('tobacco.cigsPerDay', 'Zigaretten', s.tobacco.cigsPerDay, { unit: 'pro Tag' })}
      </div>
      <div class="hint">Das entspricht ${formatNumber(s.tobacco.gramsPerPack / s.tobacco.daysPerPack, 1)} g und ${formatEuro(s.tobacco.pricePerPack / s.tobacco.daysPerPack)} pro Tag.</div>
    </section>

    ${installInfo().standalone ? '' : `<h2 class="section-title">Installieren</h2>${installCard({ force: true })}`}

    <h2 class="section-title">Deine Daten</h2>
    <div class="list">
      <a class="list-item" href="#verlauf">${icon('history')}<span class="list-main">Verlauf aller Einträge</span>${icon('chevronRight', 'icon icon-sm')}</a>
      <button type="button" class="list-item" data-action="backup">${icon('download')}<span class="list-main">Daten sichern<div class="sub">Letzte Sicherung: ${lastBackup}</div></span></button>
      <button type="button" class="list-item" data-action="restore">${icon('upload')}<span class="list-main">Sicherung wiederherstellen</span></button>
    </div>
    <input type="file" id="restore-file" accept="application/json,.json" hidden>
    <p class="hint" style="padding:0 2px">Deine Daten liegen nur auf diesem iPhone. Nutze HabitHero immer über das Symbol auf dem Home-Bildschirm, denn der Browser speichert getrennt davon.</p>
    <p class="hint muted" style="padding:0 2px">HabitHero ${APP_VERSION}</p>
  `;
}

// --- Verlauf ---------------------------------------------------------------

const TYPE_FILTERS = [
  { id: 'alle', label: 'Alle' },
  { id: 'aufgabe', label: 'Aufgaben' },
  { id: 'sport', label: 'Sport' },
  { id: 'essen', label: 'Essen' },
  { id: 'schlaf', label: 'Schlaf' },
  { id: 'rauchen', label: 'Rauchen' },
  { id: 'gewicht', label: 'Gewicht' },
];

export function viewVerlauf(filter = 'alle') {
  const groupsOf = { rauchen: ['rauchen', 'sos', 'rauchfrei'], sport: ['sport', 'stufe'] };
  const types = groupsOf[filter] || [filter];
  const list = filter === 'alle' ? entries() : entries().filter(e => types.includes(e.type));
  const groups = new Map();
  for (const e of list) {
    const k = dayKey(new Date(e.ts));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const body = list.length ? [...groups].map(([k, items]) => `
      <div class="day-label">${esc(dayLabel(k))}</div>
      <div class="list">${items.map(e => `
        <div class="list-item">
          <span class="list-main"><span class="list-title">${esc(e.label)}</span>
            <div class="sub">${clock(e.ts)} Uhr${e.points ? ` · +${e.points} Punkte` : ''}</div></span>
          <button type="button" class="trash" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="Eintrag löschen">${icon('trash')}</button>
        </div>`).join('')}</div>`).join('')
    : `<div class="list"><div class="list-empty">Noch keine Einträge${filter === 'alle' ? '' : ' in diesem Bereich'}.</div></div>`;

  return `
    <header class="head">
      <div class="head-title"><a class="back" href="#einstellungen">${icon('chevronLeft', 'icon icon-sm')} Einstellungen</a><h1>Verlauf</h1>
      <div class="sub">Jeden Eintrag einzeln löschen</div></div>
    </header>
    <div class="chips" role="group" aria-label="Filter">${TYPE_FILTERS.map(f => `
      <button type="button" class="chip" data-action="filter" data-filter="${f.id}" aria-pressed="${f.id === filter}">${f.label}</button>`).join('')}</div>
    ${body}`;
}
