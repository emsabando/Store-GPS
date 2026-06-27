import type { Store } from '../types'

/** A store the user can pick, as returned by a locator. */
export interface StoreSummary {
  id: string
  name: string
  address: string
  /** Banner/brand name for chains with sub-brands (Kroger, Ralphs, Fry's…). */
  banner?: string
  /** Distance from the searched ZIP in miles, when applicable. */
  distanceMiles?: number
}

/**
 * Abstraction over a source of store + product data. The UI talks only to this
 * interface, so the mock catalog and a live retailer API are interchangeable.
 *
 * Two shapes of provider:
 *  - 'catalog': the full product list for a store is known up front (mock).
 *  - 'live': products are only resolved per search query against a remote API
 *    (Kroger), so the map is built from whatever a search returns.
 */
export interface DataProvider {
  id: string
  label: string
  mode: 'catalog' | 'live'
  /** True when stores are discovered by ZIP rather than a fixed demo list. */
  locatesByZip: boolean
  /** Optional human note shown in the UI (e.g. credential hints). */
  note?: string

  listStores(opts?: { zip?: string }): Promise<StoreSummary[]>

  /**
   * Returns a renderable store. For 'catalog' providers this includes all
   * products. For 'live' providers it's a shell (entrance/checkout only) and
   * products come from searchStore().
   */
  getStore(id: string): Promise<Store>

  /** 'live' providers only: a result-scoped store built from a search term. */
  searchStore?(id: string, term: string): Promise<Store>
}
