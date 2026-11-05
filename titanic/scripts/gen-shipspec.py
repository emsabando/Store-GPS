#!/usr/bin/env python3
"""Generates src/data/shipSpec.js — the authoritative RMS Titanic data model for the game.

Sources: titanic/research/01..04 (BOT Inquiry sworn deck heights and bulkhead table, Shipbuilder 1911,
1911 Engineering elevation measurements, Wikipedia, Encyclopedia Titanica). Coordinates follow
ARCHITECTURE.md §1: metres, origin amidships (midpoint of LBP) at the design waterline, +x bow, +y up,
+z starboard. Run:  python3 scripts/gen-shipspec.py
"""
import json, math, os

FT = 0.3048
LBP_FT = 850.0
LOA_FT = 882.75
DRAUGHT = 34.0 * FT + 7 * FT / 12          # 10.54 m
MID_FT = LBP_FT / 2                          # 425 ft aft of FP = frame origin
MID_M = MID_FT * FT                          # 129.54 m

def x_of(ft_from_bow):
    """frame x (m) from feet aft of the forward perpendicular (stem at the waterline)."""
    return round(MID_M - ft_from_bow * FT, 3)

def keel_y(ft_above_keel):
    return round(ft_above_keel * FT - DRAUGHT, 3)

# ---- deck heights above keel (BOT, Wilding) ------------------------------------------------
DECK_KEEL_FT = {
    'boat': 92.5, 'A': 83.0, 'B': 74.0, 'C': 65.0, 'D': 54.5, 'E': 45.5, 'F': 37.0, 'G': 28.5,
    'orlop': 20.5, 'tankTop': 5.25,
}
DECK_ORDER = ['boat', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'orlop', 'tankTop']
DECK_NAMES = {
    'boat': 'Boat Deck', 'A': 'A Deck (Promenade)', 'B': 'B Deck (Bridge Deck)', 'C': 'C Deck (Shelter Deck)',
    'D': 'D Deck (Saloon Deck)', 'E': 'E Deck (Upper Deck)', 'F': 'F Deck (Middle Deck)', 'G': 'G Deck (Lower Deck)',
    'orlop': 'Orlop Deck', 'tankTop': 'Tank Top',
}
DECK_Y = {k: keel_y(v) for k, v in DECK_KEEL_FT.items()}
Y_B = DECK_Y['B']          # 12.02 — top of the black hull / deck edge amidships
Y_KEEL = -DRAUGHT

# ---- sheer (relative to midship deck edge) -------------------------------------------------
SHEER_FWD = (86.0 - 74.0) * FT    # 3.66 m at the stem (forecastle deck)
SHEER_AFT = (79.0 - 74.0) * FT    # 1.52 m at the taffrail (poop)
def sheer(ft_from_bow):
    s = ft_from_bow * FT
    if s <= MID_M:
        return SHEER_FWD * ((MID_M - s) / MID_M) ** 2
    return SHEER_AFT * ((s - MID_M) / (LOA_FT * FT - MID_M)) ** 2

# ---- hull form ------------------------------------------------------------------------------
HALF_BEAM = 92.5 * FT / 2  # 14.1 m
PARALLEL_FWD_FT, PARALLEL_AFT_FT = 250.0, 580.0
AP_FT = 850.0

def mid_section_hb(y):
    """Midship half-breadth at height y (frame): flat keel, bilge radius ~3.4 m, vertical sides."""
    h = y - Y_KEEL               # height above keel
    if h <= 0: return 10.4
    r = 3.4
    if h >= r: return HALF_BEAM
    # quarter circle bilge from (10.7, 0) to (14.1, 3.4)
    return (HALF_BEAM - r) + math.sqrt(max(0.0, r * r - (r - h) ** 2))

def plan_factor(ft):
    """Waterline plan taper 0..1 along the length."""
    if ft <= 0: return 0.0
    if ft < PARALLEL_FWD_FT:
        t = ft / PARALLEL_FWD_FT
        return math.sin(0.5 * math.pi * t) ** 0.85
    if ft <= PARALLEL_AFT_FT: return 1.0
    if ft < AP_FT:
        t = (ft - PARALLEL_AFT_FT) / (AP_FT - PARALLEL_AFT_FT)
        return max(0.08, 1.0 - 0.92 * t ** 1.7)
    return 0.08

def half_breadth(ft, y):
    """Half-breadth (m) at feet-from-bow and frame height y. V-shaped ends below water, flare above."""
    g = plan_factor(ft)
    if g <= 0: return 0.0
    depth = max(0.0, min(1.0, -y / DRAUGHT))         # 0 at WL, 1 at keel
    above = max(0.0, min(1.0, y / 12.0))
    if ft < PARALLEL_FWD_FT:
        k = 1.0 + 1.4 * depth - 0.22 * above
    elif ft > PARALLEL_AFT_FT:
        above_stern = max(0.0, min(1.0, y / 9.0))
        k = 1.0 + 1.1 * depth - 0.85 * above_stern    # counter flares out above water to the broad poop
    else:
        k = 1.0
    return mid_section_hb(y) * (g ** k)

def bottom_y(ft):
    """Lowest hull point at a station (keel line, rising at the forefoot and under the counter)."""
    if ft < 12:
        return Y_KEEL + 3.0 * (1 - ft / 12.0) ** 2        # small forefoot radius, near-plumb stem
    if ft > 800:
        if ft >= AP_FT:
            # counter: bottom rises from the WL at the AP to the poop deck at the extreme stern
            t = min(1.0, (ft - AP_FT) / (LOA_FT - AP_FT))
            return -0.6 + (Y_B + sheer(ft) - 2.2 + 0.6) * t
        t = (ft - 800) / (AP_FT - 800)
        return Y_KEEL + (-0.6 - Y_KEEL) * t ** 2.4
    return Y_KEEL

def station(ft):
    top = Y_B + sheer(ft)
    yb = bottom_y(ft)
    ys = []
    for frac in [0, 0.08, 0.18, 0.3, 0.45, 0.6, 0.75, 0.88, 1.0]:
        ys.append(yb + (top - yb) * frac)
    # make sure the waterline and C/B deck heights are sampled when inside the range
    for yy in [0.0, DECK_Y['E'], DECK_Y['C']]:
        if yb < yy < top: ys.append(yy)
    ys = sorted(set(round(v, 2) for v in ys))
    hbs = []
    for yy in ys:
        hb = half_breadth(ft, yy)
        if ft >= AP_FT:   # elliptical counter plan: shrink toward the stern tip
            t = min(1.0, (ft - AP_FT) / (LOA_FT - AP_FT))
            hb = half_breadth(AP_FT - 1, yy) * math.sqrt(max(0.0, 1 - t * t))
        hbs.append([yy, round(hb, 3)])
    return {'xFromBow': round(ft * FT, 2), 'x': x_of(ft), 'yTop': round(top, 3), 'yBottom': round(yb, 3), 'halfBreadths': hbs}

STATION_FT = [0.5, 4, 10, 18, 28, 40, 55, 72, 92, 115, 140, 170, 205, 250, 300, 360, 420, 480, 540, 580, 620, 660, 700, 735, 765, 790, 810, 828, 842, 850, 858, 866, 873, 879, 882.5]

# ---- helpers for rooms -----------------------------------------------------------------------
def deck_hb(ft, deck):
    """usable interior half-width on a deck at a station (shell minus lining)."""
    return round(max(0.6, half_breadth(ft, DECK_Y[deck] + 1.2) - 0.45), 2)

ROOMS = {d: [] for d in DECK_ORDER}
CORRIDORS = {d: [] for d in DECK_ORDER}
STAIRS = {d: [] for d in DECK_ORDER}
DECKHOUSES = {d: [] for d in DECK_ORDER}
OPEN = {d: [] for d in DECK_ORDER}
LANDMARKS = {}

def room(deck, rid, name, cls, ft0, ft1, z0=None, z1=None, ceiling=None, style='', materials=None, colours=None,
         furniture=None, lighting=None, features=None, scenes=None, full=False, side=None, est=False):
    """ft0/ft1: feet from bow (ft0 < ft1). z in metres (+ starboard). full=True → whole usable width."""
    mid = (ft0 + ft1) / 2
    hb = deck_hb(mid, deck)
    if full or (z0 is None and z1 is None):
        z0, z1 = -hb, hb
    if side == 'port': z0, z1 = -hb, (z1 if z1 is not None else -0.6)
    if side == 'starboard': z0, z1 = (z0 if z0 is not None else 0.6), hb
    z0 = max(z0, -hb); z1 = min(z1, hb)
    heights = {'boat': 2.6, 'A': 2.6, 'B': 2.5, 'C': 2.5, 'D': 2.9, 'E': 2.5, 'F': 2.35, 'G': 2.3, 'orlop': 2.2, 'tankTop': 6.0}
    r = {
        'id': rid, 'name': name, 'class': cls,
        'x0': x_of(ft1), 'x1': x_of(ft0), 'z0': round(z0, 2), 'z1': round(z1, 2),
        'xFromBow0': round(ft0 * FT, 2), 'xFromBow1': round(ft1 * FT, 2),
        'ceiling': ceiling if ceiling is not None else heights[deck],
        'style': style,
        'materials': materials or {}, 'colours': colours or {},
        'furniture': furniture or [], 'lighting': lighting or {'fixture': 'ceilingGlobe', 'colourK': 2350},
        'features': features or [], 'movieScenes': scenes or [],
    }
    if est: r['est'] = True
    ROOMS[deck].append(r)
    return r

def corridor(deck, cid, name, ft0, ft1, z0, z1, width=None):
    CORRIDORS[deck].append({'id': cid, 'name': name, 'x0': x_of(ft1), 'x1': x_of(ft0), 'z0': z0, 'z1': z1,
                            'width': width or round(abs(z1 - z0), 2)})

def stairs(deck, sid, name, ft, z, from_deck, to_deck, width, kind='ordinary'):
    STAIRS[deck].append({'id': sid, 'name': name, 'x': x_of(ft), 'z': z, 'fromDeck': from_deck, 'toDeck': to_deck,
                         'width': width, 'type': kind})

def deckhouse(deck, hid, name, ft0, ft1, z0, z1, height, windows=None, roof=None):
    DECKHOUSES[deck].append({'id': hid, 'name': name, 'x0': x_of(ft1), 'x1': x_of(ft0), 'z0': z0, 'z1': z1,
                             'height': height, 'windows': windows or {'type': 'square', 'pitch': 1.5, 'w': 0.9, 'h': 1.1, 'y': 1.3},
                             'roofFeatures': roof or []})

def openarea(deck, name, ft0, ft1, z0=None, z1=None):
    mid = (ft0 + ft1) / 2
    hb = round(half_breadth(mid, DECK_Y[deck] + 0.5) - 0.1, 2)
    OPEN[deck].append({'name': name, 'x0': x_of(ft1), 'x1': x_of(ft0), 'z0': z0 if z0 is not None else -hb, 'z1': z1 if z1 is not None else hb})

def landmark(lid, name, deck, ft, z, yaw=0.0, y=None, extra=None):
    d = {'id': lid, 'name': name, 'deck': deck, 'x': x_of(ft), 'y': round(y if y is not None else DECK_Y[deck], 3), 'z': z, 'yaw': yaw}
    if extra: d.update(extra)
    LANDMARKS[lid] = d

# =============================================================================================
# BOAT DECK (y 17.65 amidships)
# =============================================================================================
openarea('boat', 'Officers Promenade', 190, 305)
openarea('boat', 'First Class Promenade', 305, 506)
openarea('boat', 'Engineers Promenade', 506, 542)
openarea('boat', 'Second Class Promenade', 542, 685)
deckhouse('boat', 'bh_bridge', 'Navigating bridge (open, roofed)', 190, 203, -14.0, 14.0, 2.5,
          windows={'type': 'square', 'pitch': 1.1, 'w': 0.8, 'h': 1.0, 'y': 1.3})
deckhouse('boat', 'bh_officers', "Wheelhouse and officers' quarters", 203, 305, -7.2, 7.2, 2.5,
          roof=['collapsible A (stbd)', 'collapsible B (port)', 'Marconi aerial lead-in', 'skylights'])
deckhouse('boat', 'bh_funnel1', 'Funnel 1 casing (fan rooms)', 228, 266, -4.6, 4.6, 2.8)
deckhouse('boat', 'bh_entrance_fwd', 'First Class Entrance / Grand Staircase dome house', 305, 339, -8.7, 8.7, 2.6,
          roof=['glass and wrought-iron dome (oval)'])
deckhouse('boat', 'bh_gym', 'Gymnasium', 339, 383, 4.6, 10.1, 2.9,
          windows={'type': 'square', 'pitch': 1.4, 'w': 1.0, 'h': 1.3, 'y': 1.2})
deckhouse('boat', 'bh_funnel2', 'Funnel 2 casing', 342, 380, -4.6, 4.6, 2.8)
deckhouse('boat', 'bh_raised_lounge', 'Raised roof over Reading & Writing Room and Lounge', 369, 473, -9.6, 9.6, 0.9,
          windows={'type': 'none'}, roof=['skylights', 'compass platform at 436 ft'])
deckhouse('boat', 'bh_funnel3', 'Funnel 3 casing', 464, 502, -4.6, 4.6, 2.8)
deckhouse('boat', 'bh_tank_rooms', 'Tank rooms and reciprocating-engine casing', 514, 542, -9.6, 9.6, 2.6)
deckhouse('boat', 'bh_raised_smoke', 'Raised roof over First Class Smoking Room (funnel 4 base)', 571, 639, -9.6, 9.6, 0.9,
          windows={'type': 'none'}, roof=['skylights', 'funnel 4', 'turbine casing fans'])
deckhouse('boat', 'bh_entrance_2nd', 'Second Class Entrance house (stair and lift)', 644, 670, -4.6, 4.6, 2.6)
room('boat', 'bridge', 'Navigating Bridge', 'crew', 190, 203, -14.0, 14.0, 2.5, 'Teak and brass, open bridge with wing cabs',
     {'floor': 'teakDeck', 'walls': 'whitePaintedSteel', 'ceiling': 'whitePaintedSteel', 'trim': 'teak'},
     {'floor': '#B38A5A', 'walls': '#F3F1EA', 'trim': '#7E4E2A', 'accent': '#B8923D'},
     [{'type': 'telegraph', 'count': 5, 'layout': 'row along the front'}, {'type': 'binnacle', 'count': 2, 'layout': 'centre and wing'}, {'type': 'shipsWheel', 'count': 1, 'layout': 'telemotor wheel, centre'}],
     {'fixture': 'bulkhead', 'colourK': 2350}, ['wing cabs overhang the hull', 'bridge front 190 ft from the bow', 'telephones to crow\'s nest and engine room'], ['iceberg_strike', 'inspection'])
room('boat', 'wheelhouse', 'Wheelhouse', 'crew', 203, 218, -4.1, 4.1, 2.5, 'Teak joinery, five windows with blinds',
     {'floor': 'teakDeck', 'walls': 'teak', 'ceiling': 'whitePaintedSteel'}, {'floor': '#B38A5A', 'walls': '#7E4E2A'},
     [{'type': 'shipsWheel', 'count': 1, 'layout': 'main wheel 3 ft 6 in on a 32 in pedestal'}, {'type': 'binnacle', 'count': 1, 'layout': 'steering compass'}], None,
     ['Magneta master clocks in the chart room abaft', 'horn telephones'], ['iceberg_strike'])
room('boat', 'chart_room', 'Chart Room', 'crew', 218, 232, -7.2, -0.6, 2.5, 'White painted, chart table', None, None,
     [{'type': 'table', 'count': 1, 'layout': 'chart table'}, {'type': 'clock', 'count': 2, 'layout': 'master clocks'}])
room('boat', 'navigating_room', 'Navigating Room', 'crew', 218, 232, 0.6, 7.2, 2.5, 'White painted')
room('boat', 'captains_quarters', "Captain's Quarters", 'officer', 232, 250, 0.6, 7.2, 2.5, 'Sitting room, bedroom and bath; mahogany',
     {'floor': 'carpetRed', 'walls': 'mahogany'}, {'floor': '#6B1F22', 'walls': '#4A2418'},
     [{'type': 'bed', 'count': 1}, {'type': 'desk', 'count': 1}, {'type': 'sofa', 'count': 1}])
room('boat', 'officers_cabins_port', "Officers' Cabins (Chief, 1st, 2nd, 3rd, 5th, 6th)", 'officer', 232, 285, -7.2, -0.6, 2.5, 'White painted panelled cabins off a passage',
     None, None, [{'type': 'bed', 'count': 6}, {'type': 'desk', 'count': 6}])
room('boat', 'officers_cabins_stbd', "4th Officer's Cabin and bathroom", 'officer', 250, 270, 0.6, 7.2, 2.5, 'White painted', None, None, [{'type': 'bed', 'count': 1}])
room('boat', 'officers_mess', "Officers' Smoking Room and Mess", 'officer', 270, 285, 0.6, 7.2, 2.5, 'Oak panelled mess', {'floor': 'linoCorridor', 'walls': 'oakPanel'}, None,
     [{'type': 'table', 'count': 1, 'layout': 'long'}, {'type': 'chair', 'count': 8}])
room('boat', 'marconi_room', 'Marconi Wireless Suite (silent room, operating room, bedroom)', 'crew', 285, 305, -6.0, 6.0, 2.5,
     'White painted; spark transmitter in the soundproofed silent room (port), operating desk (centre), bedroom (starboard)',
     {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'desk', 'count': 1, 'layout': 'operating desk with Marconi multiple tuner'}, {'type': 'bed', 'count': 2}],
     {'fixture': 'bulkhead', 'colourK': 2350}, ['CQD/SOS sent from here from 00:15', 'no direct door to the open deck'], ['distress_call'])
room('boat', 'gymnasium', 'Gymnasium', 'first', 339, 383, 4.6, 10.1, 2.9, 'White-painted pine panelling, oak floor, electric camel and horse, rowing and cycling machines',
     {'floor': 'oakPanel', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite'}, {'floor': '#8B6A3E', 'walls': '#F1EEE6'},
     [{'type': 'gymMachine', 'count': 1, 'layout': 'electric camel'}, {'type': 'gymMachine', 'count': 1, 'layout': 'electric horse'}, {'type': 'gymMachine', 'count': 2, 'layout': 'rowing machines'}, {'type': 'gymMachine', 'count': 2, 'layout': 'cycle racing machines'}, {'type': 'gymMachine', 'count': 1, 'layout': 'punching bag'}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['illuminated map of the world on the aft wall', '44 ft x 18 ft'], ['spitting_lesson_nearby'])
room('boat', 'entrance_boat_fwd', 'First Class Entrance (Boat Deck gallery)', 'first', 305, 339, -8.7, 8.7, 4.2, 'Oak panelled gallery under the dome',
     {'floor': 'linoDining', 'walls': 'oakPanel', 'ceiling': 'glassFrosted'}, None, [], {'fixture': 'chandelier', 'colourK': 2350}, ['stairwell gallery 56 x 33 ft'])
room('boat', 'entrance_boat_2nd', 'Second Class Entrance (Boat Deck)', 'second', 644, 670, -4.6, 4.6, 2.6, 'Oak and white, stair and lift to F deck',
     {'floor': 'linoCorridor', 'walls': 'oakPanel'})
room('boat', 'kennels', 'Kennels', 'crew', 600, 612, 9.0, 12.5, 2.2, 'Small white deckhouse with wire pens', None, None, [{'type': 'crate', 'count': 6, 'layout': 'pens'}], None, [], ['dog_fetch'], est=True)
stairs('boat', 'st_grand_boat', 'Forward Grand Staircase (Boat Deck to A)', 315, 0.0, 'boat', 'A', 4.9, 'grand')
stairs('boat', 'st_2nd_boat', 'Second-class staircase (Boat Deck to F)', 657, 0.0, 'boat', 'A', 2.4)
stairs('boat', 'st_bridge_wing_p', 'Bridge wing ladder to A deck (port)', 195, -12.5, 'boat', 'A', 0.9, 'ladder')
stairs('boat', 'st_bridge_wing_s', 'Bridge wing ladder to A deck (starboard)', 195, 12.5, 'boat', 'A', 0.9, 'ladder')
stairs('boat', 'st_engineers_boat', "Engineers' stair (Boat Deck to E)", 510, 6.0, 'boat', 'A', 1.2)

# =============================================================================================
# A DECK — Promenade (y 14.76)
# =============================================================================================
openarea('A', 'Enclosed promenade (steel screen with sliding windows) — port', 177, 375, -14.0, -7.0)
openarea('A', 'Enclosed promenade — starboard', 177, 375, 7.0, 14.0)
openarea('A', 'Open promenade — port', 375, 723, -14.0, -9.6)
openarea('A', 'Open promenade — starboard', 375, 723, 9.6, 14.0)
deckhouse('A', 'ah_fwd_rooms', 'Forward first-class staterooms block', 177, 295, -7.0, 7.0, 2.74)
deckhouse('A', 'ah_entrance', 'Forward Grand Staircase entrance (A deck)', 295, 342, -8.5, 8.5, 2.74)
deckhouse('A', 'ah_mid', 'Funnel-2 casing, corridor and Reading & Writing Room block', 342, 410, -9.6, 9.6, 2.74)
deckhouse('A', 'ah_lounge', 'Lounge and funnel-3 casing block', 410, 507, -9.6, 9.6, 3.73,
          windows={'type': 'bay', 'pitch': 3.2, 'w': 2.2, 'h': 2.0, 'y': 0.9})
deckhouse('A', 'ah_aft_entrance', 'Engine casing, aft Grand Staircase entrance', 505, 561, -8.5, 8.5, 2.74)
deckhouse('A', 'ah_smoke', 'Smoking Room block', 561, 626, -9.6, 9.6, 3.73,
          windows={'type': 'stained', 'pitch': 3.2, 'w': 2.0, 'h': 1.8, 'y': 1.0})
deckhouse('A', 'ah_verandah', 'Verandah Cafés and second-class stair', 626, 652, -9.6, 9.6, 2.74,
          windows={'type': 'square', 'pitch': 1.6, 'w': 1.3, 'h': 1.6, 'y': 0.9})
room('A', 'staterooms_A_fwd', 'Forward First-Class Staterooms (34 single-berth rooms)', 'first', 193, 295, -7.0, 7.0, 2.74,
     'White panelled single-berth rooms off a centre corridor', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 34}, {'type': 'wardrobe', 'count': 34}])
corridor('A', 'cor_A_fwd', 'A-deck forward centre corridor', 193, 295, -0.75, 0.75)
room('A', 'grand_staircase_A', 'Forward Grand Staircase — A Deck landing (under the dome)', 'first', 295, 338, -8.5, 8.5, 5.5,
     'Oak panelling (William & Mary), wrought iron and ormolu balustrade, clock panel "Honour and Glory Crowning Time", glass dome above',
     {'floor': 'linoDining', 'walls': 'oakPanel', 'ceiling': 'glassFrosted', 'trim': 'gold'},
     {'floor': '#E8DFC6', 'walls': '#8B6A3E', 'trim': '#C8A04E', 'accent': '#1E1E1E'},
     [{'type': 'clock', 'count': 1, 'layout': 'carved clock panel on the central landing'}, {'type': 'statue', 'count': 1, 'layout': 'bronze cherub lamp on the newel post'}],
     {'fixture': 'chandelier', 'colourK': 2350}, ['dome', 'three lifts forward of the stair (E to A)', '16 ft wide main flight'], ['dinner_descent', 'ending'])
room('A', 'lifts_A', 'First-Class Lifts (3)', 'first', 290, 296, -4.5, 4.5, 2.74, 'Three electric lifts with gates', {'walls': 'oakPanel', 'floor': 'linoDining'}, None, [], None, ['run E to A'])
corridor('A', 'cor_A_funnel2_stbd', 'Long corridor from the Grand Staircase to the Lounge (starboard of funnel-2 casing)', 338, 410, 4.8, 7.0)
room('A', 'funnel2_casing_A', 'Funnel 2 casing (A deck)', 'machinery', 342, 380, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('A', 'reading_room', 'Reading and Writing Room', 'first', 372, 410, -9.6, -4.6, 3.73,
     'Late Georgian, white panelling with dove-grey accents, pink carpet, pink silk curtains, bow window to the promenade',
     {'floor': 'roseCarpet', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite', 'trim': 'whiteEnamel'},
     {'floor': '#B85C72', 'walls': '#F4F1E8', 'trim': '#B9B7B0', 'accent': '#E7B7C0'},
     [{'type': 'sofa', 'count': 4, 'layout': 'silk settees yellow and burgundy'}, {'type': 'desk', 'count': 6, 'layout': 'writing desks along the walls'}, {'type': 'chair', 'count': 12, 'layout': 'club'}, {'type': 'fireplace', 'count': 1, 'layout': 'red marble, forward wall'}],
     {'fixture': 'sconce', 'colourK': 2350}, ['41 x 41 ft, 12 ft 3 in high', 'bay window'])
room('A', 'lounge', 'First-Class Lounge', 'first', 410, 467, -9.6, 9.6, 3.73,
     'Louis XV (Versailles) carved oak boiserie, green and gold velvet, grey marble fireplace, 49-light electrolier, bookcase alcove',
     {'floor': 'carpetGreen', 'walls': 'oakPanel', 'ceiling': 'plasterWhite', 'trim': 'gold'},
     {'floor': '#2F5A3A', 'walls': '#8B6A3E', 'trim': '#C8A04E', 'accent': '#3C6B4A'},
     [{'type': 'table', 'count': 14, 'layout': 'small round tables'}, {'type': 'chair', 'count': 40, 'layout': 'club chairs in velvet'}, {'type': 'sofa', 'count': 6}, {'type': 'fireplace', 'count': 1, 'layout': 'grey marble, aft wall'}, {'type': 'bookcase', 'count': 1, 'layout': 'alcove'}],
     {'fixture': 'chandelier', 'colourK': 2350}, ['59 x 63 ft, 12 ft 3 in high', 'bay windows both sides'], ['card_game'])
room('A', 'lounge_pantry', 'Lounge Pantry', 'crew', 472, 505, 4.6, 8.5, 2.74, 'White enamel', {'walls': 'whiteEnamel', 'floor': 'linoCorridor'})
room('A', 'funnel3_casing_A', 'Funnel 3 casing (A deck)', 'machinery', 464, 502, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('A', 'engine_casing_A', 'Reciprocating-engine casing (A deck)', 'machinery', 505, 533, -4.5, 4.5, 2.74, 'Steel casing with skylight', {'walls': 'whitePaintedSteel'})
room('A', 'grand_staircase_aft_A', 'Aft Grand Staircase — A Deck entrance (under the small dome)', 'first', 529, 561, -8.5, 8.5, 4.5,
     'Oak panelling, wrought iron and ormolu, round glass dome, plain clock', {'floor': 'linoDining', 'walls': 'oakPanel', 'ceiling': 'glassFrosted', 'trim': 'gold'},
     {'floor': '#E8DFC6', 'walls': '#8B6A3E', 'trim': '#C8A04E'}, [{'type': 'clock', 'count': 1, 'layout': 'simple clock, landing'}], {'fixture': 'chandelier', 'colourK': 2350}, ['spans A to C'])
room('A', 'smoking_room', 'First-Class Smoking Room', 'first', 561, 626, -9.6, 9.6, 3.73,
     'Georgian mahogany panelling inlaid with mother-of-pearl, stained-glass windows, marble fireplace with the painting "Plymouth Harbour", red and blue linoleum tiles',
     {'floor': 'linoDining', 'walls': 'mahogany', 'ceiling': 'plasterWhite', 'trim': 'gold'},
     {'floor': '#7E2A24', 'walls': '#4A2418', 'trim': '#C8A04E', 'accent': '#2D3F6B'},
     [{'type': 'table', 'count': 16, 'layout': 'card tables'}, {'type': 'chair', 'count': 48, 'layout': 'leather club chairs'}, {'type': 'fireplace', 'count': 1, 'layout': 'white marble, aft wall, coal fire'}],
     {'fixture': 'chandelier', 'colourK': 2350}, ['65 x 63 ft, 12 ft 3 in high', 'revolving door to the aft staircase vestibule', 'sliding doors aft to the Verandah'], ['designer_at_the_clock_alt', 'gentlemen_dressed_in_best'])
room('A', 'verandah_port', 'Verandah Café and Palm Court (port, smoking)', 'first', 626, 652, -9.6, -2.0, 2.74,
     'White trellis with climbing ivy, wicker furniture, chequered floor, large windows aft and outboard',
     {'floor': 'linoDining', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite'}, {'floor': '#B08A5E', 'walls': '#F3F0E8', 'accent': '#2E5A32'},
     [{'type': 'table', 'count': 6, 'layout': 'cafe'}, {'type': 'chair', 'count': 18, 'layout': 'wicker'}, {'type': 'palm', 'count': 4}, {'type': 'trellis', 'count': 6}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['30 x 25 ft'])
room('A', 'verandah_stbd', 'Verandah Café and Palm Court (starboard)', 'first', 626, 652, 2.0, 9.6, 2.74,
     'White trellis with climbing ivy, wicker furniture, chequered floor', {'floor': 'linoDining', 'walls': 'whiteEnamel'}, {'floor': '#B08A5E', 'walls': '#F3F0E8', 'accent': '#2E5A32'},
     [{'type': 'table', 'count': 6, 'layout': 'cafe'}, {'type': 'chair', 'count': 18, 'layout': 'wicker'}, {'type': 'palm', 'count': 4}, {'type': 'trellis', 'count': 6}])
room('A', 'stair_2nd_A', 'Second-Class Stairway and Lift (A deck)', 'second', 631, 646, -2.0, 2.0, 2.74, 'Oak stair with lift cage', {'floor': 'linoCorridor', 'walls': 'oakPanel'})
stairs('A', 'st_grand_A', 'Forward Grand Staircase (A to B)', 318, 0.0, 'A', 'B', 4.9, 'grand')
stairs('A', 'st_grand_aft_A', 'Aft Grand Staircase (A to B)', 552, 0.0, 'A', 'B', 3.6, 'grand')
stairs('A', 'st_2nd_A', 'Second-class staircase (A to B)', 638, 0.0, 'A', 'B', 2.4)
stairs('A', 'st_engineers_A', "Engineers' stair (A to B)", 510, 6.0, 'A', 'B', 1.2)

# =============================================================================================
# B DECK — Bridge Deck (y 12.02) : forecastle and poop are open decks at this level
# =============================================================================================
openarea('B', 'Forecastle deck', 0, 125)
openarea('B', 'Poop deck (third-class promenade)', 775, 882.75)
deckhouse('B', 'bh_house', 'B-deck house (full width, staterooms, restaurant, Café Parisien)', 175, 725, -13.9, 13.9, 2.74,
          windows={'type': 'square', 'pitch': 1.4, 'w': 0.8, 'h': 1.0, 'y': 1.4})
room('B', 'staterooms_B_fwd', 'Forward First-Class Staterooms (B deck)', 'first', 175, 297, -13.9, 13.9, 2.74,
     'Single-berth and special staterooms either side of a centre corridor, around the funnel-1 casing', {'floor': 'carpetRed', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 40}, {'type': 'wardrobe', 'count': 40}, {'type': 'sink', 'count': 40}])
corridor('B', 'cor_B_fwd', 'B-deck forward centre corridor', 175, 297, -0.75, 0.75)
room('B', 'funnel1_casing_B', 'Funnel 1 casing (B deck)', 'machinery', 225, 262, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('B', 'grand_staircase_B', 'Forward Grand Staircase — B Deck landing', 'first', 297, 326, -8.5, 8.5, 2.74,
     'Oak panelling, landscape painting on the landing, three lifts forward', {'floor': 'linoDining', 'walls': 'oakPanel', 'trim': 'gold'},
     {'floor': '#E8DFC6', 'walls': '#8B6A3E', 'trim': '#C8A04E'}, [{'type': 'statue', 'count': 2, 'layout': 'small cherub lamps at the flight ends'}], {'fixture': 'chandelier', 'colourK': 2350})
room('B', 'parlour_suite_B52', 'Parlour Suite B-52/54/56 (port) — sitting room, two bedrooms, wardrobe rooms, bath', 'first', 330, 390, -10.0, -1.0, 2.74,
     'Sitting room in Louis XVI (white and gilt), bedrooms in Empire and Adam styles, mahogany furniture, silk wall panels',
     {'floor': 'carpetBlue', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite', 'trim': 'gold'},
     {'floor': '#2A3C6E', 'walls': '#F4F1E8', 'trim': '#C8A04E', 'accent': '#4E7A5C'},
     [{'type': 'sofa', 'count': 2, 'layout': 'sitting room'}, {'type': 'table', 'count': 2}, {'type': 'chair', 'count': 6}, {'type': 'bed', 'count': 2, 'layout': 'brass beds in the bedrooms'}, {'type': 'wardrobe', 'count': 3}, {'type': 'bathtub', 'count': 1}, {'type': 'fireplace', 'count': 1, 'layout': 'electric heater in a marble surround'}, {'type': 'desk', 'count': 1}],
     {'fixture': 'sconce', 'colourK': 2350}, ['private promenade outboard', 'the fiancé\'s suite in the film (B-52)'], ['the_portrait', 'the_jewel', 'planted_necklace'])
room('B', 'private_promenade_B52', 'Private Promenade of Suite B-52/54/56 (port)', 'first', 335, 385, -13.9, -10.0, 2.74,
     'Half-timbered Tudor style, wicker furniture, large windows to the sea', {'floor': 'teakDeck', 'walls': 'whiteEnamel', 'trim': 'oakDark'},
     {'floor': '#B38A5A', 'walls': '#F3F0E8', 'trim': '#5E4426'}, [{'type': 'chair', 'count': 4, 'layout': 'wicker'}, {'type': 'table', 'count': 1, 'layout': 'cafe'}, {'type': 'palm', 'count': 2}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['50 ft long'], ['the_portrait'])
room('B', 'parlour_suite_B51', 'Parlour Suite B-51/53/55 (starboard)', 'first', 330, 390, 1.0, 10.0, 2.74,
     'Sitting room in Adam style, bedrooms Louis XIV and Modern Dutch', {'floor': 'carpetRed', 'walls': 'whiteEnamel', 'trim': 'gold'},
     {'floor': '#6B1F22', 'walls': '#F4F1E8', 'trim': '#C8A04E'}, [{'type': 'sofa', 'count': 2}, {'type': 'bed', 'count': 2}, {'type': 'wardrobe', 'count': 3}, {'type': 'bathtub', 'count': 1}, {'type': 'table', 'count': 2}, {'type': 'chair', 'count': 6}])
room('B', 'private_promenade_B51', 'Private Promenade of Suite B-51/53/55 (starboard)', 'first', 335, 385, 10.0, 13.9, 2.74,
     'Half-timbered Tudor style, wicker furniture', {'floor': 'teakDeck', 'walls': 'whiteEnamel', 'trim': 'oakDark'}, None, [{'type': 'chair', 'count': 4, 'layout': 'wicker'}, {'type': 'table', 'count': 1}])
room('B', 'staterooms_B_mid', 'Midship First-Class Suites and Staterooms (B deck)', 'first', 390, 546, -13.9, 13.9, 2.74,
     'Suites in Empire, Louis XVI, Georgian, Queen Anne, Old Dutch styles off port and starboard corridors', {'floor': 'carpetRed', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 60}, {'type': 'wardrobe', 'count': 60}, {'type': 'sofa', 'count': 20}])
corridor('B', 'cor_B_mid_port', 'B-deck midship corridor (port)', 297, 546, -6.2, -4.8)
corridor('B', 'cor_B_mid_stbd', 'B-deck midship corridor (starboard)', 297, 546, 4.8, 6.2)
room('B', 'funnel2_casing_B', 'Funnel 2 casing (B deck)', 'machinery', 342, 380, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('B', 'funnel3_casing_B', 'Funnel 3 casing (B deck)', 'machinery', 464, 502, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('B', 'engine_casing_B', 'Reciprocating-engine casing (B deck)', 'machinery', 514, 537, -4.5, 4.5, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('B', 'grand_staircase_aft_B', 'Aft Grand Staircase — B Deck landing', 'first', 546, 569, -8.5, 8.5, 2.74, 'Oak panelling, wrought iron and ormolu',
     {'floor': 'linoDining', 'walls': 'oakPanel', 'trim': 'gold'}, {'floor': '#E8DFC6', 'walls': '#8B6A3E'}, [], {'fixture': 'chandelier', 'colourK': 2350})
room('B', 'restaurant_reception', 'Restaurant Reception Room', 'first', 569, 600, -2.0, 13.9, 2.74,
     'Georgian white panelling with Axminster carpet, wicker and cane settees', {'floor': 'carpetRed', 'walls': 'whiteEnamel', 'trim': 'gold'}, {'floor': '#6B1F22', 'walls': '#F4F1E8'},
     [{'type': 'sofa', 'count': 4}, {'type': 'chair', 'count': 10, 'layout': 'wicker'}, {'type': 'table', 'count': 4}])
room('B', 'restaurant_galley', 'Restaurant Galley and Pantry', 'crew', 573, 601, -13.9, -2.0, 2.74, 'White tiled galley', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'table', 'count': 4, 'layout': 'long steel benches'}])
room('B', 'restaurant', 'À la Carte Restaurant', 'first', 600, 645, -13.9, 8.4, 2.74,
     'Louis XVI, French walnut panelling in light fawn, Rose du Barry Axminster carpet, bay windows, crystal table lamps with rose silk shades, peach marble buffet',
     {'floor': 'roseCarpet', 'walls': 'walnut', 'ceiling': 'plasterWhite', 'trim': 'gold'},
     {'floor': '#C97B86', 'walls': '#A8865C', 'trim': '#C8A04E', 'accent': '#E3B89B'},
     [{'type': 'table', 'count': 30, 'layout': 'round tables for 2 to 8 with crystal lamps'}, {'type': 'chair', 'count': 110, 'layout': 'walnut chairs in rose Aubusson tapestry'}],
     {'fixture': 'sconce', 'colourK': 2350}, ['137 seats', 'open 08:00 to 23:00', 'run by Gatti'], ['restaurant_dinner'])
room('B', 'cafe_parisien', 'Café Parisien', 'first', 600, 650, 8.4, 13.9, 2.74,
     'Sun-lit verandah: white trellis with ivy, wicker chairs and tables, large windows along the ship\'s side', {'floor': 'linoDining', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite'},
     {'floor': '#E6D7B8', 'walls': '#F3F0E8', 'accent': '#2E5A32'},
     [{'type': 'table', 'count': 14, 'layout': 'cafe tables along the windows'}, {'type': 'chair', 'count': 40, 'layout': 'wicker'}, {'type': 'trellis', 'count': 12}, {'type': 'palm', 'count': 4}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['85 x 18 ft (est.)', 'Titanic only'], ['cafe_tea'])
room('B', 'entrance_2nd_B', 'Second Class Entrance (B deck) with lift', 'second', 644, 667, -4.6, 4.6, 2.74, 'Oak and white', {'floor': 'linoCorridor', 'walls': 'oakPanel'})
room('B', 'smoking_room_2nd', 'Second-Class Smoking Room', 'second', 660, 706, -9.4, 9.4, 2.74,
     'Louis XVI oak panelling, linoleum tiles, dark green Morocco leather, bar', {'floor': 'linoDining', 'walls': 'oakPanel'}, {'floor': '#8E2E2B', 'walls': '#8B6A3E', 'accent': '#2F5A3E'},
     [{'type': 'table', 'count': 10}, {'type': 'chair', 'count': 36, 'layout': 'club'}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['36 x 62 ft'])
room('B', 'docking_bridge', 'Docking Bridge (poop)', 'crew', 843, 849, -13.0, 13.0, 2.4, 'Light open bridge athwartships with two telegraphs, a third steering wheel and compass',
     {'floor': 'teakDeck', 'walls': 'whitePaintedSteel', 'trim': 'teak'}, None, [{'type': 'telegraph', 'count': 2}, {'type': 'shipsWheel', 'count': 1}, {'type': 'binnacle', 'count': 1}], None, ['raised ~2.4 m above the poop'], ['stern_rescue_nearby'])
stairs('B', 'st_grand_B', 'Forward Grand Staircase (B to C)', 318, 0.0, 'B', 'C', 4.9, 'grand')
stairs('B', 'st_grand_aft_B', 'Aft Grand Staircase (B to C)', 552, 0.0, 'B', 'C', 3.6, 'grand')
stairs('B', 'st_2nd_B', 'Second-class staircase (B to C)', 655, 0.0, 'B', 'C', 2.4)
stairs('B', 'st_2nd_aft_B', 'Aft second-class staircase (B to G)', 730, 0.0, 'B', 'C', 2.0)
stairs('B', 'st_fc_break_p', 'Forecastle break ladder (port)', 124, -9.0, 'B', 'C', 1.0, 'ladder')
stairs('B', 'st_fc_break_s', 'Forecastle break ladder (starboard)', 124, 9.0, 'B', 'C', 1.0, 'ladder')
stairs('B', 'st_poop_break_p', 'Poop ladder to the aft well (port)', 776, -9.0, 'B', 'C', 1.2)
stairs('B', 'st_poop_break_s', 'Poop ladder to the aft well (starboard)', 776, 9.0, 'B', 'C', 1.2)
stairs('B', 'st_docking_bridge', 'Docking bridge ladder', 846, 11.0, 'B', 'B', 0.8, 'ladder')

# =============================================================================================
# C DECK — Shelter Deck (y 9.27): continuous stem to stern; wells open to the sky
# =============================================================================================
openarea('C', 'Forward well deck (third-class promenade)', 125, 175)
openarea('C', 'Aft well deck (third-class promenade)', 718, 775)
deckhouse('C', 'ch_house', 'C-deck long house (450 ft, first class) — within the hull', 167, 631, -13.9, 13.9, 2.74, windows={'type': 'round', 'pitch': 1.0, 'w': 0.5, 'h': 0.5, 'y': 1.5})
room('C', 'forepeak_C', 'Forepeak and anchor gear (under the forecastle)', 'crew', 0, 61, None, None, 2.6, 'Steel, red-lead, windlass machinery and chain pipes',
     {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None, [{'type': 'anchor', 'count': 0}], {'fixture': 'bulkhead', 'colourK': 2125}, ['windlass engines', 'chain lockers below'], full=True)
room('C', 'crew_galley', "Crew's Galley", 'crew', 61, 80, -3.5, 3.5, 2.6, 'White enamelled steel galley', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'})
room('C', 'seamens_mess', "Seamen's Mess", 'crew', 61, 125, None, -3.5, 2.6, 'White enamelled steel, long tables and benches', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'table', 'count': 3, 'layout': 'long'}, {'type': 'bench', 'count': 6}], side='port', scenes=['steerage_breakfast_alt'])
room('C', 'firemens_mess', "Firemen's Mess", 'crew', 80, 125, 3.5, None, 2.6, 'White enamelled steel, long tables and benches', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'table', 'count': 3, 'layout': 'long'}, {'type': 'bench', 'count': 6}], side='starboard')
room('C', 'staterooms_C_fwd', 'Forward First-Class Staterooms (C deck, two- and three-berth)', 'first', 167, 291, -13.9, 13.9, 2.74,
     'White panelled rooms with mahogany furniture around the funnel-1 casing', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 70}, {'type': 'wardrobe', 'count': 50}, {'type': 'sink', 'count': 50}], scenes=['boarding_first_class'])
corridor('C', 'cor_C_fwd_port', 'C-deck forward corridor (port)', 167, 291, -6.2, -4.8)
corridor('C', 'cor_C_fwd_stbd', 'C-deck forward corridor (starboard)', 167, 291, 4.8, 6.2)
room('C', 'funnel1_casing_C', 'Funnel 1 casing (C deck)', 'machinery', 226, 262, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('C', 'grand_staircase_C', 'Forward Grand Staircase — C Deck foyer', 'first', 291, 351, -13.9, 13.9, 2.74,
     'Oak panelled foyer, landscape painting on the landing, lifts forward; purser\'s and enquiry offices on the starboard side, cloak room port',
     {'floor': 'linoDining', 'walls': 'oakPanel', 'trim': 'gold'}, {'floor': '#E8DFC6', 'walls': '#8B6A3E', 'trim': '#C8A04E'},
     [{'type': 'statue', 'count': 2, 'layout': 'small cherub lamps'}, {'type': 'bench', 'count': 4}], {'fixture': 'chandelier', 'colourK': 2350}, ['main first-class entrance from the gangway doors on D below'], ['boarding_first_class'])
room('C', 'pursers_office', "Purser's Office and Enquiry Office", 'crew', 310, 340, 6.0, 13.9, 2.74, 'Oak counter and brass grille; valuables safe', {'floor': 'linoDining', 'walls': 'oakPanel'}, None,
     [{'type': 'desk', 'count': 2}, {'type': 'bookcase', 'count': 2}], None, ['Marconigrams handed in here', 'safe for valuables'], ['the_safe'])
room('C', 'cloak_room', 'Cloak Room', 'crew', 310, 330, -13.9, -6.0, 2.74, 'Oak', {'floor': 'linoDining', 'walls': 'oakPanel'})
room('C', 'staterooms_C_mid', 'Midship First-Class Suites and Staterooms (C deck)', 'first', 351, 500, -13.9, 13.9, 2.74,
     'Two parlour suites adjoining the entrance (C-55/57, C-62/64), six further suites and special staterooms', {'floor': 'carpetRed', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 80}, {'type': 'wardrobe', 'count': 60}, {'type': 'sofa', 'count': 16}], scenes=['mother_warns'])
corridor('C', 'cor_C_mid_port', 'C-deck midship corridor (port)', 351, 540, -6.2, -4.8)
corridor('C', 'cor_C_mid_stbd', 'C-deck midship corridor (starboard)', 351, 540, 4.8, 6.2)
room('C', 'funnel2_casing_C', 'Funnel 2 casing (C deck)', 'machinery', 342, 380, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('C', 'funnel3_casing_C', 'Funnel 3 casing (C deck)', 'machinery', 464, 502, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('C', 'maids_valets_saloon', "Maids' and Valets' Saloon", 'crew', 500, 534, 6.0, 13.9, 2.74, 'White panelled dining room served from the galley below', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'table', 'count': 4, 'layout': 'long'}, {'type': 'chair', 'count': 24}])
room('C', 'engine_casing_C', 'Reciprocating-engine casing (C deck)', 'machinery', 514, 537, -4.5, 4.5, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('C', 'grand_staircase_aft_C', 'Aft Grand Staircase — C Deck (lowest grand level)', 'first', 540, 560, -8.5, 8.5, 2.74, 'Oak panelling, wrought iron and ormolu',
     {'floor': 'linoDining', 'walls': 'oakPanel', 'trim': 'gold'}, {'floor': '#E8DFC6', 'walls': '#8B6A3E'})
room('C', 'barber_shop', 'First-Class Barber Shop', 'first', 560, 572, 6.0, 13.9, 2.74, 'White with marble counter, two swivel chairs, souvenirs hanging from the ceiling', {'floor': 'linoDining', 'walls': 'whiteEnamel'}, None,
     [{'type': 'chair', 'count': 2, 'layout': 'swivel chairs'}, {'type': 'sink', 'count': 2}])
room('C', 'surgery', "Ship's Surgery and physicians", 'crew', 560, 580, -13.9, -6.0, 2.74, 'White enamel', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'bed', 'count': 2}, {'type': 'desk', 'count': 1}])
room('C', 'staterooms_C_aft', 'Aft First-Class Staterooms (C deck)', 'first', 572, 631, -13.9, 13.9, 2.74, 'White panelled staterooms', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 30}, {'type': 'wardrobe', 'count': 24}])
corridor('C', 'cor_C_aft_port', 'C-deck aft corridor (port)', 560, 631, -6.2, -4.8)
corridor('C', 'cor_C_aft_stbd', 'C-deck aft corridor (starboard)', 572, 631, 4.8, 6.2)
room('C', 'promenade_2nd_port', 'Second-Class Enclosed Promenade (port)', 'second', 631, 718, -13.9, -8.8, 2.74, 'Solid bulwark with large sliding windows, teak deck', {'floor': 'teakDeck', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bench', 'count': 6}, {'type': 'deckChair', 'count': 8}])
room('C', 'promenade_2nd_stbd', 'Second-Class Enclosed Promenade (starboard)', 'second', 631, 718, 8.8, 13.9, 2.74, 'Solid bulwark with large sliding windows, teak deck', {'floor': 'teakDeck', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bench', 'count': 6}, {'type': 'deckChair', 'count': 8}])
room('C', 'entrance_2nd_C', 'Second Class Entrance (C deck) and lift', 'second', 641, 665, -4.6, 4.6, 2.74, 'Oak and white', {'floor': 'linoCorridor', 'walls': 'oakPanel'})
room('C', 'library_2nd', 'Second-Class Library', 'second', 665, 704, -8.8, 8.8, 2.74,
     'Adam style, sycamore panelling with mahogany dado, white fluted columns, coffered plaster ceiling, Wilton carpet, mahogany bookcase with glass doors',
     {'floor': 'carpetRed', 'walls': 'sycamore', 'ceiling': 'plasterWhite', 'trim': 'mahogany'}, {'floor': '#7A3A3A', 'walls': '#D9C9A5', 'trim': '#4A2418'},
     [{'type': 'table', 'count': 8, 'layout': 'writing tables'}, {'type': 'chair', 'count': 30}, {'type': 'bookcase', 'count': 1, 'layout': 'aft wall'}, {'type': 'column', 'count': 6}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['40 x 58 ft', 'windows onto the aft well'])
room('C', 'entrance_3rd_aft', 'Third Class Entrance (main, under the poop front)', 'third', 773, 800, -4.0, 4.0, 2.6, 'White enamelled pine, wide stairs up to the poop and down to G',
     {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#9B3A2F', 'walls': '#F1EEE6'}, [], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['16 ft wide stair to E, 8 ft E to F'], ['steerage_boarding_alt', 'locked_gates'])
room('C', 'smoking_room_3rd', 'Third-Class Smoking Room', 'third', 794, 826, None, -1.5, 2.6, 'Pine panelled painted white, oak dado, linoleum, fixed tables, bar, spittoons',
     {'floor': 'linoDining', 'walls': 'whiteEnamel', 'trim': 'oakDark'}, {'floor': '#9B3A2F', 'walls': '#F1EEE6', 'trim': '#5E4426'},
     [{'type': 'table', 'count': 8}, {'type': 'bench', 'count': 12}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, [], side='port')
room('C', 'general_room_3rd', 'Third-Class General Room', 'third', 794, 826, 1.5, None, 2.6, 'White-enamelled pine, teak benches, linoleum, upright piano — the steerage party room',
     {'floor': 'linoDining', 'walls': 'whiteEnamel', 'trim': 'oakDark'}, {'floor': '#9B3A2F', 'walls': '#F1EEE6', 'trim': '#5E4426'},
     [{'type': 'bench', 'count': 14, 'layout': 'teak benches along the walls'}, {'type': 'table', 'count': 6}, {'type': 'piano', 'count': 1, 'layout': 'upright, forward wall'}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['36 x 38 ft'], ['steerage_party'], side='starboard')
room('C', 'stern_C', 'Stern spaces under the poop (capstan gear, steering-gear trunk)', 'crew', 826, 878, None, None, 2.6, 'Steel, red-lead', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
stairs('C', 'st_grand_C', 'Forward Grand Staircase (C to D)', 318, 0.0, 'C', 'D', 4.9, 'grand')
stairs('C', 'st_grand_aft_C', 'Aft Grand Staircase lower flight (C to D, plain)', 552, 0.0, 'C', 'D', 2.4)
stairs('C', 'st_2nd_C', 'Second-class staircase (C to D)', 655, 0.0, 'C', 'D', 2.4)
stairs('C', 'st_2nd_aft_C', 'Aft second-class staircase (C to D)', 730, 0.0, 'C', 'D', 2.0)
stairs('C', 'st_3rd_aft_C', 'Aft third-class main stairway (C to D)', 786, 0.0, 'C', 'D', 4.9)
stairs('C', 'st_well_fwd_p', 'Forward well stair to D-deck open space (port)', 150, -6.0, 'C', 'D', 1.5)
stairs('C', 'st_well_fwd_s', 'Forward well stair to D-deck open space (starboard)', 150, 6.0, 'C', 'D', 1.5)
stairs('C', 'st_well_aft', 'Aft well stair down to D', 740, -6.0, 'C', 'D', 1.5)

# =============================================================================================
# D DECK — Saloon Deck (y 6.07)
# =============================================================================================
room('D', 'forepeak_store_D', 'Forepeak Storeroom', 'crew', 0, 46, None, None, 2.74, 'Steel', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room('D', 'firemens_quarters_D', "Firemen's Quarters (108 men in two watches)", 'crew', 46, 91, None, None, 2.74, 'White-enamelled steel, rows of iron bunks',
     {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bed', 'count': 54, 'layout': 'bunk2 rows'}], {'fixture': 'bulkhead', 'colourK': 2350}, [], full=True)
room('D', 'open_space_3rd', 'Third-Class Open Space (covered promenade)', 'third', 91, 193, None, None, 2.74, 'White-enamelled steel, red linoleum, teak benches; four ladderways; baggage door starboard',
     {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel', 'ceiling': 'whitePaintedSteel'}, {'floor': '#9B3A2F', 'walls': '#EEEBE3'},
     [{'type': 'bench', 'count': 16}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['stairs up to the forward well deck'], ['steerage_boarding'], full=True)
room('D', 'staterooms_D_fwd', 'First-Class Staterooms (50 rooms around the forward funnel)', 'first', 193, 280, -13.9, 13.9, 2.74, 'White panelled', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 70}, {'type': 'wardrobe', 'count': 50}])
corridor('D', 'cor_D_fwd_port', 'D-deck forward corridor (port)', 193, 280, -6.2, -4.8)
corridor('D', 'cor_D_fwd_stbd', 'D-deck forward corridor (starboard)', 193, 280, 4.8, 6.2)
room('D', 'funnel1_casing_D', 'Funnel 1 casing (D deck)', 'machinery', 226, 262, -4.6, 4.6, 2.74, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('D', 'entrance_D_fwd', 'Forward First-Class Entrance (D deck) — gangway doors and lifts', 'first', 280, 309, -13.9, 13.9, 2.74,
     'White panelled entrance hall; two gangway doors each side; three lifts forward of the stair', {'floor': 'linoDining', 'walls': 'whiteEnamel', 'trim': 'gold'}, None, [], {'fixture': 'chandelier', 'colourK': 2350},
     ['gangway doors used at Southampton', 'lowest grand landing is on E'], ['boarding_first_class'])
room('D', 'reception_room', 'First-Class Reception Room', 'first', 309, 363, -13.9, 13.9, 2.9,
     'Jacobean white panelling carved in low relief, dark Axminster carpet (red and blue), wicker chairs and Chesterfields in green silk damask, Aubusson tapestry, orchestra platform',
     {'floor': 'carpetRed', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite', 'trim': 'gold'},
     {'floor': '#6B1F22', 'walls': '#F4F1E8', 'trim': '#C8A04E', 'accent': '#4E7A5C'},
     [{'type': 'chair', 'count': 60, 'layout': 'wicker'}, {'type': 'sofa', 'count': 8, 'layout': 'Chesterfields'}, {'type': 'table', 'count': 20, 'layout': 'cafe'}, {'type': 'column', 'count': 8}, {'type': 'piano', 'count': 1, 'layout': 'grand, orchestra'}],
     {'fixture': 'chandelier', 'colourK': 2350}, ['54 ft long, full width', 'foot of the Grand Staircase'], ['dinner_reception', 'band_plays'])
room('D', 'dining_saloon', 'First-Class Dining Saloon', 'first', 363, 477, -13.9, 13.9, 2.9,
     'Jacobean style painted white, leaded-glass windows in recessed bays, oak chairs in dark green leather, linoleum tiles in blue, red and cream, columns down two aisles',
     {'floor': 'linoDining', 'walls': 'whiteEnamel', 'ceiling': 'plasterWhite', 'trim': 'whiteEnamel'},
     {'floor': '#8FA8BF', 'walls': '#F4F1E8', 'trim': '#E9E4D6', 'accent': '#2E4A3A'},
     [{'type': 'table', 'count': 60, 'layout': 'tables for 2 to 12 in rows with central aisles'}, {'type': 'chair', 'count': 300, 'layout': 'oak with green leather'}, {'type': 'column', 'count': 24, 'layout': 'two rows'}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['114 x 92 ft, seats 532', 'largest room afloat in 1912'], ['first_class_dinner', 'lunch_with_the_designer'])
room('D', 'pantry_D', 'First-Class Pantry', 'crew', 477, 531, -13.9, 13.9, 2.74, 'White tiled pantry with the engine casing rising through it', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'table', 'count': 8, 'layout': 'long'}])
room('D', 'galley_D', 'Galley (first and second class)', 'crew', 531, 576, -13.9, 13.9, 2.74, 'Two great ranges, 19 ovens, white tile and steel',
     {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'table', 'count': 10, 'layout': 'long'}, {'type': 'boiler', 'count': 0}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['flues to funnel 4'])
room('D', 'turbine_hatch_D', 'Turbine hatch and emergency dynamos', 'machinery', 576, 600, -4.5, 4.5, 2.74, 'Steel gratings, two 30 kW emergency dynamos', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'})
room('D', 'hospital', 'Hospital', 'crew', 600, 654, 4.8, 13.9, 2.74, 'White enamel wards and attendants\' rooms', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'bed', 'count': 8}])
room('D', 'pantry_2nd', 'Second-Class Pantry', 'crew', 600, 654, -13.9, -4.8, 2.74, 'White enamel', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'table', 'count': 4, 'layout': 'long'}])
room('D', 'dining_saloon_2nd', 'Second-Class Dining Saloon', 'second', 654, 724, -13.9, 13.9, 2.74,
     'Oak panelling in early English style, long tables with red leather swivel chairs, piano, linoleum', {'floor': 'linoDining', 'walls': 'oakPanel', 'ceiling': 'plasterWhite'},
     {'floor': '#E8DFC6', 'walls': '#8B6A3E', 'accent': '#7A1F1F'},
     [{'type': 'table', 'count': 14, 'layout': 'long tables athwartships'}, {'type': 'chair', 'count': 120, 'layout': 'swivel chairs'}, {'type': 'piano', 'count': 1}],
     {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['70 ft long, seats 394'])
room('D', 'staterooms_2nd_D', 'Second-Class Staterooms (38 rooms)', 'second', 724, 812, -13.9, 13.9, 2.74, 'White panelled, mahogany furniture', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 38, 'layout': 'bunk2'}, {'type': 'wardrobe', 'count': 38}])
corridor('D', 'cor_D_2nd', 'D-deck second-class corridor', 724, 812, -0.75, 0.75)
room('D', 'third_class_D_aft', 'Third-Class Accommodation and aft lavatories', 'third', 812, 866, None, None, 2.6, 'White-enamelled pine cabins', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 20, 'layout': 'bunk2'}], full=True)
stairs('D', 'st_grand_D', 'Forward Grand Staircase (D to E)', 318, 0.0, 'D', 'E', 4.9, 'grand')
stairs('D', 'st_spiral_p', "Firemen's spiral staircase (port) D to the tunnel", 91, -3.0, 'D', 'tankTop', 1.0, 'spiral')
stairs('D', 'st_spiral_s', "Firemen's spiral staircase (starboard)", 91, 3.0, 'D', 'tankTop', 1.0, 'spiral')
stairs('D', 'st_3rd_open_fwd_p', 'Third-class ladderway forward (port) D to E', 100, -10.0, 'D', 'E', 1.2, 'ladder')
stairs('D', 'st_3rd_open_fwd_s', 'Third-class ladderway forward (starboard) D to G', 100, 10.0, 'D', 'E', 1.2, 'ladder')
stairs('D', 'st_3rd_open_aft_p', 'Third-class ladderway aft (port) D to F', 185, -10.0, 'D', 'E', 1.2, 'ladder')
stairs('D', 'st_3rd_open_aft_s', 'Third-class ladderway aft (starboard) D to E', 185, 10.0, 'D', 'E', 1.2, 'ladder')
stairs('D', 'st_2nd_D', 'Second-class staircase (D to E)', 655, 0.0, 'D', 'E', 2.4)
stairs('D', 'st_2nd_aft_D', 'Aft second-class staircase (D to E)', 730, 0.0, 'D', 'E', 2.0)
stairs('D', 'st_3rd_aft_D', 'Aft third-class main stairway (D to E)', 786, 0.0, 'D', 'E', 4.9)
stairs('D', 'st_squash_D', 'Squash court stair (D down to F gallery)', 158, 7.5, 'D', 'E', 1.0)

# =============================================================================================
# E DECK — Upper Deck (y 3.33): Scotland Road
# =============================================================================================
room('E', 'forepeak_store_E', 'Forepeak Storeroom', 'crew', 0, 46, None, None, 2.5, 'Steel', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room('E', 'trimmers_quarters', "Trimmers' Quarters (72 men)", 'crew', 46, 91, None, None, 2.5, 'White-enamelled steel, iron bunks', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bed', 'count': 36, 'layout': 'bunk2'}], full=True)
room('E', 'seamens_quarters', "Seamen's Quarters (44 men)", 'crew', 91, 142, None, -1.0, 2.5, 'White-enamelled steel, bunks', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bed', 'count': 22, 'layout': 'bunk2'}], side='port', scenes=['flooded_quarters'])
room('E', 'third_class_cabins_E_fwd_stbd', 'Third-Class Cabins (forward starboard)', 'third', 91, 142, 1.0, None, 2.5, 'White enamel pine, two- and four-berth', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 20, 'layout': 'bunk2'}], side='starboard')
room('E', 'cross_passage_fwd', 'Forward Cross Passage (gangway doors each side)', 'crew', 142, 150, None, None, 2.5, 'White-enamelled steel; gangway doors port and starboard', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [], None,
     ['third-class boarding at Southampton used the forward E-deck gangway'], ['steerage_boarding'], full=True)
corridor('E', 'scotland_road', 'Scotland Road — the working alleyway (port)', 145, 814, -7.6, -5.0, 2.6)
corridor('E', 'cor_E_stbd', 'Starboard passage (first then second class)', 280, 760, 5.0, 6.3)
room('E', 'master_at_arms', "Master-at-Arms' Office", 'crew', 150, 162, 9.0, 13.5, 2.5, 'White-enamelled steel office with a desk, a safe and a steam pipe along the wall',
     {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'desk', 'count': 1}, {'type': 'chair', 'count': 2}], {'fixture': 'bulkhead', 'colourK': 2350}, ['handcuffed to a pipe in the film'], ['arrest', 'axe_rescue'], est=True)
room('E', 'third_class_cabins_E_fwd', 'Third-Class Cabins (forward, three compartments)', 'third', 150, 247, -13.9, -7.6, 2.5, 'White enamel pine, two- and four-berth; 53 firemen at the forward end', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 60, 'layout': 'bunk2'}], scenes=['steerage_cabin'])
room('E', 'third_class_cabins_E_fwd2', 'Third-Class Cabins (forward, inboard and starboard)', 'third', 150, 280, -5.0, 13.9, 2.5, 'White enamel pine, bunks', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 80, 'layout': 'bunk2'}], scenes=['steerage_cabin'])
room('E', 'crew_cabins_E_port', "Crew Accommodation outboard of Scotland Road (stewards, petty officers, engineers' mess)", 'crew', 247, 640, -13.9, -7.6, 2.5, 'White-enamelled steel cabins', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bed', 'count': 160, 'layout': 'bunk2'}])
room('E', 'grand_staircase_E', 'Forward Grand Staircase — E Deck (lowest landing) and lifts', 'first', 280, 309, -4.8, 4.8, 2.5, 'Oak panelled; a single plain flight continues down to F for the baths', {'floor': 'linoDining', 'walls': 'oakPanel'}, {'floor': '#E8DFC6', 'walls': '#8B6A3E'})
room('E', 'staterooms_E_first', 'First-Class Staterooms E-1 to E-42 (starboard)', 'first', 309, 514, 6.3, 13.9, 2.5, 'White panelled', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 42}, {'type': 'wardrobe', 'count': 42}])
room('E', 'staterooms_E_inboard', 'Staterooms inboard of the starboard passage', 'first', 309, 514, -5.0, 5.0, 2.5, 'White panelled two-berth rooms', {'floor': 'carpetBlue', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 40}])
room('E', 'engineers_accommodation', "Engineers' Accommodation beside the engine casing", 'crew', 514, 583, -13.9, 13.9, 2.5, 'White-enamelled steel cabins and mess', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'bed', 'count': 30}, {'type': 'table', 'count': 2, 'layout': 'long'}])
room('E', 'staterooms_E_second', 'Second-Class Staterooms E-43 to E-107 (64 rooms)', 'second', 583, 757, -5.0, 13.9, 2.5, 'White panelled, mahogany', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None,
     [{'type': 'bed', 'count': 64, 'layout': 'bunk2'}, {'type': 'wardrobe', 'count': 64}])
room('E', 'cross_passage_aft', 'Aft Cross Passage and forward Second-Class Entrance (gangway doors)', 'second', 640, 655, None, None, 2.5, 'White panelled; port half third class, starboard half second class, divided by a door',
     {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [], None, [], ['locked_gates'], full=True)
room('E', 'barber_2nd', 'Second-Class Barber Shop', 'second', 760, 770, 6.3, 13.9, 2.5, 'White, swivel chair', {'floor': 'linoDining', 'walls': 'whiteEnamel'}, None, [{'type': 'chair', 'count': 1}, {'type': 'sink', 'count': 1}])
room('E', 'third_class_cabins_E_aft', 'Third-Class Cabins (aft)', 'third', 757, 866, None, None, 2.5, 'White enamel pine, bunks', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 80, 'layout': 'bunk2'}], full=True)
stairs('E', 'st_grand_E_F', 'Plain flight from the Grand Staircase to F (baths)', 300, 3.0, 'E', 'F', 1.5)
stairs('E', 'st_scotland_ladder', 'Wide ladderway from Scotland Road to the third-class dining saloons', 420, -3.0, 'E', 'F', 6.1)
stairs('E', 'st_2nd_E', 'Second-class staircase (E to F)', 655, 0.0, 'E', 'F', 2.4)
stairs('E', 'st_2nd_aft_E', 'Aft second-class staircase (E to F)', 730, 0.0, 'E', 'F', 2.0)
stairs('E', 'st_3rd_aft_E', 'Aft third-class main stairway (E to F)', 786, 0.0, 'E', 'F', 2.4)
stairs('E', 'st_engineers_E', "Engineers' stair (E up to Boat Deck)", 510, 6.0, 'E', 'D', 1.2)
stairs('E', 'st_fidley_6', 'Boiler-room 6 fidley ladder (E to tank top)', 220, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_fidley_5', 'Boiler-room 5 fidley ladder', 275, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_fidley_4', 'Boiler-room 4 fidley ladder', 332, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_fidley_3', 'Boiler-room 3 fidley ladder', 390, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_fidley_2', 'Boiler-room 2 fidley ladder', 448, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_fidley_1', 'Boiler-room 1 fidley ladder', 496, -4.0, 'E', 'tankTop', 0.8, 'ladder')
stairs('E', 'st_engine_room_E', 'Engine-room ladder (E to tank top)', 548, -4.0, 'E', 'tankTop', 0.8, 'ladder')

# =============================================================================================
# F DECK — Middle Deck (y 0.74)
# =============================================================================================
room('F', 'firemens_quarters_F', "Firemen's Quarters (F deck)", 'crew', 46, 91, None, None, 2.35, 'White-enamelled steel, iron bunks', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bed', 'count': 40, 'layout': 'bunk3'}], full=True)
room('F', 'third_class_cabins_F_fwd', 'Third-Class Cabins (forward)', 'third', 91, 247, None, None, 2.35, 'White enamel pine, two- to six-berth; salmon linoleum', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 150, 'layout': 'bunk2'}], scenes=['steerage_cabin'], full=True)
corridor('F', 'cor_F_fwd', 'F-deck forward centre corridor', 91, 247, -0.8, 0.8)
room('F', 'squash_gallery', 'Squash Court Spectators\' Gallery (F level)', 'first', 155, 165, 0.5, 6.6, 2.35, 'Gallery at the aft end of the two-deck-high court', {'floor': 'oakPanel', 'walls': 'whiteEnamel'}, None, [{'type': 'bench', 'count': 2}])
room('F', 'swimming_bath', 'Swimming Bath', 'first', 255, 300, 2.5, 13.0, 3.1,
     'Tiled salt-water pool 30 x 14 ft, 13 changing cubicles in teak, marble steps, white and blue tiles', {'floor': 'moorishTile', 'walls': 'whiteEnamel', 'ceiling': 'whitePaintedSteel', 'trim': 'teak'},
     {'floor': '#F2F2EE', 'walls': '#F1EEE6', 'trim': '#7E4E2A', 'accent': '#1E3F7A'},
     [{'type': 'bench', 'count': 4}, {'type': 'door', 'count': 13, 'layout': 'cubicle doors'}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['pool tank 9.14 x 4.27 m, 1.37 to 1.63 m deep, extends down to G'], ['pool_discovery'])
room('F', 'linen_rooms', 'Linen Rooms', 'crew', 247, 304, -13.0, -1.0, 2.35, 'White enamel shelving', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bookcase', 'count': 10, 'layout': 'linen shelving'}])
room('F', 'turkish_bath', 'Turkish Baths — Cooling Room', 'first', 308, 345, 2.5, 9.5, 3.1,
     '17th-century Arabian: blue-green Moorish tiles, teak dado, gilded beams on a crimson ceiling, bronze Arab lanterns, marble drinking fountain, canvas-covered couches',
     {'floor': 'moorishTile', 'walls': 'moorishTile', 'ceiling': 'plasterWhite', 'trim': 'teak'},
     {'floor': '#2E5F8F', 'walls': '#3E8C78', 'ceiling': '#7A2E2C', 'trim': '#7E4E2A', 'accent': '#C9A54A'},
     [{'type': 'sofa', 'count': 6, 'layout': 'couches'}, {'type': 'table', 'count': 2}, {'type': 'column', 'count': 4, 'layout': 'teak'}, {'type': 'lamp', 'count': 4, 'layout': 'bronze hanging lanterns'}],
     {'fixture': 'candelabra', 'colourK': 2125}, ['hot room, temperate room, steam room and shampooing rooms aft', 'electric bath'], ['turkish_bath_discovery'])
room('F', 'turkish_bath_hot', 'Turkish Baths — Hot, Temperate and Steam Rooms, Shampooing Rooms', 'first', 345, 361, 2.5, 13.0, 2.6, 'White tile and teak', {'floor': 'moorishTile', 'walls': 'whiteEnamel', 'trim': 'teak'}, {'floor': '#2E5F8F'},
     [{'type': 'bench', 'count': 4, 'layout': 'marble slabs'}])
room('F', 'stewards_F', "Stewards' Accommodation", 'crew', 304, 361, -13.0, -1.0, 2.35, 'White-enamelled steel bunks', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bed', 'count': 40, 'layout': 'bunk3'}])
room('F', 'dining_saloon_3rd_fwd', 'Third-Class Dining Saloon (forward room)', 'third', 361, 418, -13.0, 13.0, 2.35,
     'White-enamelled steel walls with framed White Star posters, long tables with swivel chairs; boiler casing on the centreline divides it port and starboard',
     {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel', 'ceiling': 'whitePaintedSteel'}, {'floor': '#9B3A2F', 'walls': '#EEEBE3'},
     [{'type': 'table', 'count': 10, 'layout': 'long tables fore and aft'}, {'type': 'chair', 'count': 120, 'layout': 'swivel chairs'}], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['two rooms, 100 ft total, 473 seats'], ['steerage_breakfast'])
room('F', 'dining_saloon_3rd_aft', 'Third-Class Dining Saloon (aft room)', 'third', 418, 478, -13.0, 13.0, 2.35, 'White-enamelled steel, long tables with swivel chairs', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, {'floor': '#9B3A2F', 'walls': '#EEEBE3'},
     [{'type': 'table', 'count': 10, 'layout': 'long tables'}, {'type': 'chair', 'count': 120, 'layout': 'swivel chairs'}])
room('F', 'funnel2_casing_F', 'Boiler-room 3/4 casing (F deck)', 'machinery', 342, 380, -4.6, 4.6, 2.35, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('F', 'funnel3_casing_F', 'Boiler-room 1/2 casing (F deck)', 'machinery', 464, 502, -4.6, 4.6, 2.35, 'Steel casing', {'walls': 'whitePaintedSteel'})
room('F', 'galley_3rd', 'Third-Class Galley and Pantries', 'crew', 478, 514, -13.0, 13.0, 2.35, 'White tile and steel ranges', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'table', 'count': 6, 'layout': 'long'}])
room('F', 'engineers_F', "Engineers' Quarters and reciprocating-engine casing", 'crew', 514, 583, -13.0, 13.0, 2.35, 'White-enamelled steel', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bed', 'count': 20}])
room('F', 'cabins_2nd_F', 'Second-Class Cabins (F deck)', 'second', 583, 757, -13.0, 13.0, 2.35, 'White panelled, mahogany bunks', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, None, [{'type': 'bed', 'count': 90, 'layout': 'bunk2'}])
corridor('F', 'cor_F_2nd', 'F-deck second-class corridor', 583, 757, -0.8, 0.8)
room('F', 'third_class_cabins_F_aft', 'Third-Class Cabins (aft, permanent)', 'third', 757, 814, None, None, 2.35, 'White enamel pine', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'}, [{'type': 'bed', 'count': 60, 'layout': 'bunk2'}], full=True)
room('F', 'stores_F_aft', 'Stores (aft peak)', 'crew', 814, 850, None, None, 2.35, 'Steel shelving', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None, [{'type': 'crate', 'count': 20}], full=True)
stairs('F', 'st_2nd_F', 'Second-class staircase foot (F)', 655, 0.0, 'F', 'F', 2.4)
stairs('F', 'st_2nd_aft_F', 'Aft second-class staircase (F to G)', 730, 0.0, 'F', 'G', 2.0)
stairs('F', 'st_3rd_aft_F', 'Aft third-class stairway (F to G)', 786, 0.0, 'F', 'G', 2.4)
stairs('F', 'st_3rd_fwd_F_G', 'Forward third-class ladder (F to G, starboard)', 100, 10.0, 'F', 'G', 1.2, 'ladder')
stairs('F', 'st_baggage_G', 'Baggage stair (F to G, port)', 170, -8.0, 'F', 'G', 1.0)

# =============================================================================================
# G DECK — Lower Deck (y -1.85)
# =============================================================================================
room('G', 'leading_firemen_G', 'Leading Firemen and Greasers (45 men); No. 1 hatch trunk', 'crew', 46, 91, None, None, 2.3, 'White-enamelled steel, bunks', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None, [{'type': 'bed', 'count': 24, 'layout': 'bunk2'}], full=True)
room('G', 'third_class_open_berths_G', 'Third-Class Open Berths (26 rooms, 106 people)', 'third', 91, 142, None, None, 2.3, 'White-enamelled steel and pine, rows of bunks', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 53, 'layout': 'bunk2'}], full=True)
room('G', 'baggage_room_G', 'First-Class Baggage Room (port) and stair to the Orlop', 'crew', 142, 193, None, -6.6, 2.3, 'Steel, stacked trunks and crates', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'trunk', 'count': 40}, {'type': 'crate', 'count': 20}], side='port')
room('G', 'post_office', 'Sea Post Office (sorting room)', 'crew', 142, 160, 6.6, None, 2.3, 'White-enamelled steel, sorting racks, mail sacks, an 8 cwt mail lift', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'sack', 'count': 40}, {'type': 'desk', 'count': 3}, {'type': 'bookcase', 'count': 6, 'layout': 'sorting racks'}], {'fixture': 'bulkhead', 'colourK': 2350}, ['afloat 20 minutes after the collision'], ['mail_room_flooding'], side='starboard')
room('G', 'squash_court', 'Squash Racquet Court', 'first', 160, 190, 0.5, 6.6, 5.0, 'Two decks high, white plaster walls, oak floor, red lines', {'floor': 'oakPanel', 'walls': 'plasterWhite', 'ceiling': 'whitePaintedSteel'}, {'floor': '#8B6A3E', 'walls': '#F2EFE7'},
     [], {'fixture': 'ceilingGlobe', 'colourK': 2350}, ['30 x 20 ft', 'gallery at F level aft'], ['squash_discovery'])
room('G', 'third_class_rooms_G_fwd', 'Third-Class Rooms (seven rooms) beside the squash court', 'third', 160, 193, 6.6, None, 2.3, 'White pine, bunks', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'}, [{'type': 'bed', 'count': 17, 'layout': 'bunk2'}], side='starboard')
room('G', 'bunkers_G_port', "'Tween-deck coal bunkers (port) beside the boiler casings", 'machinery', 193, 514, None, -5.2, 2.3, 'Coal heaps behind steel bulkheads, coaling chutes', {'floor': 'coal', 'walls': 'steelRusty'}, None,
     [{'type': 'sack', 'count': 0}], {'fixture': 'bulkhead', 'colourK': 2125}, [], side='port')
room('G', 'bunkers_G_stbd', "'Tween-deck coal bunkers (starboard)", 'machinery', 193, 514, 5.2, None, 2.3, 'Coal heaps behind steel bulkheads', {'floor': 'coal', 'walls': 'steelRusty'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], side='starboard')
room('G', 'engineers_stores_G', "Engineers' Stores and Workshop", 'machinery', 514, 583, None, None, 2.3, 'Steel, lathes and benches', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None, [{'type': 'table', 'count': 4, 'layout': 'workbenches'}, {'type': 'crate', 'count': 10}], full=True)
room('G', 'stores_G', "Ship's Stores and Provisions (cold rooms)", 'crew', 583, 703, None, None, 2.3, 'White-enamelled steel cold chambers: beef, mutton, poultry, fish, vegetables, wine', {'floor': 'linoCorridor', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'crate', 'count': 60}, {'type': 'barrel', 'count': 30}, {'type': 'sack', 'count': 30}], full=True)
room('G', 'third_class_G_aft', 'Third-Class Cabins (aft, 60 rooms, 186 passengers)', 'third', 703, 814, None, None, 2.3, 'White pine, bunks; aft second- and third-class stairs land here', {'floor': 'linoCorridor', 'walls': 'whiteEnamel'}, {'floor': '#E7A58F'},
     [{'type': 'bed', 'count': 93, 'layout': 'bunk2'}], full=True)
corridor('G', 'cor_G_aft', 'G-deck aft centre corridor', 703, 814, -0.8, 0.8)
room('G', 'stores_G_aft', 'Stores (aft peak flat)', 'crew', 814, 850, None, None, 2.3, 'Steel', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None, [{'type': 'crate', 'count': 10}], full=True)
stairs('G', 'st_baggage_orlop', 'Baggage stair (G to Orlop, port)', 170, -8.0, 'G', 'orlop', 1.0)

# =============================================================================================
# ORLOP (y -4.29) and TANK TOP (y -8.94)
# =============================================================================================
room('orlop', 'hold1_tween', "No. 1 Hold ('tween deck)", 'machinery', 46, 91, None, None, 2.2, 'Cargo: crates, bales, barrels', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None,
     [{'type': 'crate', 'count': 30}, {'type': 'barrel', 'count': 10}, {'type': 'sack', 'count': 20}], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room('orlop', 'hold2_tween', "No. 2 Hold ('tween deck) — the motor car", 'machinery', 91, 142, None, None, 2.4, 'Cargo hold: crates and the crated 1912 Renault 35 hp coupé de ville (uncrated in the film)', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None,
     [{'type': 'car', 'count': 1, 'layout': 'port side, facing forward'}, {'type': 'crate', 'count': 40}, {'type': 'barrel', 'count': 8}], {'fixture': 'bulkhead', 'colourK': 2125}, ['the Renault (confidence low on the exact hold)'], ['the_car'], full=True)
room('orlop', 'mail_room', 'Mail Storage Room and specie room (No. 3 hold \'tween deck, starboard)', 'crew', 142, 193, 1.0, None, 2.2, 'Steel, racks of mail sacks; floor 24 ft above keel', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'sack', 'count': 80}, {'type': 'bookcase', 'count': 8, 'layout': 'racks'}], {'fixture': 'bulkhead', 'colourK': 2125}, [], ['mail_room_flooding'], side='starboard')
room('orlop', 'baggage_room_orlop', 'First- and Second-Class Baggage Room (No. 3 hold \'tween deck, port)', 'crew', 142, 193, None, -1.0, 2.2, 'Trunks, cases and hat boxes stacked to the beams', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None,
     [{'type': 'trunk', 'count': 80}, {'type': 'crate', 'count': 30}], side='port')
room('orlop', 'switchboard_gallery', 'Switchboard Gallery and refrigerating evaporators (over the electric engine room)', 'machinery', 640, 703, None, None, 2.4, 'Steel gallery with the main switchboard, brass and slate', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None,
     [{'type': 'gauge', 'count': 20}, {'type': 'valveWheel', 'count': 10}], full=True)
room('orlop', 'refrigerated_cargo', 'Refrigerated Cargo Chamber (over the shaft tunnel)', 'machinery', 703, 757, None, None, 2.2, 'Insulated chamber, cork lined', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel'}, None, [{'type': 'crate', 'count': 40}], full=True)
room('orlop', 'hold6_tween', "No. 6 Hold ('tween deck)", 'machinery', 757, 814, None, None, 2.2, 'Cargo', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None, [{'type': 'crate', 'count': 30}, {'type': 'barrel', 'count': 10}], full=True)

TT = 'tankTop'
room(TT, 'forepeak_tank', 'Forepeak Tank (trimming tank)', 'machinery', 0, 46, None, None, 4.0, 'Steel tank', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room(TT, 'hold1', 'No. 1 Hold (lower)', 'machinery', 46, 91, None, None, 4.4, 'Cargo', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None, [{'type': 'crate', 'count': 30}], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room(TT, 'hold2', "No. 2 Hold (lower) with the firemen's passage", 'machinery', 91, 142, None, None, 4.4, 'Cargo either side of the centreline tunnel', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None, [{'type': 'crate', 'count': 40}], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
room(TT, 'hold3', 'No. 3 Hold (reserve coal bunker)', 'machinery', 142, 193, None, None, 4.4, 'Coal', {'floor': 'coal', 'walls': 'steelRusty'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)
corridor(TT, 'firemens_passage', "Firemen's Passage (tunnel on the tank top)", 91, 193, -1.3, 1.3, 2.6)
BR = [(6, 193, 247, 4, 0, 1), (5, 247, 304, 5, 0, 1), (4, 304, 361, 5, 0, 2), (3, 361, 418, 5, 0, 2), (2, 418, 478, 5, 0, 3), (1, 478, 514, 0, 5, 3)]
BOILER_ROOMS = []
for n, f0, f1, de, se, funnel in BR:
    r = room(TT, f'boiler_room_{n}', f'Boiler Room No. {n}', 'machinery', f0, f1, None, None, 12.5,
             f'{de or se} {"double-ended" if de else "single-ended"} Scotch boilers abreast, stokeholds fore and aft, coal bunkers on the bulkheads, uptakes to funnel {funnel}',
             {'floor': 'steelGrey', 'walls': 'steelRusty', 'ceiling': 'steelGrey', 'trim': 'brass'}, {'floor': '#4A4A4C', 'walls': '#6B4A3A', 'accent': '#B8923D'},
             [{'type': 'boiler', 'count': de or se}, {'type': 'gauge', 'count': 10}, {'type': 'valveWheel', 'count': 8}, {'type': 'sack', 'count': 0}],
             {'fixture': 'bulkhead', 'colourK': 2125}, ['furnace glow, coal dust'], ['boiler_room_chase'] if n in (6, 5) else [], full=True)
    count = de or se
    span = 5.3 * (count - 1)
    zs = [round(-span / 2 + i * 5.3, 2) for i in range(count)]
    BOILER_ROOMS.append({'n': n, 'xFromBow0': round(f0 * FT, 2), 'xFromBow1': round(f1 * FT, 2), 'x0': x_of(f1), 'x1': x_of(f0),
                         'doubleEnded': de, 'singleEnded': se, 'boilerDiameter': 4.80, 'boilerLength': 6.10 if de else 3.58,
                         'boilerZ': zs, 'boilerCentreY': round(DECK_Y[TT] + 2.4 + 0.1, 2), 'funnel': funnel, 'stokeholds': 2 if de else 1})
room(TT, 'engine_room', 'Reciprocating Engine Room', 'machinery', 514, 583, None, None, 14.0,
     'Two four-cylinder triple-expansion engines 30 ft tall, columns, cranks, starting platform, refrigerating machines port side', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel', 'trim': 'brass'},
     {'floor': '#4A4A4C', 'walls': '#EEEBE3', 'accent': '#B8923D'}, [{'type': 'engineCylinder', 'count': 8}, {'type': 'gauge', 'count': 20}, {'type': 'valveWheel', 'count': 12}, {'type': 'telegraph', 'count': 2}],
     {'fixture': 'bulkhead', 'colourK': 2350}, ['engines 9.1 m high, 75 rpm'], ['engine_room_full_astern'], full=True)
room(TT, 'turbine_room', 'Turbine Engine Room', 'machinery', 583, 640, None, None, 10.0, 'Parsons low-pressure turbine casing on the centre shaft, two condensers, thrust blocks', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel', 'trim': 'brass'},
     {'floor': '#4A4A4C', 'walls': '#EEEBE3'}, [{'type': 'engineCylinder', 'count': 1, 'layout': 'turbine casing 3.9 m dia x 7 m'}, {'type': 'gauge', 'count': 10}], {'fixture': 'bulkhead', 'colourK': 2350}, [], [], full=True)
room(TT, 'electric_engine_room', 'Electric Engine Room (four 400 kW dynamos)', 'machinery', 640, 703, None, None, 7.3, 'Four W. H. Allen dynamo sets, switchboard gallery above', {'floor': 'steelGrey', 'walls': 'whitePaintedSteel', 'trim': 'brass'},
     None, [{'type': 'engineCylinder', 'count': 4, 'layout': 'dynamo sets'}, {'type': 'gauge', 'count': 12}], {'fixture': 'bulkhead', 'colourK': 2350}, ['the lights failed when these flooded, 02:17'], ['lights_out'], full=True)
room(TT, 'shaft_tunnels', 'Shaft Tunnels (three shafts)', 'machinery', 703, 814, None, None, 3.0, 'Watertight tunnels with the propeller shafts and bearings, escape ladders to E deck', {'floor': 'steelGrey', 'walls': 'steelGrey'}, None,
     [{'type': 'valveWheel', 'count': 4}], {'fixture': 'bulkhead', 'colourK': 2125}, [], [], full=True)
room(TT, 'aft_peak_tank', 'After Peak Tank', 'machinery', 814, 850, None, None, 3.0, 'Steel tank', {'floor': 'steelRusty', 'walls': 'steelRusty'}, None, [], {'fixture': 'bulkhead', 'colourK': 2125}, [], full=True)

# =============================================================================================
# Funnels, masts, lifeboats, bulkheads, cranes, hatches
# =============================================================================================
FUNNELS = []
for n, ft, h, dummy in [(1, 243.5, 21.3, False), (2, 361.6, 22.6, False), (3, 478.4, 22.6, False), (4, 594.3, 22.3, True)]:
    FUNNELS.append({'n': n, 'xFromBow': round(ft * FT, 2), 'x': x_of(ft), 'baseY': DECK_Y['boat'], 'casingTopY': round(DECK_Y['boat'] + 2.8, 2),
                    'topY': round(DECK_Y['boat'] + h, 2), 'height': h, 'rx': 7.47 / 2, 'rz': 5.79 / 2, 'rakeDeg': 9.46, 'dummy': dummy,
                    'blackTopM': 5.64, 'steamPipes': 2 if not dummy else 0, 'whistles': n in (1, 2), 'stays': 12,
                    'uptakeFrom': {1: 'boiler rooms 6 and 5', 2: 'boiler rooms 4 and 3', 3: 'boiler rooms 2 and 1', 4: 'turbine room ventilation and galley flues'}[n]})
MASTS = [
    {'id': 'foremast', 'xFromBow': 39.0, 'x': x_of(39.0 / FT), 'baseDeck': 'C', 'baseY': DECK_Y['C'], 'topY': 62.5, 'rakeDeg': 5.5, 'crowsNestY': 29.0,
     'derrick': True, 'notes': 'passes through the forecastle deck; crow\'s nest ladder inside the mast from C deck'},
    {'id': 'mainmast', 'xFromBow': 220.4, 'x': x_of(220.4 / FT), 'baseDeck': 'B', 'baseY': DECK_Y['B'], 'topY': 61.0, 'rakeDeg': 5.5, 'crowsNestY': None,
     'derrick': False, 'notes': 'at the aft end of the B-deck house; Marconi twin-T aerial strung between the mastheads'},
]
LIFEBOAT_STATIONS = {1: 238, 2: 238, 3: 273, 4: 273, 5: 309, 6: 309, 7: 345, 8: 345, 9: 544, 10: 544, 11: 579, 12: 579, 13: 615, 14: 615, 15: 649, 16: 649}
LAUNCH = {'7': '00:40', '5': '00:43', '3': '00:55', '8': '01:00', '1': '01:05', '6': '01:10', '16': '01:20', '14': '01:25', '12': '01:30', '9': '01:30',
          '11': '01:35', '13': '01:40', '15': '01:40', '2': '01:45', '10': '01:50', '4': '01:50', 'C': '01:40', 'D': '02:05', 'A': '02:15', 'B': '02:15'}
order = sorted(LAUNCH.keys(), key=lambda k: LAUNCH[k])
LIFEBOATS = []
for n in range(1, 17):
    ft = LIFEBOAT_STATIONS[n]
    side = 'starboard' if n % 2 == 1 else 'port'
    cutter = n in (1, 2)
    LIFEBOATS.append({'id': str(n), 'xFromBow': round(ft * FT, 2), 'x': x_of(ft), 'side': side, 'z': 13.8 if side == 'starboard' else -13.8,
                      'y': round(DECK_Y['boat'] + 1.9, 2), 'type': 'emergency cutter' if cutter else 'lifeboat', 'length': 7.67 if cutter else 9.14,
                      'beam': 2.18 if cutter else 2.77, 'depth': 0.91 if cutter else 1.22, 'capacity': 40 if cutter else 65, 'davitType': 'Welin quadrant',
                      'launchTime': LAUNCH[str(n)], 'launchOrder': order.index(str(n)) + 1, 'swungOut': cutter})
for cid, side, roof in [('C', 'starboard', False), ('D', 'port', False), ('A', 'starboard', True), ('B', 'port', True)]:
    LIFEBOATS.append({'id': cid, 'xFromBow': round(240 * FT, 2), 'x': x_of(240), 'side': side, 'z': (11.8 if not roof else 5.5) * (1 if side == 'starboard' else -1),
                      'y': round(DECK_Y['boat'] + (2.4 if roof else 0.0) + 0.5, 2), 'type': 'Engelhardt collapsible', 'length': 8.36, 'beam': 2.44, 'depth': 0.91, 'capacity': 47,
                      'davitType': 'cutter davits' if not roof else 'none (floated off)', 'launchTime': LAUNCH[cid], 'launchOrder': order.index(cid) + 1, 'onRoof': roof})
BULKHEADS = []
for letter, ft, top in [('A', 46, 'C'), ('B', 91, 'D'), ('C', 142, 'E'), ('D', 193, 'E'), ('E', 247, 'E'), ('F', 304, 'E'), ('G', 361, 'E'), ('H', 418, 'E'),
                        ('J', 478, 'E'), ('K', 514, 'D'), ('L', 583, 'D'), ('M', 640, 'D'), ('N', 703, 'D'), ('O', 757, 'D'), ('P', 814, 'D')]:
    BULKHEADS.append({'letter': letter, 'xFromBow': round(ft * FT, 2), 'x': x_of(ft), 'topDeck': top, 'topY': DECK_Y[top]})
CRANES = [{'xFromBow': round(ft * FT, 2), 'x': x_of(ft), 'z': z, 'deck': d, 'y': DECK_Y[d], 'height': 6.5, 'reach': 8.5, 'tons': t, 'serves': s}
          for ft, z, d, t, s in [(168, -5.5, 'C', 2.5, 'No. 3 hatch'), (168, 5.5, 'C', 2.5, 'No. 3 hatch'), (727, -5.5, 'B', 2.5, 'No. 5 hatch'), (727, 5.5, 'B', 2.5, 'No. 5 hatch'),
                                  (775, -5.5, 'B', 2.5, 'No. 6 hatch'), (775, 5.5, 'B', 2.5, 'No. 6 hatch'), (712, -8.0, 'A', 1.5, 'No. 4 hatch port'), (712, 8.0, 'A', 1.5, 'No. 4 hatch starboard')]]
HATCHES = [{'n': n, 'xFromBow0': round(a * FT, 2), 'xFromBow1': round(b * FT, 2), 'x0': x_of(b), 'x1': x_of(a), 'z0': z - w / 2, 'z1': z + w / 2, 'deck': d, 'y': DECK_Y[d], 'coaming': 'black' if n != 4 else 'white'}
           for n, a, b, z, w, d in [(1, 60, 76, 0, 4.5, 'B'), (2, 130, 142, 0, 5.0, 'C'), (3, 152, 166, 0, 5.0, 'C'), (4, 695, 706, -8.0, 3.0, 'B'), (4, 695, 706, 8.0, 3.0, 'B'), (5, 733, 745, 0, 5.0, 'C'), (6, 757, 769, 0, 5.0, 'C')]]

# =============================================================================================
# Materials, lighting, colours
# =============================================================================================
MATERIALS = {
    'teakDeck': {'baseColor': '#C9B183', 'roughness': 0.6, 'metalness': 0, 'plankWidth': 0.15, 'notes': 'yellow pine/teak weather decks, caulked seams, holystoned pale'},
    'pineDeck': {'baseColor': '#BFA270', 'roughness': 0.65, 'metalness': 0, 'plankWidth': 0.15},
    'teakOiled': {'baseColor': '#B38A5A', 'roughness': 0.6, 'metalness': 0, 'notes': 'rail caps, deck chairs'},
    'teakVarnished': {'baseColor': '#7E4E2A', 'roughness': 0.3, 'metalness': 0, 'notes': 'bridge joinery, Turkish bath, windows'},
    'oakPanel': {'baseColor': '#8B6A3E', 'roughness': 0.4, 'metalness': 0, 'notes': 'Irish oak, satin varnish'},
    'oakDark': {'baseColor': '#5E4426', 'roughness': 0.45, 'metalness': 0},
    'mahogany': {'baseColor': '#4A2418', 'roughness': 0.25, 'metalness': 0, 'notes': 'French polish'},
    'walnut': {'baseColor': '#A8865C', 'roughness': 0.4, 'metalness': 0, 'notes': 'light fawn French walnut (restaurant)'},
    'sycamore': {'baseColor': '#D9C9A5', 'roughness': 0.45, 'metalness': 0},
    'whiteEnamel': {'baseColor': '#F4F1E8', 'roughness': 0.15, 'metalness': 0, 'notes': 'Jacobean/Georgian painted panelling'},
    'whitePaintedSteel': {'baseColor': '#EEEBE3', 'roughness': 0.3, 'metalness': 0.1},
    'superstructureWhite': {'baseColor': '#F3F1EA', 'roughness': 0.45, 'metalness': 0.05},
    'hullBlack': {'baseColor': '#121314', 'roughness': 0.55, 'metalness': 0.2, 'notes': 'black hull with plate laps and rivets'},
    'antifouling': {'baseColor': '#8C3A2B', 'roughness': 0.8, 'metalness': 0, 'notes': 'red lead / red oxide below the waterline'},
    'sheerStripe': {'baseColor': '#C9A227', 'roughness': 0.5, 'metalness': 0.2, 'notes': 'yellow/gold sheer line at B deck'},
    'funnelBuff': {'baseColor': '#C9955F', 'roughness': 0.6, 'metalness': 0.05, 'notes': 'White Star buff'},
    'funnelBlack': {'baseColor': '#121212', 'roughness': 0.5, 'metalness': 0.2, 'notes': 'upper 5.64 m'},
    'mastRust': {'baseColor': '#7A4A31', 'roughness': 0.7, 'metalness': 0.1, 'notes': 'masts, derricks, dadoes'},
    'brass': {'baseColor': '#B8923D', 'roughness': 0.2, 'metalness': 1},
    'ormolu': {'baseColor': '#C8A04E', 'roughness': 0.3, 'metalness': 1},
    'bronze': {'baseColor': '#6B4A2A', 'roughness': 0.45, 'metalness': 1},
    'wroughtIron': {'baseColor': '#1E1E1E', 'roughness': 0.5, 'metalness': 1},
    'steelGrey': {'baseColor': '#6F7378', 'roughness': 0.6, 'metalness': 0.8},
    'steelRusty': {'baseColor': '#6B4A3A', 'roughness': 0.85, 'metalness': 0.4},
    'linoDining': {'baseColor': '#8FA8BF', 'roughness': 0.35, 'metalness': 0, 'pattern': 'dining saloon: pale blue field, red and dark blue squares, ochre keys'},
    'linoCorridor': {'baseColor': '#9B3A2F', 'roughness': 0.35, 'metalness': 0, 'pattern': 'red 6 in tiles'},
    'linoLanding': {'baseColor': '#E8DFC6', 'roughness': 0.35, 'metalness': 0, 'pattern': 'cream with black key'},
    'carpetRed': {'baseColor': '#6B1F22', 'roughness': 0.9, 'metalness': 0}, 'carpetBlue': {'baseColor': '#2A3C6E', 'roughness': 0.9, 'metalness': 0},
    'carpetGreen': {'baseColor': '#2F5A3A', 'roughness': 0.9, 'metalness': 0}, 'roseCarpet': {'baseColor': '#C97B86', 'roughness': 0.9, 'metalness': 0, 'notes': 'Rose du Barry'},
    'moorishTile': {'baseColor': '#2E5F8F', 'roughness': 0.25, 'metalness': 0, 'pattern': 'blue-green glazed tiles'},
    'marbleWhite': {'baseColor': '#EDEAE3', 'roughness': 0.2, 'metalness': 0}, 'plasterWhite': {'baseColor': '#F2EFE7', 'roughness': 0.8, 'metalness': 0},
    'canvas': {'baseColor': '#D8CFB8', 'roughness': 0.9, 'metalness': 0}, 'lifeboatWhite': {'baseColor': '#F1EEE5', 'roughness': 0.5, 'metalness': 0, 'notes': 'gunwales dark brown'},
    'velvetGreen': {'baseColor': '#3C6B4A', 'roughness': 0.85, 'metalness': 0}, 'leatherGreen': {'baseColor': '#2E4A3A', 'roughness': 0.4, 'metalness': 0},
    'leatherDark': {'baseColor': '#5A2A2A', 'roughness': 0.4, 'metalness': 0}, 'wicker': {'baseColor': '#D2B37C', 'roughness': 0.7, 'metalness': 0},
    'coal': {'baseColor': '#151515', 'roughness': 0.6, 'metalness': 0.1}, 'boilerIron': {'baseColor': '#3A3A3C', 'roughness': 0.55, 'metalness': 0.8},
    'carRed': {'baseColor': '#8E1B1B', 'roughness': 0.25, 'metalness': 0.1, 'notes': 'Renault body; black roof, brass lamps'},
    'ice': {'baseColor': '#CFE8F3', 'roughness': 0.35, 'metalness': 0}, 'gold': {'baseColor': '#D4AF37', 'roughness': 0.3, 'metalness': 1},
}
LIGHTING = {
    'interiorColourK': 2350, 'carbonFilamentK': 2125, 'lampHex': '#FFA552', 'carbonLampHex': '#FF9A3C',
    'lampCount': 10000, 'emergencyCircuit': 'passage ends, stairways, boat deck, bridge, Marconi, mast and side lights',
    'sunsetPresets': {'14 April 1912 sunset (ship time)': '18:20', 'civil dusk': '18:50', 'nautical dusk': '19:25', 'moon': 'none — new moon 17 April'},
    'nightSkyNotes': 'moonless, cloudless, flat calm; Milky Way bright; air -2 C; sea temperature -2 C; haze on the horizon reported by lookouts',
    'fixtures': {'grandStaircase': 'crystal and gilt chandelier under the dome', 'lounge': '49-light electrolier', 'smokingRoom': 'two gilt-bronze chandeliers',
                 'restaurant': 'wall brackets and rose silk table lamps', 'turkishBath': 'bronze Arab lanterns', 'corridors': 'ormolu and cut-glass ceiling lights', 'crew': 'bulkhead fittings, frosted globes'},
}

# =============================================================================================
# Sinking timeline (ship time, 14/15 April 1912). trimDeg bow-down +, listDeg port +, sinkM = vertical drop of the frame origin.
# =============================================================================================
BREAK_FT = 540.0  # between funnels 3 and 4, about the aft expansion joint / aft Grand Staircase
TIMELINE = [
    ('23:40', 0, 0.0, 0.0, 0.0, 'strike', 'Iceberg strike on the starboard bow; six forward compartments open'),
    ('23:50', 10, 0.8, -1.5, 0.3, 'flooding', 'Water 4 m above the keel forward; boiler room 6 abandoned; slight starboard list'),
    ('00:00', 20, 1.5, -1.5, 0.6, 'mailRoom', 'Mail room afloat; the designer gives the ship an hour or two'),
    ('00:15', 35, 2.5, -1.0, 1.0, 'cqd', 'CQD sent; passengers mustered with lifebelts'),
    ('00:30', 50, 3.2, 0.0, 1.4, 'boatsSwung', 'Boats swung out; water over G deck forward'),
    ('00:45', 65, 4.0, 1.0, 1.9, 'firstBoat', 'First boat (No. 7) lowered; first distress rocket'),
    ('01:00', 80, 4.8, 2.0, 2.4, 'listing', 'Water rising in boiler room 5 after the bunker door bursts; list to port begins'),
    ('01:15', 95, 5.6, 3.0, 3.0, 'nameUnder', 'The name on the bow goes under; forecastle awash'),
    ('01:30', 110, 6.6, 4.0, 3.7, 'wellDeck', 'Water reaches the forward well deck; boats 12, 9 away'),
    ('01:45', 125, 8.0, 5.5, 4.6, 'bridgeNear', 'Water near the bridge; collapsible C away at 01:40'),
    ('02:00', 140, 10.0, 7.0, 5.8, 'aDeck', 'Water at A deck forward; collapsible D 02:05'),
    ('02:10', 150, 13.0, 8.0, 7.2, 'boatDeckAwash', 'Boat deck awash forward; the band plays on'),
    ('02:15', 155, 17.0, 9.0, 9.0, 'bridgeUnder', 'Bridge under; collapsibles A and B float off; forward funnel collapses 02:17'),
    ('02:17', 157, 20.0, 9.0, 10.5, 'lightsOut', 'Lights flicker and fail'),
    ('02:18', 158, 23.0, 8.0, 11.5, 'breakup', 'Hull breaks between the third and fourth funnels'),
    ('02:19', 159, 30.0, 4.0, 13.5, 'sternRises', 'Bow sinks; stern settles back then rises'),
    ('02:20', 160, 45.0, 0.0, 16.0, 'sternVertical', 'Stern nearly vertical'),
    ('02:21', 161, 70.0, 0.0, 24.0, 'plunge', 'Stern slides under'),
    ('02:22', 162, 85.0, 0.0, 40.0, 'gone', 'Gone; 1,500 in the water at -2 C'),
]
SINKING = [{'time': t, 'minutesAfter': m, 'trimDeg': trim, 'listDeg': lst, 'sinkM': sink, 'event': ev, 'note': note, **({'breakX': x_of(BREAK_FT)} if ev == 'breakup' else {})}
           for t, m, trim, lst, sink, ev, note in TIMELINE]

# =============================================================================================
# Film beats (paraphrased, locations on the real ship) and landmarks
# =============================================================================================
FILM = [
    ('wreck_dive', 1, 'Treasure hunters dive the wreck and find the safe', 'modern', 'wreck', None, 'night', 'An ROV finds a safe in the former parlour suite; inside, a sketch instead of the jewel.'),
    ('old_lady_call', 2, 'The old lady calls the treasure hunter', 'modern', 'research ship', None, 'day', 'She claims to be the woman in the drawing.'),
    ('boarding_first_class', 3, 'Boarding at Southampton — first class', 'C', 'grand_staircase_C', 'the C-deck entrance via the D-deck gangway', '12:00', 'The heiress, her fiancé and her mother arrive by motor car; the Renault is loaded through the forward hatch.'),
    ('poker_win', 4, 'A poker game wins two steerage tickets', 'shore', 'pub by the dock', None, '11:45', 'The artist and his friend win tickets and sprint for the gangway.'),
    ('steerage_boarding', 5, 'Boarding at Southampton — steerage', 'E', 'cross_passage_fwd', 'E-deck forward gangway', '12:00', 'Steerage passengers are inspected for lice before boarding.'),
    ('departure', 6, 'Departure', 'B', 'poop deck and forward well', None, '12:00', 'Lines cast off; near-collision with another liner in the river.'),
    ('king_of_the_world', 7, 'The bow at speed, dolphins', 'B', 'forecastle', 'the stem head', 'afternoon', 'The two friends ride the bow and whoop at the horizon.'),
    ('lunch_with_the_designer', 8, 'Lunch with the designer and the chairman', 'B', 'cafe_parisien', None, 'noon', 'Talk of lifeboats, the ship\'s name and Freud.'),
    ('stern_rescue', 9, 'The stern, the near fall and the rescue', 'B', 'stern_rail', 'the poop deck taffrail and the flagstaff', 'night', 'She climbs over the stern rail; he talks her back and catches her when she slips.'),
    ('promenade_walk', 10, 'A walk along the promenade', 'A', 'promenade_A_stbd', None, 'morning', 'He shows her his sketchbook of Paris; she sees he has talent.'),
    ('spitting_lesson', 11, 'The spitting lesson', 'boat', 'boat_deck_stbd_aft', 'the boat-deck rail by the gymnasium', 'afternoon', 'Interrupted by her mother and the Denver millionairess.'),
    ('dinner_descent', 12, 'Descending the Grand Staircase to dinner', 'A', 'grand_staircase_A', 'the clock on the A-deck landing', '19:00', 'He waits by the clock in a borrowed dinner jacket.'),
    ('first_class_dinner', 13, 'The first-class dinner', 'D', 'dining_saloon', None, '19:30', 'He holds his own against the fiancé: "make each day count".'),
    ('steerage_party', 14, 'The real party below decks', 'C', 'general_room_3rd', None, '22:00', 'Irish music, dancing on the tables, a pint downed in one.'),
    ('mother_warns', 15, 'Her mother tightens the corset', 'B', 'parlour_suite_B52', None, 'morning', 'The family money is gone; the marriage is the only way out.'),
    ('sunday_service', 16, 'Sunday service', 'D', 'dining_saloon', None, '10:30', 'Hymns; the steerage friend is turned away at the door by a steward.'),
    ('inspection_tour', 17, 'Tour with the designer; the lifeboat count', 'boat', 'boat_deck_port_fwd', None, 'midday', 'Not enough boats for half the people aboard.'),
    ('flying_at_the_bow', 18, 'Sunset at the bow', 'B', 'bow_tip', 'the stem head and forecastle rail', '18:20', 'Eyes closed, arms out, the ship running at 22 knots.'),
    ('the_portrait', 19, 'The portrait in the suite', 'B', 'parlour_suite_B52', None, 'night', 'Shown only as the finished charcoal sketch; the jewel worn.'),
    ('boiler_room_chase', 20, 'Through the boiler rooms', 'tankTop', 'boiler_room_6', None, 'night', 'Chased by the valet, the pair run through the stokeholds and up into the hold.'),
    ('the_car', 21, 'The motor car in the hold', 'orlop', 'hold2_tween', None, 'night', 'Fade to black.'),
    ('iceberg_strike', 22, 'Iceberg right ahead', 'boat', 'bridge', 'the bridge and the crow\'s nest', '23:40', 'Hard a-starboard, engines full astern; the berg grinds along the starboard bow.'),
    ('inspection', 23, 'The designer\'s verdict', 'boat', 'wheelhouse', 'the chart room', '00:05', 'The ship will founder; an hour, two at most.'),
    ('planted_necklace', 24, 'The jewel is planted', 'B', 'parlour_suite_B52', None, '00:10', 'The valet slips the jewel into the artist\'s coat pocket.'),
    ('arrest', 25, 'Handcuffed below', 'E', 'master_at_arms', None, '00:20', 'The Master-at-Arms locks him to a pipe as the water rises.'),
    ('axe_rescue', 26, 'The axe', 'E', 'master_at_arms', 'the E-deck corridors, flooding', '01:00', 'She finds a fire axe and cuts the chain on the second swing.'),
    ('locked_gates', 27, 'Locked gates below', 'E', 'cross_passage_aft', 'third-class stairs and gates', '01:20', 'Steerage passengers held back behind iron gates until a bench breaks the lock.'),
    ('band_plays', 28, 'The band plays on', 'boat', 'boat_deck_port_fwd', 'outside the gymnasium and the first-class entrance', '01:30', 'A hymn as the water nears the boat deck.'),
    ('lifeboats_lowered', 29, 'Women and children first', 'boat', 'boat_deck_stbd_aft', None, '01:40', 'She refuses the boat and jumps back aboard at A deck.'),
    ('gentlemen_dressed_in_best', 30, 'Dressed in our best', 'A', 'smoking_room', None, '02:00', 'The millionaire takes brandy; the designer stands by the clock.'),
    ('old_couple', 31, 'The old couple in bed', 'C', 'staterooms_C_mid', None, '02:05', 'Water floods the stateroom as they hold each other.'),
    ('bow_under', 32, 'The bow goes under', 'boat', 'bridge', None, '02:15', 'Water sweeps the bridge; the forward funnel falls.'),
    ('lights_out', 33, 'The lights go out', 'tankTop', 'electric_engine_room', None, '02:17', 'Engineers keep the dynamos running to the last.'),
    ('breakup', 34, 'The ship breaks in two', 'A', 'grand_staircase_aft_A', 'between the third and fourth funnels', '02:18', 'The stern settles back, then rises vertical.'),
    ('stern_plunge', 35, 'The final plunge', 'B', 'stern_rail', 'the poop deck taffrail', '02:20', 'They ride the stern down and kick for the surface.'),
    ('the_door', 36, 'The floating door', 'sea', 'sea', None, '02:30', 'One of them floats on a panel of debris; a whistle brings the boat back.'),
    ('carpathia', 37, 'The rescue ship', 'sea', 'sea', None, '04:10', 'A new name given to the purser.'),
    ('ending', 38, 'The ending at the staircase', 'A', 'grand_staircase_A', 'the clock', 'timeless', 'The jewel dropped into the sea; the staircase, the clock, applause.'),
]
FILM_SCENES = []
for sid, order_, title, deck, locid, where, tod, beat in FILM:
    FILM_SCENES.append({'id': sid, 'order': order_, 'title': title, 'deck': deck, 'location': locid, 'where': where or '', 'timeOfDay': tod, 'beatSummary': beat})

# landmarks (ARCHITECTURE §11 required LOCATIONS ids) -----------------------------------------
BOAT = DECK_Y['boat']
landmark('spawn_southampton', 'First-class entrance, C Deck (starboard)', 'C', 320, 7.5, math.pi / 2)
landmark('bow_tip', 'The bow (stem head, forecastle)', 'B', 6, 0.0, 0.0, y=Y_B + sheer(6))
landmark('forecastle', 'Forecastle deck by the foremast', 'B', 60, 3.0, 0.0, y=Y_B + sheer(60))
landmark('well_deck_fwd', 'Forward well deck (third-class promenade)', 'C', 150, 0.0, 0.0, y=DECK_Y['C'] + sheer(150))
landmark('bridge', 'Navigating bridge (centre, by the telegraphs)', 'boat', 196, 0.0, 0.0)
landmark('wheelhouse', 'Wheelhouse (at the wheel)', 'boat', 212, 0.0, 0.0)
landmark('marconi_room', 'Marconi operating room', 'boat', 295, 0.0, 0.0)
landmark('boat_deck_port_fwd', 'Boat deck, port, forward boat group (by the band)', 'boat', 312, -11.5, 0.0)
landmark('boat_deck_stbd_aft', 'Boat deck, starboard, by the gymnasium rail', 'boat', 360, 12.0, 0.0)
landmark('gymnasium', 'Gymnasium', 'boat', 361, 7.3, math.pi)
landmark('grand_staircase_boat', 'Grand Staircase gallery, Boat Deck (under the dome)', 'boat', 322, 0.0, 0.0)
landmark('grand_staircase_A', 'Grand Staircase, A Deck landing (the clock)', 'A', 326, 0.0, 0.0)
landmark('grand_staircase_D', 'Grand Staircase foot, D Deck (reception)', 'D', 305, 0.0, math.pi)
landmark('lounge', 'First-Class Lounge', 'A', 438, 0.0, math.pi)
landmark('smoking_room', 'First-Class Smoking Room (by the fireplace)', 'A', 600, 0.0, math.pi)
landmark('reading_room', 'Reading and Writing Room', 'A', 391, -7.0, 0.0)
landmark('verandah_cafe', 'Verandah Café (starboard)', 'A', 639, 5.5, math.pi)
landmark('cafe_parisien', 'Café Parisien', 'B', 625, 11.0, math.pi)
landmark('restaurant', 'À la Carte Restaurant', 'B', 622, -3.0, math.pi)
landmark('parlour_suite_B52', 'Parlour Suite B-52 sitting room', 'B', 345, -5.5, math.pi)
landmark('promenade_A_stbd', 'A-deck promenade, starboard (enclosed section)', 'A', 300, 11.5, 0.0)
landmark('reception_room', 'First-Class Reception Room', 'D', 336, 0.0, math.pi)
landmark('dining_saloon', 'First-Class Dining Saloon (centre aisle)', 'D', 420, 0.0, math.pi)
landmark('second_class_dining', 'Second-Class Dining Saloon', 'D', 689, 0.0, math.pi)
landmark('third_class_general', 'Third-Class General Room (the party)', 'C', 810, 7.0, math.pi)
landmark('third_class_dining', 'Third-Class Dining Saloon', 'F', 390, 6.0, math.pi)
landmark('scotland_road', 'Scotland Road, E Deck', 'E', 300, -6.3, math.pi)
landmark('master_at_arms', "Master-at-Arms' office, E Deck", 'E', 156, 11.0, math.pi / 2)
landmark('pool', 'Swimming Bath', 'F', 277, 8.0, 0.0)
landmark('turkish_bath', 'Turkish Baths cooling room', 'F', 326, 6.0, math.pi)
landmark('squash_court', 'Squash Racquet Court', 'G', 175, 3.5, 0.0)
landmark('cargo_hold_2', 'No. 2 hold, by the motor car', 'orlop', 118, 2.0, -math.pi / 2)
landmark('boiler_room_6', 'Boiler Room No. 6 (forward stokehold)', 'tankTop', 200, 0.0, math.pi, y=DECK_Y['tankTop'] + 0.3)
landmark('boiler_room_1', 'Boiler Room No. 1', 'tankTop', 500, 0.0, math.pi, y=DECK_Y['tankTop'] + 0.3)
landmark('engine_room', 'Reciprocating Engine Room (starting platform)', 'tankTop', 548, 0.0, math.pi, y=DECK_Y['tankTop'] + 0.6)
landmark('turbine_room', 'Turbine Engine Room', 'tankTop', 611, 0.0, math.pi, y=DECK_Y['tankTop'] + 0.6)
landmark('mail_room', 'Sea Post Office, G Deck', 'G', 150, 9.0, math.pi / 2)
landmark('poop_deck', 'Poop deck (third-class promenade)', 'B', 800, 0.0, math.pi, y=Y_B + sheer(800))
landmark('stern_rail', 'Stern rail (taffrail) by the flagstaff', 'B', 876, 0.0, math.pi, y=Y_B + sheer(876))
landmark('docking_bridge', 'Docking bridge', 'B', 846, 0.0, math.pi, y=Y_B + sheer(846) + 2.4)
landmark('third_class_cabin', 'Third-class cabin, E Deck forward', 'E', 200, -10.5, math.pi / 2)
landmark('second_class_cabin', 'Second-class cabin, D Deck aft', 'D', 760, 3.0, -math.pi / 2)
landmark('first_class_stateroom', 'First-class stateroom, C Deck', 'C', 400, 9.0, -math.pi / 2)
landmark('officers_quarters', "Officers' quarters, Boat Deck", 'boat', 258, -3.5, 0.0)
landmark('crows_nest', "Crow's nest", 'C', 42, 0.0, 0.0, y=29.0)
landmark('compass_platform', 'Compass platform between funnels 2 and 3', 'boat', 436, 0.0, 0.0, y=BOAT + 0.9 + 2.2)
landmark('exterior_starboard_quarter', 'Exterior view: starboard quarter', 'world', 700, 90.0, math.radians(150), y=20.0, extra={'mode': 'free', 'pitch': -0.12, 'xFromBowOverride': 700})
landmark('exterior_port_bow', 'Exterior view: port bow', 'world', 20, -110.0, math.radians(-35), y=22.0, extra={'mode': 'free', 'pitch': -0.14})
LANDMARKS['exterior_starboard_quarter']['x'] = x_of(700) - 80
LANDMARKS['exterior_port_bow']['x'] = x_of(20) + 70

# =============================================================================================
# Assemble and write
# =============================================================================================
DECKS = []
NEXT = {d: (DECK_ORDER[i - 1] if i > 0 else None) for i, d in enumerate(DECK_ORDER)}
EXTENT = {'boat': (190, 685), 'A': (177, 723), 'B': (0, 882.75), 'C': (0, 878), 'D': (0, 866), 'E': (0, 866), 'F': (46, 850), 'G': (46, 850), 'orlop': (0, 814), 'tankTop': (0, 850)}
for d in DECK_ORDER:
    above = NEXT[d]
    e0, e1 = EXTENT[d]
    DECKS.append({'id': d, 'name': DECK_NAMES[d], 'yKeel': round(DECK_KEEL_FT[d] * FT, 3), 'y': DECK_Y[d],
                  'heightToNext': round((DECK_Y[above] - DECK_Y[d]) if above else 4.0, 3),
                  'hullExtent': {'xFromBowStart': round(e0 * FT, 2), 'xFromBowEnd': round(e1 * FT, 2), 'x0': x_of(e1), 'x1': x_of(e0)},
                  'openDeckAreas': OPEN[d], 'deckhouses': DECKHOUSES[d], 'rooms': ROOMS[d], 'corridors': CORRIDORS[d], 'stairs': STAIRS[d]})

SHIP = {
    'meta': {
        'name': 'RMS Titanic', 'builder': 'Harland & Wolff, Belfast, yard no. 401', 'launched': '1911-05-31', 'maidenVoyage': '1912-04-10',
        'generatedBy': 'scripts/gen-shipspec.py', 'conventions': 'metres; origin amidships (midpoint of LBP) at the design waterline; +x bow, +y up, +z starboard; xFromBow = metres aft of the forward perpendicular',
        'sources': ['research/01-dimensions-hull-exterior.md', 'research/02-deckplans-boat-A-B-C.md', 'research/03-deckplans-D-E-F-G-orlop-tanktop.md', 'research/04-interiors-materials-finishes.md',
                    'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAccomo.php', 'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepWC.php', 'https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html'],
        'notes': 'Positions ±3 m (measured from 1911 plates). Interior decks are flat at their midship height; the hull skin, forecastle and poop follow hull.sheerProfile.',
    },
    'dims': {'loa': round(LOA_FT * FT, 2), 'lbp': round(LBP_FT * FT, 2), 'beamMoulded': round(92.5 * FT, 2), 'beamExtreme': round(92.5 * FT + 0.1, 2), 'draught': round(DRAUGHT, 2),
             'depthMoulded': round(64.25 * FT, 2), 'keelToBoatDeck': round(92.5 * FT, 2), 'keelToBridgeTop': round(104 * FT, 2), 'keelToFunnelTop': round(163.67 * FT, 2),
             'grossTonnage': 46328, 'freeboardAmidships': round((74.0 * FT) - DRAUGHT, 2), 'stemX': x_of(0), 'sternX': x_of(LOA_FT), 'apX': x_of(AP_FT), 'keelY': round(Y_KEEL, 3),
             'speedKnots': 22.5},
    'frame': {'originXFromBowM': round(MID_M, 3), 'waterlineY': 0.0, 'keelY': round(Y_KEEL, 3)},
    'hull': {
        'stations': [station(ft) for ft in STATION_FT],
        'sheerProfile': [[round(ft * FT, 2), round(sheer(ft), 3)] for ft in range(0, 883, 20)] + [[round(LOA_FT * FT, 2), round(sheer(LOA_FT), 3)]],
        'deckEdgeY': Y_B, 'parallelBody': {'xFromBow0': round(PARALLEL_FWD_FT * FT, 2), 'xFromBow1': round(PARALLEL_AFT_FT * FT, 2)},
        'colours': {'hull': '#121314', 'antifouling': '#8C3A2B', 'boottop': '#8C3A2B', 'sheerStripe': '#C9A227', 'superstructure': '#F3F1EA', 'funnelBuff': '#C9955F', 'funnelBlack': '#121212',
                    'deckPlanking': '#C9B183', 'lifeboat': '#F1EEE5', 'davits': '#F3F1EA', 'bronze': '#6B4A2A', 'mastRust': '#7A4A31', 'coamings': '#1A1A1A'},
        'paintBands': {'antifoulingTopY': -0.9, 'sheerStripeY': Y_B, 'sheerStripeHeight': 0.3, 'blackTopY': Y_B, 'whiteStartsAtDeck': 'B'},
        'platingAndRivets': {'plateW': 9.1, 'plateH': 1.8, 'rivetPitch': 0.11, 'strakes': 'in-and-out strakes, hydraulic riveting amidships, hand riveting at the ends; ~3 million rivets', 'lapHeight': 0.03},
        'portholeRows': [
            {'deck': 'C', 'y': round(DECK_Y['C'] + 1.5, 2), 'xFromBowStart': 51, 'xFromBowEnd': 192, 'pitch': 1.4, 'diameter': 0.48, 'square': False, 'notes': 'large pivoting ports, top row of the black hull'},
            {'deck': 'D', 'y': round(DECK_Y['D'] + 1.5, 2), 'xFromBowStart': 14, 'xFromBowEnd': 262, 'pitch': 1.1, 'diameter': 0.43, 'square': False},
            {'deck': 'E', 'y': round(DECK_Y['E'] + 1.4, 2), 'xFromBowStart': 14, 'xFromBowEnd': 262, 'pitch': 1.0, 'diameter': 0.38, 'square': False},
            {'deck': 'F', 'y': round(DECK_Y['F'] + 1.4, 2), 'xFromBowStart': 20, 'xFromBowEnd': 255, 'pitch': 1.0, 'diameter': 0.33, 'square': False},
            {'deck': 'G', 'y': round(DECK_Y['G'] + 1.5, 2), 'xFromBowStart': 20, 'xFromBowEnd': 60, 'pitch': 1.2, 'diameter': 0.3, 'square': False, 'notes': 'sparse, ends only'},
            {'deck': 'G', 'y': round(DECK_Y['G'] + 1.5, 2), 'xFromBowStart': 210, 'xFromBowEnd': 255, 'pitch': 1.2, 'diameter': 0.3, 'square': False},
        ],
        'anchors': {'bower': [{'xFromBow': 6.0, 'x': x_of(6 / FT), 'y': round(Y_B + sheer(6 / FT) - 2.0, 2), 'z': 2.9, 'mass_t': 7.9}, {'xFromBow': 6.0, 'x': x_of(6 / FT), 'y': round(Y_B + sheer(6 / FT) - 2.0, 2), 'z': -2.9, 'mass_t': 7.9}],
                    'centre': {'xFromBow': 6.5, 'x': x_of(6.5 / FT), 'y': round(Y_B + sheer(6.5 / FT), 2), 'z': 0.0, 'mass_t': 15.7, 'length': 5.64, 'stowed': 'in a well on the forecastle centreline, with the anchor crane'}},
        'propellers': [{'x': x_of(818), 'y': round(Y_KEEL + 3.0, 2), 'z': 7.0, 'diameter': 7.16, 'blades': 3, 'side': 'starboard'}, {'x': x_of(818), 'y': round(Y_KEEL + 3.0, 2), 'z': -7.0, 'diameter': 7.16, 'blades': 3, 'side': 'port'},
                       {'x': x_of(839), 'y': round(Y_KEEL + 3.0, 2), 'z': 0.0, 'diameter': 5.18, 'blades': 3, 'side': 'centre'}],
        'rudder': {'x': x_of(AP_FT), 'top': -0.8, 'bottom': round(Y_KEEL + 0.3, 2), 'chord': 4.65, 'notes': 'post at the AP; blade hangs aft of it'},
        'bilgeKeels': {'xFromBow0': round(275 * FT, 2), 'xFromBow1': round(575 * FT, 2), 'depth': 0.64},
        'nameplates': {'bow': {'text': 'TITANIC', 'xFromBow': 7.0, 'y': round(Y_B + sheer(7 / FT) - 1.1, 2), 'height': 0.457, 'colour': '#C9A227'},
                       'stern': {'text': 'TITANIC', 'text2': 'LIVERPOOL', 'xFromBow': round(LOA_FT * FT - 1.5, 2), 'y': round(Y_B + sheer(LOA_FT) - 1.8, 2), 'height': 0.457, 'height2': 0.305, 'colour': '#C9A227'}},
        'expansionJoints': [round(278 * FT, 2), round(509 * FT, 2)],
    },
    'decks': DECKS,
    'grandStaircases': {
        'forward': {'xFromBow': round(315 * FT, 2), 'x': x_of(315), 'z': 0.0, 'width': 4.9, 'decks': ['boat', 'A', 'B', 'C', 'D', 'E'], 'wellLength': 10.0, 'wellWidth': 17.0, 'landingDepth': 5.2,
                    'domeRx': 5.0, 'domeRz': 3.8, 'domeHeight': 2.2, 'domeY': round(DECK_Y['boat'] + 2.6, 2), 'clockPanel': 'Honour and Glory Crowning Time, A-deck landing', 'balustrade': 'wrought iron with ormolu swags',
                    'oak': '#8B6A3E', 'stepsPerFlight': 12, 'lifts': {'count': 3, 'xFromBow': round(293 * FT, 2), 'x': x_of(293), 'decks': ['A', 'B', 'C', 'D', 'E']}},
        'aft': {'xFromBow': round(550 * FT, 2), 'x': x_of(550), 'z': 0.0, 'width': 3.6, 'decks': ['A', 'B', 'C'], 'wellLength': 7.0, 'wellWidth': 12.0, 'landingDepth': 4.0,
                'domeRx': 3.0, 'domeRz': 3.0, 'domeHeight': 1.4, 'domeY': round(DECK_Y['boat'] + 0.3, 2), 'clockPanel': 'plain clock', 'balustrade': 'wrought iron with ormolu swags', 'oak': '#8B6A3E', 'stepsPerFlight': 12},
    },
    'breakX': x_of(BREAK_FT),
    'funnels': FUNNELS, 'masts': MASTS, 'lifeboats': LIFEBOATS, 'bulkheads': BULKHEADS, 'cranes': CRANES, 'hatches': HATCHES,
    'bridge': {'x0': x_of(203), 'x1': x_of(190), 'z0': -14.0, 'z1': 14.0, 'y': DECK_Y['boat'], 'height': 2.5, 'wingCabs': {'z': 13.2, 'w': 2.4, 'd': 2.4},
               'wheelhouse': {'x0': x_of(218), 'x1': x_of(203), 'z0': -4.1, 'z1': 4.1, 'windows': 5}, 'equipment': ['5 order telegraphs', 'telemotor wheel', 'standard compass', 'steering compass', 'loud-speaking telephones']},
    'dockingBridge': {'x': x_of(846), 'y': round(Y_B + sheer(846) + 2.4, 2), 'z0': -13.0, 'z1': 13.0, 'width': 1.6},
    'marconiRoom': {'x0': x_of(305), 'x1': x_of(285), 'z0': -6.0, 'z1': 6.0, 'y': DECK_Y['boat']},
    'compassPlatform': {'x': x_of(436), 'y': round(BOAT + 0.9, 2), 'height': 2.2},
    'machinery': {'boilerRooms': BOILER_ROOMS, 'boilerCount': {'doubleEnded': 24, 'singleEnded': 5, 'diameter': 4.80, 'lengthDE': 6.10, 'lengthSE': 3.58, 'furnacesPerEnd': 3},
                  'reciprocatingEngineRoom': {'x0': x_of(583), 'x1': x_of(514), 'engines': [{'z': 7.0, 'height': 9.1, 'cylinders': [1.372, 2.134, 2.464, 2.464], 'stroke': 1.905}, {'z': -7.0, 'height': 9.1, 'cylinders': [1.372, 2.134, 2.464, 2.464], 'stroke': 1.905}]},
                  'turbineRoom': {'x0': x_of(640), 'x1': x_of(583), 'turbine': {'diameter': 3.86, 'length': 7.0, 'z': 0.0}},
                  'electricEngineRoom': {'x0': x_of(703), 'x1': x_of(640), 'dynamos': 4}, 'shaftTunnels': {'x0': x_of(814), 'x1': x_of(703), 'shaftZ': [-7.0, 0.0, 7.0], 'shaftY': round(Y_KEEL + 3.0, 2)},
                  'uptakes': [{'funnel': 1, 'fromBoilerRooms': [6, 5]}, {'funnel': 2, 'fromBoilerRooms': [4, 3]}, {'funnel': 3, 'fromBoilerRooms': [2, 1]}, {'funnel': 4, 'fromBoilerRooms': []}],
                  'firemensPassage': {'x0': x_of(193), 'x1': x_of(91), 'z0': -1.3, 'z1': 1.3, 'y': DECK_Y['tankTop'], 'height': 2.6},
                  'iceDamage': {'xFromBow0': 0, 'xFromBow1': 91.4, 'yAboveKeel': 3.0, 'side': 'starboard', 'compartments': ['forepeak', 'hold1', 'hold2', 'hold3', 'boiler_room_6', 'boiler_room_5']}},
    'cargo': {'holds': [{'n': 1, 'x0': x_of(91), 'x1': x_of(46), 'deck': 'tankTop', 'contents': 'general cargo'}, {'n': 2, 'x0': x_of(142), 'x1': x_of(91), 'deck': 'orlop', 'contents': 'general cargo, the motor car'},
                        {'n': 3, 'x0': x_of(193), 'x1': x_of(142), 'deck': 'orlop', 'contents': 'baggage, mails, specie; coal below'}, {'n': 5, 'x0': x_of(757), 'x1': x_of(703), 'deck': 'orlop', 'contents': 'refrigerated cargo'},
                        {'n': 6, 'x0': x_of(814), 'x1': x_of(757), 'deck': 'orlop', 'contents': 'general cargo'}],
              'renaultCar': {'hold': 2, 'x': x_of(118), 'z': -3.0, 'deck': 'orlop', 'y': DECK_Y['orlop'], 'colour': '#8E1B1B', 'yaw': 0.0, 'est': True}},
    'materials': MATERIALS, 'lighting': LIGHTING, 'sinkingTimeline': SINKING,
    'lifeboatLaunches': [{'boat': k, 'time': LAUNCH[k], 'side': ('starboard' if (k.isdigit() and int(k) % 2 == 1) or k in ('A', 'C') else 'port')} for k in order],
    'filmScenes': FILM_SCENES, 'landmarks': LANDMARKS,
    'deckPlanAssets': [],
}

HEADER = '''/**
 * RMS Titanic — authoritative ship specification for the game (GENERATED by scripts/gen-shipspec.py; edit the
 * generator, not this file). Frame (ARCHITECTURE.md §1): metres, origin amidships (midpoint of the 850 ft LBP) at the
 * design waterline (draught 10.54 m); +x toward the bow, +y up, +z starboard (port is -z). Every positioned item also
 * carries xFromBow (metres aft of the forward perpendicular). Deck heights are the sworn Board of Trade figures
 * (Boat Deck 92 ft 6 in above keel, A-B 9 ft 6 in, B-C 9 ft, C-D 9 ft, D-E 10 ft 6 in, E-F 9 ft, F-G 8 ft 6 in, G-Orlop 8 ft).
 * Interior deck plates are flat at their amidships height; hull skin, forecastle and poop follow hull.sheerProfile.
 */
'''
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'data', 'shipSpec.js')
with open(out, 'w') as f:
    f.write(HEADER)
    f.write('export const SHIP = ')
    f.write(json.dumps(SHIP, indent=1, ensure_ascii=False))
    f.write(';\n\nexport default SHIP;\n')
rooms = sum(len(d['rooms']) for d in DECKS)
print(f'wrote {out}: {len(DECKS)} decks, {rooms} rooms, {len(LANDMARKS)} landmarks, {len(SHIP["hull"]["stations"])} stations, {os.path.getsize(out)//1024} kB')
