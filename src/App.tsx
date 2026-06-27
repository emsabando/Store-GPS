import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { getProvider, type StoreSummary } from './data'
import type { Cell, Maneuver, Product, Store } from './types'
import { findPath } from './lib/pathfinding'
import { buildRoute, etaSeconds, METERS_PER_CELL } from './lib/navigation'
import StoreCanvas from './components/StoreCanvas'
import SearchPanel from './components/SearchPanel'

const MANEUVER_ICON: Record<Maneuver, string> = {
  start: '↑',
  straight: '↑',
  left: '←',
  right: '→',
  'slight-left': '↖',
  'slight-right': '↗',
  arrive: '◎',
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)} min`
}

// Local relevance ranking for catalog (mock) search.
function filterProducts(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase()
  if (!q) return products
  const score = (p: Product) => {
    const name = p.name.toLowerCase()
    const hay = `${p.name} ${p.brand} ${p.category}`.toLowerCase()
    if (!hay.includes(q)) return -1
    if (name.startsWith(q)) return 3
    if (name.includes(q)) return 2
    return 1
  }
  return products
    .map((p) => ({ p, s: score(p) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map((r) => r.p)
}

export default function App() {
  const provider = useMemo(getProvider, [])

  const [summaries, setSummaries] = useState<StoreSummary[]>([])
  const [storeId, setStoreId] = useState<string | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [zip, setZip] = useState('')

  const [query, setQuery] = useState('')
  const [liveResults, setLiveResults] = useState<Product[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [userCell, setUserCell] = useState<Cell | null>(null)

  const [mode, setMode] = useState<'overview' | 'navigate'>('overview')
  const [playing, setPlaying] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)

  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingStore, setLoadingStore] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetNav = useCallback(() => {
    setMode('overview')
    setPlaying(false)
    setArrived(false)
    setStepIndex(0)
  }, [])

  const selectStore = useCallback(
    (id: string) => {
      setStoreId(id)
      setSelected(null)
      setQuery('')
      setLiveResults([])
      resetNav()
      setLoadingStore(true)
      setError(null)
      provider
        .getStore(id)
        .then((st) => {
          setStore(st)
          setUserCell(st.entrance)
        })
        .catch((e) => setError(String(e?.message ?? e)))
        .finally(() => setLoadingStore(false))
    },
    [provider, resetNav],
  )

  // Initial store list for fixed-list providers (mock). ZIP providers wait.
  useEffect(() => {
    if (provider.locatesByZip) return
    setLoadingStores(true)
    provider
      .listStores()
      .then((s) => {
        setSummaries(s)
        if (s[0]) selectStore(s[0].id)
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoadingStores(false))
  }, [provider, selectStore])

  // Live (Kroger) search: debounced fetch that rebuilds the store from results.
  useEffect(() => {
    if (provider.mode !== 'live' || !storeId || !provider.searchStore) return
    const term = query.trim()
    if (term.length < 2) {
      setLiveResults([])
      return
    }
    let active = true
    setSearching(true)
    const handle = setTimeout(async () => {
      try {
        const st = await provider.searchStore!(storeId, term)
        if (!active) return
        setStore(st)
        setUserCell((cur) => cur ?? st.entrance)
        setLiveResults(st.products)
      } catch (e) {
        if (active) setError(String((e as Error)?.message ?? e))
      } finally {
        if (active) setSearching(false)
      }
    }, 350)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [provider, storeId, query])

  const catalogResults = useMemo(
    () => (provider.mode === 'catalog' && store ? filterProducts(store.products, query) : []),
    [provider, store, query],
  )
  const results = provider.mode === 'catalog' ? catalogResults : liveResults

  const route = useMemo(() => {
    if (!store || !userCell || !selected) return null
    const path = findPath(store, userCell, selected.access)
    if (!path) return null
    return buildRoute(path, `${selected.name} · ${selected.aisle}`)
  }, [store, userCell, selected])

  const handleQuery = (q: string) => {
    setQuery(q)
    setSelected(null)
    resetNav()
  }

  const handleSelect = (p: Product) => {
    setSelected(p)
    resetNav()
  }

  const handleLocate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!zip.trim()) return
    setLoadingStores(true)
    setError(null)
    setStore(null)
    setStoreId(null)
    provider
      .listStores({ zip })
      .then((s) => {
        setSummaries(s)
        if (s[0]) selectStore(s[0].id)
        else setError('No stores found near that ZIP.')
      })
      .catch((e) => setError(String(e?.message ?? e)))
      .finally(() => setLoadingStores(false))
  }

  const startNav = () => {
    if (!route) return
    setArrived(false)
    setStepIndex(0)
    setMode('navigate')
    setPlaying(true)
  }

  const handleProgress = useCallback((step: number, remainingMeters: number) => {
    setStepIndex(step)
    setRemaining(remainingMeters)
  }, [])

  const handleArrive = useCallback(() => {
    setPlaying(false)
    setArrived(true)
  }, [])

  const handlePickCell = (cell: Cell) => {
    if (!store) return
    const kind = store.tiles[cell.y][cell.x]
    if (kind === 'shelf' || kind === 'wall') return
    setUserCell(cell)
  }

  const here = userCell ?? store?.entrance ?? null
  const distanceMeters = route ? Math.round(route.distance * METERS_PER_CELL) : 0
  const eta = route ? etaSeconds(route) : 0
  const currentStep = route?.steps[stepIndex]
  const liveEmpty = provider.mode === 'live' && !query && (!store || store.products.length === 0)

  return (
    <div className={`app ${mode === 'navigate' ? 'navigating' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            🧭
          </span>
          <div>
            <h1>Store&nbsp;GPS</h1>
            <p className="tagline">Find any product. No employee needed.</p>
          </div>
        </div>

        <div className="store-controls">
          {provider.locatesByZip && (
            <form className="zip-form" onSubmit={handleLocate}>
              <input
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                placeholder="ZIP code"
                inputMode="numeric"
                aria-label="ZIP code"
              />
              <button type="submit" disabled={loadingStores}>
                {loadingStores ? '…' : 'Find stores'}
              </button>
            </form>
          )}
          {summaries.length > 0 && (
            <label className="store-select">
              <span>Store</span>
              <select value={storeId ?? ''} onChange={(e) => selectStore(e.target.value)}>
                {summaries.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.address ? ` — ${s.address}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="provider-tag" title={provider.note}>
            {provider.label}
          </span>
        </div>
      </header>

      {error && (
        <div className="error-bar">
          ⚠ {error}
          <button onClick={() => setError(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <main className="layout">
        {mode === 'overview' && (
          <aside className="sidebar">
            <SearchPanel
              results={results}
              query={query}
              onQuery={handleQuery}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
              loading={searching}
              placeholder={
                provider.mode === 'live' ? 'Search live inventory…' : `Search ${store?.products.length ?? 0} products…`
              }
              emptyHint={
                provider.mode === 'live'
                  ? 'Type a product to search this store’s live aisle + stock data.'
                  : 'Start typing to search.'
              }
            />
          </aside>
        )}

        <section className="stage">
          {store && here ? (
            <StoreCanvas
              store={store}
              route={route}
              target={selected}
              userCell={here}
              mode={mode}
              playing={playing}
              onPickCell={handlePickCell}
              onProgress={handleProgress}
              onArrive={handleArrive}
            />
          ) : (
            <div className="stage-empty">
              {loadingStore || loadingStores ? (
                <p>Loading…</p>
              ) : provider.locatesByZip ? (
                <p>Enter your ZIP code above to find a store near you.</p>
              ) : (
                <p>Select a store to begin.</p>
              )}
            </div>
          )}

          {store && mode === 'overview' && (
            <div className="overview-hint">
              <span className="addr">
                {store.name}
                {store.address ? ` · ${store.address}` : ''}
              </span>
              <span className="tip">
                {liveEmpty
                  ? 'Search a product to map its aisle on live data.'
                  : "Tip: tap anywhere on the floor to set where you're standing."}
              </span>
            </div>
          )}

          {mode === 'overview' && selected && (
            <div className="dest-card">
              <div className="dest-head">
                <span className="dest-emoji" aria-hidden>
                  {selected.emoji}
                </span>
                <div className="dest-info">
                  <strong>{selected.name}</strong>
                  <span>{[selected.brand, selected.locationDetail ?? selected.aisle].filter(Boolean).join(' · ')}</span>
                </div>
                <span className="dest-price">{selected.price != null ? `$${selected.price.toFixed(2)}` : '—'}</span>
              </div>
              <div className="dest-stats">
                <span>
                  <em>{route ? `${distanceMeters} m` : '—'}</em>distance
                </span>
                <span>
                  <em>{route ? formatEta(eta) : '—'}</em>walk time
                </span>
                <span>
                  <em className={selected.availability === 'out' ? 'bad' : selected.availability === 'unknown' ? '' : 'ok'}>
                    {selected.availability === 'out'
                      ? 'Out of stock'
                      : selected.availability === 'unknown'
                        ? 'Check store'
                        : selected.stock >= 0
                          ? `${selected.stock} in stock`
                          : selected.availability === 'low'
                            ? 'Low stock'
                            : 'In stock'}
                  </em>
                  availability
                </span>
              </div>
              <button className="go-btn" onClick={startNav} disabled={!route}>
                {route ? 'Start navigation' : 'No route available'}
              </button>
            </div>
          )}

          {mode === 'navigate' && currentStep && !arrived && (
            <div className="nav-banner">
              <span className="nav-icon">{MANEUVER_ICON[currentStep.maneuver]}</span>
              <div className="nav-text">
                <strong>{currentStep.instruction}</strong>
                <span>{remaining} m to destination</span>
              </div>
            </div>
          )}

          {mode === 'navigate' && arrived && selected && (
            <div className="arrive-card">
              <span className="arrive-emoji" aria-hidden>
                {selected.emoji}
              </span>
              <strong>You've arrived</strong>
              <span>
                {selected.name} — {selected.locationDetail ?? selected.aisle}
              </span>
              <span className={`arrive-stock ${selected.availability === 'out' ? 'bad' : 'ok'}`}>
                {selected.availability === 'out'
                  ? 'Currently out of stock'
                  : `${selected.stock >= 0 ? `${selected.stock} in stock · ` : ''}${
                      selected.price != null ? `$${selected.price.toFixed(2)}` : ''
                    }`.replace(/ · $/, '')}
              </span>
              <button className="go-btn" onClick={resetNav}>
                Done
              </button>
            </div>
          )}

          {mode === 'navigate' && !arrived && (
            <button className="exit-btn" onClick={resetNav} aria-label="Exit navigation">
              ✕ End
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
