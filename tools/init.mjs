// Einmalige Einrichtung bzw. Passwortwechsel-Neuaufbau: JOBS_PW=... node tools/init.mjs
// Erzeugt ein neues Schlüsselpaar. ACHTUNG: alte Einträge sind danach nicht mehr lesbar.
import { writeFileSync, existsSync } from "node:fs";
import { generate } from "./lib.mjs";
const pw = process.env.JOBS_PW;
if (!pw) throw new Error("JOBS_PW fehlt");
const file = new URL("../data/jobs.json", import.meta.url);
if (existsSync(file) && process.argv[2] !== "--force") throw new Error("data/jobs.json existiert schon (--force zum Überschreiben)");
const keys = await generate(pw);
writeFileSync(file, JSON.stringify({ version: 1, ...keys, aktualisiert: new Date().toISOString(), jobs: [] }, null, 1) + "\n");
console.log("ok");
