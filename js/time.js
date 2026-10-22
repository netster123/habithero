// Ein „Tag“ in HabitHero beginnt um 05:00 Uhr, damit eine späte Nacht
// (Schlafen um 01:00) noch zum Vortag zählt.
export const DAY_START_HOUR = 5;

function pad(n) { return String(n).padStart(2, '0'); }

export function logicalDate(d = new Date()) {
  const x = new Date(d);
  x.setHours(x.getHours() - DAY_START_HOUR);
  return x;
}

export function dayKey(d = new Date()) {
  const x = logicalDate(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

export function dayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = dayKey();
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  if (key === today) return 'Heute';
  if (key === yesterday) return 'Gestern';
  return date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function longDate(d = new Date()) {
  return logicalDate(d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekday(d = new Date()) { return logicalDate(d).getDay(); } // 0 = Sonntag

export function clock(iso) {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Minuten seit Tagesbeginn (05:00), damit 00:30 nach 23:00 einsortiert wird
export function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return ((h - DAY_START_HOUR + 24) % 24) * 60 + m;
}

export function nowMinutesOfDay(d = new Date()) {
  return minutesOfDay(`${d.getHours()}:${d.getMinutes()}`);
}

export function greeting(wake = '12:00', d = new Date()) {
  const sinceWake = nowMinutesOfDay(d) - minutesOfDay(wake);
  const h = d.getHours();
  if (sinceWake >= 0 && sinceWake < 120) return 'Guten Morgen';
  if (h >= 0 && h < DAY_START_HOUR) return 'Gute Nacht';
  if (h >= 18) return 'Guten Abend';
  return 'Guten Tag';
}

export function formatNumber(n, digits = 0) {
  return Number(n).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatEuro(n) {
  return Number(n).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
