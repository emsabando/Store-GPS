import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { getProvider, type StoreSummary } from './data'
import { buildStore } from './data/layout'
import type { Cell, Maneuver, Product, Route, Store } from './types'
import { findPath } from './lib/pathfinding'
import { buildRoute, etaSeconds, METERS_PER_CELL } from './lib/navigation'
import StoreCanvas from './components/StoreCanvas'
import SearchPanel from './components/SearchPanel'
import { usePositioning, type PositioningMode, type WalkDir } from './positioning/usePositioning'

const MANEUVER_ICON: Record<Maneuver, string> = {
  start: '↑',
  straight: '↑',
  left: '←',
  right: '→',
  'slight-left': '↖',
  'slight-right': '↗',
  arrive: '◎',
}

// Fallback so the positioning hook always has a valid store (hooks can't be
// conditional); never rendered.
const PLACEHOLDER_STORE = buildStore({ id: '_', name: '', address: '', depts: [] })

const POS_MODES: { id: PositioningMode; label: string; hint: string }[] = [
  { id: 'autopilot', label: 'Auto-walk', hint: 'Demo: walks the route for you.' },
  { id: 'walk', label: 'Walk', hint: 'Drive with arrow keys / WASD or the pad.' },
  { id: 'device', label: 'Device', hint: 'Use your phone’s step + compass sensors.' },
]

function formatEta(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  return `${Math.round(seconds / 60)} min`
}

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
  const [userCell, setUserCell] = useState<Cell>(PLACEHOLDER_STORE.entrance)

  const [view, setView] = useState<'overview' | 'navigate'>('overview')
  const [posMode, setPosMode] = useState<PositioningMode>('autopilot')

  const [loadingStores, setLoadingStores] = useState(false)
  const [loadingStore, setLoadingStore] = useState(false)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigating = view === 'navigate'

  const selectStore = useCallback(
    (id: string) => {
      setStoreId(id)
      setSelected(null)
      setQuery('')
      setLiveResults([])
      setView('overview')
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
    [provider],
  )

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
        setUserCell(st.entrance)
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

  const activeStore = store ?? PLACEHOLDER_STORE

  // Route is shared with the positioning hook by ref: the hook reads it live in
  // its loop, and we assign the latest value below after computing it (its
  // origin depends on the hook's liveCell, so it can't be a hook argument).
  const routeRef = useRef<Route | null>(null)

  // Positioning layer owns the live pose. Re-route from the live cell while
  // physically walking; keep a fixed origin for the auto-walk demo.
  const { poseRef, liveCell, nav, deviceStatus, recenter, setHeld, startDevice } = usePositioning({
    store: activeStore,
    routeRef,
    mode: posMode,
    active: navigating,
    originCell: userCell,
  })

  const routeOrigin = navigating && posMode !== 'autopilot' ? liveCell : userCell

  const route = useMemo(() => {
    if (!store || !selected) return null
    const path = findPath(store, routeOrigin, selected.access)
    if (!path) return null
    return buildRoute(path, `${selected.name} · ${selected.aisle}`)
  }, [store, routeOrigin, selected])
  routeRef.current = route

  const handleQuery = (q: string) => {
    setQuery(q)
    setSelected(null)
    setView('overview')
  }

  const handleSelect = (p: Product) => {
    setSelected(p)
    setView('overview')
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
    setView('navigate')
  }

  const endNav = () => setView('overview')

  const handlePickCell = (cell: Cell) => {
    if (!store) return
    const kind = store.tiles[cell.y][cell.x]
    if (kind === 'shelf' || kind === 'wall') return
    setUserCell(cell)
    recenter(cell)
  }

  const choosePosMode = (m: PositioningMode) => {
    setPosMode(m)
    if (m === 'device') startDevice()
  }

  const distanceMeters = route ? Math.round(route.distance * METERS_PER_CELL) : 0
  const eta = route ? etaSeconds(route) : 0
  const currentStep = route?.steps[nav.stepIndex]
  const arrived = nav.arrived
  const liveEmpty = provider.mode === 'live' && !query && (!store || store.products.length === 0)
  const showJoystick = navigating && posMode === 'walk' && !arrived

  return (
    <div className={`app ${navigating ? 'navigating' : ''}`}>
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
        {!navigating && (
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
          {store ? (
            <StoreCanvas
              store={store}
              route={route}
              target={selected}
              poseRef={poseRef}
              mode={view}
              onPickCell={handlePickCell}
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

          {store && !navigating && (
            <div className="overview-hint">
              <span className="addr">
                {store.name}
                {store.address ? ` · ${store.address}` : ''}
              </span>
              <span className="tip">
                {liveEmpty
                  ? 'Search a product to map its aisle on live data.'
                  : "Tip: tap the floor to set where you're standing."}
              </span>
            </div>
          )}

          {!navigating && selected && (
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

              <div className="pos-mode" role="group" aria-label="Positioning mode">
                {POS_MODES.map((m) => (
                  <button
                    key={m.id}
                    className={posMode === m.id ? 'active' : ''}
                    onClick={() => choosePosMode(m.id)}
                    title={m.hint}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {posMode === 'device' && deviceStatus !== 'active' && (
                <p className="pos-note">
                  {deviceStatus === 'unsupported'
                    ? 'Motion sensors aren’t available on this device — try Walk mode.'
                    : deviceStatus === 'denied'
                      ? 'Motion access was denied. Enable it or use Walk mode.'
                      : 'Tap “Start navigation”, then allow motion access on your phone.'}
                </p>
              )}

              <button className="go-btn" onClick={startNav} disabled={!route}>
                {route ? 'Start navigation' : 'No route available'}
              </button>
            </div>
          )}

          {navigating && currentStep && !arrived && (
            <div className="nav-banner">
              <span className="nav-icon">{MANEUVER_ICON[currentStep.maneuver]}</span>
              <div className="nav-text">
                <strong>{currentStep.instruction}</strong>
                <span>
                  {nav.remainingMeters} m to destination
                  {posMode !== 'autopilot' ? ' · live position' : ''}
                </span>
              </div>
            </div>
          )}

          {showJoystick && (
            <div className="joystick" aria-label="Walk controls">
              {(['up', 'left', 'right', 'down'] as WalkDir[]).map((dir) => (
                <button
                  key={dir}
                  className={`pad pad-${dir}`}
                  onPointerDown={(e) => {
                    e.preventDefault()
                    setHeld(dir, true)
                  }}
                  onPointerUp={() => setHeld(dir, false)}
                  onPointerLeave={() => setHeld(dir, false)}
                  onPointerCancel={() => setHeld(dir, false)}
                  aria-label={`Walk ${dir}`}
                >
                  {dir === 'up' ? '▲' : dir === 'down' ? '▼' : dir === 'left' ? '◀' : '▶'}
                </button>
              ))}
            </div>
          )}

          {navigating && arrived && selected && (
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
              <button className="go-btn" onClick={endNav}>
                Done
              </button>
            </div>
          )}

          {navigating && !arrived && (
            <button className="exit-btn" onClick={endNav} aria-label="Exit navigation">
              ✕ End
            </button>
          )}
        </section>
      </main>
    </div>
  )
}
