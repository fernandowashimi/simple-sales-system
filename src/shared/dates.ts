const pad = (n: number): string => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (never toISOString: that is UTC). */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
