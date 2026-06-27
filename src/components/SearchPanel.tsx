import { useMemo } from 'react'
import type { Product, Store } from '../types'

interface Props {
  store: Store
  query: string
  onQuery: (q: string) => void
  selectedId: string | null
  onSelect: (product: Product) => void
}

function score(product: Product, q: string): number {
  const hay = `${product.name} ${product.brand} ${product.category}`.toLowerCase()
  if (!q) return 0
  if (hay.includes(q)) {
    // Prefer matches at a word boundary / start of name.
    if (product.name.toLowerCase().startsWith(q)) return 3
    if (product.name.toLowerCase().includes(q)) return 2
    return 1
  }
  return -1
}

export default function SearchPanel({ store, query, onQuery, selectedId, onSelect }: Props) {
  const q = query.trim().toLowerCase()

  const results = useMemo(() => {
    const list = store.products
      .map((p) => ({ p, s: score(p, q) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    return q ? list.map((r) => r.p) : store.products
  }, [store, q])

  return (
    <div className="search-panel">
      <div className="search-box">
        <span className="search-icon" aria-hidden>
          🔍
        </span>
        <input
          autoFocus
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={`Search ${store.products.length} products…`}
          aria-label="Search products"
        />
        {query && (
          <button className="clear-btn" onClick={() => onQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      <div className="results">
        {results.length === 0 && <p className="empty">No products match “{query}”.</p>}
        {results.map((p) => {
          const inStock = p.stock > 0
          const low = inStock && p.stock <= 10
          return (
            <button
              key={p.id}
              className={`result ${selectedId === p.id ? 'selected' : ''}`}
              onClick={() => onSelect(p)}
            >
              <span className="result-emoji" aria-hidden>
                {p.emoji}
              </span>
              <span className="result-main">
                <span className="result-name">{p.name}</span>
                <span className="result-sub">
                  {p.brand} · {p.aisle}
                </span>
              </span>
              <span className="result-meta">
                <span className="result-price">${p.price.toFixed(2)}</span>
                <span className={`stock ${inStock ? (low ? 'low' : 'in') : 'out'}`}>
                  {inStock ? (low ? `Only ${p.stock} left` : `In stock`) : 'Out of stock'}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
