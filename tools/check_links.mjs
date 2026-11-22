// Prüft alle Stellen-Links mit echten Seitenaufrufen und markiert abgelaufene Stellen.
// Vorsichtig: erst nach 2 aufeinanderfolgenden eindeutigen Fehlschlägen gilt eine Stelle als "abgelaufen".
// 403/429/5xx/Zeitüberschreitung zählen als "unklar" (Bot-Sperren), nicht als abgelaufen.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../data/jobs.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const TOT = /(nicht mehr verf(ü|ue)gbar|no longer (available|active|accepting)|existiert nicht|page not found|seite nicht gefunden|stelle ist (bereits )?besetzt|position has been filled|job (has )?expired|stellenanzeige ist abgelaufen|this job is closed|bewerbungsfrist ist abgelaufen)/i;
const BA_API = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs";

async function pruefe(link) {
  const ba = link.match(/arbeitsagentur\.de\/jobsuche\/jobdetail\/([^/?#]+)/);
  try {
    if (ba) {
      // BA-Stellen: über die offizielle Suche nach der Referenznummer prüfen (0 Treffer = nicht mehr veröffentlicht)
      const ref = decodeURIComponent(ba[1]);
      const r = await fetch(`${BA_API}?was=${encodeURIComponent(ref)}&size=5`, { headers: { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "jobsuche-burak (private Stellensuche; github.com/erway68/jobsuche)" } });
      if (!r.ok) return "unklar";
      const j = await r.json();
      return (j.ergebnisliste || []).some((x) => x.referenznummer === ref) ? "ok" : "tot";
    }
    const ctl = AbortSignal.timeout(20000);
    const r = await fetch(link, { redirect: "follow", signal: ctl, headers: { "User-Agent": UA, "Accept-Language": "de-DE,de;q=0.9,en;q=0.8", Accept: "text/html" } });
    if (r.status === 404 || r.status === 410) return "tot";
    if (!r.ok) return "unklar";
    const orig = new URL(link), fin = new URL(r.url);
    const pfadWeg = orig.pathname.length > 5 && fin.pathname.replace(/\/+$/, "").length <= 3; // auf Startseite umgeleitet
    if (pfadWeg || fin.hostname.replace(/^www\./, "") !== orig.hostname.replace(/^www\./, "") && /^(www\.)?(recruitee|personio|smartrecruiters)\.com$/.test(fin.hostname)) return "tot";
    if (/\/(error|404|not-?found)(\/|$|\?)/i.test(fin.pathname)) return "tot";
    const text = (await r.text()).slice(0, 400000);
    const titel = (text.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "";
    if (/\b404\b|not found|nicht gefunden|error/i.test(titel)) return "tot";
    if (TOT.test(text.replace(/<script[\s\S]*?<\/script>/gi, " "))) return "tot";
    return "ok";
  } catch { return "unklar"; }
}

const heute = new Date().toISOString().slice(0, 10);
let geaendert = 0;
for (const j of data.jobs) {
  if (!j.link) continue;
  if (j.pruefung?.status === "abgelaufen") continue;
  const erg = await pruefe(j.link);
  const alt = j.pruefung || { status: "ok", fehl: 0 };
  let neu;
  if (erg === "ok") neu = { status: "ok", fehl: 0, datum: heute };
  else if (erg === "tot") neu = alt.fehl >= 1 ? { status: "abgelaufen", fehl: alt.fehl + 1, datum: heute, seit: heute } : { status: alt.status, fehl: alt.fehl + 1, datum: heute };
  else neu = { status: alt.status || "ok", fehl: alt.fehl || 0, datum: heute, hinweis: "Seite blockiert automatische Prüfung" };
  if (JSON.stringify(neu) !== JSON.stringify(j.pruefung)) { j.pruefung = neu; geaendert++; }
  console.log(`${erg.padEnd(6)} ${j.link}`);
  await new Promise((r) => setTimeout(r, 500));
}
data.geprueft = new Date().toISOString();
writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
console.log(`Geprüft: ${data.jobs.filter((j) => j.link).length}, geändert: ${geaendert}`);
