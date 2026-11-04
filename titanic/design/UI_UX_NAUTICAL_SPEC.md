# RMS TITANIC — Free-Roam Game: UI/UX Nautical Specification

Version 1.0 · Target: web build (Three.js WebGL2/WebGPU canvas + HTML/CSS/JS overlay) · Resolutions: 1920x1080, 2560x1440, 3840x2160 · No framework, no external images (vendored fonts under `/public/fonts` only).

---

## 0. Scope and principles

1. **One overlay, one canvas.** The 3D scene renders to `<canvas id="sea">`. All UI lives in `<div id="ui">` positioned over it. UI never draws into the WebGL canvas (except the crosshair dot, which is drawn in both for latency-free parity).
2. **Everything is an object the ship actually carried.** Menus are ship's wheels, telegraphs, logbooks, tickets, brass plates. No flat "gamey" panels.
3. **CSS-only ornament.** Brass, leather, rope, rivets and portholes are gradients, `box-shadow`, `border-image`-free borders and inline SVG. Zero bitmap dependencies.
4. **Scale-correct at 4K.** All dimensions derive from `--ui-scale`; nothing is authored in raw pixels except hairlines (`1px`) and blur radii.
5. **Diegetic first, legible always.** If a diegetic treatment drops below WCAG AA contrast, the legible version wins.

---

## 1. Visual language

### 1.1 Palette (CSS custom properties on `:root`)

| Token | Hex | Use |
|---|---|---|
| `--brass-hi` | `#F2D27A` | brass highlight, engraved text fill on dark |
| `--brass` | `#C9A227` | brass base, borders, primary accent |
| `--brass-lo` | `#7A5B12` | brass shadow, bevel underside |
| `--bronze` | `#6E5428` | aged bronze frames, telegraph body |
| `--bronze-lo` | `#3F2E12` | bronze recess |
| `--mahogany` | `#4A1E12` | wheel, book spine, panel wood |
| `--mahogany-hi` | `#7A3A26` | wood grain highlight |
| `--teak` | `#A8743C` | deck planking, warm surfaces |
| `--teak-lo` | `#7B5330` | teak seams |
| `--navy` | `#0B1626` | midnight sea, modal scrim base |
| `--navy-hi` | `#142238` | raised navy panels |
| `--parchment` | `#F1E6C8` | paper, tickets, log pages |
| `--parchment-lo` | `#DCCBA4` | page edges, aged stains |
| `--ink` | `#1C1710` | text on parchment |
| `--wsl-burgundy` | `#7A1F2B` | White Star burgundy (pennant, headers) |
| `--wsl-gold` | `#C8A24A` | White Star gold (star, lettering) |
| `--sea-green` | `#0F3B3A` | deep sea, secondary panels |
| `--sea-green-hi` | `#1C5A55` | hover on sea-green |
| `--rust` | `#8A3B1E` | sinking-phase accents, danger edges |
| `--rust-hi` | `#B4542A` | rust highlight |
| `--fog` | `#E9E4D8` | body text on dark |
| `--fog-dim` | `#A9A397` | secondary text on dark |
| `--ok` | `#4F8A5B` | success / discovered |
| `--warn` | `#E0A030` | caution (list 5-10°) |
| `--danger` | `#B3261E` | critical (list >10°, flooding) |
| `--scrim` | `rgba(6,12,22,.72)` | full-screen dim behind modals |

Contrast checks (must hold): `--fog` on `--navy` 13.9:1; `--ink` on `--parchment` 13.2:1; `--brass-hi` on `--navy` 10.6:1; `--brass` on `--navy` 6.9:1; `--parchment` on `--wsl-burgundy` 7.4:1. Never set body text in `--brass-lo`, `--bronze` or `--rust` on dark.

Brass gradient recipe (reused everywhere via `--grad-brass`):
```css
--grad-brass: linear-gradient(170deg,#F2D27A 0%,#C9A227 28%,#8E6E16 50%,#C9A227 72%,#F2D27A 100%);
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
| Body, dialogue, log entries | `Cormorant Garamond` 500/600 | Georgia, serif | min 18px equivalent at 1080p |
| Document/ticket/manifest type, gauges, numerics | `Old Standard TT` 400/700 | 'Times New Roman', serif | `font-variant-numeric: tabular-nums` |

```css
@font-face{font-family:"Cinzel";src:url(/public/fonts/Cinzel-SemiBold.woff2) format("woff2");font-weight:600;font-display:swap}
/* repeat per face; preload the four primary faces in <head> */
--font-display:"Playfair Display",Georgia,serif;
--font-engrave:"Cinzel",Georgia,serif;
--font-body:"Cormorant Garamond",Georgia,serif;
--font-doc:"Old Standard TT","Times New Roman",serif;
```

Type scale (rem; root = 16px x `--ui-scale`): `--fs-xs:.75rem --fs-sm:.875rem --fs-md:1.125rem --fs-lg:1.5rem --fs-xl:2.25rem --fs-2xl:3.5rem --fs-hero:6rem`. Line-height 1.35 body, 1.1 display.

Engraved text effect (`.engraved`): `color:var(--brass-hi); text-shadow:0 1px 0 #fff3, 0 -1px 0 #0008;` on brass backgrounds use `color:#3F2E12; text-shadow:0 1px 0 #fff6`.

### 1.3 Textures (CSS-only)

- **Leather (log book cover):** `--grad-leather` + `box-shadow: inset 0 0 40px #0008` + a stitched border: `outline: 2px dashed var(--brass-lo); outline-offset: -14px`.
- **Brass plate:** `--grad-brass` background, `border:2px solid var(--brass-lo)`, `border-radius:.375rem`, `box-shadow: inset 0 1px 0 #fff8, inset 0 -2px 0 #0006, 0 2px 6px #0009`. Rivets: four `::before/::after` radial-gradient dots (`radial-gradient(circle,#F2D27A 0 30%,#7A5B12 60%,transparent 62%)`) 10px diameter at corners; extra rivets via `background-image` lists for long plates.
- **Rope border:** `border: .5rem solid transparent; border-image: repeating-linear-gradient(45deg,#C9A96B 0 6px,#8C7442 6px 12px) 8 round;` — reads as twisted hemp at any scale. Variant `.rope--tarred` uses `#3A3A2E/#1E1E18`.
- **Porthole frame:** circular element, `border: .9rem solid; border-image: none; border-color: var(--brass)`, `background: var(--grad-brass)` on an outer ring, inner `box-shadow: inset 0 0 0 .25rem var(--bronze-lo), inset 0 0 2rem #000c`; six dog-bolts as rotated radial dots at 60° steps.
- **Engraved lines:** `hr.engraved{border:0;height:2px;background:linear-gradient(90deg,transparent,var(--brass-lo) 20%,var(--brass-hi) 50%,var(--brass-lo) 80%,transparent)}`.
- **Blueprint (deck plan):** background `#0E2A4A` with `repeating-linear-gradient` grids at 1rem and 5rem in `#FFFFFF14/#FFFFFF28`; strokes `#CFE3F5`.

### 1.4 Iconography

Inline SVG sprite `<svg id="ico" hidden>` with `<symbol>` per icon, 24x24 viewBox, `stroke="currentColor" fill="none" stroke-width="1.6"` line style (brass line engravings). Required symbols: `anchor`, `compass-rose`, `wheel`, `bell`, `telegraph`, `davit`, `lifebelt`, `porthole`, `stair`, `logbook`, `camera`, `chronometer`, `ticket`, `star-wsl` (five-point), `funnel`, `propeller`, `key`, `gear`, `eye`, `speaker`, `subtitles`, `gamepad`, `mouse`, `warning`, `water`. Usage: `<svg class="ico"><use href="#ico-anchor"/></svg>`; `.ico{width:1.25em;height:1.25em;vertical-align:-.2em}`.

### 1.5 Motion

| Name | Spec | Where |
|---|---|---|
| `swell` | `translateY(±.35rem) rotate(±.25deg)`, 7s ease-in-out infinite | menu wheel, title, loading card |
| `glint` | 1.2s linear sweep of a `#fff5` 20°-skewed band across brass; triggered on focus/hover, repeats every 9s idle on primary CTA | brass buttons, plates |
| `lamp-flicker` | opacity 1→.93→1 with randomized 80–240ms steps (JS sets `--flick`) | dialogue porthole rim light, pause screen |
| `needle` | `transition: transform .6s cubic-bezier(.34,1.56,.64,1)` (overshoot) | gauges, compass |
| `page-turn` | 3D `rotateY` 0→-160deg, 420ms, `perspective:1600px` | Ship's Log |
| `rope-drop` | `translateY(-120%)→0` with 2 damped bounces, 520ms, stagger 60ms | dialogue choice cards |
| `telegraph-swing` | `rotate` to target angle, 380ms, overshoot, then `clank` sound | settings |
| `bell-toll` | scale 1→1.06→1, 300ms, synced to bell sfx | Lost at Sea, discoveries |

All motion is disabled or reduced to 120ms opacity fades under `@media (prefers-reduced-motion: reduce)` or `[data-reduce-motion="1"]`.

### 1.6 UI sound cues (Web Audio, mixed on the `ui` bus)

| Event | Sound | Duration |
|---|---|---|
| Hover / focus move | brass tick (muted metal click) | 40ms |
| Confirm | wheel-spoke clack | 120ms |
| Back / cancel | rope creak | 200ms |
| Telegraph step | heavy clank + distant bell reply | 450ms |
| Slider wheel turn | ratcheting valve, pitch follows value | continuous |
| Open book / map | page rustle / blueprint unroll | 350ms |
| Objective added | single ship's bell | 900ms |
| Discovery | two bells | 1.2s |
| Warning (sinking tiers) | steam whistle swell, low | 2s |
| Error / invalid | dull wooden knock | 100ms |
| Photo capture | bellows camera shutter | 180ms |

---

## 2. Screens

### 2.1 Title / Main Menu

- **Background:** live Three.js scene, Titanic at anchor off Queenstown at sunset, slow camera drift, gulls. UI scrim `linear-gradient(90deg,#0B1626cc,transparent 55%)`.
- **Hero title:** `RMS TITANIC` in `--font-engrave` `--fs-hero`, `.engraved`; subtitle (parodic game title) in `--font-display` italic `--fs-lg`, `--fog-dim`.
- **Ship's wheel menu** (left-centre, 36vh diameter, 8 spokes): hub is a brass boss with the WSL star. Each spoke handle is a menu item; label on a brass tag hung from the handle. Items: `TAKE THE HELM` (Continue, hidden if no save), `NEW VOYAGE`, `LOAD VOYAGE`, `SETTINGS`, `SHIP'S MANIFEST` (Credits), `PHOTO GALLERY`, `ABANDON SHIP` (Quit; web = return to landing). Keyboard/gamepad: up/down rotates the wheel so the active spoke sits at 12 o'clock (`transform: rotate(calc(var(--spoke-index) * -45deg))`, 380ms); mouse hovers a spoke directly.
- **Footer bar:** version, build, `©` line in `--fs-xs` `--fog-dim`; glyph hints right-aligned.
- **First launch:** menu is replaced by the Welcome Aboard card (see §5.1) until dismissed.

```
+--------------------------------------------------------------+
| RMS TITANIC                                [sunset, ship]    |
|   "A Night to Remember-ish"                                  |
|        .--.                                                  |
|      / | | \      [TAKE THE HELM]                            |
|    --(  *  )--    [NEW VOYAGE]      <- brass tags on spokes  |
|      \ | | /      [SETTINGS]                                 |
|        '--'                                                  |
| v0.9.0 build 1912     (A) Select  (B) Back  [Esc] Quit       |
+--------------------------------------------------------------+
```

### 2.2 Settings

Full-screen modal: mahogany panel, brass-plate tab rail across the top (`DISPLAY · GRAPHICS · CONTROLS · AUDIO · ACCESSIBILITY · SAVES`). Left column controls, right column live preview/description plate.

**Graphics — Engine-Order Telegraph.** A `telegraph` component (§4.9), 24rem tall. Lever positions and presets:

| Position | Preset | Render scale | Shadows | SSAO | Reflections | Bloom | AA |
|---|---|---|---|---|---|---|---|
| `STOP` | Custom | user | user | user | user | user | user |
| `DEAD SLOW` | Low | 0.66 | 1024 hard | off | cube only | off | FXAA |
| `SLOW` | Medium | 0.85 | 2048 PCF | half-res | SSR low | low | FXAA |
| `HALF` | High | 1.0 | 4096 PCSS | full | SSR | on | TAA |
| `FULL AHEAD` | Ultra 4K | 1.0 @ 2160p | cascaded 4x4096 | HBAO | SSR + planar water | on | TAA + sharpen |

Moving any individual control snaps the lever to `STOP`. Brass plate beneath shows estimated frame time from a 2 s probe.

**Display:** resolution `<select>` styled as a brass drum (`1920x1080`, `2560x1440`, `3440x1440`, `3840x2160`, `Native`); `Render scale` valve 50–200% (step 5); `FOV` valve 60–110 (default 80); `V-sync` toggle; `Frame cap` drum (30/60/120/144/Unlimited); `HDR` toggle when `screen.colorDepth>24` and `matchMedia('(dynamic-range: high)')`.

**Controls:** `Pointer sensitivity` valve 0.1–5.0 (log scale), `Invert Y`, `Invert X`, `Gamepad look sensitivity`, `Deadzone`, `Toggle/hold crouch`, `Toggle/hold sprint`, rebind table (brass key caps, click to rebind, 5 s timeout).

**Audio:** Master, Music, Ambience, Effects, Dialogue, UI — six `valve` wheels (§4.6), 0–100 with brass dial readout; `Subtitles` toggle + size (S/M/L/XL) + speaker name colour toggle + background box toggle.

**Accessibility:** `Text size` 90–150%, `Reduce motion`, `Colour-blind mode` (Off / Deuteranopia / Protanopia / Tritanopia / Monochrome gauges), `High-contrast HUD`, `Hold → toggle for all holds`, `Screen shake` 0–100, `Camera sway` 0–100, `Flash reduction`, `HUD safe-area inset` 0–8%, `Crosshair size/colour`.

**Saves:** cloud/local slots as ticket stubs.

Footer: `RESTORE DEFAULTS` (bronze), `APPLY` (brass primary), `BACK`. Unapplied changes prompt a modal (`Changes not logged. Enter them?`).

### 2.3 Loading

Centre: a White Star-style boarding ticket (`ticket` component, §4.8), 44rem wide, slight `swell`. Header `WHITE STAR LINE` in burgundy band with gold star; body in `--font-doc`: `Passenger`, `Class`, `Berth`, `Sailing: 10 April 1912`. A **progress rope** runs along the bottom edge: a hemp rope (`rope` gradient) whose knot slides left→right (`--progress`); the unfilled part is a slack rope drawn 2px thinner and 40% opacity. Below: rotating lore line (`"Titanic carried 20 lifeboats, 4 of them collapsible."`). Spinner is a tiny turning ship's wheel bottom-right. Minimum display time 900ms to avoid flash; loading beyond 8 s shows the `Press any key when ready` wait so audio can unlock.

### 2.4 In-game HUD

Layer order (z): canvas 0 → HUD 10 → prompts 20 → dialogue 30 → menus 40 → toasts 50 → pointer-lock overlay 60.

| Element | Position | Spec |
|---|---|---|
| **Compass rose strip** | top-centre, 34rem x 3rem | horizontal tape with cardinal letters (`--font-engrave`), 10° ticks, brass lubber line; heading digits in `--font-doc` beneath (`047°`). Objective bearings appear as small brass pins on the tape. Tape translate = `heading * (tape-width/360)`. |
| **Ship's clock** | top-right | brass bezel 4.5rem, white dial, `--font-doc` numerals, hands rotate from game time. Title attribute `Honour and Glory Crowning Time`. Clicking (or `T`) opens Watch (§2.12). Beneath: date plate `14 APRIL 1912`. |
| **Deck plate** | top-left | brass letter plate `B DECK` / `BOAT DECK` / `ORLOP`; secondary line room name (`First Class Smoking Room`). Fades to 35% after 4s idle; restores on deck change with `glint`. |
| **Ship's Log tray** | bottom-left, max 3 entries | parchment strip with torn edge; each line `◦ Find Rose-ish on the Boat Deck` in `--font-body`; completed entries get a brass check and slide out after 2.5s. Header `SHIP'S LOG` in burgundy. |
| **Interaction prompt** | 6rem below crosshair | engraved brass plate: `[E]` key cap + verb + object (`OPEN · Cabin B-52`). Appears with 120ms fade+rise; hidden under pointer-lock loss. |
| **Crosshair** | centre | 6px dot `--fog` with `1px #000` ring (sextant-style); over interactable → expands to a rangefinder: two short brass hairlines left/right at 14px gap. Optional reticle size 50–200%. |
| **Reputation gauges** | bottom-right, two 4rem gauges | `STEERAGE` (third-class trust) and `SALOON` (first-class standing); 180° brass gauges with needle, enamelled dial (`--parchment`), red zone on left. Hover shows numeric tooltip. |
| **Inclinometer** (sinking only) | bottom-centre, 12rem x 3rem | brass tube gauge: bubble moves with list angle (±15° scale); below, a flooding bar: blue water fills a sectioned bulkhead diagram of 16 compartments (`water` icon). Appears at collision with `glint` + whistle. |
| **Subtitles** | bottom-centre above inclinometer | `--font-body` `--fs-md`, speaker name in `--brass-hi`, optional `#000a` box. |

HUD opacity master `--hud-alpha` (default .92); HUD hides entirely in Photo Mode and cutscenes.

```
[B DECK]            N . . E . . S . . W . . N          (clock)
 Smoking Room           ^ 047°                      14 APR 1912
                              .
                           [E] OPEN · Cabin B-52
 SHIP'S LOG
 ◦ Meet Jack-ish, 3rd Class                    (STEERAGE)(SALOON)
 ◦ Fetch the sketchbook              [===o======] 4° list  ~~~~
```

### 2.5 Dialogue box

Bottom third. **Porthole frame** (§4.4), 11rem diameter, left, framing the NPC's live render-target (`<canvas>` sub-view or CSS-cropped camera) — fallback: silhouette icon. NPC name on a brass plate riveted under the porthole (`CAPT. E. J. SMITHERS`). Speech text on a parchment card to the right (max 60ch, `--font-body` `--fs-md`, typewriter 28 cps, skippable on click). Choices: up to 4 **rope-hung cards** descending from the top edge of the dialogue area with `rope-drop` stagger; numbered `1–4` brass tags; hover tilts card ±2°; selected card swings up. A tiny hourglass icon shows timed choices (8 s rope burn-down). Player movement is locked (§5.4); camera does a slow dolly to the NPC.

```
  |1|   |2|   |3|           <- rope-hung choice cards
  [ ]   [ ]   [ ]
 (  O  ) [CAPT. E. J. SMITHERS]
 (porth) "Iceberg? What iceberg? Carry on, Mr Murdoch-ish."   [>]
```

### 2.6 Ship's Log / Journal

Full-screen leather book, two pages open, `perspective` 3D, bookmark ribbons (burgundy) as tabs: `OBJECTIVES · DISCOVERIES · COLLECTIBLES · PASSENGERS MET`. Left page: list (`--font-doc`), right page: detail with a sepia sketch placeholder (SVG frame) and body text. Page corners are hit targets for `page-turn`. Objectives: active (ink), completed (struck through in `--rust`), failed (burgundy stamp `OVERTAKEN BY EVENTS`). Discoveries show deck + room + timestamp. Collectibles: a 6x5 grid of brass-rimmed slots (silhouette when missing). Passengers Met: manifest rows with class ticket colour (1st gold, 2nd burgundy, 3rd sea-green). Footer stamp: `Entered this 14th day of April 1912`.

### 2.7 Deck Plan Map

Full-screen blueprint on a drafting board frame (teak). Deck tabs down the left as brass letter plates: `BOAT · A · B · C · D · E · F · G · ORLOP · TANK TOP`; current deck plate is lit (`glint`). Centre: the real deck plan for that deck as inline SVG vector (`/public/deckplans/*.svg` vendored, not raster — permitted), stroke `#CFE3F5`, compartment fills `#FFFFFF08`, watertight bulkheads thicker `#F2D27A`. Overlays:
- player marker: brass arrow with heading rotation and a soft pulse;
- objective pins: burgundy flags with number;
- discovered stairs/lifts: `stair` icon in brass; hover → tooltip `Grand Staircase — Fast travel`; click/`A` → fast travel (confirm modal with ticket stub: `Steward will escort you. Proceed?`);
- undiscovered areas hatched `#00000055` at 45°;
- during sinking: flooded compartments fill `#2A6F97aa` animating upward; list angle rotates the blueprint ±list/3°.
Controls: scroll/triggers zoom 1–4x, drag/left-stick pan, `Q/E` or bumpers switch deck, legend plate bottom-right, `M` closes. Title plate top: `RMS TITANIC — HARLAND & WOLFF — YARD No. 401 — DECK PLAN`.

### 2.8 Photo Mode

HUD hidden. Frame: a brass camera bellows seen from behind — four concertina pleats drawn with repeating gradients at the viewport edges, inner rounded-rect viewfinder with ground-glass vignette. Right rail (brass): `Aperture` (f/1.4–f/16, controls DoF), `Focus distance`, `Shutter` (motion blur), `Plate` (filters: None, Autochrome, Orthochromatic B&W, Sepia, 1997 Movie Teal), `Roll` ±15°, `FOV`, `Time of day`, `Hide player`, `Frame` (none / WSL postcard border / oval vignette), `Export 4K` (renders 3840x2160 offscreen regardless of window). Camera moves with WASD/mouse, `Space` to capture (shutter sfx, white flash 80ms honoring flash-reduction).

### 2.9 Pause

Triggered by `Esc`/`Start`. Game time freezes; scene gets `filter: saturate(.6)` via a CSS overlay on the canvas container and a lamp-flicker vignette. Centre: a brass-rimmed porthole with the frozen scene, beneath it a vertical plate menu: `RESUME · SHIP'S LOG · DECK PLAN · PHOTO MODE · SETTINGS · SAVE · ABANDON TO MENU`. Title plate `ALL STOP`. Pointer lock released; cursor visible.

### 2.10 Watch / Time control

Modal chronometer dial (16rem), brass gimbal ring, `--font-doc` numerals. Current time hand; next story beat marked on the bezel (`00:05 — Order to uncover boats`). Interaction: hold confirm to wind — the hand sweeps, world time-lapses (sky, lamps). Wind stops automatically at the next beat or when released. Disabled with a reason plate during urgent sequences (`The watch cannot be wound now.`). Minute repeater chime on arrival.

### 2.11 Death / Game over — "Lost at Sea"

Scene fades to `--navy`, cold vignette; a slowly tolling ship's bell (SVG, swings ±12°) above `LOST AT SEA` in `--font-engrave` `--fs-2xl` `--fog`. Beneath: epitaph line in italic body (`Henry-ish Dawson, 3rd Class, of Chippewa Falls. His ticket was No. 1601.`). Options as brass plates: `RETURN TO LAST LOG` (checkpoint) · `DECK PLAN` · `MAIN MENU`. No red; grief, not alarm.

### 2.12 Credits — Passenger Manifest

A paper scroll unrolling upward (clip-path reveal), `--font-doc`, three columns `NAME · CLASS · ROLE`. Section headers as burgundy ticket bands (`OFFICERS` = leads, `ENGINEERING` = programming, `VICTUALLING` = art, `BAND` = music, `PASSENGERS` = thanks). Ends with the WSL star and a dedication line to the 1,500 lost. Scroll speed adjustable with stick/wheel; `Esc` skips.

---

## 3. Layout, scale, safe areas, glyphs, accessibility

### 3.1 Scale model

```css
html{font-size:calc(16px * var(--ui-scale,1))}
:root{--ui-scale:1;--ui-user:1;--safe:3vmin}
```
JS sets `--ui-scale` on resize: `scale = clamp(0.75, min(innerHeight/1080, innerWidth/1920), 2.4) * --ui-user * devicePixelRatio^0` (DPR is intentionally ignored; the canvas handles DPR). Results: 1080p → 1.0, 1440p → 1.333, 2160p → 2.0, 1080p ultrawide → 1.0. CSS fallback if JS is late: `font-size: clamp(12px, 0.8333vw, 40px)`.

Everything else is `rem`. Hairlines use `max(1px, .0625rem)`. Blur radii in `rem`. Canvas size = window size x render scale.

### 3.2 Grid and spacing

- 12-column fluid grid on menus: `grid-template-columns: repeat(12, minmax(0,1fr))`, gap `1.5rem`, max content width `96rem` centred.
- Spacing scale: `--s1:.25rem --s2:.5rem --s3:.75rem --s4:1rem --s6:1.5rem --s8:2rem --s12:3rem --s16:4rem`.
- Radii: `--r-plate:.375rem --r-card:.75rem --r-port:50%`.
- Elevation: `--sh-1: 0 1px 2px #0008; --sh-2: 0 .25rem .75rem #000a; --sh-3: 0 1rem 2.5rem #000c`.
- Minimum hit target `2.75rem` (44px at 1080p, 88px at 4K).

### 3.3 Safe areas

HUD root: `inset: calc(var(--safe) + env(safe-area-inset-top)) …`. `--safe` user-adjustable 0–8vmin (Settings → Accessibility). Ultrawide (>2.1:1): HUD anchors to a centred 16:9 box of width `min(100vw, 177.8vh)`; background art bleeds. Portrait/narrow (<1.2:1, tablets): HUD condenses; compass collapses to heading digits only; log tray hides until objective change.

### 3.4 Glyphs

- **Keyboard key cap** `.kbd`: brass square, `min-width:1.75rem; height:1.75rem; padding:0 .4rem; border-radius:.3rem; background:var(--grad-brass); color:#3F2E12; font:600 .8rem var(--font-engrave); box-shadow: inset 0 1px 0 #fff8, 0 2px 0 var(--brass-lo), 0 3px 4px #0008`. Pressed: `translateY(2px)`, drop shadow collapses. Long names: `SPACE`, `SHIFT`, `ESC`, `↑`.
- **Gamepad glyphs:** sprite `#gp-*` for `a b x y lb rb lt rt ls rs dpad start select`. Platform skin by `html[data-pad="xbox|ps|generic"]` (set from `Gamepad.id`): Xbox = coloured letter discs on bronze; PS = shapes in brass; generic = numbered brass buttons. Detect via `gamepadconnected`; last-used device (`pointermove/keydown` vs `gamepad` poll) switches the shown hint set with a 200ms fade.
- Hint bars always read `[glyph] VERB` in `--font-engrave` `--fs-xs`, `--fog-dim`.

### 3.5 Accessibility

- Text contrast AA minimum (4.5:1) everywhere; AAA for body on parchment/navy (achieved).
- `Text size` 90–150% scales `--ui-user` for text-bearing components only (HUD gauge geometry stays).
- `Reduce motion`: kills swell, glint, lamp flicker, page-turn, rope-drop, needle overshoot (linear 150ms), camera sway in menus.
- `Colour-blind`: gauges swap red/green zones for blue `#3D7BD9` / orange `#E07B22` plus hatch patterns; flood fill gets diagonal stripes; objective pins get numbers.
- `High-contrast HUD`: every HUD text gets `#000c` plate; crosshair gets a white/black double ring.
- All menus fully keyboard/gamepad navigable; `:focus-visible` = `outline: .2rem solid var(--brass-hi); outline-offset:.2rem` plus glint.
- Screen-reader: overlay uses semantic `<button>`, `<nav>`, `role="dialog" aria-modal`, `aria-live="polite"` on log tray, `aria-live="assertive"` on sinking tier changes. Decorative ornaments `aria-hidden`.
- Hold-to-confirm actions have a toggle alternative. Timed dialogue can be set to untimed.
- Subtitles: size S–XL, speaker colours, box, 42ch max per line, 2 lines.

---

## 4. Component library

Conventions: BEM-ish class names, states as `data-*` or `aria-*`, tokens on `:root`. Every component ships as a `<template id="tpl-…">` in `index.html` and a `ui/components/*.js` factory `make(props) → HTMLElement`.

### 4.1 Brass Plate `.plate`
```html
<div class="plate plate--rivets" data-tone="brass|bronze|rust"><span class="engraved">B DECK</span></div>
```
States: `data-lit` (glint running), `data-dim` (opacity .35), `[aria-disabled]` (desaturated). Tokens: `--plate-bg`, `--plate-edge`, `--plate-ink`, `--plate-pad: .4rem .9rem`.
```
 o------------o
 |  B  D E C K |
 o------------o
```

### 4.2 Brass Button `.btn`
```html
<button class="btn btn--primary"><svg class="ico"><use href="#ico-wheel"/></svg><span>Take the Helm</span><kbd class="kbd">A</kbd></button>
```
Variants: `--primary` (brass), `--secondary` (bronze), `--danger` (rust), `--ghost` (engraved outline). States: hover (brightness 1.08 + glint), active (`translateY(1px)`, inset shadow), focus-visible (outline), disabled (`filter:grayscale(.8) opacity(.5)`), loading (tiny wheel spinner). Height `3rem`, padding `0 1.5rem`, `--font-engrave` `--fs-sm`.
```
 [ (o) TAKE THE HELM   A ]
```

### 4.3 Rope Frame `.rope`
```html
<section class="rope rope--tarred?">…</section>
```
Pure border-image; `--rope-w:.5rem`. Used around dialogue area, loading ticket, toasts. No states.

### 4.4 Porthole `.porthole`
```html
<figure class="porthole" style="--d:11rem"><div class="porthole__glass"><canvas></canvas></div><figcaption class="plate">CAPT. SMITHERS</figcaption></figure>
```
Rings: outer brass, inner bronze, 6 bolts via `background` radial dots on a rotated pseudo-element. Glass gets `inset` shadow + diagonal reflection stripe (`#ffffff14`). States: `data-open` (glass clear), `data-fogged` (blur 3px, used for unknown NPC). Token `--d` diameter.
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
Wheel = 3rem brass ring with 6 spokes (conic-gradient), `transform: rotate(calc(var(--v) * 1080deg))`. Drag (pointer, horizontal or circular), wheel (±1), arrows (±1, shift ±10), gamepad stick (rate-based). Readout on an enamel dial. Behaviour: pitch of ratchet sfx tracks `--v`. States: dragging (`data-active`, glint), disabled. Tokens `--valve-size`, `--valve-track`.
```
   (-|-)  [ 70 ]  Music
```

### 4.7 Gauge `.gauge`
```html
<div class="gauge" role="meter" aria-valuenow="62" aria-label="Saloon standing" style="--v:.62"><svg viewBox="0 0 100 60"><!-- arc, ticks, zones --></svg><div class="gauge__needle"></div><span class="plate plate--sm">SALOON</span></div>
```
180° arc; needle `rotate(calc(-90deg + var(--v) * 180deg))` with `needle` easing. Zones drawn as SVG arcs (`--zone-lo` rust, `--zone-hi` ok; swapped/hatched in CB mode). Sizes `--g:4rem|6rem|10rem`. State `data-trend="up|down"` shows a tiny arrow for 2 s after change.
```
    .-'''-.
   /  |    \
  | --o--   |
   SALOON
```

### 4.8 Ticket Card `.ticket`
```html
<article class="ticket"><header class="ticket__band">WHITE STAR LINE <svg class="ico"><use href="#ico-star-wsl"/></svg></header><dl class="ticket__body">…</dl><footer class="ticket__stub">No. 1601</footer></article>
```
Parchment gradient, perforated stub (`border-left: .2rem dotted var(--parchment-lo)`), rounded-notch corners via `mask: radial-gradient(...)`. Variants `--loading` (adds `.progress-rope`), `--save` (slot), `--confirm`. States: `data-selected` (burgundy stamp), `data-empty` (faded).
```
 |====== WHITE STAR LINE  * ======|
 | Passenger  Jack-ish Dawson     |
 | Class      Third     Berth E-? |
 | ~~~~~~~~~~o~~~~~~~  (rope)     |
```

### 4.9 Engine-Order Telegraph `.telegraph`
```html
<div class="telegraph" role="radiogroup" aria-label="Graphics quality" data-pos="HALF"><div class="telegraph__face"><!-- SVG dial, 5 sectors --></div><div class="telegraph__lever"></div><div class="telegraph__labels"><button role="radio" data-pos="DEAD SLOW">DEAD SLOW</button>…</div></div>
```
Face: bronze disc 16rem, sectors `STOP / DEAD SLOW / SLOW / HALF / FULL AHEAD` with engraved text along arcs (SVG `textPath`), red `STOP` sector. Lever: brass bar + black knob, `rotate(var(--angle))` from −80° to 80°, `telegraph-swing` motion, clank sfx. Clicking a sector or using left/right moves one step. Readout plate shows preset name + est. ms/frame. Tokens `--tg-size`, `--tg-angle`.
```
       FULL AHEAD
   HALF  \ | /  (STOP)
 SLOW  ---(o)---
  DEAD SLOW |
          ===knob
```

### 4.10 Deck Tabs `.decktabs`
```html
<nav class="decktabs" role="tablist" aria-orientation="vertical"><button role="tab" aria-selected="true" class="plate">BOAT</button><button role="tab" class="plate">A</button>…</nav>
```
Vertical stack, selected plate lit + 2px brass connector line to the blueprint; locked decks (not yet visited) show a keyhole icon and 50% opacity. Keyboard up/down, bumpers.

### 4.11 Compass Strip `.compass`
```html
<div class="compass" aria-label="Heading 047"><div class="compass__tape" style="--hdg:47"></div><div class="compass__lubber"></div><output>047°</output></div>
```
Tape is a 1080°-wide (3 repeats) flex of tick marks and letters, `translateX(calc(var(--hdg) * -1 * var(--px-per-deg)))`; wraps seamlessly. Pins injected as absolutely positioned children with `--bearing`. Masked ends (`mask: linear-gradient(90deg,transparent,#000 15%,#000 85%,transparent)`).

### 4.12 Inclinometer `.incline`
```html
<div class="incline" role="meter" aria-label="List 4 degrees to starboard" style="--list:4"><div class="incline__tube"><div class="incline__bubble"></div></div><div class="incline__flood"><!-- 16 compartments --></div></div>
```
Bubble `translateX(calc(var(--list) * var(--px-per-deg-incl)))`, clamp ±15. Compartments `data-flood="0..1"` fill via `background: linear-gradient(0deg, #2A6F97 var(--f), transparent var(--f))`. States `data-tier="0..4"` drive colour (`--warn` from tier 2, `--danger` tier 3+, pulsing border tier 4).

### 4.13 Modal `.modal`
```html
<dialog class="modal modal--log|--port|--board"><div class="modal__frame">…</div></dialog>
```
Native `<dialog>` + `showModal()`; backdrop `--scrim` + 2px blur. Frames: `--log` leather book, `--port` porthole, `--board` teak drafting board. Focus trapped by `<dialog>`; `Esc` closes unless `data-locked`. Open/close: scale .97→1 + fade 180ms.

### 4.14 Toast `.toast`
Top-right stack, max 3, parchment card with rope edge and bell icon; `aria-live`. Kinds: `objective` (one bell), `discovery` (two bells), `warning` (rust plate, whistle). Auto-dismiss 4 s; hover pauses.

### 4.15 Tooltip `.tip`
Engraved brass tag with a tiny ring at top (hung look), `--fs-xs`, 300 ms delay, follows focus too. Positioned via `anchor` fallback JS.

### 4.16 Progress Rope `.progress-rope`
`<div class="progress-rope" role="progressbar" aria-valuenow="42" style="--p:.42">` — slack rope full width, taut rope `width: calc(var(--p)*100%)`, knot `::after` at the join. Indeterminate: knot oscillates.

### 4.17 Manifest Rows `.manifest`
`<table>` in `--font-doc`, zebra `#00000008`, class dot (gold/burgundy/sea-green), row hover lifts `1px`. Used in Passengers Met and Credits.

### 4.18 Pointer-lock overlay `.helm`
Full-screen scrim with a centred ship's wheel (idle slow spin) and `CLICK TO TAKE THE HELM` plate; sub-line `Esc releases the wheel`. See §5.3.

---

## 5. UX flows

### 5.1 First launch → menu → new game → prologue → gameplay

1. **Boot:** `index.html` paints the title scrim and a static wheel instantly (critical CSS inline); fonts preload; Three.js init in a worker where available. If WebGL2 missing → `ticket--confirm` "This vessel requires WebGL2" with a link.
2. **Capability probe (first launch only):** 2 s hidden render at 1080p of a representative interior; measure frame time; pick telegraph default (`<8ms` → FULL AHEAD when screen ≥2160p else HALF; `8–14` → HALF; `14–22` → SLOW; else DEAD SLOW). Store in `localStorage.titanic.settings`.
3. **Welcome Aboard card:** ticket with language `<select>`, input device auto-detected, `Text size` and `Reduce motion` quick toggles, the chosen telegraph position displayed with "You may change speed in Settings". `BOARD` confirms → unlocks AudioContext on this click → menu.
4. **Menu:** wheel. `NEW VOYAGE` → name entry on a ticket (`Passenger` field, 24 chars, parodic default `Jack-ish Dawson`), `Class` choice = difficulty (`Third` normal, `Second` relaxed, `First` story mode with timers off) explained on the plate, `Berth` auto-assigned by class; `BOARD` → Loading.
5. **Loading** (§2.3) → **Prologue** (Southampton departure cutscene). Any key shows `HOLD [SPACE] TO SKIP` with a rope that frays over 1.2 s; release before end cancels. Skipping lands at the gangway with the first objective toast.
6. **Gameplay:** HUD fades in over 600 ms element-by-element (deck plate, compass, log, clock). Pointer-lock overlay appears immediately (§5.3). First interaction prompt teaches `[E]`; first Esc teaches the Pause screen.

### 5.2 Save/Continue
Autosave on deck change and objective completion (toast `Entered in the log`, small book icon bottom-left, 1.5 s). `TAKE THE HELM` resumes latest slot; `LOAD VOYAGE` shows ticket stubs with thumbnail (captured via canvas `toDataURL` 320x180), deck, time, playtime.

### 5.3 Pointer lock — "Click to take the helm"
- State machine: `UNLOCKED → REQUESTING → LOCKED → (ESC) UNLOCKED`.
- Any time gameplay is active and `document.pointerLockElement !== canvas`, show `.helm` overlay (z 60). Click/`Enter`/gamepad `A` → `canvas.requestPointerLock({unadjustedMovement:true})` (feature-detect; fall back to plain). Gamepad-only users never need lock: overlay reads `PRESS [A] TO TAKE THE HELM` and sets `data-input="pad"`.
- `pointerlockchange` to locked → hide overlay, resume movement input, HUD alpha 1.
- `pointerlockchange` to unlocked without our request (user hit Esc, tabbed out, browser revoked) → **open Pause** (§2.9) rather than the bare helm overlay, because Esc already means pause to the player. Browsers enforce a ~1 s cooldown before re-lock after Esc; `RESUME` therefore shows `Take the helm…` with a brief wheel spin and requests lock only on the next user click (gesture required). The overlay explains this in one line.
- `pointerlockerror` → toast `The wheel slipped — click again`; after 3 errors, offer `Play without pointer lock` (cursor-relative look with edge clamp).
- `visibilitychange` hidden → pause automatically, release lock. Pause menu never requires lock.
- Mouse input is read from `movementX/Y` only while LOCKED; sensitivity applied in gameplay layer, not UI.

### 5.4 Pause and dialogue vs movement — input stack
A single `InputRouter` holds a stack of contexts: `gameplay` (default) → `dialogue` → `menu` → `modal`. Only the top context receives input; movement intents are zeroed when `gameplay` is not on top, and the physics controller receives a `hold` flag so velocity decays over 150 ms rather than snapping.
- **Esc:** top is `gameplay` → push `menu` (Pause), freeze world clock, release lock. Top is any menu/modal → pop (back). Top is `dialogue` → opens Pause *over* dialogue (dialogue state is preserved).
- **Dialogue:** push `dialogue`; world time continues (ambient NPCs move) unless the beat is flagged `urgent=false` and the player enabled `Pause world during conversation` (default on in First Class/story mode). Camera dollies to NPC; crosshair hidden; prompt hidden; HUD compass/clock remain at 50% alpha; subtitles reuse the speech card. Leaving dialogue pops and restores lock without a click if the lock was never lost (pointer lock persists through dialogue because we never exit it; mouse movement is simply ignored while `dialogue` is on top — this avoids the re-lock gesture).
- **Map/Log/Photo:** push `modal`, release lock only if the modal needs a cursor (Map, Settings); Log and Watch are stick/key driven and keep the lock, with a `[Esc] close` hint.

### 5.5 Sinking HUD escalation
Trigger: collision beat at 23:40 ship's time. Tiers advance on scripted beats and live list/flood values; the HUD never jumps more than one tier at once.

| Tier | Time (approx) | List / flood | HUD changes |
|---|---|---|---|
| 0 | before 23:40 | 0° | normal |
| 1 | 23:40–00:05 | 0–2°, 5 compartments | Inclinometer fades in with whistle; deck plate gains `--rust` edge; objective toast on bell; compass gains a `LIFEBOATS` pin. |
| 2 | 00:05–01:00 | 2–6° | Clock dial tints faintly amber; log tray entries prefixed `URGENT` in burgundy; ambient UI swell doubles amplitude (unless reduce-motion); flooding bar visible under inclinometer. |
| 3 | 01:00–02:05 | 6–12° | Whole HUD layer rotates by `list/4°` (max 3°) via `transform` on `#hud` to sell the tilt; gauges in `--danger` zone; low whistle loop; interaction prompts switch to short imperatives (`CLIMB`, `BRACE`). Watch disabled with reason. |
| 4 | 02:05–02:20 (break-up/plunge) | >12° | Compass and clock drop out (electric failure beat: HUD flickers, `lamp-flicker` at 3x then dark at 02:18 — HUD becomes monochrome moonlight `#C7D3E6` outlines, high-contrast variant forced); inclinometer bubble pinned; subtitles get solid box. |
| End | water | — | HUD submerges: a `#0F3B3A` rising fill over the HUD layer, muffled audio bus, then Lost at Sea or the epilogue. |

Accessibility caps: `Screen shake` and `Camera sway` settings scale the HUD rotation and flicker; `Flash reduction` replaces flicker with a steady dim; colour-blind mode swaps `--danger` for `#E07B22` and adds hatching.

---

## 6. File layout and implementation notes

```
/public/fonts/            Cinzel, PlayfairDisplay, CormorantGaramond, OldStandardTT (.woff2 + OFL.txt)
/public/deckplans/        boat.svg a.svg b.svg c.svg d.svg e.svg f.svg g.svg orlop.svg tanktop.svg
/src/ui/tokens.css        all custom properties (§1, §3)
/src/ui/base.css          reset, html font-size, focus, reduced motion
/src/ui/components/*.css  one file per component (§4)
/src/ui/components/*.js   factories + behaviours (valve drag, telegraph, compass tape)
/src/ui/screens/*.js      menu, settings, loading, hud, dialogue, log, map, photo, pause, watch, lost, credits
/src/ui/input-router.js   context stack (§5.4)
/src/ui/pointer-lock.js   helm overlay state machine (§5.3)
/src/ui/sfx.js            UI sound bus, sprite sheet (§1.6)
/index.html               critical CSS inline, SVG icon sprite, <template>s, #sea canvas, #ui root
```

- UI reads game state from a single `store` (plain object + `EventTarget`); components subscribe to named events (`heading`, `deck`, `time`, `list`, `flood`, `objectives`, `rep`). No polling except the 60 Hz compass/gauge rAF, which only touches `style.setProperty` on changed values.
- All animated HUD values are CSS variables so the browser compositor does the work; avoid layout thrash by never reading DOM geometry in rAF.
- Fonts: `font-display: swap` plus a `.fonts-ready` class to avoid brass labels reflowing mid-glint.
- Test matrix: Chrome/Edge/Firefox/Safari 17+, 1080p/1440p/4K at 100% and 150% OS scaling, keyboard+mouse, Xbox and DualSense pads, reduce-motion on, each colour-blind mode, screen reader pass on menus.
