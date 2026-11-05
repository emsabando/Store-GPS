# ARCHITECTURE — "A Night to Remember Forever" (RMS Titanic free-roam)

This is the binding contract between the modules of the game. Many engineers work on
disjoint files in parallel; **everything that crosses a module boundary is specified here**.
If you need something that is not here, add it to *your own* module's exports and document
it at the bottom of this file under "Extensions" — never change another module's signature.

## 0. Stack and conventions

* Vite 8, plain ES modules (JavaScript, no TypeScript, no framework). JSDoc types are welcome.
* `three@0.187.0` — import core from `'three'`, addons from `'three/addons/...'`
  (e.g. `three/addons/objects/Sky.js`, `three/addons/objects/Water.js`,
  `three/addons/utils/BufferGeometryUtils.js`, `three/addons/math/SimplexNoise.js`).
* Post-processing: `postprocessing@6.39.6` (pmndrs) + `n8ao@2.0.1` (`N8AOPostPass`).
* Collision: `three-mesh-bvh@0.9.18`.
* Units: **metres**, seconds, radians in code (degrees only in data files where noted).
* Up axis is **+y**. Lighting is physically based (`renderer.useLegacyLights = false` is the
  default in r187): lights in candela/lux-ish magnitudes, tone mapping handles the range.
* Materials: never `new MeshStandardMaterial` ad hoc for ship surfaces — use
  `materials.get('<name>')` (section 4) so the whole ship shares a palette and texture memory.
* Geometry: merge static geometry where sensible (`BufferGeometryUtils.mergeGeometries`) and
  use `InstancedMesh` for repeated items (rivets, balusters, portholes, chairs, windows).
  Target: the entire ship < 2,500 draw calls at Ultra, < 900 at Low (use `ctx.quality`).
* Every Mesh that the player can stand on or bump into sets `mesh.userData.collide = true`.
  Collision geometry may be a simplified invisible box (`mesh.visible = false` is fine; the
  collision builder ignores visibility). Keep collision triangles coarse.
* Every object the player can interact with sets `obj.userData.interactable = { id, type, label, data }`
  on the *Mesh* that will be hit by the raycast (types: `'npc' | 'door' | 'plaque' | 'item' | 'stairs' | 'sit' | 'use'`).
* Builders never touch the DOM. UI never touches three objects directly; everything crosses
  via the event bus (section 8) or the read-only `GameState` snapshot.
* No external network at runtime. Fonts and textures are vendored under `public/`.
* Code style: 2-space indent, semicolons, single quotes, named exports. Files < ~900 lines;
  split into siblings in your own folder if you need more.
* Verify your module compiles with: `npm run check` (esbuild bundle of `src/main.js` to a
  throw-away file) — it does **not** write into `dist/`, so it is safe to run concurrently.

## 1. Coordinate frames

**Ship-local frame** (used by `src/data/shipSpec.js` and every ship builder):
origin amidships (midpoint of LBP) at the design waterline; **+x toward the bow**, **+y up**,
**+z to starboard** (port is −z). LOA ≈ 269.1 m so the stem is near x ≈ +134 and the stern
near x ≈ −135. Design waterline y = 0; the keel is near y ≈ −10.5; the Boat Deck is near y ≈ +19.
`SHIP.decks[i].y` gives each deck's floor height in this frame.

**World frame**: the ocean surface is the plane y = 0. The `Ship.group` sits at the world
origin with identity rotation until the sinking starts; `SinkingDirector` then rotates and
translates `Ship.group` (and, after the break-up, `Ship.bowGroup` / `Ship.sternGroup`).
Trim (bow-down, positive degrees in data) → `group.rotation.z = -trimRad`.
List (to port, positive degrees in data) → `group.rotation.x = -listRad`.

The player lives in **world** space; `PlayerController` converts into ship-local space every
frame to run collision against the static ship BVH, then converts back. Nothing else needs
to care about the moving ship.

## 2. Data modules (`src/data/`)

* `shipSpec.js` — `export const SHIP = {...}` (see the research spec: dims, hull stations,
  decks[] with deckhouses/rooms/corridors/stairs, funnels, masts, lifeboats, bulkheads,
  machinery, cargo, materials palette, lighting, sinkingTimeline[], filmScenes[]).
  Deck ids: `'boat' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'orlop' | 'tankTop'`.
  Rooms: `{ id, name, class, x0, x1, z0, z1, ceiling, style, materials, colours, furniture, lighting, features, movieScenes }`.
* `characters.js` — `export const CHARACTERS = { [id]: Character }`
  ```js
  Character = {
    id, name, parodyOf,            // parodyOf = role description, never a real actor name
    role, faction: 'first'|'second'|'third'|'crew'|'officer'|'band'|'modern',
    look: { sex:'m'|'f', skin:'#hex', hair:{ color:'#hex', style:'short'|'bun'|'long'|'bald'|'moustache' },
            hat:'none'|'tophat'|'bowler'|'flatcap'|'officer'|'bonnet'|'wide'|'straw',
            top:{ color:'#hex', kind:'tailcoat'|'suit'|'jacket'|'waistcoat'|'shirt'|'uniform'|'gown'|'dress'|'blouse' },
            bottom:{ color:'#hex', kind:'trousers'|'skirt'|'gown' }, accent:'#hex', height:1.75 },
    personality, dialogueStyle,
    locations: { watch1:'locationId', watch2:'locationId', watch3:'locationId', watch4:'locationId' },
    behaviour: 'stand'|'wander'|'sit'|'patrol'|'play'|'work',
    greeting: ['line', ...], idle: ['line', ...],   // original text, max 140 chars
  }
  ```
* `story.js` — `export const STORY = { watches: [Watch] }`, `export const LOCATIONS = { [id]: { name, deck, x, y, z, yaw } }`
  (ship-local metres; yaw radians, 0 = facing +x/bow, positive = turning toward port),
  `export const DISCOVERIES = [{ id, name, deck, x, y, z, plaque }]`,
  `export const COLLECTIBLES = [{ id, kind:'menu'|'postcard'|'ticket', name, deck, x, y, z, text }]`.
  ```js
  Watch = { id:'watch1', title, date:'1912-04-10', startTime:'12:00', beats:[Beat] }
  Beat  = { id, title, objective, locationId|null,
            trigger: { type:'talk', npcId } | { type:'reach', locationId, radius } | { type:'time', at:'HH:MM' } | { type:'flag', flag } | { type:'dialogueEnd', dialogueId },
            onStart:[Action], onComplete:[Action], dialogueId|null, next: beatId|null, optional:false }
  Action = { type:'setFlag', flag } | { type:'spawn', npcId, locationId } | { type:'moveNpc', npcId, locationId }
         | { type:'setTime', time:'HH:MM' } | { type:'startSinking' } | { type:'sound', id }
         | { type:'reputation', faction:'first'|'third', delta } | { type:'give', item } | { type:'discover', id }
         | { type:'cutscene', id } | { type:'dialogue', dialogueId } | { type:'teleport', locationId } | { type:'fade', seconds }
  ```
* `dialogue.js` — `export const DIALOGUES = { [id]: { npcId, start:'nodeId', nodes: { [nodeId]: Node } } }`
  ```js
  Node = { speaker:'npcId'|'player'|'narrator', text, choices?: [{ text, next:nodeId|null, effects?: [Action] }], next?: nodeId|null, effects?: [Action] }
  ```

## 3. Core (`src/core/`)

* `Events.js` — `export const bus` with `on(type, fn) → off`, `off(type, fn)`, `once`, `emit(type, payload)`.
* `Settings.js` — `export const settings` with `get(key)`, `set(key, value)`, `onChange(fn)`, `all()`;
  keys: `quality ('low'|'medium'|'high'|'ultra')`, `resolution ('native'|'4k'|'1440p'|'1080p')`,
  `renderScale (0.5–2)`, `fov (60–110)`, `sensitivity (0.2–3)`, `invertY`, `volumeMaster/volumeMusic/volumeSfx/volumeAmbience (0–1)`,
  `subtitles`, `reduceMotion`, `colourBlind ('none'|'deuteranopia'|'protanopia'|'tritanopia')`, `uiScale (0.8–1.6)`, `viewMode ('first'|'third')`.
* `Input.js` — `export const input` with `keys` (Set of codes), `isDown(code)`, `pressed(code)` (edge, cleared per frame),
  `mouse { dx, dy, buttons }`, `requestPointerLock()`, `exitPointerLock()`, `locked`, `onKey(fn)`, `beginFrame()`, `endFrame()`,
  gamepad axes `axes { lx, ly, rx, ry }`. Emits `input:escape`, `input:pointerlockchange {locked}`.
* `Engine.js` — `export class Engine`
  ```js
  const engine = new Engine({ canvas, settings });   // creates renderer, scene, camera, composer
  engine.renderer, engine.scene, engine.camera, engine.composer
  engine.setQuality('ultra'); engine.setResolution('4k', 1.0);  // internal render size, letterboxed/scaled to window
  engine.onUpdate(fn /* (dt, elapsed) */) → unsubscribe; engine.start(); engine.stop();
  engine.setEnvironment(texture);           // PMREM env for PBR
  engine.setPostEnabled({ ao, bloom, smaa, vignette, godrays? });
  engine.setExposure(x); engine.setFog(color, density);
  await engine.screenshot() → Blob (PNG of the composed frame)
  engine.stats → { drawCalls, triangles, fps, frameMs, width, height }
  ```
  Quality presets (Engine owns the table; others read `engine.quality`):
  | preset | shadows | AO | bloom | aniso | pixel ratio cap | draw distance |
  | low | 1024 PCF | off | off | 2 | 1 | 600 m |
  | medium | 2048 PCFSoft | off | on | 4 | 1.5 | 1200 m |
  | high | 4096 PCFSoft | N8AO half-res | on | 8 | 2 | 2500 m |
  | ultra | 4096 PCFSoft + CSM-like 2 cascades if available | N8AO full-res | on | 16 | native/4K | 6000 m |
  Tone mapping: `AgXToneMapping` (fallback ACES), output `SRGBColorSpace`.
  Resolution `'4k'` means the internal render target is 3840×2160 regardless of the window,
  drawn to the canvas with CSS scaling (object-fit: contain). `'native'` uses the window size × renderScale.

## 4. Materials (`src/materials/`)

* `ProceduralTextures.js` — canvas generators, each returns `{ map, normalMap, roughnessMap, aoMap? }` as
  `CanvasTexture`s with `colorSpace` set (map SRGB, others NoColorSpace), wrap Repeat, anisotropy from quality:
  `makePlanks({ widthM, lengthM, plankW, plankL, color, gapColor, grain, variation, caulk })`,
  `makeRivetedPlates({ plateW, plateH, rivetPitch, color, rivetColor, seam })`,
  `makeTiles({ tileW, pattern:'checker'|'diamond'|'mosaic'|'moorish', colours:[...], grout })`,
  `makeCarpet({ color, pattern:'floral'|'plain'|'border', accent })`, `makePanel({ wood:'oak'|'mahogany'|'walnut'|'pine', color, mouldings })`,
  `makeBrushedMetal({ color })`, `makePaint({ color, wear })`, `makeCanvas({ color })`, `makeNameplate({ text, color, font })`,
  `normalFromHeight(canvas, strength)`, `makeNoise(size, octaves)`.
* `MaterialLibrary.js` — `export class MaterialLibrary` with `static async load({ quality, onProgress })` →
  instance; `get(name)` returns a shared `MeshStandardMaterial`/`MeshPhysicalMaterial`;
  `clone(name, overrides)`; `setQuality(q)`. If `public/textures/manifest.json` exists it loads the vendored
  CC0 textures (`{ [name]: { color, normal, roughness, ao?, metalness?, sizeM:[w,h] } }`) and falls back to procedural ones.
  **Required names** (every builder may rely on them): `teakDeck, pineDeck, oakPanel, oakDark, mahogany, walnut, sycamore,
  whiteEnamel, whitePaintedSteel, hullBlack, hullBlackRiveted, antifouling, boottop, sheerStripe, funnelBuff, funnelBlack,
  brass, bronze, wroughtIron, ironDark, steelGrey, steelRusty, linoDining, linoCorridor, carpetRed, carpetBlue, carpetGreen,
  roseCarpet, moorishTile, marbleWhite, plasterWhite, plasterCream, canvas, canvasCover, glass, glassFrosted, glassStained,
  lifeboatWhite, rope, velvetGreen, velvetRed, leatherDark, leatherGreen, wicker, coal, boilerIron, copper, gold, ice, snow,
  woodCrate, carRed, skin, hairDark, hairLight, clothBlack, clothWhite, clothNavy, clothGrey, clothBrown, clothCream, clothBurgundy, clothBlue, clothGreen`.

## 5. Ship builders (`src/ship/`)

Every builder has the same signature and returns the same shape:
```js
export function buildX(spec /* SHIP */, materials /* MaterialLibrary */, ctx) → BuildResult
ctx = { quality:'low'|'medium'|'high'|'ultra', deckY(deckId) → number, deck(deckId) → deckObj,
        room(roomId) → roomObj|null, log(msg) }
BuildResult = { group: THREE.Group /* ship-local */, locations: [{ id, name, deck, x, y, z, yaw }],
                lights: THREE.Light[] /* interior/exterior lamps; Ship controls power */,
                dynamic: [{ object, kind:'deckchair'|'crate'|'barrel'|'boat'|'piano'|'misc', mass }],
                interactables: [{ id, type, label, object, data }],
                funnels?: [THREE.Object3D] /* Superstructure only, index 0 = funnel No.1 */,
                lifeboats?: [{ id, object, davit, side, x }] /* Superstructure only */,
                floodRooms?: [{ deck, x0, x1, z0, z1 }] /* for interior water planes */ }
```
Positions in `group` are ship-local. Lights: use `PointLight`/`SpotLight` sparingly (≤ 120 total
at Ultra; mark cheap decorative emissive bulbs with `userData.emissiveLamp = true` so Ship can dim them).
Mark every walkable/solid mesh `userData.collide = true`. Mark hull/superstructure/deck parts with
`userData.part = { x0, x1 }` (ship-local x range they occupy) so the break-up can assign them to bow or stern.

Builders and owners:
* `Hull.js` → `buildHull` — lofted hull from `SHIP.hull.stations`, plating/rivets, paint bands, sheer stripe,
  portholes (instanced, with glass + emissive at night), nameplates, keel, bilge keels, propellers, rudder, anchors,
  hawse pipes, the counter stern, the stem. Also returns the **hull interior shell** (inside-facing walls per deck) so
  interiors have outer walls. Provide `export function hullHalfBreadth(spec, x, y)` for others to query the hull side.
* `Decks.js` → `buildDecks` — every deck plate (teak/pine planked outdoor, painted steel indoor) with openings for
  stair wells, hatches, the Grand Staircase, funnel casings, engine casings; well decks, forecastle, poop deck;
  bulwarks and railings along deck edges; deckhouse walls with windows per `deck.deckhouses[]`; the A-deck
  promenade screens; B-deck windows; expansion joints; deck-house roofs; breakwater on the forecastle.
* `Superstructure.js` → `buildSuperstructure` — 4 funnels (elliptical, raked, black tops, steam pipes, guy wires, whistles),
  2 masts with rigging and crow's nest, Marconi aerial, 20 lifeboats on Welin davits with falls and covers,
  cranes (electric), windlass, capstans, bollards, ventilators, skylights, the Grand Staircase domes (exterior),
  the bridge (wings, wheelhouse, telegraphs, wheel, binnacle), the docking bridge, benches, deck chairs (dynamic),
  lamps on deckhouses, the compass platform between funnels 2 and 3. Returns `funnels` and `lifeboats`.
* `interiors/GrandStaircase.js` → `buildGrandStaircases` — forward (Boat→E) and aft (A→C) staircases: curved oak
  balustrades with wrought-iron/gilt panels, landings, the clock panel "Honour and Glory Crowning Time", the bronze
  cherub lamp, oak panelling, the glass & iron dome with lights, the lifts (3 forward), linoleum landings.
* `interiors/PublicRoomsA.js` → `buildPublicRoomsA` — Lounge, Smoking Room, Reading & Writing Room, Verandah Cafés,
  Café Parisien, À la Carte Restaurant + Reception, Gymnasium, Second-class Library and Smoking Room.
* `interiors/PublicRoomsB.js` → `buildPublicRoomsB` — First-class Reception Room and Dining Saloon (D deck),
  Second-class Dining Saloon, Third-class General Room, Third-class Smoking Room, Third-class Dining Saloons,
  Swimming Bath, Turkish Baths, Squash Court, Kennels, Barber shop, Purser's/Enquiry office, Hospital.
* `interiors/Cabins.js` → `buildCabinsAndCorridors` — the parlour suites (B-52/54/56 "the fiancé's suite" with its
  private promenade; B-51/53/55), a representative set of first-class staterooms (several period styles), second-class
  and third-class cabins (bunks), all corridors per `deck.corridors[]` incl. Scotland Road, doors (interactable,
  openable), the third-class gates (interactable, lockable by the story), the Master-at-Arms office (E deck),
  the Marconi room interior, officers' quarters, crew mess. Return `floodRooms` for corridors.
* `interiors/Machinery.js` → `buildMachinery` — 6 boiler rooms (29 boilers, furnace doors, gauges, coal, ash),
  the reciprocating engine room (two huge engines with crank/columns), turbine room, electric engine room, bunkers,
  watertight bulkheads with doors, firemen's tunnel and spiral stair, cargo holds 1–3 (crates, the red Renault
  coupe de ville in hold 2 — interactable `'item'` id `renault`), mail room, refrigerated stores, shaft tunnels, propeller shafts.
* `Props.js` → prop factory used by all interior builders. **Fixed signatures** (all return `THREE.Group`, origin at the
  base centre on the floor, "front" facing **+z**, metres; `m` = MaterialLibrary; set `userData.collide` on seats/tables/large props):
  ```js
  makeChair(m, { style:'dining'|'wicker'|'club'|'bentwood'|'deck'|'bench3rd'|'stool', color })
  makeTable(m, { w, d, h, style:'round'|'rect'|'long'|'cafe', top:'wood'|'linen'|'marble' })
  makeBed(m, { w, l, style:'brass'|'wood'|'bunk2'|'bunk3' })
  makeLamp(m, { kind:'ceilingGlobe'|'chandelier'|'sconce'|'tableLamp'|'bulkhead'|'deckLamp'|'candelabra', power:1, light:true })
  makeColumn(m, { h, style:'ionic'|'plain'|'oak'|'steel'|'square', r })
  makeDoor(m, { w, h, style:'oak'|'white'|'steel'|'gate'|'wtDoor', open:false, double:false, id })
  makeWindow(m, { w, h, style:'square'|'round'|'bay'|'stained'|'frosted' })
  makeRailing(m, { length, height:1.05, balusterPitch:0.4, style:'teakCap'|'iron'|'oakGrand'|'pipe' })
  makeStairs(m, { width, rise, run, steps, style:'oak'|'steel'|'spiral'|'ladder', rails:true })
  makeBench(m, { length, style:'deck'|'third' })
  makeDeckChair(m, { color })
  makeWardrobe(m, { w, h, d, wood }), makeSofa(m, { w, color }), makeDesk(m, {}), makePiano(m, { grand:false })
  makeFireplace(m, { w, style }), makeBookcase(m, { w, h }), makePalm(m, { h }), makeTrellis(m, { w, h })
  makeCrate(m, { w, h, d }), makeBarrel(m, {}), makeSack(m, {}), makeTrunk(m, {})
  makeBollard(m, {}), makeVentilator(m, { kind:'cowl'|'mushroom'|'goose', h }), makeSkylight(m, { w, d })
  makeDavit(m, { h, reach }), makeLifeboat(m, { length, beam, covered:true, name })
  makeBoiler(m, { diameter, length, doubleEnded }), makeEngineCylinder(m, { d, h }), makeGauge(m, { d }), makeValveWheel(m, { d })
  makeTelegraph(m, {}), makeShipsWheel(m, { d }), makeBinnacle(m, {}), makeClock(m, { w, h, carved:true })
  makeStatue(m, { kind:'cherub' }), makePlaque(m, { text, id }), makeCar(m, {}), makeBathtub(m, {}), makeSink(m, {})
  makeGymMachine(m, { kind:'camel'|'horse'|'rower'|'bike'|'punch' }), makeHatch(m, { w, l }), makeCrane(m, { h, reach }), makeAnchor(m, { size })
  ```
* `Ship.js` (owned by the integrator) — orchestrates the builders, merges results, builds the BVH, exposes
  `ship.group, ship.locations (Map), ship.deckAt(yLocal), ship.lights.setPower(0..1), ship.lights.flicker(), ship.collision { bvh, mesh },
  ship.funnels, ship.lifeboats, ship.dynamic, ship.interactables (Map by id), ship.floodRooms, ship.split(xBreak) → { bowGroup, sternGroup }, ship.localToWorld(v), ship.worldToLocal(v)`.

## 6. World (`src/world/`)

* `GameClock.js` — `export class GameClock` — `{ date:'1912-04-10', minutes (since midnight), speed (game-min per real-sec), set('HH:MM'), setDate(iso), advanceTo('HH:MM', seconds), update(dt), get hhmm, get hours }`; emits `time:tick { date, hhmm, minutes }` every game minute.
* `World.js` — `export class World` — `new World({ engine, materials, clock, quality })`, `await world.build()`, `world.update(dt, cameraWorldPos)`;
  owns `Sky.js` (three Sky + sun + moon + star field + Milky Way, driven by clock: 10–14 April 1912, North Atlantic ~41.7°N),
  `Ocean.js` (large Gerstner/FFT-ish wave shader or three `Water` with procedural normals; calm "millpond" at night 14 April; a
  `heightAt(x, z, t)` helper for floating things), `Iceberg.js` (procedural iceberg with subsurface-looking material, spawned ahead
  on the starboard bow for the strike, plus a distant ice field), `Environment.js` (PMREM from sky, fog, exposure by time-of-day,
  interior lamp warmth 2200 K). Methods: `world.setWeather({ wind, swell })`, `world.spawnIceberg(worldPos)`, `world.iceberg`,
  `world.ocean.heightAt(x,z)`, `world.sunLight` (DirectionalLight casting shadows following the camera).

## 7. Player, NPCs, Story, Sinking, Audio

* `player/Character.js` — `export function makeCharacter(materials, look) → { group, update(dt, speedMps, moving), setPose('idle'|'walk'|'sit'|'talk'|'play'|'wave'), setLookTarget(worldPos|null), height }`
  — stylised but proportioned humanoid with period costume from `look` (hats, tailcoats, gowns, uniforms), simple procedural walk/idle.
* `player/PlayerController.js` — `export class PlayerController` — `new PlayerController({ engine, input, ship, settings, bus, materials })`,
  `player.position (world)`, `player.yaw/pitch`, `player.update(dt)`, `player.enabled`, `player.teleportLocal(x,y,z,yaw)`, `player.teleportTo(location)`,
  `player.mode ('first'|'third'|'free')`, `player.setMode()`, `player.currentDeck`, `player.heading (deg)`, `player.interactTarget`,
  `player.onGround`, `player.inWater`, `player.sitting`. Capsule radius 0.3, height 1.75, eye 1.65; walk 1.6 m/s, run 4.2 m/s, step-up 0.35 m; stairs by capsule slide.
  Emits `player:footstep { surface }`, `player:deck { deck }`, `interact:prompt { label } | null`, `player:interact { interactable }` (on E / click).
* `npc/NPCManager.js` — `export class NPCManager` — `new NPCManager({ ship, materials, characters, bus, clock })`, `spawnNamed(id, locationId)`,
  `moveNamed(id, locationId)`, `spawnCrowd({ deck, room, count, faction })`, `update(dt, playerWorldPos)`, `get(id)`, `all`,
  `setPanic(level 0..1)` (sinking), `despawnAll()`. NPC: `{ id, group, character, data, state }`; the named NPC's mesh has `userData.interactable = { id, type:'npc', label: name }`.
* `story/QuestManager.js` — `export class QuestManager` — `new QuestManager({ story, dialogues, bus, clock, player, npcs, ship })`,
  `start(watchId)`, `update(dt)`, `currentBeat`, `flags (Set)`, `inventory (Map)`, `reputation { first, third }`, `discovered (Set)`, `collected (Set)`,
  `complete(beatId)`, `runActions(actions)`, `save() → json`, `load(json)`. Emits `quest:beatStart { beat }`, `quest:objective { text, locationId }`,
  `quest:beatComplete { beat }`, `quest:watchStart { watch }`, `quest:flag { flag }`, `quest:discover { id }`, `quest:collect { id }`, `quest:reputation`.
* `story/DialogueRunner.js` — `export class DialogueRunner` — `new DialogueRunner({ dialogues, characters, bus, quest })`, `start(dialogueId)`, `choose(index)`, `advance()`, `active`.
  Emits `dialogue:node { speaker, speakerName, text, choices:[text] }`, `dialogue:end { dialogueId }`. Listens `ui:dialogueChoice { index }`, `ui:dialogueAdvance`.
* `sinking/SinkingDirector.js` — `export class SinkingDirector` — `new SinkingDirector({ ship, world, clock, bus, spec, npcs })`, `start()`, `update(dt)`, `active`,
  `state { minutesAfter, trimDeg, listDeg, sinkM, floodY (ship-local y of interior water), broken, lightsOn, phase }`. Drives ship transform from
  `SHIP.sinkingTimeline`, interior water planes rising through `ship.floodRooms`, lights flicker/out at 02:17, funnel 1 collapse, break-up via
  `ship.split(x)` at 02:18, stern rise, final plunge, lifeboat launches per `SHIP.lifeboats[].launchTime`, sliding `ship.dynamic` props when trim > 8°,
  `setClockSpeed`. Emits `sinking:state {state}`, `sinking:event { id:'strike'|'floodDeck'|'lightsOut'|'funnel1'|'breakup'|'plunge', ... }`.
* `audio/AudioEngine.js` — `export class AudioEngine` — `new AudioEngine({ settings, bus })`, `await init()` (on first gesture), `update(dt, { inside, deck, wind, speed, sinking })`,
  `play(id)` ids: `'ui_click','ui_hover','ui_page','bell','horn','steps_wood','steps_steel','steps_carpet','door','gate','splash','creak','strike','rumble','explosion','glass','alarm'`,
  `setAmbience({ wind, ocean, engine, crowd })`, `band.play('nearerMyGod'|'autumn'|'waltz'|'ragtime')`, `band.stop()`, `band.setPosition(worldPos)`;
  all sounds procedurally synthesised (noise, oscillators, convolution) — public-domain melodies only (e.g. "Nearer, My God, to Thee" 1861).

## 8. UI (`src/ui/`) — heavy nautical theme

`export class UI` — `new UI({ root, bus, settings, spec, story, characters })`, `ui.update(state)` per frame with the read-only
`GameState = { mode:'loading'|'menu'|'playing'|'paused'|'dialogue'|'map'|'journal'|'photo'|'gameover'|'credits', clock { date, hhmm }, heading, deck,
player { x,y,z }, objective, sinking: null|state, stats, reputation, fps }`.
Files: `UI.js` (root + mode switching + pointer-lock overlay), `theme.css` (tokens, typography, ornaments), `panels.css` (big panels),
`HUD.js`, `MainMenu.js` (ship's wheel), `SettingsPanel.js` (engine-order telegraph for quality), `Loading.js` (ticket card + rope progress),
`DialogueBox.js` (porthole frame), `Journal.js` (leather log book), `DeckMap.js` (blueprint SVG per deck from `SHIP.decks`, player marker, fast travel),
`PhotoMode.js`, `TimeControl.js` (chronometer), `GameOver.js`, `Credits.js` (manifest scroll), `Notifications.js` (brass toast).
Listens: `loading:progress {pct, label}`, `game:ready`, `quest:*`, `dialogue:*`, `interact:prompt`, `sinking:*`, `player:deck`, `player:died`, `time:tick`, `notify {text, kind}`.
Emits: `ui:newGame`, `ui:continue`, `ui:resume`, `ui:quitToMenu`, `ui:settingsChanged {key, value}`, `ui:dialogueChoice {index}`, `ui:dialogueAdvance`,
`ui:advanceTime {to}`, `ui:teleport {locationId}`, `ui:photoMode {on}`, `ui:mode {mode}`, `ui:requestPointerLock`, `ui:toggleView`.
Keys handled by UI: Esc (pause), Tab/M (deck map), J (journal), P (photo), T (time control), F5/F9 save/load.

## 9. Debug & tests

* `debug/DebugAPI.js` — `installDebugAPI(game)` sets `window.__game = { engine, ship, player, world, quest, npcs, sinking, teleport(locationId|{x,y,z}), setTime('HH:MM'), setQuality(q), startSinking(), listLocations(), setMode(m), frame() }`,
  `window.__GAME_READY = true` once playable, `window.__errors = []` (window.onerror + unhandledrejection).
  URL params honoured by `main.js`: `?autostart=1` (skip menu), `quality=`, `res=`, `at=<locationId>`, `time=HH:MM`, `watch=watchN`, `nosink=1`, `debug=1`.
* `tests/smoke.mjs` — builds, serves `dist/`, drives headless Chromium at 3840×2160, asserts no console errors, teleports to a list
  of locations and saves PNGs in `screenshots/`. Run with `npm run smoke`.

## 10. Event bus names (summary)
`loading:progress, game:ready, time:tick, player:footstep, player:deck, player:interact, player:died, interact:prompt, dialogue:start, dialogue:node, dialogue:end,
quest:watchStart, quest:beatStart, quest:objective, quest:beatComplete, quest:flag, quest:discover, quest:collect, quest:reputation, sinking:state, sinking:event, notify,
input:escape, input:pointerlockchange, ui:newGame, ui:continue, ui:resume, ui:quitToMenu, ui:settingsChanged, ui:dialogueChoice, ui:dialogueAdvance, ui:advanceTime, ui:teleport,
ui:photoMode, ui:mode, ui:requestPointerLock, ui:toggleView, audio:play`

## Extensions
(append here, one line each: `module → export` and why)
* `player/Character.js → optional `yawOffset` (radians) on the makeCharacter result` — NPCManager sets `group.rotation.y = yaw + (character.yawOffset ?? 0)`, assuming the model faces +x at rotation 0 when absent. (NPCManager, feature-detected.)
* `story/QuestManager.js → quest.playerId / quest.playerName, event quest:player { id, name }, action { type:'setPlayer', characterId }` — the playable character changes in Watch IV (Jack ↔ Rosie); DialogueRunner resolves `{player}` from it and the UI may relabel the HUD. (QuestManager, additive.)

### Integration additions (post-review)

- `ship.groundAt(x, fromY, z, maxDrop = 4)` → ship-local y of the first collision surface below the
  point, or `null`. Used by `NPCManager.spawnCrowd` so crowds stand on the deck, not on hatch covers.
- `materials.setInteriorEnv(texture)` — interior materials (`INTERIOR_NAMES`) get a warm PMREM
  (`Environment.makeInteriorEnv()`) as their own `envMap`; the sky PMREM stays on exteriors.
- Landmark `standOff` (metres, default 2.2): named NPCs wait that far ahead of the landmark along
  its yaw, facing it (`NPCManager._standPoint`). Set `standOff: 0` to stand exactly on the point.
- `World.build()` syncs the sky dome before the first environment cube render; never render the
  env cube from an unsynced Preetham sky (NaN PMREM → black frame).
- Room shells clamp `room.ceiling` to the deck spacing (`heightToNext − 0.2`).
- `ship/Bake.js` runs after the builders: static meshes merge by material × collide × break-up
  side × 150 m slab (`userData.part` is set on the merged meshes so `split()` still works); kept
  objects (doors, interactables, dynamic props, boats, davits, lines, lights, instanced meshes)
  are re-parented to `ship.group` and their own meshes collapsed per material. Door leaves stay
  under their pivots. Builders may mark `userData.noBake` to opt out. `ship.lampMeshes` is
  re-collected from baked meshes flagged `emissiveLamp` (flicker scales material emissive).
- Builders are passed to `_merge(result, name, interior)` with explicit names: minification
  mangles `fn.name`. Interior builders' meshes get `castShadow = false`.
- Never give a material `transmission > 0` (three.js renders the whole opaque scene again into
  the transmission buffer whenever one is on screen). Glass is alpha-blended instead.
- `QualityPresets.shadowEveryN` / `engine.shadowEveryN`: the sun shadow map refreshes every N frames.
- `tests/shot.mjs --calls` prints full / no-shadow / plain draw-call counts per location;
  `--custom` with `--eval="window.__shotProbe = () => ({...})"` returns a custom probe per location.

## 11. Additional binding details (added by the integrator)

* **Break-up seam.** `ctx.breakX` (ship-local x between funnels 3 and 4, default from `SHIP.breakX` or the funnel midpoint)
  is where the hull parts in Act IV. `Hull.js` and `Decks.js` must build their long meshes in **longitudinal sections**
  with a seam exactly at `ctx.breakX` (no single mesh may span it) and tag each section `userData.part = { x0, x1 }`.
  Other builders tag large objects the same way or let `Ship.split()` assign them by bounding box.
* **Collision & instancing.** `Ship.buildCollision()` merges every `userData.collide` **Mesh** (not InstancedMesh).
  For instanced items (balusters, chairs, portholes) that must be solid, add a simple invisible box Mesh collider.
* **Collision after the break.** `ship.partAt(worldPos) → { group, bvh }` gives the frame to collide against
  (the whole ship before the break; the bow or stern part after). `PlayerController` must use it instead of caching `ship.group`.
* **QuestManager.handleInteract(interactable) → boolean** — the story gets first refusal on every interaction
  (`player:interact`); `main.js` falls back to defaults (doors toggle via `interactable.data.toggle()`, items are
  collected, plaques discovered, NPC greeting shown as a notification, `'sit'` seats the player).
* **Required `LOCATIONS` ids** in `src/data/story.js` (ship-local; the smoke test and the UI fast-travel rely on them):
  `spawn_southampton` (C-deck first-class entrance, starboard, by the gangway), `bow_tip`, `forecastle`, `well_deck_fwd`, `bridge`, `wheelhouse`,
  `marconi_room`, `boat_deck_port_fwd`, `boat_deck_stbd_aft`, `gymnasium`, `grand_staircase_boat`, `grand_staircase_A`, `grand_staircase_D`,
  `lounge`, `smoking_room`, `reading_room`, `verandah_cafe`, `cafe_parisien`, `restaurant`, `parlour_suite_B52`, `promenade_A_stbd`,
  `reception_room`, `dining_saloon`, `second_class_dining`, `third_class_general`, `third_class_dining`, `scotland_road`, `master_at_arms`,
  `pool`, `turkish_bath`, `squash_court`, `cargo_hold_2`, `boiler_room_6`, `boiler_room_1`, `engine_room`, `turbine_room`, `mail_room`,
  `poop_deck`, `stern_rail`, `docking_bridge`, `third_class_cabin`, `second_class_cabin`, `first_class_stateroom`, `officers_quarters`,
  `crows_nest`, `compass_platform`. Each `{ name, deck, x, y, z, yaw }` with `y` = that deck's floor height (the player spawns 0.1 m above).
* **`makeCharacter` look fields** may be partially missing — always default sensibly.
* **Performance budget per builder (Ultra):** Hull ≤ 60 draw calls, Decks ≤ 400, Superstructure ≤ 500, each interior builder ≤ 400, props shared.
  Merge static geometry per material; use `InstancedMesh` for repeated props; respect `ctx.quality` for counts.
* **Manual render mode (for tests).** `Engine` supports `engine.manualRender = true`: the loop still calls update callbacks
  each animation frame but only renders when `engine.renderOnce()` is called (DebugAPI.frame(n) calls it n times and resolves
  after the last render). `main.js` sets it when `?manual=1`. This keeps SwiftShader smoke tests from spending 9 s on every
  idle 4K frame.
* **`camera:shake { intensity, seconds }`** bus event — PlayerController applies a decaying camera shake (strike, funnel collapse, break-up).
* **`player:drowning { depth }`** — emitted by PlayerController each second while the eye point is below the world water surface
  (world y < 0 or below an interior flood level published by `sinking:state.floodWorldY`); `SinkingDirector` turns sustained drowning into `player:died`.
