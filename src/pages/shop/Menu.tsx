import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState, useTitle } from '../../components/ui/ui'
import { assetUrl, AvailabilityPill, BackLink, FoodImage, itemImage } from '../../components/shop/bits'
import { Configurator } from '../../components/shop/Configurator'
import { useDB } from '../../data/store'
import { formatGHS } from '../../lib/money'
import { UtensilsCrossed } from 'lucide-react'

export function Menu() {
  useTitle('Our Menu', 'Pre-order fresh meals from Rice and Spice.')
  const cats = useDB((d) => d.categories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder))
  const items = useDB((d) => d.items.filter((i) => i.active).sort((a, b) => a.sortOrder - b.sortOrder))
  const shown = cats.filter((c) => items.some((i) => i.categoryId === c.id))
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Menu</h1>
      <p className="mt-2 mb-10 text-ink-700">All meals are made fresh and available by pre-order only.</p>
      {shown.length === 0 && <EmptyState icon={<UtensilsCrossed size={36} />} title="The menu is being prepared" body="Check back soon, or message us on WhatsApp." />}
      {shown.map((c) => (
        <section key={c.id} className="mb-12" aria-labelledby={c.id}>
          <h2 id={c.id} className="mb-5 text-2xl font-bold">{c.name}</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.filter((i) => i.categoryId === c.id).map((i) => (
              <Link key={i.id} to={`/menu/${i.slug}`} className="group overflow-hidden rounded-3xl border border-line bg-white shadow-card transition hover:-translate-y-1">
                <div className="overflow-hidden"><FoodImage src={itemImage(i)} alt={i.name} className="aspect-[4/3] w-full transition group-hover:scale-105" /></div>
                <div className="p-5">
                  <h3 className="text-xl font-bold">{i.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-700">{i.description}</p>
                  <div className="mt-4 flex items-center justify-between"><span className="text-xl font-extrabold">{formatGHS(i.price)}</span><span className="text-sm font-bold text-brand-700">Pre-order →</span></div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export function Product() {
  const { slug } = useParams()
  const item = useDB((d) => d.items.find((i) => i.slug === slug && i.active))
  useTitle(item?.name ?? 'Not found', item?.description)
  if (!item) return <div className="mx-auto max-w-xl px-4 py-20"><EmptyState title="We couldn't find that meal" action={<Link to="/menu"><Button>Back to menu</Button></Link>} /></div>
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <BackLink to="/menu">Menu</BackLink>
      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <FoodImage src={item.images[0]} alt={item.name} className="aspect-[4/3] w-full" />
          {item.images.length > 1 && <div className="mt-4 flex gap-2">{item.images.slice(1).map((s, n) => <img key={n} src={assetUrl(s)} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover" />)}</div>}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{item.name}</h1>
          <p className="mt-2"><AvailabilityPill itemIds={[item.id]} /></p>
          <p className="mt-4 text-lg text-ink-700">{item.description}</p>
          {(item.allergens || item.dietary) && <dl className="mt-4 space-y-1 text-sm text-ink-700">{item.allergens && <div><dt className="inline font-bold">Allergens: </dt><dd className="inline">{item.allergens}</dd></div>}{item.dietary && <div><dt className="inline font-bold">Dietary: </dt><dd className="inline">{item.dietary}</dd></div>}</dl>}
          <p className="mt-5 mb-6 text-3xl font-extrabold">{formatGHS(item.price)}</p>
          <Configurator item={item} />
        </div>
      </div>
    </div>
  )
}
