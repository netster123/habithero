// Bereich Training: Liegestütze, Kniebeugen und Klimmzüge zu Hause, jeweils mit Stufen.
import { getSetting, setSetting, entries, addEntry } from './store.js';
import { dayKey, weekday, formatNumber } from './time.js';
import { icon } from './icons.js';
import { esc } from './util.js';

const DAY = 864e5;
export const TRAINING_DAYS = [1, 3, 5]; // Mo, Mi, Fr
export const REST_OPTIONS = [60, 90, 120, 180];
export const WEEKLY_SET_TARGET = 10;

// sets: Anzahl Sätze, target: Ziel pro Satz, unit: 'Wdh.' oder 'Sek.'
export const EXERCISES = [
  {
    id: 'liegestuetze', name: 'Liegestütze', stages: [
      { name: 'An der Wand', sets: 3, target: 15, unit: 'Wdh.', how: 'Hände schulterbreit an die Wand, Körper gerade, Brust bis kurz vor die Wand.' },
      { name: 'Erhöht', sets: 3, target: 12, unit: 'Wdh.', how: 'Hände auf Tisch oder Stuhllehne. Je tiefer die Ablage, desto schwerer.' },
      { name: 'Auf den Knien', sets: 3, target: 12, unit: 'Wdh.', how: 'Knie am Boden, Körper von Knie bis Kopf eine Linie.' },
      { name: 'Normal', sets: 3, target: 8, unit: 'Wdh.', how: 'Klassischer Liegestütz, Brust bis knapp über den Boden.' },
      { name: 'Normal, mehr Wiederholungen', sets: 3, target: 15, unit: 'Wdh.', how: 'Saubere Ausführung, ruhiges Tempo nach unten.' },
      { name: 'Füße erhöht', sets: 3, target: 12, unit: 'Wdh.', how: 'Füße auf Stuhl oder Sofa, das verschiebt mehr Gewicht auf die Arme.' },
    ],
  },
  {
    id: 'kniebeugen', name: 'Kniebeugen', stages: [
      { name: 'Halbe Tiefe', sets: 3, target: 15, unit: 'Wdh.', how: 'Füße schulterbreit, Po nach hinten, bis die Oberschenkel etwa halb unten sind.' },
      { name: 'Volle Tiefe', sets: 3, target: 12, unit: 'Wdh.', how: 'So tief, wie es mit geradem Rücken geht, Fersen bleiben am Boden.' },
      { name: 'Volle Tiefe, mehr Wiederholungen', sets: 3, target: 20, unit: 'Wdh.', how: 'Gleichmäßiges Tempo, unten kurz kontrolliert umkehren.' },
      { name: 'Mit Pause unten', sets: 3, target: 15, unit: 'Wdh.', how: 'Unten 3 Sekunden halten, dann kraftvoll hoch.' },
      { name: 'Bulgarische Kniebeuge', sets: 3, target: 10, unit: 'Wdh. je Bein', how: 'Hinterer Fuß auf einem Stuhl, mit dem vorderen Bein tief beugen.' },
    ],
  },
  {
    id: 'klimmzuege', name: 'Klimmzüge', stages: [
      { name: 'Hängen', sets: 3, target: 30, unit: 'Sek.', how: 'Mit gestreckten Armen an der Stange hängen, Schultern aktiv.' },
      { name: 'Schulterblätter ziehen', sets: 3, target: 10, unit: 'Wdh.', how: 'Im Hang die Schulterblätter nach unten ziehen, Arme bleiben gestreckt.' },
      { name: 'Negative Klimmzüge', sets: 3, target: 5, unit: 'Wdh.', how: 'Hochspringen oder mit Stuhl hoch, dann 5 Sekunden langsam ablassen.' },
      { name: 'Der erste Klimmzug', sets: 3, target: 1, unit: 'Wdh.', how: 'Ein sauberer Klimmzug, Kinn über die Stange. Danach weiter negative Klimmzüge.' },
      { name: 'Klimmzüge 3 × 3', sets: 3, target: 3, unit: 'Wdh.', how: 'Saubere Klimmzüge ohne Schwung.' },
      { name: 'Klimmzüge 3 × 5', sets: 3, target: 5, unit: 'Wdh.', how: 'Saubere Klimmzüge ohne Schwung.' },
      { name: 'Klimmzüge 3 × 8', sets: 3, target: 8, unit: 'Wdh.', how: 'Saubere Klimmzüge ohne Schwung. Stark!' },
    ],
  },
];
export const exerciseById = id => EXERCISES.find(e => e.id === id);
const FIRST_PULLUP_STAGE = 3;

// Aktuelle Stufe ergibt sich aus dem letzten Stufen-Eintrag – löscht man ihn, gilt wieder die vorige.
export function currentStage(exId) {
  const last = entries('stufe').find(e => e.data.exercise === exId);
  const ex = exerciseById(exId);
  return last ? Math.min(ex.stages.length - 1, Math.max(0, last.data.to)) : 0;
}

export function setStage(exId, to, { levelUp = false } = {}) {
  const ex = exerciseById(exId);
  const from = currentStage(exId);
  // Sätze von heute zählen nicht noch einmal für die neue Stufe
  const d = draft();
  if (d) setSetting('trainingDraft', { ...d, levelled: { ...(d.levelled || {}), [exId]: true } });
  addEntry({
    type: 'stufe',
    label: levelUp ? `${ex.name}: aufgestiegen auf Stufe ${to + 1} – ${ex.stages[to].name}` : `${ex.name}: Stufe ${to + 1} gewählt`,
    points: levelUp ? 100 : 0,
    data: { exercise: exId, from, to },
  });
}

// --- Laufendes Training ----------------------------------------------------------

export function draft() {
  const d = getSetting('trainingDraft');
  return d && d.day === dayKey() ? d : null;
}

export function logSet(exId, value) {
  const d = draft() || { day: dayKey(), startedAt: new Date().toISOString(), sets: {} };
  const sets = { ...d.sets, [exId]: [...(d.sets[exId] || []), value] };
  setSetting('trainingDraft', { ...d, sets, restUntil: Date.now() + getSetting('restSeconds') * 1000 });
}

export function undoSet(exId) {
  const d = draft();
  if (!d || !d.sets[exId]?.length) return;
  setSetting('trainingDraft', { ...d, sets: { ...d.sets, [exId]: d.sets[exId].slice(0, -1) }, restUntil: 0 });
}

export function skipRest() {
  const d = draft();
  if (d) setSetting('trainingDraft', { ...d, restUntil: 0 });
}

export function finishTraining() {
  const d = draft();
  const sets = d ? Object.values(d.sets).reduce((n, s) => n + s.length, 0) : 0;
  if (!sets) return false;
  const parts = EXERCISES.filter(ex => d.sets[ex.id]?.length).map(ex => {
    const st = ex.stages[currentStage(ex.id)];
    return `${ex.name} ${d.sets[ex.id].join('/')}${st.unit === 'Sek.' ? ' Sek.' : ''}`;
  });
  const extra = trainedToday(); // Punkte gibt es einmal pro Tag
  addEntry({
    type: 'sport', label: `${extra ? 'Zusatztraining' : 'Training'}: ${parts.join(', ')}`, points: extra ? 0 : 100,
    data: { kind: 'training', day: dayKey(), sets: d.sets, stages: Object.fromEntries(EXERCISES.map(e => [e.id, currentStage(e.id)])) },
  });
  setSetting('trainingDraft', null);
  return extra ? 'extra' : 'ok';
}

export function trainedToday() {
  return entries('sport').some(e => e.data.kind === 'training' && e.data.day === dayKey());
}

function weekStart(now = new Date()) {
  const wd = (weekday(now) + 6) % 7; // Montag = 0
  return dayKey(new Date(now.getTime() - wd * DAY));
}

export function weekStats() {
  const start = weekStart();
  const sessions = entries('sport').filter(e => e.data.kind === 'training' && e.data.day >= start);
  const sets = Object.fromEntries(EXERCISES.map(ex => [ex.id, 0]));
  sessions.forEach(s => EXERCISES.forEach(ex => { sets[ex.id] += (s.data.sets?.[ex.id] || []).length; }));
  const d = draft();
  if (d) EXERCISES.forEach(ex => { sets[ex.id] += (d.sets[ex.id] || []).length; });
  return { sessions: sessions.length, sets };
}

// --- Ansicht --------------------------------------------------------------------------

function restCard(d) {
  if (!d?.restUntil || d.restUntil <= Date.now()) return '';
  const left = Math.ceil((d.restUntil - Date.now()) / 1000);
  return `<section class="card rest" aria-live="polite">
    <div><div class="card-label">Satzpause</div><div class="card-value" id="rest-timer">${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</div></div>
    <button type="button" class="btn btn-small" data-action="skip-rest">Überspringen</button>
  </section>`;
}

function exerciseCard(ex, d) {
  const idx = currentStage(ex.id);
  const st = ex.stages[idx];
  const done = d?.sets[ex.id] || [];
  const allHit = !d?.levelled?.[ex.id] && done.length >= st.sets && done.slice(0, st.sets).every(v => v >= st.target);
  const next = idx + 1 < ex.stages.length ? ex.stages[idx + 1] : null;
  const step = st.unit === 'Sek.' ? 5 : 1;
  const pullupBar = ex.id === 'klimmzuege' && idx < FIRST_PULLUP_STAGE ? `
    <div class="sub" style="margin-top:10px">Weg zum ersten Klimmzug</div>
    <div class="progress"><span style="width:${Math.round(idx / FIRST_PULLUP_STAGE * 100)}%;background:var(--level-text)"></span></div>` : '';

  return `<section class="card exercise" id="ex-${ex.id}">
    <div class="row-between" style="align-items:flex-start">
      <h2>${esc(ex.name)}</h2>
      <span class="badge badge-level">Stufe ${idx + 1}: ${esc(st.name)}</span>
    </div>
    <p class="hint" style="margin-top:6px">${esc(st.how)} Ziel: ${st.sets} × ${st.target} ${esc(st.unit)}, jeweils bis kurz vor die Erschöpfung.</p>
    <div class="sets">
      ${Array.from({ length: Math.max(st.sets, done.length) }, (_, i) => {
        const v = done[i];
        return v === undefined
          ? `<span class="set set-open">Satz ${i + 1}</span>`
          : `<span class="set ${v >= st.target ? 'set-hit' : 'set-done'}">${v}</span>`;
      }).join('')}
    </div>
    <div class="logger">
      <button type="button" class="stepper" data-action="rep-step" data-ex="${ex.id}" data-delta="-${step}" aria-label="Weniger">−</button>
      <input class="input rep-input" type="number" inputmode="numeric" min="0" step="${step}" value="${done.length ? done[done.length - 1] : st.target}" id="reps-${ex.id}" aria-label="${esc(st.unit)} im Satz">
      <button type="button" class="stepper" data-action="rep-step" data-ex="${ex.id}" data-delta="${step}" aria-label="Mehr">+</button>
      <button type="button" class="btn btn-primary" data-action="log-set" data-ex="${ex.id}">Satz speichern</button>
    </div>
    ${done.length ? `<button type="button" class="link" data-action="undo-set" data-ex="${ex.id}">Letzten Satz löschen</button>` : ''}
    ${allHit && next ? `<div class="levelup">
        <span>Stark! Alle Sätze geschafft. Bereit für <strong>Stufe ${idx + 2}: ${esc(next.name)}</strong>?</span>
        <button type="button" class="btn btn-small btn-primary" data-action="stage-up" data-ex="${ex.id}">Aufsteigen · +100</button></div>` : ''}
    ${pullupBar}
    <details class="ladder"><summary>Alle Stufen ansehen</summary>
      <ol>${ex.stages.map((s, i) => `<li class="${i === idx ? 'current' : i < idx ? 'past' : ''}">
        <span><strong>${esc(s.name)}</strong> · ${s.sets} × ${s.target} ${esc(s.unit)}</span>
        ${i === idx ? '<span class="sub">aktuell</span>' : `<button type="button" class="link" data-action="choose-stage" data-ex="${ex.id}" data-stage="${i}">Wählen</button>`}
      </li>`).join('')}</ol>
    </details>
  </section>`;
}

export function viewTraining() {
  const d = draft();
  const ws = weekStats();
  const isDay = TRAINING_DAYS.includes(weekday());
  const doneToday = trainedToday();
  const totalSets = d ? Object.values(d.sets).reduce((n, s) => n + s.length, 0) : 0;

  return `
    <header class="head"><div class="head-title"><h1>Training</h1>
      <div class="sub">${ws.sessions} von 3 Einheiten diese Woche · Mo, Mi, Fr</div></div></header>
    ${doneToday ? `<section class="card" style="background:var(--accent-bg);border-color:transparent;color:var(--accent-text)">
        <h2>Heute schon trainiert</h2><p style="margin-top:4px;font-size:14px">Gut gemacht. Muskeln wachsen in der Pause – gönn dir die Erholung.</p></section>`
      : !isDay ? `<section class="card"><h2>Heute ist Ruhetag</h2><p class="hint" style="margin-top:4px">Ein Sport-Snack reicht. Wenn du Lust hast, kannst du trotzdem trainieren.</p></section>` : ''}
    ${restCard(d)}
    ${EXERCISES.map(ex => exerciseCard(ex, d)).join('')}
    <button type="button" class="btn-sos" style="background:var(--accent-bg);color:var(--accent-text)" data-action="finish-training">
      ${icon('check')} ${doneToday ? 'Zusatztraining speichern' : 'Training abschließen · +100 Punkte'}</button>
    ${totalSets ? '' : '<p class="hint" style="text-align:center;margin-top:-6px">Speichere mindestens einen Satz, um das Training abzuschließen.</p>'}

    <section class="card">
      <h2>Sätze diese Woche</h2>
      <p class="hint" style="margin:4px 0 8px">Für Muskelaufbau sind etwa ${WEEKLY_SET_TARGET} Sätze pro Muskelgruppe und Woche ideal (Schoenfeld et al., Journal of Sports Sciences 2017).</p>
      ${EXERCISES.map(ex => `<div style="margin-top:8px"><div class="row-between"><span>${esc(ex.name)}</span><span class="sub">${ws.sets[ex.id]} / ${WEEKLY_SET_TARGET}</span></div>
        <div class="progress"><span style="width:${Math.min(100, Math.round(ws.sets[ex.id] / WEEKLY_SET_TARGET * 100))}%"></span></div></div>`).join('')}
    </section>

    <section class="card">
      <h2>Satzpause</h2>
      <div class="chips" style="margin-top:8px">${REST_OPTIONS.map(s => `
        <button type="button" class="chip" data-action="set" data-path="restSeconds" data-value="${s}" data-kind="number" aria-pressed="${getSetting('restSeconds') === s}">${s < 120 ? `${s} Sek.` : `${formatNumber(s / 60)} Min.`}</button>`).join('')}</div>
      <p class="hint" style="margin-top:8px">Längere Pausen von 2–3 Minuten bringen beim Muskelaufbau mehr als sehr kurze (Schoenfeld et al., Journal of Strength and Conditioning Research 2016). Training mit dem eigenen Körpergewicht wirkt, wenn du jeden Satz bis kurz vor die Erschöpfung machst (Schoenfeld et al., Journal of Strength and Conditioning Research 2017).</p>
    </section>`;
}
