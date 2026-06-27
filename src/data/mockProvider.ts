import type { Store } from '../types'
import type { DataProvider, StoreSummary } from './provider'
import { availabilityFromStock, buildStore, type LayoutInput } from './layout'
import { MOCK_CATALOG, type StoreDef } from './stores'

// Turn a demo catalog definition into the retailer-agnostic layout input,
// deriving availability from the mock unit counts.
function toLayoutInput(def: StoreDef): LayoutInput {
  return {
    id: def.id,
    name: def.name,
    address: def.address,
    depts: def.depts.map((d) => ({
      label: d.label,
      color: d.color,
      products: d.products.map((p) => ({
        name: p.name,
        brand: p.brand,
        category: d.label,
        price: p.price,
        stock: p.stock,
        availability: availabilityFromStock(p.stock),
        emoji: p.emoji,
      })),
    })),
  }
}

export class MockProvider implements DataProvider {
  id = 'mock'
  label = 'Demo data'
  mode = 'catalog' as const
  locatesByZip = false
  note = 'Simulated stores — switch to the Kroger provider for live data.'

  async listStores(): Promise<StoreSummary[]> {
    return MOCK_CATALOG.map((d) => ({ id: d.id, name: d.name, address: d.address }))
  }

  async getStore(id: string): Promise<Store> {
    const def = MOCK_CATALOG.find((d) => d.id === id)
    if (!def) throw new Error(`Unknown store: ${id}`)
    return buildStore(toLayoutInput(def))
  }
}
