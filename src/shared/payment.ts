export type PaymentStatus = 'pending' | 'deposit' | 'paid'

export function paymentStatus(paidCents: number, totalCents: number): PaymentStatus {
  if (paidCents > 0 && paidCents >= totalCents) return 'paid'
  return paidCents > 0 ? 'deposit' : 'pending'
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = { pending: 'Pendente', deposit: 'Sinal', paid: 'Pago' }
