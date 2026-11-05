# Project setup: one client project, step by step

The plugin is the same for every project. What changes is one **ArchVizProjectAsset**, two
**DataTables**, the **level**, and the **theme tokens**.

## 1. Data first

1. Map the developer's sales sheet onto `Data/Units.csv`. One row per unit, with the row name equal
   to `UnitId`. Columns:
   `UnitId, Building, Floor, UnitType, Rooms, Area, BalconyArea, TerraceArea, bWhiteBox, Price, Status, Tags, BrochureUrl`.
   - `Status`: `Available | Reserved | Sold | NotForSale`
   - `Tags`: `(Corner,LakeView)` or `()`. Each tag becomes a filter chip or badge.
   - `Price` is in whole currency units. It's an int64, so large nominal currencies like UZS fit.
2. One row per layout in `Data/UnitTypes.csv`: plan textures, an optional web plan URL, and
   viewpoints. A viewpoint is a dot on the plan:
   `(Label="Living",ShotId="B2_Living",PlanPosition=(X=0.62,Y=0.71),PlanYaw=200)`.
   `PlanPosition` is normalised 0..1 from the plan image's top-left corner. `PlanYaw` is the view
   direction on the plan (0 = up), used to draw the view cone.
3. Run `python3 Tools/validate_inventory.py Data/Units.csv Data/UnitTypes.csv`. Fix any errors,
   and keep the printed shot list for step 6.
4. Import both CSVs as DataTables (row structs `ArchVizUnitRow` and `ArchVizUnitTypeRow`) and
   assign them in the project asset. To refresh later, re-import onto the same assets.

## 2. Level structure

- **Persistent level**: site, buildings, landscape, environment, shots and POIs.
- **Show-flats**: one furnished interior per unit type, not per unit. Either:
  - a classic streamed sub-level, set in `UnitTypes.InteriorLevel`. The app streams it in on
    `EnterInterior` and out when you leave; or
  - placed in the persistent world, away from the site. Leave `InteriorLevel` empty. This is the
    option for **World Partition** projects, which don't support classic sub-level streaming. If
    you need Data Layers there, toggle them from `OnModeChanged`.

## 3. Lighting and environment

1. Use a Movable Directional Light (Atmosphere Sun Light on), Sky Atmosphere, Sky Light (Movable,
   **Real Time Capture on**), Exponential Height Fog and Volumetric Cloud. If the Sky Light isn't
   real-time, the kit recaptures it at most four times a second while values change.
2. Place an **ArchVizEnvironment** and assign Sun, Sky Light, Fog and Parameters.
3. Create **MPC_ArchViz** with these scalar parameters (only the ones your materials use are needed):

   | Parameter | Range | Wire it to |
   |---|---|---|
   | `TimeOfDay` | 0–24 | anything time-based |
   | `SunElevation` | degrees | sunset grading, sky tint |
   | `NightFactor` | 0–1 | window and street-light emissive, pool lights |
   | `CloudCoverage` | 0–1 | volumetric cloud material coverage |
   | `Wetness` / `Rain` | 0–1 | roads, paving and roofs: darker albedo, lower roughness, puddle mask |
   | `Snowfall` / `SnowCover` | 0–1 | snow on upward normals (landscape, roofs, foliage) |
   | `Autumn` | 0–1 | foliage hue shift and leaf litter decals |
   | `Season` | 0–3 | spring, summer, autumn, winter (switch-style logic) |
   | `Wind` | 0–1 | foliage wind strength |

4. Assign Niagara rain and snow actors to **Rain Actors** and **Snowfall Actors**, street lights to
   **Night Actors**, and seasonal props (leaf piles, snow drifts, a winter tree) to **Season Actors**.
5. In the project asset, set **Latitude, Longitude and UTC Offset** for a correct sun path. Set
   **North Yaw** to the world yaw that points to true north on the site plan (0 if +X is north).
   The sun position is checked against NOAA values: Warsaw on the solstice peaks at 61.2° at 12:37.

## 4. Units on the facade

Each unit needs one or more **highlight volumes**: simple meshes 5–10 cm proud of the facade,
covering that unit's windows and balcony.

1. Model them per floor in Blender, Max or Revit, name each mesh with its `UnitId` (`B1-0502`),
   and import them as separate meshes.
2. Create **BP_UnitVolume**: a Static Mesh plus an **ArchVizUnitComponent**, with `bHideWhenIdle`
   on. Then convert the imported actors with this editor Python snippet (select them first, then
   Tools > Execute Python Script):

```python
import unreal
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
bp = unreal.load_class(None, "/Game/ArchViz/Blueprints/BP_UnitVolume.BP_UnitVolume_C")
for src in actors.get_selected_level_actors():
    if not isinstance(src, unreal.StaticMeshActor):
        continue
    new = actors.spawn_actor_from_class(bp, src.get_actor_location(), src.get_actor_rotation())
    new.set_actor_scale3d(src.get_actor_scale3d())
    new.get_component_by_class(unreal.StaticMeshComponent).set_static_mesh(src.static_mesh_component.static_mesh)
    new.get_component_by_class(unreal.ArchVizUnitComponent).set_editor_property("unit_id", src.get_actor_label())
    new.set_actor_label(src.get_actor_label())
    actors.destroy_actor(src)
```

3. Choose the highlight look (use both for the reference's sparkly white look):
   - **Outline**: set Project Settings > Rendering > Custom Depth-Stencil Pass to *Enabled with
     Stencil*. Add a post-process material that reads `CustomStencil` and draws an edge: 1 = available,
     2 = reserved, 3 = sold, 10 = selected (configurable in Plugins > ArchViz Kit).
   - **Overlay**: `M_UnitOverlay`, translucent and unlit, with emissive = `Color` × fresnel × an
     optional sparkle noise, opacity about 0.35, and the `Selected` parameter boosting both.
     Assign it as the component's Overlay Material.
4. Hover, click and tap work with no extra setup. Volumes are query-only and block only the
   Visibility channel, so they never stop the camera.

## 5. Floors and the section cut

The buildings must be split per floor. Revit can export by level through Datasmith or view
filters. Then add an **ArchVizFloorComponent** to each actor:

| Role | Put it on | Behaviour when floor N of its building is cut |
|---|---|---|
| `Structure` | slabs, walls and facade of a floor | hidden above N |
| `CutOnly` | furniture and plan dressing, the dark "cap" plane at ceiling height | visible only on floor N |
| `HideWhenCut` | roof, crown, parapets, rooftop plant | hidden whenever the building is cut |

`Building` None matches every building. The floor picker gets its list from
`SceneSubsystem.GetFloors(Building)`.

## 6. Camera shots

Place an **ArchVizCameraShot** for each of these. Pilot it with right-click > Pilot, frame the
view, then eject.

- `Home`, `Building_<B>`, `Section_<B>` (a three-quarter view looking into the cut).
- One per POI, named whatever you like and set on the POI's `ShotId`.
- Interior viewpoints: the ids the validator printed. Tick **Look Around Only**.
- Tours and attract loops: give the shots the same `Group` and set their `Order`.

`OrbitDistance` sets where the orbit pivot lands after arrival. Short distances suit amenities,
long ones the masterplan.

## 7. Amenities (POIs)

Place an **ArchVizPOI** per amenity. Fill in Title, Description, Category, Badge, Gallery, optional
Media URL, ShotId and (optionally) a Target Point as First Person Start. Set its widget class to
`WBP_POILabel`, reparented to **ArchVizPOILabelWidget**. Its button calls `SelectPOI`.

## 8. First person

Use any Character Blueprint (the First Person template's works) and set it as **First Person Pawn
Class** in the project asset. The card's first-person button calls `EnterFirstPersonAtPOI`, and
Back or Exit returns to the exact orbit view.

## 9. Kiosk, desktop and Pixel Streaming

- **Kiosk**: set Idle Timeout Seconds in the project asset (0 disables it). By default, on idle
  the kit goes Home, clears the filter and favourites, and starts a turntable. Bind `OnIdleChanged`
  to play a Level Sequence instead.
- **Touch tables**: the bundled player controller reads touch directly. Leave "Use Mouse for
  Touch" off.
- **Pixel Streaming**: see [BRIDGE_PROTOCOL.md](BRIDGE_PROTOCOL.md). Two Blueprint nodes connect it.
- Test each quality preset on the target GPU. Defaults: Performance = scalability 1 at 67 %,
  Balanced = 2 at 85 %, High = 3, Cinematic = 4.

## 10. Live inventory and leads

- **Inventory Sync Url** should return the JSON in `Data/inventory_update.example.json`. Each
  object needs only `UnitId` plus the changed fields. Call `RefreshFromUrl` at start and on a
  timer (every 5 minutes is plenty).
- **Lead Webhook Url** receives a JSON POST with `project, name, phone, email, message, unitId,
  marketingConsent, culture, submittedAt, favorites`. Point it at a Zapier, Make or CRM form
  endpoint.
- Don't put API keys in the project asset. It ships inside the package and anyone can read it.
  Use a webhook or a small server-side relay that holds the key.

## 11. Build the Content side with Claude Code + Unreal MCP

`.uasset` files can't be written from text, but a **local** Claude Code session with the Unreal
MCP plugin and your editor open can create them. Start that session in your project folder and
paste:

> Using the unreal-mcp tools, in /Game/ArchViz: create MPC_ArchViz with the scalar parameters
> listed in docs/PROJECT_SETUP.md section 3; import Data/Units.csv and Data/UnitTypes.csv as
> DataTables with row structs ArchVizUnitRow and ArchVizUnitTypeRow; create DA_Project
> (ArchVizProjectAsset) referencing them and set it in Project Settings > ArchViz Kit;
> create BP_UnitVolume (StaticMesh + ArchVizUnitComponent); create M_UnitOverlay as described in
> section 4; create a GameMode BP using ArchVizCameraPawn and ArchVizPlayerController; then build
> the widgets in docs/UI_KIT.md as WBP_ assets bound to ArchVizAppSubsystem, and report what you
> could not create.

## Per-project checklist

- [ ] Units and UnitTypes validated, imported and assigned; currency set
- [ ] Theme tokens set from the client's brand (see UI_KIT.md)
- [ ] Latitude, longitude, UTC offset and North Yaw set; sun checked at 9:00, 13:00 and 18:00
- [ ] Weather presets tuned against the artist's lit scene; MPC wired into materials
- [ ] Every unit has a volume (watch the "no UnitId" warnings in the log)
- [ ] Floors tagged; roof is `HideWhenCut`; caps are `CutOnly`
- [ ] Shots placed: Home, Building_*, Section_*, POI shots, every interior viewpoint
- [ ] POIs filled in, with gallery images at 16:9
- [ ] First-person pawn set (or POIs' First Person Start left empty)
- [ ] Idle timeout and reset behaviour agreed with the sales office
- [ ] Lead webhook tested end to end; inventory sync tested with a status change
- [ ] Quality presets profiled on the target hardware
