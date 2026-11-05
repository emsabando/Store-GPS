# ArchViz Master Template (UE5)

A reusable core for interactive real-estate apps: masterplan → building → floor → apartment →
interior, with amenities, time / weather / seasons, search with live facade highlight, favourites,
lead capture and kiosk mode. It runs the same as a desktop or touch-table build, or behind
Pixel Streaming with a web UI.

It was built from a teardown of three reference apps: **Mirabad Square** (lot picker, hotspot
cards, weather and season, quality switch), **Amanauz resort** (interactive floor section, seasons,
room browser) and the **"Your place on earth" residential template** (home facts, features tour,
apartment filter with facade highlight, plan viewpoints into the interior).

The engine side is a C++ plugin, **ArchVizKit**, exposed to Blueprint. Look and feel stays in UMG
(or HTML), so each client project is a re-skin plus data, not a rebuild.

## What the references do, and where it lives here

| Feature (as seen in the references) | Kit piece |
|---|---|
| Lot / building picker ("Выберите лот") | `AppSubsystem.SelectBuilding` + a `Building_<Id>` camera shot |
| Interactive section, choose floor ("Интерактивный срез") | `ArchVizFloorComponent` roles + `SelectFloor` |
| Search results glow on the facade; selected unit outlined | `ArchVizUnitComponent` + scene highlight (custom-depth stencil and/or overlay material) |
| Filter: building, rooms, area range, price range, terrace, white box, reserved, "85 found" | `InventorySubsystem.SetActiveFilter`, `QueryUnits`, `GetRanges` |
| Apartment card: rooms, area, balcony, floor, price, Download PDF, bookmark | `FArchVizUnitRow` + `BrochureUrl` + favourites |
| "Choose view on plan": dots on the plan jump into the interior | `FArchVizUnitTypeRow.Viewpoints` + `EnterInterior` / `SelectViewpoint` (look-around shots) |
| Features list (playground, rooftop garden, sports ground...) with cinematic shots | `ArchVizPOI` + its `ShotId`, `FocusAmenity` |
| Hotspot card with media gallery and first-person button ("Падел корт") | `ArchVizPOI` (gallery, badge, media URL, `FirstPersonStart`) + `EnterFirstPersonAtPOI` |
| Time-of-day slider and weather icons ("Погода / Время суток") | `ArchVizEnvironment`: real sun from the site's lat/long, blended weather presets |
| Seasons: summer / autumn / winter | `SetSeason` → MPC (`SnowCover`, `Autumn`, `Season`) + per-season actor sets |
| Home: tagline, "5 minutes to the metro", address | `ArchVizProjectAsset` (`Tagline`, `LocationFacts`, `Address`) |
| High / Balance / Performance, Exit | `ArchVizBlueprintLibrary.ApplyQualityPreset` |
| Hide UI, screenshot, cursor | `SetUIHidden`, `TakeScreenshot` |
| Availability "chessboard" (every unit coloured by status) | `SceneSubsystem.SetShowAllStatuses` |

Beyond the references:
- **Live inventory**: prices and statuses can come from a CRM endpoint, so the app doesn't need repackaging.
- **Lead capture**: an enquiry form posts to a webhook, with the visitor's favourites attached.
- **Kiosk mode**: an idle timeout resets the session for the next visitor and starts a turntable.
- **Back button**: a real back stack, where each step restores its camera view.
- **Command bridge**: one JSON protocol drives the app from UMG, a Pixel Streaming page or a sales-office tablet.
- **Languages**: a language switcher.

## Architecture

```
 UMG widgets ─┐                        ┌─> Inventory subsystem (GameInstance)
 Web UI (PS) ─┼─> App subsystem ───────┤     units, unit types, filter, favourites, CRM sync
 Tablet / JSON┘   modes + back stack   ├─> Scene subsystem (World)
                  idle / kiosk         │     registry of units, floors, shots, POIs;
                  command bridge       │     highlight + section cut
                  leads                ├─> Camera pawn: orbit / pan / zoom, fly-to, look-around
                                       └─> Environment actor: sun, sky, fog, FX, MPC
```

The UI only calls the **App subsystem** and reads from the **Inventory**. It never moves the
camera or touches actors itself. That's why the same app can have a UMG front end on a touch
table and an HTML front end over Pixel Streaming.

| Module | Type | Responsibility |
|---|---|---|
| `ArchVizInventorySubsystem` | GameInstance subsystem | Loads the unit tables, filters, sorts, ranges for sliders, favourites (saved), JSON / CRM merge |
| `ArchVizSceneSubsystem` | World subsystem | Things placed in the level register here; decides which units glow; section cut; POI labels |
| `ArchVizAppSubsystem` | GameInstance subsystem | Modes (Masterplan, Building, Floor, Unit, Interior, Amenity, FirstPerson), back stack, interior streaming, idle, bridge, leads |
| `ArchVizCameraPawn` | Pawn | Smoothed orbit, pan and zoom; eased fly-to with a pull-back arc; look-around for interiors; limits; turntable |
| `ArchVizGameMode` | GameMode | Default pawn and controller, so any level works with no setup |
| `ArchVizPlayerController` | PlayerController | Mouse and touch with no input assets (drag orbit, pinch zoom, two-finger pan, tap to select) |
| `ArchVizCameraShot` | Actor | Named camera you pilot in the editor; used by buildings, POIs, viewpoints and tours |
| `ArchVizUnitComponent` | Component | Makes an actor the clickable, highlightable shape of one apartment |
| `ArchVizFloorComponent` | Component | Tags geometry with building and floor so the section cut can peel the building open |
| `ArchVizPOI` | Actor | Amenity hotspot: floating label, card content, camera shot, first-person start |
| `ArchVizEnvironment` | Actor | NOAA sun position, weather blending, seasons, night switch, MPC parameters |
| `ArchVizProjectAsset` | Data asset | Everything that changes per client: brand, theme tokens, tables, currency, site, URLs |
| `ArchVizBlueprintLibrary` | BP library | Quality presets, language, screenshots, price / area / time formatting, status colours |

## Install

1. Copy `Plugins/ArchVizKit` into `<YourProject>/Plugins/`. The project needs to be C++. If it's
   Blueprint-only, add any C++ class once (Tools > New C++ Class), then build from your IDE.
2. Enable **ArchViz Kit** in Edit > Plugins and restart.
3. Create a data asset of type **ArchVizProjectAsset** (e.g. `DA_Project_Mirabad`). Import
   `Data/Units.csv` and `Data/UnitTypes.csv` as DataTables with row structs **ArchVizUnitRow** and
   **ArchVizUnitTypeRow**, and assign them.
4. Point **Project Settings > Plugins > ArchViz Kit > Project Asset** at it.
5. Set **Project Settings > Maps & Modes > Default GameMode** to `ArchVizGameMode`, which brings
   the orbit camera and mouse/touch controller. Set your `WBP_AppRoot` as **Root Widget** in the
   project asset; the controller adds it to the screen at start.
6. Place the scene pieces: environment, camera shots, POIs, unit volumes and floor tags. Then build
   the widgets. Both steps are in [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md).

Check a client's spreadsheet before importing it:

```bash
python3 Tools/validate_inventory.py Data/Units.csv Data/UnitTypes.csv
```

It reports bad statuses, unknown unit types and malformed numbers or tags. It also prints the
camera-shot ids the floor-plan viewpoints expect, which is your shot list for the show-flats.

## Naming conventions

Camera shots are found by `ShotId`. These are picked up automatically when they exist:

| ShotId | Used when |
|---|---|
| `Home` | `GoHome`, kiosk reset |
| `Building_<Building>` | `SelectBuilding("B1")` → `Building_B1` |
| `Section_<Building>` | `SelectFloor` (a top-down three-quarter view of the cut) |
| `Unit_<UnitId>` | `SelectUnit`, optional; otherwise the camera frames the unit from outside |
| any id in `UnitTypes.Viewpoints` | interior viewpoints (set `bLookAroundOnly`) |

## Folder layout

```
ArchVizMasterTemplate/
  Plugins/ArchVizKit/            the UE5 plugin (C++, Blueprint-exposed)
  Data/Units.csv                 82 sample units, 3 buildings (import as DataTable)
  Data/UnitTypes.csv             4 layouts with plan viewpoints
  Data/inventory_update.example.json   payload shape for live CRM sync
  Tools/validate_inventory.py    pre-import checker for client spreadsheets
  docs/PROJECT_SETUP.md          per-project setup, scene conventions, materials, packaging
  docs/UI_KIT.md                 screens, widget tree, theme tokens, UX rules from the references
  docs/BRIDGE_PROTOCOL.md        JSON commands and messages (Pixel Streaming / web / tablet)
```

## Status

- The plugin targets UE 5.4+ APIs. It was written and statically checked without an engine
  available, so **it hasn't been compiled yet**. Expect the first build to need small fixes.
- Widgets, materials, levels and other `.uasset` content aren't included because they're binary.
  [docs/UI_KIT.md](docs/UI_KIT.md) specifies them, and
  [docs/PROJECT_SETUP.md](docs/PROJECT_SETUP.md) has a prompt for building them with Claude Code
  and the Unreal MCP plugin on your machine.
