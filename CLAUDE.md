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
- Als Nächstes: Training, dann Essen (Rezepte, Nährwerte, Tageswert 1–10), dann Schlaf.
