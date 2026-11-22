// Holt aktuelle Stellen aus der Jobbörse der Bundesagentur für Arbeit (offizielle Schnittstelle, v6)
// und schreibt eine vorgefilterte Kandidatenliste nach data/ba_kandidaten.json (öffentliche Anzeigen, unverschlüsselt).
// Läuft in GitHub Actions (Node 20). Bereits auf der Seite vorhandene Stellen werden als "bekannt" markiert.
import { readFileSync, writeFileSync } from "node:fs";
import { sha256hex, normLink } from "./lib.mjs";

const API = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";
const HEADERS = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "jobsuche-burak (private Stellensuche; github.com/erway68/jobsuche)", Accept: "application/json" };
const TAGE = 30;

// Fachlich passend (Titel/Beruf)
const FACH = /regulat|zulassung|qualit|\bqm\b|\bqms\b|\bqa\b|medizin|medical|med-?tech|health|gesundheit|pharma|clinical|klinisch|compliance|datenschutz|informationssicherheit|dokumentation|\biso\b|\bmdr\b|\bivd\b|validierung|diagnost|biotech|life ?science|samd|diga|hl7|fhir/i;
// Studentisch
const STUDENT = /werkstudent|working student|studentische|student\b|studierende|praktik|intern\b|internship|praxissemester|pflichtpraktikum/i;

const ABFRAGEN = [
  // Region: alle Werkstudenten-/Praktikumsstellen, dann fachlich filtern
  { was: "Werkstudent", wo: "Frankfurt am Main", umkreis: 50, filter: FACH },
  { was: "Werkstudent", wo: "Gießen", umkreis: 30, filter: FACH },
  { was: "Praktikum", wo: "Frankfurt am Main", umkreis: 50, filter: FACH },
  { was: "Praktikant", wo: "Frankfurt am Main", umkreis: 50, filter: FACH },
  { was: "Praktikum", wo: "Gießen", umkreis: 30, filter: FACH },
  // Bundesweit: Fachbegriffe, dann studentisch filtern (für Remote/sehr gute Treffer)
  { was: "Regulatory Affairs", filter: STUDENT },
  { was: "Medizinprodukte", filter: STUDENT },
  { was: "Qualitätsmanagement Medizintechnik", filter: STUDENT },
  { was: "Medical Device", filter: STUDENT },
  { was: "Digital Health", filter: STUDENT },
];

async function holeAlle(a) {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const p = new URLSearchParams({ was: a.was, size: "100", page: String(page) });
    if (a.wo) { p.set("wo", a.wo); p.set("umkreis", String(a.umkreis)); }
    const r = await fetch(`${API}?${p}`, { headers: HEADERS });
    if (!r.ok) throw new Error(`HTTP ${r.status} für "${a.was}" / "${a.wo || "bundesweit"}"`);
    const j = await r.json();
    const liste = j.ergebnisliste || [];
    out.push(...liste);
    if (liste.length < 100 || out.length >= (j.maxErgebnisse || 0)) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}

const jobsFile = new URL("../data/jobs.json", import.meta.url);
const known = new Set(JSON.parse(readFileSync(jobsFile, "utf8")).jobs.map((j) => j.h));
const grenze = new Date(Date.now() - TAGE * 86400000).toISOString().slice(0, 10);

const map = new Map();
let fehler = 0, roh = 0;
for (const a of ABFRAGEN) {
  try {
    const liste = await holeAlle(a);
    roh += liste.length;
    for (const s of liste) {
      const ref = s.referenznummer;
      if (!ref || map.has(ref)) continue;
      const titel = s.stellenangebotsTitel || s.hauptberuf || "";
      const text = `${titel} ${s.hauptberuf || ""} ${(s.alleBerufe || []).join(" ")}`;
      if (!a.filter.test(text)) continue;
      const datum = s.datumErsteVeroeffentlichung || (s.aenderungsdatum || "").slice(0, 10);
      if (datum && datum < grenze) continue;
      const adr = s.stellenlokationen?.[0]?.adresse || {};
      const link = `https://www.arbeitsagentur.de/jobsuche/jobdetail/${ref}`;
      map.set(ref, {
        refnr: ref, titel, beruf: s.hauptberuf || "", arbeitgeber: s.firma || "",
        ort: [adr.plz, adr.ort].filter(Boolean).join(" "), region: adr.region || "",
        veroeffentlicht: datum, art: s.stellenangebotsart || "", vollzeit: !!s.arbeitszeitVollzeit,
        link, bekannt: known.has(await sha256hex(normLink(link))), abfrage: `${a.was}${a.wo ? " / " + a.wo : " / bundesweit"}`,
      });
    }
  } catch (e) { fehler++; console.error(e.message); }
  await new Promise((r) => setTimeout(r, 300));
}
if (fehler === ABFRAGEN.length) { console.error("Alle Abfragen fehlgeschlagen – Datei bleibt unverändert."); process.exit(1); }
const stellen = [...map.values()].sort((a, b) => (b.veroeffentlicht || "").localeCompare(a.veroeffentlicht || ""));
writeFileSync(new URL("../data/ba_kandidaten.json", import.meta.url),
  JSON.stringify({ aktualisiert: new Date().toISOString(), tage: TAGE, roh, anzahl: stellen.length, fehler, stellen }, null, 1) + "\n");
console.log(`BA: ${roh} Rohtreffer → ${stellen.length} passende Kandidaten (neu: ${stellen.filter((s) => !s.bekannt).length}), Fehler: ${fehler}`);

// Diagnose für die Linkprüfung: findet die Suche eine Stelle über ihre Referenznummer?
if (stellen[0]) {
  const r = await fetch(`${API}?was=${encodeURIComponent(stellen[0].refnr)}&size=5`, { headers: HEADERS });
  const j = await r.json();
  console.log("Diagnose Ref-Suche:", stellen[0].refnr, "→", j.maxErgebnisse, (j.ergebnisliste || []).map((x) => x.referenznummer).join(","));
  const r2 = await fetch(`${API}?was=${encodeURIComponent("12345-INVALID_XX0000000-S")}&size=5`, { headers: HEADERS });
  console.log("Diagnose Ref-Suche ungültig →", (await r2.json()).maxErgebnisse);
}
