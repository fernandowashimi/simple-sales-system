import { beforeEach, expect, test } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './schema'
import { createProduct, DuplicateNameError, findOrCreateBuyer, listBuyers, listProducts, renameProduct } from './products'

let db: DatabaseSync
beforeEach(() => {
  db = openDb(':memory:')
})

test('createProduct normalizes', () => {
  expect(createProduct(db, ' jaca  sidhu ').name).toBe('Jaca Sidhu')
  expect(listProducts(db).map((p) => p.name)).toEqual(['Jaca Sidhu'])
})

test('duplicate by accent/case throws DuplicateNameError', () => {
  createProduct(db, 'Jaca Sidhu')
  expect(() => createProduct(db, 'JACA SÍDHU')).toThrow(DuplicateNameError)
})

test('rename collision reports existing name', () => {
  createProduct(db, 'Jaca Sidhu')
  const b = createProduct(db, 'Jaca King')
  let err: unknown
  try {
    renameProduct(db, b.id, 'jaca  sídhu')
  } catch (e) {
    err = e
  }
  expect(err).toBeInstanceOf(DuplicateNameError)
  expect((err as DuplicateNameError).existingName).toBe('Jaca Sidhu')
  expect((err as Error).message).toBe('Já existe: Jaca Sidhu')
})

test('rename to own key is allowed', () => {
  const p = createProduct(db, 'Jaca king')
  expect(renameProduct(db, p.id, 'jaca KING')).toEqual({ id: p.id, name: 'Jaca KING' })
})

test('findOrCreateBuyer reuses by key', () => {
  const a = findOrCreateBuyer(db, 'joão silva')
  expect(findOrCreateBuyer(db, 'Joao  Silva')).toBe(a)
  expect(listBuyers(db)).toEqual([{ id: a, name: 'João Silva' }])
})
