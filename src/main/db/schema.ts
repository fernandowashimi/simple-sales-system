import { DatabaseSync } from 'node:sqlite'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS buyers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY, buyer_id INTEGER NULL REFERENCES buyers(id),
  date TEXT NOT NULL, shipped INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0));
CREATE INDEX IF NOT EXISTS sale_items_sale_id ON sale_items(sale_id);
`

export function openDb(path: string): DatabaseSync {
  const db = new DatabaseSync(path)
  // DELETE journal (not WAL): vendas.db alone is always complete, so copying/replacing it by hand is safe;
  // set explicitly because WAL mode persists in files created by earlier builds
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = DELETE;')
  db.exec(SCHEMA)
  return db
}

/** Runs fn inside BEGIN/COMMIT; rolls back and rethrows on any error. */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
