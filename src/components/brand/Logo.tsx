import { useState } from 'react'

export type Tone = 'color' | 'mono' | 'light'

const P = {
  color: { rice: '#24140F', spice: '#E85B0C', and: '#E85B0C', chili: '#C8301D', stem: '#2F8F4E', tag: '#24140F' },
  mono: { rice: '#24140F', spice: '#24140F', and: '#24140F', chili: '#24140F', stem: '#24140F', tag: '#24140F' },
  light: { rice: '#FFFFFF', spice: '#FF7A2E', and: '#FF7A2E', chili: '#E0402A', stem: '#4CAF6A', tag: '#FFFFFF' },
}
const SCRIPT = "'Kaushan Script','Brush Script MT',cursive"
const SANS = "'Plus Jakarta Sans',Arial,sans-serif"

/** Script lettering with chef's hat, fork, chili and swoosh. Box is 320 × 300 (+30 with tagline). */
function stackedInner(tone: Tone, tagline: boolean) {
  const c = P[tone]
  const hat = tone === 'light' ? '#FF7A2E' : c.spice
  return `
  <g transform="translate(60 0)" fill="none" stroke="${hat}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M118 80 C96 80 90 54 110 46 C114 26 142 20 156 34 C170 16 200 22 204 44 C226 46 228 76 206 80 L204 96 L120 96 Z"/>
    <path d="M121 88 H203"/>
  </g>
  <text x="84" y="192" font-family="${SCRIPT}" font-size="108" fill="${c.rice}">Rice</text>
  <text x="318" y="168" font-family="${SCRIPT}" font-size="46" fill="${c.and}" transform="rotate(-8 318 168)">and</text>
  <text x="122" y="272" font-family="${SCRIPT}" font-size="108" fill="${c.spice}">Spice</text>
  <path d="M62 120 C48 152 52 198 78 234" fill="none" stroke="${hat}" stroke-width="6" stroke-linecap="round"/>
  <path d="M52 104 V124 M62 102 V124 M72 104 V124 M52 124 Q62 136 72 124" fill="none" stroke="${hat}" stroke-width="4.5" stroke-linecap="round"/>
  <g transform="translate(120 4)"><path d="M286 190 C300 214 288 252 246 266 C262 246 270 222 270 200 Z" fill="${c.chili}"/>
  <path d="M278 188 C282 176 290 172 296 170" fill="none" stroke="${c.stem}" stroke-width="5" stroke-linecap="round"/></g>
  <path d="M84 290 C170 304 300 300 392 280" fill="none" stroke="${hat}" stroke-width="5" stroke-linecap="round"/>
  ${tagline ? `<text x="236" y="332" text-anchor="middle" font-family="${SANS}" font-weight="700" font-size="15" letter-spacing="3.2" fill="${c.tag}">GOOD FOOD  •  GREAT VIBES</text>` : ''}`
}

/**
 * Uses the owner's official artwork at /logo.png (square, transparent PNG) when present,
 * otherwise falls back to the SVG recreation below.
 */
export function Logo({ tone = 'color', size = 56, tagline = false }: { tone?: Tone; size?: number; tagline?: boolean }) {
  const [missing, setMissing] = useState(false)
  if (!missing) return <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Rice and Spice, Good Food Great Vibes" height={size} width={size} onError={() => setMissing(true)} style={{ height: size, width: size, objectFit: 'contain', display: 'block' }} />
  const h = tagline ? 342 : 312
  return (
    <svg role="img" aria-label="Rice and Spice" viewBox={`30 10 400 ${h - 10}`} height={size} style={{ width: 'auto', display: 'block' }} dangerouslySetInnerHTML={{ __html: stackedInner(tone, tagline) }} />
  )
}

/** Compact symbol: orange disc, cream chef's hat, rice grains, spice dot. Works in favicons. */
export function LogoSymbol({ size = 40, tone = 'color' }: { size?: number; tone?: Tone }) {
  const disc = tone === 'mono' ? '#24140F' : tone === 'light' ? '#FFF8EF' : '#E85B0C'
  const hat = tone === 'light' ? '#E85B0C' : '#FFF8EF'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Rice and Spice symbol">
      <circle cx="32" cy="32" r="31" fill={disc} />
      <g fill={hat}><circle cx="22" cy="26" r="9" /><circle cx="32" cy="21" r="10" /><circle cx="42" cy="26" r="9" /><rect x="20" y="31" width="24" height="14" rx="3" /></g>
      <g fill={disc}><ellipse cx="27" cy="38" rx="2" ry="4" transform="rotate(-20 27 38)" /><ellipse cx="33" cy="38" rx="2" ry="4" /><ellipse cx="39" cy="38" rx="2" ry="4" transform="rotate(20 39 38)" /></g>
      <circle cx="49" cy="15" r="3.5" fill="#FFCF45" />
    </svg>
  )
}

const sym = (x: number, y: number, s: number, tone: Tone) => {
  const disc = tone === 'mono' ? '#24140F' : tone === 'light' ? '#FFF8EF' : '#E85B0C'
  const hat = tone === 'light' ? '#E85B0C' : '#FFF8EF'
  return `<g transform="translate(${x} ${y}) scale(${s / 64})"><circle cx="32" cy="32" r="31" fill="${disc}"/><g fill="${hat}"><circle cx="22" cy="26" r="9"/><circle cx="32" cy="21" r="10"/><circle cx="42" cy="26" r="9"/><rect x="20" y="31" width="24" height="14" rx="3"/></g><g fill="${disc}"><ellipse cx="27" cy="38" rx="2" ry="4" transform="rotate(-20 27 38)"/><ellipse cx="33" cy="38" rx="2" ry="4"/><ellipse cx="39" cy="38" rx="2" ry="4" transform="rotate(20 39 38)"/></g><circle cx="49" cy="15" r="3.5" fill="#FFCF45"/></g>`
}

/** Standalone SVG lockups for the brand page. Lettering needs the Kaushan Script font installed. */
export function lockupSvg(kind: 'horizontal' | 'stacked' | 'avatar' | 'share', tone: Tone): string {
  const dark = tone === 'light'
  const bg = (w: number, h: number) => `<rect width="${w}" height="${h}" fill="${dark ? '#24140F' : '#FFF8EF'}"/>`
  if (kind === 'stacked') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="30 10 400 340">${bg(460, 360)}${stackedInner(tone, true)}</svg>`
  if (kind === 'horizontal') {
    const c = P[tone]
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 124">${bg(520, 124)}${sym(16, 28, 64, tone)}<text x="94" y="78" font-family="${SCRIPT}" font-size="58" fill="${c.rice}">Rice <tspan font-size="30" fill="${c.and}">and</tspan> <tspan fill="${c.spice}">Spice</tspan></text><text x="98" y="110" font-family="${SANS}" font-weight="700" font-size="11" letter-spacing="3" fill="${c.tag}" opacity=".85">GOOD FOOD  •  GREAT VIBES</text></svg>`
  }
  if (kind === 'avatar') return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="${dark ? '#E85B0C' : '#FFF8EF'}"/>${sym(70, 70, 260, dark ? 'light' : 'color')}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${dark ? '#24140F' : '#FFF8EF'}"/><g transform="translate(300 70) scale(1.5)">${stackedInner(tone, true)}</g></svg>`
}
