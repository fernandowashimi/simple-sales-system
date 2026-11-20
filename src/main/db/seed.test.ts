import { readFileSync } from 'node:fs'
import { beforeEach, expect, test } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDb } from './schema'
import { listProducts } from './products'
import { parseSeedCsv, seedProductsIfEmpty } from './seed'

let db: DatabaseSync
beforeEach(() => {
  db = openDb(':memory:')
})

test('parseSeedCsv takes column 1, skips header/blank/extra columns', () => {
  expect(parseSeedCsv('﻿Nome do produto;Quantidade;;;\r\nAbiu E4;3;;;\r\n\r\nRambutam hermafrodita;3;;;8\r\n;;;;\r\n')).toEqual([
    'Abiu E4',
    'Rambutam hermafrodita'
  ])
})

test('seeds real file: 142 names, accents intact', () => {
  const names = parseSeedCsv(readFileSync('resources/produtos-seed.csv', 'utf8'))
  expect(names).toHaveLength(142)
  expect(seedProductsIfEmpty(db, names)).toBe(142)
  const all = listProducts(db).map((p) => p.name)
  expect(all).toContain('Abiu Solimões')
  expect(all).toContain('Jaca Rosa ES')
})

test('second seed is a no-op; duplicates in input skipped', () => {
  expect(seedProductsIfEmpty(db, ['Jaca King', 'jaca  KING'.toLowerCase()])).toBe(1)
  expect(seedProductsIfEmpty(db, ['Y'])).toBe(0)
})
