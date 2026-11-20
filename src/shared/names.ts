const CONNECTORS = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])

const collapse = (s: string): string => s.trim().replace(/\s+/g, ' ')

/** Duplicate-detection key: accent/case/whitespace-insensitive. */
export function nameKey(raw: string): string {
  return collapse(raw).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

/** Display name: Capitalize each word, keep connectors lowercase and ALL-CAPS tokens (ES, RJ, Z4, J-33). */
export function normalizeName(raw: string): string {
  return collapse(raw)
    .split(' ')
    .filter(Boolean)
    .map((word, i) => {
      if (word.length >= 2 && word === word.toUpperCase() && /[\p{L}\d]/u.test(word)) return word
      const lower = word.toLowerCase()
      if (i > 0 && CONNECTORS.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length]
}

export function isSimilar(a: string, b: string): boolean {
  const ka = nameKey(a)
  const kb = nameKey(b)
  if (!ka || !kb) return false
  return ka === kb || ka.startsWith(kb) || kb.startsWith(ka) || levenshtein(ka, kb) <= 2
}

export function findSimilar<T extends { name: string }>(name: string, items: T[], max = 3): T[] {
  return items.filter((it) => isSimilar(name, it.name)).slice(0, max)
}
