import { expect, test } from 'vitest'
import { formatDateBR, todayISO } from './dates'

test('todayISO uses local date late at night', () => {
  expect(todayISO(new Date(2026, 10, 19, 23, 30))).toBe('2026-11-19')
})
test('formatDateBR', () => expect(formatDateBR('2026-11-05')).toBe('05/11/2026'))
