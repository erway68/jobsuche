// Gemeinsame Krypto-Funktionen (Node >= 18, WebCrypto)
import { webcrypto as wc } from "node:crypto";
const subtle = wc.subtle;
export const b64 = (buf) => Buffer.from(new Uint8Array(buf)).toString("base64");
export const unb64 = (s) => new Uint8Array(Buffer.from(s, "base64"));
export const PBKDF2_ITER = 600000;

export async function sha256hex(text) {
  const d = await subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Buffer.from(new Uint8Array(d)).toString("hex");
}

export function normLink(url) {
  return String(url || "").trim().replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();
}

export async function passwordKey(password, salt, iter = PBKDF2_ITER) {
  const base = await subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function generate(password) {
  const kp = await subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const spki = await subtle.exportKey("spki", kp.publicKey);
  const pkcs8 = await subtle.exportKey("pkcs8", kp.privateKey);
  const salt = wc.getRandomValues(new Uint8Array(16));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const k = await passwordKey(password, salt);
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, k, pkcs8);
  return { publicKey: b64(spki), encPrivateKey: { salt: b64(salt), iv: b64(iv), iter: PBKDF2_ITER, ct: b64(ct) } };
}

export async function encryptJob(publicKeyB64, job) {
  const pub = await subtle.importKey("spki", unb64(publicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const aes = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const raw = await subtle.exportKey("raw", aes);
  const iv = wc.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(job)));
  const wk = await subtle.encrypt({ name: "RSA-OAEP" }, pub, raw);
  return { wk: b64(wk), iv: b64(iv), ct: b64(ct) };
}
