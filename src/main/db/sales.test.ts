import { beforeEach, expect, test } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb } from './schema'
import { createProduct, deleteProduct, listBuyers, ProductInUseError } from './products'
import { deleteSale, getSale, listSaleRows, saveSale, ValidationError } from './sales'
import type { SaleInput } from '../../shared/types'

let db: DatabaseSync
let p1: number
let p2: number
const base = (over: Partial<SaleInput> = {}): SaleInput => ({
  buyerId: null,
  newBuyerName: null,
  date: '2026-11-19',
  shipped: false,
  paidCents: 0,
  items: [{ productId: p1, quantity: 2, unitPriceCents: 4500 }],
  ...over
})

beforeEach(() => {
  db = openDb(':memory:')
  p1 = createProduct(db, 'Jaca Sidhu').id
  p2 = createProduct(db, 'Jaca King').id
})

test('saves sale with new buyer in one go', () => {
  const id = saveSale(db, base({ newBuyerName: 'joão silva' }))
  expect(getSale(db, id)).toMatchObject({
    buyerName: 'João Silva',
    shipped: false,
    items: [{ productId: p1, productName: 'Jaca Sidhu', quantity: 2, unitPriceCents: 4500 }]
  })
})

test('sale without buyer allowed', () => {
  const id = saveSale(db, base())
  expect(getSale(db, id)).toMatchObject({ buyerId: null, buyerName: null })
})

test.each([
  ['no items', { items: [] }],
  ['qty 0', { items: [{ productId: 1, quantity: 0, unitPriceCents: 1 }] }],
  ['qty fraction', { items: [{ productId: 1, quantity: 1.5, unitPriceCents: 1 }] }],
  ['negative price', { items: [{ productId: 1, quantity: 1, unitPriceCents: -1 }] }],
  ['bad date', { date: '19/11/2026' }],
  ['impossible date', { date: '2026-02-31' }],
  ['paid > total', { paidCents: 9001 }],
  ['negative paid', { paidCents: -1 }],
  ['fractional paid', { paidCents: 1.5 }]
])('rejects %s and writes nothing', (_, over) => {
  expect(() => saveSale(db, base({ newBuyerName: 'Ana', ...over }))).toThrow(ValidationError)
  expect(listSaleRows(db)).toEqual([])
  expect(listBuyers(db)).toEqual([])
})

test('edit replaces items atomically', () => {
  const id = saveSale(db, base({ items: [{ productId: p1, quantity: 1, unitPriceCents: 100 }, { productId: p2, quantity: 3, unitPriceCents: 200 }] }))
  saveSale(db, base({ id, shipped: true, items: [{ productId: p2, quantity: 5, unitPriceCents: 300 }] }))
  expect(getSale(db, id)).toMatchObject({ shipped: true, items: [{ productId: p2, quantity: 5 }] })
  expect(getSale(db, id)!.items).toHaveLength(1)

  expect(() => saveSale(db, base({ id, newBuyerName: 'Ana', items: [{ productId: 9999, quantity: 1, unitPriceCents: 1 }] }))).toThrow()
  expect(getSale(db, id)!.items).toEqual([{ productId: p2, productName: 'Jaca King', quantity: 5, unitPriceCents: 300 }])
  expect(listBuyers(db)).toEqual([])
})

test('listSaleRows computes subtotal and orders newest first', () => {
  saveSale(db, base({ date: '2026-11-01' }))
  saveSale(db, base({ date: '2026-11-10', items: [{ productId: p2, quantity: 3, unitPriceCents: 250 }] }))
  const rows = listSaleRows(db)
  expect(rows.map((r) => r.date)).toEqual(['2026-11-10', '2026-11-01'])
  expect(rows[0]).toMatchObject({ productName: 'Jaca King', subtotalCents: 750, buyerName: null, shipped: false })
})

test('deleteProduct used in sale throws ProductInUseError', () => {
  saveSale(db, base())
  expect(() => deleteProduct(db, p1)).toThrow(ProductInUseError)
  deleteProduct(db, p2)
})

test('deleteSale cascades items', () => {
  const id = saveSale(db, base())
  deleteSale(db, id)
  expect(getSale(db, id)).toBeNull()
  expect(listSaleRows(db)).toEqual([])
  deleteProduct(db, p1)
})

test('paidCents round-trips and drives payment on rows', () => {
  const id = saveSale(db, base({ paidCents: 3000 }))
  expect(getSale(db, id)!.paidCents).toBe(3000)
  expect(listSaleRows(db)[0]).toMatchObject({ paidCents: 3000, saleTotalCents: 9000, payment: 'deposit' })
  saveSale(db, base({ id, paidCents: 9000 }))
  expect(listSaleRows(db)[0].payment).toBe('paid')
})

test('saleTotalCents sums all items of the sale on every row', () => {
  saveSale(db, base({ items: [{ productId: p1, quantity: 1, unitPriceCents: 100 }, { productId: p2, quantity: 2, unitPriceCents: 50 }] }))
  expect(listSaleRows(db).map((r) => r.saleTotalCents)).toEqual([200, 200])
})

test('opening a pre-sinal database adds paid_cents and keeps sales as pending', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vendas-'))
  const path = join(dir, 'old.db')
  try {
    // v1.0.1 schema: sales has no paid_cents
    const old = new DatabaseSync(path)
    old.exec(`
      CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE buyers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE sales (id INTEGER PRIMARY KEY, buyer_id INTEGER NULL REFERENCES buyers(id), date TEXT NOT NULL, shipped INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE sale_items (id INTEGER PRIMARY KEY, sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT, quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0));
      INSERT INTO products (id, name, name_key) VALUES (1, 'Jaca', 'jaca');
      INSERT INTO sales (id, date) VALUES (1, '2026-11-01');
      INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_cents) VALUES (1, 1, 1, 500);
    `)
    old.close()
    const reopened = openDb(path)
    try {
      expect(listSaleRows(reopened)[0]).toMatchObject({ saleId: 1, paidCents: 0, saleTotalCents: 500, payment: 'pending' })
    } finally {
      reopened.close()
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
