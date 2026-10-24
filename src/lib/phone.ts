export interface GhanaPhone {
  e164: string // +233XXXXXXXXX
  national: string // 0XXXXXXXXX
  network: 'MTN' | 'Telecel' | 'AT' | 'Other'
}

const MTN = ['24', '25', '53', '54', '55', '59']
const TELECEL = ['20', '50']
const AT = ['26', '27', '56', '57']
const ALL = [...MTN, ...TELECEL, ...AT, '23', '28', '29']

/** Accepts 0547557772, 547557772, 233547557772, +233 54 755 7772, 00233... */
export function normalizeGhPhone(input: string): GhanaPhone | null {
  let d = input.replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('233')) d = d.slice(3)
  else if (d.startsWith('0')) d = d.slice(1)
  if (!/^\d{9}$/.test(d)) return null
  const prefix = d.slice(0, 2)
  if (!ALL.includes(prefix)) return null
  const network = MTN.includes(prefix) ? 'MTN' : TELECEL.includes(prefix) ? 'Telecel' : AT.includes(prefix) ? 'AT' : 'Other'
  return { e164: `+233${d}`, national: `0${d}`, network }
}
