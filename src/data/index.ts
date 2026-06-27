import type { DataProvider } from './provider'
import { MockProvider } from './mockProvider'
import { KrogerProvider } from './krogerProvider'

export type { DataProvider, StoreSummary } from './provider'

let cached: DataProvider | null = null

/**
 * Resolve the active data provider. Controlled by VITE_DATA_PROVIDER
 * ('mock' | 'kroger'); defaults to mock so the app works with zero config.
 */
export function getProvider(): DataProvider {
  if (cached) return cached
  const which = (import.meta.env.VITE_DATA_PROVIDER ?? 'mock').toLowerCase()
  cached = which === 'kroger' ? new KrogerProvider() : new MockProvider()
  return cached
}
