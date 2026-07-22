/*
 * app.js — UI controller
 *
 * Renders each tab from Store state, wires up the add-income / add-payment
 * flows, the budget editor, the projection chart, and settings. Everything
 * re-renders reactively whenever the Store notifies of a change, so logged
 * income and payments update every number automatically.
 */

(() => {
  const view = document.getElementById("view");
  const tabbar = document.getElementById("tabbar");
  const modalRoot = document.getElementById("modal-root");

  let activeTab = "dashboard";

  // ---- theme ---------------------------------------------------------------
  function initTheme() {
    const saved = localStorage.getItem("monica_theme");
    if (saved) document.documentElement.setAttribute("data-theme", saved);
    document.getElementById("btn-theme").addEventListener("click", () => {
      const cur = document.documentElement.getAttribute("data-theme");
      const next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("monica_theme", next);
    });
  }

  // ---- helpers -------------------------------------------------------------
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function debtInitials(name) {
    return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  // ============================================================
  // DASHBOARD
  // ============================================================
  function renderDashboard() {
    const remaining = Store.totalRemaining();
    const start = Store.totalStartingDebt();
    const paid = Store.totalPaidOff();
    const pct = Store.percentPaid();
    const method = Store.state.settings.method;
    const extra = Store.state.settings.extraMonthly;

    const debts = Store.debtsWithBalances();
    const proj = Calc.project(debts, extra, method);
    const dfDate = Calc.debtFreeDate(proj.months);

    const mk = currentMonthKey();
    const inc = Store.incomeTotals(mk);
    const paidThisMonth = Store.paymentsInMonth(mk);

    // next target debt (first with balance, in method order)
    const activeDebts = debts.filter((d) => d.balance > 0);
    const targetSorted = [...activeDebts].sort((a, b) =>
      method === "avalanche" ? (b.apr - a.apr || a.balance - b.balance) : (a.balance - b.balance || b.apr - a.apr));
    const target = targetSorted[0];

    const dfStr = dfDate
      ? dfDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : "—";

    view.innerHTML = "";

    // hero
    view.appendChild(el(`
      <div class="card hero">
        <div class="hero-label">Total debt remaining</div>
        <div class="hero-amount">${fmtMoney(remaining)}</div>
        <div class="hero-sub">${fmtMoney(paid)} paid of ${fmtMoney(start)} · ${fmtPct(pct)} gone</div>
        <div class="progress"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>
        <div class="hero-row">
          <div class="hero-stat"><div class="n">${dfStr}</div><div class="l">Debt-free (est.)</div></div>
          <div class="hero-stat"><div class="n">${proj.months || "—"} mo</div><div class="l">Payoff length</div></div>
          <div class="hero-stat"><div class="n">${fmtMoney(proj.totalInterest)}</div><div class="l">Interest left</div></div>
        </div>
      </div>
    `));

    // this-month snapshot
    view.appendChild(el(`<div class="section-title">This month · ${monthLabel(mk)}</div>`));
    view.appendChild(el(`
      <div class="stat-grid">
        <div class="stat"><div class="val pos">${fmtMoney(inc.extra)}</div><div class="lab">Extra income earned</div></div>
        <div class="stat"><div class="val">${fmtMoney(paidThisMonth)}</div><div class="lab">Sent to debt</div></div>
        <div class="stat"><div class="val">${fmtMoney(Store.activeMinimums())}</div><div class="lab">Active minimums / mo</div></div>
        <div class="stat"><div class="val pos">${fmtMoney(inc.total)}</div><div class="lab">All income this month</div></div>
      </div>
    `));

    const quick = el(`<div class="btn-row mt"></div>`);
    const bInc = el(`<button class="btn primary sm grow">+ Log income</button>`);
    const bPay = el(`<button class="btn coral sm grow">+ Log payment</button>`);
    bInc.onclick = () => openIncomeModal();
    bPay.onclick = () => openPaymentModal();
    quick.append(bInc, bPay);
    view.appendChild(quick);

    // current target / focus debt
    if (target) {
      const tpct = start ? ((target.startBalance - target.balance) / target.startBalance) * 100 : 0;
      view.appendChild(el(`<div class="section-title">Your focus debt</div>`));
      const c = el(`
        <div class="card">
          <div class="flex-between">
            <div class="debt-name">${esc(target.name)} <span class="pill target">${method === "avalanche" ? "Highest APR" : "Smallest first"}</span></div>
            <div class="debt-bal">${fmtMoney(target.balance)}</div>
          </div>
          <div class="debt-meta">${(target.apr * 100).toFixed(2)}% APR · min ${fmtMoney(target.minimum)} · due the ${ordinal(target.dueDay)}${target.promo ? " · " + esc(target.promo) : ""}</div>
          <div class="debt-line"><span style="width:${Math.min(100, tpct).toFixed(1)}%"></span></div>
          <div class="callout mt">Knock this out next, then roll its ${fmtMoney(target.minimum)} minimum into the following debt. Snowball pool now: <b>${fmtMoney(Store.activeMinimums() + extra)}</b>/mo.</div>
        </div>`);
      const payBtn = el(`<button class="btn coral mt">Make a payment to ${esc(target.name)}</button>`);
      payBtn.onclick = () => openPaymentModal(target.id);
      c.appendChild(payBtn);
      view.appendChild(c);
    } else {
      view.appendChild(el(`<div class="card"><div class="empty"><span class="big">🎉</span>Every debt is paid off. You did it, Monica!</div></div>`));
    }

    // promo warnings
    const promos = debts.filter((d) => d.balance > 0 && /promo/i.test(d.promo));
    if (promos.length) {
      view.appendChild(el(`<div class="section-title">Watch these 0% promos</div>`));
      const wrap = el(`<div class="card tight"></div>`);
      promos.forEach((d) => wrap.appendChild(el(`
        <div class="row">
          <div class="row-ico" style="background:var(--amber-tint);color:var(--amber)">⏰</div>
          <div class="row-main"><div class="row-title">${esc(d.name)}</div><div class="row-sub">${esc(d.promo)}</div></div>
          <div class="row-amt mono">${fmtMoney(d.balance)}</div>
        </div>`)));
      view.appendChild(wrap);
    }
  }

  // ============================================================
  // DEBTS
  // ============================================================
  function renderDebts() {
    const method = Store.state.settings.method;
    const debts = Store.debtsWithBalances();
    const ordered = [...debts].sort((a, b) => {
      // paid-off sink to bottom; else method order
      if (a.paidOff !== b.paidOff) return a.paidOff ? 1 : -1;
      return method === "avalanche" ? (b.apr - a.apr || a.balance - b.balance) : (a.balance - b.balance || b.apr - a.apr);
    });
    const firstActiveId = ordered.find((d) => !d.paidOff)?.id;

    view.innerHTML = "";
    view.appendChild(el(`
      <div class="card">
        <div class="flex-between">
          <div><strong>Payoff method</strong><div class="tiny muted">How the app orders your attack plan</div></div>
        </div>
        <div class="seg mt" id="method-seg">
          <button data-m="snowball" class="${method === "snowball" ? "active" : ""}">❄️ Snowball</button>
          <button data-m="avalanche" class="${method === "avalanche" ? "active" : ""}">🏔️ Avalanche</button>
        </div>
        <div class="tiny muted mt">${method === "snowball"
          ? "Smallest balance first — the plan's method. Fast wins keep momentum."
          : "Highest APR first — saves the most interest. Discover, Sam's & Chase lead."}</div>
      </div>`));

    view.querySelectorAll("#method-seg button").forEach((b) =>
      b.addEventListener("click", () => Store.setSetting("method", b.dataset.m)));

    view.appendChild(el(`<div class="section-title">Your debts · ${fmtMoney(Store.totalRemaining())} left</div>`));
    const list = el(`<div class="card"></div>`);
    ordered.forEach((d, i) => {
      const pct = d.startBalance ? ((d.startBalance - d.balance) / d.startBalance) * 100 : 100;
      let tag = "";
      if (d.paidOff) tag = `<span class="pill done">Paid ✓</span>`;
      else if (d.id === firstActiveId) tag = `<span class="pill target">Target</span>`;
      else if (d.apr >= 0.22) tag = `<span class="pill hot">High APR</span>`;
      else if (/promo/i.test(d.promo)) tag = `<span class="pill promo">Promo</span>`;
      else if (d.apr === 0) tag = `<span class="pill zero">0%</span>`;

      const rowEl = el(`
        <div class="debt ${d.paidOff ? "paid" : ""}">
          <div class="debt-badge">${d.paidOff ? "✓" : debtInitials(d.name)}</div>
          <div class="debt-main">
            <div class="debt-name">${esc(d.name)} ${tag}</div>
            <div class="debt-meta">${(d.apr * 100).toFixed(2)}% APR · min ${fmtMoney(d.minimum)} · due ${ordinal(d.dueDay)}</div>
            <div class="debt-line"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>
          </div>
          <div class="debt-right">
            <div class="debt-bal">${fmtMoney(d.balance)}</div>
            <div class="debt-of">of ${fmtMoney(d.startBalance)}</div>
          </div>
        </div>`);
      rowEl.addEventListener("click", () => openDebtDetail(d.id));
      list.appendChild(rowEl);
    });
    view.appendChild(list);

    const addPay = el(`<button class="btn coral mt">+ Log a payment</button>`);
    addPay.onclick = () => openPaymentModal();
    view.appendChild(addPay);
  }

  // ============================================================
  // BUDGET  (EveryDollar-style)
  // ============================================================
  function renderBudget() {
    const b = Store.state.budget;
    const income = Store.state.profile.takeHomeIncome;
    const mins = Store.activeMinimums();
    const plannedExpenses = round2(b.reduce((s, x) => s + x.planned, 0));
    const totalOut = round2(plannedExpenses + mins);
    const gap = round2(income - totalOut);

    view.innerHTML = "";
    view.appendChild(el(`
      <div class="card hero" style="background:linear-gradient(150deg,var(--green),var(--green-600))">
        <div class="hero-label">Monthly zero-based budget</div>
        <div class="hero-amount">${fmtMoney(gap)}</div>
        <div class="hero-sub">${gap < 0 ? "Base gap to cover with extra income" : "Left over after every planned dollar"}</div>
        <div class="hero-row">
          <div class="hero-stat"><div class="n">${fmtMoney(income)}</div><div class="l">Take-home</div></div>
          <div class="hero-stat"><div class="n">${fmtMoney(plannedExpenses)}</div><div class="l">Living</div></div>
          <div class="hero-stat"><div class="n">${fmtMoney(mins)}</div><div class="l">Debt mins</div></div>
        </div>
      </div>`));

    if (gap < 0) {
      view.appendChild(el(`<div class="callout warn">Your base budget runs ${fmtMoney(Math.abs(gap))} short each month. Delivery / extra income needs to cover this gap first, then everything above it goes to the debt snowball.</div>`));
    }

    view.appendChild(el(`<div class="section-title">Living expenses · tap an amount to edit</div>`));
    const card = el(`<div class="card"></div>`);
    b.forEach((item) => {
      const line = el(`
        <div class="bline">
          <div class="bname"><b>${esc(item.name)}</b><small>Due ${esc(item.due)}</small></div>
          <div class="binput"><span>$</span><input type="number" inputmode="decimal" min="0" step="1" value="${item.planned}" data-id="${item.id}"></div>
        </div>`);
      const input = line.querySelector("input");
      input.addEventListener("change", () => Store.updateBudgetPlanned(item.id, input.value || 0));
      card.appendChild(line);
    });
    view.appendChild(card);

    view.appendChild(el(`<div class="section-title">Debt minimums (from Debts tab)</div>`));
    view.appendChild(el(`
      <div class="card tight">
        <div class="row">
          <div class="row-ico out">▤</div>
          <div class="row-main"><div class="row-title">All active minimum payments</div><div class="row-sub">Auto-summed · drops as debts clear</div></div>
          <div class="row-amt out mono">${fmtMoney(mins)}</div>
        </div>
      </div>`));

    view.appendChild(el(`
      <div class="card tight mt">
        <div class="flex-between"><span class="muted">Total planned expenses</span><b class="mono">${fmtMoney(totalOut)}</b></div>
        <div class="flex-between mt"><span class="muted">Take-home income</span><b class="mono">${fmtMoney(income)}</b></div>
        <div class="flex-between mt"><span class="muted">Base monthly gap</span><b class="mono" style="color:${gap < 0 ? "var(--coral)" : "var(--green-500)"}">${fmtMoney(gap)}</b></div>
      </div>`));
  }

  // ============================================================
  // PROGRESS  (chart + 9-month tracker + scenarios)
  // ============================================================
  function renderProgress() {
    const method = Store.state.settings.method;
    const extra = Store.state.settings.extraMonthly;
    const debts = Store.debtsWithBalances();
    const proj = Calc.project(debts, extra, method);

    view.innerHTML = "";

    // ---- extra-income slider ----
    view.appendChild(el(`<div class="section-title">Plan your extra payment</div>`));
    const sliderCard = el(`
      <div class="card">
        <div class="slider-val" id="sv">${fmtMoney(extra)}<span class="tiny muted" style="font-weight:600"> / month extra</span></div>
        <div class="slider-wrap"><input type="range" id="extra-slider" min="0" max="1200" step="25" value="${extra}"></div>
        <div class="slider-scale"><span>$0</span><span>$550</span><span>$800</span><span>$1,200</span></div>
        <div class="callout mt" id="slider-note"></div>
      </div>`);
    view.appendChild(sliderCard);

    // ---- payoff chart ----
    view.appendChild(el(`<div class="section-title">Projected payoff (interest included)</div>`));
    const chartCard = el(`<div class="card"><div class="chart-wrap" id="chart"></div>
      <div class="chart-legend"><span><i style="background:var(--green-500)"></i>Balance remaining</span></div></div>`);
    view.appendChild(chartCard);

    // ---- scenario table (mirrors the plan's 9-month table, interest-aware) ----
    view.appendChild(el(`<div class="section-title">Compare extra amounts</div>`));
    const scenarios = Calc.scenarioTable(debts, [550, 675, 800], method);
    const tbl = el(`
      <div class="card"><div class="table-wrap">
      <table class="plan">
        <thead><tr><th>Extra / mo</th><th>Months</th><th>Debt-free</th><th>Interest paid</th></tr></thead>
        <tbody>
          ${scenarios.map((s) => `
            <tr class="${s.extra === extra ? "active" : ""}">
              <td>${fmtMoney(s.extra)}</td>
              <td>${s.months}</td>
              <td>${s.debtFree ? s.debtFree.toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "—"}</td>
              <td>${fmtMoney(s.totalInterest)}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>
      <div class="tiny muted mt">Unlike the plan's simple estimate, these figures accrue interest monthly, so they're a truer payoff picture.</div>
      </div>`);
    view.appendChild(tbl);

    // ---- 9-month tracker (actuals logged in-app) ----
    view.appendChild(el(`<div class="section-title">Monthly progress tracker</div>`));
    view.appendChild(buildTracker());

    // ---- recent activity ----
    view.appendChild(el(`<div class="section-title">Recent activity</div>`));
    view.appendChild(buildActivity());

    // wire slider (live, debounced persist)
    const slider = sliderCard.querySelector("#extra-slider");
    const sv = sliderCard.querySelector("#sv");
    const note = sliderCard.querySelector("#slider-note");
    const paintSlider = (val) => {
      const p = Calc.project(debts, val, method);
      const df = Calc.debtFreeDate(p.months);
      sv.innerHTML = `${fmtMoney(val)}<span class="tiny muted" style="font-weight:600"> / month extra</span>`;
      note.innerHTML = p.months
        ? `Debt-free in <b>${p.months} months</b> (${df.toLocaleDateString("en-US", { month: "long", year: "numeric" })}), paying <b>${fmtMoney(p.totalInterest)}</b> total interest.`
        : `No remaining balance to project.`;
    };
    paintSlider(extra);
    slider.addEventListener("input", () => paintSlider(+slider.value));
    slider.addEventListener("change", () => Store.setSetting("extraMonthly", +slider.value));

    drawChart(chartCard.querySelector("#chart"), proj);
  }

  function buildTracker() {
    const months = Store.monthsWithActivity().slice().reverse(); // chronological
    const wrap = el(`<div class="card tight"></div>`);
    if (months.length === 0) {
      wrap.appendChild(el(`<div class="empty"><span class="big">🗓️</span>Log income and payments to fill your tracker.</div>`));
      return wrap;
    }
    months.forEach((mk) => {
      const inc = Store.incomeTotals(mk);
      const paid = Store.paymentsInMonth(mk);
      // debts cleared during this month
      const cleared = Store.state.payments
        .filter((p) => p.dateISO.slice(0, 7) === mk)
        .map((p) => p.debtId);
      wrap.appendChild(el(`
        <div class="row">
          <div class="row-ico in">${monthLabel(mk).slice(0, 3)}</div>
          <div class="row-main">
            <div class="row-title">${monthLabel(mk)}</div>
            <div class="row-sub">Extra earned ${fmtMoney(inc.extra)} · to debt ${fmtMoney(paid)}</div>
          </div>
          <div class="row-amt in mono">${fmtMoney(inc.total)}</div>
        </div>`));
    });
    return wrap;
  }

  function buildActivity() {
    const items = [
      ...Store.state.incomeLog.map((i) => ({ ...i, kind: "income" })),
      ...Store.state.payments.map((p) => ({ ...p, kind: "payment" })),
    ].sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1)).slice(0, 15);

    const wrap = el(`<div class="card tight"></div>`);
    if (items.length === 0) {
      wrap.appendChild(el(`<div class="empty"><span class="big">📄</span>No entries yet. Tap ＋ to log income or a payment.</div>`));
      return wrap;
    }
    const debtName = (id) => (Store.state.debts.find((d) => d.id === id) || {}).name || "Debt";
    items.forEach((it) => {
      const isInc = it.kind === "income";
      const title = isInc
        ? ({ delivery: "Delivery / extra income", takehome: "Take-home pay", other: "Other income" }[it.source] || "Income")
        : `Payment · ${debtName(it.debtId)}`;
      const row = el(`
        <div class="row">
          <div class="row-ico ${isInc ? "in" : "out"}">${isInc ? "＋" : "▤"}</div>
          <div class="row-main">
            <div class="row-title">${esc(title)}</div>
            <div class="row-sub">${fmtDate(it.dateISO)}${it.note ? " · " + esc(it.note) : ""}</div>
          </div>
          <div class="row-amt ${isInc ? "in" : "out"} mono">${isInc ? "+" : "−"}${fmtMoney(it.amount, true)}</div>
          <button class="row-del" title="Delete">✕</button>
        </div>`);
      row.querySelector(".row-del").onclick = () => {
        if (isInc) Store.deleteIncome(it.id); else Store.deletePayment(it.id);
      };
      wrap.appendChild(row);
    });
    return wrap;
  }

  // ---- SVG line chart (no external libs) -----------------------------------
  function drawChart(host, proj) {
    const W = 640, H = 220, padL = 8, padR = 8, padT = 12, padB = 26;
    const pts = [{ month: 0, remaining: Store.totalRemaining() }, ...proj.schedule];
    if (pts.length < 2) {
      host.innerHTML = `<div class="empty">Nothing left to project 🎉</div>`;
      return;
    }
    const maxY = Math.max(...pts.map((p) => p.remaining), 1);
    const maxX = pts[pts.length - 1].month;
    const x = (m) => padL + (m / maxX) * (W - padL - padR);
    const y = (v) => padT + (1 - v / maxY) * (H - padT - padB);

    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.month).toFixed(1)},${y(p.remaining).toFixed(1)}`).join(" ");
    const area = `${line} L${x(maxX).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`;

    // year gridlines
    let grid = "";
    for (let m = 0; m <= maxX; m += 12) {
      grid += `<line x1="${x(m)}" y1="${padT}" x2="${x(m)}" y2="${H - padB}" stroke="var(--line)" stroke-width="1"/>
               <text x="${x(m) + 2}" y="${H - 8}" font-size="10" fill="var(--ink-soft)">${m === 0 ? "now" : "y" + m / 12}</text>`;
    }

    host.innerHTML = `
      <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Projected debt payoff curve">
        <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--green-500)" stop-opacity=".28"/>
          <stop offset="100%" stop-color="var(--green-500)" stop-opacity="0"/>
        </linearGradient></defs>
        ${grid}
        <path d="${area}" fill="url(#g)"/>
        <path d="${line}" fill="none" stroke="var(--green-500)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(0)}" cy="${y(pts[0].remaining)}" r="3.5" fill="var(--green-500)"/>
        <circle cx="${x(maxX)}" cy="${y(0)}" r="4" fill="var(--green-500)"/>
      </svg>`;
  }

  // ============================================================
  // MODALS
  // ============================================================
  function openModal(innerHTML, onMount) {
    const back = el(`<div class="modal-back"><div class="modal"><div class="modal-grip"></div>${innerHTML}</div></div>`);
    back.addEventListener("click", (e) => { if (e.target === back) close(); });
    function close() { back.remove(); }
    modalRoot.appendChild(back);
    if (onMount) onMount(back.querySelector(".modal"), close);
    return close;
  }

  function openIncomeModal() {
    openModal(`
      <h2>Log income</h2>
      <div class="field">
        <label>Type</label>
        <select id="i-source">
          <option value="delivery">Delivery / extra (supplemental)</option>
          <option value="takehome">Regular take-home pay</option>
          <option value="other">Other income</option>
        </select>
      </div>
      <div class="field"><label>Amount</label><input id="i-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" autofocus></div>
      <div class="field"><label>Date</label><input id="i-date" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Note (optional)</label><input id="i-note" type="text" placeholder="e.g. DoorDash Saturday"></div>
      <button class="btn primary" id="i-save">Save income</button>
    `, (m, close) => {
      m.querySelector("#i-save").onclick = () => {
        const amount = parseFloat(m.querySelector("#i-amt").value);
        if (!amount || amount <= 0) return m.querySelector("#i-amt").focus();
        Store.addIncome({
          dateISO: m.querySelector("#i-date").value || todayISO(),
          source: m.querySelector("#i-source").value,
          amount,
          note: m.querySelector("#i-note").value.trim(),
        });
        close();
      };
    });
  }

  function openPaymentModal(preselectId) {
    const debts = Store.debtsWithBalances().filter((d) => d.balance > 0);
    const method = Store.state.settings.method;
    const sorted = [...debts].sort((a, b) =>
      method === "avalanche" ? (b.apr - a.apr) : (a.balance - b.balance));
    const options = sorted.map((d) =>
      `<option value="${d.id}" ${d.id === (preselectId || sorted[0]?.id) ? "selected" : ""}>${esc(d.name)} — ${fmtMoney(d.balance)} left</option>`).join("");

    if (debts.length === 0) {
      return openModal(`<h2>All paid off 🎉</h2><p class="muted">There are no debts with a remaining balance.</p>`);
    }

    openModal(`
      <h2>Log a debt payment</h2>
      <div class="field"><label>Which debt</label><select id="p-debt">${options}</select></div>
      <div class="field"><label>Amount</label><input id="p-amt" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0.00" autofocus></div>
      <div class="field"><label>Date</label><input id="p-date" type="date" value="${todayISO()}"></div>
      <div class="field"><label>Note (optional)</label><input id="p-note" type="text" placeholder="e.g. extra snowball payment"></div>
      <div class="callout" id="p-hint"></div>
      <button class="btn coral mt" id="p-save">Save payment</button>
    `, (m, close) => {
      const sel = m.querySelector("#p-debt");
      const amt = m.querySelector("#p-amt");
      const hint = m.querySelector("#p-hint");
      const paintHint = () => {
        const d = debts.find((x) => x.id === sel.value);
        const a = parseFloat(amt.value) || 0;
        if (!d) return;
        const after = Math.max(0, d.balance - a);
        hint.innerHTML = a > 0
          ? `New balance for <b>${esc(d.name)}</b>: <b>${fmtMoney(after)}</b>${after === 0 ? " — paid off! 🎉" : ""}`
          : `Minimum due is ${fmtMoney(d.minimum)}. Anything above it is snowball fuel.`;
      };
      sel.onchange = paintHint; amt.oninput = paintHint; paintHint();
      m.querySelector("#p-save").onclick = () => {
        const amount = parseFloat(amt.value);
        if (!amount || amount <= 0) return amt.focus();
        Store.addPayment({
          dateISO: m.querySelector("#p-date").value || todayISO(),
          debtId: sel.value,
          amount,
          note: m.querySelector("#p-note").value.trim(),
        });
        close();
      };
    });
  }

  function openAddSheet() {
    openModal(`
      <h2>What do you want to log?</h2>
      <button class="btn primary" id="a-inc">＋ Income (delivery / pay)</button>
      <button class="btn coral mt" id="a-pay">▤ Debt payment</button>
    `, (m, close) => {
      m.querySelector("#a-inc").onclick = () => { close(); openIncomeModal(); };
      m.querySelector("#a-pay").onclick = () => { close(); openPaymentModal(); };
    });
  }

  function openDebtDetail(id) {
    const d = Store.debtsWithBalances().find((x) => x.id === id);
    if (!d) return;
    const payments = Store.state.payments.filter((p) => p.debtId === id).sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    const pct = d.startBalance ? ((d.startBalance - d.balance) / d.startBalance) * 100 : 100;
    openModal(`
      <h2>${esc(d.name)}</h2>
      <div class="stat-grid">
        <div class="stat"><div class="val">${fmtMoney(d.balance)}</div><div class="lab">Current balance</div></div>
        <div class="stat"><div class="val pos">${fmtMoney(d.paid)}</div><div class="lab">Paid so far</div></div>
        <div class="stat"><div class="val">${(d.apr * 100).toFixed(2)}%</div><div class="lab">APR</div></div>
        <div class="stat"><div class="val">${fmtMoney(d.minimum)}</div><div class="lab">Minimum / mo</div></div>
      </div>
      <div class="progress on-card"><span style="width:${Math.min(100, pct).toFixed(1)}%"></span></div>
      <div class="tiny muted">${fmtPct(pct)} paid · due the ${ordinal(d.dueDay)}${d.promo ? " · " + esc(d.promo) : ""}</div>
      <button class="btn coral mt" id="d-pay">+ Log a payment to ${esc(d.name)}</button>
      <div class="section-title">Payment history</div>
      <div id="d-hist"></div>
    `, (m, close) => {
      m.querySelector("#d-pay").onclick = () => { close(); openPaymentModal(id); };
      const hist = m.querySelector("#d-hist");
      if (payments.length === 0) {
        hist.appendChild(el(`<div class="empty tiny">No payments logged yet.</div>`));
      } else {
        payments.forEach((p) => {
          const row = el(`
            <div class="row">
              <div class="row-ico out">▤</div>
              <div class="row-main"><div class="row-title">${fmtMoney(p.amount, true)}</div><div class="row-sub">${fmtDate(p.dateISO)}${p.note ? " · " + esc(p.note) : ""}</div></div>
              <button class="row-del">✕</button>
            </div>`);
          row.querySelector(".row-del").onclick = () => { Store.deletePayment(p.id); close(); };
          hist.appendChild(row);
        });
      }
    });
  }

  function openMenu() {
    openModal(`
      <h2>Data &amp; settings</h2>
      <div class="callout">Everything is stored privately on this device in your browser. Nothing is uploaded.</div>
      <button class="btn ghost mt" id="m-export">⬇︎ Export my data (JSON)</button>
      <button class="btn ghost mt" id="m-import">⬆︎ Import data</button>
      <input type="file" id="m-file" accept="application/json" style="display:none">
      <button class="btn ghost mt" id="m-reset">↺ Reset to original plan</button>
      <div class="tiny muted mt">Starting debt on the plan: ${fmtMoney(Store.totalStartingDebt())} across ${Store.state.debts.length} accounts.</div>
    `, (m, close) => {
      m.querySelector("#m-export").onclick = () => {
        const blob = new Blob([Store.exportJSON()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "monica-debt-plan.json";
        a.click();
        URL.revokeObjectURL(a.href);
      };
      const file = m.querySelector("#m-file");
      m.querySelector("#m-import").onclick = () => file.click();
      file.onchange = () => {
        const f = file.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try { Store.importJSON(reader.result); close(); }
          catch { alert("That file could not be read as valid plan data."); }
        };
        reader.readAsText(f);
      };
      m.querySelector("#m-reset").onclick = () => {
        if (confirm("Reset all balances, income, and payments back to the original plan? This clears your logged entries.")) {
          Store.resetToPlan(); close();
        }
      };
    });
  }

  // ============================================================
  // ROUTING
  // ============================================================
  function render() {
    tabbar.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.tab === activeTab && t.dataset.tab !== "add"));
    if (activeTab === "dashboard") renderDashboard();
    else if (activeTab === "debts") renderDebts();
    else if (activeTab === "budget") renderBudget();
    else if (activeTab === "progress") renderProgress();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function initTabs() {
    tabbar.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => {
        if (t.dataset.tab === "add") return openAddSheet();
        activeTab = t.dataset.tab;
        render();
      });
    });
    document.getElementById("btn-menu").addEventListener("click", openMenu);
  }

  // ---- small formatting helpers used only here -----------------------------
  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
  function fmtDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ---- boot ----------------------------------------------------------------
  initTheme();
  initTabs();
  Store.subscribe(() => render()); // re-render on every data change
  render();
})();
