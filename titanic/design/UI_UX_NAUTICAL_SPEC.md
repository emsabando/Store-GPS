# A Night to Remember Forever — UI/UX Nautical Specification

Version 1.1 (post-review) · Target: web build (`three@0.187.0` WebGL2 `WebGLRenderer` on the main thread + HTML/CSS/JS overlay) · Resolutions: 1920x1080, 2560x1440, 3840x2160 · No framework, no external images (vendored OFL fonts under `/public/fonts` only) · Sibling documents: `ARCHITECTURE.md` (binding module contract) and `design/STORY_AND_CHARACTERS.md` (narrative source of truth). Where this document and those two disagree, **ARCHITECTURE wins on data flow and STORY wins on copy, names and beats**; §0.2 lists the conflicts that were settled while writing v1.1 and the contract additions this spec asks for.

---

## 0. Scope, principles, legal posture

### 0.1 Principles

1. **One overlay, one canvas.** The 3D scene renders to `<canvas id="game">`. All UI lives in `<div id="ui">` positioned over it. The UI never draws into the WebGL canvas and never touches three.js objects; it reads the per-frame `GameState` snapshot passed to `ui.update(state)` and listens/emits on the event bus (`ARCHITECTURE.md` §8). The crosshair is DOM-only.
2. **Everything is an object the ship actually carried.** Menus are ship's wheels, telegraphs, logbooks, tickets, brass plates. No flat "gamey" panels. The 1996 frame (prologue/epilogue) is the one exception and gets its own skin (§2.15).
3. **CSS-only ornament.** Brass, leather, rope, rivets and portholes are gradients, `box-shadow`, borders and inline SVG. Zero bitmap dependencies. (The rope is one inline SVG `<pattern>`, §1.3 — the only place `mask-image` is used.)
4. **Scale-correct at 4K.** All dimensions derive from `--ui-scale`; nothing is authored in raw pixels except hairlines (`max(1px,.0625rem)`) and blur radii.
5. **Diegetic first, legible always.** If a diegetic treatment drops below WCAG AA contrast, the legible version wins. §1.1 lists the three traps that were measured and fixed.
6. **Promise only what the stack ships.** Every setting, effect and data field named here maps to a key in `Settings.js`, a getter on `Engine`, a `GameState` field or a bus event. Anything else lives in Appendix B (v2) and is not built.

### 0.2 Legal, taste and copy-deck rules (binding for every string in the UI)

- **Names.** The story doc (§0, §1, Appendix B) is the only source of character names. The UI shows roster names (Jack Drawson, Rosie DeWitt-Bouquet, Capt. Smythe-Steadfast, First Officer Hardaport, Steward Promptly …) and nothing else. **Lint rule (`scripts/lint-copy.mjs`, run in `npm run check`):** reject any UI string containing `-ish`, any film character surname, the film's place names (e.g. "Chippewa Falls"), the word "Kodak", or any real passenger/crew name not in the roster. The lint list is kept in `scripts/copy-denylist.json`.
- **The ship is real; the brand is not ours.** "RMS Titanic", "White Star Line", "Harland & Wolff — Yard No. 401", "Belfast", "Southampton" may be *named* as history (nominative use). The game title is the brand of this product; "TITANIC" is never the hero word on any screen, never in a lockup, never on a splash, never in the favicon. White Star livery appears **only as a reproduction of a 1912 period document** (the contract ticket, §4.8, with its burgundy band and five-point star drawn as the 1912 printers drew it); there is no stylised modern WSL logo, no WSL mark in headers or chrome, no merchandise-style lockup. No H&W logo anywhere; the yard number is text. **Counsel to confirm** the ticket reproduction before release; if refused, the fallback is a generic "CONTRACT TICKET — THIRD CLASS" band in `--wsl-burgundy` without the star (one CSS class, `.ticket--plain`).
- **No film-named features.** Photo-mode filters are named for plate chemistry, not films ("Nitrate Teal", not "1997 Movie Teal"). The photo camera is a **bellows plate camera**; the story doc's "Kodak Brownie" is superseded by this spec and must never be printed.
- **The dead are not a UI motif.** No ticket numbers on fail screens, no epitaphs invented for the player, no puns within or around the memorial card (§2.12). Survival-rate echoes are forbidden: difficulty is never named by class (§5.1).
- **One memorial number.** The credits carry a single plain card: **"In memory of the 1,496."** (story §5). The earlier "1,500 lost" line is withdrawn.
- **First-launch "About this game" paragraph** (shown on the Welcome Aboard card, §5.1): *"This is a parody of a film, with changed names. The ship, the night and the people lost on it are real. Discovery plaques quote documented history only. Memorial resources: see the Ship's Manifest."* The Manifest (credits) ends with the memorial card and two text links (Titanic Historical Society; Encyclopedia Titanica) rendered as plain underlined text — no logos.

### 0.3 Cross-document conflicts settled in v1.1

| Topic | Story says | ARCHITECTURE says | Decision |
|---|---|---|---|
| Parlour suites | Rosie/Cal/Prudence in **B-51/53/55** (starboard, private promenade); Dismay in **B-52** | `Cabins.js`: "B-52/54/56 'the fiancé's suite'"; required location id `parlour_suite_B52` | **Story wins** (and matches history: B-52/54/56 was the chairman's suite, port). UI copy and pins say **B-51**. ARCHITECTURE §5 wording must change to "B-52/54/56 (the chairman's suite) and B-51/53/55 (the fiancé's suite, private promenade)" and `parlour_suite_B51` is added to the required `LOCATIONS` (keep `_B52` too). Logged in Appendix A. |
| Lights fail | 02:17 | 02:17 (`lightsOut`) | **02:17.** (v1.0 said 02:18 — fixed in §5.5.) |
| Photo camera | "Kodak Brownie" | — | **Bellows plate camera**, no brand word (§0.2). |
| Game title | "A Night to Remember Forever" | same (index.html, package.json) | **Hero title is the game title.** v1.0's "A Night to Remember-ish" is withdrawn. |
| Reputation display | "shown in the Ship's Log as a purser's note" | `GameState.reputation {first, third}` | **Log only** + toast on `quest:reputation`. HUD gauges removed (§2.4). |
| Watch access | only at bulkhead clocks and the pause menu | `ui:advanceTime {to}`; key `T` listed | **Wind from Pause and clock interactables only.** HUD clock click = read-only plate; `T` = next-beat tooltip (§2.10). |
| Fail states | faint / trapped; Jack's IV.11 death scripted | `player:died` from sustained `player:drowning` | **Three outcomes** (§2.11): `faint`, `trapped`, `drowned`. "Lost at Sea" only for `drowned`, never for IV.11. |
| Angle vocabulary | Appendix A "List" column (8°…30°→vertical) | `trimDeg` (bow-down) and `listDeg` (to port) | Appendix A's column **is trim**. Primary gauge is a trim pendulum, secondary is a ±15° list bubble (§2.4, §4.12). |
| Deck plans | — | `DeckMap.js` generates SVG from `SHIP.decks` | **Generated**, never vendored (§2.7). `public/plans/` stays empty and is removed from the build. |

---

## 1. Visual language

### 1.1 Palette (CSS custom properties on `:root`)

| Token | Hex | Use |
|---|---|---|
| `--brass-hi` | `#F2D27A` | brass highlight, engraved text fill on dark |
| `--brass` | `#C9A227` | brass base, borders, primary accent, **flat fill under any brass-background text** |
| `--brass-lo` | `#7A5B12` | brass shadow, bevel underside |
| `--bronze` | `#6E5428` | aged bronze frames, telegraph body |
| `--bronze-lo` | `#3F2E12` | bronze recess; **ink colour on brass** |
| `--mahogany` | `#4A1E12` | wheel, book spine, panel wood |
| `--mahogany-hi` | `#7A3A26` | wood grain highlight |
| `--teak` | `#A8743C` | deck planking, warm surfaces |
| `--teak-lo` | `#7B5330` | teak seams |
| `--navy` | `#0B1626` | midnight sea, modal scrim base, memorial card |
| `--navy-hi` | `#142238` | raised navy panels |
| `--parchment` | `#F1E6C8` | paper, tickets, log pages |
| `--parchment-lo` | `#DCCBA4` | page edges, aged stains |
| `--ink` | `#1C1710` | text on parchment |
| `--pencil` | `#4A4238` | side-quest lines in the Log (pencil) |
| `--wsl-burgundy` | `#7A1F2B` | period-document burgundy (ticket band only) |
| `--wsl-gold` | `#C8A24A` | period-document gold (ticket star only) |
| `--sea-green` | `#0F3B3A` | deep sea, secondary panels, HUD submerge fill |
| `--sea-green-hi` | `#1C5A55` | hover on sea-green |
| `--rust` | `#8A3B1E` | sinking-phase accents, danger edges (never text) |
| `--rust-hi` | `#B4542A` | rust highlight |
| `--fog` | `#E9E4D8` | body text on dark |
| `--fog-dim` | `#A9A397` | secondary text on dark |
| `--ok` | `#4F8A5B` | success *fills and strokes only* (check marks, zone arcs) |
| `--ok-text` | `#7DB58A` | success **text** on dark ("discovered", completed log lines) — 7.0:1 on `--navy` |
| `--warn` | `#E0A030` | caution fills (trim 8–18°) — also legal as text on navy (8.9:1) |
| `--danger` | `#B3261E` | critical *fills and strokes only* (trim >18°, flooding) |
| `--danger-text` | `#F08A7E` | critical **text** on dark — 7.3:1 on `--navy` |
| `--moon` | `#C7D3E6` | lights-out monochrome HUD outlines |
| `--cold` | `#3C78B8` | cold-meter vignette tint |
| `--scrim` | `rgba(6,12,22,.72)` | full-screen dim behind modals |

**Contrast checks (must hold; re-measured for v1.1):** `--fog` on `--navy` 13.9:1; `--ink` on `--parchment` 13.2:1; `--brass-hi` on `--navy` 10.6:1; `--brass` on `--navy` 6.9:1; `--parchment` on `--wsl-burgundy` 7.4:1; `--ok-text` on `--navy` 7.0:1; `--danger-text` on `--navy` 7.3:1; `--bronze-lo` ink on flat `--brass` 6.1:1.

**Three measured failures in v1.0, now forbidden:** `--ok` as text on navy (4.4:1), `--danger` as text on navy (2.8:1), and `#3F2E12` engraved text over `--grad-brass` (the `#8E6E16` mid-band gives ≈2.7:1 on keycaps, buttons and telegraph labels). Rule: **the brass gradient is for bevels and plate bodies without text; any element that carries text uses a flat `--brass` fill** with the gradient only on its `::before` bevel ring. Never set body text in `--brass-lo`, `--bronze`, `--rust`, `--ok` or `--danger` on dark. A stylelint rule (`scripts/lint-css.mjs`) rejects `color: var(--ok|--danger|--rust|--brass-lo|--bronze)`.

Gradient recipes (reused everywhere):
```css
--grad-brass: linear-gradient(170deg,#F2D27A 0%,#C9A227 28%,#B08A1E 50%,#C9A227 72%,#F2D27A 100%); /* mid stop lifted from #8E6E16 */
--grad-bronze: linear-gradient(180deg,#8A6A33,#6E5428 40%,#3F2E12);
--grad-mahogany: repeating-linear-gradient(92deg,#4A1E12 0 6px,#56241A 6px 9px,#3E1810 9px 14px);
--grad-leather: radial-gradient(120% 90% at 30% 20%,#5A2A1C,#3A1810 70%,#2A1008);
--grad-parchment: radial-gradient(130% 110% at 50% 40%,#F6EDD6,#F1E6C8 60%,#D9C79F);
--grad-sea: linear-gradient(180deg,#142238,#0B1626 60%,#060C16);
```

### 1.2 Typography (all OFL, vendored as woff2 in `/public/fonts/`)

| Role | Family | Fallback | Notes |
|---|---|---|---|
| Display titles, screen names | `Playfair Display` 700/900 | Georgia, serif | letter-spacing `.02em` |
| Engraved brass caps, deck letters, labels | `Cinzel` 600/700 | Georgia, serif | always `text-transform: uppercase`, spacing `.14em` |
| Body, dialogue, log entries | `Cormorant Garamond` 500/600 + 600 italic | Georgia, serif | min 18px equivalent at 1080p; the **600 italic is the "copperplate" voice** for main-beat log lines |
| Document/ticket/manifest type, gauges, numerics | `Old Standard TT` 400/700 | 'Times New Roman', serif | `font-variant-numeric: tabular-nums`; also the **1996 era** face (§2.15) |

```css
/* Vite serves public/ at the site root: the URL is /fonts/…, never /public/fonts/… */
@font-face{font-family:"Cinzel";src:url(/fonts/Cinzel-SemiBold.woff2) format("woff2");font-weight:600;font-display:swap}
/* repeat per face (9 files); preload the four primary faces in <head> */
--font-display:"Playfair Display",Georgia,serif;
--font-engrave:"Cinzel",Georgia,serif;
--font-body:"Cormorant Garamond",Georgia,serif;
--font-doc:"Old Standard TT","Times New Roman",serif;
```

**Font pipeline:** `public/fonts/` is empty in the repo. Add `scripts/fetch-fonts.mjs` (`npm run fetch-fonts`, same pattern as `fetch-textures.mjs`) that downloads the nine woff2 faces from the Google Fonts GitHub mirrors at pinned commits, writes `public/fonts/OFL.txt` (the four licences concatenated) and `public/fonts/manifest.json`. `npm run check` fails if a face named in `theme.css` is missing. With `base: './'` in `vite.config.js`, write the `src:` URLs as `url(./fonts/…)` **from `index.html`-relative CSS**; `theme.css` is loaded from `./src/ui/theme.css`, so use absolute-from-root `url(/fonts/…)` in dev and let Vite rewrite on build (it does for `public/` assets referenced from CSS).

Type scale (rem; root = 16px x `--ui-scale`): `--fs-xs:.75rem --fs-sm:.875rem --fs-md:1.125rem --fs-lg:1.5rem --fs-xl:2.25rem --fs-2xl:3.5rem --fs-hero:5rem`. Line-height 1.35 body, 1.1 display.

Engraved text effect (`.engraved`): on dark `color:var(--brass-hi); text-shadow:0 1px 0 #fff3, 0 -1px 0 #0008;`. On brass (flat `--brass` fill only, §1.1) `color:var(--bronze-lo); text-shadow:0 1px 0 #fff6`.

### 1.3 Textures (CSS-only)

- **Leather (log book cover):** `--grad-leather` + `box-shadow: inset 0 0 40px #0008` + a stitched border: `outline: 2px dashed var(--brass-lo); outline-offset: -14px`.
- **Brass plate:** flat `--brass` background on the text-bearing body, `::before` bevel ring in `--grad-brass` (`inset: -.25rem; z-index:-1; border-radius: inherit`), `border:2px solid var(--brass-lo)`, `border-radius:.375rem`, `box-shadow: inset 0 1px 0 #fff8, inset 0 -2px 0 #0006, 0 2px 6px #0009`. Rivets: four radial-gradient dots (`radial-gradient(circle,#F2D27A 0 30%,#7A5B12 60%,transparent 62%)`) `.625rem` diameter at corners; extra rivets via `background-image` lists for long plates.
- **Rope (defined once, used everywhere):** one inline SVG `<pattern id="rope-lay">` in the icon sprite — two interlocking strands (two overlapping ellipses per repeat, highlight `#C9A96B`, shadow `#8C7442`, stroke `#5E4C2A`), tile `12x8` units, applied with `mask-image: url(#rope-lay)` on a `--brass`-tinted border element, or as `background` on the `.progress-rope`. Variant `.rope--tarred` swaps the fills to `#3A3A2E/#1E1E18`. **No `border-image`, no 45° stripe gradients** (a repeating gradient reads as diagonal stripes, not hemp). Principle 3 was corrected to match.
- **Porthole frame:** circular element, `border: .9rem solid var(--brass)`, `background: var(--grad-brass)` on an outer ring, inner `box-shadow: inset 0 0 0 .25rem var(--bronze-lo), inset 0 0 2rem #000c`; six dog-bolts as rotated radial dots at 60° steps.
- **Engraved lines:** `hr.engraved{border:0;height:2px;background:linear-gradient(90deg,transparent,var(--brass-lo) 20%,var(--brass-hi) 50%,var(--brass-lo) 80%,transparent)}`.
- **Blueprint (deck plan):** background `#0E2A4A` with `repeating-linear-gradient` grids at 1rem and 5rem in `#FFFFFF14/#FFFFFF28`; strokes `#CFE3F5`.
- **Phosphor (1996 era, §2.15):** `html[data-era="1996"]` swaps the whole palette: background `#050806`, text `--crt: #5BE38A` (green) and `--crt-amber: #E0B04A`, scanlines `repeating-linear-gradient(0deg,#0000 0 2px,#0004 2px 3px)` on a fixed overlay, glow `text-shadow: 0 0 .35rem #5BE38A88`.

### 1.4 Iconography

Inline SVG sprite `<svg id="ico" hidden>` with `<symbol>` per icon, 24x24 viewBox, `stroke="currentColor" fill="none" stroke-width="1.6"` line style (brass line engravings). Required symbols: `anchor`, `compass-rose`, `wheel`, `bell`, `telegraph`, `davit`, `lifebelt`, `porthole`, `stair`, `logbook`, `camera`, `chronometer`, `ticket`, `star-1912` (five-point, used only inside the ticket band), `funnel`, `propeller`, `key`, `gear`, `eye`, `speaker`, `subtitles`, `gamepad`, `mouse`, `warning`, `water`, `heart-sapphire` (Heart choice), `quill` (Wit choice; `anchor` is reused for Spine), `axe`, `whistle`, `snowflake` (cold), `swap` (character switch), `plaque`, `rov` (1996). Usage: `<svg class="ico"><use href="#ico-anchor"/></svg>`; `.ico{width:1.25em;height:1.25em;vertical-align:-.2em}`. The sprite also holds `<pattern id="rope-lay">` (§1.3) and the silhouette parts for dialogue portraits (§2.5).

### 1.5 Motion

| Name | Spec | Where |
|---|---|---|
| `swell` | `translateY(±.35rem) rotate(±.25deg)`, 7s ease-in-out infinite | menu wheel, title, loading card |
| `glint` | 1.2s linear sweep of a `#fff5` 20°-skewed band across brass; triggered on focus/hover, repeats every 9s idle on primary CTA | brass buttons, plates |
| `lamp-flicker` | opacity 1→.93→1 with randomized 80–240ms steps (JS sets `--flick`) | dialogue porthole rim light, pause screen |
| `needle` | `transition: transform .6s cubic-bezier(.34,1.56,.64,1)` (overshoot) | gauges, compass, trim pendulum |
| `page-turn` | 3D `rotateY` 0→-160deg, 420ms, `perspective:1600px` | Ship's Log |
| `rope-drop` | `translateY(-120%)→0` with 2 damped bounces, 520ms, stagger 60ms | dialogue choice cards |
| `telegraph-swing` | `rotate` to target angle, 380ms, overshoot, then `ui_clank` | settings |
| `bell-toll` | scale 1→1.06→1, 300ms, synced to bell sfx | discoveries, objective toasts (never on the memorial card or Lost at Sea) |
| `stinger` | 220ms: full-screen `--navy` wipe from the left with a brass hairline, name plate slides in, wipe exits right | Jack↔Rosie character switch (§2.13) |
| `frost` | vignette `inset` shadow grows from 0 to `12rem` in `--cold` as the meter drains; edges gain a 2px rime (`backdrop-filter: blur(1px)` ring) | cold meter (§2.13) |

All motion is disabled or reduced to 120ms opacity fades under `@media (prefers-reduced-motion: reduce)` or `html[data-reduce-motion="1"]` (set from `settings.reduceMotion`).

### 1.6 UI sound cues

The UI owns **no audio code**. `AudioEngine` synthesises every sound procedurally; the UI emits `audio:play { id }` and the ids below are added to `ARCHITECTURE.md` §7 (Appendix A). Volume follows `volumeSfx`; there is no separate UI bus in v1.

| Event | id | Character | Duration |
|---|---|---|---|
| Hover / focus move | `ui_hover` (exists) | brass tick | 40ms |
| Confirm | `ui_click` (exists) | wheel-spoke clack | 120ms |
| Back / cancel | `ui_back` | rope creak | 200ms |
| Telegraph step | `ui_clank` | heavy clank + distant bell reply | 450ms |
| Valve wheel turn | `ui_ratchet` with `{ pitch: 0..1 }` | ratcheting valve, pitch follows value; AudioEngine debounces to ≤ 20/s | 60ms per tick |
| Open book / map | `ui_page` (exists) | page rustle / blueprint unroll | 350ms |
| Objective added | `bell` (exists) | single ship's bell | 900ms |
| Discovery | `ui_bell2` | two bells | 1.2s |
| Warning (sinking tiers) | `ui_whistle` | steam whistle swell, low | 2s |
| Error / invalid | `ui_knock` | dull wooden knock | 100ms |
| Photo capture | `ui_shutter` | bellows shutter | 180ms |
| Confirm (big) | `ui_confirm` | spoke clack + short bell | 300ms |
| Character switch | `ui_stinger` | low string hit, no melody | 500ms |
| 1996 era click/hover | `ui_crt_tick`, `ui_crt_confirm` | sine blips | 30/90ms |

---

## 2. Screens

### 2.1 Title / Main Menu

- **Background:** the live three.js scene — Titanic at anchor off Queenstown at sunset (`world` with the clock set to 11 April 1912 13:30, camera on a slow drift set by `main.js` in `menu` mode), gulls. UI scrim `linear-gradient(90deg,#0B1626cc,transparent 55%)`. The exterior is already built when the menu appears (§5.1 boot order).
- **Hero title:** `A NIGHT TO REMEMBER FOREVER` in `--font-display` 900 `--fs-hero`, `--fog` with a brass hairline underline; sub-line `Aboard RMS Titanic · April 1912` in `--font-engrave` `--fs-sm`, `--fog-dim`. The ship's name is descriptive text, not the brand (§0.2).
- **Ship's wheel menu** (left-centre, `22.5rem` diameter — ≈36vh at 1080p — 8 spokes): hub is a plain brass boss (no star). Seven items occupy seven spokes; **the 8th spoke (6 o'clock) is empty and is skipped by navigation**. Items: `TAKE THE HELM` (Continue; hidden if no save), `NEW VOYAGE`, `LOAD VOYAGE`, `SETTINGS`, `SHIP'S MANIFEST` (Credits), `PHOTO GALLERY`, `ABANDON SHIP` (Quit). Label on a brass tag hung from the handle. Keyboard/gamepad: up/down rotates the wheel so the active spoke sits at 12 o'clock (`.wheel{transform: rotate(calc(var(--spoke-index) * -45deg))}`, 380ms) and **every tag counter-rotates** (`.tag{transform: rotate(calc(var(--spoke-index) * 45deg))}`) so text stays upright; mouse hovers a spoke directly without rotating the wheel.
- **ABANDON SHIP (web):** there is no landing page. Confirm modal `Abandon ship? Unsaved progress will be lost.` → `location.reload()` which returns to the title (the boot sequence is ~2 s on a warm cache). Hidden in installed-PWA mode? Not applicable; always shown.
- **Footer bar:** version, build, `©` line in `--fs-xs` `--fog-dim`; glyph hints right-aligned (`[Enter] Select  [Esc] Back  [F5]/[F9] quick save/load` — the quick keys appear only in gameplay).
- **First launch:** the wheel is replaced by the Welcome Aboard card (§5.1) until dismissed. English only in v1: no language select (Appendix B).

```
+--------------------------------------------------------------+
| A NIGHT TO REMEMBER FOREVER                 [sunset, ship]   |
|   Aboard RMS Titanic · April 1912                            |
|        .--.                                                  |
|      / | | \      [TAKE THE HELM]                            |
|    --(  o  )--    [NEW VOYAGE]      <- brass tags on spokes  |
|      \ | | /      [SETTINGS]           (tags stay upright)   |
|        '--'                                                  |
| v0.1.0 build 1912     (A) Select  (B) Back  [Esc] Quit       |
+--------------------------------------------------------------+
```

### 2.2 Settings

Full-screen modal: mahogany panel, brass-plate tab rail across the top (`DISPLAY · GRAPHICS · CONTROLS · AUDIO · ACCESSIBILITY · SAVES`). Left column controls, right column live preview/description plate. **Every control below is backed by a `Settings.js` key** (ARCHITECTURE §3, plus the two additions in Appendix A). Changes apply immediately through `settings.set(key, value)` and the UI also emits `ui:settingsChanged {key, value}`; there is no Apply button and no "unlogged changes" modal (the earlier staged-apply flow is withdrawn — the Engine listens to `settings.onChange` directly). `RESTORE DEFAULTS` calls `settings.reset()` after a confirm.

**Graphics — Engine-Order Telegraph** (`telegraph` component, §4.9), 24rem tall. Four live positions map 1:1 onto the Engine's presets; the red `STOP` sector is engraved on the face for authenticity but is `aria-hidden`, has no radio and cannot be selected (a "Custom" position needs a `settings.custom` object the contract does not have — Appendix B).

| Position | `quality` | Shadows | N8AO | Bloom | SMAA | Anisotropy | Pixel-ratio cap | Draw distance |
|---|---|---|---|---|---|---|---|---|
| `DEAD SLOW` | `low` | 1024 PCF | off | off | MEDIUM | 2 | 1 | 600 m |
| `SLOW` | `medium` | 2048 PCFSoft | off | on | HIGH | 4 | 1.5 | 1200 m |
| `HALF` | `high` | 4096 PCFSoft | half-res | on | HIGH | 8 | 2 | 2500 m |
| `FULL AHEAD` | `ultra` | 4096 PCFSoft + 2 cascades | full-res | on | ULTRA | 16 | native / 4K | 6000 m |

The columns are the ones `QualityPresets.js` owns and nothing more (no SSR, TAA, PCSS, HBAO, planar reflections — none exist in the stack). The readout plate beneath shows the preset name and **`engine.stats.frameMs`** as "est. ms/frame", read from `GameState.stats` every frame and smoothed over 1 s; it is a live reading, not a probe, so moving the lever simply shows the new cost after ~1 s.

**Display:** `Resolution` brass drum (`native` · `3840x2160` · `2560x1440` · `1920x1080` → key `resolution` `'native'|'4k'|'1440p'|'1080p'`); `Render scale` valve 50–200% step 5 (`renderScale` 0.5–2, shown only when `resolution === 'native'`); `FOV` valve 60–110 (`fov`, default 75); `View` knife switch First person / Third person (`viewMode`); `Show frame counter` (`showFps`). No V-sync (rAF is always vsynced), no frame cap, no HDR (no HDR canvas output in WebGL), no 3440x1440 preset (ultrawide uses `native`).

**Controls:** `Look sensitivity` valve 0.2–3.0 (`sensitivity`, log-scale display, default 1.0); `Invert Y` (`invertY`). A read-only brass key-cap table lists the fixed bindings (`WASD` move · `Shift` run · `Space` jump/climb · `E` interact · `Tab`/`M` deck plan · `J` log · `P` photo · `T` next beat · `V` view · `F5`/`F9` quick save/load · `Esc` pause; pad: `LS` move · `RS` look · `A` interact · `B` back · `Y` log · `X` photo · `Back` map · `Start` pause). Rebinding, invert X, gamepad sensitivity/deadzone and crouch/sprint toggles are Appendix B.

**Audio:** `Master`, `Music`, `Effects`, `Ambience` — four `valve` wheels (§4.6), 0–100 with brass dial readout (`volumeMaster/volumeMusic/volumeSfx/volumeAmbience` 0–1). `Subtitles` knife switch (`subtitles`) — because dialogue is text-only, "subtitles" here means the speech card's on-screen duplicate for `notify {kind:'speech'}` barks; size/colour/box options are Appendix B.

**Accessibility:** `Interface size` valve 80–160% (`uiScale` 0.8–1.6; one global multiplier, see §3.1); `Reduce motion` (`reduceMotion`); `Colour-blind mode` drum Off / Deuteranopia / Protanopia / Tritanopia (`colourBlind`; no monochrome option in the contract). The description plate explains that hold-to-confirm actions can always be completed with a single press of the same key held for 0 s when `reduceMotion` is on (§4.20) and that timed dialogue is untimed under `reduceMotion` (§2.5).

**Difficulty** (lives under GAMEPLAY on the NEW VOYAGE ticket, §5.1; changeable here as a drum): `Fair Weather` · `Open Sea` · `Ice Field` → key `difficulty` (Appendix A). Never named by passenger class.

**Saves:** three local ticket stubs (`titanic.save.v1`, `.slot2`, `.slot3` in `localStorage`; the integrator's single `SAVE_KEY` is slot 1) with deck, time, playtime, 320x180 JPEG thumbnail from IndexedDB (§5.2). No cloud saves (no network at runtime).

Footer: `RESTORE DEFAULTS` (bronze) · `BACK`.

### 2.3 Loading

Centre: a **period contract ticket** (`ticket` component, §4.8), 44rem wide, slight `swell`. Band `WHITE STAR LINE` in burgundy with the 1912 star (period reproduction, §0.2); body in `--font-doc`: `Passenger  <name>` · `Class  Third` · `Berth  G-62` · `Sailing  Southampton, 10 April 1912`. The ticket always prints Third Class / G-62: the player is always Jack (story §2.0). A **progress rope** runs along the bottom edge (`.progress-rope`, §4.16) driven by `loading:progress {pct, label}`; the label is the integrator's stage text (`Laying the keel at Harland & Wolff` …) set in `--font-doc` beneath the rope. Below: rotating lore line from the discovery plaques (`DISCOVERIES[].plaque`, documented fact only). Spinner is a tiny turning ship's wheel bottom-right. Minimum display time 900ms; loading beyond 8 s shows `Press any key when ready` so the AudioContext can be unlocked on the keypress.

Two loading screens exist (§5.1): the boot one (exterior/world) and the shorter NEW VOYAGE one (interiors, NPCs, BVH). Both use this card; the second has the stub stamped `BOARDED`.

### 2.4 In-game HUD

Layering: the `#hud` element sits at `z-index: 10` inside `#ui`; prompts 20; dialogue 30; menus 40. **Toasts and the helm overlay are top-layer elements** (`popover="manual"`, §4.14/§4.18) so they stay visible above any `<dialog>` opened with `showModal()` (top-layer elements ignore `z-index`). `#ui` carries **no** `aria-live`; `index.html` must drop `aria-live="polite"` from the root (Appendix A). Live regions are the log tray (`polite`) and the toast rack (`polite`; `assertive` only for `sinking:event`).

| Element | Position | Spec | Binding |
|---|---|---|---|
| **Compass strip** | top-centre, 34rem x 3rem | **Ship-relative** tape: marks `FWD · STBD · AFT · PORT` in `--font-engrave` with 10° ticks and a brass lubber line; true heading digits in `--font-doc` beneath (`266°`). The tape is ship-relative so "forward" reads as forward even though the ship steams ~266° true; the digits give the real compass. Objective pin = small brass pin at `--bearing` (relative). | tape ← `state.headingRel` (Appendix A: `main.js` adds `headingRel = heading − shipHeading`), digits ← `state.heading`; pin ← `state.objective.bearingDeg` |
| **Ship's clock** | top-right | brass bezel 4.5rem, white dial, `--font-doc` numerals, hands from game time; `title="Honour and Glory Crowning Time"`. **Click/`Enter` = read-only time plate** (`Sunday 14 April 1912 · 23:52` + the watch title); it does not open the winder (§2.10). Beneath: date plate `14 APRIL 1912`. | `time:tick {date, hhmm}` / `state.clock` |
| **Deck plate** | top-left | brass letter plate `B DECK` / `BOAT DECK` / `ORLOP`; secondary line room name. Fades to 35% after 4 s idle; restores on deck change with `glint`. | `player:deck {deck}`; room name from `state.room` if present (Appendix A), else hidden |
| **Ship's Log tray** | bottom-left, max 3 entries | parchment strip with torn edge; main beats in copperplate (`--font-body` 600 italic, `--ink`), side quests in pencil (`--font-doc` `--pencil`); completed entries get a brass check (`--ok` stroke) and slide out after 2.5 s; the watch-end line `The watch is yours.` is shown alone in copperplate for 4 s. Header `SHIP'S LOG` in burgundy. | `quest:objective {text, locationId}`, `quest:beatComplete {beat, optional}`, `quest:watchEnd {watch}` |
| **Interaction prompt** | 6rem below crosshair | engraved brass plate: `[E]` key cap + the label (`Open · Cabin B-51`). 120ms fade+rise; hidden when pointer lock is lost. | `interact:prompt {label} | null` |
| **Crosshair** | centre | 6px dot `--fog` with `1px #000` ring; over an interactable → expands to a rangefinder: two short brass hairlines left/right at 14px gap. | `interact:prompt` non-null |
| **Trim & list** (sinking only) | bottom-centre, 14rem x 4rem | `.incline` (§4.12): a fore-and-aft brass **pendulum** reading `BY THE HEAD 8°` (0–45°, needle pinned beyond 45° with a `↓` glyph) and a small **list bubble** ±15° beneath; under both, a flood bar of 16 compartments. Appears at the strike with `glint` + `ui_whistle`. | `sinking:state {trimDeg, listDeg, floodY}`; compartments derived from `floodY` vs `SHIP.bulkheads` (Appendix A) |
| **Cold meter** (Rosie / water) | screen edge vignette + 3rem snowflake plate bottom-right | see §2.13 | `state.cold` (Appendix A) |
| **Subtitles / barks** | bottom-centre above the trim gauge | `--font-body` `--fs-md`, speaker name in `--brass-hi`, optional `#000a` box; shown for `notify {kind:'speech'}` when `subtitles` is on. | `notify` |
| **Save mark** | bottom-left under the log | tiny book icon + `Entered in the ship's log.` 1.5 s | `notify {kind:'save'}` |

Removed from v1.0: the two reputation gauges (reputation is Log-only, §2.6, with a toast on `quest:reputation`).

HUD opacity master `--hud-alpha` (default .92); HUD hides entirely in Photo Mode and during `cutscene:play`.

```
[B DECK]         PORT . . FWD . . STBD . . AFT          (clock)
 Smoking Room          ^ 266°                      14 APR 1912
                             .
                        [E] Open · Cabin B-51
 SHIP'S LOG
 ◦ Find Rosie on the Boat Deck   (copperplate)           (*)cold
 ◦ Nora needs chalk              (pencil)    [BY THE HEAD 8°] ~~~~
```

### 2.5 Dialogue box

Bottom third. **Porthole frame** (§4.4), 11rem diameter, left, framing a **static silhouette portrait** built from `dialogue:node.portraitHint` (= `character.look`): an inline SVG assembled from sprite parts (`#sil-head`, `#sil-hat-tophat|bowler|flatcap|officer|bonnet|wide|straw`, `#sil-hair-short|bun|long|bald|moustache`, `#sil-top-tailcoat|suit|…`) filled with `look.top.color` / `look.hair.color` on a `--navy-hi` ground. No second scene render, no render target (the main camera already dollies to the NPC in `dialogue` mode). Unknown speaker (`speaker === 'narrator'`) → `data-fogged`. NPC name on a brass plate riveted under the porthole from `speakerName` (`CAPT. SMYTHE-STEADFAST`). Speech text on a parchment card to the right (max 60ch, `--font-body` `--fs-md`, typewriter 28 cps, click/`Enter` completes the line, second click → `ui:dialogueAdvance` when `hasNext`).

**Choices:** up to 3 **rope-hung cards** (story §4: 2–3 choices, ≤ 80 chars) descending from the top edge with `rope-drop` stagger; numbered `1–3` brass tags; hover tilts ±2°; selected card swings up and emits `ui:dialogueChoice {index}`. Each card shows the **choice-grammar icon** from `choices[i].kind` (`'heart'` → `heart-sapphire`, `'wit'` → `quill`, `'spine'` → `anchor`; absent → no icon) — this needs `kind` on `Node.choices[]` and in the `dialogue:node` payload (Appendix A). The exit line (`"I'll think on it."`) is always the last card and gets no icon.

**Timed nodes:** `dialogue:node.timed` (seconds, `null` = untimed, the default). A rope burn-down runs along the top edge for `timed` seconds; on expiry the UI auto-picks the **last** choice (the exit line) and emits it. Under `reduceMotion` (accessibility override) all nodes are untimed and the hourglass is hidden. Player movement is locked by `main.js` (`mode: 'dialogue'`); the UI only hides the crosshair and prompt and dims the compass/clock to 50%.

```
  |1|♥   |2|✎   |3|⚓          <- rope-hung choice cards (Heart / Wit / Spine)
  [ ]    [ ]    [ ]
 (  O  ) [CAPT. SMYTHE-STEADFAST]
 (porth) "Ice warnings, yes. We shall keep a sharp lookout and a
          steady course. It's clear as a bell."                 [>]
```

### 2.6 Ship's Log / Journal

Full-screen leather book, two pages open, `perspective` 3D, bookmark ribbons (burgundy) as tabs: `OBJECTIVES · DISCOVERIES · COLLECTIBLES · PASSENGERS MET · PURSER'S NOTE`. Left page: list (`--font-doc`), right page: detail with a sepia sketch placeholder (SVG frame) and body text. Page corners are hit targets for `page-turn`. Opened with `J` / pad `Y`; emits `ui:mode {mode:'journal'}`; keeps pointer lock (key/stick driven) with a `[Esc] close` hint.

- **Objectives:** main beats in copperplate (`--font-body` 600 italic), side quests in pencil (`--pencil`), completed struck through in `--rust` (stroke, not text), failed with a burgundy stamp `OVERTAKEN BY EVENTS`. Every watch ends with the line *"The watch is yours."* Source: `quest:beatStart/beatComplete/watchStart/watchEnd` and `state.objective`.
- **Discoveries:** each is a **pasted-in brass plaque** (`.plaque`, §2.14) rotated ±1.5°, with deck + room + the plaque text verbatim from `DISCOVERIES[].plaque`; undiscovered rows are blank frames. Source: `state.discovered`, `quest:discover`.
- **Collectibles (per-tab grids, sized to the story's counts):** `MENUS` 5x3 (15), `POSTCARDS` 4x3 (12), `TICKETS` 5x4 (20), `POCKET` one slot for Souvenir Ice with a melt ring (20 real minutes, from `quest:inventory` count/delta; the ring is UI-local time). Brass-rimmed slots, silhouette when missing. Source: `state.collected`, `quest:collect {id, kind, name}`, `state.inventory`.
- **Passengers Met:** manifest rows with class ticket colour (1st gold, 2nd burgundy, 3rd sea-green, crew navy). Source: `dialogue:start {npcId}` accumulates into a UI-local set persisted inside the save (`ui` key, §5.2).
- **Purser's Note (reputation):** a handwritten note in `--font-doc`: `First Class standing: +3 · Third Class standing: +6` with the thresholds from story §4 listed beneath as "privileges" (e.g. `≥4 Smoking Room without escort`). Mapping −10..+10 → shown as signed integers, never as a gauge. `quest:reputation {faction, delta, value}` raises a toast `Purser's note: First Class +1`.
- Footer stamp: `Entered this 14th day of April 1912` (date from `state.clock.date`).

### 2.7 Deck Plan Map

Full-screen blueprint on a drafting board frame (teak). Deck tabs down the left as brass letter plates: `BOAT · A · B · C · D · E · F · G · ORLOP · TANK TOP` (ids from `SHIP.decks[].id`); current deck plate is lit (`glint`). Opened with `Tab`/`M`/pad `Back`; emits `ui:mode {mode:'map'}`; releases pointer lock (needs a cursor).

**Source: generated, never vendored.** `DeckMap.js` builds one inline `<svg>` per deck from `SHIP.decks[i].rooms[] / corridors[] / stairs[]`, `SHIP.bulkheads[]` and `SHIP.hull.stations` (outline). Provenance note: only the 1912 H&W originals are public domain; the clean redraws in circulation are copyrighted or CC-BY-SA, so no plan file is ever committed. `public/plans/` is deleted.

SVG schema (ship-local metres, bow to the right, starboard at the bottom):
```html
<svg class="plan" viewBox="-140 -22 280 44" preserveAspectRatio="xMidYMid meet" data-deck="B">
  <path class="plan__hull" d="…"/>                       <!-- hull outline at this deck's y from hull.stations -->
  <g class="plan__rooms">
    <rect data-room="B51" data-class="first" x="…" y="…" width="…" height="…"/>   <!-- x0..x1 → x, z0..z1 → y -->
  </g>
  <g class="plan__corridors"><path d="…"/></g>
  <g class="plan__bulkheads"><line data-bulkhead="D" x1="…" y1="-22" x2="…" y2="22"/></g>   <!-- thicker, #F2D27A -->
  <g class="plan__stairs"><use href="#ico-stair" data-stair="grand_fwd" x="…" y="…" width="3" height="3"/></g>
  <g class="plan__flood"><rect data-compartment="6" …/></g>  <!-- fill #2A6F97aa, height from floodY -->
  <g class="plan__pins"><use href="#ico-flag" data-objective x="…" y="…"/></g>
  <g class="plan__player" transform="translate(x z) rotate(-headingRel)"><path d="M0,-1.6 L1,1.6 L0,0.8 L-1,1.6 Z"/></g>
  <g class="plan__fog"><path d="…" fill="url(#hatch)"/></g>   <!-- undiscovered rooms, 45° hatch -->
</svg>
```
Because the viewBox is in ship-local x/z, pins place straight from `LOCATIONS[id].{x,z}` and the player from `state.player.{x,z}` (already ship-local). Stroke `#CFE3F5`, compartment fills `#FFFFFF08`, watertight bulkheads `#F2D27A` at 0.6 units. Overlays: player marker (brass arrow, soft pulse); objective pins (burgundy flag with number, from `state.objective.locationId`); discovered stairs/lifts (`stair` icon in brass; hover → tooltip `Grand Staircase — Fast travel`; click/`A` → confirm ticket `Steward Promptly will escort you. Proceed?` → `ui:teleport {locationId}`); undiscovered rooms hatched (`state.discovered`); during sinking: flooded compartments fill upward from `sinking:state.floodY` and the whole blueprint rotates by `listDeg/3` (list, not trim — the plan view is from above). Controls: scroll/triggers zoom 1–4x, drag/left-stick pan, `Q/E` or bumpers switch deck, legend plate bottom-right, `M`/`Esc` closes. Title plate: `RMS TITANIC — HARLAND & WOLFF, BELFAST — YARD No. 401 — DECK PLAN` (text only).

### 2.8 Photo Mode

HUD hidden. Entered with `P`/pad `X` → `ui:photoMode {on:true}` (the integrator sets `player.mode = 'free'`). Frame: a brass **bellows plate camera** seen from behind — four concertina pleats drawn with repeating gradients at the viewport edges, inner rounded-rect viewfinder with ground-glass vignette. Right rail (brass):

| Control | Backing | Notes |
|---|---|---|
| `Plate` (filter) | CSS `filter` on `#game` while live; re-applied via 2D-canvas `ctx.filter` on export (Safari: unfiltered export, badge says so) | `None · Autochrome · Orthochromatic · Sepia · Nitrate Teal`. In Watch IV `Autochrome`/`Nitrate Teal` are disabled ("no glamour", story §3.3). |
| `FOV` | `settings.fov` (restored on exit) | 60–110 |
| `Frame` | compositing on export | `None · Postcard border · Oval vignette` (postcard border is a plain rule, no WSL mark) |
| `Hide prompt` | UI-local | hides the rail for a clean view |
| `Capture` `Space`/`A` | `ui:screenshot {resolution:'4k'}` → `photo:captured {blob, width, height}` (Appendix A) | `ui_shutter`, white flash 80ms (none under `reduceMotion`) |
| `Time of day` | **read-only plate** | shows the current watch window; locked within the current Watch (story §3.3) |

Removed: Aperture/Focus (no depth-of-field pass in `PostPipeline.js`), Shutter/motion blur (no pass), Roll (would need a camera API the contract lacks), Hide player (first person has no body), Time-of-day slider. These are Appendix B.

Capture pipeline: the blob goes into **IndexedDB** (`titanic.photos`, cap 24, oldest evicted with a toast) with a 320x180 JPEG thumbnail; `Export` is a `<a download>` of the full PNG. `localStorage` is never used for images (5 MB quota). The **Gallery** (menu) shows the 24 thumbs on a cork board with brass pins; click → full view + `Download` + `Discard`.

### 2.9 Pause

Triggered by `Esc`/`Start` **or by an unrequested pointer-lock loss** (§5.3 — in practice the browser's own Esc handling is what arrives). Game time freezes (`main.js` stops the clock in `paused`); the canvas container gets `filter: saturate(.6)` and a lamp-flicker vignette. Centre: a brass-rimmed porthole with the frozen scene, beneath it a vertical plate menu: `RESUME · SHIP'S LOG · DECK PLAN · WIND THE WATCH · PHOTO MODE · SETTINGS · SAVE · LOAD · ABANDON TO MENU`. Title plate `ALL STOP`. Cursor visible. `RESUME` → `ui:resume` (the integrator re-requests the lock; see the ~1 s note in §5.3).

### 2.10 Watch / Time control — "Wind the Watch"

Modal chronometer dial (16rem), brass gimbal ring, `--font-doc` numerals. Current time hand; next story beat marked on the bezel (`00:05 — Uncover the boats`, from the next beat's `trigger.at` and title, read via the `story` object passed to the UI). Interaction: **hold confirm** (`.hold-ring`, §4.20, 1.2 s) to wind — on completion emit `ui:advanceTime {to}`; the integrator's `clock.advanceTo` time-lapses the world. Minute repeater chime (`bell`) on arrival.

**Where it opens (story §2.0, pacing is deliberate):** from the Pause menu (`WIND THE WATCH`) and from the physical bulkhead clocks (Grand Staircase, bridge, Third Class General Room) via `player:interact` on an interactable of `type:'use'` with `data.kind === 'clock'`. **Not** from the HUD clock (read-only plate, §2.4) and **not** from the `T` key: `T` shows a 3 s tooltip under the HUD clock — `Next: 00:05 — Uncover the boats · Wind the watch at a bulkhead clock`. Disabled with a reason plate when no beat is pending or during Watch IV urgent sequences (`The watch cannot be wound now.`). Before the first wind into Watch IV the modal shows the story's warning: *"From here, the ship keeps her own time."*

### 2.11 Outcomes — faint, trapped, lost at sea

Three distinct outcomes; only the last is a "game over" screen. None of them is shown for Jack's scripted death in IV.11, which is a cutscene (`cutscene:play`) that proceeds to the whistle hold and the Epilogue.

| Outcome | Trigger | Screen | Audio | Exit |
|---|---|---|---|---|
| **Faint** | `player:fainted` (cold meter empty, Appendix A) | `--cold` vignette closes to black over 1.2 s; a parchment steward's card: `A steward carries you back to the stairs.` | none (no bell) | auto-continue after 2 s at the stair head (`main.js` teleports) |
| **Trapped** | `player:trapped` (Appendix A) | cut to black (120 ms), `--fog` line `Trapped.` for 1 s | none | `ui:load` of the last autosave |
| **Lost at Sea** | `player:died` (sustained `player:drowning`; `mode:'gameover'`) | scene fades to `--navy`, cold vignette; a still ship's bell (no toll, no swing) above `LOST AT SEA` in `--font-engrave` `--fs-2xl` `--fog`. Beneath, the story's own convention in italic body: `Last seen: E Deck, 01:12.` (deck from `state.deck`, time from `state.clock.hhmm`). No ticket number, no invented epitaph, no name. | a single distant bell at −12 dB | brass plates: `RETURN TO LAST LOG` (`ui:load`) · `DECK PLAN` · `MAIN MENU` (`ui:quitToMenu`) |

No red anywhere on these screens; grief, not alarm.

### 2.12 Credits — Ship's Manifest

A paper scroll unrolling upward (clip-path reveal), `--font-doc`, three columns `NAME · CLASS · ROLE`. Section headers as burgundy ticket bands (`OFFICERS` = leads, `ENGINEERING` = programming, `VICTUALLING` = art, `BAND` = music, `PASSENGERS` = thanks). Scroll speed adjustable with stick/wheel.

**Memorial card (final, mandatory, plain):** a full-screen `--navy` card with `In memory of the 1,496.` in `--font-body` `--fs-lg` `--fog`, centred, nothing else: no swell, no glint, no bell, no star, no department-pun header above or below it. It holds for 6 s, then the two plain resource links from §0.2 and `BACK TO THE HELM`. **`Esc` during the scroll skips *to* the memorial card, not past it**; `Esc` on the card returns to the menu.

### 2.13 Cold meter, follower state, character switch

- **Cold meter** (`state.cold`, 0..1 or `null` when not applicable — Appendix A; drains in water, restores in dry corridors; Lemonade/Biscotti restore it via `quest:inventory`). Rendering: `frost` vignette in `--cold` whose inset grows with `1 − cold`; a 3rem snowflake plate bottom-right shows the value as a frost ring; at `cold < .25` the plate pulses and the log tray shows `Get out of the water.` in copperplate. Under `colourBlind` modes the vignette gains a dotted rime so it is not read as blue water. Audio dulling is `AudioEngine`'s job, not the UI's.
- **Follower state:** when `state.follower` is set (`{ id, name }`, Appendix A), a small brass tag under the deck plate reads `With: Rosie` and the compass shows a second, hollow pin for the follower's bearing if `state.follower.bearingDeg` is present.
- **Character switch stinger** (IV.4, IV.6): on `player:switch {to:'jack'|'rosie', name}` (Appendix A) play `stinger` (§1.5) with a name plate `ROSIE DeWITT-BOUQUET` / `JACK DRAWSON` and `ui_stinger`; the HUD re-fades element-by-element; the deck plate briefly shows the new character's deck. Under `reduceMotion`: a 120 ms fade with the plate.

### 2.14 Plaque reader

On `quest:discover {id, name}`: `ui_bell2`, a `discovery` toast, and — only when the player is standing still (no movement input for 300 ms, read from `state.player` delta) — a **brass plaque modal** (`.plaque`, 32rem, `--font-engrave` title + `--font-doc` 2–3 sentences from `DISCOVERIES[id].plaque`, verbatim; `[E]`/`Esc` closes; keeps pointer lock). Plaques never editorialise and never mention the film. The same component is pasted into the Log (§2.6).

### 2.15 The 1996 frame — Prologue and Epilogue

`html[data-era="1996"]` is set by the UI when `quest:watchStart {watch}` has `watch.id === 'prologue' || 'epilogue'` and cleared on any 1912 watch. In this era the brass-and-mahogany theme is replaced wholesale by the phosphor skin (§1.3): `--font-doc` everywhere, uppercase, `--crt` green on `#050806`, amber for warnings, 2px scanlines, no gradients, no rope, no glint; sounds `ui_crt_*`.

**ROV HUD (Prologue, four elements only):** `DEPTH 3,800 m` (top-left, from `state.player.y` mapped by `main.js` into `state.rov.depthM`), `HDG 047` (top-right, `state.heading`), `THRUST ◼◼◼◻◻` (bottom-left, `state.rov.thrust`), and a sonar ring bottom-right (`state.rov.contacts[]`, bearing/range; the suite marker is the only contact in beat 1). A one-line amber caption area at the bottom carries the piloting tutorial (`Hold W to thrust · Mouse to steer · Collision resets you`). Photo mode in the wreck palette uses the same rail as §2.8 with `Plate` locked to `Wreck` (desaturated blue-green CSS filter).

**Epilogue final-choice card:** a two-button card in the phosphor skin, centred, nothing diegetic: `DROP IT` · `KEEP IT ONE MORE NIGHT`, both valid (story §2.6), emitted as `ui:dialogueChoice {index}` on the story's final node. No timer, no hold.

**Skippable prologue:** `NEW VOYAGE` → ticket → `Begin with the 1996 prologue? (recommended)` knife switch (default on; remembered in `localStorage.titanic.ui.prologue`); off → the integrator's `ui:newGame {watch:'watch1'}` (Appendix A adds the optional `watch` field). `HOLD [SPACE] TO SKIP` (`.hold-ring`) is also available during the prologue cutscenes.

### 2.16 Mini-game widgets

The story requires seven small input games. The UI ships three reusable widgets; game logic lives in `QuestManager` and crosses the bus as `minigame:start {id, kind, params}` / `ui:minigameResult {id, score, data}` (Appendix A).

| Story beat | Widget | Params → result |
|---|---|---|
| I.1 five-card draw, side quest 4 brag | `.hand` card fan (§4.21) | `{ cards:[{rank,suit}], canDiscard }` → `{ keep:[idx] }` |
| II.4 spit arc | `.timing-bar` (§4.19) with a wind marker | `{ wind:-1..1 }` → `{ t:0..1 }` |
| II.5 fork pick | `.hand` in "cutlery" mode (`kind:'forks'`) | `{ options:[name] , hint }` → `{ index }` |
| II.6 rhythm | `.timing-bar` in "beats" mode (markers at tempo) | `{ bpm, beats, tier }` → `{ hits, misses }` |
| IV.6 axe swing | `.timing-bar` single sweet spot, `axe` icon | `{ sweet:[a,b] }` → `{ t }` |
| Side quest 12 squash | `.timing-bar` repeating | `{ rounds }` → `{ hits }` |
| IV.11 whistle | `.hold-ring` with brightening overlay | `{ seconds }` → `{ held }` (the screen brightens with `held/seconds`) |

---

## 3. Layout, scale, safe areas, glyphs, accessibility

### 3.1 Scale model

```css
html{font-size:calc(16px * var(--ui-scale,1) * var(--ui-user,1))}
:root{--ui-scale:1;--ui-user:1;--safe:3vmin}
```
JS sets `--ui-scale` on resize: `scale = clamp(0.75, min(innerHeight/1080, innerWidth/1920), 2.4)` (DPR is intentionally ignored; the canvas handles DPR). `--ui-user` is **exactly `settings.uiScale` (0.8–1.6)** — one global multiplier: everything authored in `rem` scales, gauges included. There is no separate text-only size in v1 (the v1.0 §3.5 claim that text scales independently is withdrawn; a `--text-user` on `.plate/.ticket/.log` font-size is Appendix B). Results: 1080p → 1.0, 1440p → 1.333, 2160p → 2.0, 1080p ultrawide → 1.0. CSS fallback if JS is late: `font-size: clamp(12px, 0.8333vw, 40px)`.

Everything else is `rem`. Hairlines use `max(1px, .0625rem)`. Blur radii in `rem`. Canvas size is the Engine's business (`resolution` × `renderScale`, letterboxed with `object-fit: contain`).

### 3.2 Grid and spacing

- 12-column fluid grid on menus: `grid-template-columns: repeat(12, minmax(0,1fr))`, gap `1.5rem`, max content width `96rem` centred.
- Spacing scale: `--s1:.25rem --s2:.5rem --s3:.75rem --s4:1rem --s6:1.5rem --s8:2rem --s12:3rem --s16:4rem`.
- Radii: `--r-plate:.375rem --r-card:.75rem --r-port:50%`.
- Elevation: `--sh-1: 0 1px 2px #0008; --sh-2: 0 .25rem .75rem #000a; --sh-3: 0 1rem 2.5rem #000c`.
- Minimum hit target `2.75rem` (44px at 1080p, 88px at 4K).
- Plate widths are authored with 30% slack over the English string so a future localisation (Appendix B) does not reflow brass.

### 3.3 Safe areas

HUD root: `inset: calc(var(--safe) + env(safe-area-inset-top)) …`. `--safe` is fixed at `3vmin` in v1 (user-adjustable inset is Appendix B). Ultrawide (>2.1:1): HUD anchors to a centred 16:9 box of width `min(100vw, 177.8vh)`; background art bleeds. Portrait/narrow (<1.2:1, tablets): HUD condenses; compass collapses to `FWD`+digits only; log tray hides until objective change.

### 3.4 Glyphs

- **Keyboard key cap** `.kbd`: flat `--brass` square with a `--grad-brass` bevel ring, `min-width:1.75rem; height:1.75rem; padding:0 .4rem; border-radius:.3rem; color:var(--bronze-lo); font:600 .8rem var(--font-engrave); box-shadow: inset 0 1px 0 #fff8, 0 2px 0 var(--brass-lo), 0 3px 4px #0008`. Pressed: `translateY(2px)`, drop shadow collapses. Long names: `SPACE`, `SHIFT`, `ESC`, `F5`, `↑`.
- **Gamepad glyphs:** sprite `#gp-*` for `a b x y lb rb lt rt ls rs dpad start select`. Platform skin by `html[data-pad="xbox|ps|generic"]` (set from `Gamepad.id`): Xbox = coloured letter discs on bronze; PS = shapes in brass; generic = numbered brass buttons. Detect via `gamepadconnected`; last-used device (`pointermove/keydown` vs `input.axes` activity) switches the shown hint set with a 200ms fade.
- Hint bars always read `[glyph] VERB` in `--font-engrave` `--fs-xs`, `--fog-dim`. Gameplay hint bars include `[F5] Save · [F9] Load`.

### 3.5 Accessibility

- Text contrast AA minimum (4.5:1) everywhere; AAA for body on parchment/navy. The three §1.1 traps are in the "must hold" list and linted.
- `Interface size` (`uiScale`) scales the whole overlay (one multiplier, §3.1).
- `Reduce motion`: kills swell, glint, lamp flicker, page-turn, rope-drop, stinger, frost growth, needle overshoot (linear 150ms), the pause/menu camera drift request, the capture flash; **all timed dialogue becomes untimed**; every `.hold-ring` completes on a single press.
- `Colour-blind` (`colourBlind`): gauge zones swap red/green for blue `#3D7BD9` / orange `#E07B22` plus hatch patterns; flood fill gets diagonal stripes; cold vignette gets rime dots; objective pins get numbers; the `--danger` tier colour becomes `#E07B22`.
- Lights-out (§5.5 tier 4) forces the high-contrast variant automatically: every HUD text gets a `#000c` plate, crosshair gets a white/black double ring. (A user-selectable high-contrast toggle is Appendix B; the variant itself ships because tier 4 needs it.)
- All menus fully keyboard/gamepad navigable; `:focus-visible` = `outline: .2rem solid var(--brass-hi); outline-offset:.2rem` plus glint.
- Screen-reader: overlay uses semantic `<button>`, `<nav>`, `<dialog>` with `aria-modal`; `aria-live="polite"` on the log tray and toast rack only (never on `#ui`); `aria-live="assertive"` for `sinking:event`. Decorative ornaments `aria-hidden`. While a modal is open, `#hud` gets `inert`.
- Hold-to-confirm actions have the single-press alternative under `reduceMotion`; the exit line of every conversation is always reachable with `Esc`.

---

## 4. Component library

Conventions: BEM-ish class names, states as `data-*` or `aria-*`, tokens on `:root`. Components are plain functions `make(props) → HTMLElement` exported from the owning screen module (ARCHITECTURE §8 file list; there is no `components/` folder and no `<template>` in `index.html` — markup is built in JS with `html\`…\`` tagged template literals so the sprite and templates stay in one place: `src/ui/markup.js`).

### 4.1 Brass Plate `.plate`
```html
<div class="plate plate--rivets" data-tone="brass|bronze|rust"><span class="engraved">B DECK</span></div>
```
Flat `--brass` body + `::before` gradient bevel (§1.3). States: `data-lit` (glint running), `data-dim` (opacity .35), `[aria-disabled]` (desaturated). Tokens: `--plate-bg`, `--plate-edge`, `--plate-ink`, `--plate-pad: .4rem .9rem`.
```
 o------------o
 |  B  D E C K |
 o------------o
```

### 4.2 Brass Button `.btn`
```html
<button class="btn btn--primary"><svg class="ico"><use href="#ico-wheel"/></svg><span>Take the Helm</span><kbd class="kbd">A</kbd></button>
```
Variants: `--primary` (brass), `--secondary` (bronze), `--danger` (rust body, `--fog` text), `--ghost` (engraved outline). States: hover (brightness 1.08 + glint), active (`translateY(1px)`, inset shadow), focus-visible (outline), disabled (`filter:grayscale(.8) opacity(.5)`), loading (tiny wheel spinner). Height `3rem`, padding `0 1.5rem`, `--font-engrave` `--fs-sm`, ink `--bronze-lo` on flat `--brass`.
```
 [ (o) TAKE THE HELM   A ]
```

### 4.3 Rope Frame `.rope`
```html
<section class="rope rope--tarred?">…</section>
```
`position:relative; padding: var(--rope-w,.5rem)`; `::before{inset:0; background: var(--brass); mask: url(#rope-lay) 0 0 / 12px 8px repeat; mask-composite: exclude; padding: var(--rope-w); -webkit-mask-composite: xor}` → a hollow rope ring that reads as laid hemp at any scale. Used around the dialogue area, loading ticket, toasts. No states. Defined once here; §1.3 holds the pattern.

### 4.4 Porthole `.porthole`
```html
<figure class="porthole" style="--d:11rem"><div class="porthole__glass"><svg class="silhouette">…</svg></div><figcaption class="plate">CAPT. SMYTHE-STEADFAST</figcaption></figure>
```
Rings: outer brass, inner bronze, 6 bolts via `background` radial dots on a rotated pseudo-element. Glass gets `inset` shadow + diagonal reflection stripe (`#ffffff14`). Content is the static silhouette SVG (§2.5), never a canvas. States: `data-open` (glass clear), `data-fogged` (blur 3px, narrator/unknown). Token `--d` diameter.
```
   .-"""-.
  / o   o \
 |  (  )   |   [NAME PLATE]
  \ o   o /
   '-...-'
```

### 4.5 Toggle `.switch` (brass knife switch)
```html
<label class="switch"><input type="checkbox" role="switch"><span class="switch__blade"></span><span class="switch__label">Invert Y</span></label>
```
Blade rotates −30° (off) → 0° (on) around a brass pivot; contact plate glows `--brass-hi` on. States: checked, disabled, focus. Width `3.5rem`.
```
  OFF  \____   |   ON  ____o
```

### 4.6 Valve Wheel Slider `.valve`
```html
<div class="valve" role="slider" tabindex="0" aria-valuemin="0" aria-valuemax="100" aria-valuenow="70" aria-label="Music" style="--v:.7"><div class="valve__wheel"></div><output class="valve__dial">70</output><span class="valve__label">Music</span></div>
```
Wheel = 3rem brass ring with 6 spokes (conic-gradient), `transform: rotate(calc(var(--v) * 1080deg))`. Drag (pointer, horizontal or circular), wheel (±1), arrows (±1, shift ±10), gamepad stick (rate-based). Readout on an enamel dial. Each step emits `audio:play {id:'ui_ratchet', pitch: v}`. States: dragging (`data-active`, glint), disabled. Tokens `--valve-size`, `--valve-track`. Props: `{ key, min, max, step, format }` — writes `settings.set(key, value)` on change.
```
   (-|-)  [ 70 ]  Music
```

### 4.7 Gauge `.gauge`
```html
<div class="gauge" role="meter" aria-valuenow="62" aria-label="Thrust" style="--v:.62"><svg viewBox="0 0 100 60"><!-- arc, ticks, zones --></svg><div class="gauge__needle"></div><span class="plate plate--sm">THRUST</span></div>
```
180° arc; needle `rotate(calc(-90deg + var(--v) * 180deg))` with `needle` easing. Zones drawn as SVG arcs (`--zone-lo` rust, `--zone-hi` ok; swapped/hatched in CB mode). Sizes `--g:4rem|6rem|10rem`. State `data-trend="up|down"`. (No longer used for reputation; retained for the telegraph readout and the 1996 thrust gauge.)

### 4.8 Ticket Card `.ticket`
```html
<article class="ticket"><header class="ticket__band">WHITE STAR LINE <svg class="ico"><use href="#ico-star-1912"/></svg></header><dl class="ticket__body">…</dl><footer class="ticket__stub">THIRD CLASS · G-62</footer></article>
```
Parchment gradient, perforated stub (`border-left: .2rem dotted var(--parchment-lo)`), rounded-notch corners via `mask: radial-gradient(...)`. The band is a **period document reproduction** (§0.2); `.ticket--plain` is the counsel fallback without the star. Variants `--loading` (adds `.progress-rope`), `--save` (slot), `--confirm`. States: `data-selected` (burgundy stamp), `data-empty` (faded), `data-boarded` (stamp `BOARDED`).
```
 |====== WHITE STAR LINE  * ======|
 | Passenger  Jack Drawson        |
 | Class      Third   Berth G-62  |
 | ~~~~~~~~~~o~~~~~~~  (rope)     |
```

### 4.9 Engine-Order Telegraph `.telegraph`
```html
<div class="telegraph" role="radiogroup" aria-label="Graphics quality" data-pos="HALF"><div class="telegraph__face"><!-- SVG dial, 5 sectors, STOP aria-hidden --></div><div class="telegraph__lever"></div><div class="telegraph__labels"><button role="radio" data-pos="DEAD SLOW" data-quality="low">DEAD SLOW</button>…</div></div>
```
Face: bronze disc 16rem, sectors `STOP / DEAD SLOW / SLOW / HALF / FULL AHEAD` with engraved text along arcs (SVG `textPath`); the red `STOP` sector is decorative (`aria-hidden`, no radio). Lever: brass bar + black knob, `rotate(var(--angle))` from −60° to 80° across the four live positions, `telegraph-swing`, `ui_clank`. Clicking a sector or using left/right moves one step and calls `settings.set('quality', …)`. Readout plate shows preset name + `frameMs` from `GameState.stats`. Tokens `--tg-size`, `--tg-angle`.
```
       FULL AHEAD
   HALF  \ | /  (STOP, inert)
 SLOW  ---(o)---
  DEAD SLOW |
          ===knob
```

### 4.10 Deck Tabs `.decktabs`
```html
<nav class="decktabs" role="tablist" aria-orientation="vertical"><button role="tab" aria-selected="true" class="plate">BOAT</button><button role="tab" class="plate">A</button>…</nav>
```
Vertical stack, selected plate lit + 2px brass connector line to the blueprint; decks with no discovered room show a keyhole icon and 50% opacity (still selectable: the outline is always drawn). Keyboard up/down, bumpers.

### 4.11 Compass Strip `.compass`
```html
<div class="compass" aria-label="Heading 266, facing forward"><div class="compass__tape" style="--hdg:0"></div><div class="compass__lubber"></div><output>266°</output></div>
```
Tape is a 1080°-wide (3 repeats) flex of tick marks and the four ship-relative marks `FWD · STBD · AFT · PORT`, `translateX(calc(var(--hdg) * -1 * var(--px-per-deg)))` where `--hdg` is `state.headingRel`; wraps seamlessly. Pins injected as absolutely positioned children with `--bearing` (relative degrees from `state.objective.bearingDeg` / `state.follower.bearingDeg`). Masked ends (`mask: linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)`). The `<output>` shows true heading.

### 4.12 Trim & List Gauge `.incline`
```html
<div class="incline" data-tier="2" style="--trim:8;--list:3">
  <div class="incline__pendulum" role="meter" aria-label="Trim 8 degrees by the head" aria-valuemin="0" aria-valuemax="45" aria-valuenow="8"><div class="incline__arc"></div><div class="incline__needle"></div><output>BY THE HEAD 8°</output></div>
  <div class="incline__tube" role="meter" aria-label="List 3 degrees to port"><div class="incline__bubble"></div></div>
  <div class="incline__flood"><!-- 16 <i data-compartment data-flood="0..1"> --></div>
</div>
```
Pendulum needle `rotate(calc(var(--trim) * 2deg))` across a 0–45° arc (pinned at 45 with a `↓` glyph when `trimDeg > 45`); bubble `translateX(calc(var(--list) * var(--px-per-deg-incl)))`, clamp ±15 (positive = port, per the ARCHITECTURE sign convention). Compartments `data-flood="0..1"` fill via `background: linear-gradient(0deg, #2A6F97 var(--f), transparent var(--f))`; flood fraction per compartment = `clamp((floodY − floorY) / height, 0, 1)` using `SHIP.bulkheads[i]` x-ranges and `SHIP.decks` heights, unless `sinking:state.compartments` is provided (Appendix A). States `data-tier="0..4"` (§5.5) drive colour (`--warn` from tier 2, `--danger` tier 3+, pulsing border tier 4).

### 4.13 Modal `.modal`
```html
<dialog class="modal modal--log|--port|--board"><div class="modal__frame">…</div></dialog>
```
Native `<dialog>` + `showModal()`; backdrop `--scrim` + 2px blur. Frames: `--log` leather book, `--port` porthole, `--board` teak drafting board. Focus trapped by `<dialog>`; `Esc` closes unless `data-locked` (the dialog's `cancel` event is intercepted). Open/close: scale .97→1 + fade 180ms. While any modal is open the UI sets `inert` on `#hud`. Because `showModal()` puts the dialog in the top layer, the toast rack and helm overlay are **also top-layer** (`popover`, §4.14, §4.18) and are opened *after* the modal so they stack above it.

### 4.14 Toast `.toast`
Top-right stack inside `<div id="toasts" popover="manual" aria-live="polite">` (shown once at boot with `showPopover()` so it lives in the top layer above any modal), max 3, parchment card with rope edge and bell icon. Kinds map from `notify {text, kind}` and quest events: `objective` (one `bell`), `discovery` (two bells), `warning`/`warn` (rust plate, `ui_whistle`), `save` (book icon, 1.5 s), `speech` (speaker name + line; also mirrored to the subtitle line), `reputation` (purser's note icon), `photo` (camera icon, "Pinned to the gallery"). Auto-dismiss 4 s; hover pauses.

### 4.15 Tooltip `.tip`
Engraved brass tag with a tiny ring at top (hung look), `--fs-xs`, 300 ms delay, follows focus too. Positioned via CSS anchor positioning where supported, JS fallback. Also used for the `T` next-beat tooltip (§2.10).

### 4.16 Progress Rope `.progress-rope`
`<div class="progress-rope" role="progressbar" aria-valuenow="42" style="--p:.42">` — slack rope full width (rope pattern at 40% opacity, 2px thinner), taut rope `width: calc(var(--p)*100%)` (full pattern), knot `::after` at the join. Indeterminate: knot oscillates. Driven by `loading:progress.pct`.

### 4.17 Manifest Rows `.manifest`
`<table>` in `--font-doc`, zebra `#00000008`, class dot (gold/burgundy/sea-green/navy), row hover lifts `1px`. Used in Passengers Met and Credits.

### 4.18 Pointer-lock overlay `.helm`
`<div class="helm" popover="manual">` — full-screen scrim with a centred ship's wheel (idle slow spin) and `CLICK TO TAKE THE HELM` plate; sub-line `Esc releases the wheel`. Top-layer so it is never hidden by a modal. See §5.3 for the truthful state machine.

### 4.19 Timing Bar `.timing-bar`
```html
<div class="timing-bar" role="img" aria-label="Timing" data-mode="sweep|beats|repeat" style="--sweet-a:.55;--sweet-b:.7;--t:.31"><div class="timing-bar__track"></div><div class="timing-bar__sweet"></div><div class="timing-bar__marks"></div><div class="timing-bar__needle"></div><kbd class="kbd">SPACE</kbd></div>
```
Brass rail 20rem x 1.5rem with an enamel track; the sweet spot is a `--ok` band (hatched in CB mode); the needle sweeps `--t` 0→1→0 at `params.speed` (JS-driven `style.setProperty`, rAF). `sweep` = single pass (axe, spit); `beats` = fixed marks at `60/bpm` s and the needle runs once (rhythm); `repeat` = loops until `rounds` are done (squash). Press → freeze, flash `--ok`/`--warn`, emit `ui:minigameResult`. Wind marker (spit) is a brass arrow offset by `params.wind`.

### 4.20 Hold Ring `.hold-ring`
```html
<button class="hold-ring" style="--hold:1.2s;--p:0"><svg><circle class="hold-ring__track"/><circle class="hold-ring__fill"/></svg><span>HOLD <kbd class="kbd">SPACE</kbd> TO SKIP</span></button>
```
Brass ring 4rem; the fill arc grows over `--hold` while the key/button is held (`pointerdown/keydown` → rAF; release before completion → fray back over 300 ms). On completion emits the owner's event. Shared by **skip cutscene**, **wind the watch**, **whistle** (IV.11; the overlay brightness tracks `--p`), and fast-travel confirm. Under `reduceMotion` a single press completes it.

### 4.21 Card Hand `.hand`
```html
<div class="hand" role="listbox" aria-label="Your hand"><button role="option" class="card" data-rank="3" data-suit="♣" aria-selected="false">…</button>×5</div>
```
Five period playing cards (CSS: parchment face, `--font-doc` pips, burgundy back pattern) fanned by `rotate(calc((var(--i) − 2) * 6deg)) translateY(calc(abs(var(--i) − 2) * .4rem))`; toggling an option marks it for discard (card lifts 1rem and gets a brass tag `DISCARD`). `kind:'forks'` renders cutlery silhouettes on a linen strip instead, same semantics. Confirm emits `ui:minigameResult {id, keep:[…]}`.

### 4.22 Plaque `.plaque`
Brass plate 32rem (modal) or 14rem (Log), rivets, title in `--font-engrave`, body in `--font-doc` `--fs-sm` `--bronze-lo` on flat `--brass`; a hairline frame inset `.5rem`. Only `DISCOVERIES[].plaque` text is ever rendered in it.

---

## 5. UX flows

### 5.1 Boot → menu → new voyage → prologue → gameplay

The menu needs the live exterior behind it, so the world is built *before* the menu; interiors, NPCs and the collision BVH come after `NEW VOYAGE`. (`main.js` currently builds everything before `game:ready`; Appendix A asks for the split — until then the UI shows one longer boot loading screen and the second one is a 900 ms stamp.)

1. **Boot:** `index.html` paints the title scrim and a static wheel instantly (critical CSS inline); fonts preload; the Engine is a main-thread `WebGLRenderer` (no worker, no WebGPU). If WebGL2 is missing → `ticket--confirm` "This vessel requires WebGL2" with a plain link to browser help.
2. **Loading I** (§2.3): exterior hull/superstructure, ocean, sky, materials — driven by `loading:progress`. Ends on `game:ready` → `mode:'menu'`.
3. **Welcome Aboard card (first launch only):** ticket with the input device auto-detected, `Interface size` and `Reduce motion` quick toggles, the **About this game** paragraph (§0.2), and the chosen telegraph position with "You may change speed in Settings". `BOARD` confirms (this click unlocks the AudioContext) → menu.
4. **Capability probe (first launch only):** runs 2 s on the **menu exterior** using `GameState.stats.frameMs` (no hidden render, no re-probe later), with thresholds retuned for an exterior view: `< 9 ms` → `ultra` when `screen.height ≥ 2160` else `high`; `9–16` → `high`; `16–26` → `medium`; else `low`. Written with `settings.set('quality', …)`.
5. **Menu:** wheel. `NEW VOYAGE` → ticket: `Passenger` field (24 chars, default `Jack Drawson`; the lint denylist applies to the default only — the player may type what they like, it is never shown outside their own save), `Weather` drum = difficulty (`Fair Weather`: cold meter and timers off, timed dialogue untimed · `Open Sea`: standard · `Ice Field`: cold drains 1.5x, mini-game sweet spots 30% narrower), `Begin with the 1996 prologue` switch. The ticket body always prints `Third Class · G-62`. `BOARD` → `ui:newGame {watch, difficulty}`.
6. **Loading II:** interiors, NPCs, BVH (ticket stamped `BOARDED`) → **Prologue** (1996 skin, §2.15) or **Watch I** cutscene (Southampton, `cutscene:play`). Any key shows the `.hold-ring` `HOLD [SPACE] TO SKIP`.
7. **Gameplay:** HUD fades in over 600 ms element-by-element (deck plate, compass, log, clock). The helm overlay appears immediately if the integrator's lock request did not take (§5.3). First `interact:prompt` teaches `[E]`; the first pause teaches the Pause screen; the first bulkhead clock teaches the Watch.

### 5.2 Save / Continue
Autosave on `player:deck` change and `quest:beatComplete` (the integrator emits `notify {kind:'save'}` → save mark). `F5`/`F9` quick save/load emit `ui:save`/`ui:load` (ARCHITECTURE §8) with the save mark / a 300 ms fade. `TAKE THE HELM` → `ui:continue`. `LOAD VOYAGE` shows ticket stubs with the IndexedDB thumbnail (captured via `ui:screenshot {resolution:'thumb'}` → 320x180 JPEG on every autosave), deck, time, playtime. The UI stores its own small state (`passengersMet`, gallery index, prologue preference) under `localStorage.titanic.ui.v1`, never images.

### 5.3 Pointer lock — "Click to take the helm" (truthful version)

- **Ownership:** `Input.js` owns the lock (`requestPointerLock()` with `unadjustedMovement`, `exitPointerLock()`), `main.js` decides when to request it, the UI is overlay + bus only. The UI never calls `canvas.requestPointerLock` itself; it emits `ui:requestPointerLock` from a user gesture and listens to `input:pointerlockchange {locked}` and `game:mode`.
- **Overlay rule:** when `mode === 'playing'` and the last `input:pointerlockchange` said `locked:false`, show `.helm` (top-layer). Click/`Enter` → `ui:requestPointerLock`. Gamepad-only users never need the lock: once `input.axes` shows activity the overlay reads `PRESS [A] TO TAKE THE HELM`, sets `data-input="pad"`, and `A` emits `ui:resume`.
- **The Esc truth:** while the pointer is locked, Chromium does **not** deliver the Esc `keydown` to the page — the browser exits the lock itself and the page only sees `pointerlockchange`. So "Esc in gameplay → push Pause" never fires from a key event; the real path is `input:pointerlockchange {locked:false}` while `mode === 'playing'` → `main.js` sets `mode:'paused'` → the UI shows Pause (§2.9). The UI's own `input:escape` handling applies only when nothing is locked (menus, modals, gamepad play).
- **Re-lock cooldown:** browsers refuse a new lock for ~1 s after an Esc exit, and it must come from a gesture. `RESUME` therefore shows `Take the helm…` with a brief wheel spin and the helm overlay if the integrator's request is refused; the next click re-requests. The overlay explains this in one line.
- **Errors:** `pointerlockerror` arrives as `input:pointerlockchange {locked:false}`; after three consecutive failed attempts the overlay offers `Play without pointer lock` (emits `ui:settingsChanged {key:'pointerLock', value:false}` — Appendix B key; until it exists the button is hidden).
- `visibilitychange` hidden → the integrator pauses and releases the lock; the Pause menu never requires lock.

### 5.4 Input stack — pause and dialogue vs movement

`main.js` owns the mode (`GameState.mode`) and gates movement (`player.enabled`); the UI keeps a parallel **focus stack** only for its own overlays: `hud` (default) → `dialogue` → `menu` → `modal`. Only the top layer receives UI key handling; the UI never zeroes movement itself.

- **Esc / `input:escape`:** top is `modal` or `menu` → pop (close). Top is `dialogue` → open Pause *over* the dialogue (`ui:mode {mode:'paused'}`; the DialogueRunner keeps its node; resuming returns to `dialogue`). Top is `hud` with the pointer unlocked (pad play) → `ui:mode {mode:'paused'}`.
- **Dialogue:** `dialogue:node` pushes `dialogue` (the integrator has already set `mode:'dialogue'`, which stops the player and keeps the clock running). The lock is **kept** through dialogue — the integrator never exits it in `dialogue` mode, and `Input` keeps accumulating `mouse.dx/dy` which `PlayerController` ignores because `enabled` is false — so leaving dialogue needs no re-lock gesture. Crosshair and prompt hidden; compass/clock at 50%.
- **Map / Log / Photo / Settings:** push `modal`. Map and Settings need a cursor → emit `ui:mode {mode:'map'}` (the integrator releases the lock for any non-playing mode except `photo`). Log and Watch are key/stick driven: they emit `ui:mode {mode:'journal'}` and accept that the lock is released; on close they emit `ui:resume`, and if the lock request is refused the helm overlay catches it.

### 5.5 Sinking HUD escalation

Trigger: `sinking:event {id:'strike'}` at 23:40 ship's time. Tiers advance on `sinking:state.trimDeg` (bow-down, **not** list) and on events; the HUD never jumps more than one tier at once (a tier change is queued 1.5 s after the last).

| Tier | Clock (story App. A) | Trim (`trimDeg`) | HUD changes |
|---|---|---|---|
| 0 | before 23:40 | 0° | normal |
| 1 | 23:40–00:05 | 0–2° | `.incline` fades in with `ui_whistle`; deck plate gains a `--rust` edge; `LIFEBOATS` pin on the compass (`LOCATIONS.boat_deck_stbd_aft`); objective toast on `bell`. |
| 2 | 00:05–01:00 | 2–8° | clock dial tints faintly amber; log entries prefixed `URGENT` in burgundy; UI swell amplitude doubles (unless `reduceMotion`); flood bar visible under the pendulum. |
| 3 | 01:00–02:05 | 8–18° | `#hud` rotates by `listDeg/4` (max 3°) — the tilt the player feels sideways is list; trim is sold by the pendulum, not by rotating text; `--danger` tier colour; low whistle loop; interaction prompts switch to short imperatives (`CLIMB`, `BRACE`); Watch disabled with reason. |
| 4 | 02:05–02:20 | > 18° (30°→vertical at 02:17) | compass and clock drop out at `sinking:event {id:'lightsOut'}` (02:17): HUD flickers (`lamp-flicker` at 3x) then goes dark; HUD becomes monochrome `--moon` outlines with the high-contrast variant forced; pendulum pinned with `↓`; subtitles get a solid box. |
| End | water | — | `player:drowning` → HUD submerges: a `--sea-green` rising fill over `#hud`; then **either** Lost at Sea (`player:died`, §2.11) **or**, when the story's IV.11 cutscene has control (`cutscene:play`), straight to the Epilogue — never the game-over screen. |

`reduceMotion` replaces flicker with a steady dim and removes the HUD rotation; `colourBlind` swaps `--danger` for `#E07B22` and adds hatching.

---

## 6. File layout, data binding, implementation notes

### 6.1 Files (ARCHITECTURE §8 layout — the only layout)

```
/index.html                 critical CSS inline, <canvas id="game">, <div id="ui"> (no aria-live), loads ./src/ui/theme.css + panels.css
/public/fonts/              9 x .woff2 + OFL.txt + manifest.json   (fetched by scripts/fetch-fonts.mjs; empty until run)
/scripts/fetch-fonts.mjs    pinned Google Fonts GitHub sources → public/fonts
/scripts/lint-copy.mjs      copy-deck denylist (§0.2); runs in `npm run check`
/scripts/copy-denylist.json
/src/ui/UI.js               root, mode switching (game:mode), focus stack (§5.4), helm overlay (§4.18), era attribute (§2.15)
/src/ui/theme.css           tokens (§1, §3), typography, ornaments (plate, rope, porthole, kbd), reduced-motion, 1996 phosphor skin
/src/ui/panels.css          big panels: settings, log, map, photo, pause, watch, outcomes, credits
/src/ui/markup.js           html`` tag, SVG icon sprite (incl. rope pattern + silhouette parts), shared make* helpers
/src/ui/HUD.js              compass, clock, deck plate, log tray, prompt, crosshair, incline, cold, follower, subtitles, save mark
/src/ui/MainMenu.js         ship's wheel, welcome card, new-voyage ticket, gallery
/src/ui/SettingsPanel.js    telegraph + valves + switches bound to settings keys (§2.2)
/src/ui/Loading.js          ticket + progress rope
/src/ui/DialogueBox.js      porthole, silhouette portrait, speech card, rope-hung choices, timer
/src/ui/Journal.js          leather log (five tabs)
/src/ui/DeckMap.js          blueprint SVG generated from SHIP.decks (§2.7), pins, fast travel
/src/ui/PhotoMode.js        bellows frame, rail, capture → IndexedDB, export
/src/ui/TimeControl.js      chronometer + hold ring (§2.10)
/src/ui/GameOver.js         faint / trapped / lost-at-sea (§2.11)
/src/ui/Credits.js          manifest scroll + memorial card
/src/ui/Notifications.js    top-layer toast rack
/src/ui/Minigames.js        timing-bar, hold-ring, hand widgets (§4.19–4.21) + minigame bus glue
/src/ui/Plaque.js           plaque modal (§2.14)
/src/ui/ProloguePanel.js    1996 ROV HUD + final-choice card (§2.15)
```
No `tokens.css/base.css/components/*/screens/*`, no `input-router.js`, no `pointer-lock.js`, no `sfx.js`, no `<template>`s, no `/public/deckplans`.

### 6.2 Binding table — every HUD/panel element → `GameState` field or bus event

The UI is constructed once with `new UI({ root, bus, settings, spec, story, characters, discoveries, collectibles })` and receives `ui.update(state)` each frame; it only writes `style.setProperty` for values that changed.

| UI element | Reads | Writes / emits |
|---|---|---|
| Mode switching (which panel is visible) | `game:mode {mode}`; `state.mode` | `ui:mode {mode}`, `ui:resume`, `ui:quitToMenu` |
| Loading ticket / rope | `loading:progress {pct, label}`, `game:ready` | — |
| Welcome / new voyage | — | `ui:newGame {watch?, difficulty?}`, `settings.set` |
| Main menu | `game:ready`, save presence (`localStorage` key) | `ui:newGame`, `ui:continue`, `ui:load`, `location.reload()` |
| Compass tape / digits / pins | `state.headingRel`, `state.heading`, `state.objective.bearingDeg`, `state.follower.bearingDeg` | — |
| Clock + date plate | `time:tick {date, hhmm}` (fallback `state.clock`) | — |
| `T` next-beat tooltip | next beat via `story.watches` + `state.objective` | — |
| Deck plate | `player:deck {deck}`, `state.deck`, `state.room?` | — |
| Log tray | `quest:objective {text, locationId}`, `quest:beatStart {beat, optional}`, `quest:beatComplete {beat, optional}`, `quest:watchStart/End {watch}` | — |
| Interaction prompt / crosshair | `interact:prompt {label} | null` | — |
| Trim/list/flood gauge | `sinking:state {trimDeg, listDeg, floodY, compartments?}`, `sinking:event {id}`; `spec.bulkheads`, `spec.decks` | — |
| Cold vignette / plate | `state.cold` | — |
| Follower tag | `state.follower {id, name, bearingDeg?}` | — |
| Character stinger | `player:switch {to, name}` | — |
| Subtitles / barks | `notify {text, kind:'speech'}`, `settings.subtitles` | — |
| Toasts | `notify {text, kind}`, `quest:objective`, `quest:discover`, `quest:collect`, `quest:reputation`, `photo:captured` | `audio:play {id}` |
| Dialogue box | `dialogue:start {npcId}`, `dialogue:node {speakerName, text, choices, choiceKinds?, portraitHint, hasNext, timed}`, `dialogue:end` | `ui:dialogueChoice {index}`, `ui:dialogueAdvance` |
| Journal | `state.objective`, `state.discovered`, `state.collected`, `state.inventory`, `state.reputation`, `quest:*`, `dialogue:start` | `ui:mode {mode:'journal'}` |
| Deck map | `spec.decks`, `spec.bulkheads`, `spec.hull`, `state.player {x,z}`, `state.headingRel`, `state.deck`, `state.objective.locationId`, `state.discovered`, `sinking:state` | `ui:mode {mode:'map'}`, `ui:teleport {locationId}` |
| Photo mode | `state.mode === 'photo'`, `photo:captured {blob}` | `ui:photoMode {on}`, `ui:screenshot {resolution}`, `settings.set('fov')` |
| Pause | `game:mode` | `ui:resume`, `ui:save`, `ui:load`, `ui:mode`, `ui:quitToMenu` |
| Wind the Watch | `story` next beat, `player:interact {interactable.type==='use', data.kind==='clock'}`, `state.sinking` | `ui:advanceTime {to}` |
| Settings | `settings.all()`, `state.stats.frameMs` | `settings.set(key, v)`, `ui:settingsChanged {key, value}` |
| Telegraph readout | `state.stats.frameMs` (1 s rolling mean) | — |
| Outcomes | `player:fainted`, `player:trapped`, `player:died`, `state.deck`, `state.clock` | `ui:load`, `ui:quitToMenu` |
| Credits | `game:mode === 'credits'` | `ui:quitToMenu` |
| 1996 ROV HUD | `state.rov {depthM, thrust, contacts}`, `state.heading`, `quest:watchStart {watch.id}` | — |
| Mini-games | `minigame:start {id, kind, params}` | `ui:minigameResult {id, …}` |
| Helm overlay | `input:pointerlockchange {locked}`, `state.mode`, `input.axes` activity | `ui:requestPointerLock` |
| Era / motion / CB attributes | `settings.onChange`, `quest:watchStart` | `html[data-era|data-reduce-motion|data-cb]` |

### 6.3 Implementation notes

- All animated HUD values are CSS variables so the compositor does the work; never read DOM geometry in the per-frame `update`.
- `ui.update(state)` diffs against the last snapshot; bus events update immediately. Nothing polls.
- Fonts: `font-display: swap` plus a `.fonts-ready` class (from `document.fonts.ready`) to avoid brass labels reflowing mid-glint.
- Top layer: `#toasts` and `.helm` are `popover="manual"` and are shown at boot; modals use `showModal()`; the order of opening decides stacking.
- The UI holds no three.js import. `npm run check` fails if `src/ui/**` imports `three`.
- Test matrix: Chrome/Edge/Firefox/Safari 17+, 1080p/1440p/4K at 100% and 150% OS scaling, keyboard+mouse, Xbox and DualSense pads, `reduceMotion` on, each colour-blind mode, screen-reader pass on menus, `?autostart=1&at=…` smoke screenshots of each panel at 3840x2160.

---

## Appendix A — Contract additions this spec requires (to be appended to `ARCHITECTURE.md` "Extensions")

Each line is a one-line addition in the ARCHITECTURE style; nothing here changes an existing signature.

1. `index.html` → remove `aria-live="polite"` from `#ui` (live regions are owned by the UI; a root live region announces every mutation).
2. `core/Settings.js` → new key `difficulty ('fair'|'open'|'ice')`, default `'open'`; read by `QuestManager` (cold drain, timers, sweet-spot width) and `DialogueRunner` (`fair` ⇒ `timed = null`). (`showFps` already exists in `Settings.js` and should be listed in §3.)
3. `main.js` → `GameState` gains `headingRel` (player heading relative to the ship's heading, deg), `objective.bearingDeg` and `objective.distanceM` (from the player's world position to `LOCATIONS[objective.locationId]` via `ship.localToWorld`), `room` (name of the room the player is in, or `null`), `cold` (0..1 or `null`), `follower` (`{id, name, bearingDeg} | null`), `rov` (`{depthM, thrust, contacts:[{bearingDeg, rangeM, id}]} | null`).
4. `main.js` → `ui:newGame` accepts an optional `{ watch, difficulty }`; `ui:screenshot { resolution:'4k'|'native'|'thumb' }` → sets the internal resolution for one frame, calls `engine.screenshot()`, replies `photo:captured { blob, width, height }`, restores the resolution.
5. `main.js` → boot split: `game:ready` fires after the exterior/world build; interiors + BVH build on `ui:newGame` with their own `loading:progress` run (the UI tolerates the current single-phase boot).
6. `story/DialogueRunner.js` → `Node.choices[].kind ('heart'|'wit'|'spine')` optional; `dialogue:node` payload adds `choiceKinds: [kind|null]` parallel to `choices`. On `settings.reduceMotion` or `difficulty === 'fair'`, `timed` is emitted as `null`.
7. `story/QuestManager.js` → emits `player:switch { to:'jack'|'rosie', name }`, `player:fainted { stairLocationId }`, `player:trapped`, `quest:watchEnd { watch }` (already emitted — listed for the UI), `minigame:start { id, kind:'hand'|'forks'|'sweep'|'beats'|'repeat'|'hold', params }`; listens `ui:minigameResult { id, … }`. Owns the cold meter and publishes it to `GameState.cold`.
8. `sinking/SinkingDirector.js` → optional `state.compartments: number[16]` (flood fraction per watertight compartment, bow to stern). If absent the UI derives it from `floodY` vs `SHIP.bulkheads`.
9. `audio/AudioEngine.js` → `play(id, opts?)` accepts the UI ids in §1.6 (`ui_back, ui_clank, ui_ratchet{pitch}, ui_bell2, ui_whistle, ui_knock, ui_shutter, ui_confirm, ui_stinger, ui_crt_tick, ui_crt_confirm`); `audio:play { id, pitch? }`.
10. `ship/interiors/Cabins.js` / ARCHITECTURE §5 wording → "B-52/54/56 (the chairman's suite, port) and B-51/53/55 (the fiancé's suite with private promenade, starboard)"; required `LOCATIONS` add `parlour_suite_B51`.
11. `ship` builders → bulkhead clocks (Grand Staircase, bridge, Third Class General Room) are interactables `{ type:'use', data:{ kind:'clock' } }`.
12. `package.json` → scripts `fetch-fonts`, and `check` additionally runs `scripts/lint-copy.mjs` and `scripts/lint-css.mjs`.

## Appendix B — Deferred to v2 (not built; do not design against)

Custom quality (`STOP` position, `settings.custom`), per-effect graphics toggles, frame cap, rebinding, invert X, gamepad sensitivity/deadzone, crouch/sprint toggle, Dialogue/UI volume buses, subtitle size/colour/box, separate text size (`--text-user`), user high-contrast toggle, hold→toggle option, screen-shake/camera-sway scalars, flash reduction (covered by `reduceMotion` for now), HUD safe-area inset, crosshair size/colour, monochrome colour-blind mode, play-without-pointer-lock (`pointerLock` key), cloud saves, photo-mode aperture/focus/motion blur/roll/time-of-day, NPC pose wheel, localisation (`t()` module; the 30% plate slack in §3.2 is the only v1 provision), a language select on the Welcome card.

## Appendix C — Decisions log (v1.1)

1. Hero title is the game title; "RMS Titanic" is a descriptive sub-line; no WSL/TITANIC lockups.
2. All UI placeholder copy uses roster names only; `-ish` names, film place names and "Kodak" are linted out; the Captain's sample line is story §1.5's.
3. Example cabin is B-51; story wins on suite assignment; ARCHITECTURE wording and required locations to be amended (App. A.10).
4. Difficulty is `Fair Weather / Open Sea / Ice Field` (`settings.difficulty`); the ticket always prints Third Class, G-62; no class-based difficulty or auto-berth.
5. Three outcomes: faint (steward card), trapped (black + reload), drowned (Lost at Sea with "Last seen: deck, hh:mm"); never for the scripted IV.11 death; the sinking end row routes to the Epilogue when the cutscene has control.
6. Photo filter "Nitrate Teal"; bellows plate camera; no brand names.
7. White Star livery only as a 1912 ticket reproduction, with a `.ticket--plain` fallback pending counsel; H&W is text only.
8. One memorial card, "In memory of the 1,496.", plain, Esc skips to it; About-this-game paragraph on first launch.
9. File layout and data flow follow ARCHITECTURE §8 exactly; §6.2 is the binding table; no store, no templates, no sfx module.
10. Graphics telegraph maps four positions 1:1 onto `low/medium/high/ultra` with only Engine-owned columns; STOP is decorative; `frameMs` is read live from `GameState.stats`.
11. Settings surface reduced to the 15 contract keys + `difficulty`; V-sync, HDR, cloud saves cut; the rest is Appendix B.
12. Deck plans are generated from `SHIP.decks` with the SVG schema in §2.7; `public/plans` removed; no vendored plans.
13. Trim pendulum is the primary sinking gauge, list bubble secondary; tier thresholds in trim degrees; HUD roll uses `listDeg/4`; lights out at 02:17; compartments derived from `floodY` unless provided.
14. Reputation is Log-only (Purser's Note) with a toast on `quest:reputation`; HUD gauges removed.
15. Dialogue portrait is a static SVG silhouette from `portraitHint`; Heart/Wit/Spine icons via `choices[].kind`; timed nodes default untimed, expire to the exit line, untimed under reduce-motion / Fair Weather.
16. The Watch winds only from Pause and bulkhead clocks; HUD clock is read-only; `T` shows a tooltip.
17. Boot order: Loading I (exterior) → menu on the live exterior → NEW VOYAGE → Loading II (interiors) → prologue; probe runs on the menu exterior; no worker, no WebGPU.
18. Pointer lock is owned by `Input.js`/`main.js`; the UI is overlay + bus; the Esc-while-locked path is documented truthfully as a `pointerlockchange`.
19. Toasts and the helm overlay are top-layer popovers; `#hud` goes `inert` under modals; `aria-live` only on the tray and toast rack; root `aria-live` removed.
20. `uiScale` is one global multiplier; font URLs are `/fonts/…`; `scripts/fetch-fonts.mjs` + `OFL.txt` added.
21. `--ok-text`/`--danger-text` added; `--ok`/`--danger`/`--rust` forbidden as text; brass text sits on a flat `--brass` fill with the gradient mid-stop lifted to `#B08A1E`.
22. Rope is one inline SVG pattern via `mask`; the contradictory "border-image" principle is deleted.
23. 1996 phosphor skin with a four-element ROV HUD and a two-button final-choice card; prologue skippable from the new-voyage ticket.
24. Cold meter, follower tag, character-switch stinger, plaque reader, and three mini-game widgets (`.timing-bar`, `.hold-ring`, `.hand`) added; Journal collectibles are per-tab grids sized 15/12/20 + a pocket slot; Log styling follows story §2.0 (copperplate / pencil / pasted plaques / "The watch is yours.").
25. UI sound goes through `audio:play` ids only; the id list is a contract addition.
26. Gallery is IndexedDB (24 photos, JPEG thumbs), Export is a download, ABANDON SHIP is reload-to-title, no motion blur, time-of-day read-only, F5/F9 everywhere they are relevant.
27. Wheel tags counter-rotate; the empty 8th spoke is skipped; the wheel is `22.5rem`; compass is ship-relative with FWD/STBD/AFT/PORT and true digits; objective pins come from `objective.bearingDeg`; English-only v1 with 30% plate slack.
