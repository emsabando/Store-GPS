// Store-GPS — sample product catalog for the demo.
// Each product maps to an aisle/section so shoppers can find it fast.
const PRODUCTS = [
  { name: "Milk",      emoji: "🥛", aisle: 3, section: "Dairy & Eggs",    keywords: ["milk", "dairy"] },
  { name: "Cheese",    emoji: "🧀", aisle: 3, section: "Dairy & Eggs",    keywords: ["cheese", "dairy"] },
  { name: "Eggs",      emoji: "🥚", aisle: 3, section: "Dairy & Eggs",    keywords: ["eggs", "egg"] },
  { name: "Bananas",   emoji: "🍌", aisle: 1, section: "Fresh Produce",   keywords: ["banana", "bananas", "fruit"] },
  { name: "Apples",    emoji: "🍎", aisle: 1, section: "Fresh Produce",   keywords: ["apple", "apples", "fruit"] },
  { name: "Tomatoes",  emoji: "🍅", aisle: 1, section: "Fresh Produce",   keywords: ["tomato", "tomatoes", "veg"] },
  { name: "Bread",     emoji: "🍞", aisle: 2, section: "Bakery",          keywords: ["bread", "loaf", "bakery"] },
  { name: "Croissant", emoji: "🥐", aisle: 2, section: "Bakery",          keywords: ["croissant", "pastry", "bakery"] },
  { name: "Coffee",    emoji: "☕", aisle: 5, section: "Beverages",       keywords: ["coffee", "drink"] },
  { name: "Water",     emoji: "💧", aisle: 5, section: "Beverages",       keywords: ["water", "drink"] },
  { name: "Soda",      emoji: "🥤", aisle: 5, section: "Beverages",       keywords: ["soda", "cola", "drink"] },
  { name: "Shampoo",   emoji: "🧴", aisle: 8, section: "Health & Beauty", keywords: ["shampoo", "hair"] },
  { name: "Toothpaste",emoji: "🪥", aisle: 8, section: "Health & Beauty", keywords: ["toothpaste", "dental"] },
  { name: "Soap",      emoji: "🧼", aisle: 8, section: "Health & Beauty", keywords: ["soap", "wash"] },
  { name: "Chips",     emoji: "🍟", aisle: 6, section: "Snacks",          keywords: ["chips", "crisps", "snack"] },
  { name: "Chocolate", emoji: "🍫", aisle: 6, section: "Snacks",          keywords: ["chocolate", "candy", "snack"] },
  { name: "Rice",      emoji: "🍚", aisle: 4, section: "Pantry",          keywords: ["rice", "grain"] },
  { name: "Pasta",     emoji: "🍝", aisle: 4, section: "Pantry",          keywords: ["pasta", "spaghetti", "noodle"] },
  { name: "Chicken",   emoji: "🍗", aisle: 7, section: "Meat & Seafood",  keywords: ["chicken", "poultry", "meat"] },
  { name: "Fish",      emoji: "🐟", aisle: 7, section: "Meat & Seafood",  keywords: ["fish", "salmon", "seafood"] },
];

const AISLE_COUNT = 8;

const searchInput = document.getElementById("search");
const clearBtn = document.getElementById("clear-btn");
const resultsEl = document.getElementById("results");
const chips = document.getElementById("chips");

function search(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return PRODUCTS.filter((p) =>
    p.name.toLowerCase().includes(q) ||
    p.section.toLowerCase().includes(q) ||
    p.keywords.some((k) => k.includes(q))
  );
}

function aisleMap(activeAisles) {
  const cells = [];
  for (let i = 1; i <= AISLE_COUNT; i++) {
    const active = activeAisles.has(i) ? " active" : "";
    cells.push(
      `<div class="aisle${active}"><span class="aisle-num">${i}</span>Aisle</div>`
    );
  }
  return `
    <div class="map">
      <h3>📍 Where to go</h3>
      <div class="map-grid">${cells.join("")}</div>
    </div>`;
}

function render(query) {
  const matches = search(query);
  clearBtn.hidden = !query;

  // Empty state — nothing typed yet
  if (!query.trim()) {
    resultsEl.innerHTML = `
      <div class="placeholder">
        <div class="placeholder-emoji">🛒</div>
        <p>Search above to find any product and the exact aisle it's in.</p>
      </div>`;
    return;
  }

  // No matches
  if (matches.length === 0) {
    resultsEl.innerHTML = `
      <div class="no-result">
        <div class="placeholder-emoji">🤔</div>
        <p>No products match “${escapeHtml(query)}”.<br>Try a simpler word like “milk” or “bread”.</p>
      </div>`;
    return;
  }

  const activeAisles = new Set(matches.map((m) => m.aisle));
  const cards = matches
    .map(
      (p) => `
      <div class="result-card">
        <div class="result-emoji">${p.emoji}</div>
        <div class="result-info">
          <p class="result-name">${p.name}</p>
          <span class="result-loc">📍 Aisle ${p.aisle} · ${p.section}</span>
          <div class="result-meta"><span class="in-stock">● In stock</span> · a short walk away</div>
        </div>
      </div>`
    )
    .join("");

  resultsEl.innerHTML = cards + aisleMap(activeAisles);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Events
searchInput.addEventListener("input", (e) => render(e.target.value));

clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  render("");
});

chips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  searchInput.value = btn.dataset.term;
  searchInput.focus();
  render(btn.dataset.term);
});

// Initial state
render("");
