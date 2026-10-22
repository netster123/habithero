// Punkte, Level und die Tagesaufgaben.
import { entries, findEntry, addEntry, removeEntry } from './store.js';
import { dayKey, weekday, minutesOfDay } from './time.js';
import { TRAINING_DAYS, trainedToday } from './training.js';
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


// Tagesplan passend zum Schlafrhythmus 01:00–12:00
export const TASKS = [
  { id: 'licht',    time: '12:15', title: 'Raus ans Tageslicht, 10 Min.', points: 20 },
  { id: 'snack1',   time: '15:00', title: 'Sport-Snack', points: 40 },
  { id: 'training', time: '19:00', title: 'Training: Liegestütze, Kniebeugen, Klimmzüge', points: 100, days: TRAINING_DAYS },
  { id: 'snack2',   time: '19:00', title: 'Sport-Snack', points: 40, notDays: TRAINING_DAYS },
  { id: 'dimmen',   time: '00:00', title: 'Bildschirm dimmen', points: 20 },
  { id: 'lichtaus', time: '01:00', title: 'Licht aus', points: 30 },
];

// Feste Aufgaben plus die Mahlzeiten aus deinem Plan im Bereich Essen
export function tasksForToday(now = new Date()) {
  const wd = weekday(now);
  const meals = mealsForToday().map(m => ({ id: `meal:${m.id}`, time: m.time, title: m.name, points: mealPoints(mealValues(m).kcal), meal: m }));
  return [...TASKS.filter(t => (!t.days || t.days.includes(wd)) && (!t.notDays || !t.notDays.includes(wd))), ...meals]
    .sort((a, b) => minutesOfDay(a.time) - minutesOfDay(b.time));
}

export function taskEntry(taskId, day = dayKey()) {
  return findEntry(e => e.type === 'aufgabe' && e.data.task === taskId && e.data.day === day);
}

// Die Trainings-Aufgabe gilt als erledigt, sobald im Bereich Training ein Training abgeschlossen wurde.
export function isTaskDone(task) {
  if (task.meal) return !!mealEntry(task.meal.id);
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
