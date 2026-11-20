import { expect, test } from 'vitest'
import { formatBRL, formatPriceInput, parsePriceBR } from './money'

test.each([
  ['R$ 1.234,56', 123456],
  ['45,5', 4550],
  ['45', 4500],
  ['0', 0],
  ['', null],
  ['-3', null],
  ['abc', null],
  ['1,234', null],
  ['45.50', 4550],
  ['45.5', 4550],
  ['1.234', 123400],
  ['1.234.567,8', 123456780],
  ['12.3456', null]
])('parsePriceBR(%s) = %s', (input, expected) => {
  expect(parsePriceBR(input)).toBe(expected)
})
test('formatBRL', () => expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56'))
test('formatPriceInput', () => {
  expect(formatPriceInput(4550)).toBe('45,50')
  expect(formatPriceInput(123456)).toBe('1.234,56')
  expect(formatPriceInput(0)).toBe('0,00')
})
