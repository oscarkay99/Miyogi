/** All money is stored as integer pesewas (1 GHS = 100 pesewas). */
export type Pesewas = number

export function formatGHS(p: Pesewas): string {
  const cedis = p / 100
  return `GH₵${cedis.toLocaleString('en-GH', {
    minimumFractionDigits: p % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function toPesewas(cedis: number | string): Pesewas {
  const n = Number(cedis)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const toCedis = (p: Pesewas) => (p / 100).toFixed(2)
