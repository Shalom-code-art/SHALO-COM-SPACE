import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const migrationsDir = path.join(process.cwd(), "db", "migrations");
const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith(".sql")).sort();

function freshDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  return db;
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

test("au moins une migration versionnee est presente", () => {
  assert.ok(files.length >= 1);
  assert.match(files[0], /^\d{4}_/);
});

test("aucune donnee fictive n'est inseree par les migrations", () => {
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    assert.doesNotMatch(sql, /INSERT\s+INTO/i, `${file} ne doit pas inserer de donnees`);
  }
});

test("toutes les tables metier portent company_id (isolation multi-entreprise)", () => {
  const db = freshDatabase();
  const multitenant = [
    "users",
    "invitations",
    "role_permissions",
    "contents",
    "content_revisions",
    "content_comments",
    "media",
    "campaigns",
    "social_accounts",
    "publications",
    "contacts",
    "contact_interactions",
    "product_categories",
    "products",
    "tasks",
    "analytics_snapshots",
    "publication_metrics",
    "ai_generations",
    "notifications",
    "audit_logs",
    "company_settings",
    "api_keys",
  ];
  for (const table of multitenant) {
    assert.ok(tableColumns(db, table).includes("company_id"), `${table} doit declarer company_id`);
  }
  db.close();
});

test("les index de performance existent sur les tables principales", () => {
  const db = freshDatabase();
  const indexes = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all()
    .map((row) => row.name);
  for (const index of ["idx_contents_company", "idx_contacts_company", "idx_media_company", "idx_audit_company"]) {
    assert.ok(indexes.includes(index), `index manquant : ${index}`);
  }
  db.close();
});

test("la suppression d'une entreprise supprime ses donnees liees", () => {
  const db = freshDatabase();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO companies (id, name, slug, created_at, updated_at) VALUES (?,?,?,?,?)").run(
    "co-1",
    "Entreprise Test",
    "entreprise-test",
    now,
    now
  );
  db.prepare(
    "INSERT INTO users (id, company_id, name, email, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
  ).run("u-1", "co-1", "Awa", "awa@test.local", "hash", "owner", "active", now, now);
  db.prepare(
    "INSERT INTO contents (id, company_id, type, title, body, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run("c-1", "co-1", "post", "Titre", "Corps", "draft", now, now);
  db.prepare(
    "INSERT INTO products (id, company_id, kind, name, price_cents, currency, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  ).run("p-1", "co-1", "product", "Produit", 1000, "XAF", now, now);

  db.prepare("DELETE FROM companies WHERE id = ?").run("co-1");

  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM contents").get().n, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM products").get().n, 0);
  db.close();
});

test("les contraintes d'unicite et de cle etrangere sont actives", () => {
  const db = freshDatabase();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO companies (id, name, slug, created_at, updated_at) VALUES (?,?,?,?,?)").run(
    "co-1",
    "Unique",
    "slug-unique",
    now,
    now
  );

  assert.throws(() =>
    db
      .prepare("INSERT INTO companies (id, name, slug, created_at, updated_at) VALUES (?,?,?,?,?)")
      .run("co-2", "Doublon", "slug-unique", now, now)
  );

  assert.throws(() =>
    db
      .prepare(
        "INSERT INTO users (id, company_id, name, email, password_hash, role, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)"
      )
      .run("u-x", "entreprise-inexistante", "Orphelin", "orphelin@test.local", "hash", "viewer", "active", now, now)
  );

  db.close();
});

test("le journal d'audit survit a la suppression d'une entreprise (company_id mis a null)", () => {
  const db = freshDatabase();
  const now = new Date().toISOString();
  db.prepare("INSERT INTO companies (id, name, slug, created_at, updated_at) VALUES (?,?,?,?,?)").run(
    "co-1",
    "Traçable",
    "tracable",
    now,
    now
  );
  db.prepare(
    "INSERT INTO audit_logs (id, company_id, actor_name, action, entity, created_at) VALUES (?,?,?,?,?,?)"
  ).run("a-1", "co-1", "Admin", "company.deleted", "company", now);

  db.prepare("DELETE FROM companies WHERE id = ?").run("co-1");
  const audit = db.prepare("SELECT company_id, action FROM audit_logs").all();
  assert.equal(audit.length, 1);
  assert.equal(audit[0].company_id, null);
  db.close();
});
