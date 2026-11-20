import type { DatabaseSync } from 'node:sqlite'
import type { Buyer, Product } from '../../shared/types'
import { nameKey, normalizeName } from '../../shared/names'

export class DuplicateNameError extends Error {
  constructor(public existingName: string) {
    super(`Já existe: ${existingName}`)
    this.name = 'DuplicateNameError'
  }
}

export class ProductInUseError extends Error {
  constructor() {
    super('Produto já foi vendido; só é possível renomear.')
    this.name = 'ProductInUseError'
  }
}

function prepareName(raw: string): { name: string; key: string } {
  const name = normalizeName(raw)
  if (!name) throw new Error('Nome não pode ficar vazio.')
  return { name, key: nameKey(name) }
}

function assertUnique(db: DatabaseSync, table: 'products' | 'buyers', key: string, exceptId = -1): void {
  const row = db.prepare(`SELECT name FROM ${table} WHERE name_key = ? AND id != ?`).get(key, exceptId)
  if (row) throw new DuplicateNameError(String(row.name))
}

const toNamed = (r: Record<string, unknown>): Product => ({ id: Number(r.id), name: String(r.name) })

export function listProducts(db: DatabaseSync): Product[] {
  return db.prepare('SELECT id, name FROM products ORDER BY name_key').all().map(toNamed)
}

export function createProduct(db: DatabaseSync, raw: string): Product {
  const { name, key } = prepareName(raw)
  assertUnique(db, 'products', key)
  const { lastInsertRowid } = db.prepare('INSERT INTO products (name, name_key) VALUES (?, ?)').run(name, key)
  return { id: Number(lastInsertRowid), name }
}

export function renameProduct(db: DatabaseSync, id: number, raw: string): Product {
  const { name, key } = prepareName(raw)
  assertUnique(db, 'products', key, id)
  db.prepare('UPDATE products SET name = ?, name_key = ? WHERE id = ?').run(name, key, id)
  return { id, name }
}

export function deleteProduct(db: DatabaseSync, id: number): void {
  if (db.prepare('SELECT 1 FROM sale_items WHERE product_id = ? LIMIT 1').get(id)) throw new ProductInUseError()
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
}

export function listBuyers(db: DatabaseSync): Buyer[] {
  return db.prepare('SELECT id, name FROM buyers ORDER BY name_key').all().map(toNamed)
}

export function findOrCreateBuyer(db: DatabaseSync, raw: string): number {
  const { name, key } = prepareName(raw)
  const row = db.prepare('SELECT id FROM buyers WHERE name_key = ?').get(key)
  if (row) return Number(row.id)
  return Number(db.prepare('INSERT INTO buyers (name, name_key) VALUES (?, ?)').run(name, key).lastInsertRowid)
}
