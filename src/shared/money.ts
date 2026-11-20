const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 1.234,56" -> 123456 centavos; null when empty/invalid/negative. */
export function parsePriceBR(input: string): number | null {
  const s = input.replace(/R\$/gi, '').replace(/\s/g, '').replace(/\./g, '')
  const m = /^(\d+)(?:,(\d{1,2}))?$/.exec(s)
  if (!m) return null
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
}

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100)
}
