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
