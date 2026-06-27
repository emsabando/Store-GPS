import type { Availability, Product } from '../types'

interface Props {
  results: Product[]
  query: string
  onQuery: (q: string) => void
  selectedId: string | null
  onSelect: (product: Product) => void
  loading?: boolean
  placeholder?: string
  emptyHint?: string
}

function stockBadge(p: Product): { text: string; cls: string } {
  const a: Availability = p.availability
  if (a === 'out') return { text: 'Out of stock', cls: 'out' }
  if (a === 'unknown') return { text: 'Check store', cls: 'unknown' }
  if (a === 'low') return { text: p.stock >= 0 ? `Only ${p.stock} left` : 'Low stock', cls: 'low' }
  return { text: p.stock >= 0 ? 'In stock' : 'In stock', cls: 'in' }
}

export default function SearchPanel({
  results,
  query,
  onQuery,
  selectedId,
  onSelect,
  loading,
  placeholder,
  emptyHint,
}: Props) {
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
          placeholder={placeholder ?? 'Search products…'}
          aria-label="Search products"
        />
        {loading && <span className="search-spinner" aria-hidden />}
        {query && !loading && (
          <button className="clear-btn" onClick={() => onQuery('')} aria-label="Clear search">
            ✕
          </button>
        )}
      </div>

      <div className="results">
        {results.length === 0 && (
          <p className="empty">{query ? `No products match “${query}”.` : emptyHint ?? 'Start typing to search.'}</p>
        )}
        {results.map((p) => {
          const badge = stockBadge(p)
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
                  {[p.brand, p.locationDetail ?? p.aisle].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="result-meta">
                <span className="result-price">{p.price != null ? `$${p.price.toFixed(2)}` : '—'}</span>
                <span className={`stock ${badge.cls}`}>{badge.text}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
