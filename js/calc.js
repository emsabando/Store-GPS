/*
 * calc.js — debt payoff projection engine
 *
 * Simulates month-by-month payoff using either the debt snowball
 * (smallest balance first) or avalanche (highest APR first) method,
 * rolling each freed-up minimum into the next target debt.
 *
 * Interest is applied monthly at apr/12 on the remaining balance so the
 * projection is realistic — unlike the plan's simple estimate that ignores
 * interest. Returns a full schedule the UI can chart and summarize.
 */

const Calc = (() => {
  const MAX_MONTHS = 600; // 50-year safety cap

  /**
   * @param {Array} debts  [{id,name,apr,minimum,balance}]  (balance = current)
   * @param {number} extraMonthly  extra dollars available beyond minimums
   * @param {string} method  "snowball" | "avalanche"
   * @returns {object} { months, schedule, totalInterest, totalPaid, payoffOrder, debtFreeMonthIndex }
   */
  function project(debts, extraMonthly, method = "snowball") {
    // work on a copy with only what we need
    let working = debts
      .filter((d) => d.balance > 0)
      .map((d) => ({ id: d.id, name: d.name, apr: +d.apr || 0, minimum: +d.minimum || 0, balance: +d.balance }));

    if (working.length === 0) {
      return { months: 0, schedule: [], totalInterest: 0, totalPaid: 0, payoffOrder: [], debtFreeMonthIndex: 0 };
    }

    const order = (list) => {
      const arr = [...list];
      if (method === "avalanche") {
        arr.sort((a, b) => b.apr - a.apr || a.balance - b.balance);
      } else {
        arr.sort((a, b) => a.balance - b.balance || b.apr - a.apr);
      }
      return arr;
    };

    const schedule = [];
    const payoffOrder = [];
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;

    // The "snowball" grows as debts are cleared: base minimums of remaining
    // debts + extra. When a debt is paid off, its minimum stays in the pool.
    const baseMinimumPool = working.reduce((s, d) => s + d.minimum, 0);

    while (working.some((d) => d.balance > 0) && month < MAX_MONTHS) {
      month += 1;

      // 1) accrue interest for the month
      working.forEach((d) => {
        if (d.balance > 0) {
          const interest = round2((d.balance * d.apr) / 12);
          d.balance = round2(d.balance + interest);
          totalInterest = round2(totalInterest + interest);
        }
      });

      // 2) available payment this month = all active minimums that still exist
      //    + freed minimums (baseMinimumPool stays constant) + extra
      const activeMin = working.filter((d) => d.balance > 0).reduce((s, d) => s + d.minimum, 0);
      const freed = baseMinimumPool - activeMin; // minimums of already-cleared debts
      let pool = round2(activeMin + freed + extraMonthly); // == baseMinimumPool + extra

      // 3) pay each active debt its minimum first
      const active = working.filter((d) => d.balance > 0);
      active.forEach((d) => {
        const pay = Math.min(d.minimum, d.balance);
        d.balance = round2(d.balance - pay);
        pool = round2(pool - pay);
        totalPaid = round2(totalPaid + pay);
      });

      // 4) throw everything left at the target debt(s) in method order
      for (const target of order(active)) {
        if (pool <= 0) break;
        if (target.balance <= 0) continue;
        const pay = Math.min(pool, target.balance);
        target.balance = round2(target.balance - pay);
        pool = round2(pool - pay);
        totalPaid = round2(totalPaid + pay);
      }

      // 5) record any newly cleared debts (in the month they cleared)
      active.forEach((d) => {
        if (d.balance <= 0 && !payoffOrder.find((p) => p.id === d.id)) {
          payoffOrder.push({ id: d.id, name: d.name, month });
        }
      });

      const remaining = round2(working.reduce((s, d) => s + Math.max(0, d.balance), 0));
      schedule.push({ month, remaining, paidSoFar: totalPaid, interestSoFar: totalInterest });
    }

    return {
      months: month,
      schedule,
      totalInterest: round2(totalInterest),
      totalPaid: round2(totalPaid),
      payoffOrder,
      debtFreeMonthIndex: month,
    };
  }

  /**
   * Convert a month count from a start date into a friendly "debt-free" date.
   */
  function debtFreeDate(months, fromDate = new Date()) {
    if (!months) return null;
    const d = new Date(fromDate.getFullYear(), fromDate.getMonth() + months, 1);
    return d;
  }

  /**
   * Compare a few extra-payment scenarios for the projections table.
   * Returns rows matching the plan's $550 / $675 / $800 comparison, plus interest-aware payoff.
   */
  function scenarioTable(debts, scenarios = [550, 675, 800], method = "snowball") {
    return scenarios.map((extra) => {
      const r = project(debts, extra, method);
      return {
        extra,
        months: r.months,
        totalInterest: r.totalInterest,
        debtFree: debtFreeDate(r.months),
      };
    });
  }

  return { project, debtFreeDate, scenarioTable, MAX_MONTHS };
})();
