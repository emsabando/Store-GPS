# Store GPS

**Universal in-store product finder — find any product in any store, no employee needed.**

Store GPS turns a store's own layout and inventory data into a familiar,
GPS-style navigation experience. Search for a product, see if it's in stock,
and get a glowing blue route with third-person, turn-by-turn "follow the line"
navigation straight to the shelf.

This repository contains the **web MVP**: a fully working prototype running on
simulated store data, with an architecture designed so real store inventory and
indoor-positioning can be plugged in later.

---

## What it does

- 🔍 **Product search** across the whole store, with brand, aisle, price, and
  live **stock / availability** badges (in stock · low stock · out of stock).
- 🗺️ **Top-down store map** rendered to canvas — color-coded departments,
  aisles, shelves, entrance, and checkout.
- 📍 **"You are here"** — tap anywhere on the floor to set where you're standing;
  the route recomputes instantly.
- 🧭 **GPS-style navigation** — A\* pathfinding produces the shortest walkable
  route, drawn as an animated blue line. The **third-person follow view**
  rotates the map heading-up and tracks an avatar chevron along the path.
- ↩️ **Turn-by-turn directions** — "Turn left and continue 4 m", live remaining
  distance, ETA, and an arrival card showing final stock and price.
- 🏬 **Multiple stores** — switch between several demo stores, each with its own
  layout and catalog (including familiar big-box layouts for testing).

## Run it

```bash
npm install
npm run dev      # start the web app on mock data (Vite)
```

Then open the printed local URL. Other scripts:

```bash
npm run build    # type-check + production build
npm run preview  # serve the production build
npm run server   # start the Kroger API proxy (for live data, see below)
npm run dev:all  # run web app + proxy together
```

## Live store data (Kroger / Fry's / Ralphs / King Soopers…)

The app ships on simulated data by default, but it can run on **live store
inventory and aisle locations** via the Kroger API — which powers Kroger and all
its banners (**Fry's**, Ralphs, King Soopers, Smith's, QFC, Harris Teeter, and
more). Kroger is currently the only major US retailer that publicly exposes both
**per-store stock level** and **in-aisle product location**.

### One-time setup

1. Create a developer account at <https://developer.kroger.com/> → verify email
   → **register an application** → copy your `client_id` and `client_secret`.
2. `cp .env.example .env` and fill in:
   ```env
   VITE_DATA_PROVIDER=kroger
   KROGER_CLIENT_ID=your_client_id
   KROGER_CLIENT_SECRET=your_client_secret
   ```
3. `npm run dev:all` — starts the web app and the proxy together.
4. In the app, type your **ZIP code** → pick your local store (e.g. your Fry's)
   → search a product. You'll get its real aisle, side, shelf, price, and stock,
   then GPS navigation to it.

### Why a proxy?

The Kroger `client_secret` must never reach the browser, and Kroger blocks
direct cross-origin calls. `server/index.mjs` is a tiny Node/Express proxy that
holds the secret, performs the OAuth2 token exchange (cached), and exposes a
small **normalized** API the frontend consumes:

```
GET /api/stores?zip=85281            -> nearby stores
GET /api/stores/:locationId          -> one store's name/address
GET /api/stores/:locationId/products?term=milk
```

With no credentials set, the proxy returns a clear 503 and the app stays on mock
data — nothing breaks.

### Honest limitation

Kroger exposes **aisle numbers + stock**, not a geometric floor plan. So for
live stores the map is a faithful *schematic* (one lane per aisle the search
returns) — the **aisle number, side, shelf, price, and availability are real**,
the exact geometry is approximate. That's enough to walk you to the right aisle.

## How it's built

| Area | File |
| --- | --- |
| Domain types | `src/types.ts` |
| Pluggable data-provider interface | `src/data/provider.ts` |
| Provider selector (`mock` \| `kroger`) | `src/data/index.ts` |
| Mock provider + demo catalogs | `src/data/mockProvider.ts`, `src/data/stores.ts` |
| Live Kroger provider | `src/data/krogerProvider.ts` |
| Kroger API proxy (OAuth + normalize) | `server/index.mjs` |
| Grid/layout generator | `src/data/layout.ts` |
| A\* pathfinding over the walkable grid | `src/lib/pathfinding.ts` |
| Route → distance + turn-by-turn steps | `src/lib/navigation.ts` |
| Map + third-person navigation (canvas) | `src/components/StoreCanvas.tsx` |
| Search + availability list | `src/components/SearchPanel.tsx` |
| App shell / state | `src/App.tsx` |

Every store is modeled as a uniform grid of tiles (floor, wall, shelf,
entrance, checkout). Departments become aisles; each product sits on a shelf
cell reached from an adjacent walkable cell, which is where navigation routes
you.

The UI talks only to the **`DataProvider`** interface, so the data source is
swappable:

- **`MockProvider`** (`mode: 'catalog'`) — full simulated catalogs known up
  front, including representative **Walmart** and **Target** layouts.
- **`KrogerProvider`** (`mode: 'live'`) — discovers stores by ZIP and resolves
  products per search against the Kroger API (via the proxy), building the map
  from whatever a search returns.

Adding another retailer is one new class implementing `DataProvider` — nothing
in the map, pathfinding, or navigation code changes.

## Indoor positioning (the other half of "real")

This MVP routes from a **tap-to-place** "you are here." Real indoor positioning
— Wi-Fi/BLE beacons, UWB, or camera/AR — is the remaining piece for true
hands-free navigation, since phone GPS doesn't work reliably indoors. It plugs
in by feeding a live position into the app's `userCell` state instead of the tap
fallback.

## Roadmap

- ✅ Pluggable data layer for real inventory APIs
- ✅ Live Kroger provider (Kroger / Fry's / Ralphs / King Soopers / …)
- Indoor positioning adapters (BLE beacons / Wi-Fi RTT / AR)
- Voice-guided directions
- Multi-stop shopping lists with optimized routing
- Native mobile build
