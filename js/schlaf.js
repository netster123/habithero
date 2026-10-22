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

// Tatsächlich geschlafen = Zeit im Bett minus wach gelegen (ältere Einträge ohne Wachzeit: Zeit im Bett)
export const sleepMinOf = e => e.data.sleepMin ?? e.data.minutes - (e.data.awakeMin || 0);
export const longestOf = e => e.data.longestMin ?? (e.data.wakeups ? null : sleepMinOf(e));
export const goalMinutes = () => { const t = getSetting('sleep'); return (toMin(t.wake) - toMin(t.bed) + 1440) % 1440; };

export function signedLabel(min) {
  const m = Math.round(Math.abs(min));
  if (m < 1) return 'genau im Ziel';
  const sign = min > 0 ? '+' : '−';
  return m < 60 ? `${sign}${m} Min.` : `${sign}${durationLabel(m)}`;
}

function clockDev(iso, target) {
  let d = clockOf(iso) - toMin(target);
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d; // positiv = später als geplant
}

export function saveNight(d) {
  const { bed, wake, minutes } = nightTimes(d.bed, d.wake, d.date);
  if (minutes < 60 || minutes > 20 * 60) throw new Error('Bitte die Zeiten prüfen');
  const awakeMin = Math.max(0, Number(d.awakeMin) || 0);
  if (awakeMin >= minutes) throw new Error('Die Wachzeit ist länger als die Zeit im Bett');
  const sleepMin = minutes - awakeMin;
  const noLongest = d.longestH === '' && d.longestM === '';
  const longestMin = d.wakeups > 0 ? (noLongest ? suggestLongest(d) : (Number(d.longestH) || 0) * 60 + (Number(d.longestM) || 0)) : sleepMin;
  if (d.wakeups > 0 && (longestMin <= 0 || longestMin > sleepMin)) throw new Error('Bitte die längste Schlafphase prüfen');
  const regular = onTarget(bed.toISOString(), wake.toISOString());
  const data = { bed: bed.toISOString(), wake: wake.toISOString(), minutes, sleepMin, awakeMin, longestMin, wakeups: d.wakeups, quality: d.quality, note: d.note.trim(), regular };
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
    const longest = longestOf(e);
    return {
      id: e.id, date: localDate(w), bed: fromMin(clockOf(e.data.bed)), wake: fromMin(clockOf(e.data.wake)), wakeups: e.data.wakeups || 0,
      awakeMin: e.data.awakeMin || 0, longestH: longest == null ? '' : Math.floor(longest / 60), longestM: longest == null ? '' : longest % 60,
      quality: e.data.quality || 'mittel', note: e.data.note || '',
    };
  }
  return { id: null, date: localDate(new Date()), bed: t.bed, wake: t.wake, wakeups: 0, awakeMin: 10, longestH: '', longestM: '', quality: 'gut', note: '' };
}

const localDate = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// --- Auswertung -------------------------------------------------------------------------------

export function stats(days = 7) {
  const since = Date.now() - days * DAY;
  const list = nights().filter(e => new Date(e.data.wake).getTime() >= since);
  if (!list.length) return null;
  const avg = f => list.reduce((s, e) => s + f(e), 0) / list.length;
  const withLongest = list.filter(e => longestOf(e) != null);
  return {
    count: list.length,
    minutes: avg(e => e.data.minutes),
    sleep: avg(sleepMinOf),
    longest: withLongest.length ? withLongest.reduce((t, e) => t + longestOf(e), 0) / withLongest.length : null,
    goalDiff: avg(sleepMinOf) - goalMinutes(),
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

export function sleepSeries(days) {
  const since = Date.now() - days * DAY;
  const list = nights().filter(e => new Date(e.data.wake).getTime() >= since).slice().reverse();
  return {
    values: list.map(e => Math.round(sleepMinOf(e) / 6) / 10),
    labels: list.map(e => { const w = new Date(e.data.wake); return `${WD[w.getDay()]}, ${w.getDate()}.${w.getMonth() + 1}.`; }),
  };
}

function lastNightCard(e) {
  const t = getSetting('sleep');
  const goal = goalMinutes();
  const sleep = sleepMinOf(e);
  const longest = longestOf(e);
  const bedDev = clockDev(e.data.bed, t.bed), wakeDev = clockDev(e.data.wake, t.wake);
  const devText = d => (Math.abs(d) <= 1 ? 'pünktlich' : `${Math.abs(d)} Min. ${d > 0 ? 'später' : 'früher'}`);
  return `<section class="card">
    <div class="row-between"><h2>Letzte Nacht</h2><a class="link" href="#nacht/${esc(e.id)}">Bearbeiten</a></div>
    <div class="night-grid">
      <div><div class="card-label">Tatsächlich geschlafen</div><div class="card-value">${durationLabel(sleep)}</div>
        <div class="sub ${sleep >= goal ? 'good' : ''}">Ziel ${durationLabel(goal)} · ${signedLabel(sleep - goal)}</div></div>
      <div><div class="card-label">Am Stück</div><div class="card-value">${longest == null ? '–' : durationLabel(longest)}</div>
        <div class="sub">längste Schlafphase</div></div>
      <div><div class="card-label">Wach geworden</div><div class="card-value">${e.data.wakeups || 0} ×</div>
        <div class="sub">${!e.data.wakeups ? 'durchgeschlafen' : e.data.awakeMin ? `${e.data.awakeMin} Min. wach gelegen` : 'Wachzeit nicht erfasst'}</div></div>
      <div><div class="card-label">Im Bett</div><div class="card-value">${durationLabel(e.data.minutes)}</div>
        <div class="sub">${fromMin(clockOf(e.data.bed))}–${fromMin(clockOf(e.data.wake))}</div></div>
    </div>
    <div class="goal-rows">
      <div class="row-between"><span>Ins Bett (Ziel ${t.bed})</span><span class="${Math.abs(bedDev) <= TOLERANCE ? 'good' : 'warn-text'}">${devText(bedDev)}</span></div>
      <div class="row-between"><span>Aufgestanden (Ziel ${t.wake})</span><span class="${Math.abs(wakeDev) <= TOLERANCE ? 'good' : 'warn-text'}">${devText(wakeDev)}</span></div>
    </div>
  </section>`;
}

// --- Ansicht: Schlafrhythmus -------------------------------------------------------------------

export function viewSchlaf(eveningTasks, isDone, range = 14, chartHtml = () => '') {
  const t = getSetting('sleep');
  const st = stats();
  const bars = weekBars();
  const inBed = (toMin(t.wake) - toMin(t.bed) + 1440) % 1440;
  const list = nights().slice(0, 14);
  return `
    <header class="head"><div class="head-title"><h1>Schlafrhythmus</h1><div class="sub">Ziel: ${t.bed} bis ${t.wake} · gleiche Zeiten an allen 7 Tagen</div></div>
      <a class="btn btn-small" href="#einstellungen">Ziel ändern</a></header>

    ${list.length ? lastNightCard(list[0]) : ''}

    <div class="grid-2">
      <div class="card card-tight"><div class="card-label">Ø geschlafen</div><div class="card-value" style="font-size:18px">${st ? durationLabel(st.sleep) : '–'}</div>
        <div class="sub">${st ? `${signedLabel(st.goalDiff)} zum Ziel` : ''}</div></div>
      <div class="card card-tight"><div class="card-label">Ø am Stück</div><div class="card-value" style="font-size:18px">${st?.longest != null ? durationLabel(st.longest) : '–'}</div></div>
      <div class="card card-tight"><div class="card-label">Ø wach</div><div class="card-value" style="font-size:18px">${st ? `${formatNumber(st.wakeups, 1)} ×` : '–'}</div></div>
      <div class="card card-tight"><div class="card-label">Im Rhythmus</div><div class="card-value ${st && st.regular >= 70 ? 'good' : ''}" style="font-size:18px">${st ? `${st.regular} %` : '–'}</div></div>
    </div>
    <p class="hint small" style="margin-top:-6px;padding:0 2px">Durchschnitt der letzten 7 Tage. Im Rhythmus heißt: Schlafen und Aufstehen höchstens 30 Minuten neben deinem Ziel.</p>

    <section class="card">
      <h2>Tatsächlich geschlafen</h2>
      <div class="chips" style="margin:10px 0 6px">${[7, 14, 30].map(n => `
        <button type="button" class="chip" data-action="sleep-range" data-range="${n}" aria-pressed="${n === range}">${n} Tage</button>`).join('')}</div>
      ${chartHtml(range)}
      <p class="hint small" style="margin-top:6px">Stunden pro Nacht ohne die Zeit, in der du wach gelegen hast. Gestrichelt: dein Ziel von ${durationLabel(inBed)}.</p>
    </section>

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
          <div class="sub">${durationLabel(sleepMinOf(e))} geschlafen${longestOf(e) != null && e.data.wakeups ? ` · am Stück ${durationLabel(longestOf(e))}` : ''} · ${e.data.wakeups || 0} × wach · ${esc(QUALITY.find(q => q.id === e.data.quality)?.label || '')}${e.data.note ? ` · ${esc(e.data.note)}` : ''}</div></a>
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
  dur = durationFor(d);
  return `
    <header class="head"><div class="head-title"><a class="back" href="#schlaf">${icon('chevronLeft', 'icon icon-sm')} Schlaf</a><h1>${d.id ? 'Nacht bearbeiten' : 'Letzte Nacht'}</h1></div></header>
    <section class="card form-stack">
      <div class="field"><label for="nd-date">Aufgestanden am</label><input class="input" id="nd-date" type="date" data-nd="date" value="${esc(d.date)}"></div>
      <div class="form-grid">
        <div class="field"><label for="nd-bed">Schlafen gegangen</label><input class="input" id="nd-bed" type="time" data-nd="bed" value="${esc(d.bed)}"></div>
        <div class="field"><label for="nd-wake">Aufgestanden</label><input class="input" id="nd-wake" type="time" data-nd="wake" value="${esc(d.wake)}"></div>
      </div>
      <div class="kcal-box"><span>Automatisch berechnet</span><strong id="nd-duration">${dur}</strong></div>
      <div class="field"><span class="label">Wie oft bist du nachts aufgewacht?</span>
        <div class="logger" style="grid-template-columns:52px 80px 52px;justify-content:center">
          <button type="button" class="stepper" data-action="nd-wakeups" data-delta="-1" aria-label="Weniger">−</button>
          <input class="input rep-input" value="${d.wakeups}" readonly aria-label="Anzahl Aufwachen">
          <button type="button" class="stepper" data-action="nd-wakeups" data-delta="1" aria-label="Mehr">+</button></div></div>
      <div class="field"><span class="label">Insgesamt wach gelegen, inklusive Einschlafen</span>
        <div class="logger" style="grid-template-columns:52px 100px 52px;justify-content:center">
          <button type="button" class="stepper" data-action="nd-awake" data-delta="-5" aria-label="5 Minuten weniger">−</button>
          <input class="input rep-input" value="${d.awakeMin} Min." readonly aria-label="Minuten wach">
          <button type="button" class="stepper" data-action="nd-awake" data-delta="5" aria-label="5 Minuten mehr">+</button></div></div>
      ${d.wakeups > 0 ? `<div class="field"><span class="label">Am längsten am Stück geschlafen</span>
        <div class="form-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">
          <div class="unit-input"><input class="input" type="number" inputmode="numeric" min="0" max="20" data-nd="longestH" value="${esc(d.longestH)}" placeholder="${Math.floor(suggestLongest(d) / 60)}" aria-label="Stunden"><span>Std.</span></div>
          <div class="unit-input"><input class="input" type="number" inputmode="numeric" min="0" max="59" step="5" data-nd="longestM" value="${esc(d.longestM)}" placeholder="${suggestLongest(d) % 60}" aria-label="Minuten"><span>Min.</span></div>
        </div><p class="hint small">Schätzen reicht. Ohne Angabe nimmt HabitHero den Vorschlag.</p></div>` : ''}
      <div class="field"><span class="label">Wie hast du geschlafen?</span>
        <div class="segmented" role="group">${QUALITY.map(q => `<button type="button" data-action="nd-quality" data-quality="${q.id}" aria-pressed="${d.quality === q.id}">${q.label}</button>`).join('')}</div></div>
      <div class="field"><label for="nd-note">Notiz, optional</label><input class="input" id="nd-note" data-nd="note" value="${esc(d.note)}" maxlength="80" placeholder="Spät noch Kaffee getrunken"></div>
    </section>
    <button type="button" class="btn btn-primary btn-block" data-action="nd-save">Speichern</button>
    <p class="hint small" style="text-align:center">Im Rhythmus (±30 Minuten): +30 Punkte, sonst +10 fürs Eintragen.</p>`;
}

export function durationFor(d) {
  try {
    const n = nightTimes(d.bed, d.wake, d.date);
    return `Im Bett ${durationLabel(n.minutes)} · geschlafen ${durationLabel(Math.max(0, n.minutes - (Number(d.awakeMin) || 0)))}`;
  } catch { return '–'; }
}

// Vorschlag für die längste Phase: geschlafene Zeit gleichmäßig auf die Phasen verteilt
export function suggestLongest(d) {
  try {
    const n = nightTimes(d.bed, d.wake, d.date);
    return Math.round((n.minutes - (Number(d.awakeMin) || 0)) / ((d.wakeups || 0) + 1) / 5) * 5;
  } catch { return 0; }
}
