// Holt aktuelle Stellen aus der Jobbörse der Bundesagentur für Arbeit und schreibt
// sie als Kandidatenliste nach data/ba_kandidaten.json (öffentliche Stellenanzeigen, unverschlüsselt).
// Läuft in GitHub Actions (Node 20). Bereits auf der Seite vorhandene Stellen werden als "bekannt" markiert.
import { readFileSync, writeFileSync } from "node:fs";
import { sha256hex, normLink } from "./lib.mjs";

const API = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs";
const HEADERS = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Mozilla/5.0 (jobsuche-burak)", Accept: "application/json" };
const TAGE = 21;

const BEGRIFFE = [
  "Werkstudent Regulatory Affairs", "Praktikum Regulatory Affairs", "Working Student Regulatory Affairs",
  "Werkstudent Medizinprodukte", "Werkstudent Qualitätsmanagement Medizinprodukte", "Werkstudent Zulassung",
  "Werkstudent Medizintechnik Qualität", "Werkstudent Medical Device", "Werkstudent Digital Health",
  "Werkstudent Qualitätssicherung Medizintechnik", "Praktikum Qualitätsmanagement Medizintechnik",
  "Werkstudent Compliance Gesundheitswesen", "Werkstudent Datenschutz Gesundheitswesen", "Werkstudent Medizininformatik",
];
const ORTE = [
  { wo: "Frankfurt am Main", umkreis: 50 },
  { wo: "Gießen", umkreis: 25 },
  { wo: "", umkreis: 0, arbeitszeit: "ho" }, // bundesweit, Homeoffice
];

async function suche(was, ort) {
  const p = new URLSearchParams({ was, size: "50", page: "1", veroeffentlichtseit: String(TAGE) });
  if (ort.wo) { p.set("wo", ort.wo); p.set("umkreis", String(ort.umkreis)); }
  if (ort.arbeitszeit) p.set("arbeitszeit", ort.arbeitszeit);
  const r = await fetch(`${API}?${p}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`HTTP ${r.status} für "${was}" / "${ort.wo || "Homeoffice"}"`);
  const j = await r.json();
  return j.stellenangebote || [];
}

const jobsFile = new URL("../data/jobs.json", import.meta.url);
const known = new Set(JSON.parse(readFileSync(jobsFile, "utf8")).jobs.map((j) => j.h));

const map = new Map();
let fehler = 0;
for (const was of BEGRIFFE) {
  for (const ort of ORTE) {
    try {
      for (const s of await suche(was, ort)) {
        if (!s.refnr || map.has(s.refnr)) continue;
        const link = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${s.refnr}`;
        map.set(s.refnr, {
          refnr: s.refnr,
          titel: s.titel || s.beruf || "",
          beruf: s.beruf || "",
          arbeitgeber: s.arbeitgeber || "",
          ort: [s.arbeitsort?.plz, s.arbeitsort?.ort].filter(Boolean).join(" "),
          region: s.arbeitsort?.region || "",
          veroeffentlicht: s.aktuelleVeroeffentlichungsdatum || s.modifikationsTimestamp || "",
          eintritt: s.eintrittsdatum || "",
          externeUrl: s.externeUrl || "",
          link,
          bekannt: known.has(await sha256hex(normLink(link))) || (s.externeUrl ? known.has(await sha256hex(normLink(s.externeUrl))) : false),
          suchbegriff: was,
        });
      }
    } catch (e) { fehler++; console.error(e.message); }
    await new Promise((r) => setTimeout(r, 300));
  }
}
const stellen = [...map.values()].sort((a, b) => (b.veroeffentlicht || "").localeCompare(a.veroeffentlicht || ""));
if (fehler === BEGRIFFE.length * ORTE.length) { console.error("Alle Abfragen fehlgeschlagen – Datei bleibt unverändert."); process.exit(1); }
writeFileSync(new URL("../data/ba_kandidaten.json", import.meta.url),
  JSON.stringify({ aktualisiert: new Date().toISOString(), tage: TAGE, anzahl: stellen.length, fehler, stellen }, null, 1) + "\n");
console.log(`BA-Kandidaten: ${stellen.length} (davon neu: ${stellen.filter((s) => !s.bekannt).length}), fehlgeschlagene Abfragen: ${fehler}`);
