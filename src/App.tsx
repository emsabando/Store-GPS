import { useCallback, useMemo, useState } from 'react'
import './App.css'
import { STORES } from './data/stores'
import type { Cell, Maneuver, Product } from './types'
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
  const m = Math.round(seconds / 60)
  return `${m} min`
}

export default function App() {
  const [storeId, setStoreId] = useState(STORES[0].id)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [mode, setMode] = useState<'overview' | 'navigate'>('overview')
  const [playing, setPlaying] = useState(false)
  const [arrived, setArrived] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)

  const store = useMemo(() => STORES.find((s) => s.id === storeId)!, [storeId])
  const [userCell, setUserCell] = useState<Cell>(store.entrance)

  const route = useMemo(() => {
    if (!selected) return null
    const path = findPath(store, userCell, selected.access)
    if (!path) return null
    return buildRoute(path, `${selected.name} · ${selected.aisle}`)
  }, [store, userCell, selected])

  const resetNav = useCallback(() => {
    setMode('overview')
    setPlaying(false)
    setArrived(false)
    setStepIndex(0)
  }, [])

  const handleStore = (id: string) => {
    const next = STORES.find((s) => s.id === id)!
    setStoreId(id)
    setUserCell(next.entrance)
    setSelected(null)
    setQuery('')
    resetNav()
  }

  const handleSelect = (p: Product) => {
    setSelected(p)
    resetNav()
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
    if (store.tiles[cell.y][cell.x] === 'shelf' || store.tiles[cell.y][cell.x] === 'wall') return
    setUserCell(cell)
  }

  const distanceMeters = route ? Math.round(route.distance * METERS_PER_CELL) : 0
  const eta = route ? etaSeconds(route) : 0
  const currentStep = route?.steps[stepIndex]

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
        <label className="store-select">
          <span>Store</span>
          <select value={storeId} onChange={(e) => handleStore(e.target.value)}>
            {STORES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="layout">
        {mode === 'overview' && (
          <aside className="sidebar">
            <SearchPanel
              store={store}
              query={query}
              onQuery={setQuery}
              selectedId={selected?.id ?? null}
              onSelect={handleSelect}
            />
          </aside>
        )}

        <section className="stage">
          <StoreCanvas
            store={store}
            route={route}
            target={selected}
            userCell={userCell}
            mode={mode}
            playing={playing}
            onPickCell={handlePickCell}
            onProgress={handleProgress}
            onArrive={handleArrive}
          />

          {mode === 'overview' && (
            <div className="overview-hint">
              <span className="addr">{store.name} · {store.address}</span>
              <span className="tip">Tip: tap anywhere on the floor to set where you're standing.</span>
            </div>
          )}

          {/* Destination card (overview, product chosen) */}
          {mode === 'overview' && selected && (
            <div className="dest-card">
              <div className="dest-head">
                <span className="dest-emoji" aria-hidden>
                  {selected.emoji}
                </span>
                <div className="dest-info">
                  <strong>{selected.name}</strong>
                  <span>
                    {selected.brand} · {selected.aisle}
                  </span>
                </div>
                <span className="dest-price">${selected.price.toFixed(2)}</span>
              </div>
              <div className="dest-stats">
                <span>
                  <em>{route ? `${distanceMeters} m` : '—'}</em>distance
                </span>
                <span>
                  <em>{route ? formatEta(eta) : '—'}</em>walk time
                </span>
                <span>
                  <em className={selected.stock > 0 ? 'ok' : 'bad'}>
                    {selected.stock > 0 ? `${selected.stock} in stock` : 'Out of stock'}
                  </em>
                  availability
                </span>
              </div>
              <button className="go-btn" onClick={startNav} disabled={!route}>
                {route ? 'Start navigation' : 'No route available'}
              </button>
            </div>
          )}

          {/* Turn-by-turn banner (navigate mode) */}
          {mode === 'navigate' && currentStep && !arrived && (
            <div className="nav-banner">
              <span className="nav-icon">{MANEUVER_ICON[currentStep.maneuver]}</span>
              <div className="nav-text">
                <strong>{currentStep.instruction}</strong>
                <span>{remaining} m to destination</span>
              </div>
            </div>
          )}

          {/* Arrival card */}
          {mode === 'navigate' && arrived && selected && (
            <div className="arrive-card">
              <span className="arrive-emoji" aria-hidden>
                {selected.emoji}
              </span>
              <strong>You've arrived</strong>
              <span>
                {selected.name} — {selected.aisle}
              </span>
              <span className={`arrive-stock ${selected.stock > 0 ? 'ok' : 'bad'}`}>
                {selected.stock > 0 ? `${selected.stock} in stock · $${selected.price.toFixed(2)}` : 'Currently out of stock'}
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
