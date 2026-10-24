import { Button, Card, useTitle } from '../components/ui/ui'
import { Logo, LogoSymbol, lockupSvg } from '../components/brand/Logo'
import { downloadFile } from '../components/admin/kit'

const toPng = (svg: string, w: number, h: number, name: string) => {
  const img = new Image()
  img.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d')!.drawImage(img, 0, 0, w, h); c.toBlob((b) => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click() }) }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const VARIANTS = [
  { name: 'Primary horizontal', kind: 'horizontal', tone: 'color', w: 840, h: 200, bg: 'bg-[#FFF8EF]' },
  { name: 'Stacked', kind: 'stacked', tone: 'color', w: 600, h: 500, bg: 'bg-[#FFF8EF]' },
  { name: 'Single colour', kind: 'horizontal', tone: 'mono', w: 840, h: 200, bg: 'bg-[#FFF8EF]' },
  { name: 'Dark background', kind: 'horizontal', tone: 'light', w: 840, h: 200, bg: 'bg-espresso' },
  { name: 'Circular avatar', kind: 'avatar', tone: 'color', w: 512, h: 512, bg: 'bg-[#FFF8EF]' },
  { name: 'Social share image', kind: 'share', tone: 'color', w: 1200, h: 630, bg: 'bg-[#FFF8EF]' },
] as const

export default function Brand() {
  useTitle('Brand assets')
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold">Brand assets</h1>
      <p className="mt-2 mb-8 text-ink-700">Download SVG or PNG. Lettering uses Kaushan Script; install it (free on Google Fonts) before editing the SVGs in a design tool.</p>
      <div className="mb-8 flex flex-wrap items-center gap-6 rounded-3xl bg-white p-6 shadow-card"><Logo size={150} tagline /><LogoSymbol size={64} /><LogoSymbol size={32} /><LogoSymbol size={16} /></div>
      <div className="grid gap-5 md:grid-cols-2">
        {VARIANTS.map((v) => {
          const svg = lockupSvg(v.kind, v.tone)
          return (
            <Card key={v.name} className="overflow-hidden">
              <div className={`${v.bg} grid place-items-center p-6`} dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="max-height:150px;width:100%" ') }} />
              <div className="flex items-center justify-between p-4"><b>{v.name}</b><span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => downloadFile(`rice-and-spice-${v.name.toLowerCase().replace(/\s+/g, '-')}.svg`, svg, 'image/svg+xml')}>SVG</Button><Button size="sm" variant="secondary" onClick={() => toPng(svg, v.w, v.h, `rice-and-spice-${v.name.toLowerCase().replace(/\s+/g, '-')}.png`)}>PNG</Button></span></div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
