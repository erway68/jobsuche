// Speichert ein kurzes Profil (für den Anschreiben-Knopf) verschlüsselt in data/jobs.json.
// Nutzung: node tools/set_profile.mjs profil.txt
import { readFileSync, writeFileSync } from "node:fs";
import { encryptJob } from "./lib.mjs";
const file = new URL("../data/jobs.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
data.profil = await encryptJob(data.publicKey, { text: readFileSync(process.argv[2], "utf8").trim() });
writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
console.log("Profil gespeichert (verschlüsselt).");
