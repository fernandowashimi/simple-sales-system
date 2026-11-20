import type { PaymentStatus } from './payment'

export type Product = { id: number; name: string }
export type Buyer = { id: number; name: string }
export type SaleItemInput = { productId: number; quantity: number; unitPriceCents: number }
export type SaleInput = {
  id?: number
  buyerId: number | null
  newBuyerName: string | null
  date: string
  shipped: boolean
  paidCents: number
  items: SaleItemInput[]
}
export type Sale = {
  id: number
  buyerId: number | null
  buyerName: string | null
  date: string
  shipped: boolean
  paidCents: number
  items: (SaleItemInput & { productName: string })[]
}
export type SaleRow = {
  saleId: number
  itemId: number
  date: string
  buyerId: number | null
  buyerName: string | null
  productId: number
  productName: string
  quantity: number
  unitPriceCents: number
  subtotalCents: number
  shipped: boolean
  paidCents: number
  saleTotalCents: number
  payment: PaymentStatus
}
