#!/usr/bin/env node
/**
 * Application des migrations SQL pour une installation Windows autonome.
 *
 * Version sans dependance du script `scripts/migrate.mjs` : elle n'importe que
 * des modules natifs de Node, afin de fonctionner dans le paquet installe
 * (qui ne contient pas les sources TypeScript).
 *
 * Usage (depuis le dossier d'installation de l'application) :
 *   node tools/migrate-standalone.mjs            applique les migrations en attente
 *   node tools/migrate-standalone.mjs --status   affiche l'etat sans rien modifier
 *   node tools/migrate-standalone.mjs --reset    supprime la base puis reapplique tout
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const databasePath = process.env.DATABASE_PATH || path.join(root, "data", "shalo.db");
const migrationsDir = path.join(root, "db", "migrations");

const args = new Set(process.argv.slice(2));
const statusOnly = args.has("--status");
const reset = args.has("--reset");

function fail(message) {
  console.error(`Erreur : ${message}`);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  fail(`dossier de migrations introuvable : ${migrationsDir}`);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  fail(`aucun fichier .sql dans ${migrationsDir}`);
}

if (reset) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = databasePath + suffix;
    if (fs.existsSync(target)) fs.rmSync(target, { force: true });
  }
  console.log(`Base supprimee : ${databasePath}`);
}

fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new DatabaseSync(databasePath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");
db.exec(
  `CREATE TABLE IF NOT EXISTS migrations (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL UNIQUE,
     applied_at TEXT NOT NULL
   )`
);

const applied = new Set(db.prepare("SELECT name FROM migrations").all().map((row) => row.name));
const pending = files.filter((file) => !applied.has(file));

if (statusOnly) {
  console.log(`Base         : ${databasePath}`);
  console.log(`Appliquees   : ${applied.size}`);
  console.log(`En attente   : ${pending.length}`);
  for (const file of files) {
    console.log(`  ${applied.has(file) ? "[ok]     " : "[attente]"} ${file}`);
  }
  db.close();
  process.exit(0);
}

if (pending.length === 0) {
  console.log(`Base a jour : ${databasePath}`);
  db.close();
  process.exit(0);
}

for (const file of pending) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  db.exec("BEGIN");
  try {
    db.exec(sql);
    db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(file, new Date().toISOString());
    db.exec("COMMIT");
    console.log(`Appliquee : ${file}`);
  } catch (error) {
    db.exec("ROLLBACK");
    db.close();
    fail(`migration ${file} : ${error.message}`);
  }
}

console.log(`${pending.length} migration(s) appliquee(s) - base : ${databasePath}`);
db.close();
