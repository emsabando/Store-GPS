/*
 * store.js — persistence + derived-state layer
 *
 * Everything the app knows lives in one object persisted to localStorage.
 * The store is the single source of truth. UI code reads derived helpers
 * and calls action methods that mutate + persist + notify subscribers.
 */

const Store = (() => {
  const KEY = "monica_debt_app_v1";
  let state = null;
  const listeners = new Set();

  // ---- id helper (no Date.now dependency for testability) ------------------
  let _seq = 0;
  function uid(prefix = "id") {
    _seq += 1;
    return `${prefix}_${_seq}_${Math.floor(performance.now() * 1000)}`;
  }

  // ---- load / save ---------------------------------------------------------
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

  function freshState() {
    const s = deepClone(SEED);
    // add live "balance" mirror; balance is derived from payments but we cache it
    s.debts.forEach((d) => { d.startBalance = d.startBalance; });
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        // light migration guard: make sure arrays exist
        state.incomeLog = state.incomeLog || [];
        state.payments = state.payments || [];
      } else {
        state = freshState();
        save();
      }
    } catch (e) {
      console.error("Failed to load state, starting fresh", e);
      state = freshState();
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error("Failed to save state", e);
    }
  }

  function notify() {
    save();
    listeners.forEach((fn) => fn(state));
  }

  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  // ---- derived helpers -----------------------------------------------------

  // total paid toward a specific debt
  function paidToDebt(debtId) {
    return state.payments
      .filter((p) => p.debtId === debtId)
      .reduce((s, p) => s + p.amount, 0);
  }

  // current live balance = starting balance − payments (floored at 0)
  function debtBalance(debt) {
    return Math.max(0, round2(debt.startBalance - paidToDebt(debt.id)));
  }

  function debtsWithBalances() {
    return state.debts.map((d) => {
      const balance = debtBalance(d);
      return { ...d, balance, paid: round2(d.startBalance - balance), paidOff: balance <= 0 };
    });
  }

  function totalStartingDebt() {
    return round2(state.debts.reduce((s, d) => s + d.startBalance, 0));
  }

  function totalRemaining() {
    return round2(debtsWithBalances().reduce((s, d) => s + d.balance, 0));
  }

  function totalPaidOff() {
    return round2(totalStartingDebt() - totalRemaining());
  }

  function percentPaid() {
    const start = totalStartingDebt();
    return start === 0 ? 0 : (totalPaidOff() / start) * 100;
  }

  // active minimums = sum of minimums for debts that still carry a balance
  function activeMinimums() {
    return round2(debtsWithBalances()
      .filter((d) => d.balance > 0)
      .reduce((s, d) => s + d.minimum, 0));
  }

  // income totals for a given YYYY-MM (or all-time if month omitted)
  function incomeTotals(monthKey) {
    const rows = monthKey
      ? state.incomeLog.filter((i) => i.dateISO.slice(0, 7) === monthKey)
      : state.incomeLog;
    const by = { delivery: 0, takehome: 0, other: 0 };
    rows.forEach((i) => { by[i.source] = (by[i.source] || 0) + i.amount; });
    by.total = by.delivery + by.takehome + by.other;
    by.extra = by.delivery + by.other; // "extra / supplemental" income
    return by;
  }

  function paymentsInMonth(monthKey) {
    const rows = monthKey
      ? state.payments.filter((p) => p.dateISO.slice(0, 7) === monthKey)
      : state.payments;
    return round2(rows.reduce((s, p) => s + p.amount, 0));
  }

  // months present in the data, most recent first, always including current
  function monthsWithActivity() {
    const set = new Set();
    state.incomeLog.forEach((i) => set.add(i.dateISO.slice(0, 7)));
    state.payments.forEach((p) => set.add(p.dateISO.slice(0, 7)));
    set.add(currentMonthKey());
    return [...set].sort().reverse();
  }

  // ---- actions -------------------------------------------------------------

  function addIncome({ dateISO, source, amount, note }) {
    state.incomeLog.push({ id: uid("inc"), dateISO, source, amount: round2(+amount), note: note || "" });
    notify();
  }

  function addPayment({ dateISO, debtId, amount, note }) {
    state.payments.push({ id: uid("pay"), dateISO, debtId, amount: round2(+amount), note: note || "" });
    notify();
  }

  function deleteIncome(id) {
    state.incomeLog = state.incomeLog.filter((i) => i.id !== id);
    notify();
  }

  function deletePayment(id) {
    state.payments = state.payments.filter((p) => p.id !== id);
    notify();
  }

  function updateBudgetPlanned(id, planned) {
    const b = state.budget.find((x) => x.id === id);
    if (b) { b.planned = round2(+planned); notify(); }
  }

  function setSetting(key, value) {
    state.settings[key] = value;
    notify();
  }

  // adjust a debt's starting balance / minimum / apr (for corrections)
  function updateDebt(id, patch) {
    const d = state.debts.find((x) => x.id === id);
    if (d) { Object.assign(d, patch); notify(); }
  }

  function resetToPlan() {
    state = freshState();
    notify();
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    state = parsed;
    state.incomeLog = state.incomeLog || [];
    state.payments = state.payments || [];
    notify();
  }

  // ---- init ----------------------------------------------------------------
  load();

  return {
    get state() { return state; },
    subscribe,
    // derived
    debtsWithBalances, debtBalance, paidToDebt,
    totalStartingDebt, totalRemaining, totalPaidOff, percentPaid,
    activeMinimums, incomeTotals, paymentsInMonth, monthsWithActivity,
    // actions
    addIncome, addPayment, deleteIncome, deletePayment,
    updateBudgetPlanned, setSetting, updateDebt, resetToPlan,
    exportJSON, importJSON,
    uid,
  };
})();

// ---- small shared utilities -------------------------------------------------
function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(n, showCents = false) {
  const opts = showCents
    ? { style: "currency", currency: "USD" }
    : { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 };
  return new Intl.NumberFormat("en-US", opts).format(n || 0);
}

function fmtPct(n, digits = 1) {
  return `${(n || 0).toFixed(digits)}%`;
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
