// Punkte, Level und die Tagesaufgaben.
import { entries, findEntry, addEntry, removeEntry, getSetting } from './store.js';
import { dayKey, weekday, minutesOfDay } from './time.js';
import { TRAINING_DAYS, trainedToday } from './training.js';
import { nightLoggedToday, toMin, fromMin } from './schlaf.js';
import { mealsForToday, mealValues, mealPoints, mealEntry, toggleMeal } from './essen.js';

// Level n beginnt bei 75·(n−1)·n Punkten: Level 2 ab 150, Level 10 ab 6.750,
// Level 20 ab 28.500. Bei einem vollen Tag (~350 Punkte) dauert Level 20 etwa 10–12 Wochen,
// so lange, wie sich eine neue Gewohnheit im Schnitt festigt (Lally et al. 2010).
export function levelStart(n) { return 75 * (n - 1) * n; }

export function levelInfo(points) {
  let level = 1;
  while (points >= levelStart(level + 1)) level++;
  const start = levelStart(level);
  const next = levelStart(level + 1);
  return { level, points, start, next, into: points - start, span: next - start, pct: (points - start) / (next - start) };
}


// Tagesplan: Die Zeiten richten sich nach deinem Schlafrhythmus (Einstellungen → Schlafrhythmus)
export function taskList() {
  const wake = toMin(getSetting('sleep.wake') || '12:00');
  const bed = toMin(getSetting('sleep.bed') || '01:00');
  return [
    { id: 'nacht',    time: fromMin(wake + 5),  title: 'Letzte Nacht eintragen', points: 30, link: '#nacht/neu' },
    { id: 'licht',    time: fromMin(wake + 15), title: 'Raus ans Tageslicht, 10 Min.', points: 20 },
    { id: 'snack1',   time: fromMin(wake + 180), title: 'Sport-Snack', points: 40 },
    { id: 'training', time: fromMin(wake + 420), title: 'Training: Liegestütze, Kniebeugen, Klimmzüge', points: 100, days: TRAINING_DAYS, link: '#training' },
    { id: 'snack2',   time: fromMin(wake + 420), title: 'Sport-Snack', points: 40, notDays: TRAINING_DAYS },
    { id: 'kaffee',   time: fromMin(bed - 420), title: 'Letzter Kaffee für heute', points: 20, evening: true },
    { id: 'dimmen',   time: fromMin(bed - 60),  title: 'Bildschirm dimmen', points: 20, evening: true },
    { id: 'lichtaus', time: fromMin(bed),       title: 'Licht aus', points: 30, evening: true },
  ];
}

// Feste Aufgaben plus die Mahlzeiten aus deinem Plan im Bereich Essen
export function tasksForToday(now = new Date()) {
  const wd = weekday(now);
  const meals = mealsForToday().map(m => ({ id: `meal:${m.id}`, time: m.time, title: m.name, points: mealPoints(mealValues(m).kcal), meal: m }));
  return [...taskList().filter(t => (!t.days || t.days.includes(wd)) && (!t.notDays || !t.notDays.includes(wd))), ...meals]
    .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time));
}

export function taskEntry(taskId, day = dayKey()) {
  return findEntry(e => e.type === 'aufgabe' && e.data.task === taskId && e.data.day === day);
}

// Training und „Letzte Nacht“ gelten als erledigt, sobald sie im jeweiligen Bereich eingetragen sind.
export function isTaskDone(task) {
  if (task.meal) return !!mealEntry(task.meal.id);
  if (task.id === 'nacht') return nightLoggedToday();
  return task.id === 'training' ? trainedToday() : !!taskEntry(task.id);
}

export function toggleTask(task) {
  if (task.meal) return toggleMeal(task.meal);
  const existing = taskEntry(task.id);
  if (existing) { removeEntry(existing.id); return false; }
  addEntry({ type: 'aufgabe', label: task.title, points: task.points, data: { task: task.id, day: dayKey() } });
  return true;
}

export function pointsOnDay(day = dayKey()) {
  return entries().filter(e => dayKey(new Date(e.ts)) === day).reduce((s, e) => s + (Number(e.points) || 0), 0);
}
