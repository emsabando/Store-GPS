/*
 * Monica's Debt Master Plan — seed data
 * Source: Monica_Debt_Master_Plan_UPDATED.pdf
 * All figures here are the starting/default values. Once the app runs,
 * live values are kept in localStorage (see store.js) and this file is
 * only used to seed a fresh install or to "Reset to plan".
 */

const SEED = {
  profile: {
    name: "Monica",
    startingDebt: 41736,
    takeHomeIncome: 3400, // regular monthly take-home
  },

  settings: {
    method: "snowball",   // "snowball" (smallest balance first) | "avalanche" (highest APR first)
    extraMonthly: 675,    // planning slider default ($550–$800 range in the plan)
    planStartISO: "2026-08-01",
    planMonths: 9,
  },

  /*
   * Debts in the plan's snowball order (smallest balance first).
   * apr is a decimal fraction. promo carries the 0% expiration note where relevant.
   * startBalance is the "Updated starting debt" figure from the plan.
   */
  debts: [
    { id: "discover",   name: "Discover",          apr: 0.2249, dueDay: 6,  minimum: 35,  startBalance: 716,   promo: "" },
    { id: "bestbuy",    name: "Best Buy",          apr: 0.0,    dueDay: 11, minimum: 35,  startBalance: 747,   promo: "0% promo to Jun 2027" },
    { id: "sams",       name: "Sam's Club",        apr: 0.28,   dueDay: 2,  minimum: 53,  startBalance: 1058,  promo: "" },
    { id: "chase",      name: "Chase",             apr: 0.27,   dueDay: 14, minimum: 57,  startBalance: 1337,  promo: "" },
    { id: "carecredit", name: "CareCredit",        apr: 0.0,    dueDay: 17, minimum: 56,  startBalance: 1720,  promo: "0% promo" },
    { id: "citizens",   name: "Citizens Pay",      apr: 0.0,    dueDay: 30, minimum: 81,  startBalance: 2807,  promo: "0%" },
    { id: "navyfedcc",  name: "Navy Federal CC",   apr: 0.1249, dueDay: 23, minimum: 57,  startBalance: 2874,  promo: "" },
    { id: "capitalone", name: "Capital One",       apr: 0.0,    dueDay: 14, minimum: 29,  startBalance: 3016,  promo: "0% promo to Jan 2027" },
    { id: "navyfedloan",name: "Navy Federal Loan", apr: 0.186,  dueDay: 14, minimum: 343, startBalance: 7917,  promo: "" },
    { id: "happen",     name: "Happen Bank Loan",  apr: 0.186,  dueDay: 9,  minimum: 484, startBalance: 19544, promo: "" },
  ],

  /*
   * Monthly expense plan (EveryDollar-style budget lines).
   * "planned" is the budgeted amount from the plan. Debt minimums are handled
   * separately by the Debts tab, so they are not duplicated here.
   */
  budget: [
    { id: "hoa",         name: "HOA",             due: "12th",                    planned: 87  },
    { id: "srp",         name: "SRP (electric)",  due: "19th",                    planned: 390 },
    { id: "gilbert",     name: "Gilbert Utilities",due: "14th",                   planned: 230 },
    { id: "pool",        name: "Pool",            due: "17th",                    planned: 130 },
    { id: "cox",         name: "Cox Internet",    due: "5th",                     planned: 80  },
    { id: "vivint",      name: "Vivint Security", due: "2nd",                     planned: 78  },
    { id: "doginsurance",name: "Dog Insurance",   due: "4th",                     planned: 147 },
    { id: "dogfood",     name: "Dog Food",        due: "10th & 26th / every 32d", planned: 227 },
    { id: "greenmango",  name: "Green Mango",     due: "31st",                    planned: 50  },
    { id: "swgas",       name: "Southwest Gas",   due: "3rd",                     planned: 26  },
    { id: "vitamins",    name: "Theo's Vitamins", due: "—",                       planned: 30  },
    { id: "puppypads",   name: "Puppy Pads",      due: "—",                       planned: 30  },
    { id: "cell",        name: "Cell Phone",      due: "4th",                     planned: 30  },
    { id: "lifeins",     name: "Life Insurance",  due: "18th",                    planned: 15  },
    { id: "subs",        name: "Subscriptions",   due: "—",                       planned: 48  },
    { id: "fuel",        name: "Gas / Fuel",      due: "Monthly",                 planned: 300 },
    { id: "groceries",   name: "Groceries",       due: "Monthly",                 planned: 500 },
  ],

  // Empty logs to start. Users add real entries in-app.
  incomeLog: [], // { id, dateISO, source: "delivery"|"takehome"|"other", amount, note }
  payments: [],  // { id, dateISO, debtId, amount, note }
};

// Freeze so the seed is never mutated by reference.
Object.freeze(SEED);
