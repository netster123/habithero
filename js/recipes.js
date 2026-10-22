// Eingebaute Rezepte: echte, bekannte und sehr einfache Gerichte.
// Zutaten verweisen auf Namen der Grundliste (data/foods-de.json), Mengen in Gramm für das ganze Rezept.
import { getSetting, setSetting } from './store.js';

export const CUISINES = [
  { id: 'indisch', label: 'Indisch' },
  { id: 'orientalisch', label: 'Orientalisch' },
  { id: 'salat', label: 'Salate' },
  { id: 'snack', label: 'Snacks' },
];
export const MAINS = [
  { id: 'rind', label: 'Rind' },
  { id: 'fisch', label: 'Fisch' },
  { id: 'veg', label: 'Vegetarisch' },
];

const r = (id, name, cuisine, main, portions, minutes, ingredients, steps) => ({ id, name, cuisine, main, portions, minutes, ingredients, steps, builtin: true });
const i = (food, grams, note = '') => ({ food, grams, note });

export const BUILTIN = [
  // Indisch
  r('dal', 'Masoor Dal mit Reis', 'indisch', 'veg', 2, 25, [
    i('Rote Linsen, roh', 200), i('Basmatireis, roh', 120), i('Gehackte Tomaten, Dose', 400), i('Zwiebel', 100),
    i('Knoblauch', 6, '2 Zehen'), i('Ingwer', 5), i('Kurkuma', 3), i('Kreuzkümmel', 2), i('Garam Masala (Werte wie Currypulver)', 2), i('Rapsöl', 28, '2 EL'), i('Salz', 3),
  ], ['Reis nach Packung kochen.', 'Zwiebel in Öl glasig dünsten, Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.', 'Linsen, Tomaten und 600 ml Wasser dazu, 15 Minuten köcheln, bis die Linsen zerfallen.', 'Salzen und mit Reis servieren.']),
  r('chana', 'Chana Masala mit Reis', 'indisch', 'veg', 2, 20, [
    i('Kichererbsen, Dose', 480, '2 Dosen, abgetropft'), i('Basmatireis, roh', 120), i('Gehackte Tomaten, Dose', 400), i('Zwiebel', 100),
    i('Knoblauch', 6, '2 Zehen'), i('Ingwer', 5), i('Garam Masala (Werte wie Currypulver)', 4), i('Kreuzkümmel', 2), i('Rapsöl', 28, '2 EL'), i('Koriander, frisch', 5), i('Salz', 3),
  ], ['Reis nach Packung kochen.', 'Zwiebel in Öl anbraten, Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.', 'Tomaten und Kichererbsen dazu, 10 Minuten köcheln, einige Kichererbsen leicht zerdrücken.', 'Salzen, mit Koriander bestreuen und mit Reis servieren.']),
  r('keema', 'Keema Matar mit Reis', 'indisch', 'rind', 1, 25, [
    i('Rinderhackfleisch', 150), i('Erbsen, tiefgekühlt', 100), i('Basmatireis, roh', 60), i('Gehackte Tomaten, Dose', 200), i('Zwiebel', 55, '½ Zwiebel'),
    i('Knoblauch', 3, '1 Zehe'), i('Ingwer', 3), i('Garam Masala (Werte wie Currypulver)', 2), i('Kurkuma', 2), i('Kreuzkümmel', 2), i('Salz', 2),
  ], ['Reis nach Packung kochen.', 'Zwiebel anbraten, Hack dazugeben und krümelig braten, bis es braun ist.', 'Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.', 'Tomaten und Erbsen dazu, 10 Minuten köcheln, salzen und mit Reis servieren.']),
  r('anda', 'Anda Curry (Eier-Curry) mit Reis', 'indisch', 'veg', 1, 25, [
    i('Ei', 180, '3 Eier'), i('Basmatireis, roh', 60), i('Gehackte Tomaten, Dose', 200), i('Zwiebel', 55, '½ Zwiebel'), i('Knoblauch', 3, '1 Zehe'),
    i('Ingwer', 3), i('Garam Masala (Werte wie Currypulver)', 2), i('Kurkuma', 2), i('Rapsöl', 14, '1 EL'), i('Salz', 2),
  ], ['Eier 9 Minuten hart kochen, pellen. Reis nach Packung kochen.', 'Zwiebel in Öl anbraten, Knoblauch, Ingwer und Gewürze kurz mitrösten.', 'Tomaten und einen Schuss Wasser dazu, 8 Minuten köcheln.', 'Eier halbieren, in die Soße legen, 2 Minuten ziehen lassen, salzen.']),
  r('fischcurry', 'Fisch-Curry mit Kokosmilch', 'indisch', 'fisch', 2, 25, [
    i('Kabeljau', 400), i('Kokosmilch', 300), i('Basmatireis, roh', 120), i('Gehackte Tomaten, Dose', 200), i('Zwiebel', 100),
    i('Knoblauch', 6, '2 Zehen'), i('Ingwer', 5), i('Currypulver', 4), i('Kurkuma', 2), i('Rapsöl', 14, '1 EL'), i('Limette', 30, '½ Limette'), i('Salz', 3),
  ], ['Reis nach Packung kochen.', 'Zwiebel in Öl anbraten, Knoblauch, Ingwer und Gewürze 1 Minute mitrösten.', 'Kokosmilch und Tomaten dazu, 5 Minuten köcheln.', 'Fisch in Stücken einlegen, zugedeckt 6–8 Minuten gar ziehen lassen. Mit Limettensaft und Salz abschmecken.']),
  r('raita', 'Gurken-Raita', 'indisch', 'veg', 2, 5, [
    i('Joghurt, 3,5 %', 250), i('Gurke', 150, '½ Gurke'), i('Kreuzkümmel', 1), i('Minze, frisch', 4), i('Salz', 1),
  ], ['Gurke fein reiben und leicht ausdrücken.', 'Mit Joghurt, gemahlenem Kreuzkümmel, gehackter Minze und Salz verrühren.']),

  // Orientalisch
  r('shakshuka', 'Shakshuka', 'orientalisch', 'veg', 1, 20, [
    i('Ei', 180, '3 Eier'), i('Gehackte Tomaten, Dose', 400), i('Paprika, rot', 150), i('Zwiebel', 55, '½ Zwiebel'), i('Knoblauch', 3, '1 Zehe'),
    i('Kreuzkümmel', 2), i('Paprikapulver', 2), i('Olivenöl', 14, '1 EL'), i('Fladenbrot, Pita', 60), i('Petersilie', 4), i('Salz', 2),
  ], ['Zwiebel und Paprika in Öl 5 Minuten anbraten, Knoblauch und Gewürze kurz mitbraten.', 'Tomaten dazu, 5 Minuten einköcheln, salzen.', 'Drei Mulden drücken, Eier hineinschlagen, Deckel drauf, 6–8 Minuten stocken lassen.', 'Mit Petersilie bestreuen und mit Fladenbrot direkt aus der Pfanne essen.']),
  r('menemen', 'Menemen', 'orientalisch', 'veg', 1, 15, [
    i('Ei', 120, '2 Eier'), i('Tomaten', 240, '2 Tomaten'), i('Paprika, grün', 75, '½ Paprika'), i('Olivenöl', 14, '1 EL'), i('Paprikapulver', 1), i('Vollkornbrot', 45, '1 Scheibe'), i('Salz', 1),
  ], ['Paprika in Öl 3 Minuten anbraten.', 'Gewürfelte Tomaten dazu, 5 Minuten weich köcheln.', 'Eier verquirlen, unterrühren und bei kleiner Hitze cremig stocken lassen. Salzen, mit Brot servieren.']),
  r('koefte', 'Köfte mit Joghurt und Bulgur', 'orientalisch', 'rind', 2, 25, [
    i('Rinderhackfleisch', 300), i('Bulgur, roh', 120), i('Joghurt, 3,5 %', 200), i('Zwiebel', 55, '½ Zwiebel'), i('Petersilie', 8),
    i('Kreuzkümmel', 2), i('Paprikapulver', 2), i('Knoblauch', 3, '1 Zehe'), i('Gurke', 150), i('Olivenöl', 7, '½ EL'), i('Salz', 3),
  ], ['Bulgur mit der doppelten Menge kochendem Wasser übergießen, 10 Minuten quellen lassen.', 'Hack mit fein geriebener Zwiebel, Petersilie, Kreuzkümmel, Paprika und Salz verkneten, 8 längliche Köfte formen.', 'In Öl rundherum 8–10 Minuten braten.', 'Joghurt mit Knoblauch und Salz verrühren. Mit Bulgur und Gurke servieren.']),
  r('lachs-tahini', 'Lachs mit Tahini-Zitronen-Soße', 'orientalisch', 'fisch', 1, 20, [
    i('Lachs', 150), i('Bulgur, roh', 60), i('Tahini, Sesammus', 15, '1 EL'), i('Zitronensaft', 15, '1 EL'), i('Knoblauch', 3, '1 Zehe'),
    i('Gurke', 100), i('Tomaten', 120, '1 Tomate'), i('Petersilie', 4), i('Salz', 1),
  ], ['Bulgur mit der doppelten Menge kochendem Wasser übergießen, 10 Minuten quellen lassen.', 'Lachs salzen und in einer Pfanne ohne Öl auf der Hautseite 4 Minuten, dann 2–3 Minuten auf der anderen Seite braten.', 'Tahini mit Zitronensaft, Knoblauch und 2–3 EL Wasser cremig rühren.', 'Mit Bulgur, Gurke und Tomate anrichten, Soße darüber, Petersilie drauf.']),
  r('hummus', 'Hummus mit Gemüsesticks', 'snack', 'veg', 1, 10, [
    i('Hummus', 100), i('Karotte', 70, '1 Karotte'), i('Gurke', 100), i('Paprika, rot', 75, '½ Paprika'),
  ], ['Gemüse in Sticks schneiden.', 'Mit Hummus zum Dippen servieren.']),

  // Salate
  r('steak-salat', 'Rumpsteak-Salat mit Rucola', 'salat', 'rind', 1, 15, [
    i('Rumpsteak', 200), i('Rucola', 40, '2 Handvoll'), i('Kirschtomaten', 136, '8 Stück'), i('Parmesan', 20), i('Olivenöl', 14, '1 EL'), i('Balsamico', 16, '1 EL'), i('Ciabatta, Weißbrot', 60), i('Salz', 1),
  ], ['Steak 30 Minuten vorher aus dem Kühlschrank nehmen und trocken tupfen.', 'In sehr heißer Pfanne mit wenig Öl je Seite 2–3 Minuten braten (medium).', '5 Minuten ruhen lassen, dann salzen, pfeffern und quer zur Faser in Streifen schneiden.', 'Auf Rucola und Tomaten legen, mit Parmesan, Öl und Balsamico anrichten.']),
  r('thunfisch-salat', 'Thunfisch-Bohnen-Salat', 'salat', 'fisch', 1, 10, [
    i('Thunfisch, Dose, im eigenen Saft', 150), i('Weiße Bohnen, Dose', 120, '½ Dose'), i('Rote Zwiebel', 30), i('Petersilie', 8), i('Olivenöl', 14, '1 EL'), i('Zitronensaft', 15, '1 EL'), i('Salz', 1),
  ], ['Bohnen abspülen, Thunfisch abtropfen lassen.', 'Zwiebel in feine Ringe schneiden, Petersilie hacken.', 'Alles mit Öl, Zitronensaft, Salz und Pfeffer mischen.']),
  r('kichererbsen-salat', 'Kichererbsensalat mit Feta', 'salat', 'veg', 1, 10, [
    i('Kichererbsen, Dose', 240, '1 Dose, abgetropft'), i('Feta', 50), i('Gurke', 100), i('Tomaten', 120, '1 Tomate'), i('Rote Zwiebel', 30), i('Olivenöl', 14, '1 EL'), i('Zitronensaft', 15, '1 EL'), i('Petersilie', 4),
  ], ['Kichererbsen abspülen.', 'Gurke, Tomate und Zwiebel würfeln, Feta zerbröseln.', 'Alles mit Öl, Zitronensaft, Petersilie, Salz und Pfeffer mischen.']),
  r('taboule', 'Taboulé', 'salat', 'veg', 2, 15, [
    i('Bulgur, roh', 80), i('Petersilie', 60, '1 großer Bund'), i('Minze, frisch', 10), i('Tomaten', 240, '2 Tomaten'), i('Frühlingszwiebel', 30, '2 Stück'), i('Olivenöl', 28, '2 EL'), i('Zitronensaft', 30, '2 EL'), i('Salz', 2),
  ], ['Bulgur mit 160 ml kochendem Wasser übergießen, 10 Minuten quellen lassen, abkühlen.', 'Petersilie und Minze sehr fein hacken, Tomaten und Frühlingszwiebeln klein würfeln.', 'Alles mit Öl, Zitronensaft und Salz mischen. Tipp: mit Feta oder Thunfisch für mehr Eiweiß.']),
  r('griechischer-salat', 'Griechischer Salat', 'salat', 'veg', 1, 10, [
    i('Tomaten', 240, '2 Tomaten'), i('Gurke', 150, '½ Gurke'), i('Paprika, grün', 75, '½ Paprika'), i('Rote Zwiebel', 30), i('Feta', 75), i('Oliven', 20, '5 Stück'), i('Olivenöl', 14, '1 EL'), i('Oregano, getrocknet', 1),
  ], ['Gemüse in grobe Stücke schneiden.', 'Feta in einer Scheibe obenauf legen, Oliven dazu.', 'Mit Öl beträufeln und mit Oregano bestreuen.']),

  // Snacks und Frühstück
  r('hafer-quark', 'Haferflocken mit Quark', 'snack', 'veg', 1, 5, [
    i('Haferflocken', 80), i('Milch, 3,5 %', 300), i('Magerquark', 100), i('Banane', 120, '1 Banane'), i('Erdnussbutter', 16, '1 EL'),
  ], ['Haferflocken mit Milch 2 Minuten in der Mikrowelle oder im Topf erwärmen.', 'Quark unterrühren, Banane in Scheiben schneiden.', 'Mit Banane und Erdnussbutter toppen.']),
  r('skyr-walnuss', 'Skyr mit Walnüssen und Beeren', 'snack', 'veg', 1, 3, [
    i('Skyr', 200), i('Walnüsse', 30), i('Beeren, tiefgekühlt', 80), i('Honig', 7, '1 TL'),
  ], ['Beeren kurz antauen lassen.', 'Skyr in eine Schale geben, Beeren, Walnüsse und Honig darüber.']),
  r('apfel-mandeln', 'Apfel mit Mandeln', 'snack', 'veg', 1, 2, [
    i('Apfel', 180, '1 Apfel'), i('Mandeln', 30, '1 Handvoll'),
  ], ['Apfel in Spalten schneiden und mit Mandeln essen.']),
  r('datteln-walnuss', 'Datteln mit Walnüssen', 'snack', 'veg', 1, 2, [
    i('Datteln', 72, '3 Datteln'), i('Walnüsse', 20),
  ], ['Datteln entsteinen und je eine Walnusshälfte hineindrücken.']),
  r('bananen-shake', 'Bananen-Hafer-Shake', 'snack', 'veg', 1, 3, [
    i('Milch, 3,5 %', 300), i('Banane', 120, '1 Banane'), i('Haferflocken', 30), i('Erdnussbutter', 16, '1 EL'),
  ], ['Alles im Mixer oder mit dem Pürierstab 30 Sekunden fein mixen.']),
];

export function customRecipes() { return getSetting('recipes') || []; }

export function allRecipes() { return [...BUILTIN, ...customRecipes()]; }

export function recipeById(id) { return allRecipes().find(x => x.id === id); }

export function saveRecipe(recipe) {
  const list = customRecipes();
  const idx = list.findIndex(x => x.id === recipe.id);
  const next = idx >= 0 ? list.map(x => (x.id === recipe.id ? recipe : x)) : [...list, recipe];
  setSetting('recipes', next);
}

export function deleteRecipe(id) {
  setSetting('recipes', customRecipes().filter(x => x.id !== id));
}
