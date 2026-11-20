import type { DatabaseSync } from 'node:sqlite'
import type { Sale, SaleInput, SaleRow } from '../../shared/types'
import { findOrCreateBuyer } from './products'
import { tx } from './schema'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

function validate(input: SaleInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)))
    throw new ValidationError('Data inválida.')
  if (input.items.length === 0) throw new ValidationError('Adicione pelo menos um produto.')
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0)
      throw new ValidationError('Quantidade deve ser um número inteiro maior que zero.')
    if (!Number.isInteger(it.unitPriceCents) || it.unitPriceCents < 0)
      throw new ValidationError('Preço inválido.')
  }
}

export function saveSale(db: DatabaseSync, input: SaleInput): number {
  validate(input)
  return tx(db, () => {
    const buyerId =
      input.buyerId ?? (input.newBuyerName?.trim() ? findOrCreateBuyer(db, input.newBuyerName) : null)
    const shipped = input.shipped ? 1 : 0
    let id: number
    if (input.id != null) {
      const r = db
        .prepare('UPDATE sales SET buyer_id = ?, date = ?, shipped = ? WHERE id = ?')
        .run(buyerId, input.date, shipped, input.id)
      if (r.changes === 0) throw new ValidationError('Venda não encontrada.')
      id = input.id
      db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(id)
    } else {
      id = Number(
        db.prepare('INSERT INTO sales (buyer_id, date, shipped) VALUES (?, ?, ?)').run(buyerId, input.date, shipped)
          .lastInsertRowid
      )
    }
    const ins = db.prepare(
      'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)'
    )
    for (const it of input.items) ins.run(id, it.productId, it.quantity, it.unitPriceCents)
    return id
  })
}

const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v))
const strOrNull = (v: unknown): string | null => (v == null ? null : String(v))

export function getSale(db: DatabaseSync, id: number): Sale | null {
  const s = db
    .prepare(
      `SELECT s.id, s.buyer_id, b.name AS buyer_name, s.date, s.shipped
       FROM sales s LEFT JOIN buyers b ON b.id = s.buyer_id WHERE s.id = ?`
    )
    .get(id)
  if (!s) return null
  const items = db
    .prepare(
      `SELECT i.product_id, p.name, i.quantity, i.unit_price_cents
       FROM sale_items i JOIN products p ON p.id = i.product_id WHERE i.sale_id = ? ORDER BY i.id`
    )
    .all(id)
    .map((r) => ({
      productId: Number(r.product_id),
      productName: String(r.name),
      quantity: Number(r.quantity),
      unitPriceCents: Number(r.unit_price_cents)
    }))
  return {
    id: Number(s.id),
    buyerId: numOrNull(s.buyer_id),
    buyerName: strOrNull(s.buyer_name),
    date: String(s.date),
    shipped: Boolean(s.shipped),
    items
  }
}

export function deleteSale(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM sales WHERE id = ?').run(id)
}

export function listSaleRows(db: DatabaseSync): SaleRow[] {
  return db
    .prepare(
      `SELECT s.id AS sale_id, i.id AS item_id, s.date, s.buyer_id, b.name AS buyer_name,
              i.product_id, p.name AS product_name, i.quantity, i.unit_price_cents, s.shipped
       FROM sale_items i JOIN sales s ON s.id = i.sale_id JOIN products p ON p.id = i.product_id
       LEFT JOIN buyers b ON b.id = s.buyer_id
       ORDER BY s.date DESC, s.id DESC, i.id ASC`
    )
    .all()
    .map((r) => ({
      saleId: Number(r.sale_id),
      itemId: Number(r.item_id),
      date: String(r.date),
      buyerId: numOrNull(r.buyer_id),
      buyerName: strOrNull(r.buyer_name),
      productId: Number(r.product_id),
      productName: String(r.product_name),
      quantity: Number(r.quantity),
      unitPriceCents: Number(r.unit_price_cents),
      subtotalCents: Number(r.quantity) * Number(r.unit_price_cents),
      shipped: Boolean(r.shipped)
    }))
}
