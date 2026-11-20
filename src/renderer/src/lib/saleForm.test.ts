import { expect, test } from 'vitest'
import { isBlank, resolveBuyer, toSaleInput, withTrailingBlank, type SaleDraft } from './saleForm'

const buyers = [{ id: 1, name: 'João Silva' }]
const base: SaleDraft = { buyerText: '', buyerId: null, date: '2026-11-19', shipped: false, items: [] }

test('resolveBuyer: blank -> no buyer', () => {
  expect(resolveBuyer('  ', null, buyers)).toEqual({ buyerId: null, newBuyerName: null })
})
test('resolveBuyer: exact key match reuses existing', () => {
  expect(resolveBuyer('joao  silva', null, buyers)).toEqual({ buyerId: 1, newBuyerName: null })
})
test('resolveBuyer: partial text becomes new buyer', () => {
  expect(resolveBuyer('João Si', null, buyers)).toEqual({ buyerId: null, newBuyerName: 'João Si' })
})
test('resolveBuyer: selected id wins', () => {
  expect(resolveBuyer('João Silva', 1, buyers)).toEqual({ buyerId: 1, newBuyerName: null })
})

test('toSaleInput drops trailing blank row and parses', () => {
  const r = toSaleInput(
    { ...base, id: 7, buyerText: 'João Silva', items: [{ productId: 1, quantity: '2', price: '45' }, { productId: null, quantity: '', price: '' }] },
    buyers
  )
  expect(r).toEqual({
    input: { id: 7, buyerId: 1, newBuyerName: null, date: '2026-11-19', shipped: false, items: [{ productId: 1, quantity: 2, unitPriceCents: 4500 }] }
  })
})

test.each([
  [[], 'Adicione pelo menos um produto.'],
  [[{ productId: null, quantity: '', price: '' }], 'Adicione pelo menos um produto.'],
  [[{ productId: 1, quantity: '0', price: '1' }], 'Linha 1: quantidade deve ser um número inteiro maior que zero.'],
  [[{ productId: 1, quantity: '1,5', price: '1' }], 'Linha 1: quantidade deve ser um número inteiro maior que zero.'],
  [[{ productId: 1, quantity: '1', price: 'x' }], 'Linha 1: preço inválido.'],
  [[{ productId: 1, quantity: '1', price: '1' }, { productId: null, quantity: '2', price: '1' }], 'Linha 2: escolha um produto.']
])('toSaleInput rejects %j', (items, error) => {
  expect(toSaleInput({ ...base, items }, buyers)).toEqual({ error })
})

test('withTrailingBlank keeps exactly one blank row at the end, with stable uids', () => {
  const a = { uid: 1, productId: 1, quantity: '1', price: '1' }
  const rows = withTrailingBlank([a, { uid: 2, productId: null, quantity: '', price: '' }, { uid: 3, productId: null, quantity: '', price: '' }])
  expect(rows).toHaveLength(2)
  expect(rows[0]).toBe(a)
  expect(isBlank(rows[1])).toBe(true)
  const fresh = withTrailingBlank([])
  expect(fresh).toHaveLength(1)
  expect(withTrailingBlank([a])[1].uid).not.toBe(withTrailingBlank([a])[1].uid)
})
