import { expect, test } from 'vitest'
import { paymentStatus } from './payment'

test.each([
  [0, 1000, 'pending'],
  [1, 1000, 'deposit'],
  [999, 1000, 'deposit'],
  [1000, 1000, 'paid'],
  [0, 0, 'pending']
])('paymentStatus(%i, %i) = %s', (paid, total, s) => expect(paymentStatus(paid, total)).toBe(s))
