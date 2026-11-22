// Nutzung: node tools/add_jobs.mjs neue_stellen.json
// neue_stellen.json = Array von Stellen-Objekten (Felder siehe README.md).
// Verschlüsselt jede neue Stelle mit dem öffentlichen Schlüssel und hängt sie an data/jobs.json an.
// Braucht KEIN Passwort. Doppelte Stellen (gleicher Link) werden übersprungen.
import { readFileSync, writeFileSync } from "node:fs";
import { encryptJob, sha256hex, normLink } from "./lib.mjs";

const REQUIRED = ["gefunden", "firma", "titel", "ort", "passung", "zusammenfassung", "link"];
const file = new URL("../data/jobs.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const incoming = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!Array.isArray(incoming)) throw new Error("Eingabe muss ein JSON-Array sein");

const known = new Set(data.jobs.map((j) => j.h));
let added = 0, skipped = 0;
for (const job of incoming) {
  for (const f of REQUIRED) if (!job[f]) throw new Error(`Feld "${f}" fehlt bei: ${job.titel || JSON.stringify(job)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(job.gefunden)) throw new Error(`gefunden muss JJJJ-MM-TT sein: ${job.gefunden}`);
  const h = await sha256hex(normLink(job.link));
  if (known.has(h)) { skipped++; continue; }
  const enc = await encryptJob(data.publicKey, job);
  data.jobs.push({ h, gefunden: job.gefunden, ...enc });
  known.add(h); added++;
}
data.aktualisiert = new Date().toISOString();
writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
console.log(`hinzugefügt: ${added}, übersprungen (schon vorhanden): ${skipped}, gesamt: ${data.jobs.length}`);
