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
npm run dev      # start the dev server (Vite)
```

Then open the printed local URL. Other scripts:

```bash
npm run build    # type-check + production build
npm run preview  # serve the production build
```

## How it's built

| Area | File |
| --- | --- |
| Domain types | `src/types.ts` |
| Store layout generator + demo catalogs | `src/data/stores.ts` |
| A\* pathfinding over the walkable grid | `src/lib/pathfinding.ts` |
| Route → distance + turn-by-turn steps | `src/lib/navigation.ts` |
| Map + third-person navigation (canvas) | `src/components/StoreCanvas.tsx` |
| Search + availability list | `src/components/SearchPanel.tsx` |
| App shell / state | `src/App.tsx` |

Every store is modeled as a uniform grid of tiles (floor, wall, shelf,
entrance, checkout). Departments become aisles; each product sits on a shelf
cell reached from an adjacent walkable cell, which is where navigation routes
you. Pathfinding, routing, and rendering are all data-driven — none of the UI
hard-codes a specific store.

## About the data (and real stores)

The demo ships with **simulated stores and inventory**, including
representative **Walmart** and **Target** layouts so the experience can be
tested with familiar names. These are illustrative floor plans — not maps of a
specific physical location.

Making this work for a real store near you requires two things the prototype
deliberately stubs out:

1. **Store data** — that retailer's actual aisle map + live inventory
   (some chains expose product-location and stock APIs; otherwise it needs a
   data partnership or in-store mapping).
2. **Indoor positioning** — real "you are here" tracking from Wi-Fi/BLE
   beacons, UWB, or camera/AR, since GPS doesn't work reliably indoors.

The code is structured so both can be swapped in: replace the catalog in
`src/data/stores.ts` (or back it with an API) and feed a live position into the
`userCell` state instead of the tap-to-place fallback.

## Roadmap

- Pluggable data layer for real inventory APIs
- Indoor positioning adapters (BLE beacons / Wi-Fi RTT / AR)
- Voice-guided directions
- Multi-stop shopping lists with optimized routing
- Native mobile build
