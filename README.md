# Jobsuche (privat, verschlüsselt)

Statische Seite für GitHub Pages. Alle Stellen in `data/jobs.json` sind verschlüsselt
(RSA-OAEP + AES-GCM). Lesbar nur im Browser mit Passwort. Das Repo enthält kein Passwort.

## Neue Stellen hinzufügen (für die geplante Suche)
1. Neue Stellen als JSON-Array in eine Datei schreiben, z. B. `/tmp/neu.json`:
   ```json
   [{"gefunden":"2026-11-25","firma":"...","titel":"...","ort":"...","modus":"Hybrid",
     "stunden":"","passung":"hoch","zusammenfassung":"...","warum":"...","tipp":"...",
     "link":"https://...","hinweis":""}]
   ```
   Pflichtfelder: gefunden, firma, titel, ort, passung (hoch|mittel), zusammenfassung, link.
2. `node tools/add_jobs.mjs /tmp/neu.json` (überspringt Stellen mit schon bekanntem Link).
3. Nur `data/jobs.json` committen und pushen.

Nie `tools/init.mjs` ausführen – das erzeugt neue Schlüssel und macht alle alten Einträge unlesbar.

## Automatische Pflege (GitHub Actions, täglich 05:17 MEZ)
- `tools/ba_fetch.mjs` holt aktuelle Stellen der Bundesagentur für Arbeit nach `data/ba_kandidaten.json`
  (Felder: refnr, titel, arbeitgeber, ort, veroeffentlicht, link, bekannt, beschreibung, arbeitszeit, homeoffice, vertragsdauer).
  `bekannt: true` = steht schon auf der Seite.
- `tools/check_links.mjs` prüft alle Links in `data/jobs.json` mit echten Seitenaufrufen und setzt
  `pruefung.status` auf `abgelaufen`, wenn eine Stelle zweimal hintereinander eindeutig weg ist.
- Links stehen bewusst unverschlüsselt in `data/jobs.json` (öffentliche Anzeigen), damit sie geprüft werden können.
- Vor dem Pushen immer `git pull --rebase origin main`, weil die Action ebenfalls in data/ schreibt.

## Seite (index.html)
- Bewerbungs-Tracker (Status, Bewerbungsdatum, Notizen, Nachhaken nach 14 Tagen) – gespeichert im Browser (localStorage `rajobs_track`).
- Board-Ansicht mit Drag & Drop, Kennzahlen, Filter/Sortierung.
- „Anschreiben entwerfen“: öffnet claude.ai mit vorbereitetem Prompt; Profiltext liegt verschlüsselt in `data/jobs.json` → `profil` (setzen mit `node tools/set_profile.mjs datei.txt`).
- Installierbar als App (manifest.webmanifest, sw.js). Bei Änderungen an index.html die CACHE-Version in sw.js erhöhen.
