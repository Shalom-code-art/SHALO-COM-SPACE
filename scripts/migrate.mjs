#!/usr/bin/env node
/**
 * Application des migrations SQL de SHALO COM SPACE.
 *
 * Le serveur applique automatiquement les migrations au demarrage (src/lib/db.ts).
 * Ce script permet de le faire explicitement en installation, en CI ou en
 * maintenance, sans lancer l'application.
 *
 * Usage :
 *   node scripts/migrate.mjs            # applique les migrations en attente
 *   node scripts/migrate.mjs --status   # affiche l'etat sans rien modifier
 *   node scripts/migrate.mjs --reset    # supprime la base puis reapplique tout
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

function listMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Dossier de migrations introuvable : ${migrationsDir}`);
    process.exit(1);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

if (reset && !statusOnly) {
  for (const suffix of ["", "-wal", "-shm"]) {
    const target = `${databasePath}${suffix}`;
    if (fs.existsSync(target)) {
      fs.rmSync(target);
      console.log(`Supprime : ${target}`);
    }
  }
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
const files = listMigrationFiles();
const pending = files.filter((file) => !applied.has(file));

console.log(`Base de donnees : ${databasePath}`);
console.log(`Migrations disponibles : ${files.length}`);
console.log(`Deja appliquees : ${applied.size}`);
console.log(`En attente : ${pending.length}`);

if (statusOnly) {
  for (const file of files) {
    console.log(`  ${applied.has(file) ? "[appliquee]" : "[en attente]"} ${file}`);
  }
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
    console.log(`Appliquer : ${file}`);
  } catch (error) {
    db.exec("ROLLBACK");
    console.error(`Echec de ${file} : ${error.message}`);
    db.close();
    process.exit(1);
  }
}

console.log(pending.length === 0 ? "Aucune migration a appliquer." : "Migrations appliquees avec succes.");
db.close();
