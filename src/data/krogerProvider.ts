import type { Availability, Store } from '../types'
import type { DataProvider, StoreSummary } from './provider'
import { buildStore, PALETTE, type LayoutDept, type LayoutInput, type LayoutProduct } from './layout'

// Base URL of the backend proxy that holds the Kroger secret and talks to the
// Kroger API. In dev, Vite proxies /api → the local server, so '' works.
const BASE = (import.meta.env.VITE_PROXY_URL ?? '').replace(/\/$/, '')

// Shapes returned by our proxy (already normalized away from Kroger's schema).
interface ProxyStore {
  id: string
  name: string
  banner?: string
  address: string
  distanceMiles?: number
}

interface ProxyProduct {
  id: string
  name: string
  brand: string
  category: string
  price: number | null
  availability: Availability
  aisleNumber: string | null
  aisleDescription: string | null
  side: string | null
  shelf: string | null
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Proxy ${res.status}: ${body || res.statusText}`)
  }
  return res.json() as Promise<T>
}

const EMOJI_RULES: [RegExp, string][] = [
  [/milk|cream|dairy/i, '🥛'],
  [/cheese/i, '🧀'],
  [/egg/i, '🥚'],
  [/bread|bakery|bun|bagel/i, '🍞'],
  [/banana|apple|fruit|produce|veg|tomato|pepper/i, '🥦'],
  [/chicken|beef|pork|meat|steak/i, '🥩'],
  [/fish|salmon|seafood|shrimp/i, '🐟'],
  [/water|soda|cola|juice|beverage|drink/i, '🥤'],
  [/coffee|espresso/i, '☕'],
  [/chip|snack|cracker|pretzel/i, '🥨'],
  [/candy|chocolate|cookie/i, '🍫'],
  [/cereal/i, '🥣'],
  [/pasta|noodle|rice|grain/i, '🍝'],
  [/frozen|ice cream/i, '🧊'],
  [/soap|deterg|clean|paper|towel/i, '🧼'],
  [/shampoo|beauty|lotion|health/i, '🧴'],
  [/pet|dog|cat/i, '🐾'],
]

function guessEmoji(name: string, category: string): string {
  const hay = `${name} ${category}`
  for (const [re, emoji] of EMOJI_RULES) if (re.test(hay)) return emoji
  return '🛒'
}

function aisleLabel(p: ProxyProduct): string {
  if (p.aisleNumber) return `Aisle ${p.aisleNumber}`
  if (p.aisleDescription) return p.aisleDescription
  if (p.category) return p.category
  return 'In store'
}

function locationDetail(p: ProxyProduct): string | undefined {
  const parts: string[] = []
  if (p.aisleNumber) parts.push(`Aisle ${p.aisleNumber}`)
  if (p.aisleDescription && !p.aisleNumber) parts.push(p.aisleDescription)
  if (p.side) parts.push(p.side === 'L' ? 'Left side' : p.side === 'R' ? 'Right side' : `Side ${p.side}`)
  if (p.shelf) parts.push(`Shelf ${p.shelf}`)
  return parts.length ? parts.join(' · ') : undefined
}

/** Group products into departments (one aisle each), ordered by aisle number. */
function toLayoutInput(store: ProxyStore, products: ProxyProduct[]): LayoutInput {
  const groups = new Map<string, ProxyProduct[]>()
  for (const p of products) {
    const label = aisleLabel(p)
    const list = groups.get(label) ?? []
    list.push(p)
    groups.set(label, list)
  }

  const sortKey = (label: string) => {
    const m = label.match(/Aisle (\d+)/)
    return m ? parseInt(m[1], 10) : 1000 // perimeter/unknown aisles sort last
  }

  const depts: LayoutDept[] = [...groups.entries()]
    .sort((a, b) => sortKey(a[0]) - sortKey(b[0]) || a[0].localeCompare(b[0]))
    .map(([label, items], i) => ({
      label,
      color: PALETTE[i % PALETTE.length],
      products: items.map<LayoutProduct>((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category || label,
        price: p.price,
        stock: -1, // Kroger exposes a level, not a count
        availability: p.availability,
        locationDetail: locationDetail(p),
        emoji: guessEmoji(p.name, p.category),
      })),
    }))

  return { id: store.id, name: store.name, address: store.address, depts }
}

export class KrogerProvider implements DataProvider {
  id = 'kroger'
  label = 'Kroger (live)'
  mode = 'live' as const
  locatesByZip = true
  note = 'Live aisle + availability from the Kroger API (incl. Fry’s, Ralphs, King Soopers…).'

  async listStores(opts?: { zip?: string }): Promise<StoreSummary[]> {
    const zip = opts?.zip?.trim()
    const qs = zip ? `?zip=${encodeURIComponent(zip)}` : ''
    const { stores } = await getJSON<{ stores: ProxyStore[] }>(`/api/stores${qs}`)
    return stores.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      banner: s.banner,
      distanceMiles: s.distanceMiles,
    }))
  }

  async getStore(id: string): Promise<Store> {
    const store = await getJSON<ProxyStore>(`/api/stores/${encodeURIComponent(id)}`)
    // Shell store: real name/address, no aisles until the user searches.
    return buildStore({ id: store.id, name: store.name, address: store.address, depts: [] })
  }

  async searchStore(id: string, term: string): Promise<Store> {
    const store = await getJSON<ProxyStore>(`/api/stores/${encodeURIComponent(id)}`)
    const { products } = await getJSON<{ products: ProxyProduct[] }>(
      `/api/stores/${encodeURIComponent(id)}/products?term=${encodeURIComponent(term)}`,
    )
    return buildStore(toLayoutInput(store, products))
  }
}
