import { expect, test } from 'vitest'
import { emptyFilters, filterRows } from './filters'
import type { SaleRow } from '../../../shared/types'

const r = (over: Partial<SaleRow>): SaleRow => ({
  saleId: 1,
  itemId: 1,
  date: '2026-11-10',
  buyerId: 1,
  buyerName: 'João Silva',
  productId: 1,
  productName: 'Jaca King',
  quantity: 1,
  unitPriceCents: 100,
  subtotalCents: 100,
  shipped: false,
  paidCents: 0,
  saleTotalCents: 100,
  payment: 'pending',
  ...over
})

const rows: SaleRow[] = [
  r({ itemId: 1, date: '2026-11-01', shipped: true }),
  r({ itemId: 2, date: '2026-11-10', buyerId: 2, buyerName: 'Maria', productId: 2, productName: 'Lichia Emperor' }),
  r({ itemId: 3, date: '2026-11-19', buyerId: null, buyerName: null, productId: 3, productName: 'Jaca Sidhu' })
]

test('period inclusive at both ends', () => {
  expect(filterRows(rows, { ...emptyFilters, from: '2026-11-01', to: '2026-11-19' })).toHaveLength(3)
  expect(filterRows(rows, { ...emptyFilters, from: '2026-11-10', to: '2026-11-10' }).map((x) => x.itemId)).toEqual([2])
  expect(filterRows(rows, { ...emptyFilters, from: '2026-11-02' }).map((x) => x.itemId)).toEqual([2, 3])
})

test('null buyer still matches product search', () => {
  expect(filterRows(rows, { ...emptyFilters, search: 'sidhu' }).map((x) => x.itemId)).toEqual([3])
})

test('search is accent/case-insensitive across buyer and product', () => {
  expect(filterRows(rows, { ...emptyFilters, search: 'JOAO' }).map((x) => x.itemId)).toEqual([1])
  expect(filterRows(rows, { ...emptyFilters, search: 'jaca' }).map((x) => x.itemId)).toEqual([1, 3])
})

test('shipped filter', () => {
  expect(filterRows(rows, { ...emptyFilters, shipped: 'no' }).map((x) => x.itemId)).toEqual([2, 3])
  expect(filterRows(rows, { ...emptyFilters, shipped: 'yes' }).map((x) => x.itemId)).toEqual([1])
})

test('AND between fields, OR within a list', () => {
  expect(filterRows(rows, { ...emptyFilters, productIds: [1, 2] }).map((x) => x.itemId)).toEqual([1, 2])
  expect(filterRows(rows, { ...emptyFilters, productIds: [1, 2], buyerIds: [2] }).map((x) => x.itemId)).toEqual([2])
})

test('payment filter', () => {
  const rs = [r({ itemId: 1, payment: 'pending' }), r({ itemId: 2, payment: 'deposit' }), r({ itemId: 3, payment: 'paid' })]
  expect(filterRows(rs, { ...emptyFilters, payment: 'deposit' }).map((x) => x.itemId)).toEqual([2])
  expect(filterRows(rs, emptyFilters)).toHaveLength(3)
})
