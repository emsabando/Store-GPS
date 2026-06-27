import type { Cell, Department, Product, Store, TileKind } from '../types'

// ---------------------------------------------------------------------------
// Store layout generator
// ---------------------------------------------------------------------------
//
// Every store shares the same skeleton: a walled rectangle with an entrance at
// the bottom, a checkout strip, and a row of parallel aisles. Each "department"
// becomes one vertical aisle of shelving. Products are placed at shelf cells,
// each reachable from the walkable corridor cell beside it.
//
// Swapping in real store data later means replacing the catalogs below (or the
// whole generator) — nothing in the UI hard-codes a specific store.

const COLS = 46
const ROWS = 34

const BLOCK_TOP = 6
const BLOCK_BOTTOM = ROWS - 6 // 28
const FIRST_X = 4
const PITCH = 5 // 2 cells of shelf + 3 cells of corridor

interface ProductDef {
  name: string
  brand: string
  price: number
  stock: number
  emoji: string
}

interface DeptDef {
  label: string
  color: string
  products: ProductDef[]
}

interface StoreDef {
  id: string
  name: string
  address: string
  depts: DeptDef[]
}

function blankGrid(): TileKind[][] {
  const tiles: TileKind[][] = []
  for (let y = 0; y < ROWS; y++) {
    const row: TileKind[] = []
    for (let x = 0; x < COLS; x++) {
      const isPerimeter = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1
      row.push(isPerimeter ? 'wall' : 'floor')
    }
    tiles.push(row)
  }
  return tiles
}

/** Walkable cell-pairs flanking one aisle block, top to bottom, alternating faces. */
function aisleSlots(bx: number): { shelf: Cell; access: Cell }[] {
  const slots: { shelf: Cell; access: Cell }[] = []
  for (let y = BLOCK_TOP + 1; y < BLOCK_BOTTOM; y += 2) {
    slots.push({ shelf: { x: bx, y }, access: { x: bx - 1, y } }) // left face
    slots.push({ shelf: { x: bx + 1, y }, access: { x: bx + 2, y } }) // right face
  }
  return slots
}

function buildStore(def: StoreDef): Store {
  if (def.depts.length > 8) {
    throw new Error(`Store ${def.id} has too many departments for the grid`)
  }

  const tiles = blankGrid()
  const entranceX = Math.floor(COLS / 2)

  // Entrance: a two-cell gap in the bottom wall.
  tiles[ROWS - 1][entranceX - 1] = 'entrance'
  tiles[ROWS - 1][entranceX] = 'entrance'
  const entrance: Cell = { x: entranceX, y: ROWS - 2 }

  // Checkout strip just inside the entrance.
  const checkoutY = ROWS - 3
  for (let x = entranceX - 3; x <= entranceX + 3; x++) {
    tiles[checkoutY][x] = 'checkout'
  }
  const checkout: Cell = { x: entranceX, y: checkoutY }

  const departments: Department[] = []
  const products: Product[] = []

  def.depts.forEach((dept, i) => {
    const bx = FIRST_X + i * PITCH

    // Lay down the shelving block.
    for (let y = BLOCK_TOP; y <= BLOCK_BOTTOM; y++) {
      tiles[y][bx] = 'shelf'
      tiles[y][bx + 1] = 'shelf'
    }

    departments.push({
      id: `${def.id}-dept-${i}`,
      label: dept.label,
      center: { x: bx + 0.5, y: BLOCK_TOP - 2 },
      color: dept.color,
    })

    const slots = aisleSlots(bx)
    dept.products.forEach((p, j) => {
      const slot = slots[j % slots.length]
      products.push({
        id: `${def.id}-p-${i}-${j}`,
        name: p.name,
        brand: p.brand,
        category: dept.label,
        aisle: dept.label,
        price: p.price,
        stock: p.stock,
        access: slot.access,
        shelf: slot.shelf,
        emoji: p.emoji,
      })
    })
  })

  return {
    id: def.id,
    name: def.name,
    address: def.address,
    cols: COLS,
    rows: ROWS,
    tiles,
    entrance,
    checkout,
    departments,
    products,
  }
}

// ---------------------------------------------------------------------------
// Demo catalogs
// ---------------------------------------------------------------------------

const PALETTE = ['#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#fb7185', '#34d399', '#facc15', '#60a5fa']

const STORE_DEFS: StoreDef[] = [
  {
    id: 'freshmart',
    name: 'FreshMart Supermarket',
    address: '1200 Market Street',
    depts: [
      {
        label: 'Produce',
        color: PALETTE[0],
        products: [
          { name: 'Bananas (bunch)', brand: 'Chiquita', price: 1.49, stock: 88, emoji: '🍌' },
          { name: 'Hass Avocados', brand: 'Farm Fresh', price: 0.99, stock: 40, emoji: '🥑' },
          { name: 'Baby Spinach', brand: 'Earthbound', price: 3.29, stock: 12, emoji: '🥬' },
          { name: 'Roma Tomatoes', brand: 'Sun Valley', price: 2.19, stock: 0, emoji: '🍅' },
          { name: 'Honeycrisp Apples', brand: 'Orchard Co', price: 2.99, stock: 25, emoji: '🍎' },
        ],
      },
      {
        label: 'Bakery',
        color: PALETTE[1],
        products: [
          { name: 'Sourdough Loaf', brand: 'Stone Mill', price: 4.49, stock: 9, emoji: '🍞' },
          { name: 'Blueberry Muffins 4pk', brand: "Baker's", price: 3.99, stock: 6, emoji: '🧁' },
          { name: 'Croissants 6pk', brand: 'La Brea', price: 5.49, stock: 0, emoji: '🥐' },
          { name: 'Bagels 6pk', brand: 'NY Style', price: 3.29, stock: 14, emoji: '🥯' },
        ],
      },
      {
        label: 'Dairy & Eggs',
        color: PALETTE[2],
        products: [
          { name: 'Whole Milk 1gal', brand: 'Clover', price: 3.79, stock: 30, emoji: '🥛' },
          { name: 'Large Eggs 12ct', brand: 'Happy Hen', price: 4.19, stock: 22, emoji: '🥚' },
          { name: 'Greek Yogurt', brand: 'Fage', price: 1.29, stock: 48, emoji: '🥣' },
          { name: 'Cheddar Block', brand: 'Tillamook', price: 5.99, stock: 7, emoji: '🧀' },
          { name: 'Butter 1lb', brand: 'Kerrygold', price: 4.99, stock: 0, emoji: '🧈' },
        ],
      },
      {
        label: 'Pantry',
        color: PALETTE[3],
        products: [
          { name: 'Spaghetti 1lb', brand: 'Barilla', price: 1.79, stock: 60, emoji: '🍝' },
          { name: 'Marinara Sauce', brand: 'Rao’s', price: 6.49, stock: 18, emoji: '🥫' },
          { name: 'Olive Oil 500ml', brand: 'Bertolli', price: 8.99, stock: 11, emoji: '🫒' },
          { name: 'Jasmine Rice 5lb', brand: 'Three Rings', price: 7.49, stock: 9, emoji: '🍚' },
          { name: 'Peanut Butter', brand: 'Jif', price: 3.49, stock: 26, emoji: '🥜' },
        ],
      },
      {
        label: 'Snacks',
        color: PALETTE[4],
        products: [
          { name: 'Tortilla Chips', brand: 'Tostitos', price: 3.99, stock: 33, emoji: '🌽' },
          { name: 'Dark Chocolate', brand: 'Lindt', price: 2.99, stock: 41, emoji: '🍫' },
          { name: 'Salted Pretzels', brand: 'Snyder’s', price: 2.49, stock: 0, emoji: '🥨' },
          { name: 'Trail Mix', brand: 'Kirkland', price: 9.99, stock: 15, emoji: '🥜' },
        ],
      },
      {
        label: 'Beverages',
        color: PALETTE[5],
        products: [
          { name: 'Sparkling Water 12pk', brand: 'LaCroix', price: 4.99, stock: 28, emoji: '🥤' },
          { name: 'Cold Brew Coffee', brand: 'Stumptown', price: 5.49, stock: 10, emoji: '☕' },
          { name: 'Orange Juice', brand: 'Tropicana', price: 4.29, stock: 19, emoji: '🧃' },
          { name: 'Green Tea 20ct', brand: 'Yogi', price: 4.79, stock: 13, emoji: '🍵' },
        ],
      },
      {
        label: 'Frozen',
        color: PALETTE[6],
        products: [
          { name: 'Vanilla Ice Cream', brand: 'Ben & Jerry’s', price: 5.99, stock: 16, emoji: '🍨' },
          { name: 'Cheese Pizza', brand: 'DiGiorno', price: 6.49, stock: 21, emoji: '🍕' },
          { name: 'Mixed Berries', brand: 'Cascadian', price: 4.49, stock: 0, emoji: '🫐' },
          { name: 'Veggie Dumplings', brand: 'Bibigo', price: 7.99, stock: 8, emoji: '🥟' },
        ],
      },
    ],
  },
  {
    id: 'buildright',
    name: 'BuildRight Hardware',
    address: '88 Industrial Parkway',
    depts: [
      {
        label: 'Hand Tools',
        color: PALETTE[0],
        products: [
          { name: 'Claw Hammer 16oz', brand: 'Estwing', price: 24.99, stock: 14, emoji: '🔨' },
          { name: 'Screwdriver Set 6pc', brand: 'Klein', price: 19.99, stock: 9, emoji: '🪛' },
          { name: 'Tape Measure 25ft', brand: 'Stanley', price: 12.49, stock: 30, emoji: '📏' },
          { name: 'Adjustable Wrench', brand: 'Crescent', price: 15.99, stock: 0, emoji: '🔧' },
        ],
      },
      {
        label: 'Power Tools',
        color: PALETTE[1],
        products: [
          { name: 'Cordless Drill 20V', brand: 'DeWalt', price: 99.0, stock: 7, emoji: '🪫' },
          { name: 'Circular Saw', brand: 'Makita', price: 129.0, stock: 4, emoji: '🪚' },
          { name: 'Orbital Sander', brand: 'Bosch', price: 59.0, stock: 6, emoji: '🌀' },
          { name: 'Impact Driver', brand: 'Milwaukee', price: 149.0, stock: 0, emoji: '⚙️' },
        ],
      },
      {
        label: 'Paint',
        color: PALETTE[2],
        products: [
          { name: 'Interior Paint 1gal', brand: 'Behr', price: 34.99, stock: 22, emoji: '🪣' },
          { name: 'Roller Kit', brand: 'Purdy', price: 14.99, stock: 18, emoji: '🖌️' },
          { name: 'Painter’s Tape', brand: 'ScotchBlue', price: 7.49, stock: 40, emoji: '🩹' },
          { name: 'Drop Cloth 9x12', brand: 'Trimaco', price: 9.99, stock: 11, emoji: '🧻' },
        ],
      },
      {
        label: 'Plumbing',
        color: PALETTE[3],
        products: [
          { name: 'PVC Pipe 10ft', brand: 'Charlotte', price: 8.99, stock: 25, emoji: '🚰' },
          { name: 'Teflon Tape', brand: 'Oatey', price: 1.99, stock: 60, emoji: '🧵' },
          { name: 'Sink Trap Kit', brand: 'Keeney', price: 12.99, stock: 0, emoji: '🪠' },
          { name: 'Faucet Cartridge', brand: 'Moen', price: 24.99, stock: 5, emoji: '🚿' },
        ],
      },
      {
        label: 'Electrical',
        color: PALETTE[4],
        products: [
          { name: 'Wire Nuts 100pk', brand: 'Ideal', price: 9.99, stock: 33, emoji: '🔌' },
          { name: 'Outlet Duplex', brand: 'Leviton', price: 2.49, stock: 50, emoji: '🔋' },
          { name: 'LED Bulbs 4pk', brand: 'Philips', price: 11.99, stock: 27, emoji: '💡' },
          { name: 'Extension Cord 50ft', brand: 'Southwire', price: 29.99, stock: 0, emoji: '🧯' },
        ],
      },
      {
        label: 'Fasteners',
        color: PALETTE[5],
        products: [
          { name: 'Wood Screws 1lb', brand: 'GRK', price: 8.49, stock: 44, emoji: '🔩' },
          { name: 'Drywall Anchors', brand: 'Toggler', price: 6.99, stock: 19, emoji: '📌' },
          { name: 'Hex Bolts Assorted', brand: 'Hillman', price: 12.99, stock: 8, emoji: '⚙️' },
          { name: 'Construction Adhesive', brand: 'Loctite', price: 5.49, stock: 16, emoji: '🧪' },
        ],
      },
      {
        label: 'Garden',
        color: PALETTE[6],
        products: [
          { name: 'Potting Soil 2cu', brand: 'Miracle-Gro', price: 13.99, stock: 20, emoji: '🪴' },
          { name: 'Garden Hose 50ft', brand: 'Flexzilla', price: 39.99, stock: 6, emoji: '🚿' },
          { name: 'Pruning Shears', brand: 'Fiskars', price: 17.99, stock: 12, emoji: '✂️' },
          { name: 'Work Gloves', brand: 'Mechanix', price: 14.99, stock: 0, emoji: '🧤' },
        ],
      },
    ],
  },
  {
    id: 'voltedge',
    name: 'VoltEdge Electronics',
    address: '500 Tech Plaza',
    depts: [
      {
        label: 'Phones',
        color: PALETTE[0],
        products: [
          { name: 'Phone Case Clear', brand: 'Spigen', price: 16.99, stock: 35, emoji: '📱' },
          { name: 'Screen Protector', brand: 'ZAGG', price: 24.99, stock: 28, emoji: '🛡️' },
          { name: 'USB-C Fast Charger', brand: 'Anker', price: 29.99, stock: 0, emoji: '🔌' },
          { name: 'MagSafe Power Bank', brand: 'Anker', price: 49.99, stock: 9, emoji: '🔋' },
        ],
      },
      {
        label: 'Computers',
        color: PALETTE[1],
        products: [
          { name: '14" Laptop', brand: 'Lenovo', price: 699.0, stock: 5, emoji: '💻' },
          { name: 'Wireless Mouse', brand: 'Logitech', price: 39.99, stock: 24, emoji: '🖱️' },
          { name: 'Mechanical Keyboard', brand: 'Keychron', price: 89.99, stock: 11, emoji: '⌨️' },
          { name: '1TB SSD', brand: 'Samsung', price: 109.99, stock: 0, emoji: '💾' },
        ],
      },
      {
        label: 'Audio',
        color: PALETTE[2],
        products: [
          { name: 'Noise-Cancel Headphones', brand: 'Sony', price: 349.0, stock: 6, emoji: '🎧' },
          { name: 'Wireless Earbuds', brand: 'Apple', price: 179.0, stock: 14, emoji: '🎵' },
          { name: 'Bluetooth Speaker', brand: 'JBL', price: 59.99, stock: 19, emoji: '🔊' },
          { name: 'USB Microphone', brand: 'Blue Yeti', price: 99.99, stock: 0, emoji: '🎙️' },
        ],
      },
      {
        label: 'TV & Video',
        color: PALETTE[3],
        products: [
          { name: '55" 4K TV', brand: 'TCL', price: 399.0, stock: 4, emoji: '📺' },
          { name: 'Streaming Stick 4K', brand: 'Roku', price: 49.99, stock: 30, emoji: '📡' },
          { name: 'Soundbar', brand: 'Vizio', price: 129.0, stock: 8, emoji: '🔉' },
          { name: 'HDMI Cable 6ft', brand: 'Belkin', price: 14.99, stock: 50, emoji: '🪢' },
        ],
      },
      {
        label: 'Gaming',
        color: PALETTE[4],
        products: [
          { name: 'Game Controller', brand: 'Xbox', price: 59.99, stock: 16, emoji: '🎮' },
          { name: 'Gaming Headset', brand: 'HyperX', price: 79.99, stock: 7, emoji: '🎧' },
          { name: 'Console 1TB', brand: 'PlayStation', price: 499.0, stock: 0, emoji: '🕹️' },
          { name: 'microSD 256GB', brand: 'SanDisk', price: 29.99, stock: 22, emoji: '💽' },
        ],
      },
      {
        label: 'Cameras',
        color: PALETTE[5],
        products: [
          { name: 'Action Camera', brand: 'GoPro', price: 349.0, stock: 5, emoji: '📷' },
          { name: 'Webcam 1080p', brand: 'Logitech', price: 69.99, stock: 13, emoji: '📹' },
          { name: 'Tripod', brand: 'Manfrotto', price: 44.99, stock: 9, emoji: '📐' },
          { name: 'SD Card 128GB', brand: 'Lexar', price: 22.99, stock: 0, emoji: '💳' },
        ],
      },
      {
        label: 'Cables & Power',
        color: PALETTE[6],
        products: [
          { name: 'USB-C Cable 6ft', brand: 'Anker', price: 12.99, stock: 60, emoji: '🪢' },
          { name: 'Surge Protector 6-outlet', brand: 'Belkin', price: 19.99, stock: 21, emoji: '🔌' },
          { name: 'Wall Adapter 30W', brand: 'UGREEN', price: 17.99, stock: 18, emoji: '🔋' },
          { name: 'AA Batteries 24pk', brand: 'Energizer', price: 16.99, stock: 0, emoji: '🪫' },
        ],
      },
    ],
  },
  // Representative big-box layouts so the demo can be tested with familiar
  // names. These are illustrative floor plans, not a specific physical store —
  // real per-store aisle maps would come from the retailer's data.
  {
    id: 'walmart',
    name: 'Walmart Supercenter',
    address: 'Demo layout · your local store',
    depts: [
      {
        label: 'Grocery',
        color: PALETTE[0],
        products: [
          { name: 'Whole Milk 1gal', brand: 'Great Value', price: 2.98, stock: 64, emoji: '🥛' },
          { name: 'White Bread', brand: 'Wonder', price: 1.48, stock: 40, emoji: '🍞' },
          { name: 'Bananas (lb)', brand: 'Fresh', price: 0.58, stock: 120, emoji: '🍌' },
          { name: 'Large Eggs 18ct', brand: 'Great Value', price: 4.32, stock: 0, emoji: '🥚' },
          { name: 'Ground Coffee', brand: 'Folgers', price: 9.97, stock: 22, emoji: '☕' },
        ],
      },
      {
        label: 'Household',
        color: PALETTE[1],
        products: [
          { name: 'Paper Towels 6pk', brand: 'Bounty', price: 12.97, stock: 30, emoji: '🧻' },
          { name: 'Laundry Detergent', brand: 'Tide', price: 13.97, stock: 18, emoji: '🧴' },
          { name: 'Trash Bags 40ct', brand: 'Hefty', price: 8.97, stock: 25, emoji: '🗑️' },
          { name: 'Dish Soap', brand: 'Dawn', price: 3.97, stock: 0, emoji: '🧼' },
        ],
      },
      {
        label: 'Health & Beauty',
        color: PALETTE[2],
        products: [
          { name: 'Toothpaste', brand: 'Crest', price: 3.47, stock: 44, emoji: '🪥' },
          { name: 'Shampoo', brand: 'Pantene', price: 5.97, stock: 19, emoji: '🧴' },
          { name: 'Ibuprofen 200mg', brand: 'Equate', price: 4.88, stock: 33, emoji: '💊' },
          { name: 'Bandages 60ct', brand: 'Band-Aid', price: 4.27, stock: 12, emoji: '🩹' },
        ],
      },
      {
        label: 'Electronics',
        color: PALETTE[3],
        products: [
          { name: 'Streaming Stick 4K', brand: 'Roku', price: 39.88, stock: 14, emoji: '📡' },
          { name: 'HDMI Cable', brand: 'onn.', price: 9.96, stock: 50, emoji: '🪢' },
          { name: 'Wireless Earbuds', brand: 'onn.', price: 19.88, stock: 0, emoji: '🎵' },
          { name: 'AA Batteries 20pk', brand: 'Energizer', price: 14.97, stock: 27, emoji: '🪫' },
        ],
      },
      {
        label: 'Apparel',
        color: PALETTE[4],
        products: [
          { name: 'Crew Socks 6pk', brand: 'Hanes', price: 8.97, stock: 36, emoji: '🧦' },
          { name: 'Graphic T-Shirt', brand: 'George', price: 7.98, stock: 21, emoji: '👕' },
          { name: 'Baby Onesie 3pk', brand: 'Garanimals', price: 6.97, stock: 9, emoji: '👶' },
        ],
      },
      {
        label: 'Toys',
        color: PALETTE[5],
        products: [
          { name: 'Building Blocks Set', brand: 'LEGO', price: 19.97, stock: 13, emoji: '🧱' },
          { name: 'Board Game', brand: 'Hasbro', price: 14.97, stock: 8, emoji: '🎲' },
          { name: 'Action Figure', brand: 'Marvel', price: 9.97, stock: 0, emoji: '🦸' },
        ],
      },
      {
        label: 'Pharmacy',
        color: PALETTE[6],
        products: [
          { name: 'Allergy Relief 30ct', brand: 'Equate', price: 7.94, stock: 22, emoji: '🤧' },
          { name: 'Vitamin D3', brand: 'Spring Valley', price: 6.48, stock: 17, emoji: '💊' },
          { name: 'Hand Sanitizer', brand: 'Purell', price: 2.97, stock: 40, emoji: '🧴' },
        ],
      },
    ],
  },
  {
    id: 'target',
    name: 'Target',
    address: 'Demo layout · your local store',
    depts: [
      {
        label: 'Grocery',
        color: PALETTE[0],
        products: [
          { name: 'Sparkling Water 8pk', brand: 'Good & Gather', price: 3.49, stock: 30, emoji: '🥤' },
          { name: 'Tortilla Chips', brand: 'Good & Gather', price: 2.49, stock: 41, emoji: '🌽' },
          { name: 'Oat Milk', brand: 'Oatly', price: 4.99, stock: 0, emoji: '🥛' },
          { name: 'Trail Mix', brand: 'Good & Gather', price: 5.99, stock: 18, emoji: '🥜' },
        ],
      },
      {
        label: 'Home',
        color: PALETTE[1],
        products: [
          { name: 'Throw Pillow', brand: 'Threshold', price: 14.99, stock: 16, emoji: '🛋️' },
          { name: 'Scented Candle', brand: 'Threshold', price: 9.99, stock: 24, emoji: '🕯️' },
          { name: 'Bath Towel', brand: 'Threshold', price: 8.99, stock: 0, emoji: '🧖' },
          { name: 'Picture Frame', brand: 'Room Essentials', price: 5.99, stock: 12, emoji: '🖼️' },
        ],
      },
      {
        label: 'Beauty',
        color: PALETTE[2],
        products: [
          { name: 'Moisturizer', brand: 'CeraVe', price: 16.99, stock: 19, emoji: '🧴' },
          { name: 'Lip Balm', brand: 'Burt’s Bees', price: 3.99, stock: 38, emoji: '💄' },
          { name: 'Sunscreen SPF 50', brand: 'Supergoop', price: 21.99, stock: 6, emoji: '🧴' },
        ],
      },
      {
        label: 'Electronics',
        color: PALETTE[3],
        products: [
          { name: 'Bluetooth Speaker', brand: 'JBL', price: 49.99, stock: 9, emoji: '🔊' },
          { name: 'Phone Charger USB-C', brand: 'heyday', price: 12.99, stock: 33, emoji: '🔌' },
          { name: 'Headphones', brand: 'JBL', price: 29.99, stock: 0, emoji: '🎧' },
          { name: 'Gift Card', brand: 'Target', price: 25.0, stock: 200, emoji: '💳' },
        ],
      },
      {
        label: 'Kids & Toys',
        color: PALETTE[4],
        products: [
          { name: 'Plush Animal', brand: 'Gund', price: 12.99, stock: 15, emoji: '🧸' },
          { name: 'Craft Kit', brand: 'Crayola', price: 9.99, stock: 11, emoji: '🖍️' },
          { name: 'Puzzle 500pc', brand: 'Cardinal', price: 7.99, stock: 0, emoji: '🧩' },
        ],
      },
      {
        label: 'Apparel',
        color: PALETTE[5],
        products: [
          { name: 'Joggers', brand: 'All in Motion', price: 22.0, stock: 14, emoji: '👖' },
          { name: 'Basic Tee', brand: 'A New Day', price: 8.0, stock: 26, emoji: '👕' },
          { name: 'Ankle Socks 6pk', brand: 'Cat & Jack', price: 7.99, stock: 9, emoji: '🧦' },
        ],
      },
      {
        label: 'Pharmacy',
        color: PALETTE[6],
        products: [
          { name: 'Pain Reliever', brand: 'up&up', price: 5.49, stock: 28, emoji: '💊' },
          { name: 'First Aid Kit', brand: 'up&up', price: 9.99, stock: 7, emoji: '🩹' },
          { name: 'Multivitamin', brand: 'up&up', price: 8.99, stock: 0, emoji: '💊' },
        ],
      },
    ],
  },
]

export const STORES: Store[] = STORE_DEFS.map(buildStore)

export function getStore(id: string): Store | undefined {
  return STORES.find((s) => s.id === id)
}
