// Bereich Rauchfrei: Vorbereitung, Zähler, Zeitleiste, Sparziel und SOS Craving-Button.
import { getSetting, setSetting, entries, addEntry } from './store.js';
import { dayKey, dayLabel, formatNumber, formatEuro } from './time.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { lineChart } from './chart.js';

const HOUR = 36e5, DAY = 864e5;

// --- Auslöser und Wenn-Dann-Pläne ------------------------------------------

export const TRIGGERS = [
  { id: 'aufstehen', label: 'Nach dem Aufstehen', plan: 'Wenn ich aufstehe, dann gehe ich zuerst ans Fenster ins Tageslicht und trinke ein großes Glas Wasser.' },
  { id: 'kaffee', label: 'Kaffee', plan: 'Wenn ich Kaffee trinke, dann halte ich die Tasse in der rechten Hand und mache danach 10 Kniebeugen.' },
  { id: 'essen', label: 'Nach dem Essen', plan: 'Wenn ich mit dem Essen fertig bin, dann stehe ich sofort auf und putze mir die Zähne.' },
  { id: 'stress', label: 'Stress', plan: 'Wenn ich Stress spüre, dann drücke ich den SOS Craving-Button und atme drei Minuten mit.' },
  { id: 'langeweile', label: 'Langeweile', plan: 'Wenn mir langweilig ist, dann mache ich 10 Liegestütze oder gehe fünf Minuten raus.' },
  { id: 'pause', label: 'Pause', plan: 'Wenn ich eine Pause mache, dann trinke ich ein Glas Wasser und gehe ein paar Schritte.' },
  { id: 'handy', label: 'Am Handy', plan: 'Wenn ich am Handy bin, dann nehme ich etwas in die freie Hand, zum Beispiel einen Stift.' },
  { id: 'alkohol', label: 'Alkohol', plan: 'Wenn ich Alkohol trinke, dann halte ich in der anderen Hand ein Glas Wasser und bleibe bei den Nichtrauchern.' },
  { id: 'sonstiges', label: 'Sonstiges', plan: 'Wenn das Verlangen kommt, dann drücke ich den SOS Craving-Button.' },
];
const triggerById = id => TRIGGERS.find(t => t.id === id) || TRIGGERS[TRIGGERS.length - 1];

export function planFor(id) {
  return getSetting('plans')?.[id] || triggerById(id).plan;
}

// --- Berechnungen ---------------------------------------------------------------

export function quitState(now = Date.now()) {
  const q = getSetting('quitDate');
  if (!q) return { mode: 'vorbereitung' };
  const quit = new Date(q).getTime();
  if (quit > now) return { mode: 'countdown', quit };
  const slips = entries('rauchen').filter(e => e.data.slip && new Date(e.ts).getTime() >= quit);
  const lastSlip = slips.length ? new Date(slips[0].ts).getTime() : null;
  const streakStart = Math.max(quit, lastSlip || 0);
  const t = getSetting('tobacco');
  const days = (now - quit) / DAY;
  const perCig = (t.pricePerPack / t.daysPerPack) / t.cigsPerDay;
  const cigs = Math.max(0, days * t.cigsPerDay - slips.length);
  return {
    mode: 'rauchfrei', quit, streakStart, slips: slips.length,
    streakMs: now - streakStart,
    totalMs: now - quit,
    grams: Math.max(0, days * t.gramsPerPack / t.daysPerPack - slips.length * (t.gramsPerPack / t.daysPerPack / t.cigsPerDay)),
    euro: Math.max(0, days * t.pricePerPack / t.daysPerPack - slips.length * perCig),
    cigs,
  };
}

export function durationParts(ms) {
  const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / HOUR), m = Math.floor((ms % HOUR) / 6e4);
  return { d, h, m };
}

export function shortDuration(ms) {
  const { d, h, m } = durationParts(ms);
  if (d > 0) return `${d} T ${h} Std`;
  if (h > 0) return `${h} Std ${m} Min`;
  return `${m} Min`;
}

function remainingLabel(ms) {
  const d = ms / DAY;
  if (d >= 365) return `${formatNumber(d / 365, 1)} Jahre`;
  if (d >= 60) return `${Math.round(d / 30)} Monate`;
  return shortDuration(ms);
}

// --- Zeitleiste: was im Körper passiert --------------------------------------
// short: ab der letzten Zigarette gezählt; sonst ab dem Rauchstopp-Tag.

export const MILESTONES = [
  { id: 'm20', at: 20 / 60, short: true, points: 20, title: 'Puls und Blutdruck sinken',
    text: 'Die anregende Wirkung der letzten Zigarette auf Herzschlag und Blutdruck lässt nach.',
    source: 'Benowitz NL. Cigarette smoking and cardiovascular disease: pathophysiology and implications for treatment. Progress in Cardiovascular Diseases 2003;46(1):91–111.' },
  { id: 'h12', at: 12, short: true, points: 50, title: 'Kohlenmonoxid halbiert sich mehrfach',
    text: 'Kohlenmonoxid im Blut halbiert sich etwa alle 4–5 Stunden. Nach einem Tag liegt es nahe am Wert von Nichtrauchern.',
    source: 'Peterson JE, Stewart RD. Absorption and elimination of carbon monoxide by inactive young men. Archives of Environmental Health 1970;21(2):165–171.' },
  { id: 'd1', at: 24, short: true, points: 100, title: 'Nikotin ist abgebaut',
    text: 'Nikotin hat eine Halbwertszeit von etwa 2 Stunden. Nach einem Tag ist es weitgehend aus deinem Körper verschwunden.',
    source: 'Benowitz NL, Hukkanen J, Jacob P. Nicotine chemistry, metabolism, kinetics and biomarkers. Handbook of Experimental Pharmacology 2009;(192):29–60.' },
  { id: 'd4', at: 96, short: true, points: 150, title: 'Cotinin ist abgebaut',
    text: 'Auch Cotinin, das Abbauprodukt von Nikotin (Halbwertszeit etwa 16 Stunden), ist nach 3–4 Tagen weitgehend verschwunden.',
    source: 'Benowitz NL, Hukkanen J, Jacob P. Nicotine chemistry, metabolism, kinetics and biomarkers. Handbook of Experimental Pharmacology 2009;(192):29–60.' },
  { id: 'w1', at: 7 * 24, short: true, points: 200, title: 'Der Gipfel des Entzugs ist geschafft',
    text: 'Entzugssymptome sind in der ersten Woche am stärksten. Ab jetzt geht es bergab.',
    source: 'Hughes JR. Effects of abstinence from tobacco: valid symptoms and time course. Nicotine & Tobacco Research 2007;9(3):315–327.' },
  { id: 'w4', at: 28 * 24, short: true, points: 300, title: 'Die meisten Entzugssymptome klingen ab',
    text: 'Reizbarkeit, Unruhe und Schlafprobleme lassen nach 2–4 Wochen meist deutlich nach. Mehr Appetit kann länger bleiben – für deinen Muskelaufbau ein Vorteil.',
    source: 'Hughes JR. Effects of abstinence from tobacco: valid symptoms and time course. Nicotine & Tobacco Research 2007;9(3):315–327.' },
  { id: 'w6', at: 42 * 24, short: true, points: 300, title: 'Weniger Angst, Stress und Niedergeschlagenheit',
    text: 'Wer aufhört, fühlt sich danach im Schnitt psychisch besser – nicht schlechter.',
    source: 'Taylor G et al. Change in mental health after smoking cessation: systematic review and meta-analysis. BMJ 2014;348:g1151. Sowie: Taylor GMJ et al. Smoking cessation for improving mental health. Cochrane Database of Systematic Reviews 2021.' },
  { id: 'y1a', at: 365 * 24, short: false, points: 500, title: 'Deine Gefäße arbeiten besser',
    text: 'Die Gefäßfunktion verbessert sich innerhalb eines Jahres messbar.',
    source: 'Johnson HM et al. Effects of smoking and smoking cessation on endothelial function: 1-year outcomes from a randomized clinical trial. Journal of the American College of Cardiology 2010;55(18):1988–1995.' },
  { id: 'y1b', at: 365 * 24, short: false, points: 500, title: 'Deine Lunge erholt sich',
    text: 'Die Lungenfunktion verbessert sich im ersten Jahr; danach nimmt sie etwa halb so schnell ab wie bei Rauchern (untersucht bei Rauchern mit leichter Lungenerkrankung).',
    source: 'Scanlon PD et al. Smoking cessation and lung function in mild-to-moderate chronic obstructive pulmonary disease: the Lung Health Study. American Journal of Respiratory and Critical Care Medicine 2000;161(2):381–390.' },
  { id: 'y2', at: 2 * 365 * 24, short: false, points: 500, title: 'Dein Geruchssinn erholt sich',
    text: 'Der Geruchssinn erholt sich nach dem Rauchstopp schrittweise über Monate bis Jahre.',
    source: 'Frye RE, Schwartz BS, Doty RL. Dose-related effects of cigarette smoking on olfactory function. JAMA 1990;263(9):1233–1236.' },
  { id: 'y5a', at: 5 * 365 * 24, short: false, points: 1000, title: 'Herz-Kreislauf-Risiko deutlich gesenkt',
    text: 'Bei starken Rauchern sinkt das Risiko für Herz-Kreislauf-Erkrankungen innerhalb von 5 Jahren um etwa 39 % gegenüber Weiterrauchern.',
    source: 'Duncan MS et al. Association of smoking cessation with subsequent risk of cardiovascular disease. JAMA 2019;322(7):642–650.' },
  { id: 'y5b', at: 5 * 365 * 24, short: false, points: 1000, title: 'Schlaganfallrisiko wie bei Nichtrauchern',
    text: 'Das Schlaganfallrisiko nähert sich innerhalb von 5 Jahren dem von Nichtrauchern an.',
    source: 'Wolf PA et al. Cigarette smoking as a risk factor for stroke: the Framingham Study. JAMA 1988;259(7):1025–1029.' },
  { id: 'y10', at: 10 * 365 * 24, short: false, points: 1000, title: 'Lungenkrebsrisiko sinkt weiter',
    text: 'Das Lungenkrebsrisiko sinkt in den ersten 5–10 Jahren deutlich, bleibt aber über Jahrzehnte erhöht – jedes Jahr zählt.',
    source: 'Tindle HA et al. Lifetime smoking history and risk of lung cancer: results from the Framingham Heart Study. Journal of the National Cancer Institute 2018;110(11):1201–1207.' },
];

export const LIFE_GAIN = {
  text: 'Wer zwischen 45 und 54 Jahren aufhört, gewinnt im Schnitt etwa 6 Lebensjahre zurück.',
  source: 'Jha P et al. 21st-century hazards of smoking and benefits of cessation in the United States. New England Journal of Medicine 2013;368:341–350.',
};

function milestoneProgress(m, qs) {
  const ms = m.short ? qs.streakMs : qs.totalMs;
  const h = ms / HOUR;
  return { done: h >= m.at, remainingMs: Math.max(0, (m.at - h) * HOUR), pct: Math.min(1, h / m.at) };
}

// Punkte für erreichte Meilensteine einmalig vergeben
export function awardMilestones() {
  const qs = quitState();
  if (qs.mode !== 'rauchfrei') return [];
  const awarded = new Set(getSetting('awarded') || []);
  const fresh = MILESTONES.filter(m => !awarded.has(m.id) && milestoneProgress(m, qs).done);
  if (!fresh.length) return [];
  fresh.forEach(m => awarded.add(m.id));
  setSetting('awarded', [...awarded]);
  fresh.forEach(m => addEntry({ type: 'rauchfrei', label: `Meilenstein: ${m.title}`, points: m.points, data: { milestone: m.id } }));
  return fresh;
}

// --- SOS pro Tag -----------------------------------------------------------------

export function sosPerDay(n) {
  const counts = new Map();
  entries('sos').forEach(e => { const k = dayKey(new Date(e.ts)); counts.set(k, (counts.get(k) || 0) + 1); });
  const values = [], labels = [];
  for (let i = n - 1; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * DAY));
    values.push(counts.get(k) || 0);
    labels.push(i === 0 ? 'Heute' : i === 1 ? 'Gestern' : `Vor ${i} Tagen`);
  }
  return { values, labels };
}

// --- Ansichten -----------------------------------------------------------------

function sosButton() {
  return `<button type="button" class="btn-sos" data-action="sos">${icon('alert')} SOS Craving-Button</button>`;
}

function sosChartCard(range) {
  const { values, labels } = sosPerDay(range);
  const last7 = sosPerDay(14).values;
  const thisWeek = last7.slice(7).reduce((a, b) => a + b, 0);
  const prevWeek = last7.slice(0, 7).reduce((a, b) => a + b, 0);
  const change = prevWeek ? Math.round((thisWeek - prevWeek) / prevWeek * 100) : null;
  return `
    <section class="card">
      <h2>SOS Craving-Button pro Tag</h2>
      <div class="chips" style="margin:10px 0 6px">${[7, 14, 30].map(n => `
        <button type="button" class="chip" data-action="sos-range" data-range="${n}" aria-pressed="${n === range}">${n} Tage</button>`).join('')}</div>
      ${lineChart('sos', values, labels)}
      <div class="grid-3" style="margin-top:10px">
        <div class="mini"><div class="card-label">Heute</div><strong>${values[values.length - 1]}</strong></div>
        <div class="mini"><div class="card-label">Ø 7 Tage</div><strong>${formatNumber(thisWeek / 7, 1)}</strong></div>
        <div class="mini"><div class="card-label">zur Vorwoche</div><strong class="${change !== null && change <= 0 ? 'good' : ''}">${change === null ? '–' : `${change > 0 ? '+' : '−'}${Math.abs(change)} %`}</strong></div>
      </div>
    </section>`;
}

function plansCard(triggerIds) {
  if (!triggerIds.length) return '';
  return `
    <h2 class="section-title">Deine Wenn-Dann-Pläne</h2>
    <div class="list">${triggerIds.map(id => `
      <div class="list-item" style="align-items:flex-start;flex-direction:column;gap:6px">
        <span class="badge badge-accent">${esc(triggerById(id).label)}</span>
        <textarea class="input plan" rows="3" data-plan="${id}" aria-label="Plan für ${esc(triggerById(id).label)}">${esc(planFor(id))}</textarea>
      </div>`).join('')}
    </div>
    <p class="hint" style="padding:0 2px">Konkrete Wenn-Dann-Pläne helfen nachweislich, Vorsätze umzusetzen (Gollwitzer & Sheeran, Advances in Experimental Social Psychology 2006). Tippe in einen Plan, um ihn anzupassen.</p>`;
}

function topTriggers(list) {
  const counts = new Map();
  list.forEach(e => { const k = e.data.situation || 'sonstiges'; counts.set(k, (counts.get(k) || 0) + 1); });
  return [...counts].sort((a, b) => b[1] - a[1]);
}

function viewVorbereitung(qs, range) {
  const logs = entries('rauchen').filter(e => !e.data.slip);
  const today = logs.filter(e => dayKey(new Date(e.ts)) === dayKey()).length;
  const days = new Set(logs.map(e => dayKey(new Date(e.ts))));
  const first = logs.length ? logs[logs.length - 1].ts : null;
  const dayNo = first ? Math.min(7, Math.floor((Date.now() - new Date(first).getTime()) / DAY) + 1) : 0;
  const pastDays = [...days].filter(k => k !== dayKey());
  const avg = pastDays.length ? logs.filter(e => dayKey(new Date(e.ts)) !== dayKey()).length / pastDays.length : null;
  const top = topTriggers(logs);
  const total = logs.length || 1;

  const countdown = qs.mode === 'countdown' ? `
    <section class="card" style="background:var(--accent-bg);border-color:transparent;color:var(--accent-text)">
      <div class="card-label" style="color:inherit">Dein Rauchstopp beginnt in</div>
      <div class="card-value">${shortDuration(qs.quit - Date.now())}</div>
      <div class="sub" style="color:inherit">${new Date(qs.quit).toLocaleString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} Uhr</div>
    </section>` : '';

  return `
    <header class="head"><div class="head-title"><h1>Deine Rauch-Muster</h1>
      <div class="sub">${dayNo ? `Vorbereitung · Tag ${dayNo} von 7` : 'Vorbereitung'}</div></div></header>
    ${dayNo ? `<div class="progress" style="margin-top:-4px"><span style="width:${Math.round(dayNo / 7 * 100)}%;background:var(--sos)"></span></div>` : ''}
    ${countdown}
    <div class="grid-2">
      <div class="card card-tight"><div class="card-label">Heute erfasst</div><div class="card-value">${today}</div></div>
      <div class="card card-tight"><div class="card-label">Schnitt pro Tag</div><div class="card-value">${avg === null ? '–' : formatNumber(avg, 0)}</div></div>
    </div>
    <button type="button" class="btn-sos" data-action="log-cig" style="background:var(--surface);border:1px solid var(--border-strong);color:var(--text)">${icon('plus')} Zigarette erfassen</button>
    ${!logs.length ? `<section class="card"><h2>So funktioniert die Vorbereitung</h2>
      <p class="hint" style="margin-top:6px">Rauch ganz normal weiter und tippe bei jeder Zigarette auf „Zigarette erfassen“. Wähle kurz die Situation. Nach ein paar Tagen siehst du deine Top-Auslöser und bekommst passende Wenn-Dann-Pläne. Wer sein Verhalten festhält, ändert es leichter (Harkin et al., Psychological Bulletin 2016).</p></section>` : `
    <section class="card">
      <h2>Deine Top-Auslöser</h2>
      <div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">${top.slice(0, 5).map(([id, n]) => `
        <div><div class="row-between"><span>${esc(triggerById(id).label)}</span><span class="sub">${Math.round(n / total * 100)} %</span></div>
        <div class="progress" style="margin-top:4px"><span style="width:${Math.round(n / total * 100)}%;background:var(--sos)"></span></div></div>`).join('')}
      </div>
    </section>`}
    ${plansCard(top.slice(0, 3).map(([id]) => id))}
    ${sosButton()}
    <button type="button" class="btn btn-primary btn-block" data-action="quit-date">${icon('target', 'icon icon-sm')} ${qs.mode === 'countdown' ? 'Rauchstopp-Tag ändern' : 'Rauchstopp-Tag festlegen'}</button>
    <p class="hint" style="padding:0 2px">Sofort ganz aufhören klappt besser als langsam reduzieren: Nach 6 Monaten waren 22 % gegenüber 15,5 % rauchfrei (Lindson-Hawley et al., Annals of Internal Medicine 2016).</p>
    ${sosPerDay(30).values.some(v => v) ? sosChartCard(range) : ''}`;
}

function viewRauchfreiAktiv(qs, range) {
  const { d, h, m } = durationParts(qs.streakMs);
  const goal = getSetting('savingsGoal');
  const coffeeTip = qs.totalMs < 28 * DAY;
  const rows = MILESTONES.map(ms => {
    const p = milestoneProgress(ms, qs);
    const state = p.done ? 'done' : '';
    return `<details class="milestone ${state}">
      <summary>
        <span class="check">${icon(p.done ? 'check' : 'circle', 'check')}</span>
        <span class="list-main"><span class="list-title">${esc(ms.title)}</span>
          <div class="sub">${p.done ? 'Erreicht' : `noch ${remainingLabel(p.remainingMs)}`} · +${ms.points} Punkte</div></span>
        ${icon('info', 'icon icon-sm muted')}
      </summary>
      <div class="milestone-body"><p>${esc(ms.text)}</p><p class="source">Quelle: ${esc(ms.source)}</p></div>
    </details>`;
  }).join('');

  return `
    <header class="head"><div class="head-title"><h1>Rauchfrei</h1>
      <div class="sub">${qs.slips ? 'seit deiner letzten Zigarette' : `seit ${new Date(qs.quit).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}`}</div></div></header>
    <section class="card" style="text-align:center">
      <div class="hero-number">${d > 0 ? `${d}<small> ${d === 1 ? 'Tag' : 'Tage'}</small>` : `${h}<small> Std</small> ${m}<small> Min</small>`}</div>
      ${d > 0 ? `<div class="sub">und ${h} Std ${m} Min</div>` : ''}
    </section>
    <div class="grid-3">
      <div class="card card-tight"><div class="card-label">Tabak</div><div class="card-value" style="font-size:18px">${formatNumber(qs.grams)} g</div></div>
      <div class="card card-tight"><div class="card-label">Gespart</div><div class="card-value" style="font-size:18px">${formatEuro(qs.euro)}</div></div>
      <div class="card card-tight"><div class="card-label">Zigaretten</div><div class="card-value" style="font-size:18px">${formatNumber(qs.cigs)}</div></div>
    </div>
    ${sosButton()}
    ${sosChartCard(range)}
    ${coffeeTip ? `<section class="card"><h2>Tipp: weniger Kaffee</h2><p class="hint" style="margin-top:6px">Ohne Rauchen baut dein Körper Koffein deutlich langsamer ab, der Spiegel kann sich mehr als verdoppeln. Das macht nervös und fühlt sich an wie Entzug. Trink deshalb in den ersten Wochen weniger Kaffee als sonst (Benowitz et al., BMJ 1989).</p></section>` : ''}
    ${savingsCard(goal, qs.euro)}
    <h2 class="section-title">Was in deinem Körper passiert</h2>
    <div class="list">${rows}</div>
    <p class="hint" style="padding:0 2px">${esc(LIFE_GAIN.text)} <span class="muted">(${esc(LIFE_GAIN.source)})</span></p>
    ${plansCard(topTriggers(entries('rauchen').filter(e => !e.data.slip)).slice(0, 3).map(([id]) => id))}
    <button type="button" class="btn btn-block" data-action="quit-date">Rauchstopp-Tag ändern</button>`;
}

function savingsCard(goal, euro) {
  if (!goal.name || !goal.amount) {
    return `<section class="card"><h2>Sparziel</h2>
      <p class="hint" style="margin:6px 0 10px">Wofür sparst du das Tabakgeld? Zum Beispiel Hanteln oder neue Laufschuhe.</p>
      <div class="form-grid"><input class="input" id="goal-name" placeholder="Hanteln" maxlength="40">
      <input class="input" id="goal-amount" type="number" inputmode="decimal" min="1" step="1" placeholder="60 €"></div>
      <button type="button" class="btn btn-primary btn-block" style="margin-top:10px" data-action="save-goal">Sparziel speichern</button></section>`;
  }
  const pct = Math.min(1, euro / goal.amount);
  return `<section class="card">
    <div class="row-between"><h2>Sparziel: ${esc(goal.name)}</h2><button type="button" class="link" data-action="clear-goal">Ändern</button></div>
    <div class="progress"><span style="width:${Math.round(pct * 100)}%"></span></div>
    <div class="sub" style="margin-top:6px">${pct >= 1 ? `Geschafft! Gönn dir ${esc(goal.name)}.` : `${formatEuro(euro)} von ${formatEuro(goal.amount)} · noch ${formatEuro(goal.amount - euro)}`}</div>
  </section>`;
}

export function viewRauchfrei(range = 14) {
  const qs = quitState();
  return qs.mode === 'rauchfrei' ? viewRauchfreiAktiv(qs, range) : viewVorbereitung(qs, range);
}

// --- Bottom-Sheets ---------------------------------------------------------------

export function sheetLogCig() {
  return `<div class="dialog sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">In welcher Situation?</h2>
    <div class="chips" style="justify-content:center;margin:12px 0 16px">${TRIGGERS.map(t => `
      <button type="button" class="chip" data-situation="${t.id}">${esc(t.label)}</button>`).join('')}</div>
    <button type="button" class="btn btn-block" data-close>Abbrechen</button>
  </div>`;
}

export function sheetQuitDate() {
  const cur = getSetting('quitDate');
  const d = cur ? new Date(cur) : new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  return `<div class="dialog sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
    <h2 id="sh-t">Rauchstopp-Tag</h2>
    <p>Ab diesem Moment zählt HabitHero deine rauchfreie Zeit. Du kannst auch „Jetzt“ wählen.</p>
    <input class="input" type="datetime-local" id="quit-input" value="${local}" style="margin-bottom:12px">
    <div class="dialog-actions" style="grid-template-columns:1fr 1fr 1fr">
      <button type="button" class="btn" data-close>Abbrechen</button>
      <button type="button" class="btn" data-quit="now">Jetzt</button>
      <button type="button" class="btn btn-primary" data-quit="input">Festlegen</button>
    </div>
    ${cur ? '<button type="button" class="link" data-quit="clear" style="margin-top:14px">Rauchstopp-Tag entfernen</button>' : ''}
  </div>`;
}

// --- SOS Craving-Button --------------------------------------------------------

export const SOS_SECONDS = 180;
const DISTRACT = [
  'Trink langsam ein großes Glas Wasser.',
  'Geh kurz raus oder ans offene Fenster.',
  'Putz dir die Zähne.',
  'Schreib jemandem eine Nachricht.',
  'Iss etwas: ein Stück Obst oder ein paar Nüsse.',
  'Räum zwei Minuten lang etwas auf.',
];

export function viewSos(sos) {
  const mode = sos.mode;
  const remaining = Math.max(0, SOS_SECONDS - Math.floor((Date.now() - sos.start) / 1000));
  let body = '';
  if (mode === 'atmen') {
    body = `<div class="breath"><div class="breath-ring"><div class="breath-core"><strong id="breath-label">Einatmen</strong><span class="small">4 ein · 6 aus</span></div></div></div>`;
  } else if (mode === 'kniebeugen') {
    body = `<div class="breath"><button type="button" class="squat" data-action="squat" aria-label="Kniebeuge zählen">
      <strong>${sos.squats}</strong><span>von 15</span></button></div>
      <p class="hint" style="text-align:center">Tippe nach jeder Kniebeuge. Schon kurze Bewegung schwächt das Verlangen (Haasova et al., Addiction 2013).</p>`;
  } else {
    body = `<div class="list">${DISTRACT.map(t => `<div class="list-item">${icon('chevronRight', 'icon icon-sm muted')}<span class="list-main">${esc(t)}</span></div>`).join('')}</div>`;
  }
  return `
    <header class="head">
      <a class="icon-btn" href="#rauchfrei" aria-label="Schließen">${icon('x')}</a>
      <h2>Verlangen besiegen</h2><span style="width:40px"></span>
    </header>
    <div class="segmented" role="group">${[['atmen', 'Atmen'], ['kniebeugen', '15 Kniebeugen'], ['ablenkung', 'Ablenkung']].map(([id, l]) => `
      <button type="button" data-action="sos-mode" data-mode="${id}" aria-pressed="${mode === id}">${l}</button>`).join('')}</div>
    ${body}
    <div style="text-align:center"><div class="hero-number" id="sos-timer">${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}</div>
      <div class="sub" id="sos-sub">${remaining ? 'Restzeit' : 'Die Welle ist vorbei. Geschafft?'}</div></div>
    <section class="card"><p>Das Verlangen kommt in Wellen und flaut von selbst wieder ab. Du musst diese Welle nur aussitzen.</p></section>
    <button type="button" class="btn-sos" style="background:var(--accent-bg);color:var(--accent-text)" data-action="sos-done">${icon('check')} Überstanden · +50 Punkte</button>
    <button type="button" class="link" data-action="sos-smoked" style="align-self:center">Ich habe geraucht</button>`;
}

export function dayLabelFor(ts) { return dayLabel(dayKey(new Date(ts))); }
