# Monica's Debt Master Plan 💸

A private, interactive debt-payoff app built for **Monica** — a personal blend of
[EveryDollar](https://www.everydollar.com/)'s zero-based budgeting and
[Rocket Money](https://www.rocketmoney.com/)'s dashboard tracking, tailored to her
exact numbers and goal: **pay off ~$41,736 of debt using supplemental (delivery) income**.

Log income and payments; every balance, projection, and chart updates automatically.

## Run it

No build step, no server, no accounts. Just open the file:

```bash
open index.html          # macOS
xdg-open index.html      # Linux
# or drag index.html into any browser
```

It also works great on a phone — "Add to Home Screen" for an app-like experience.
All data is stored **privately in the browser** (`localStorage`); nothing is uploaded.

## What's inside

| Tab | What it does |
|-----|--------------|
| **Home** | Total debt remaining, % paid, estimated debt-free date, interest remaining, this-month income & payments, current focus debt, and 0%-promo expiration warnings. |
| **Debts** | All 10 accounts in snowball order with live balances and progress bars. Toggle **Snowball** (smallest first — the plan's method) vs **Avalanche** (highest APR first). Tap any debt for detail + payment history. |
| **＋ (center)** | Quick-log **income** (delivery/extra, take-home, or other) or a **debt payment**. |
| **Budget** | EveryDollar-style zero-based monthly budget with editable expense lines, auto-summed debt minimums, and the base monthly gap the extra income must cover. |
| **Progress** | Extra-payment slider ($0–$1,200), an interest-aware payoff chart, a scenario table comparing $550 / $675 / $800 extra, a month-by-month tracker, and recent activity. |

## Monica's plan (seeded data)

- **Starting debt:** $41,736 across 10 accounts
- **Debt minimums:** $1,230/month
- **Take-home:** $3,400/month · **living expenses:** $2,398/month → **base gap:** −$228/month
- **Strategy:** Stay current on every minimum, run the smallest-to-largest **snowball**,
  rolling each freed minimum into the next debt. Watch the 0% promos
  (Capital One → Jan 2027, Best Buy → Jun 2027).

The seed figures live in [`js/data.js`](js/data.js). Use **⋯ → Reset to original plan**
in the app to restore them at any time. You can also **export/import** your data as JSON
for backup.

### How the projection differs from the PDF

The PDF's 9-month table is a *simple* estimate that ignores interest. This app's
Progress projection ([`js/calc.js`](js/calc.js)) simulates payoff **month by month with
interest accruing** at each account's APR, so the debt-free date and total-interest
figures are a truer picture. At $675 extra/month it projects roughly **27 months** to
debt-free with about **$8,000** in remaining interest (snowball); avalanche shaves that
interest further.

## Structure

```
index.html      # app shell + bottom tab bar
css/styles.css  # theme (light/dark), cards, charts — no frameworks
js/data.js      # Monica's seed numbers from the plan
js/store.js     # localStorage state + derived totals + actions
js/calc.js      # snowball / avalanche payoff simulation engine
js/app.js       # UI rendering, modals, chart, routing
```

Pure vanilla HTML/CSS/JS — no dependencies, fully offline.
