# Command bridge

`ArchVizAppSubsystem.HandleCommandJson(Json)` takes the same commands whether they come from a
Pixel Streaming web page, a sales-office tablet relay, or a Blueprint test harness. State flows
back as JSON through `OnOutgoingMessage`. UMG widgets don't need the bridge; they call the
subsystem functions directly. Use it when the UI lives outside the engine.

## Wiring Pixel Streaming (two nodes)

1. Enable **Pixel Streaming** (UE 5.5+: **Pixel Streaming 2**) and add a **Pixel Streaming
   Input** component to your player controller Blueprint.
2. Bind its **On Input Event** to *Get Game Instance Subsystem (ArchVizAppSubsystem)* →
   **Handle Command Json** (Descriptor).
3. Bind **ArchVizAppSubsystem → On Outgoing Message** to **Send Pixel Streaming Response** (Json).

On the page (Epic's frontend library):

```js
const send = (cmd, args = {}) => stream.emitUIInteraction({ cmd, ...args });

stream.addResponseEventListener("archviz", (raw) => {
  const msg = JSON.parse(raw);
  switch (msg.type) {
    case "state":      renderState(msg); break;        // mode, unit, time, favourites...
    case "units":      renderList(msg.units); break;   // answer to setFilter / queryUnits
    case "results":    setFoundCount(msg.count); break;
    case "unit":       openCard(msg.unit, msg.unitType); break;
    case "leadResult": showThanks(msg.success); break;
  }
});

send("getState");
send("getRanges");                                     // slider bounds
send("setFilter", { filter: { Buildings: ["B1"], Rooms: [2, 3], MinArea: 50, MaxArea: 90,
                              Statuses: ["Available", "Reserved"], SortBy: "Price" } });
```

## Commands

Field names are case-insensitive. Unknown commands are passed to `OnUnhandledCommand(Command,
ArgsJson)`, so a project can add its own without changing the plugin.

| cmd | fields | effect |
|---|---|---|
| `home` | | masterplan view, shot `Home` |
| `back` | | previous screen, with its exact camera |
| `selectBuilding` | `building` | Building mode, shot `Building_<building>` |
| `selectFloor` | `building`, `floor` | section cut, shot `Section_<building>` |
| `clearSection` | | removes the cut (Floor mode falls back to Building) |
| `selectUnit` | `unitId` | highlights and frames the unit (or shot `Unit_<unitId>`) |
| `enterInterior` | `unitId`?, `shotId`? | show-flat of the unit's type; first viewpoint by default |
| `selectViewpoint` | `shotId` | jump between plan viewpoints |
| `focusAmenity` | `poiId` | flies to the POI's shot and focuses its card |
| `firstPerson` | `poiId`? | walk mode at the POI's start point (default: focused POI) |
| `exitFirstPerson` | | back to the orbit view |
| `goToShot` | `shotId`, `duration`? | camera bookmark, no mode change |
| `setFilter` | `filter` | sets the active search (facade highlight) and replies `units` |
| `queryUnits` | `filter` | replies `units` without changing the highlight |
| `clearFilter` | | clears the search highlight |
| `getUnit` | `unitId` | replies `unit` (with its `unitType`: plans, viewpoints) |
| `getRanges` | | replies `ranges` (area, price and floor bounds; buildings; room counts) |
| `toggleFavorite` / `setFavorite` | `unitId`, `value` | favourites (saved; cleared on kiosk reset) |
| `showAllStatuses` | `value` | colour every unit by status |
| `setTime` | `hours`, `blend`? | 0–24; blend in seconds animates the sun |
| `setDate` | `month`, `day` | changes the sun path |
| `setTimeLapse` | `speed` | hours per second; 0 stops |
| `setWeather` | `weather`, `blend`? | `Clear`, `PartlyCloudy`, `Overcast`, `Fog`, `Rain`, `Snow` |
| `setSeason` | `season`, `blend`? | `Spring`, `Summer`, `Autumn`, `Winter` |
| `setQuality` | `quality` | `Performance`, `Balanced`, `High`, `Cinematic` |
| `setLanguage` | `culture` | `en`, `ru`, `uz`, `pl`... |
| `hideUI` | `value` | hides UI and POI labels |
| `screenshot` | `withUI`? | saved to Saved/Screenshots |
| `submitLead` | `name`, `phone`, `email`, `message`, `unitId`, `consent` | POST to the lead webhook; replies `leadResult` |
| `getFloors` | `building` | replies `floors` (for the floor picker) |
| `getPOIs` | `category`? | replies `pois` |
| `getShots` | `group` | replies `shots` (tour stops) |
| `getState` | | replies `state` |

### Filter object

These are the `FArchVizUnitFilter` fields. Empty or zero means no constraint.

| Field | Type |
|---|---|
| `Buildings` | string[] |
| `Rooms` | int[] |
| `Floors` | int[] |
| `MinArea`, `MaxArea` | m² |
| `MinPrice`, `MaxPrice` | whole currency units |
| `bRequireTerrace`, `bRequireWhiteBox` | bool |
| `Statuses` | `Available`, `Reserved`, `Sold`, `NotForSale` |
| `RequiredTags` | string[] |
| `bFavoritesOnly` | bool |
| `SortBy` | `Price`, `Area`, `Floor`, `Rooms`, `Id` |
| `bSortDescending` | bool |

## Messages (UE → UI)

Every message has a `type`. `state` is sent after every change, so a UI can be a pure function of
the last `state` it received.

```json
{"type":"state","mode":"Unit","building":"B1","floor":5,"section":false,"unitId":"B1-0502",
 "poiId":"","shotId":"","canGoBack":true,"uiHidden":false,"idle":false,
 "time":13.5,"weather":"Clear","season":"Summer","isNight":false,"showAllStatuses":false,
 "favorites":["B1-0502"],"filterActive":true,"resultCount":12}
```

| type | payload |
|---|---|
| `state` | as above |
| `results` | `unitIds`, `count`: the units glowing on the facade |
| `units` | `units[]`, `count` |
| `unit` | `unit`, `unitType` |
| `ranges` | `ranges` |
| `floors` | `building`, `floors[]` |
| `pois` | `pois[]` with `poiId`, `title`, `description`, `category`, `badge`, `mediaUrl`, `hasFirstPerson` |
| `shots` | `shots[]` with `shotId`, `name` |
| `leadResult` | `success`, `code` (HTTP status; 0 = no webhook configured) |

A unit object has these fields: `unitId`, `building`, `floor`, `unitType`, `rooms`, `area`,
`balconyArea`, `terraceArea`, `bWhiteBox`, `price`, `status`, `tags`, `brochureUrl` and
`favorite`. `unitType` includes `floorPlanUrl` and `viewpoints[]` (`label`, `shotId`,
`planPosition{x,y}`, `planYaw`), which is enough to draw the "choose view on plan" dots in HTML.
