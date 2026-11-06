import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

/**
 * Acces base de donnees relationnelle (SQLite via le module natif `node:sqlite`).
 *
 * Choix technique : zero dependance native, base relationnelle reelle,
 * migrations SQL versionnees. Le schema reste du SQL standard : la bascule
 * vers PostgreSQL ne concerne que cette couche + db/migrations.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;

const globalForDb = globalThis as unknown as { __shaloDb?: DatabaseSync };

export function databasePath(): string {
  return process.env.DATABASE_PATH || path.join(process.cwd(), "data", "shalo.db");
}

function applyMigrations(db: DatabaseSync) {
  const dir = path.join(process.cwd(), "db", "migrations");
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL UNIQUE,
       applied_at TEXT NOT NULL
     )`
  );
  if (!fs.existsSync(dir)) return;
  const applied = new Set(
    (db.prepare("SELECT name FROM migrations").all() as { name: string }[]).map((r) => r.name)
  );
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    db.exec("BEGIN");
    try {
      db.exec(sql);
      db.prepare("INSERT INTO migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${file} echouee: ${(error as Error).message}`);
    }
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb.__shaloDb) return globalForDb.__shaloDb;
  const file = databasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  applyMigrations(db);
  globalForDb.__shaloDb = db;
  return db;
}

function normalize(params: unknown[]): SqlValue[] {
  return params.map((value) => {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (value === undefined || value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "number" || typeof value === "string" || typeof value === "bigint") return value;
    if (value instanceof Uint8Array) return value;
    return JSON.stringify(value);
  });
}

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...normalize(params)) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const row = getDb().prepare(sql).get(...normalize(params));
  return (row as T) ?? null;
}

export function run(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...normalize(params));
}

export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Comptage simple et sur (sans interpolation de valeur). */
export function count(sql: string, params: unknown[] = []): number {
  const row = get<{ n: number }>(sql, params);
  return row ? Number(row.n) : 0;
}
