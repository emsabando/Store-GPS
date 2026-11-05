# UI kit: screens, widgets, theme, UX rules

The three references look nothing alike: navy and green with letter-spaced caps, terracotta, and
minimal glass. They share the same skeleton, though. This kit defines that skeleton once, as two
interchangeable **shells** over one set of **panels**, all driven by `ArchVizAppSubsystem` state.

## Shells

| Shell | From | Best for | Layout |
|---|---|---|---|
| **Rail** | Mirabad, Amanauz | touch tables, sales-office kiosks | fixed left rail of stacked sections (lots → parameters → weather/time → seasons), utility bar at the bottom, contextual card on the right |
| **TopNav** | "Your place on earth" | Pixel Streaming, web, desktop, presentations | top tabs (Home · Apartments · Features · Contact), one left content column on glass, the camera does the rest |

Both shells use the same panels. Pick the shell per client in `WBP_AppRoot`, or per platform:
Rail on touch, TopNav on web.

## Screen map

| Mode | Rail shell shows | TopNav shell shows | Camera |
|---|---|---|---|
| Masterplan | lot list, environment | Home tab: `WBP_HomeHero` | `Home` |
| Building | parameters: floor picker, amenity chips by category | Features tab: `WBP_FeatureList` | `Building_<B>` |
| Floor | floor picker (active), units on this floor | Apartments tab filtered to the floor | `Section_<B>` |
| Unit | `WBP_UnitCard` + `WBP_PlanViewpoints` | apartment detail column | framed from outside, or `Unit_<id>` |
| Interior | plan with viewpoint dots, "Back to description" | same | look-around viewpoint |
| Amenity | `WBP_POICard` on the right | Features item active + card | POI shot |
| FirstPerson | exit button, movement hint | same | walker pawn |
| *(idle)* | `WBP_AttractOverlay` "Touch to explore" | same | turntable / tour |

`WBP_AppRoot` binds **OnStateChanged** and switches panels from `GetState().Mode`. Don't track
screens inside widgets. The subsystem is the only source of truth, which is what makes Back,
kiosk reset and the web bridge behave the same way.

## Widgets

| Widget | Shows | Calls / binds |
|---|---|---|
| `WBP_AppRoot` | shell switch, attract overlay, UI hide | `OnStateChanged`, `OnUIHiddenChanged`, `OnIdleChanged` |
| `WBP_LotList` | "Lot 1. Mirabad Towers"... | buildings from `Inventory.GetRanges().Buildings`, names from `GetBuildingName` → `SelectBuilding` |
| `WBP_FloorPicker` | floor grid (3 4 / 6 7), reset ⟳, hide-cut 👁 | `Scene.GetFloors(B)` → `SelectFloor`; reset → `Back`; 👁 → `clearSection` |
| `WBP_ApartmentFilter` | building and room chips, area and price ranges, Terrace / White box / Reserved toggles, "85 apartments found", Clear all | `GetRanges` for bounds → `SetActiveFilter`; count from `OnResultsChanged` |
| `WBP_RangeSlider` | two-handle range | two overlaid `Slider`s clamped against each other (UMG has no dual slider) |
| `WBP_UnitRow` | N, m² (large), floor / building / balcony (small), price, bookmark | hover → `Scene.SetHoveredUnit` (the facade lights up), click → `SelectUnit`, bookmark → `ToggleFavorite` |
| `WBP_UnitCard` | rooms, area, balcony, floor, price, status badge, Download PDF, favourite, Enter interior, Request info | `GetUnit`, `FormatPrice`, `FormatArea`, `GetStatusText/Color`; PDF → `LaunchURL` (desktop) or a QR code (kiosk) |
| `WBP_PlanViewpoints` | plan image with dots and view cones | dot at `PlanPosition × image size`, rotated by `PlanYaw`; click → `SelectViewpoint`; active dot = `State.ShotId` |
| `WBP_FeatureList` | Playground, Rooftop garden... | `Scene.GetPOIs(Category)` → `FocusAmenity` |
| `WBP_POICard` | image, title, badge, description, Media gallery, First-person view | `FocusAmenity` state; `EnterFirstPersonAtPOI` (hidden unless `HasFirstPerson`) |
| `WBP_POILabel` | floating "court", "rooftop" tag | parent `ArchVizPOILabelWidget`; button → `SelectPOI` |
| `WBP_Gallery` | full-screen images, swipe | POI `Gallery`; pauses camera input (`SetCameraInputEnabled(false)`) |
| `WBP_EnvironmentPanel` | "13:27" ◂ ▸, 0–24 slider, weather and season icons | slider → `SetTimeOfDay(h, 0)` while dragging; ◂ ▸ → ±1 h with 1.5 s blend; icons → `SetWeather` / `SetSeason`; sync on `OnEnvironmentChanged` |
| `WBP_HomeHero` | "YOUR PLACE ON EARTH", tagline, 5 / 17 / 10 facts, address pin | project asset `ProjectName`, `Tagline`, `LocationFacts`, `Address` |
| `WBP_BottomBar` | Home, Hide, Explication (status legend), Screenshot, Cursor, Language, Quality | `GoHome`, `SetUIHidden`, `TakeScreenshot`, `SetLanguage`, `ApplyQualityPreset` |
| `WBP_LeadForm` | name, phone, email, consent | `SubmitLead`; `OnLeadSubmitted` → thank-you / retry |
| `WBP_Favorites` | saved units, "Send me these" | `GetFavorites`, `OnFavoritesChanged`; send = lead with favourites attached |

## Theme tokens (`ArchVizProjectAsset → Theme`)

Every widget reads colours from the theme. Re-skinning is a change to these values, not to the
widgets. These are starting points sampled from the references:

| Token | Classic (Mirabad) | Terracotta (Amanauz) | Glass ("Your place") |
|---|---|---|---|
| `Surface` | `#12161E` @ 0.88 | `#6E3420` @ 0.92 | `#0A0A0C` @ 0.55 |
| `SurfaceRaised` | `#1E3A64` (section headers) | `#8E4529` | `#FFFFFF` @ 0.08 |
| `Primary` | `#FFFFFF` | `#F4E9E1` | `#FFFFFF` |
| `Accent` | `#2E5D3A` (active row) | `#C8673A` | `#E6E6E6` (selected row fill) |
| `TextMuted` | `#FFFFFF` @ 0.6 | `#F4E9E1` @ 0.65 | `#FFFFFF` @ 0.6 |
| `PanelBlur` | 0 | 0 | 16 |
| `CornerRadius` | 0 | 2 | 4 |
| Type | letter-spaced caps for the brand, condensed sans for lists | caps headers, small labels | light geometric grotesk (Inter, Manrope), large thin headlines |

Status colours (`Available`, `Reserved`, `Sold`) are shared by the facade highlight, list badges
and the legend. Keep them the same in all three places.

## UX rules taken from the references

1. **The camera answers every click.** Selecting a lot, amenity or unit flies the camera there
   (1.5–2.5 s, eased, with a slight pull-back mid-flight). The panel only confirms what the
   camera shows.
2. **The list and the facade stay in sync.** Hovering a row lights the unit, clicking a unit opens
   its card, and the found count is always visible.
3. **Panels never cover the subject.** Keep the left column to 30 % width or less, and compose
   every shot with the subject in the right two-thirds.
4. **Back and Home are always visible.** Show Back whenever `CanGoBack`.
5. **Touch first.** Targets are at least 48 px at 1080p (56–64 px rows on the rail). Nothing is
   hover-only on a kiosk, where hover becomes tap-to-preview.
6. **Weather, time and seasons are for delight, not navigation.** Group them at the bottom of the
   rail or in a drawer, and keep them out of the main path.
7. **Clean mode hides everything**, hotspot labels included, for marketing captures.
8. **Idle resets for privacy.** Favourites and filters clear for the next visitor and the attract
   loop takes over.
9. **Legibility over glass.** Put a dark gradient behind text on photographic backgrounds and aim
   for 4.5:1 contrast. The "Your place" reference does this behind its left column.
10. **Prices are formatted per culture.** Show "Price on request" when `Price` is 0, and use the
    status badge instead of a price for sold units.

## Reference labels, for String Tables

| RU (reference) | EN |
|---|---|
| ВЫБЕРИТЕ ЛОТ | Select a lot |
| ПАРАМЕТРЫ | Parameters |
| Двор-парк на 3 этаже | Courtyard park on level 3 |
| Виды с балконов | Views from balconies |
| ПОГОДА \| ВРЕМЯ СУТОК | Weather \| Time of day |
| ВРЕМЕНА ГОДА | Seasons |
| ИССЛЕДОВАТЬ ОБЪЕКТ | Explore the property |
| БЛАГОУСТРОЙСТВО | Landscaping and amenities |
| ИНТЕРАКТИВНЫЙ СРЕЗ / ВЫБЕРИТЕ ЭТАЖ | Interactive section / Choose a floor |
| ВИД ОТ 1-ГО ЛИЦА | First-person view |
| ЭКСПЛИКАЦИЯ | Legend (site key) |
| СКРЫТЬ · КУРСОР · СНИМОК · НОМЕРА | Hide · Cursor · Screenshot · Rooms |
