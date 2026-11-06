import crypto from "node:crypto";

/**
 * Primitives cryptographiques : hachage de mots de passe (scrypt),
 * chiffrement symetrique des secrets (AES-256-GCM) et hachage de jetons.
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password.normalize("NFKC"), salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * SCRYPT_N * SCRYPT_R * 2,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const derived = crypto.scryptSync(password.normalize("NFKC"), Buffer.from(saltHex, "hex"), hashHex.length / 2, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * Number(n) * Number(r) * 2,
    });
    const expected = Buffer.from(hashHex, "hex");
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function secretKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_SECRET manquant ou trop court (>=16 caracteres). Voir .env.example et docs/DEPLOYMENT.md."
    );
  }
  return crypto.scryptSync(secret, "shalo-com-space::secrets", 32, { N: 8192, r: 8, p: 1 });
}

/** Chiffre un secret (jeton API, cle fournisseur IA). Jamais renvoye au navigateur. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const [version, ivB64, dataB64, tagB64] = payload.split(".");
    if (version !== "v1") return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskSecret(value: string | null): string {
  if (!value) return "";
  return value.length <= 4 ? "••••" : `${value.slice(0, 2)}••••${value.slice(-4)}`;
}
