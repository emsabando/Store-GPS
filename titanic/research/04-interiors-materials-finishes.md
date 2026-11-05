# RMS Titanic (1912) — Interior design, materials, finishes, colours, furniture and lighting (PBR / prop reference)

Research dossier for the free-roam 3D recreation. Every number carries its unit and a metric conversion (1 ft = 0.3048 m, 1 in = 25.4 mm) and a source URL. Where sources disagree, both values are recorded and a **recommended value** is given with reasoning.

**Conventions.** "ft from bow" = distance aft of the stem at the load waterline (forward perpendicular), the same frame used in `01-dimensions-hull-exterior.md` and `02-deckplans-boat-A-B-C.md`. Port = left facing forward, starboard = right. Positions marked **[02]** are copied from the sibling deck-plan report (measured on the 1911 *Shipbuilder* plates, ±10 ft); positions marked **[derived]** were computed here from the British Wreck Commissioner's room lengths chained aft from the forward Grand Staircase well (298–331 ft) and carry ±15 ft (±4.6 m).

**Source quality.** Primary: the 1911 *Shipbuilder* special issue (public-domain scans/transcription at GG Archives), the British Wreck Commissioner's Report (titanicinquiry.org), the 1911 White Star brochure as quoted by Wikipedia, and period photographs of *Olympic* (the two ships' first-class decoration was "largely the same" — Shipbuilder). Secondary: Wikipedia's three facilities articles (which cite Beveridge, Chirnside, Lynch & Marschall), the TRMA paint reference (Art Braunschweiger, with input from Ken Marschall), Nigel Bryant's TRMA interior survey, and Titanic Pages. Encyclopedia Titanica (ET) and Titanic Connections block automated access; facts taken from their search snippets are flagged **[snippet]** and should be opened in a browser if load-bearing. No photograph of most *Titanic* rooms exists; where a room differed from *Olympic* it is stated.

**Hex colours are approximations.** No paint sample or dye formula survives for any interior finish; the hex values were derived here from the written period descriptions, surviving *Olympic* woodwork, recovered artefacts and the modellers' paint matches in the TRMA reference. Treat them as starting values for PBR base colour and tune against the *Olympic* photographs listed in §30.

---

## 1. Master material library (PBR starting values)

| Material | Where used | Period description | Approx. base colour (hex) | Suggested finish | Source |
|---|---|---|---|---|---|
| English/Irish oak, polished, carved | Grand Staircases, Lounge, Gymnasium board, 2nd-class dining, 2nd-class smoke room, 3rd-class deck furniture (teak) | "solid Irish oak", "finely carved boiserie", "rich oak paneling" | #8B6A3E (lit), #5E4426 (shadowed fielded panels) | satin varnish, roughness 0.35–0.45 | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic ; https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html |
| Mahogany, dark, polished | 1st-class Smoking Room, Reception Room carcass (painted), 2nd-class cabin furniture, 2nd-class library furniture, dining-saloon swivel chairs | "best mahogany", "dark mahogany panelling inlaid with mother-of-pearl" | #4A2418 ; highlights #7A3B27 | French polish, roughness 0.25 | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic ; https://trmaarchive.com/articles/nigelbryant/interior.shtml |
| French walnut, "light fawn brown" | À la Carte Restaurant walls and chairs | "beautifully marked French walnut in a light fawn brown colour" | #A8865C ; figure #7C5A38 | satin, roughness 0.4 | https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html |
| Sycamore, light | 2nd-class Library panelling; some "Modern Dutch" cabins | "sycamore, with carvings; mahogany dado" | #D9C9A5 | satin, roughness 0.45 | same (Shipbuilder) ; ET forum [snippet] https://www.encyclopedia-titanica.org/community/posts/438724/ |
| Teak, varnished (interior) | Turkish-bath dado/doors/stanchions, pool stairs and cubicle doors, bridge wheel and binnacle, deck benches | "warm-coloured teak" | #7E4E2A | varnish, roughness 0.3 | Shipbuilder ; https://trmaarchive.com/paint |
| Teak, oiled (exterior rail caps) | Hand-rail caps on steel stanchions, leadsman's platform | "pale, faded golden-brown Burmese teak, oiled, not varnished" | #B38A5A | oiled, roughness 0.6 | https://trmaarchive.com/paint |
| Pine, painted white enamel | 3rd-class General Room, Smoke Room, cabins, 3rd-class dining panels; Gymnasium (white-painted oak per Wikipedia, white-painted pine per the brief) | "panelled and framed in pine, finished in white enamel" | #F1EEE6 (gloss) | gloss enamel, roughness 0.15 | Shipbuilder ; https://en.wikipedia.org/wiki/Second-_and_third-class_facilities_on_the_Titanic |
| Carved panelling painted glossy white (Jacobean / Georgian) | Dining Saloon, Reception Room, Reading & Writing Room, Restaurant Reception, 1st-class B/C-deck corridors (Venesta plywood), 2nd-class cabins | "painted glossy white enamel", "white paneling, delicately carved in low relief" | #F4F1E8 ; mouldings pick out #E9E4D6 | gloss, roughness 0.12–0.2 | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic |
| Dove-grey accents | Reading & Writing Room | "white walls with dove grey accents" | #B9B7B0 | satin | same |
| Wrought iron, black | Staircase balustrades, dome ribs, deck benches' ends, grilles | "light wrought-iron scrollwork" | #1E1E1E | roughness 0.5, metal 1 | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Ormolu / gilt bronze | Balustrade swags, chandeliers, sconces, candelabra, restaurant mouldings | "ormolu swags in the Louis XIV style", "gilt-brass accents" | #C8A04E ; shadow #8A6A2A | metal 1, roughness 0.3 | same ; https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic |
| Bronze, patinated | Cherub lamp, Turkish-bath Arab lamps, swing-door grilles, bronze window grilles | "bronze cherub", "bronze Arab lamps" | #6B4A2A ; verdigris touches #5E7A66 | metal 1, roughness 0.45 | same |
| Brass, polished | Telegraph pedestals, portholes, whistles, phone boxes, A-deck forward windows, lamp fittings | "brass pedestal", "brass forward-facing A-deck windows" | #B8923D | metal 1, roughness 0.2 | https://trmaarchive.com/paint ; https://titanicconnections.com/titanic-tours-the-bridge-a-titanic-connections-feature/ [snippet] |
| Marble, white | Smoking Room fireplace, Reading Room fireplace, Turkish-bath drinking fountain, pool steps, barber's counter, washstand tops | "white marble", "marble stair" | #EDEAE3 ; veining #B9B6AE | roughness 0.2 | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic |
| Marble, grey (carved) | Lounge fireplace | "carved grey marble" | #8C8C88 | roughness 0.25 | same |
| Marble, red/maroon with white ribboning | Reading & Writing Room fireplace | "red/maroon marble and white ribboning" | #6E2A2C + #E6E0D6 | roughness 0.25 | same |
| Marble, peach | Restaurant forward buffet top | "peach-coloured marble" | #E3B89B | roughness 0.25 | same |
| Mother-of-pearl inlay | Smoking Room mahogany | "carving replaced by mother-of-pearl inlaid work" | #E8E3DA iridescent | clearcoat, iridescence | Shipbuilder |
| Linoleum tiles (6 in / 152 mm square typical) | Staircase landings, Dining Saloon, Smoking Room, Gymnasium, Verandah, pool surround, 2nd & 3rd class | see per-room entries | per room | semi-gloss, roughness 0.35 | ET forum "6x6 Linoleum Tiles Color" [snippet] https://www.encyclopedia-titanica.org/community/posts/223345/ |
| Axminster carpet | Reception Room, Restaurant | "dark, richly coloured Axminster" / "Rose du Barry" | per room | roughness 0.9 | Shipbuilder |
| Wilton carpet | 2nd-class Library | "Wilton carpet" | #7A3A3A (colour not documented) | roughness 0.9 | Shipbuilder |
| Velvet, green & gold floral | Lounge seating | "plush velvet with green and gold floral patterns" | #3C6B4A / #C7A04C | roughness 0.85 | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic |
| Leather, dark green | Dining Saloon chairs | "dark green leather" | #2E4A3A | roughness 0.4 | same |
| Morocco leather, plain dark green | 2nd-class Smoke Room chairs | "plain dark green Morocco leather" | #2F5A3E | roughness 0.4 | Shipbuilder |
| Leather, red | 2nd-class Dining swivel chairs | "red leather upholstery" | #7A1F1F | roughness 0.4 | https://en.wikipedia.org/wiki/Second-_and_third-class_facilities_on_the_Titanic |
| Leather, club chairs (1st-class Smoking Room) | colour undocumented: "probably green or burgundy" | #5A2A2A (burgundy) or #2F4F3A (green) | roughness 0.4 | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic ; ET [snippet] https://www.encyclopedia-titanica.org/community/threads/first-class-smoke-room-furniture.17268/page-2 |
| Silk damask, green | Reception Room Chesterfields | "green damask silk" | #4E7A5C | roughness 0.6 | Wikipedia First-class |
| Floral wool damask | Reception Room "grandfather" chairs | "floral wool damask" | #B9A27A ground | roughness 0.8 | Shipbuilder |
| Aubusson tapestry, rose pattern | Restaurant chairs | "pink rose-patterned Aubusson tapestry" | #D9A3A8 / #EEDDD2 | roughness 0.85 | Wikipedia First-class |
| Silk, pink | Reading Room curtains | "pink silk curtains" | #E7B7C0 | roughness 0.5 | same |
| Silk, fawn | Restaurant bay-window curtains | "fawn silk curtains" | #C9B18F | roughness 0.5 | Shipbuilder |
| Silk, yellow & burgundy | Reading Room settees | "silk-upholstered settees and chairs in yellow and burgundy" | #D9B64A / #6A2230 | roughness 0.6 | Wikipedia First-class |
| Wicker / cane / rattan | Reception, Verandah, Café Parisien, private promenades, B-deck restaurant foyer, deck-chair centres | "wicker tables and chairs", "cane settees", "rattan-woven chairs" | #D2B37C (natural), painted white where stated | roughness 0.7 | Wikipedia First-class ; Shipbuilder |
| Green trellis (Verandah) | Verandah Café & Palm Court | "green trellis-work panels" with ivy | #2F4F3A ; ivy #2E5A32 | matt | Shipbuilder |
| White trellis (Café Parisien) | Café Parisien | "white, with white trellising for ivy" | #F3F0E8 ; ivy #2E5A32 | gloss | https://trmaarchive.com/articles/nigelbryant/interior.shtml |
| Granulated-cork painted ceilings | General interior ceilings (anti-condensation) | "painted granulated cork" | #EDEAE2 | rough, roughness 0.9 | https://en.wikipedia.org/wiki/Titanic |
| Plaster, moulded | Lounge, Smoking Room, Restaurant, Library coffered ceilings | "plaster with moulded medallions", "coffered plaster" | #F2EFE7 | matt, roughness 0.8 | Wikipedia First-class / Second-class |
| Steel, white enamel | 3rd-class dining saloon walls, 3rd-class open space, bridge lockers, crew spaces | "white-enamelled steel" | #EEEBE3 (chipped) | gloss, roughness 0.25 | https://en.wikipedia.org/wiki/Second-_and_third-class_facilities_on_the_Titanic |
| Steel, red-lead primed | Lower hull interiors, bilges, boiler-room bulkheads (modellers' consensus; no period evidence) | "red lead" | #8C3A2B | matt | https://trmaarchive.com/paint ; ET [snippet] https://www.encyclopedia-titanica.org/community/goto/post?id=454592 |

---

## 2. Electric lighting (ship-wide)

| Item | Value | Metric / note | Source |
|---|---|---|---|
| Main dynamos | 4 × 400 kW at 100 V DC, W. H. Allen, Son & Co. (Bedford); 580 hp at 325 rpm each; 16,000 A total | in a watertight compartment ≈63 ft (19.2 m) long × 24 ft (7.3 m) high at tank-top level abaft the turbine room | https://www.titanicinquiry.org/BOTInq/BOTReport/botRepElec.php ; https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-07-ElectricalEquipment.html |
| Emergency dynamos | 2 × 30 kW on a platform in the turbine-casing at D (saloon) deck level, 20 ft (6.1 m) above the waterline; separate steam line from boiler rooms 2, 3 and 5 | emergency circuit feeds ≈500 lamps at passage ends, stairways and the Boat Deck, plus bridge, mast/side/stern lights, Marconi, 5 arc lamps, 7 cargo/gangway lanterns, 4 boat winches | BOT Elec |
| Lamp count | ≈10,000 incandescent lamps, 16 to 100 candle power | 16 cp ≈ 200 lm, 100 cp ≈ 1,260 lm (× 4π, mean-spherical; derived here) | BOT Elec ; Shipbuilder-07 |
| Filament type | "the majority tantalum"; carbon lamps only in cargo spaces and portable fittings (BOT). Shipbuilder: tantalum "throughout except in a few cases in the engine room" (vibration) | metal filaments allowed the system voltage to be set at 100 V | BOT Elec ; Shipbuilder-07 |
| Colour temperature — carbon filament | ≈2,125 K (Shackelford, AIME 1919, for the 16-cp 1,000-h carbon lamp); "a colour similar to candlelight" | approx sRGB of a 2,100 K blackbody ≈ #FF9A3C | https://onemine.org/documents/temperatures-of-incandescent-lamp-filaments ; https://lamptech.co.uk/IN%20Carbon.htm |
| Colour temperature — tantalum filament | not published; "much whiter colour light" than carbon, efficacy ≈6 lm/W (double carbon); obsolete by ≈1910 except Siemens (to ≈1913) | **recommend 2,300–2,400 K** for the ship's general lighting (between carbon 2,125 K and the modern tungsten 2,400 K baseline); ≈ #FFA552 | https://lamptech.co.uk/IN%20Tantalum.htm ; https://en.wikipedia.org/wiki/Color_temperature |
| Dimming lamps | special two-filament lamps in first-class rooms giving a small night light | model as a second, ≈1–2 cp emitter per cabin | BOT Elec ; Shipbuilder-07 |
| Stateroom fittings | fixed ceiling lights plus wall sockets for portable lamps or fans; bedside reading lamp and call button | — | Shipbuilder-07 ; Wikipedia First-class |
| Illuminated signs | electrically lit signs directing 1st and 2nd class to entrances and public rooms; gymnasium's lit multicolour pictures and lit route map | — | Shipbuilder-07 |
| Electric heaters | 562 (BOT) / 520 "Prometheus type" (Shipbuilder), > 5,000 A total | in 1st-class cabins, 2nd/alt-1st cabins on E deck, lounges (Lounge fireplace held an electric heater) | BOT Elec ; Shipbuilder-07 ; Wikipedia First-class |
| Bridge lighting | telegraph dials lit from inside at night; compass lit by internal oil lamp; window blinds lowered at night | — | https://en.wikipedia.org/wiki/Titanic_navigation_bridge |
| Clocks | 48 Magneta slave clocks driven by 2 master clocks in the chart room (25 each) | — | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Fixture vocabulary by room (from *Olympic* photographs as summarised by Wikipedia) | Grand Staircase: large crystal-and-gilt chandelier under the dome, small beaded-crystal chandeliers on A/Boat decks, cut-glass shades elsewhere; Lounge: 49-light opaque-glass + ormolu electrolier with crystal, bronze sconces; Smoking Room: two gilt-bronze chandeliers (recovered), ormolu sconces; Reading Room: shaded sconces + beaded-crystal chandeliers; Restaurant: large electric wall brackets, ceiling light clusters, one crystal-stem table lamp with rose silk shade per table; Reception: crystal chandeliers; Turkish bath: bronze Arab hanging lanterns; corridors (B/C): ormolu and cut-glass ceiling lights; gym/engine/boiler/crew: plain bulkhead and ceiling fittings with frosted or clear globes | — | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic ; https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |

---

## 3. Forward Grand Staircase (Boat Deck → E deck, plain flight to F)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | between funnels 1 and 2; stairwell ≈298–331 ft from bow, centre ≈315 ft; dome house on Boat Deck ≈305–339 ft **[02]** | 90.8–100.9 m, centre 96 m | `02-deckplans` ; https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html |
| Style | "early English" William & Mary (late 17th c.) oak panelling; balustrade of light wrought-iron scrollwork "reminiscent of Louis XIV" with "occasional touches of bronze in the form of flowers and foliage" (1911 brochure) | — | Shipbuilder ; https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Wood | "solid Irish oak" (Wikipedia, citing Beveridge) / "solid English oak" (Wikipedia Titanic) — **model as quarter-sawn European oak, mid-brown satin varnish** | — | same ; https://en.wikipedia.org/wiki/Titanic |
| Height / extent | "over sixty feet" (brochure); serves seven levels Boat–E; six flights; stair width 16 ft (brochure) vs 20 ft (Wikipedia body) — **adopt 16 ft** | 18.3 m ; 4.88 m (6.10) | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Boat-deck gallery | 56 ft wide × 33 ft long; stair projects 17 ft from the bulkhead; two entry vestibules each 5 × 6 ft on Boat Deck and on A deck | 17.07 × 10.06 m; 5.18 m; 1.52 × 1.83 m | same |
| Main flight | 12 steps including the landing below the clock (original); film set had 13 and was ≈30 % larger, steel-framed with some plaster-cast newel panels | — | same |
| Newel posts | carved high-relief garlands, each unique, pineapple finials | — | same |
| Balustrade | wrought-iron grilles with ormolu (gilt-bronze) swags; "a light wrought-iron grille" rather than a heavy carved balustrade | iron #1E1E1E, ormolu #C8A04E | same |
| Dome | wrought iron and glass over the two-storey A-deck level; edge "fringed with a delicately moulded plaster entablature"; sits on the deck house in a protective box which also holds lamps that shine up through the glass at night; large crystal-and-gilt chandelier at centre. Shape oval (forward) vs round (aft) per Beveridge plans [snippet]; one secondary source claims "20 ft diameter of milk glass and wrought iron" — **unverified; use ≈20 × 16 ft (6.1 × 4.9 m) oval as a placeholder** | glass: milky white, light transmission ≈0.6 | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic ; https://www.encyclopedia-titanica.org/community/threads/dome.37252/page-2 [snippet] ; https://www.designedstairs.com/article/amazing-stairs-titanic-grande |
| Clock panel "Honour and Glory crowning Time" | on the first central landing from the top (A-deck level), below the dome; ornamented oak panel, half-point arch on two composite pilasters whose capitals carry winged putti heads, four reversed volutes; round clock case on an estípite with laurel festoons; Honour (viewer's left) with tablet and stylus, left foot on a globe; Glory (right) with palm branch, laurel wreath at her foot; swags of fruit/flowers, egg-and-dart, acanthus, rosettes, two seated griffins. Carved by Charles Wilson (per *Titanic Voices*). Not installed at Belfast — a mirror stood in its place until it arrived; no photo of Titanic's exists; Olympic's is at SeaCity Museum, Southampton | panel dimensions not published | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Cherub lamp | bronze cherub holding an electric torch on the central newel at the foot of the A-deck flight; smaller cherubs probably at each end of the B and C flights; D-deck central newel instead carries a gilt candelabra with 21 electric "candles" | — | same ; https://www.titanicpages.com/grandstaircase |
| Landing floors | "cream-coloured linoleum tiles interspersed with black medallions" (Wikipedia) = "black patterns on white" (Bryant) — cream #E8DFC6, medallion #1C1A18, 6-in tiles | 152 mm tiles | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic ; https://trmaarchive.com/articles/nigelbryant/interior.shtml |
| Landing furniture | armchairs and sofas upholstered in blue (#2E4C7A) just off the stairs; potted palms in raised holders on each level; upright piano on the Boat Deck; landscape/still-life oil paintings on the B, C, D, E landings instead of the clock | — | Wikipedia Grand Staircase |
| Lighting | crystal-and-gilt chandelier in the dome; beaded-crystal chandeliers only on the forward Boat and A decks; cut-glass shades elsewhere | — | same |
| D-deck foot | opens into the white Jacobean Reception Room; tapestry facing the stairs | — | https://www.titanicpages.com/grandstaircase |
| Lifts | 3 first-class lifts immediately forward of the stairwell, E deck to A deck, 12 persons each, R. Waygood & Co. motors 6 bhp at 500 rpm; arched entry from the reception foyer | — | BOT Elec ; Shipbuilder-07 ; Wikipedia First-class |
| Wreck | only a well remains; the dome void is the ROV entry; debris at D deck; Olympic's 1990-salvaged woodwork carried an "avocado green" paint from her 1932 refit (not a 1912 colour) | — | Wikipedia Grand Staircase |

---

## 4. Aft Grand Staircase (A → C decks) and B-deck restaurant foyer

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | between funnels 3 and 4, centre ≈550 ft from bow; A-deck entrance ≈529–561 ft; dome ≈543–564 ft **[02]** | 167.6 m; 161–171 m | `02-deckplans` |
| Extent | A, B, C decks only; "same style" oak and wrought iron; dome "of much smaller proportions", round, illuminated; clock on the main landing is a simple clock with simpler surround | — | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic ; https://www.titanicpages.com/grandstaircase |
| Cherub | the aft cherub holds a lotus bud (photo caption) | — | Wikipedia Grand Staircase |
| A-deck landing | doors to the Smoking Room (aft) and via a companionway with revolving doors to the Lounge; staterooms A-36/A-37 flank it (Titanic addition) | — | same ; https://trmaarchive.com/articles/nigelbryant/interior.shtml |
| B-deck Restaurant Reception (Titanic only) | ≈560–600 ft **[02]**; white-painted Georgian panelling with moulded details; linoleum floor covered by large rugs; carpeted seating area; rattan/silk-upholstered chairs, settees, tables; piano for the band; coat recess | 171–183 m | Wikipedia First-class ; Bryant |
| C-deck | mostly cabins; Maids' & Valets' saloon starboard (56 seats, six long tables bolted down, white walls, lino) and barber's shop port (two swivel chairs, marble counter with two basins, leather waiting bench) | — | Bryant ; Wikipedia First-class |
| Wreck | destroyed in the break-up; fragments of its wrought-iron dome found in the debris field | — | Wikipedia Grand Staircase |

---

## 5. First-Class Reception Room (D deck)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | foot of the forward Grand Staircase, full ship width; BOT "reception room 83 ft long" (including stair foyer) ≈298–381 ft from bow **[derived]**; Shipbuilder room proper 54 ft long | 90.8–116.1 m; 25.3 m / 16.46 m | https://www.titanicinquiry.org/BOTInq/BOTReport/botRepAccomo.php ; Shipbuilder |
| Area | 460 m² (4,951 sq ft) | — | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic |
| Ceiling | D–C tween-deck 10 ft 6 in; **clear ceiling ≈9 ft 3 in under the beam casings (estimate)** | 3.20 m / ≈2.8 m | BOT Accommodation |
| Style / walls | Jacobean (early 17th c. English); "richly carved mahogany Jacobean-style panelling painted glossy white", "white panelling delicately carved in low relief" | #F4F1E8 | Wikipedia First-class ; Shipbuilder |
| Ceiling finish | white moulded plaster; crystal chandeliers | — | Bryant |
| Windows | leaded-glass arched windows along both sides concealing the portholes, backlit at night; aft wall has large arched glass windows into the Dining Saloon | — | Bryant ; Wikipedia First-class |
| Floor | Axminster carpet: "dark, richly coloured" (Shipbuilder); "dark red with blue and gold overlapping pattern" (Bryant) — ground #6B1F22, motifs #2A3C6E / #C9A54A | — | Shipbuilder ; Bryant |
| Furniture | wicker/cane chairs in groups, light tables; Chesterfield sofas in green silk damask (#4E7A5C); "grandfather chairs in floral wool damask"; Steinway grand piano (black) on the starboard side for the quintet; potted palms in built-in holders in the alcove corners | — | Wikipedia First-class ; Shipbuilder ; Bryant |
| Art | Aubusson tapestry panel adapted from "La Chasse du duc de Guise" facing the staircase | — | Shipbuilder ; Wikipedia First-class |
| Fittings | gilt candelabra on the middle rail at the stair foot; two oak doors with gilded grilles each side of the funnel-2 casing; port and starboard entrance vestibules with white Jacobean panelling, china sideboard and wrought-iron grilles over the gangway doors (unique to Titanic) | — | Bryant ; Wikipedia First-class |
| Wreck | most leaded windows, panelling, plant holders, light fixtures and the carved framing round the steel pillars survive; Titanic has more support pillars here than Olympic | — | Wikipedia First-class |

---

## 6. First-Class Dining Saloon (D deck)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | abaft the Reception Room, between the funnel-2 and funnel-3 casings; BOT "dining saloon 112 ft long" ≈381–493 ft from bow **[derived]**; followed by the 1st-class pantry 56 ft and galley 45 ft | 116–150 m ; 17.1 m ; 13.7 m | BOT Accommodation |
| Size | 114 ft long × 92 ft wide (Shipbuilder/Wikipedia), ≈1,000 m²; seats 532 (Shipbuilder) / 554 (Wikipedia) at 115 tables of 2–12 | 34.75 × 28.04 m | Shipbuilder ; Wikipedia First-class |
| Ceiling | D–C tween 10 ft 6 in; white moulded plaster "with rich moulding"; ceiling panels between beam casings — **clear ≈9 ft (2.74 m) estimate** | 3.20 m | Shipbuilder ; BOT |
| Style / walls | Jacobean English early 17th c.; carved wood panelling painted glossy white enamel (#F4F1E8); two oak buffets carved, one at each end; alcoves on each side behind partition walls with arched openings; central area divided by pillars (steel columns in carved white casings) | — | Wikipedia First-class |
| Windows | portholes hidden behind rectangular leaded-glass windows ≈5 ft tall, lit from behind at night; large bay window at the forward end (Shipbuilder figure) | 1.52 m | Wikipedia First-class ; https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html |
| Floor — the disputed colours | Wikipedia: "red and blue linoleum tiles"; Titanic Connections: "gold, red and blue" [snippet]; ET forum (recovered fragments): red, ochre and blue — red and blue dominant, ochre only in the small centre cross [snippet]; Bryant: "light blue with dark red and gold overlay" (current theory); Olympic's used a different combination. **Recommend: pale-blue ground #8FA8BF, dark-red #8E2E2B and dark-blue #2D3F6B border/figures, ochre #C8A24A centre cross; 6-in tiles** | 152 mm | https://en.wikipedia.org/wiki/First-class_facilities_of_the_Titanic ; https://www.titanicconnections.com/?p=2428 ; https://www.encyclopedia-titanica.org/community/threads/dining-room-linoleum-floor.17054/page-2 ; https://trmaarchive.com/articles/nigelbryant/interior.shtml |
| Furniture | oak tables (cast-iron supports recovered); oak chairs "intricately carved", dark-green leather (#2E4A3A), swivelling on pinions (Bryant) / "not bolted to the floor" (Wikipedia) — **model as swivel chairs on fixed pedestals, loose armchairs at the alcove tables**; forum minority view: Titanic's chairs reddish-burgundy [snippet] | — | Bryant ; Wikipedia ; https://www.encyclopedia-titanica.org/community/threads/first-class-smoke-room-furniture.17268/page-2 |
| Other | upright piano near the forward end for the band and Sunday service; bronze swing-door grilles, gilded brass fixtures recovered | — | Bryant ; Wikipedia |
| Design note | a two-storey domed saloon was rejected for a single-deck room | — | Wikipedia First-class |

---

## 7. First-Class Lounge (A deck)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈410–467 ft from bow, between funnels 2 and 3, full width of the deckhouse (63 ft) **[02]** | 125–142 m | `02-deckplans` |
| Size | 59 ft long × 63 ft broad × 12 ft 3 in high (ceiling raised above Boat-Deck level) | 17.98 × 19.20 × 3.73 m | Shipbuilder ; Wikipedia First-class |
| Style | Louis XV (Louis Quinze), details from the Palace of Versailles | — | same |
| Walls | "finely carved boiserie" in English oak (#8B6A3E), musical-instrument motifs; large rounded mirrors; alcoves with inset mirrors and tall bay windows of leaded and stained glass | — | Wikipedia First-class ; Bryant |
| Ceiling | plasterwork with instrument motifs; central 49-light electrolier of opaque glass and ormolu with crystal (now at Cutlers' Hall, Sheffield — Olympic's) | — | Wikipedia First-class |
| Fireplace | carved grey marble (#8C8C88) on the forward wall, electric heater inside; replica *Diana of Versailles* (Artemis) statuette on the mantel; large mirror above | — | same |
| Floor | "ornate floral carpet" (colour undocumented; the sibling green/gold velvet suggests a green-ground carpet — **recommend #3E5C44 ground with gold/rose florals**) | — | Bryant |
| Furniture | tables, sofas and armchairs in plush velvet with green and gold floral pattern (#3C6B4A/#C7A04C); tea tables; grand piano in a corner; curved aft wall with mahogany bookcase (library); small bar | — | Wikipedia First-class ; Bryant |
| Lighting | 49-light electrolier, bronze sconces (recovered from wreck) | — | Wikipedia First-class |
| Survivors | Olympic's identical panelling is at the White Swan Hotel, Alnwick; wreck yielded the Artemis statue, bronze sconces, window frames and an oak panel (Halifax) | — | same |

---

## 8. Reading & Writing Room (A deck, port)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈370–410 ft from bow, port side outboard of the funnel-2 casing, forward of the Lounge **[02]** | 113–125 m | `02-deckplans` |
| Size | 41 ft × 41 ft × 12 ft 3 in high; windows 11 ft high facing the promenade; great bow window; slightly raised forward recess | 12.50 × 12.50 × 3.73 m; 3.35 m | Shipbuilder ; Wikipedia First-class |
| Style | late Georgian c. 1770–80; white panelling and ceiling, dove-grey accents (#B9B7B0), delicate plasterwork, fluted columns; porticoed doorway with oeil-de-boeuf windows between main room and alcove | — | same |
| Fireplace | white, with red/maroon marble (#6E2A2C) and white ribboning; oval gilded mirror above (Bryant) | — | Wikipedia ; Bryant |
| Floor | dark pink carpet (#B85C72) | — | Bryant |
| Curtains | pink silk (#E7B7C0) | — | Wikipedia First-class |
| Furniture | silk-upholstered settees and chairs in yellow and burgundy; writing desks; potted palms on tall stands in corners | — | same |
| Lighting | shaded sconces and beaded-crystal chandeliers | — | same |
| Titanic-specific | part of its space was converted to staterooms (A-deck forward enclosure partly blocked the bay-window view) | — | Bryant |

---

## 9. First-Class Smoking Room (A deck, aft)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈561–626 ft from bow, aft of the funnel-4 base, full width of the house **[02]**; U-shaped plan around the funnel-4/turbine ventilation shaft | 171–191 m | `02-deckplans` ; Wikipedia First-class |
| Size | 65 ft long × 63 ft broad × 12 ft 3 in high (ceiling raised above Boat Deck) | 19.81 × 19.20 × 3.73 m | Shipbuilder |
| Style | "free adaptation of early Georgian c. 1720", Pall-Mall club atmosphere | — | Shipbuilder ; ET [snippet] https://www.encyclopedia-titanica.org/bastion-of-masculinity.html |
| Walls | "best mahogany" panelling (#4A2418), "carving replaced by mother-of-pearl inlaid work" (#E8E3DA) | — | Shipbuilder |
| Windows | large painted/stained-glass windows in pedimented niches, backlit by concealed lamps; four large bay windows each with a unique painted pattern (landscape and ship subjects) | — | Shipbuilder ; Bryant |
| Ceiling | plaster with moulded medallions | — | Wikipedia First-class |
| Fireplace | white marble (#EDEAE3), coal-burning — the only real open fire aboard — centre of the aft wall; Norman Wilkinson's *Plymouth Harbour* above it (Olympic's: *The Approach of the New World*) | — | Shipbuilder ; Wikipedia First-class |
| Floor | blue and red linoleum tiles — Ken Marschall saw "dark red and blue" tiles at the wreck in 2000/2001; two gilt-bronze chandeliers and tile sections recovered. **Recommend dark red #7E2A24 and dark blue #2D3F6B in a chequer/figured 6-in pattern.** The 1997 film's green tiles are a film choice [snippet] | — | Wikipedia First-class ; Bryant ; https://www.encyclopedia-titanica.org/community/posts/227787/ |
| Furniture | square card tables with raised edges and cup holders; round-backed leather club chairs — colour undocumented, "probably green or burgundy", historians lean burgundy (#5A2A2A) [snippet]; green-baize-topped tables mentioned | — | Wikipedia ; Bryant ; https://www.encyclopedia-titanica.org/community/threads/first-class-smoke-room-furniture.17268/page-2 |
| Lighting | gilt-brass chandeliers and ormolu sconces | — | ET [snippet] |
| Doors | revolving door to the port Verandah Café right of the fireplace (Titanic only); doors forward to the aft staircase vestibule; bathrooms within | — | Wikipedia First-class ; Bryant |
| Hours | bar 23:30, room midnight | — | Wikipedia First-class |

---

## 10. Verandah Café and Palm Court (A deck, aft; two rooms)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈626–652 ft from bow, one each side of the second-class stairway; port = smoking (door from the Smoking Room), starboard = non-smoking **[02]** | 191–199 m | `02-deckplans` ; Wikipedia |
| Size | each 30 ft long × 25 ft wide | 9.14 × 7.62 m | Shipbuilder |
| Style | "treillage of the Louis Seize period", "Mediterranean"; green trellis-work panels (#2F4F3A) with ivy and climbing plants; mirrors on the walls shaped as false arched windows | — | Shipbuilder ; Bryant |
| Windows | floor-to-ceiling arched windows to the promenade; double sliding doors aft to the open A-deck promenade; bronze window grilles (one recovered 1994) | — | Wikipedia ; Bryant |
| Floor | chequerboard tiles: "light brown and beige" (Wikipedia) vs "orange and white" (Bryant). **Recommend tan #B08A5E / cream #E6D7B8 chequer (reads as orange-and-white in the 1911 photos' contrast)** | — | Wikipedia First-class ; Bryant |
| Furniture | wicker tables and chairs, cane settees, "elegant armchairs"; Kentia palms in tubs | — | Shipbuilder ; Wikipedia |

---

## 11. À la Carte Restaurant (B deck, aft) and its reception

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈600–645 ft from bow, abaft the aft staircase; on Titanic extended to the port side **[02]** | 183–197 m | `02-deckplans` |
| Size | Olympic 60 ft × 45 ft; Titanic enlarged, 137 seats (≈half the tables for two); B–A tween-deck 9 ft → **clear ≈8 ft 3 in (2.5 m) estimate** | 18.29 × 13.72 m ; 2.74 m | Shipbuilder ; Wikipedia ; BOT |
| Style | Louis XVI (Louis Seize) | — | Shipbuilder |
| Walls | floor-to-ceiling French walnut "in a light fawn brown colour" (#A8865C) with carved and gilded mouldings; mirrors set in the panelling like windows; bays with inset oval mirrors; fluted columns carved with gilded ribbons; large electric wall brackets | — | Shipbuilder ; Wikipedia |
| Ceiling | plaster with modelled flowers and ribbons; clusters of lights / crystal chandeliers | — | Shipbuilder ; Bryant |
| Floor | Axminster carpet "delicate vieux rose" / "Rose du Barry" (#C97B86 dusty rose) | — | Shipbuilder ; Wikipedia |
| Windows | bay windows with fawn silk curtains (#C9B18F) | — | Shipbuilder |
| Furniture | 49 small tables for 2–8 (Bryant), each with a crystal-stem lamp under a rose-coloured silk shade; light walnut chairs with carved woodwork, Aubusson tapestry upholstery with rose motifs (Bryant: "peach-coloured, inlaid with gold pattern"); dumb-waiters; raised bandstand on the aft wall; silver-service buffets each side; forward buffet with peach marble top | — | Shipbuilder ; Wikipedia ; Bryant |
| Tableware | Spode service in gilt and cobalt blue | — | Wikipedia First-class |
| Survivor | Titanic's own restaurant panelling (built for the ship, not fitted) is on *Celebrity Millennium* | — | https://en.wikipedia.org/wiki/Olympic-class_ocean_liner |
| Reception (B deck, forward of the restaurant) | ≈560–600 ft **[02]**; Georgian white panelling, lino with large rugs, silk-upholstered/rattan seating, piano | — | Bryant ; Wikipedia |

---

## 12. Café Parisien (B deck, starboard)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | starboard, outboard of the restaurant in the space of Olympic's B-deck promenade, ≈600–650 ft from bow; forum estimates 84–87 ft long × 17–19 ft wide **[02]** — no primary dimension published | 183–198 m ; 25.6–26.5 × 5.2–5.8 m | `02-deckplans` ; https://www.titanicpages.com/cafeparisien |
| Capacity | up to 68 | — | Wikipedia First-class |
| Style | "a charming sun-lit verandah, tastefully decorated in French trellis-work with ivy and other creeping plants" (Shipbuilder 1912) — white walls, white trellis (#F3F0E8), ivy | — | Titanic Pages ; Bryant |
| Floor | pine decking with a long carpet runner down the middle (Bryant) | planking #C9B183 | Bryant |
| Windows | large side windows that opened to the sea breeze along the ship's side; sliding doors to the restaurant; second entrance aft from the restaurant corridor | — | Titanic Pages ; Bryant |
| Furniture | wicker tables and chairs in small groups; tiered central buffet stand; sideboards with china at each end | — | Wikipedia First-class |
| Hours / staff | 08:00–23:00, restaurant staff (Gatti) | — | Wikipedia ; Titanic Pages |

---

## 13. Gymnasium (Boat Deck, starboard)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | ≈339–385 ft from bow, starboard, directly abaft the Grand Staircase entrance house **[02]** | 103–117 m | `02-deckplans` |
| Size | 44 ft long × 18 ft wide × 9 ft 6 in high; eight exceptionally large (arched) windows (Shipbuilder; Bryant counts seven) | 13.41 × 5.49 × 2.90 m | Shipbuilder ; Bryant |
| Walls | white-painted panelling (Wikipedia: oak; the game brief's "white pine" is the common description) — walls white above, lower half dark wood dado (Bryant) | #F1EEE6 / #6E4E2C | Wikipedia ; Bryant |
| Floor | linoleum: "white tiles with brown cut diamonds" (Bryant); Wikipedia "tile" | #EDE8DC / #7A5538 | Bryant |
| Feature | carved oak board opposite the door with a cutaway of an Olympic-class liner and a White Star route map, electrically illuminated with multicoloured pictures | — | Wikipedia ; Shipbuilder-07 |
| Equipment | two electric camels, electric horse, rowing machine, punching bag, weight-lifting machine, two mechanical bicycles with a dial (Rossel, Schwarz & Co., Wiesbaden); central bench | — | Wikipedia First-class |
| Rails | Titanic's gym rails white (Olympic's black) | — | https://trmaarchive.com/paint |
| Hours | ladies 9–12, children 1–3, gentlemen 2–6; instructor T. W. McCawley | — | Wikipedia |

---

## 14. Swimming Bath (F deck, starboard)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | starboard, "near the main foyer", forward of the Turkish baths; ≈305–340 ft from bow **[derived]** | 93–104 m | Bryant ; BOT |
| Pool size | 30 ft × 14 ft (Shipbuilder/Wikipedia); nominal 33½ × 15 ft on plan [snippet]; tank depth 7 ft; water 5 ft 4 in deep end, 4 ft 6 in shallow end | 9.14 × 4.27 m ; 10.21 × 4.57 m ; 2.13 m ; 1.63 / 1.37 m | Shipbuilder ; Wikipedia ; https://www.encyclopedia-titanica.org/community/posts/226897/ |
| Water | heated salt water | — | Wikipedia |
| Tiles | ceramic tiles dark blue and white (#1E3F7A / #F2F2EE) in the tank; surround lino "sky blue against white" (Bryant) / "blue and white linoleum" (Wikipedia) | — | Bryant ; Wikipedia |
| Entry | marble stair with teak footholds; two stairways with teak handrails | — | Wikipedia ; Bryant |
| Walls/ceiling | white-painted bulkheads, exposed piping on the ceiling | #EEEBE3 | Bryant |
| Cubicles | 13 changing cubicles with teak doors on the port side of the room, 2 shower stalls; no diving board (Olympic had one) | — | Wikipedia ; Bryant |
| Hours | free to men 06:00–08:00; otherwise ticketed with the Turkish bath (4 s / $1) | — | Wikipedia ; https://www.titanicpages.com/turkishbaths |

---

## 15. Turkish Baths (F deck, starboard)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | starboard, "behind the main foyer", abaft the pool; ≈340–390 ft from bow **[derived]**; rearranged between the Dec 1911 and Mar 1912 plans [snippet] | 104–119 m | Bryant ; https://www.encyclopedia-titanica.org/community/goto/post?id=469335 |
| Rooms | steam room, hot room, temperate room, two shampooing rooms, cooling room, two electric-bath rooms | — | Shipbuilder ; Wikipedia ; Shipbuilder-07 |
| Cooling room size | forum from plans: 23 ft 6 in (forward end to locker) / 35 ft 6 in (to back wall) long, 17 ft wide at the forward end [snippet] | 7.16 / 10.82 m ; 5.18 m | https://www.encyclopedia-titanica.org/community/goto/post?id=469268 |
| Style | "Arabian, 17th century" (Moorish) | — | Shipbuilder |
| Walls | tiled from dado to cornice in "large blue and green panels with a bolder tile border" — glossy blue-green (#2E5F8F / #3E8C78, border #1F3C5C) ; warm teak dado, doors and panelling (#7E4E2A); teak stanchions with Moorish carving (teak-encased pillars) | — | Shipbuilder ; Wikipedia |
| Ceiling | deeply recessed; gilt cornice and beams (#C9A54A), panels "picked out in dull red" (#7A2E2C) / "deep crimson"; hanging bronze Arab lanterns; gilded semi-domes over the doorways | — | Shipbuilder ; Wikipedia |
| Floor | "ornate dark blue tiles" (Bryant) — #243D6B with lighter pattern | — | Bryant |
| Fittings | carved Cairo curtains over the (fake) portholes (four portholes for daylight per Bryant); marble drinking fountain in a tiled frame; Damascus tables; low cushioned couches/chaises; canvas/teak folding chairs; teak dressing table with mirror (starboard); small curtained changing cubicles; Titanic had no bronze table lamps (Olympic did) | — | Shipbuilder ; Wikipedia ; Bryant |
| Tile maker | eBay claim: John Chambers of Pilkington — unverified [snippet] | — | ET snippet |
| Hours | women 9–12 (Titanic Pages: 10–13), men 2–6; 4 s / $1 incl. pool | — | Wikipedia ; Titanic Pages |
| Wreck | cooling room found in 2005 "in very good condition" | — | Wikipedia ; Titanic Pages |
| Reference image | colour illustration "Cool Room of the Turkish Baths, RMS Olympic" (White Star, c. 1910–11, CC0) | — | https://commons.wikimedia.org/wiki/File:Cool_Room_of_the_Turkish_Baths,_RMS_Olympic.jpg |

---

## 16. Squash Racquet Court (G deck, forward)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | lower (G) deck, in the No. 3 hold compartment forward of boiler room 6 — ≈160–193 ft from bow **[derived from bulkheads D 193 ft / E 247 ft in `01`]** | 49–59 m | BOT ; `01-dimensions` |
| Size | 30 ft long × 20 ft wide, two decks high (G and F); spectator gallery at F-deck level (aft end) reached by its own stair from D deck | 9.14 × 6.10 m | Shipbuilder ; Wikipedia |
| Finish | not described — **model as white-painted plaster/steel walls, varnished maple floor, electric bulkhead lamps behind wire guards**; nets provided for tennis-style play | — | Bryant (no finish given) |
| Staff | instructor Frederick Wright (lost) | — | Wikipedia |

---

## 17. First-class staterooms and parlour suites

### 17.1 General

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Counts | B deck 97 principal staterooms (198 berths); C deck 148 staterooms in a 450-ft house; D deck 50 staterooms round the forward funnel; A deck 34 at the forward end; E deck E-1…E-42 starboard (+ alternates E-43…E-88) | 137 m house | BOT Accommodation ; Wikipedia |
| Tween-deck heights | B–A 9 ft, C–B 9 ft, D–C 10 ft 6 in → **cabin ceilings ≈8 ft (2.44 m) on B/C, ≈9 ft (2.74 m) on D (estimates)** | 2.74 / 2.74 / 3.20 m | BOT |
| Styles (Shipbuilder 1911 list) | Louis Seize, Empire, Adams, Italian Renaissance, Louis Quinze, Louis Quatorze, Georgian, Régence, Queen Anne, Modern Dutch, Old Dutch (11 base styles; "19 with variations" per Wikipedia; Jacobean also cited) | — | Shipbuilder ; Wikipedia First-class |
| Special-stateroom woods | mahogany, sycamore, walnut, oak, satinwood | — | Wikipedia |
| Two standard designs ("Bedroom A/B") | A: Louis XV-inspired "French cabin", varnished oak panelling, cabriole furniture; B: white fielded panels above a 3-ft oak dado, brass or wooden bedstead; 43 such bedrooms | 0.91 m dado | Wikipedia |
| Standard cabin kit | dressing table, horsehair sofa, wardrobe, marble-topped washstand with tip-up basins; some folding upper (Pullman) berths; bedside call button, reading lamp, wire basket, electric heater; fixed lights + sockets for portable lamp/fan | — | Wikipedia ; Shipbuilder-07 |
| Single-berth rooms | 96, mainly A and B decks: bedstead, large sofa, wardrobe, dressing table, wash basin | — | Shipbuilder |
| Bathrooms | virtually all B and C suites en-suite; communal baths sea-water filled, folding wooden seats | — | Wikipedia |
| Private promenades | B-51/53/55 (stbd, Cardeza) and B-52/54/56 (port, Ismay): ≈50 ft long, half-timbered Tudor panelling, wicker chairs/sofas/tables, potted plants, cane deck chairs | 15.24 m | Wikipedia ; `02-deckplans` |
| Parlour-suite plan | sitting room, two bedrooms, two wardrobe rooms, bath, lavatory; sitting room with faux fireplace, card table, plush sofas, sideboards, writing desk | — | Wikipedia ; Shipbuilder |

### 17.2 Per-cabin style attributions (community-compiled from the 1911/1912 plans — treat as provisional)

| Cabin | Style | Panels / finish | Fabric | Source |
|---|---|---|---|---|
| B-38 sitting room | Louis Seize | — | — | Shipbuilder (Olympic numbering) |
| B-40 bedroom | Empire | — | — | Shipbuilder |
| C-56 sitting room | Louis Quatorze | — | — | Shipbuilder |
| **B-52 (Ismay's sitting room)** | **Louis XVI** (one post: "the Empire décor refers to the B-54 and B-56 bedrooms") | walnut mouldings on oak panels | — | https://www.encyclopedia-titanica.org/community/threads/suites-on-b-and-c-decks.17237/latest [snippet] ; https://www.encyclopedia-titanica.org/community/posts/438724/ [snippet] |
| B-54 | Empire | gilt and white panels | — | same [snippet] |
| B-56 | Empire (bedroom) | — | — | same [snippet] |
| B-58 | Louis XVI (famous Titanic photograph) | — | — | Wikipedia First-class (photo caption) |
| B-59 | Old Dutch | dark oak panels with embossed Lincrusta frieze | "colourful embroidery" | ET [snippet] |
| B-60 | Queen Anne (one post: Regency) | polished mahogany | apricot embroidery | ET [snippet] |
| B-64 | Empire | white panels | red silk (or "white and silk damask") | ET [snippet] |
| B-69 | Georgian | carved white panels | — | ET [snippet] |
| B-70 | Louis XIV | carved oak panels | — | ET [snippet] |
| Modern Dutch rooms | Modern Dutch | Lincrusta and crimson, or sycamore panels | — | ET [snippet] |

**Hex guidance for cabin palettes:** Empire = white/gilt (#F4F1E8 + #C8A04E) with red silk (#8E2A2E); Louis XVI = light oak/walnut (#A8865C) with pale striped silks; Old Dutch = dark oak (#5E4426) with embossed frieze; Queen Anne = polished mahogany (#4A2418) with apricot (#F0B88A); Georgian = carved white; Adam = white/pale green with delicate swags; Italian Renaissance = walnut with deep red; Modern Dutch = sycamore (#D9C9A5). Floors: carpet in suites (colour per style), linoleum in standard cabins.

---

## 18. First-class corridors, lifts and promenades

| Attribute | Value | Metric | Source |
|---|---|---|---|
| B and C-deck suite corridors | white-painted Venesta plywood panels with pilasters and fielded panels; archways over the doors; frieze on gilt brackets concealing ducts and wiring; ormolu and cut-glass ceiling lights; "no handrails or carpet runners" (Wikipedia) — floor covering disputed on ET (runner carpet vs linoleum/rubber tile) [snippet]. **Recommend: white gloss panelling #F4F1E8, 6-in cream/black lino in the main alleyways, carpet runners (red #7A2A2A) only inside suites and on the B-deck suite passages** | — | Wikipedia First-class ; https://www.encyclopedia-titanica.org/community/threads/decor-of-passageways.17039/page-2 ; https://www.encyclopedia-titanica.org/community/threads/first-class-corridors.17053/latest |
| B deck | two parallel corridors separated by baize-upholstered louvred swing doors | — | Wikipedia First-class |
| A deck | long corridor on the starboard side of the funnel-2 casing linking the Grand Staircase, Reading Room and Lounge, ≈342–380 ft **[02]** | 104–116 m | `02-deckplans` |
| Other first-class corridors | "spartan" — plain white panels, lino | — | Wikipedia |
| Cross passages (E deck) | 9 ft wide at the sides, 15 ft at the centre; stairways minimum 8 ft effective width | 2.74 / 4.57 / 2.44 m | BOT Accommodation |
| Lifts | three 1st-class (E–A), one 2nd-class (Boat–F), 12 persons; Waygood; lift cages panelled to match (not described — **model as oak-panelled cage with brass scissor gate and bench**) | — | BOT Elec ; Shipbuilder-07 |
| A-deck promenade | encircles A deck, up to 30 ft wide; forward half enclosed by a steel screen 192 ft long with large sliding windows (Titanic only); teak deck chairs and steamer rugs 4 s / $1; wrought-iron benches with wooden slats on the aft open section | 9.1 m ; 58.5 m | Wikipedia ; BOT ; Olympic-class |
| Boat deck 1st-class promenade | ≈200 ft between the entrance house and the aft staircase; raised lounge roof used as a sun deck | 61 m | Wikipedia ; `02-deckplans` |
| Deck chairs | 614 across 1st and 2nd class; folding wooden steamer chair with cane/rattan centre, natural teak colour (not stained), rattan "light tan"; surviving chair ≈37¾ × 22½ × 54 in | 0.96 × 0.57 × 1.37 m | Wikipedia First-class ; https://trmaarchive.com/paint ; `01-dimensions` |

---

## 19. Second-class spaces

| Space | Position (ft from bow → m) | Finish and furniture | Source |
|---|---|---|---|
| Forward 2nd-class staircase & lift | ≈631–641 ft (192–195 m) at A/Boat level **[02]**; Boat Deck to F; first lift in 2nd class on any liner | oak balustrades and oak panelling; white-and-red patterned linoleum (#F1EEE6 / #8E2E2B) | https://en.wikipedia.org/wiki/Second-_and_third-class_facilities_on_the_Titanic ; Shipbuilder |
| Aft 2nd-class staircase | F to B decks, serving library and smoke room | same oak and red/white lino; "extends through five decks" | same |
| Dining Saloon (D deck, aft) | ≈595–665 ft (181–203 m) **[derived from BOT chain]**; 70/71 ft long × full width; 394 seats at one sitting | "early English carried out in oak" panelling (#8B6A3E); linoleum floor; portholes; long tables in parallel rows; mahogany swivel chairs with red leather (#7A1F1F) bolted to the floor; upright Steinway in an alcove (Sunday services); shares the D-deck galley with 1st class | Shipbuilder ; Wikipedia Second-class ; BOT |
| Library (C deck, aft) | ≈660–706 ft (201–215 m) under the smoke room **[02]**; 40 ft long × 58 ft wide (12.2 × 17.7 m) | Colonial Adam style; light sycamore panelling with carvings (#D9C9A5) and dark mahogany dado; white-painted fluted columns; coffered plaster ceiling; mahogany chairs and tables upholstered in tapestry; writing desks by the windows; silk curtains; Wilton carpet; large lending bookcase at the forward end; Olympic's panelling partly at Cutlers' Hall, Sheffield | Shipbuilder ; Wikipedia |
| Smoking Room (B deck, aft) | ≈660–706 ft (201–215 m) **[02]**; 36 ft long × 62 ft wide (11.0 × 18.9 m); men only | "variation of Louis Seize"; oak panelling and dado carved in relief; oak furniture in plain dark-green Morocco leather (#2F5A3E) club chairs round square card tables; "special linoleum tiles"; adjoining steward's bar and lavatory | Shipbuilder ; Wikipedia |
| Promenades | Boat Deck aft 145 ft (44.2 m) unsheltered; C-deck enclosed promenade 84 ft (25.6 m) in steel framing with glass windows (children's play area); B-deck promenade round the smoke room | wooden-slat wrought-iron benches; teak deck chairs 3 s / $1 | Wikipedia ; `02-deckplans` |
| Cabins (D–F decks, aft; E-89…E-107 permanent, E-43…E-88 alternate 1st) | — | oak panelling painted glossy white; linoleum floors (alternates got carpet and heaters); mahogany furniture: large sofa, wardrobe, dressing table with mirror and shelves; fold-back earthenware "Compactom"/"Clock" basins; water hand-filled by stewards; shared bathrooms | Wikipedia Second-class |
| Barber shop (E deck) | — | souvenirs and postcards | same |

---

## 20. Third-class spaces

| Space | Position (ft from bow → m) | Finish and furniture | Source |
|---|---|---|---|
| General Room (C deck, under the poop, starboard) | ≈794–826 ft (242–252 m) **[02]**; 36 ft long × 38 ft wide (11.0 × 11.6 m) | "panelled and framed in pine, finished in white enamel" (#F1EEE6); linoleum tiles; teak settees, chairs and tables (#7E4E2A); long wooden benches; piano; the "party" room of the last night (lights out 22:00) | Shipbuilder ; Wikipedia Second-/third-class |
| Smoking Room (C deck, under the poop, port) | ≈794–826 ft **[02]** | pine panelled, painted white; linoleum tiles; long wooden benches; own bar; spittoons; card tables fixed to the floor; Olympic photo RMG G10783 | Wikipedia ; https://download.osmand.net/wiki/File:Third_Class_Smoking_Room_on_the_%27Olympic%27_(1911)_RMG_G10783.jpg |
| Dining Saloons (F deck, amidships) | two rooms either side of a bulkhead, 100 ft (30.5 m) total; split into four by the uptakes of boiler rooms 2 and 3 (bulkhead J ≈478 ft) → ≈430–530 ft (131–162 m) **[derived]**; 473 seats; reached by a 20-ft-wide ladderway from the working passage | "finished in white enamel": white-enamelled steel walls with some pine panels and framed White Star posters; sidelights (portholes); "chairs of special design" — free-standing wooden chairs (Wikipedia) / long tables with swivel chairs (common description) — **model long tables with individual wooden chairs, some fixed swivel seats**; forward room families and single women, aft room single men | Shipbuilder ; Wikipedia ; BOT |
| Open Space (D deck, forward, under the forward well deck) | ≈125–190 ft (38–58 m) under the well deck (`01`), reached by two wide stairs from the well deck and from E deck | very large room; red linoleum tile (#9B3A2F); exposed steel hull painted white enamel; White Star/IMM posters; tables and chairs port and starboard, open centre for dancing; bar; drinking fountains; hatch trunks of the bunker and No. 2 hatches in the middle | Wikipedia Second-/third-class |
| Cabins (bow: single men on D/E/F/G; stern: families and single women on D–G) | forward ≈ E-deck 147 ft (44.8 m) of 3rd-class accommodation in three compartments; G deck 26 + 7 + 60 rooms | private 2–10-berth cabins; white-painted pine panelling (#F1EEE6); salmon-pink linoleum (#E7A58F); iron bunks with mattresses and White Star linen (single men: straw mattress and blanket); washbasin only in family/women's cabins; two bathtubs for >700 passengers; Olympic photo "3rd Class Cabin.jpg" on Commons | Wikipedia ; BOT ; https://download.osmand.net/wiki/File:3rd_Class_Cabin.jpg |
| Promenades | poop deck (775–883 ft) and both well decks; aft entrance 16 ft wide to E, 8 ft wide E–F | planked pitch-pine decks, white bulwarks, rust-brown dadoes (see §27) | BOT ; `01-dimensions` |

---

## 21. Crew spaces and Scotland Road

| Space | Position | Finish (period evidence is thin — recommendations flagged) | Source |
|---|---|---|---|
| Scotland Road (working passage, E deck, port) | runs from the forward E-deck gangway doors straight aft to the reciprocating-engine casing, then jogs round it through watertight doors to the stern; 8.5 ft (2.59 m) wide; the crew accommodation along it extends 475 ft (144.8 m) | **Recommend** white-enamelled steel bulkheads (#EEEBE3) with exposed rivet lines, red-brown (#8C3A2B) or dark lino deck, bare bulkhead lamps in wire cages, pipe runs on the deckhead; the 1997 film shows it "white and metallic" [snippet]; opens onto stewards' glory holes, seamen's quarters, 3rd-class cabins and WCs, stairs to the 3rd-class dining room and the engineers' mess | https://www.titanicpages.com/scotlandroad ; BOT Accommodation ; https://titanic.fandom.com/wiki/Scotland_Road [snippet] |
| Firemen (D deck, forecastle) | quarters for 108 firemen in two watches, lavatories abaft at the ship's sides | iron/steel pipe-cot bunks in tiers, white enamel, lino | BOT Accommodation |
| Firemen's passage | two vertical spiral staircases abaft the firemen's quarters, one each side of the centreline, down to a watertight tunnel above the tank top running aft to boiler room 6, with a watertight sliding door at its after end | bare steel, red-lead/grey, ladder rungs | BOT ; https://en.wikipedia.org/wiki/Titanic |
| Trimmers (E deck fwd) | three compartments of 24 each (one per watch); 53 third-watch firemen also on E deck; 44 seamen port side abaft the trimmers | — | BOT |
| Leading firemen & greasers (G deck fwd) | 15 leading firemen, 30 greasers | — | BOT |
| Crew galley and mess (C deck, under the forecastle) | seamen's and firemen's mess rooms | — | BOT |
| Stewards | E deck port side along Scotland Road (victualling dept 544 men) | — | BOT |
| Engineers | E deck compartment beside the reciprocating-engine casing; engineers' mess opposite the engines; workshop and stores on G deck | — | BOT |
| Officers' quarters (Boat Deck) | house ≈219–305 ft **[02]**; captain's three rooms starboard forward; officers port; officers' smoke room; Marconi suite aft | teak-trimmed exterior; interior white enamel with varnished teak/mahogany furniture (standard H&W practice — inference) | BOT ; `02-deckplans` |
| Hospital (D deck, stbd) | ≈54 ft (16.5 m) of rooms | white enamel | BOT |

---

## 22. Navigating bridge and wheelhouse

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | bridge front 190 ft from bow, ≈60 m from the bow and ≈23 m above the waterline; stands 8 ft above the Boat Deck; wing cabs overhang each side; wheelhouse ≈203–218 ft, ≈15 ft fore-aft × ≈27 ft wide **[02]** | 57.9 m ; 2.4 m ; 62–66 m ; 4.6 × 8.2 m | https://en.wikipedia.org/wiki/Titanic_navigation_bridge ; `02-deckplans` |
| Bridge shelter | 9 windows; auxiliary helm (teak wheel 3 ft 9 in dia. on a 34-in brass pedestal) mechanically linked to the rudder; electric rudder-angle indicator (axiometer) on the ceiling; five order transmitters (telegraphs): 2 engine, 2 docking, 1 emergency engine telegraph (to port of the wheel); telegraph positions Dead Slow / Slow / Half / Full, Stop, Stand By, Finished With Engines; course compass of Glasgow make in a wooden (teak) base, lit by an internal oil lamp, holding a 10-in Kelvin-White compass | 1.143 m ; 0.864 m ; 254 mm | same ; https://titanicconnections.com/titanic-tours-the-bridge-a-titanic-connections-feature/ [snippet] |
| Wheelhouse | 5 windows (flat front on Titanic; Olympic's as built was curved) [snippet]; helmsman on a small platform; main wheel 3 ft 6 in on a 32-in pedestal, steering binnacle and telemotor in the centre; blinds lowered at night; telegraph dials lit from inside at night, unlit at sea; four horn (loud-speaking) telephones: forecastle, crow's nest, engine room, docking bridge; watertight-door closing switch; submarine-signal receiver; speed indicator, clinometer, two pendulums, sextants, chronometers, thermometers, barometers; lockers "white enamelled with a teak top" [forum snippet] | 1.067 m ; 0.813 m | Wikipedia navigation bridge ; https://www.encyclopedia-titanica.org/community/posts/461869/ [snippet] |
| Materials/colours | exterior white (#F3F1EA) with varnished teak windows/doors (dark red-brown varnish, #7E4E2A); brass telegraph pedestals and fittings (#B8923D); teak baseboard outlines the wheelhouse on the wreck; **interior: recommend white enamel bulkheads, varnished teak joinery, planked deck (#C9B183), brass; dial faces white/black** | — | https://trmaarchive.com/paint ; titanicconnections [snippet] |
| Chart room (port, abaft wheelhouse) | two Magneta master clocks; chart portfolios, signal code, logbooks; harbour pilot's cabin adjoining | — | Wikipedia navigation bridge ; `02-deckplans` |
| Navigating room (stbd) | between wheelhouse and the captain's sitting room; submarine-signal receivers | — | BOT Elec ; `02` |
| Compass platform | raised teak-and-brass platform on the lounge roof between funnels 2 and 3 (≈436 ft / 133 m) with the standard compass | — | Wikipedia navigation bridge ; `02` |
| Docking bridge (poop, ≈846 ft / 258 m) | open, transverse; two telegraphs, a third wheel, a compass; white except its planked deck; telegraph bases unpainted (bronze) [snippet] | — | Wikipedia navigation bridge ; TRMA paint ; ET [snippet] |
| Wreck | a bronze control from the main helm (telemotor) still stands | — | Wikipedia navigation bridge |
| Reference photos | *Olympic* bridge and wheelhouse interior photos (ET thread) | — | https://www.encyclopedia-titanica.org/community/threads/3617/ |

---

## 23. Marconi wireless suite (Boat Deck)

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Position | aft end of the officers' house, centreline, abaft the funnel-1 casing, ≈285–305 ft from bow (≈12 m abaft the forward end of the Boat Deck houses per Wikipedia) **[02]** | 87–93 m | BOT Accommodation ; https://en.wikipedia.org/wiki/Titanic_navigation_bridge |
| Layout | three rooms: soundproofed Silent Room (port) holding the 5-kW rotary spark discharger, transformers and condensers; operating room (centre) with the operating table, receivers and Morse keys, pneumatic tube from the Enquiry Office for passenger Marconigrams, several synchronised clocks; operators' bedroom (starboard) with bunk beds, wardrobe and sink; skylight on the roof finished teak-colour | — | Marconi PDF https://oe5.oevsv.at/export/shared/.content/.galleries/pdf-Downloads/The-wireless-story-of-the-Titanic-Continental-English.pdf ; `02-deckplans` ; https://trmaarchive.com/paint |
| Equipment | Marconi 5-kW motor-generator; synchronous rotary spark discharger; receiver: magnetic detector + Marconi multiple tuner + telephone condenser; Marconi valve receiver as backup; emergency set: 10-in induction coil on 8 chloride accumulators (6 h of plain spark); two complete sets (transmit in the sound-proof chamber, receive outside); aerial four parallel wires on booms between the masts (T-aerial, lead-in ≈50 m high); working range ≈800 km day / >3,000 km night at 300–600 m wavelength | 254 mm coil | BOT Elec ; https://www.encyclopedia-titanica.org/the-marconi-wireless-installation-in-rms-titanic.html [snippet] ; Marconi PDF |
| Finish | **recommend** white-enamelled panelling, varnished wood operating bench, black Bakelite/ebonite and brass instruments, slate switchboard, exposed copper bus-bars and glass Leyden-jar condensers in the Silent Room, bulkhead lamps | — | inference from the equipment list |
| Call sign | MGY | — | Marconi PDF |

---

## 24. Boiler rooms (6) and stokeholds

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Positions (tank top, from `01`) | BR 6: 193–247 ft; BR 5: 247–304; BR 4: 304–361; BR 3: 361–418; BR 2: 418–478; BR 1 (single-ended): 478–514 | 58.8–75.3 ; 75.3–92.7 ; 92.7–110.0 ; 110.0–127.4 ; 127.4–145.7 ; 145.7–156.7 m | `01-dimensions` ; BOT |
| Boilers | 24 double-ended + 5 single-ended Scotch boilers; all 15 ft 9 in diameter; double-ended 20 ft long, single-ended 11 ft 9 in; 6 furnaces per double-ended, 3 per single-ended, 159 furnaces; 215 psi working pressure; each boiler ≈91.5 t, 48.5 t water; five abreast (four in BR 6); on steel cradles chocked to the hull | 4.80 m ; 6.10 m ; 3.58 m | https://www.ggarchives.com/OT/Titanic/01-PlanningBuildingLaunching/Machinery.html ; https://en.wikipedia.org/wiki/Titanic |
| Stokehold | natural draught with 12 electric fans blowing into the open stokehold; Kilroy stoking indicators (5 per stokehold) stopping opposite furnace doors opening together; bunker door opposite each boiler so the trimmer's coal lies behind the fireman; ash ejector per boiler room; ash hoists; 176 firemen on 4-on/8-off watches; ≈120 °F (49 °C) | — | https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-04-PropellingMachinery.html ; Wikipedia Titanic ; https://titanic.fandom.com/wiki/Engineering_Crew [snippet] |
| Coal | 6,611 t in bunkers + 1,092 t in hold 3; >600 t/day burned; ≈100 t/day ash | — | Wikipedia Titanic |
| Colours (no photograph of Titanic's or Olympic's boiler rooms exists) | forum/modeller consensus: red-lead (#8C3A2B) lower bulkheads and bilges, white or light grey upper bulkheads, boiler fronts black/graphite (#2A2A2A) with cast-iron furnace doors, brass gauge faces, steel floor plates (chequer) dark grey, coal black with soot everywhere; bulkhead lamps with wire guards (tantalum lamps except where vibration demanded carbon) [snippets] — **adopt this scheme, flag as inference** | — | https://www.encyclopedia-titanica.org/community/goto/post?id=454592 ; https://www.encyclopedia-titanica.org/community/threads/engine-and-boiler-rooms-interiors.17888/latest ; BOT Elec |
| Uptakes | up to 20 branches to one funnel in BR 3 and 4; branches of adjoining rooms join just above the dividing bulkhead; funnels 24 ft 6 in × 19 ft elliptical, ≈150 ft above the furnace bars | 7.47 × 5.79 m ; 45.7 m | Shipbuilder-04 |

---

## 25. Reciprocating engine room, turbine room, dynamo room

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Positions | reciprocating-engine room 514–583 ft (bulkheads K–L, 69 ft); turbine room 583–640 ft (57 ft); electric engine (dynamo) room abaft, ≈63 ft long × 24 ft high | 156.7–177.7 m ; 177.7–195.1 m ; 19.2 × 7.3 m | `01-dimensions` (BOT compartment lengths) ; BOT Elec |
| Reciprocating engines | two four-cylinder triple-expansion, four-crank; cylinders HP 54 in, IP 84 in, two LP 97 in; stroke 6 ft 3 in; order from forward LP–HP–IP–LP; each 63 ft long, 720 t + 195-t bedplate; columns of the "split" type, 21 t each; heaviest cylinder with liner 50 t; 215 psi inlet, 9 psi abs exhaust; piston valves (HP/IP), double-ported slide valves with Stephenson link (LP); Brown steam-hydraulic reversing engines | 1.372 / 2.134 / 2.464 m ; 1.905 m ; 19.2 m | GG Machinery ; Shipbuilder-04 ; Wikipedia Titanic |
| Turbine | Parsons low-pressure reaction turbine, ahead only, centre shaft, 16,000 hp; two pear-shaped mild-steel condensers (50,550 sq ft) with four 29-in gun-metal circulating pumps; four Weir dual air pumps (36-in barrels × 21-in stroke) | 4,696 m² ; 0.74 m ; 0.91 × 0.53 m | GG Machinery ; Shipbuilder-04 |
| Engine-room colours (no photograph of Titanic's) | the only strong evidence is from similar surviving engines and wreck remnants: cylinders and columns in gloss dark or light green (one Olympic-class model builder: "green"), or light grey; white-painted cylinder bottoms and crank pits per one video comment; polished steel rods, brass oil cups, gauges and whistles; floor plates chequer steel; gratings; cast-iron columns with bright-metal edges [snippets]. **Recommend: columns and casings mid-green gloss (#4C6B4F) with light-grey (#B9BDB8) upper cylinder lagging, white bulkheads above, red-lead below the platforms, bright steel/brass detail.** | — | https://www.encyclopedia-titanica.org/community/posts/461666/ ; https://www.encyclopedia-titanica.org/community/goto/post?id=461908 ; https://www.encyclopedia-titanica.org/community/threads/engine-and-boiler-rooms-interiors.17888/latest |
| Lighting | bulkhead and pendant lamps with clear globes; a few carbon lamps in the engine room where vibration was pronounced; engine-room skylights on the Boat Deck | — | Shipbuilder-07 ; BOT Elec |
| Dynamo room | four Allen 400-kW sets, switchboard, ammeters reading to 5,000 A each; the two emergency 30-kW sets up in the turbine casing at D-deck level | — | BOT Elec ; Shipbuilder-07 |
| Workshop/stores | G deck alongside the engine room | — | BOT Accommodation |

---

## 26. Cargo holds and the Renault

| Attribute | Value | Metric | Source |
|---|---|---|---|
| Holds | seven (six forward, one aft): No. 1 under the forecastle (hatch 1), Nos. 2 and bunker hatch in the forward well, No. 3 under the bridge (142–193 ft), No. 4 aft on A/B, Nos. 5–6 in the after well; hatch coamings black (No. 4 excepted); foremast derrick "for lifting motor cars into the forehold" | 43–59 m | `01-dimensions` ; BOT |
| Spaces | mail and specie 26,800 cu ft; baggage 19,455 cu ft; post office on G deck; 1,092 t coal in hold 3 | 760 m³ ; 551 m³ | Wikipedia Titanic |
| Cargo character | mundane — e.g. 76 cases dragon's-blood resin, 12 cases ostrich feathers, 16 cases calabashes, furniture, foodstuffs; wooden crates, barrels, bales | — | Wikipedia Titanic |
| The Renault | 1912 Renault Type CB Coupé de Ville (Wikipedia Titanic article: "Type CE"), 12 CV (French fiscal hp; also quoted 25/35 hp), 2.6-l four-cylinder, bought in Europe by William Carter (Bryn Mawr, PA); on the manifest; insured $5,000 with Lloyd's; stowed in a forward cargo hold (French-American research) and, per one forum claim, dismantled and crated — the film's intact car is dramatic licence; never found | — | https://www.motorbiscuit.com/1912-renault-type-cb-coupe-de-ville-worth-130000-car-sink-titanic ; https://www.prewarcar.com/scoop-de-beroemdste-renault-ter-wereld-teruggevonden ; https://www.titanicpages.com/williamcarter ; https://www.encyclopedia-titanica.org/community/goto/post?id=395834 [snippet] |
| Renault colour | **no period source records the colour.** The 1997 film replica (built from Carter's documents, "recreated almost exactly" per Wikipedia) is a dark red/burgundy-bodied town car with black fenders, roof and running gear and buttoned dark leather/cloth interior (as seen on screen); a museum replica is listed as "red with black interior" [snippet]. **Recommend body #5E1E22 (deep claret), black wings/roof #121212, brass lamps and radiator shell, natural wood-spoke wheels or black artillery wheels** | — | https://en.wikipedia.org/wiki/Renault_Towncar ; https://www.volocars.com/vehicles/17125/1912-renault-type-cb-coupe [snippet] |

---

## 27. Exterior materials (cross-reference `01-dimensions-hull-exterior.md` §7, §11, §12 for hull/funnel/lifeboat colours)

| Item | Value | Metric | Source |
|---|---|---|---|
| Deck planking species | yellow pine on the main passenger decks (Boat, A, B, C where exposed); pitch pine ("a bit more durable") on the forecastle, well decks and poop; teak only as margin/trim planks round deck hardware, officers' quarters and bridge | — | https://trmaarchive.com/paint ; https://www.titanicconnections.com/?p=2751 [snippet] ; BOT |
| Plank width | 5 in throughout, 6 in on the well decks (TRMA, from H&W drawings); forum alternative 6 in (150 mm) | 127 mm ; 152 mm | https://trmaarchive.com/articles/planking/Deck%20Planking.htm ; ET [snippet] https://www.encyclopedia-titanica.org/community/goto/post?id=452886 |
| Plank thickness | pine and teak margin planks 3 in; forecastle teak 4 in (chamfered where 4-in teak meets 3-in pitch pine); 5 × 3 in pitch pine with 10 × 4 in planks under the anchor-cable tracks and windlasses [snippets] | 76 mm ; 102 mm ; 127 × 76 ; 254 × 102 mm | https://www.encyclopedia-titanica.org/chamfering-thicker-teak-sheathing-titanic-forecastle-deck.html [snippet] ; https://www.encyclopedia-titanica.org/community/goto/post?id=452906 [snippet] |
| Fastening / caulking | planks fastened to the steel deck with bolts and wooden dowel plugs; seams caulked (material not documented for Titanic — standard practice was oakum payed with pitch/marine glue → black seams ≈¼ in / 6 mm wide) | — | Titanic Connections [snippet] ; ET "Remains of decking" [snippet] https://www.encyclopedia-titanica.org/community/threads/remains-of-decking-in-1985.18479/latest |
| Deck colour | "very pale, light brownish-grey to yellowish tan" holystoned pine (#C9B183); pitch pine slightly darker (#BFA270); a 1912 writer: "yellow-pine deck planks that make a beautiful white deck"; teak margins #7E4E2A | — | https://trmaarchive.com/paint |
| Deckhouses, bulwarks, davits, cranes, cowl vents and bases, railings and stanchions, boat-deck ladders | white, slightly warm (#F3F1EA); Titanic's vent bases white (Olympic's early ones black) | — | TRMA paint |
| Rail caps | oiled teak, "pale faded golden-brown" (#B38A5A) on white steel stanchions with burnished steel wire | — | TRMA paint |
| Windows | teak-framed windows varnished "dark red-brown with a strong red component" (#7E4E2A→#8A3A2A); steel officers'-quarters windows painted to match; the forward-facing A-deck windows brass (metallic) | — | TRMA paint |
| Doors | exteriors white; oval knob plates match the varnished windows; door splats (slats) teak | — | TRMA paint |
| Roofs | wood-planked roofs = deck colour; steel casings and most deckhouse roofs dark grey (FS 36118 class, #5B6064); canvas-covered/wood-sheathed roofs light bluish grey (#B9BAB6); waterways black | — | TRMA paint |
| Skylights | white except the Marconi-room and officers'-lavatory skylights, finished teak colour | — | TRMA paint |
| Funnels | White Star buff (#C9955F, see `01` §7) lower, black tops ≈18 ft; lowest 8 ft of funnel shrouds black | 5.5 m ; 2.4 m | TRMA paint ; `01` |
| Lifeboats | hulls and davits white (optionally a touch darker than the superstructure); interiors "stone" (#CFC2A2); gunwales and falls dark brown (#5C3B21, same as the deck-chair teak); grab ropes hemp; canvas covers dirty off-white (#D9D3C3); 30 ft × 9 ft 1 in × 4 ft clinker yellow-pine boats (see `01` §11) | 9.14 × 2.77 × 1.22 m | TRMA paint ; `01-dimensions` |
| Deck chairs & benches | natural teak, not stained (#B38A5A–#7E4E2A), rattan centres light tan (#D2B37C); wrought-iron bench ends with teak slats | — | TRMA paint |
| Masts, well-deck dadoes, crane/hatch bases | rust-brown "mast colour" (#7A4A31); the film's terracotta is "known to be incorrect" | — | TRMA paint |
| Winches | electric winches green chromate (#3E4B3B), drums black; forecastle steam winches black | — | TRMA paint |
| Brass/bronze | portholes, whistles, phone boxes brass; propellers, capstan covers bronze, dulled; bridge/docking telegraphs brass with bronze bases | — | TRMA paint |
| Hydrants | red (#B52A2A) | — | TRMA paint |
| Running lights | port red (slightly darkened), starboard green (winch-green darkened) | — | TRMA paint |
| Stays and shrouds | burnished galvanised steel, silver-grey | — | TRMA paint |

---

## 28. Film (1997) versus ship — notes for art direction

| Item | Ship (best evidence) | Film | Source |
|---|---|---|---|
| Grand Staircase | 16 ft wide, 12 steps, oak, cream/black lino landings | ≈30 % larger, 13 steps, steel frame, some plaster newels | https://en.wikipedia.org/wiki/Grand_Staircase_of_the_Titanic |
| Smoking Room floor | dark red and blue lino (wreck, Marschall) | green tiles | https://www.encyclopedia-titanica.org/community/posts/227787/ [snippet] |
| Masts/dadoes | rust-brown | terracotta ("now known to be incorrect") | https://trmaarchive.com/paint |
| Renault | crated in a forward hold | assembled in the hold | https://www.mentalfloss.com/posts/titanic-artifacts-went-down-with-ship [snippet] |
| 1st-class corridor set | Olympic/Titanic B-deck corridor photo exists; film corridor reportedly modelled on Lusitania/Mauretania | — | https://www.encyclopedia-titanica.org/community/threads/first-class-corridors.17053/latest [snippet] |
| Scotland Road | white enamel steel (inference) | "white and metallic" | https://titanic.fandom.com/wiki/Scotland_Road [snippet] |

---

## 29. Recommended hex palette summary (quick copy)

| Token | Hex | Use |
|---|---|---|
| oak_polished | #8B6A3E | staircases, lounge, 2nd-class oak rooms |
| oak_dark | #5E4426 | fielded panel shadows, Old Dutch cabins |
| mahogany | #4A2418 | smoking room, 2nd-class furniture |
| walnut_fawn | #A8865C | restaurant |
| sycamore | #D9C9A5 | 2nd-class library |
| teak_varnished | #7E4E2A | Turkish bath, pool, bridge joinery, windows |
| teak_oiled | #B38A5A | rail caps, deck chairs |
| white_enamel | #F4F1E8 | Jacobean/Georgian painted rooms, corridors |
| white_steel | #EEEBE3 | 3rd-class dining, crew, bridge lockers |
| dove_grey | #B9B7B0 | reading-room accents |
| ormolu | #C8A04E | gilt bronze |
| bronze | #6B4A2A | cherub, Arab lamps, grilles |
| brass | #B8923D | telegraphs, portholes |
| iron_black | #1E1E1E | balustrades, dome ribs |
| lino_cream / lino_black | #E8DFC6 / #1C1A18 | staircase landings |
| lino_blue_pale / lino_red / lino_blue_dark / lino_ochre | #8FA8BF / #8E2E2B / #2D3F6B / #C8A24A | dining saloon |
| lino_smoke_red / lino_smoke_blue | #7E2A24 / #2D3F6B | smoking room |
| lino_salmon | #E7A58F | 3rd-class cabins |
| lino_red_3rd | #9B3A2F | 3rd-class open space |
| tile_pool_blue / tile_white | #1E3F7A / #F2F2EE | pool |
| tile_turkish_blue / tile_turkish_green / turkish_ceiling_red / gilt_beam | #2E5F8F / #3E8C78 / #7A2E2C / #C9A54A | Turkish bath |
| chequer_tan / chequer_cream | #B08A5E / #E6D7B8 | Verandah Café |
| axminster_red / axminster_blue | #6B1F22 / #2A3C6E | reception room |
| rose_dubarry | #C97B86 | restaurant carpet |
| pink_carpet | #B85C72 | reading room |
| velvet_green / velvet_gold | #3C6B4A / #C7A04C | lounge |
| leather_green_dark | #2E4A3A | dining-saloon chairs |
| leather_green_morocco | #2F5A3E | 2nd-class smoke room |
| leather_red | #7A1F1F | 2nd-class dining chairs |
| leather_burgundy | #5A2A2A | 1st-class smoke-room club chairs |
| silk_green_damask | #4E7A5C | reception Chesterfields |
| deck_pine / deck_pitchpine | #C9B183 / #BFA270 | decks |
| superstructure_white | #F3F1EA | exterior |
| mast_rust | #7A4A31 | masts, dadoes, gunwales |
| lamp_carbon_2125K / lamp_tantalum_2350K | #FF9A3C / #FFA552 | light colour |

---

## 30. Reference imagery (public-domain *Olympic* photographs and drawings)

| Subject | Link |
|---|---|
| Shipbuilder 1911 accommodation chapter with figures (lifts, dining-saloon bay window, reception room, suite plans) | https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/TheShipbuilder-06-PassengerAccommodation.html |
| Shipbuilder B-deck suite plan (Fig. 91) | https://www.ggarchives.com/CVimages/OT/Titanic/TheShipbuilder/1911-Midsummer/85-PlanOfSuiteRoomsOnBDeck.jpg |
| Shipbuilder C-deck special staterooms plan | https://www.ggarchives.com/CVimages/OT/Titanic/TheShipbuilder/1911-Midsummer/87a-PlanOfTypicalSpecialStateroomsOnCDeck.jpg |
| GG Archives ship-interior image topic | https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/Topic-ShipsInterior.html |
| Grand Staircase, Olympic (W. H. Rau, 1911) | https://de.wikipedia.org/wiki/Datei:Grand_Staircase_aboard_the_RMS_Olympic_(William_H._Rau_1911).jpg |
| Cool Room illustration (colour, CC0) | https://commons.wikimedia.org/wiki/File:Cool_Room_of_the_Turkish_Baths,_RMS_Olympic.jpg |
| 2nd-class Library, Olympic | https://wiki.riteme.site/wiki/File:2nd-Class_Library_on_the_RMS_Olympic.jpg |
| 2nd-class Smoking Room, Olympic (RMG G10778) | https://download.osmand.net/wiki/File:Second_Class_Smoking_Room_on_the_%27Olympic%27_(1911)_RMG_G10778.jpg |
| 3rd-class Smoking Room, Olympic (RMG G10783) | https://download.osmand.net/wiki/File:Third_Class_Smoking_Room_on_the_%27Olympic%27_(1911)_RMG_G10783.jpg |
| 3rd-class cabin, Olympic | https://download.osmand.net/wiki/File:3rd_Class_Cabin.jpg |
| Reception Room, Olympic 1911 (Library of Congress LC-DIG-ds-12333) | cited via https://www.ggarchives.com/OT/Titanic/25-ImageLibrary/Topic-RMSOlympic.html |
| Bedford Lemere interiors (Historic England: companionway, cabin C-69) | https://images.historicenglandservices.org.uk/photo-prints/architecture/interiors/rms-olympic-bl24990-002-693523.html |
| Café Parisien proposed design (RMG) | https://rmg.co.uk/collections/objects/rmgc-object-20403 |
| Olympic bridge/wheelhouse interiors (forum) | https://www.encyclopedia-titanica.org/community/threads/3617/ |
| Titanic: Honor and Glory (not reachable by automated search; open in a browser for the most complete modern CG reconstruction) | https://www.titanichg.com/ |

---

## 31. Gaps and items to verify by hand

1. Dome dimensions and rib count for both Grand Staircase domes (only a 20-ft claim from a secondary site; Beveridge's plans show the forward dome oval, aft round).
2. Exact linoleum patterns for the Dining Saloon and Smoking Room — recovered fragments give the colours but not the full repeat; Parks Stephenson's CG reconstruction (from Marschall's 2001 observations) is the best reference.
3. Lounge carpet colour, Smoking-Room chair colour, Wilton-carpet colour in the 2nd-class Library — undocumented.
4. Café Parisien dimensions — no primary figure; forum estimates 84–87 × 17–19 ft.
5. Engine-room and boiler-room paint — no photograph of either ship's machinery spaces; green vs grey engine columns is unresolved.
6. The Renault's colour — not recorded anywhere; the film's claret is a design choice.
7. First-class corridor floors (carpet runner vs linoleum) — disputed.
8. Per-cabin style list is community-compiled from the plans; Encyclopedia Titanica's threads (blocked here) hold the full tables.
9. Tantalum-lamp colour temperature — no published figure; 2,300–2,400 K is an estimate bracketed by carbon (2,125 K) and tungsten (2,400 K).
