import test from "node:test";
import assert from "node:assert/strict";

process.env.APP_SECRET = process.env.APP_SECRET || "test-secret-shalo-com-space-0123456789";

const { decryptSecret, encryptSecret, hashPassword, maskSecret, randomToken, sha256, verifyPassword } = await import(
  "../src/lib/crypto.ts"
);

test("hashPassword produit un hachage scrypt verifiable", () => {
  const stored = hashPassword("MotDePasse!2026");
  assert.match(stored, /^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.equal(verifyPassword("MotDePasse!2026", stored), true);
  assert.equal(verifyPassword("mauvais", stored), false);
});

test("deux hachages du meme mot de passe utilisent des sels differents", () => {
  const first = hashPassword("identique");
  const second = hashPassword("identique");
  assert.notEqual(first, second);
  assert.equal(verifyPassword("identique", first), true);
  assert.equal(verifyPassword("identique", second), true);
});

test("verifyPassword refuse un hachage corrompu", () => {
  assert.equal(verifyPassword("x", "pas-un-hachage"), false);
  assert.equal(verifyPassword("x", ""), false);
});

test("encryptSecret / decryptSecret font un aller-retour AES-256-GCM", () => {
  const payload = encryptSecret("cle-api-tres-sensible");
  assert.ok(payload.startsWith("v1."));
  assert.ok(!payload.includes("cle-api-tres-sensible"));
  assert.equal(decryptSecret(payload), "cle-api-tres-sensible");
});

test("decryptSecret retourne null si le chiffre est altere", () => {
  const payload = encryptSecret("secret");
  const parts = payload.split(".");
  const tampered = `v1.${parts[1]}.${parts[2]}.${"A".repeat(parts[3].length)}`;
  assert.equal(decryptSecret(tampered), null);
  assert.equal(decryptSecret(""), null);
  assert.equal(decryptSecret(null), null);
});

test("sha256 est deterministe", () => {
  assert.equal(sha256("shalo"), sha256("shalo"));
  assert.notEqual(sha256("shalo"), sha256("shalo "));
  assert.equal(sha256("").length, 64);
});

test("randomToken genere des jetons URL-safe uniques", () => {
  const token = randomToken(24);
  assert.match(token, /^[A-Za-z0-9_-]+$/);
  assert.equal(new Set(Array.from({ length: 30 }, () => randomToken(16))).size, 30);
});

test("maskSecret ne revele que les extremites", () => {
  assert.equal(maskSecret(null), "");
  assert.equal(maskSecret("abcd"), "\u2022\u2022\u2022\u2022");
  assert.equal(maskSecret("shalo_1234567890"), `sh${"\u2022".repeat(4)}7890`);
});
