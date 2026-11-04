import { createHmac } from "node:crypto";
/** Compute codes only for a disposable administrator enrolled through the real API.
 * @param {string} secret Base32 setup key. @param {number} [seconds] UTC Unix seconds. */
export function authenticatorCode(secret, seconds = Date.now() / 1000) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";let bits = "";
  for (const character of secret.replace(/=+$/, "").toUpperCase()) {
    const value = alphabet.indexOf(character);if (value < 0) throw new Error("Invalid test authenticator key");bits += value.toString(2).padStart(5,"0");
  }
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(value => parseInt(value,2)));
  const counter = Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(seconds / 30)));
  const digest = createHmac("sha1",key).update(counter).digest(), offset = digest[digest.length-1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6,"0");
}
