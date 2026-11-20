import type { SaleRow } from '../../../shared/types'
import { nameKey } from '../../../shared/names'

export type SalesFilters = {
  search: string
  from: string | null
  to: string | null
  shipped: 'all' | 'yes' | 'no'
  productIds: number[]
  buyerIds: number[]
}

export const emptyFilters: SalesFilters = {
  search: '',
  from: null,
  to: null,
  shipped: 'all',
  productIds: [],
  buyerIds: []
}

export function filterRows(rows: SaleRow[], f: SalesFilters): SaleRow[] {
  const q = nameKey(f.search)
  return rows.filter(
    (r) =>
      (!q || nameKey(r.productName).includes(q) || (r.buyerName != null && nameKey(r.buyerName).includes(q))) &&
      (!f.from || r.date >= f.from) &&
      (!f.to || r.date <= f.to) &&
      (f.shipped === 'all' || r.shipped === (f.shipped === 'yes')) &&
      (f.productIds.length === 0 || f.productIds.includes(r.productId)) &&
      (f.buyerIds.length === 0 || (r.buyerId != null && f.buyerIds.includes(r.buyerId)))
  )
}
