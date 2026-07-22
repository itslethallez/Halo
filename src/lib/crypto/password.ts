/**
 * Password hashing using Node's built-in scrypt (no native/compiled dependency required).
 * See /docs/10-legal-privacy-security-risks.md #14.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

function scrypt(password: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, SCRYPT_PARAMS, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(plainPassword, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = storedHash.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  const derivedKey = await scrypt(plainPassword, salt, KEY_LENGTH);

  if (derivedKey.length !== expectedKey.length) return false;
  return timingSafeEqual(derivedKey, expectedKey);
}
