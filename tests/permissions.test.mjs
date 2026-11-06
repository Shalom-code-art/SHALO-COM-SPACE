import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_PERMISSIONS,
  COMPANY_ROLES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS,
  effectivePermissions,
  hasPermission,
  permissionGroups,
} from "../src/lib/permissions.ts";

test("le proprietaire possede toutes les permissions sauf platform.manage", () => {
  const owner = DEFAULT_ROLE_PERMISSIONS.owner;
  assert.equal(owner.includes("platform.manage"), false);
  assert.equal(owner.length, ALL_PERMISSIONS.length - 1);
});

test("l'administrateur plateforme ne dispose que de platform.manage", () => {
  assert.deepEqual(DEFAULT_ROLE_PERMISSIONS.platform_admin, ["platform.manage"]);
});

test("les 7 roles entreprise sont declares et libelles", () => {
  assert.equal(COMPANY_ROLES.length, 7);
  for (const role of COMPANY_ROLES) {
    assert.ok(ROLE_LABELS[role], `libelle manquant pour ${role}`);
    assert.ok(Array.isArray(DEFAULT_ROLE_PERMISSIONS[role]));
  }
});

test("hasPermission accepte plusieurs permissions (OU)", () => {
  assert.equal(hasPermission(["content.view"], "content.view"), true);
  assert.equal(hasPermission(["media.view"], ["content.edit", "media.view"]), true);
  assert.equal(hasPermission([], ["content.edit", "media.view"]), false);
});

test("effectivePermissions applique les surcharges d'entreprise", () => {
  const editor = effectivePermissions("editor");
  assert.ok(editor.includes("content.edit"));
  assert.ok(!editor.includes("content.delete"));

  const withDelete = effectivePermissions("editor", [{ permission: "content.delete", allowed: 1 }]);
  assert.ok(withDelete.includes("content.delete"));

  const withoutEdit = effectivePermissions("editor", [{ permission: "content.edit", allowed: 0 }]);
  assert.ok(!withoutEdit.includes("content.edit"));
});

test("une surcharge inconnue n'accorde aucun droit", () => {
  const permissions = effectivePermissions("viewer", [{ permission: "inconnue", allowed: 1 }]);
  assert.ok(!permissions.includes("inconnue"));
});

test("le lecteur ne peut pas publier ni gerer l'equipe", () => {
  const viewer = effectivePermissions("viewer");
  assert.ok(viewer.includes("content.view"));
  assert.ok(!viewer.includes("content.publish"));
  assert.ok(!viewer.includes("team.manage"));
  assert.ok(!viewer.includes("settings.manage"));
});

test("les groupes de permissions couvrent toutes les permissions sauf platform.manage", () => {
  const grouped = permissionGroups().flatMap((group) => group.permissions);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual(new Set(grouped), new Set(ALL_PERMISSIONS.filter((permission) => permission !== "platform.manage")));
});
