import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../src/lib/csv.ts";

test("toCsv ajoute un BOM et separe avec le point-virgule", () => {
  const csv = toCsv(
    [{ name: "Awa", note: "ok" }],
    [
      { key: "name", label: "nom" },
      { key: "note", label: "note" },
    ]
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv.slice(1), "nom;note\r\nAwa;ok");
});

test("toCsv echappe les guillemets, separateurs et retours ligne", () => {
  const csv = toCsv(
    [{ value: 'texte;avec "guillemets"\net saut de ligne' }],
    [{ key: "value", label: "valeur" }]
  );
  assert.ok(csv.includes('"texte;avec ""guillemets""'));
});

test("toCsv utilise la fonction get pour les valeurs calculees", () => {
  const csv = toCsv(
    [{ consent: 1 }, { consent: 0 }],
    [{ key: "consent", label: "consentement", get: (row) => (row.consent ? "oui" : "non") }]
  );
  assert.ok(csv.includes("oui"));
  assert.ok(csv.includes("non"));
});

test("parseCsv detecte le separateur et relit les champs quotes", () => {
  const rows = parseCsv('nom;note\r\nAwa;"ok; vraiment"\r\n');
  assert.deepEqual(rows, [
    ["nom", "note"],
    ["Awa", "ok; vraiment"],
  ]);
});

test("parseCsv accepte la virgule et ignore les lignes vides", () => {
  const rows = parseCsv('a,b\n1,2\n\n3,4\n');
  assert.deepEqual(rows, [
    ["a", "b"],
    ["1", "2"],
    ["3", "4"],
  ]);
});

test("parseCsv retire le BOM et restaure les guillemets doubles", () => {
  const rows = parseCsv('\uFEFFnom;note\r\nAwa;"dit ""bonjour"""\r\n');
  assert.deepEqual(rows[1], ["Awa", 'dit "bonjour"']);
});
