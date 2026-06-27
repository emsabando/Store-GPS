// Minimal Kroger API proxy.
//
// Why this exists: the Kroger client secret must never reach the browser, and
// Kroger doesn't allow direct cross-origin calls. This server holds the secret,
// performs the OAuth2 client-credentials token exchange (with caching), and
// exposes a small normalized API the frontend can call:
//
//   GET /api/health
//   GET /api/stores?zip=85281                 -> nearby stores
//   GET /api/stores/:locationId               -> one store's name/address
//   GET /api/stores/:locationId/products?term=milk
//
// Responses are normalized away from Kroger's schema so the frontend's
// KrogerProvider stays simple. With no credentials set it returns 503 with a
// clear hint, so the app can fall back to the mock provider.

import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const PORT = process.env.PORT || 8787
const CLIENT_ID = process.env.KROGER_CLIENT_ID
const CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET
const API_BASE = process.env.KROGER_API_BASE || 'https://api.kroger.com/v1'
const TOKEN_URL = `${API_BASE}/connect/oauth2/token`

const app = express()
app.use(cors())

// --- OAuth token cache -----------------------------------------------------

let tokenCache = { value: null, expiresAt: 0 }

async function getToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    const err = new Error('Kroger credentials not configured')
    err.status = 503
    throw err
  }
  const now = Date.now()
  if (tokenCache.value && now < tokenCache.expiresAt - 30_000) {
    return tokenCache.value
  }
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`Token request failed (${res.status}): ${body}`)
    err.status = 502
    throw err
  }
  const json = await res.json()
  tokenCache = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
  }
  return tokenCache.value
}

async function krogerGet(path) {
  const token = await getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`Kroger ${res.status}: ${body}`)
    err.status = res.status === 401 ? 502 : res.status
    throw err
  }
  return res.json()
}

// --- Normalizers -----------------------------------------------------------

function formatAddress(a) {
  if (!a) return ''
  return [a.addressLine1, a.city && `${a.city},`, a.state, a.zipCode].filter(Boolean).join(' ')
}

function normalizeStore(loc) {
  return {
    id: loc.locationId,
    name: loc.name || loc.chain || 'Kroger',
    banner: loc.chain,
    address: formatAddress(loc.address),
  }
}

const STOCK_MAP = { HIGH: 'in', LOW: 'low', TEMPORARILY_OUT_OF_STOCK: 'out' }

function normalizeProduct(item) {
  const detail = item.items?.[0] ?? {}
  const aisle = item.aisleLocations?.[0] ?? {}
  const price = detail.price?.regular ?? detail.price?.promo ?? null
  return {
    id: item.productId || item.upc,
    name: item.description || 'Unknown item',
    brand: item.brand || '',
    category: item.categories?.[0] || '',
    price: typeof price === 'number' ? price : null,
    availability: STOCK_MAP[detail.inventory?.stockLevel] ?? 'unknown',
    aisleNumber: aisle.number ?? null,
    aisleDescription: aisle.description ?? null,
    side: aisle.side ?? null,
    shelf: aisle.shelfNumber ?? null,
  }
}

// --- Routes ----------------------------------------------------------------

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, credentials: Boolean(CLIENT_ID && CLIENT_SECRET) })
})

app.get('/api/stores', async (req, res) => {
  try {
    const zip = (req.query.zip || '').toString().trim()
    const radius = Math.min(Number(req.query.radius) || 10, 100)
    if (!zip) return res.status(400).json({ error: 'Provide a ZIP code, e.g. ?zip=85281' })
    const data = await krogerGet(
      `/locations?filter.zipCode.near=${encodeURIComponent(zip)}&filter.radiusInMiles=${radius}&filter.limit=10`,
    )
    res.json({ stores: (data.data ?? []).map(normalizeStore) })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

app.get('/api/stores/:id', async (req, res) => {
  try {
    const data = await krogerGet(`/locations/${encodeURIComponent(req.params.id)}`)
    if (!data.data) return res.status(404).json({ error: 'Store not found' })
    res.json(normalizeStore(data.data))
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

app.get('/api/stores/:id/products', async (req, res) => {
  try {
    const term = (req.query.term || '').toString().trim()
    const limit = Math.min(Number(req.query.limit) || 15, 50)
    if (!term) return res.status(400).json({ error: 'Provide a search term, e.g. ?term=milk' })
    const data = await krogerGet(
      `/products?filter.term=${encodeURIComponent(term)}&filter.locationId=${encodeURIComponent(
        req.params.id,
      )}&filter.limit=${limit}`,
    )
    res.json({ products: (data.data ?? []).map(normalizeProduct) })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message })
  }
})

app.listen(PORT, () => {
  const ready = CLIENT_ID && CLIENT_SECRET
  console.log(`Kroger proxy listening on http://localhost:${PORT}`)
  console.log(ready ? '✓ Kroger credentials detected' : '⚠ No credentials — set KROGER_CLIENT_ID / KROGER_CLIENT_SECRET in .env')
})
