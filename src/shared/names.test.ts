import { describe, expect, test } from 'vitest'
import { findSimilar, isSimilar, nameKey, normalizeName } from './names'

describe('nameKey', () => {
  test('trims, collapses, lowercases, strips accents', () => {
    expect(nameKey(' João  Silva')).toBe('joao silva')
  })
})

describe('normalizeName', () => {
  test.each([
    ['jabuticaba branca gigante', 'Jabuticaba Branca Gigante'],
    ['Jaca rosa ES', 'Jaca Rosa ES'],
    ['Jabuticaba Sabará de cabinho', 'Jabuticaba Sabará de Cabinho'],
    ['de penca jabuticaba', 'De Penca Jabuticaba'],
    ['Abiu Z4', 'Abiu Z4'],
    ['Jaca J-33', 'Jaca J-33'],
    ['  artocarpus   HIRSUTUS ', 'Artocarpus HIRSUTUS'],
    ['jaca e manga', 'Jaca e Manga']
  ])('%s -> %s', (raw, expected) => {
    expect(normalizeName(raw)).toBe(expected)
  })
})

describe('similarity', () => {
  test('prefix is similar', () => expect(isSimilar('João Si', 'João Silva')).toBe(true))
  test('distance 1 is similar', () => expect(isSimilar('Joao Silvo', 'João Silva')).toBe(true))
  test('unrelated is not similar', () => expect(isSimilar('Maria', 'João Silva')).toBe(false))
  test('findSimilar caps at 3', () => {
    const items = [{ name: 'João Silva' }, { name: 'João Souza' }, { name: 'Joana' }, { name: 'Joãozinho' }, { name: 'Pedro' }]
    expect(findSimilar('joao', items)).toHaveLength(3)
  })
})
