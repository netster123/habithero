// Bereich Schlaf: Nächte eintragen, Aufwachen zählen, Regelmäßigkeit und Abendroutine.
import { getSetting, entries, addEntry, updateEntry, findEntry } from './store.js';
import { dayKey, formatNumber } from './time.js';
import { icon } from './icons.js';
import { esc } from './util.js';

const DAY = 864e5;
const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const QUALITY = [
  { id: 'schlecht', label: 'Schlecht' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'gut', label: 'Gut' },
];
const TOLERANCE = 30; // Minuten Abweichung, die noch als „eingehalten“ gilt

export const SLEEP_SOURCES = [
  'Windred DP et al. Sleep regularity is a stronger predictor of mortality risk than sleep duration: a prospective cohort study. Sleep 2024;47(1):zsad253.',
  'Khalsa SBS et al. A phase response curve to single bright light pulses in human subjects. Journal of Physiology 2003;549(3):945–952.',
  'Chang AM et al. Evening use of light-emitting eReaders negatively affects sleep, circadian timing, and next-morning alertness. PNAS 2015;112(4):1232–1237.',
  'Drake C et al. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. Journal of Clinical Sleep Medicine 2013;9(11):1195–1200.',
  'Watson NF et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. Sleep 2015;38(6):843–844.',
  'Hughes JR. Effects of abstinence from tobacco: valid symptoms and time course. Nicotine & Tobacco Research 2007;9(3):315–327.',
];

// --- Zeiten ---------------------------------------------------------------------------

export const toMin = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const fromMin = m => { const x = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const clockOf = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const diffMin = (a, b) => { const d = Math.abs(a - b) % 1440; return Math.min(d, 1440 - d); }; // kürzester Abstand auf der Uhr

export function durationLabel(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

// --- Nächte -------------------------------------------------------------------------------

export function nights() { return entries('schlaf'); }

export function nightTimes(bedHHMM, wakeHHMM, wakeDate) {
  const [y, mo, d] = wakeDate.split('-').map(Number);
  const wake = new Date(y, mo - 1, d, ...wakeHHMM.split(':').map(Number));
  const bed = new Date(y, mo - 1, d, ...bedHHMM.split(':').map(Number));
  if (bed >= wake) bed.setDate(bed.getDate() - 1); // ins Bett vor Mitternacht → Vortag
  return { bed, wake, minutes: (wake - bed) / 6e4 };
}

function onTarget(bedIso, wakeIso) {
  const t = getSetting('sleep');
  return diffMin(clockOf(bedIso), toMin(t.bed)) <= TOLERANCE && diffMin(clockOf(wakeIso), toMin(t.wake)) <= TOLERANCE;
}

export function nightLabel(e) {
  const w = new Date(e.data.wake), b = new Date(e.data.bed);
  const prev = new Date(w.getTime() - DAY);
  return `${WD[prev.getDay()]} → ${WD[w.getDay()]} · ${fromMin(clockOf(b))} – ${fromMin(clockOf(w))}`;
}

export function saveNight(d) {
  const { bed, wake, minutes } = nightTimes(d.bed, d.wake, d.date);
  if (minutes < 60 || minutes > 20 * 60) throw new Error('Bitte die Zeiten prüfen');
  const regular = onTarget(bed.toISOString(), wake.toISOString());
  const data = { bed: bed.toISOString(), wake: wake.toISOString(), minutes, wakeups: d.wakeups, quality: d.quality, note: d.note.trim(), regular };
  const label = `Nacht ${fromMin(clockOf(data.bed))} – ${fromMin(clockOf(data.wake))}${regular ? ', im Rhythmus' : ''}`;
  const points = regular ? 30 : 10;
  if (d.id) updateEntry(d.id, { ts: data.wake, label, points, data });
  else addEntry({ type: 'schlaf', ts: data.wake, label, points, data });
  return { regular, points };
}

export function nightLoggedToday() {
  return !!findEntry(e => e.type === 'schlaf' && dayKey(new Date(e.data.wake)) === dayKey());
}

export function nightDraftFrom(id) {
  const t = getSetting('sleep');
  if (id && id !== 'neu') {
    const e = findEntry(x => x.id === id && x.type === 'schlaf');
    if (!e) return null;
    const w = new Date(e.data.wake);
    return { id: e.id, date: localDate(w), bed: fromMin(clockOf(e.data.bed)), wake: fromMin(clockOf(e.data.wake)), wakeups: e.data.wakeups || 0, quality: e.data.quality || 'mittel', note: e.data.note || '' };
  }
  return { id: null, date: localDate(new Date()), bed: t.bed, wake: t.wake, wakeups: 0, quality: 'gut', note: '' };
}

const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// --- Auswertung -------------------------------------------------------------------------------

export function stats(days = 7) {
  const since = Date.now() - days * DAY;
  const list = nights().filter(e => new Date(e.data.wake).getTime() >= since);
  if (!list.length) return null;
  const avg = f => list.reduce((s, e) => s + f(e), 0) / list.length;
  return {
    count: list.length,
    minutes: avg(e => e.data.minutes),
    wakeups: avg(e => e.data.wakeups || 0),
    regular: Math.round(list.filter(e => onTarget(e.data.bed, e.data.wake)).length / list.length * 100),
  };
}

// Montag bis Sonntag der laufenden Woche: Abweichung der Aufstehzeit vom Ziel
function weekBars() {
  const today = new Date();
  const wd = (today.getDay() + 6) % 7;
  const target = toMin(getSetting('sleep.wake'));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (wd - i) * DAY);
    const key = localDate(d);
    const e = nights().find(n => localDate(new Date(n.data.wake)) === key);
    const dev = e ? diffMin(clockOf(e.data.wake), target) : null;
    return { label: WD[d.getDay()], dev, future: i > wd };
  });
}

// --- Ansicht: Schlafrhythmus -------------------------------------------------------------------

export function viewSchlaf(eveningTasks, isDone) {
  const t = getSetting('sleep');
  const st = stats();
  const bars = weekBars();
  const inBed = (toMin(t.wake) - toMin(t.bed) + 1440) % 1440;
  const list = nights().slice(0, 14);
  return `
    <header class="head"><div class="head-title"><h1>Schlafrhythmus</h1><div class="sub">Ziel: ${t.bed} bis ${t.wake} · gleiche Zeiten an allen 7 Tagen</div></div>
      <a class="btn btn-small" href="#einstellungen">Ziel ändern</a></header>

    <div class="grid-3">
      <div class="card card-tight"><div class="card-label">Ø Schlaf</div><div class="card-value" style="font-size:18px">${st ? durationLabel(st.minutes) : '–'}</div></div>
      <div class="card card-tight"><div class="card-label">Ø wach</div><div class="card-value" style="font-size:18px">${st ? `${formatNumber(st.wakeups, 1)} ×` : '–'}</div></div>
      <div class="card card-tight"><div class="card-label">Im Rhythmus</div><div class="card-value ${st && st.regular >= 70 ? 'good' : ''}" style="font-size:18px">${st ? `${st.regular} %` : '–'}</div></div>
    </div>
    <p class="hint small" style="margin-top:-6px;padding:0 2px">Durchschnitt der letzten 7 Tage. Im Rhythmus heißt: Schlafen und Aufstehen höchstens 30 Minuten neben deinem Ziel.</p>

    <a class="btn-sos" href="#nacht/neu" style="background:var(--accent-bg);color:var(--accent-text);text-decoration:none">${icon('plus')} ${nightLoggedToday() ? 'Weitere Nacht eintragen' : 'Letzte Nacht eintragen'}</a>

    <section class="card">
      <div class="row-between"><h2>Aufstehzeit diese Woche</h2><span class="sub">Anker ${t.wake}</span></div>
      <div class="weekbars" role="img" aria-label="Abweichung der Aufstehzeit pro Tag">${bars.map(b => {
        const h = b.dev == null ? 6 : Math.max(10, 56 - Math.min(b.dev, 120) / 120 * 46);
        const cls = b.dev == null ? 'none' : b.dev <= TOLERANCE ? 'ok' : 'off';
        return `<div title="${b.label}: ${b.dev == null ? 'kein Eintrag' : `${b.dev} Min. Abweichung`}"><span class="wb ${cls}" style="height:${h}px"></span><span>${b.label}</span></div>`;
      }).join('')}</div>
      <p class="hint small" style="margin-top:6px">Grün: Aufstehzeit höchstens 30 Minuten neben ${t.wake} · je höher, desto genauer</p>
    </section>

    <h2 class="section-title">Heute Abend</h2>
    <div class="list">${eveningTasks.map(task => {
      const done = isDone(task);
      return `<button type="button" class="list-item ${done ? 'task-done' : ''}" data-action="toggle-task" data-task="${task.id}" aria-pressed="${done}">
        <span class="check">${icon(done ? 'check' : 'circle', 'check')}</span>
        <span class="list-main"><span class="list-title">${esc(task.title)}</span><div class="sub">${task.time} Uhr</div></span>
        <span class="list-points">+${task.points}</span></button>`;
    }).join('')}</div>

    <h2 class="section-title">Deine Nächte</h2>
    <div class="list">${list.length ? list.map(e => `
      <div class="list-item">
        <a class="list-main" href="#nacht/${esc(e.id)}" style="color:inherit;text-decoration:none"><span class="list-title">${esc(nightLabel(e))}</span>
          <div class="sub">${durationLabel(e.data.minutes)} · ${e.data.wakeups || 0} × wach · ${esc(QUALITY.find(q => q.id === e.data.quality)?.label || '')}${e.data.note ? ` · ${esc(e.data.note)}` : ''}</div></a>
        <button type="button" class="trash" data-action="delete-entry" data-id="${esc(e.id)}" aria-label="Nacht löschen">${icon('trash')}</button>
      </div>`).join('') : '<div class="list-empty">Noch keine Nacht eingetragen.</div>'}</div>

    <section class="card">
      <h2>Gut zu wissen</h2>
      <ul class="tips">
        <li><strong>Regelmäßigkeit zählt mehr als die Dauer.</strong> Gleiche Zeiten – auch am Wochenende – sagen die Gesundheit besser voraus als die Schlafdauer.</li>
        <li><strong>Licht nach dem Aufstehen</strong> stellt die innere Uhr nach vorn, <strong>helle Bildschirme am Abend</strong> nach hinten.</li>
        <li><strong>Koffein</strong> noch 6 Stunden vor dem Schlafen verkürzt den Schlaf messbar – darum der letzte Kaffee um ${fromMin(toMin(t.bed) - 7 * 60)} Uhr.</li>
        <li><strong>Nach dem Rauchstopp</strong> schläft man oft ein paar Wochen schlechter. Das gehört zum Entzug und geht vorbei.</li>
        ${inBed > 9 * 60 ? `<li><strong>Dein Ziel sind ${durationLabel(inBed)} im Bett.</strong> Empfohlen sind 7–9 Stunden Schlaf. Wenn du magst, verschiebe die Aufstehzeit später in 15-Minuten-Schritten nach vorn.</li>` : ''}
      </ul>
      <ul class="sources">${SLEEP_SOURCES.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    </section>`;
}

// --- Ansicht: Nacht eintragen ------------------------------------------------------------------

export function viewNightForm(d) {
  if (!d) return '<header class="head"><a class="back" href="#schlaf">‹ Schlaf</a></header><section class="card">Diesen Eintrag gibt es nicht mehr.</section>';
  let dur = '–';
  try { const n = nightTimes(d.bed, d.wake, d.date); dur = durationLabel(n.minutes); } catch { /* unvollständig */ }
  return `
    <header class="head"><div class="head-title"><a class="back" href="#schlaf">${icon('chevronLeft', 'icon icon-sm')} Schlaf</a><h1>${d.id ? 'Nacht bearbeiten' : 'Letzte Nacht'}</h1></div></header>
    <section class="card form-stack">
      <div class="field"><label for="nd-date">Aufgestanden am</label><input class="input" id="nd-date" type="date" data-nd="date" value="${esc(d.date)}"></div>
      <div class="form-grid">
        <div class="field"><label for="nd-bed">Schlafen gegangen</label><input class="input" id="nd-bed" type="time" data-nd="bed" value="${esc(d.bed)}"></div>
        <div class="field"><label for="nd-wake">Aufgestanden</label><input class="input" id="nd-wake" type="time" data-nd="wake" value="${esc(d.wake)}"></div>
      </div>
      <div class="kcal-box"><span>Schlafdauer, automatisch berechnet</span><strong id="nd-duration">${dur}</strong></div>
      <div class="field"><span class="label">Wie oft bist du nachts aufgewacht?</span>
        <div class="logger" style="grid-template-columns:52px 80px 52px;justify-content:center">
          <button type="button" class="stepper" data-action="nd-wakeups" data-delta="-1" aria-label="Weniger">−</button>
          <input class="input rep-input" value="${d.wakeups}" readonly aria-label="Anzahl Aufwachen">
          <button type="button" class="stepper" data-action="nd-wakeups" data-delta="1" aria-label="Mehr">+</button></div></div>
      <div class="field"><span class="label">Wie hast du geschlafen?</span>
        <div class="segmented" role="group">${QUALITY.map(q => `<button type="button" data-action="nd-quality" data-quality="${q.id}" aria-pressed="${d.quality === q.id}">${q.label}</button>`).join('')}</div></div>
      <div class="field"><label for="nd-note">Notiz, optional</label><input class="input" id="nd-note" data-nd="note" value="${esc(d.note)}" maxlength="80" placeholder="Spät noch Kaffee getrunken"></div>
    </section>
    <button type="button" class="btn btn-primary btn-block" data-action="nd-save">Speichern</button>
    <p class="hint small" style="text-align:center">Im Rhythmus (±30 Minuten): +30 Punkte, sonst +10 fürs Eintragen.</p>`;
}

export function durationFor(d) {
  try { return durationLabel(nightTimes(d.bed, d.wake, d.date).minutes); } catch { return '–'; }
}
