# HabitHero

Persönliche Web-App (PWA) für Rauchstopp, Training, Essen und Schlaf. Läuft auf einem iPhone 13 mini
über GitHub Pages: https://netster123.github.io/habithero/

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
- Als Nächstes: Rauchfrei (Vorbereitungsmodus, Zähler, Zeitleiste, SOS Craving-Button mit Linienchart),
  dann Training, Essen (Rezepte, Nährwerte, Tageswert 1–10), Schlaf.
