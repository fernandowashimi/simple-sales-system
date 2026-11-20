import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { openDb } from './db/schema'
import { createProduct, listProducts } from './db/products'
import { backupDb } from './backup'

test('file DB uses rollback journal so vendas.db alone holds every committed sale', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vendas-'))
  const db = openDb(join(dir, 'vendas.db'))
  expect(db.prepare('PRAGMA journal_mode').get()).toMatchObject({ journal_mode: 'delete' })
  createProduct(db, 'Jaca Sidhu')
  expect(existsSync(join(dir, 'vendas.db-wal'))).toBe(false)
})

test('backup copy contains the data', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'vendas-'))
  const db = openDb(join(dir, 'vendas.db'))
  createProduct(db, 'Jaca Sidhu')
  const dest = join(dir, 'copia.db')
  await backupDb(db, dest)
  expect(listProducts(openDb(dest)).map((p) => p.name)).toEqual(['Jaca Sidhu'])
})
