import test from "node:test";
import assert from "node:assert/strict";
import {
  AI_LANGUAGES,
  AI_KINDS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  EDITORIAL_TONES,
  formatBytes,
  formatDateInput,
  initials,
  labelOf,
  statusBadgeClass,
  toDateInput,
} from "../src/lib/format.ts";

test("formatBytes produit des unites lisibles", () => {
  assert.equal(formatBytes(0), "0 o");
  assert.equal(formatBytes(512), "512 o");
  assert.equal(formatBytes(2048), "2.0 Ko");
  assert.equal(formatBytes(10 * 1024 * 1024), "10.0 Mo");
});

test("labelOf retourne le libelle ou la valeur brute", () => {
  assert.equal(labelOf(CONTENT_STATUSES, "draft"), "Brouillon");
  assert.equal(labelOf(CONTENT_STATUSES, "inconnu"), "inconnu");
  assert.equal(labelOf(CONTENT_STATUSES, null), "—");
});

test("statusBadgeClass fournit une classe de repli", () => {
  assert.match(statusBadgeClass("published"), /bg-brand-50/);
  assert.match(statusBadgeClass("statut-inconnu"), /bg-slate-100/);
});

test("initials conserve deux lettres", () => {
  assert.equal(initials("Awa Nkogo"), "AN");
  assert.equal(initials("shalo"), "S");
});

test("toDateInput et formatDateInput convertissent les dates ISO", () => {
  assert.equal(toDateInput("2026-03-05T10:20:00.000Z"), "2026-03-05");
  assert.equal(toDateInput(null), "");
  assert.equal(formatDateInput("2026-03-05T10:20:00.000Z"), "2026-03-05T10:20");
  assert.equal(formatDateInput("invalide"), "");
});

test("les referentiels metier sont complets", () => {
  assert.equal(Object.keys(CONTENT_STATUSES).length, 7);
  assert.equal(Object.keys(CONTENT_TYPES).length, 10);
  assert.equal(Object.keys(EDITORIAL_TONES).length, 7);
  assert.equal(Object.keys(AI_KINDS).length, 13);
  assert.equal(Object.keys(AI_LANGUAGES).length, 5);
});
