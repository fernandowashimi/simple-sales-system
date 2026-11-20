import type { Buyer, SaleInput } from '../../../shared/types'
import { nameKey } from '../../../shared/names'
import { parsePriceBR } from '../../../shared/money'

/** `uid` is a stable React key so removing a middle row never shifts another row's inputs. */
export type ItemDraft = { uid?: number; productId: number | null; quantity: string; price: string }
export type SaleDraft = { id?: number; buyerText: string; buyerId: number | null; date: string; shipped: boolean; items: ItemDraft[] }

let nextUid = 1
export const blankItem = (): ItemDraft => ({ uid: nextUid++, productId: null, quantity: '', price: '' })
export const withUid = (it: Omit<ItemDraft, 'uid'>): ItemDraft => ({ ...it, uid: nextUid++ })
export const isBlank = (it: ItemDraft): boolean => it.productId == null && !it.quantity.trim() && !it.price.trim()

/** Exactly one blank row at the end to type into: extra trailing blanks dropped, the first one kept. */
export function withTrailingBlank(items: ItemDraft[]): ItemDraft[] {
  let end = items.length
  while (end > 0 && isBlank(items[end - 1])) end--
  return end < items.length ? items.slice(0, end + 1) : [...items, blankItem()]
}

/** A selected buyer wins; otherwise an exact key match reuses an existing buyer; any other text is a new buyer. */
export function resolveBuyer(buyerText: string, buyerId: number | null, buyers: Buyer[]): { buyerId: number | null; newBuyerName: string | null } {
  if (buyerId != null) return { buyerId, newBuyerName: null }
  const key = nameKey(buyerText)
  if (!key) return { buyerId: null, newBuyerName: null }
  const match = buyers.find((b) => nameKey(b.name) === key)
  return match ? { buyerId: match.id, newBuyerName: null } : { buyerId: null, newBuyerName: buyerText.trim() }
}

export function toSaleInput(draft: SaleDraft, buyers: Buyer[]): { input: SaleInput } | { error: string } {
  const filled = draft.items.map((it, i) => ({ it, line: i + 1 })).filter(({ it }) => !isBlank(it))
  if (filled.length === 0) return { error: 'Adicione pelo menos um produto.' }
  const items: SaleInput['items'] = []
  for (const { it, line } of filled) {
    if (it.productId == null) return { error: `Linha ${line}: escolha um produto.` }
    const q = it.quantity.trim()
    if (!/^\d+$/.test(q) || Number(q) <= 0) return { error: `Linha ${line}: quantidade deve ser um número inteiro maior que zero.` }
    const cents = parsePriceBR(it.price)
    if (cents == null) return { error: `Linha ${line}: preço inválido.` }
    items.push({ productId: it.productId, quantity: Number(q), unitPriceCents: cents })
  }
  return {
    input: {
      ...(draft.id != null ? { id: draft.id } : {}),
      ...resolveBuyer(draft.buyerText, draft.buyerId, buyers),
      date: draft.date,
      shipped: draft.shipped,
      items
    }
  }
}
