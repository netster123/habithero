# HabitHero

Persönliche Web-App (PWA) für Rauchstopp, Training, Essen und Schlaf. Läuft auf einem iPhone 13 mini
über GitHub Pages: https://netster123.github.io/habithero/ – soll auf allen gängigen Handys (iPhone und Android) gut bedienbar sein.

## Technik

- Reines HTML/CSS/JavaScript (ES-Module), kein Build-Schritt. Einfach Dateien ändern und pushen.
- Daten nur lokal im Browser (`localStorage`, Schlüssel `habithero`), siehe `js/store.js`.
  Ändert sich das Datenformat: `SCHEMA` erhöhen und in `migrate()` umstellen – Nutzerdaten dürfen nie verloren gehen.
- `sw.js` macht die App offline-fähig. **Bei jeder Änderung an App-Dateien `VERSION` in `sw.js` und
  `APP_VERSION` in `js/views.js` erhöhen** und neue Dateien in `ASSETS` eintragen – sonst sieht das iPhone das Update nicht.
- Ein „Tag“ beginnt um 05:00 (`js/time.js`), weil der Nutzer erst gegen 01:00 schlafen geht.
- Icons: `python3 tools/make-icons.py`.
- Lokal testen: `python3 -m http.server 8765 --directory .` und http://127.0.0.1:8765 öffnen.

## Inhaltliche Vorgaben des Nutzers

- Gesundheitsangaben nur aus Studien und Fachpublikationen mit Quelle; keine WHO-Angaben,
  kein Hinweis auf Rauchfrei-Hotlines, keine „sprich mit deinem Arzt“-Ratschläge.
- Ton: locker und motivierend, erwachsen, keine Jugendsprache. „Punkte“, nie „XP“.
- Jeder Eintrag muss einzeln löschbar sein (mit Rückfrage; Punkte werden abgezogen).
- Tabak: 30 g Drehtabak alle 3 Tage, 3,75 € pro Packung, ca. 30 Zigaretten am Tag.
- Schlafrhythmus 01:00–12:00. Training zu Hause: Liegestütze, Kniebeugen, Klimmzüge.
- Rezepte nur echte, sehr einfache Gerichte: indisch, orientalisch, Salate, Snacks; Fleisch nur
  Rinderhack und Rumpsteak; Fisch erlaubt. Nährwerte immer als Balkendiagramm.

## Stand

- 0.1.0: Grundgerüst – Heute (Level, Punkte, Tagesaufgaben), Hell/Dunkel, Einstellungen,
  Verlauf mit Einzel-Löschen, Sicherung/Wiederherstellung, Offline und Update-Hinweis.
- 0.2.0: Rauchfrei – Vorbereitungsmodus (Zigaretten mit Situation erfassen, Top-Auslöser, Wenn-Dann-Pläne),
  Rauchstopp-Tag, Zähler (Tabak/Geld/Zigaretten), Zeitleiste mit Quellen und Meilenstein-Punkten (`js/rauchfrei.js`),
  Sparziel, SOS Craving-Button (Atmen/Kniebeugen/Ablenkung, 3-Min-Timer) mit Linienchart pro Tag (`js/chart.js`).
  Ausrutscher setzen nur die kurzfristigen Meilensteine zurück; langfristige zählen ab dem Rauchstopp-Tag.
- 0.3.0: Passt auf alle gängigen Handys (320–430 px Breite, Querformat, große Schrift) und hilft beim
  Installieren auf iPhone und Android (`js/install.js`). Layout-Test lokal: `.audit.js` (nicht im Repo).
- 0.4.0: Training – Liegestütze, Kniebeugen, Klimmzüge mit Stufen-Leitern (`js/training.js`), Sätze mit
  Stepper speichern, Satzpause-Timer (60–180 s), Aufsteigen (+100) wenn alle Sätze das Ziel erreichen,
  Training abschließen (+100, einmal pro Tag), Sätze pro Woche vs. Ziel 10. Stufe = letzter `stufe`-Eintrag.
- 0.5.0: Essen – eigener Mahlzeitenplan (`js/essen.js`, erscheint auch als Aufgaben auf „Heute“), 20 eingebaute
  Rezepte (`js/recipes.js`), eigene Rezepte mit automatischer Berechnung, Vitamine/Mineralstoffe/Spurenelemente
  als Balken (D-A-CH-Referenz), Tageswert 1–10, Gewicht. Nährwerte: `data/foods-de.json` (195 deutsche Grundzutaten)
  und `data/usda.json` (alle USDA-SR-Legacy-Lebensmittel) aus `tools/build-foods.py` + `tools/foods-de.tsv`.
  Fehlende Zutaten: Suchbegriff wird über MyMemory ins Englische übersetzt und in `data/usda.json` gesucht,
  der Treffer landet in `customFoods`. Kalorienziel steigt von 2.200 alle 2 Wochen um 200 bis 2.700 (rauchfrei: 2.500).
- 0.6.0: Schlaf – Nächte eintragen (`js/schlaf.js`) mit Aufwachen, Qualität, Notiz; Ø Schlaf, Ø wach,
  „Im Rhythmus“ (±30 Min.), Wochenbalken der Aufstehzeit, Abendaufgaben. Alle Aufgabenzeiten auf „Heute“
  richten sich nach dem Schlafziel (`taskList()` in `js/progress.js`). Nacht im Rhythmus +30, sonst +10.
- Alle fünf Bereiche sind gebaut. Offene Ideen: Erinnerungen über iOS-Kurzbefehle, Quellen am Original prüfen.
