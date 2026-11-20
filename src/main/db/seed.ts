import type { DatabaseSync } from 'node:sqlite'
import { createProduct, DuplicateNameError } from './products'
import { tx } from './schema'

/** Product names from column 1 of the `;`-separated seed CSV (header, blanks and other columns ignored). */
export function parseSeedCsv(text: string): string[] {
  return text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(';')[0].trim())
    .filter(Boolean)
}

export function seedProductsIfEmpty(db: DatabaseSync, names: string[]): number {
  if (db.prepare('SELECT 1 FROM products LIMIT 1').get()) return 0
  return tx(db, () => {
    let inserted = 0
    for (const name of names) {
      try {
        createProduct(db, name)
        inserted++
      } catch (e) {
        if (!(e instanceof DuplicateNameError)) throw e
      }
    }
    return inserted
  })
}
