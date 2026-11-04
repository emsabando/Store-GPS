# A Night to Remember Forever — Narrative Design Document
**Working title.** Free-roam 3D parody/homage set aboard an accurate RMS Titanic (10–15 April 1912).
**Owner:** Narrative Design. **Audience:** writers, quest scripter, NPC-dressing pipeline, UI team.
**Status:** v1.0 — single source of truth. Changes go through this file.

---

## 0. Legal & Tonal Posture (read first)

- This is a **parody with changed names**. Every character who corresponds to a figure in the 1997 film has a punny, period-plausible name listed in §1. Never use the film's character names, the film's dialogue, its score, its poster framing, or any shot-for-shot staging. Beats are *evoked*, never copied.
- **The ship is real.** RMS Titanic, White Star Line, Harland & Wolff, Belfast, Southampton, Cherbourg, Queenstown, Carpathia, Californian: these are history and may be named. Discovery plaques (§3) quote only documented fact.
- **The jewel** is "The Heart of the Deep" — a blue sapphire (not a diamond) in a platinum heart setting. Never call it anything else.
- **Tone:** warm, wry, affectionate. We are laughing *with* the melodrama, never at the dead. The disaster itself (Watch IV) drops the jokes almost entirely; comedy lives in Watches I–III and the free-roam layer.
- **Dialogue is text-only** (speech bubbles + Ship's Log). No voice acting is assumed; "voice" below means prose register.
- **Rating target: PG-13.** See §5.

---

## 1. Character Roster

Format for each: **Name** (film analogue, for internal reference only — never shipped in game text) · Role · Look (procedural dressing tokens) · Personality · Voice · Whereabouts by Watch (I / II / III / IV / Epilogue) · Sample dialogue (original, ≤140 chars per line).

Dressing tokens use the NPC wardrobe schema: `[garment: colour / material] [hat] [hair] [props]`.

### 1.1 The Lovers

**JACK DRAWSON** *(the poor artist)*
- Role: Player character for most of the game. Penniless Wisconsin sketch artist who won a steerage ticket at cards on the Southampton quay.
- Look: `[jacket: faded brown / corduroy] [shirt: collarless cream / cotton, open] [trousers: charcoal / wool, braces] [boots: scuffed tan / leather] [hat: none; sometimes a flat cap, dun / tweed] [hair: sandy, swept back, untidy]` Props: battered leather portfolio tied with string, charcoal stubs.
- Personality: quick, generous, allergic to ceremony, braver than he is sensible. Hides the fact that he is lonely.
- Voice: short sentences, American, cheerful understatement. Never cruel. Jokes at his own expense first.
- Whereabouts: I — Southampton quay (Berth 44), then forward well deck / G Deck berth G-62. II — everywhere steerage, poop deck, then A Deck promenade (invited). III — bow, B-51 suite, holds. IV — Master-at-Arms office E Deck → everywhere with Rosie. Epilogue — not present (referenced).
- Sample dialogue:
  - "A ticket to New York for a pair of threes. Best hand I ever lost on purpose."
  - "I draw people. Faces mostly. Hands if they'll sit still, which they won't."
  - "Here's how it goes: you let go, I come after you. So neither of us lets go. Give me your hand."
  - "First class has a word for every fork. Steerage has one fork and a word for everything."
  - "Keep breathing. Keep kicking. Keep talking to me, Rosie. Tell me about Wisconsin winters."

**ROSAMUND "ROSIE" DeWITT-BOUQUET** *(the first-class heiress)*
- Role: Second playable character in Watch III–IV (axe rescue, flooded corridors). Seventeen, Philadelphia old money gone quietly broke, engaged against her will.
- Look: `[gown day: dove grey / silk faille, lace yoke] [gown dinner: oxblood / velvet, jet beading] [coat: cream / wool, fur collar] [hat: wide brim, plum / straw with ribbon] [hair: auburn, pinned up; loose after Watch III] [gloves: ivory / kid]` Props: fan, later a fire axe.
- Personality: furious intelligence, bored to the point of danger, a taste for modern painters nobody else has heard of. Learns to be reckless on purpose.
- Voice: precise, witty, a little formal; shortens as she thaws. Uses "frankly" when about to be rude.
- Whereabouts: I — Southampton quay (motorcar), B-51/53/55 suite (B Deck starboard, private promenade). II — A Deck promenade, D Deck Dining Saloon, poop deck (night of 11 April), Third Class General Room (party). III — forecastle bow at sunset, B-51 sitting room, cargo hold. IV — B Deck → E Deck → Boat Deck → Collapsible D → the water. Epilogue — see Old Rosamund.
- Sample dialogue:
  - "Frankly, I could die of boredom before we reach the open sea. A pity the sea would get the credit."
  - "You've been staring. Either sketch me or confess you've forgotten how eyes work."
  - "Mother says I must marry a fortune. I asked if she meant the biscuit. She did not laugh."
  - "I will not be sold with the silver, Cal. Not even in a very nice box."
  - "Give me the axe. No — I've seen you aim. Give me the axe."

### 1.2 The Opposition

**CARLETON "CAL" HOCKSTONE** *(the wealthy fiancé)*
- Role: Antagonist. Pittsburgh steel heir, thirty, owner of the Heart of the Deep, bad loser.
- Look: `[coat: black / cashmere, velvet collar] [waistcoat: dove / silk] [tie: silver / satin] [hat: top hat, black / silk plush] [hair: black, oiled, centre-parted] [moustache: thin]` Props: silver cigarette case, a pistol in Watch IV (never fired at the player; see §5).
- Personality: possessive, charming in public, petty in private. Thinks money is a personality.
- Voice: smooth, condescending, over-fond of the word "naturally". Insults phrased as compliments.
- Whereabouts: I — quay, B-51 suite. II — A Deck Smoking Room, Dining Saloon, Café Parisien. III — B-51 suite, then searching the ship. IV — B Deck, bridge wing, Boat Deck → Collapsible C.
- Sample dialogue:
  - "Naturally the suite is the finest aboard. I asked for the finest. Things tend to arrive when I ask."
  - "A sketch artist. How refreshing. Rosamund collects strays the way other girls collect ribbons."
  - "I don't lose at cards, Mr. Drawson. I merely let others feel they've won. Shall we test it?"
  - "Something has gone missing from my safe. I'm sure the Master-at-Arms will be fascinated."
  - "Get me a seat in a boat and I'll see your family comfortable. I'm a reasonable man when I'm winning."

**PRUDENCE DeWITT-BOUQUET** *(the mother)*
- Role: Rosie's widowed mother. Keeper of appearances; terrified of poverty; not entirely a villain.
- Look: `[gown: slate blue / taffeta, high collar] [hat: toque, black / velvet with egret plume] [hair: grey-blonde, Edwardian pompadour] [gloves: grey / kid] [lorgnette]`
- Personality: brittle, snobbish, exhausted by the arithmetic of debt. Loves her daughter in the only language she knows.
- Voice: icy good manners. Speaks in corrections. Never raises her voice; lowers it.
- Whereabouts: I — quay, B-51 suite. II — A Deck Reading & Writing Room, Dining Saloon, tea in the Palm Court. III — B-51 suite. IV — Boat Deck, into Lifeboat 6 (port side).
- Sample dialogue:
  - "One does not say 'big', dear. One says 'considerable'. Even of a ship."
  - "Your father left us a name and a great many bills. The name is the asset. Try to remember which."
  - "Mr. Drawson, how fascinating. And where does one *live*, when one lives nowhere?"
  - "Rosamund, get in the boat. We will quarrel about it properly in New York."

**SPICER KILLJOY** *(the fiancé's valet/bodyguard)*
- Role: Cal's ex-policeman shadow. Plants the jewel on Jack. Does the dirty work with a straight face.
- Look: `[overcoat: iron grey / melton] [suit: charcoal / worsted] [bowler: black / felt] [hair: close-cropped grey] [moustache: clipped]` Props: a revolver kept holstered.
- Personality: dry, observant, professionally bored. The only one who notices Jack is competent.
- Voice: flat Lancashire understatement. Says "sir" like a full stop.
- Whereabouts: I — quay, B Deck corridors. II — never more than forty feet from Cal; shadows Jack on the poop deck. III — pursuit through Scotland Road to the holds. IV — Master-at-Arms office, then B Deck. Not seen after the break-up.
- Sample dialogue:
  - "Steerage, sir. He'll be forward, low, and loud. They always are."
  - "Interesting coat you've got, lad. Roomy pockets. A man could lose all sorts in there."
  - "I were a constable twelve years. I know the look of a man about to run. Don't run."
  - "Every ship's got a cellar. Every cellar's got a locked door. I'm patient, sir."

### 1.3 Steerage Friends

**FIORELLO "FIO" FORTUNATO** *(the Italian friend)*
- Role: Jack's travelling companion and co-winner of the tickets. Comic warmth; the heart of steerage.
- Look: `[jacket: olive / wool, patched elbows] [shirt: striped blue-white / cotton] [waistcoat: mustard / wool] [cap: flat, black / wool] [hair: dark curls] [scarf: red / cotton]` Props: a tin of his mother's biscotti.
- Personality: romantic about America, about women, about the ship's plumbing. Optimistic to a fault.
- Voice: exuberant, Italian-inflected English (no phonetic spelling — rhythm and word order only). Exclaims.
- Whereabouts: I — quay, G Deck berths. II — forward well deck, Third Class General Room (party), poop deck. III — Third Class Open Space on D Deck forward. IV — steerage stairwells, gates on E Deck; last seen helping Bridget's children aft (fate implied, not shown).
- Sample dialogue:
  - "America! I can smell it already. Is a little like coal and seagulls, but is America."
  - "Jack, the beds are *clean*. Clean beds, hot soup, a toilet that flushes by itself. We are rich men."
  - "You go upstairs to the rich lady. I stay here with the poor ladies. Is a fair trade."
  - "The gate is locked. So. We find a different gate. A ship is nothing but doors, yes?"

**TOMMY BRANNIGAN** *(the Irish steerage friend)*
- Role: Steerage realist. Supplies the class commentary. Co-leads the party.
- Look: `[jacket: peat brown / frieze] [shirt: grey / flannel] [cap: flat, brown / tweed] [hair: red, cropped] [boots: hobnailed black]` Props: a clay pipe, tin whistle.
- Personality: sardonic, loyal, spoiling for an argument and a dance in equal measure.
- Voice: Ulster cadence, dry as turf. Rhetorical questions. Calls everyone "lad" or "missus".
- Whereabouts: I — quay (boards at Southampton), G Deck. II — poop deck rail, General Room (party). III — Third Class Smoking Room, C Deck aft. IV — the E Deck gates with Fio; fate implied.
- Sample dialogue:
  - "Forty-six thousand tons of ship, lad, and they still can't spare us a window."
  - "You think a girl like that marries a fella like you? Ah, now. You've charm. Charm's not a trade."
  - "A party's a party. Nobody checks your ticket at a reel."
  - "Locked. Grand. We'll have a word with the lock, then, won't we?"

**NORA CARTWHEEL** *(the little steerage girl)*
- Role: Jack's six-year-old dance partner; the player's first "quest-giver" in steerage.
- Look: `[dress: faded rose / cotton print, pinafore white] [cardigan: oatmeal / wool] [boots: brown, too big] [hair: dark plaits with string bows]` Props: a chalk stub.
- Personality: solemn, bossy, delighted by rules so she can break them.
- Voice: literal, declarative. Short lines.
- Whereabouts: I — forward well deck (hopscotch). II — General Room (party). III — D Deck Open Space. IV — with her father near the aft Third Class stairs; last seen being lifted toward a boat by a steward (survival left open).
- Sample dialogue:
  - "You draw badly. Draw me anyway."
  - "Da says there's a swimming bath on this boat. On a *boat*. That's silly."
  - "You have to hop on one foot or it doesn't count. Those are the rules. I made them."

### 1.4 First-Class Society

**"UNSINKABLE" DOLLY BEIGE** *(the nouveau-riche Denver lady)*
- Role: Jack's ally among the swells. Lends him an evening suit, teaches him the forks.
- Look: `[gown: emerald / satin with gold embroidery] [stole: fox / fur] [hat: enormous, teal / ostrich plume] [hair: strawberry blonde, piled] [jewellery: too much]`
- Personality: loud, kind, shameless about money because she remembers not having it.
- Voice: Colorado twang, folksy aphorisms, calls Cal "sonny".
- Whereabouts: I — quay (Cherbourg boarder in history; here she boards at Southampton for pacing; see §2 note). Cabin B-4. II — Dining Saloon, Palm Court, Boat Deck. III — Café Parisien. IV — Boat Deck → Lifeboat 6, where she argues for rowing back.
- Sample dialogue:
  - "Sonny, I've been new money so long it's practically old. Sit down before you fall up."
  - "Start from the outside and work in, honey. Same as a mine. Same as a marriage."
  - "My husband struck gold, I struck society. Mine was the harder dig."
  - "There are people in that water and we have oars. I don't see the difficulty, Quartermaster."

**ISIDORE & IDA STOUTHEART** *(the elderly first-class couple)*
- Role: Fifty years married. A quiet fixture of the Boat Deck. Side-quest givers (§3).
- Look: Isidore `[frock coat: black / wool] [waistcoat: pearl grey] [hat: homburg, grey] [beard: white, full]`. Ida `[gown: lavender / crêpe] [shawl: cream / cashmere] [hat: small bonnet, lavender] [hair: silver]`.
- Personality: finish each other's sentences; argue tenderly about nothing.
- Voice: gentle, old-fashioned, New York department-store courtesy.
- Whereabouts: I–III — Boat Deck starboard benches, A Deck Lounge, Dining Saloon. IV — Boat Deck near Lifeboat 8; they decline to be separated; the camera leaves them seated together (never shown after).
- Sample dialogue:
  - Ida: "Fifty years, young man. Fifty-one in June. We shall not start taking separate carriages now."
  - Isidore: "She is being stubborn." Ida: "I am being married."
  - Isidore: "If you find my spectacles, the reward is a story. I have a great many."

**BENJAMIN GILDENHEIM** *(the millionaire who dresses in his best)*
- Role: Mining magnate; Watch IV's quiet dignity beat.
- Look: `[day: tweed suit, heather / wool] [IV: full evening dress, white tie, black tails / barathea] [hair: dark, receding] [moustache: waxed]` Props: a cigar, a brandy glass.
- Personality: urbane, fatalistic, courteous to stewards.
- Voice: measured, European-American, aphoristic.
- Whereabouts: I–III — A Deck Smoking Room, Turkish Baths, Dining Saloon. IV — Grand Staircase A Deck landing, in evening dress with his valet.
- Sample dialogue:
  - "A gentleman does not meet the Atlantic in a lifebelt and a cardigan. Fetch my tails, Victor."
  - "We have dressed. We are ready. Tell anyone who asks that we did it properly."

### 1.5 Ship's Company

**CAPTAIN EDWIN J. SMYTHE-STEADFAST** *(the captain)*
- Role: Final voyage before retirement. Courteous, confident, slow to alarm.
- Look: `[uniform: navy / doeskin, four gold rings] [greatcoat: navy / melton] [cap: peaked, white cover, gold oak leaves] [beard: white, trimmed]`
- Personality: a kindly grandfather with a 46,000-ton ship and a timetable.
- Voice: soft, Hampshire-tinged, few words. Gives orders as suggestions and expects them obeyed.
- Whereabouts: I — bridge, Boat Deck. II — bridge, Dining Saloon (captain's table). III — bridge, chartroom; retires 21:20. IV — bridge, wireless room, then the wheelhouse as the water comes (fate implied).
- Sample dialogue:
  - "Full away, Mr. Hardaport. Let us see what Belfast built."
  - "Ice warnings, yes. We shall keep a sharp lookout and a steady course. It's clear as a bell."
  - "Mr. Rivetts. How long?" (Rivetts answers.) "I see. Uncover the boats. Quietly."
  - "You've done your duty, gentlemen. It's every man for himself now. Look after yourselves."

**THOMAS RIVETTS** *(the shipbuilder/designer)*
- Role: Harland & Wolff's managing director aboard for the maiden voyage; the ship's conscience.
- Look: `[suit: navy / serge, three-piece] [tie: maroon / knit] [hat: bowler, black] [hair: dark, side-parted]` Props: leather notebook, pencil behind ear, folded deck plan.
- Personality: kind, exacting, visibly in love with the ship. Notices every loose screw.
- Voice: Belfast-soft, technical, apologetic when delivering bad news.
- Whereabouts: I — everywhere, taking notes (A-36 cabin). II — Dining Saloon, boiler rooms, Reading Room. III — Grand Staircase (fixing a coat hook). IV — inspects with the Captain, then the A Deck Smoking Room by the fireplace, lifebelt untouched.
- Sample dialogue:
  - "Too many screws in the hat hooks. I've written it down. I write everything down."
  - "Five compartments open to the sea. She was built to float with four. She will founder. An hour. Perhaps two."
  - "There are not enough boats. There were never enough boats. I argued. I lost. Go up, Miss Bouquet."

**J. BRUCE DISMAY** *(the shipping-line chairman)*
- Role: White Star chairman. Wants headlines; gets one.
- Look: `[suit: grey / flannel, double-breasted] [tie: dark green / silk] [hat: homburg, grey] [moustache: heavy, dark]`
- Personality: vain, nervous, perpetually calculating what the newspapers will say.
- Voice: public-school brisk; speaks in press releases.
- Whereabouts: I–III — B-52 suite, bridge (uninvited), Dining Saloon. IV — Boat Deck starboard, helping load, then stepping into Collapsible C.
- Sample dialogue:
  - "Light the last boilers, Captain. A Tuesday arrival would be a sensation. Wednesday is merely punctual."
  - "Mr. Rivetts, must you say 'founder' so loudly? There are passengers."
  - "There was room in the boat. There was simply... room."

**FIRST OFFICER WILLIAM HARDAPORT** *(the first officer)*
- Role: On watch at 23:40. Starboard boats in Watch IV.
- Look: `[uniform: navy / doeskin, two gold rings] [greatcoat] [cap: peaked, black]` Props: whistle, later a revolver he throws into the sea unfired (§5).
- Personality: capable Scot, decisive, carries the collision on his shoulders.
- Voice: clipped Dumfries. Orders first, feelings never.
- Whereabouts: I–III — bridge, officers' mess. IV — bridge; starboard Boat Deck, Boats 7, 5, 3, 1, Collapsible A (fate implied).
- Sample dialogue:
  - "Hard a-starboard! Full astern! — Close the watertight doors. Now, man, now."
  - "Women and children first — then anyone who'll row. I've no time for ceremony."
  - "Get back, all of you! There'll be order on this deck if it's the last thing there is."

**SECOND OFFICER CHARLES LAMPLIGHTER** *(the second officer)*
- Role: Port-side boats. Strict about "women and children". Survives on an upturned collapsible.
- Look: `[uniform: navy, two rings] [cap] [hair: fair, close-cropped]` Props: megaphone.
- Personality: by-the-book, brave, dry humour that only appears in extremity.
- Voice: Lancashire officer-class, formal.
- Whereabouts: I–III — bridge, Boat Deck. IV — port side Boats 6, 8, 16, 14, Collapsible D; last on the roof of the officers' quarters.
- Sample dialogue:
  - "Women and children. I said women and children, sir. You are visibly neither."
  - "Lower away handsomely — handsomely! You'll tip her."
  - "If the boat's going down, I'm going up. That's merely geometry."

**WALLACE HEARTSTRING** *(the bandleader)*
- Role: Leads the eight-piece orchestra. Side-quest: the violin case (§3).
- Look: `[tailcoat: black] [waistcoat: white / piqué] [bow tie: white] [hair: dark, brilliantined, moustache]` Props: violin, a brass case plate reading W.H.
- Personality: modest, devout Methodist, conductor's patience.
- Voice: Lancashire gentleness, musical metaphor.
- Whereabouts: I–III — Reception Room D Deck (after dinner), A Deck Lounge, E Deck musicians' cabins. IV — Boat Deck by the Grand Staircase entrance, then the forward Boat Deck as it tilts.
- Sample dialogue:
  - "Gentlemen, ragtime for the nerves. Something with a lift. Nobody panics in two-four."
  - "My case has my name on the plate and my mother's hymnbook inside. I'd be grateful."
  - "We'll keep playing. Someone ought to. Hymn, now, I think. Softly."

**FREDERICK FLEETFOOT & REGINALD LEEWARD** *(the lookouts)*
- Role: Crow's nest, 22:00–midnight watch on 14 April. Side-quest: the missing binoculars.
- Look: both `[reefer jacket: navy / melton] [jersey: navy / wool] [cap: knitted navy] [scarf: grey]`. Fleetfoot slight and sharp-eyed; Leeward broad, red-cheeked.
- Personality: Fleetfoot anxious and precise; Leeward phlegmatic and cold.
- Voice: Liverpool banter.
- Whereabouts: I–III — crew mess (forecastle), crow's nest in rotation. IV — crow's nest at 23:39 (three bells), then Boat 6 (Fleetfoot) and Boat 13 (Leeward).
- Sample dialogue:
  - Fleetfoot: "No glasses again. They tell us look out for ice and give us two eyes and a bell."
  - Leeward: "Smell that? Ice. You can smell ice, you know." Fleetfoot: "You can smell your supper."
  - Fleetfoot: "Iceberg — right ahead! Ring it, ring it, ring it—"

**JACK SPARKS & HAROLD GROOM** *(the wireless operators)*
- Role: Marconi men. Side-quest: deliver a Marconigram (§3). Send CQD/SOS in Watch IV.
- Look: `[uniform: navy / serge, Marconi brass buttons] [cap: peaked, Marconi badge]`. Sparks lean, tired, headphones permanently on. Groom boyish, eager.
- Personality: Sparks irritable from a backlog of passenger telegrams; Groom cheerful, hero-worships him.
- Voice: telegraph clipped — Sparks drops articles; Groom over-explains.
- Whereabouts: I–III — Marconi Room, Boat Deck starboard aft of the bridge. IV — Marconi Room until 02:10; Groom survives on Collapsible B; Sparks's fate implied.
- Sample dialogue:
  - Sparks: "Backlog of forty messages. Rich people say 'arriving Wednesday' in a hundred different ways."
  - Groom: "He's sent CQD to everyone with an aerial. Carpathia's coming! Fifty-eight miles. Four hours."
  - Sparks: "Try SOS as well. New call. Might be the only chance we get to use it."

**MASTER-AT-ARMS AMBROSE MANACLE**
- Role: Ship's policeman. Arrests Jack. Decent man following a rich man's word.
- Look: `[uniform: navy, brass buttons, "M.A.A." collar badge] [cap] [moustache: walrus]` Props: handcuffs, ring of keys.
- Personality: ponderous, fair, hates paperwork more than criminals.
- Voice: slow, Hampshire policeman. "Now then."
- Whereabouts: I–III — E Deck forward (office, starboard, off the firemen's passage), patrols Scotland Road. IV — office; leaves to help on deck, taking the key with him (hence the axe).
- Sample dialogue:
  - "Now then. A gentleman says you've a sapphire in your coat. Let's have the coat, son."
  - "I'll be back for you directly. Don't go anywhere." (He does not come back.)

**STEWARD ALFRED PROMPTLY** *(the steward)*
- Role: First-class bedroom steward; the player's guide to etiquette and shortcuts. Fast-travel vendor for the Grand Staircase lifts.
- Look: `[jacket: white / drill, brass buttons] [trousers: black] [bow tie: black] [hair: slicked, side-parted]` Props: tray, key ring.
- Personality: unflappable, gossip-rich, secretly on Jack's side.
- Voice: London deference with an edge. "Very good, sir."
- Whereabouts: I–III — B Deck corridors, Grand Staircase, pantries. IV — knocking on doors with lifebelts; later holding the E Deck gate for steerage (player choice, §2.5).
- Sample dialogue:
  - "Lifts are for passengers, sir. Fortunately I've never been able to tell a passenger from a face."
  - "Mr. Hockstone tips in advice. Mrs. Beige tips in money. Guess whose rooms are warmest."
  - "Lifebelts on, please, ladies and gentlemen. Captain's orders. Purely a precaution. Purely."

**QUARTERMASTER ROWLAND SPOKE** *(the quartermaster at the wheel)*
- Role: At the wheel at 23:40. Later in charge of Boat 6, refusing to row back.
- Look: `[jersey: navy] [oilskin: black] [cap: knitted]` Props: nothing — his hands are on the wheel.
- Personality: nervous, rule-bound, bullies when frightened.
- Voice: Cornish, muttering.
- Whereabouts: I–III — wheelhouse. IV — wheelhouse, then Boat 6 with Prudence, Dolly and Fleetfoot.
- Sample dialogue:
  - "Hard a-starboard, aye... she's slow to answer, sir, she's slow—"
  - "We'll not go back. There's nothing back there but a lot of stiffs and a suction. Sit down, madam."

**FATHER THOMAS BIBLES** *(the priest)*
- Role: Second-class chaplain; holds Mass for steerage on Sunday; gathers the frightened on the aft Boat Deck.
- Look: `[cassock: black / wool] [coat: black / melton] [hat: biretta, black] [hair: grey]` Props: rosary.
- Personality: gentle, humorous about himself, unshakeable.
- Voice: Yorkshire warmth. Quotes nothing at length.
- Whereabouts: I–III — Second Class Library C Deck, Third Class General Room (Sunday Mass). IV — aft Boat Deck, then the poop deck.
- Sample dialogue:
  - "Mass at nine in the General Room. The piano's out of tune; the Lord won't mind and neither shall I."
  - "Stay close, all of you. We'll say it together. Louder than the sea, if we can."

**BRIDGET LULLABY** *(the mother with two children)*
- Role: Steerage Irish mother of Ciarán (7) and Siobhán (4). The Watch IV "put the children to bed" beat.
- Look: `[dress: navy / wool serge, white collar] [shawl: grey-green / knit] [hair: dark, bun]`. Children in `[nightshirts: cream / flannel]` by Watch IV.
- Personality: practical, dry, fiercely tender.
- Voice: Cork lilt, lullaby cadence in Watch IV.
- Whereabouts: I–III — G Deck family cabins aft, General Room, Open Space. IV — her cabin; later the aft stairs with Fio.
- Sample dialogue:
  - "Two children, one husband waiting in Boston, and no idea which is the most trouble."
  - "Into bed, the pair of you. I'll tell you about the land of the ever-young. It isn't far now."

### 1.6 The 1996 Frame

**BRICK LOOTWELL** *(the treasure hunter)*
- Role: Salvage entrepreneur aboard the research ship *Akademik Mirth*. Narrator of the prologue; chastened by the epilogue.
- Look: `[fleece: black] [jeans] [baseball cap: navy, "LOOTWELL MARINE"] [hair: grey stubble, goatee]` Props: two-way radio, Dr Pepper.
- Personality: hustler who slowly realises he's standing in a graveyard.
- Voice: investor-pitch American. Says "folks" to one person.
- Whereabouts: Prologue — *Mirth* operations room, submersible *Mirth-1*. Epilogue — *Mirth* afterdeck.
- Sample dialogue:
  - "Folks, we are three years and twelve million dollars into the biggest safe in the world. Open it."
  - "It's a drawing. A very good drawing. Of a necklace I'd like to meet."
  - "Three years I thought about nothing but the stone. I never once let it in. The ship, I mean."

**LEWIS "LEW" BODKIN** *(his tech)*
- Role: ROV pilot, animator of the infamous "how she sank" tabletop simulation. Comic relief in the frame.
- Look: `[Hawaiian shirt: turquoise / rayon] [cargo shorts] [glasses: thick] [hair: long, ponytail] [beard]`
- Personality: tactless enthusiast with a heart somewhere under the shirt.
- Voice: nerd patter; sound effects.
- Sample dialogue:
  - "So the bow goes down, the stern goes up — very dramatic — and then *krrrk*, she's two ships. Cool, right? ...Sorry."
  - "Ma'am, you're saying you were *on* it? With *the* necklace? Okay. Okay. Brick's going to have a day."

**OLD ROSAMUND CULVERT** *(the old heiress)*
- Role: Rosie at 100. Potter, Pomeranian owner, teller of the tale. Playable in the epilogue only.
- Look: `[cardigan: rose / knit] [blouse: cream] [slacks: grey] [hair: white, pinned] [spectacles]` Props: goldfish bowl, a hatbox of photographs, a small Pomeranian ("Freckles").
- Personality: mischievous, unsentimental about herself, sentimental about one night.
- Voice: slow, dry, lets silences do the work.
- Sample dialogue:
  - "A woman keeps her secrets, Mr. Lootwell. She also keeps her sapphires. Usually in a coat pocket."
  - "I was seventeen and certain I was finished. I was wrong on both counts eventually."

**LIZZIE CULVERT** *(her granddaughter)*
- Role: Protective, bemused chaperone.
- Look: `[sweater: oatmeal / cotton] [jeans] [hair: brown, bob]`
- Voice: exasperated affection.
- Sample dialogue:
  - "Nana, you can't just fly to the middle of the Atlantic because a man on television found a drawing."
  - "She's fine. She's always fine. It's the rest of us who aren't."

---

## 2. Story Structure

### 2.0 Systems that frame the story

- **The Ship's Clock.** A brass bulkhead clock in the pause menu (and physical clocks at the Grand Staircase, the bridge, and the Third Class General Room). Interacting lets the player **Advance the Watch** to the next story beat's time. The clock never advances on its own *except* in Watch IV, where it runs in real time (1:1) from 23:40 to 02:20 — 160 minutes — unless the player uses the clock to skip ahead between beats. A warning is shown before entering Watch IV: "From here, the ship keeps her own time."
- **The Ship's Log.** Objectives UI styled as a leather logbook. Main beats are entered in copperplate; side quests in pencil; discoveries as pasted-in plaques.
- **Free roam between beats.** Every beat ends with the log line *"The watch is yours."* All decks open to the player's current class privilege (see Reputation, §4). Story NPCs idle at their listed locations for the current Watch.
- **Playable character.** Jack in Prologue-adjacent and Watches I–III; alternates Jack/Rosie in Watch IV (hand-offs are marked). Old Rosamund in the Epilogue.
- **Historical cheat, declared once:** Dolly Beige and the Stouthearts board at Southampton (not Cherbourg) so the quay is populated. Plaque at Cherbourg mention admits it.

### 2.1 Prologue — "Thirteen Thousand Feet" (1996, optional)

Skippable from the main menu; recommended first time. ~15 minutes.
1. **Dive.** *Trigger:* new game. *Location:* submersible cockpit, then the real wreck's bow section: forecastle, the fallen foremast, the Grand Staircase well (now a shaft), B Deck suite windows. *Objective:* "Pilot *Mirth-1* to the forward First Class suites." Simple ROV steering tutorial through the D Deck Reception Room. *Failure:* none; collision just resets. *Reward:* Photo mode unlocked (wreck palette).
2. **The Safe.** *Trigger:* reach the marker at B-51. *Objective:* "Recover the safe." Cutscene: safe opened on deck; mud; the charcoal **finished sketch** of a young woman wearing the sapphire (§5). Lew's tabletop "how she sank" demo, played for laughs and cut short.
3. **The Call.** Old Rosamund phones. "I'm the woman in the drawing." Helicopter arrives. She begins. Fade to Southampton.
- *Reward:* Lew's sinking diagram becomes a Ship's Log reference page.

### 2.2 Watch I — "Southampton & Sailing Day" (Wednesday 10 April 1912)

**Beat I.1 — A Pair of Threes.** *Trigger:* auto, 11:30. *Location:* Southampton Ocean Dock, Berth 44, a pub table ("The Grapes" is real; we use a parody sign "The Sour Grapes"). *Objective:* "Win a hand against the Swedes." Mini-game: five-card draw with fixed friendly odds; cannot lose on first attempt (loss triggers a comic re-deal). *Reward:* two steerage tickets, Fio joins. Sprint to the gangway (timed, generous; failure = comic "held for health inspection", retry).

**Beat I.2 — The Finest Suite Aboard.** *Trigger:* reach forward well deck. Cut to Rosie's arrival by motorcar; player briefly controls Rosie walking from the quay up the First Class gangway to B Deck, suite B-51/53/55 (starboard, with private promenade). *Objective:* "Hang the paintings Cal thinks are a waste of money." Three canvases placed anywhere in the sitting room (physics-light). Introduces Prudence, Cal, Killjoy. *Reward:* Rosie's "Modern Art" collectible page.

**Beat I.3 — Noon Departure.** *Trigger:* Advance the Watch to 12:00. *Location:* forward well deck (Jack) → forecastle rail. *Objective:* "Find a spot at the rail." Jack and Fio at the bow as tugs pull her off. Scripted: near-collision with SS *New York* as Titanic's suction snaps her moorings (real event, plaque). *Reward:* Discovery "Berth 44" plaque; first postcard.
*Free roam:* all of Third Class spaces, well decks, poop deck. First Class is "Restricted — a steward will escort you out" (soft fail: teleport to nearest gate, no penalty, +1 to Steward Promptly's gossip meter).

**Beat I.4 — Top of the Ship.** *Trigger:* reach the forecastle eyes at the very bow. *Objective:* "Say something you'll regret." Jack shouts (original line: "Top of the ship, Fio! Next stop: the whole world!"). Dolphins run the bow. *Reward:* photo mode "Bow" preset. **Watch I ends: "The watch is yours."**

### 2.3 Watch II — "The Crossing" (Thursday 11 – Saturday 13 April)

**Beat II.1 — Cherbourg & Queenstown (mentions).** *Trigger:* Advance the Watch. Marconi Room board shows "CHERBOURG 10 APR — 274 embarked" and "QUEENSTOWN 11 APR — 123 embarked; 7 disembarked; 1,385 sacks of mail". Tommy introduces himself at the poop deck rail, 13:30 Thursday, as Ireland slides away. *Objective:* "Watch the last of Ireland go." *Reward:* postcard "Queenstown".

**Beat II.2 — The Stern Rescue.** *Trigger:* Advance the Watch to Thursday 23:30 (clock reads "Late"). *Location:* Jack smoking on a bench on the aft Boat Deck → poop deck, stern rail beside the docking bridge, starboard side. Rosie runs past, climbs over the rail, hangs above the propellers' wash. *Objective:* "Talk her back over the rail." Dialogue tree, 4 nodes, 2–3 choices each (§4). Wrong choices lose time (not life): the cold makes her slip, Jack catches her — QTE grab — she is pulled over, both fall to the deck; Master-at-Arms and Killjoy arrive. Cal arrives, suspicious → Rosie's cover story → Cal invites Jack to dinner Saturday. *Failure:* none hard; the slip is scripted. *Reward:* "Invitation to Dine — Saturday"; Reputation 1st +1 (Rosie), 3rd +0.

**Beat II.3 — The Promenade.** *Trigger:* Advance to Friday 11:00. *Location:* A Deck promenade, starboard, forward of the Gymnasium windows (where the enclosed section begins). Rosie finds Jack (escorted by Steward Promptly, who "didn't see him"). They walk aft; she looks at his portfolio. *Objective:* "Walk the length of A Deck with Rosie." Passenger NPCs stare; Prudence sighting is a soft "hide behind a deck chair" stealth gag. *Reward:* Rosie reputation +; the portfolio collectible (viewable: finished sketches of Parisian subjects, PG; see §5).

**Beat II.4 — The Spitting Lesson.** *Trigger:* reach the aft end of the A Deck promenade, Friday afternoon. *Location:* aft A Deck rail, starboard, near the Verandah Café. Jack teaches Rosie to spit "like a man" (comic mini-game: arc and wind). Prudence, Dolly and the Stouthearts round the corner mid-spit. *Objective:* "Hit the sea. Not the deck below." *Failure:* hitting a Second Class passenger on the B Deck promenade below = Reputation 1st −1 and a stern NPC bark. *Reward:* Dolly befriends Jack; "Borrowed Dinner Jacket" quest flag.

**Beat II.5 — The Dinner.** *Trigger:* Advance to Saturday 18:00 (dressing). Dolly's cabin B-4: Jack in her late son's evening suit. *Location:* Grand Staircase A Deck landing (meeting under the clock "Honour and Glory Crowning Time"), descend to D Deck Reception Room, into the First Class Dining Saloon, Cal's table (midships, starboard). *Objective:* "Survive seven courses." Etiquette mini-game: pick the right fork from Dolly's whispered hints; three dialogue duels with Cal and Prudence ("Where do you live?"). *Failure:* using the wrong fork thrice = comic flinch from a waiter, no hard fail. *Reward:* Reputation 1st +2 if ≥2 duels won; the "Saturday Dinner" White Star menu card; **the secret note** passed to Rosie as the men withdraw to the Smoking Room: "Make the clock. Bring shoes you can dance in."

**Beat II.6 — The Steerage Party.** *Trigger:* Rosie reaches the Grand Staircase clock at 21:00 (talk to Jack). *Location:* down the aft Second Class stairs to C Deck, aft, the Third Class General Room beneath the poop deck (pine panelling, piano, benches). Tommy on tin whistle, a fiddler, Fio dancing with Nora. *Objective:* "Dance with Nora. Then dance with Rosie. Then arm-wrestle Tommy." Rhythm mini-game (three difficulty tiers, no fail). Rosie drinks a pint, stands on tiptoe en pointe — crowd cheers. Killjoy watches from the stairwell. *Reward:* Reputation 3rd +3 (Rosie); "Steerage" postcard; **Watch II ends.** Scripted morning after: Cal's cold breakfast confrontation on the private promenade (he overturns the table — no violence to Rosie; §5), then Prudence lacing Rosie's corset in the bedroom while explaining the debts (fully clothed from the player's angle; see §5).

### 2.4 Watch III — "Sunday 14 April 1912"

**Beat III.1 — Sunday Service.** *Trigger:* Advance to 10:30. *Location:* First Class Dining Saloon (Divine Service, led by the Captain) — Jack tries to enter via the D Deck Reception Room, borrowed coat and all; Killjoy and Steward turn him away. Father Bibles's Mass in the General Room runs in parallel for Third Class (player choice which to attend; Reputation hint). *Objective:* "Get a message to Rosie." Three routes: bribe/charm Promptly, swap coats with a Second Class man in the Library, or climb the aft Boat Deck and drop a note through the Gymnasium window. *Reward:* Rosie learns where to find Jack; Gymnasium discovery.

**Beat III.2 — The Bow at Sunset.** *Trigger:* Advance to 18:15 (clock reads "Sunset"). *Location:* Rosie walks forward along the Boat Deck, down to the forward well deck, up to the forecastle deck, to the bow where Jack waits. *Objective:* "Close your eyes. Step up. Open them." Scripted: she stands on the lowest rail, he holds her waist; the camera orbits; original dialogue ("Where are we?" / "Flying. Badly. Hold on."). The sky uses the real 14 April 1912 sunset azimuth. *Reward:* photo mode "Flight" preset; the first kiss (PG). Reputation 1st −1 (Prudence hears gossip).

**Beat III.3 — The Portrait.** *Trigger:* Advance to 20:30. *Location:* B-51 sitting room; Rosie brings the Heart of the Deep from Cal's safe. Rosie asks Jack to draw her wearing only the necklace — **the game cuts here** (§5): a slow fade on Jack sharpening his charcoal; fade up on the **finished sketch** in his hand, Rosie in a dressing gown, laughing. *Objective:* "Sign the sketch. Choose a date." (Player types/picks a dedication; it appears in the Prologue safe retroactively.) Rosie leaves a note for Cal in the safe with the sketch. *Reward:* the sketch collectible.

**Beat III.4 — The Chase.** *Trigger:* leave the suite; Killjoy at the B Deck corridor end, 21:00. *Location:* down the Grand Staircase to D Deck → the First Class lifts (Steward Promptly holds the gate) → E Deck "Scotland Road" (the long crew corridor, port side) → through a watertight door into **Boiler Room 6** (trimmers shout; the player dodges coal barrows) → the firemen's passage → forward ladder down to the **Orlop Deck, No. 2 Hold**, where a crated **Renault Type CB Coupé de Ville** sits among steamer trunks. *Objective:* "Lose him." Light chase with three gates to shut behind you; Killjoy is never fast enough to catch you (scripted) but "Caught" = replay from the lift. *Reward:* Discovery "The Renault".

**Beat III.5 — The Car.** *Trigger:* reach the Renault. *Location:* No. 2 Hold. Jack opens the rear door with a chauffeur's flourish; Rosie pulls him in. Dialogue: two choices, both end the same way. **Fade to black at the kiss.** Fade up: 23:35, the pair on the forward well deck in the frozen air, laughing, Rosie's coat buttoned wrong. Lookouts above. *Objective:* "Get some air." *Reward:* nothing listed; the log reads *"Nothing to report."* **Watch III ends. The player is told: "From here, the ship keeps her own time." Any unfinished side quests are flagged.**

### 2.5 Watch IV — "The Iceberg" (23:40 Sunday – 02:20 Monday, real time)

Time is shown on the HUD as the bridge clock. Beats trigger at their times whether or not the player is present; "Advance the Watch" is available only from the bulkhead clocks and skips to the next beat time (water level and list update instantly).

**IV.1 — 23:40 Three Bells.** *Trigger:* auto. *Location:* forward well deck. Fleetfoot's bell above; Hardaport's orders carry down from the bridge wing; the berg scrapes the starboard bow, ice tumbles onto the well deck (players can pick it up — "Souvenir: Ice"). *Objective:* "Get off the well deck." *Reward:* "Ice" collectible.

**IV.2 — 23:50–00:05 Inspection.** *Trigger:* Jack and Rosie reach A Deck. *Location:* follow Rivetts and the Captain from the bridge down the Grand Staircase to D Deck, along E Deck forward, to the Mail Room (G Deck forward) where clerks drag sacks up a flooding stair, then the squash court filling. *Objective:* "Overhear Mr. Rivetts." Scripted: "an hour, perhaps two." Captain: "Uncover the boats." *Reward:* Discovery "Post Office".

**IV.3 — 00:05 The Planted Jewel.** *Trigger:* return to B-51 to warn Prudence and Cal. *Location:* B-51 sitting room → corridor. Killjoy's sleight-of-hand puts the sapphire in Jack's borrowed coat pocket (shown in a cut-in). Cal calls Master-at-Arms Manacle. *Objective:* none for the player — this one is taken from you. Rosie's choice (3 options: protest / hesitate / go with Cal) sets Reputation but not outcome.

**IV.4 — 00:10 Arrest.** *Location:* Manacle marches Jack down to the Master-at-Arms office, E Deck forward starboard, and cuffs him to a pipe. Manacle leaves (key in pocket). Killjoy pockets the sapphire, taunts, leaves. **Player switches to Rosie.**

**IV.5 — 00:15–00:45 Rosie Comes Down.** *Trigger:* Rosie on the Boat Deck as Rivetts tells her the truth (original dialogue). Cal and Prudence try to put her in Boat 6. **Choice:** she refuses (scripted — the only option that advances; two other choices loop with new dialogue). *Objective:* "Find Jack. Find Mr. Rivetts first — he knows where everything is." Rivetts is in the A Deck foyer; he tells her the E Deck route. Descend: lifts have stopped (Promptly: "Lifts are off, miss. Stairs are free."). Water on E Deck forward is ankle-deep and rising. *Failure:* Rosie's cold meter (blue vignette); standing in water drains it; dry corridors restore it; emptied = "You faint. A steward carries you back to the stairs." (retry from the stairs). *Reward:* Discovery "Scotland Road".

**IV.6 — 00:45 The Axe.** *Location:* E Deck forward. The office door is locked; water is at Rosie's knees. A **fire axe** sits in a glass case on the bulkhead by the firemen's stairs (real fitting). *Objective:* "Break the glass. Mind your hands." Rosie's practice swing (a comic cabinet) → the real swing: a timing bar; perfect = clean break; poor = two swings and a nick to the pipe (Jack's original line: "I've seen you aim. Give it here." — she doesn't). Chains cut. *Reward:* Jack rejoins; player control returns to Jack with Rosie as follower.

**IV.7 — 00:50–01:15 Flooded Corridors & Gates.** *Location:* E Deck forward is lost; the pair go up a crew stair to find the way aft blocked. Route: E Deck → down a Third Class stair (water chasing) → a **locked Bostwick gate** at the foot of the Third Class forward stairs, steward beyond with a crowd (Fio and Tommy among them). *Choice (affects Reputation and an optional outcome):* (a) Tommy and Jack tear a bench from its bolts and ram the gate — the steward flees; (b) if Steward Promptly's gossip meter is maxed, Promptly is the steward and **unlocks it**, saying "I was never here"; (c) with Reputation 3rd ≥ 6, the crowd lifts Nora over the gate first (she survives for certain on this branch). *Objective:* "Get everyone up to the Boat Deck." *Failure:* cold meter as above; "Trapped" = retry from the stair head.

**IV.8 — 01:15–01:40 The Band and the Boats.** *Location:* Boat Deck. Heartstring's quartet plays outside the Grand Staircase entrance (ragtime, then a hymn as the forward deck dips). Lamplighter loads Boats 14 and 16 to port; Hardaport Boats 13 and 15 to starboard; Dismay hovers at Collapsible C. Cal finds them. *Objectives (any order, parallel):* "Find Mrs. Lullaby's children a boat" (she declines: her scripted bedtime story — see §5); "Help Mr. Gildenheim's valet with his cufflinks" (a quiet joke-free beat); "Get Rosie into a boat." Rosie steps into Collapsible D with Cal's assurance that Jack has "an arrangement"; **01:50**, as the boat lowers past A Deck, she jumps back to the open promenade and runs to the Grand Staircase to find Jack — reunion on the D Deck landing with water pouring through the dome's skylight. Cal fires once, wildly, into the stairwell chandelier (§5); they flee down. *Failure:* none here; it is a cutscene corridor.

**IV.9 — 01:50–02:05 Down and Up.** Chase through flooding D/E Deck First Class corridors (the dining saloon chairs afloat), a Bridget Lullaby door glimpsed (shut), up a crew ladder to the aft Boat Deck. Father Bibles's circle; Lamplighter on the roof of the officers' quarters freeing Collapsible B; Dismay stepping into C. *Objective:* "Get aft. Get high." Cold meter and a tilt meter (deck angle); handrails are climbable.

**IV.10 — 02:17–02:18 The Break-Up.** *Location:* poop deck, stern rail, Jack and Rosie on the outside of the rail (a callback to II.2 — the log notes it). Lights fail at 02:17; the hull groans; the ship breaks between the third and fourth funnels (real estimate); the stern settles, then rises vertical. *Objective:* "Hold on. On three, breathe out — in — and kick away." Scripted: the plunge, the cold shock (screen desaturates; muted audio), surfacing among debris.

**IV.11 — 02:20–03:30 The Door That Was Not a Door.** *Location:* debris field. Jack finds a floating carved oak **panel** (the game never calls it a door; plaque: "A piece of panelling from the Grand Staircase surround."). Rosie climbs on; Jack tries, it tips; he stays in the water holding her hands. *Dialogue:* three beats, two choices each; one branch lets the player try to climb on *beside* her — the panel tips the same way, with Rosie's line "Buoyancy, not area, Jack. Stay with me." (the game's single wink at the great debate). Fifth Officer's boat lights approach at 03:30 (Boat 14, Officer Lowe's historical return; here led by an unnamed officer). Jack is unresponsive. Rosie releases his hands (shown as a slow sink into dark water, no face shown; §5), swims to a dead body with a **whistle** (an officer's whistle around a frozen crewman's neck — handled with the camera on her, not him), blows until the boat turns. *Objective:* "Blow the whistle." Hold input; the longer, the more the screen brightens. **Watch IV ends.**

### 2.6 Epilogue — "Something to Return"

*Playable as Old Rosamund.* Carpathia montage as still frames (period style; "Rosamund Drawson" entered on the manifest). Cut to the *Mirth*'s afterdeck at night. Barefoot in a nightgown and cardigan, she walks to the stern rail (a deliberate rhyme with II.2 and IV.10), takes the Heart of the Deep from her cardigan pocket, holds it over the water. *Choice (the game's final choice, both valid):* **Drop it** (canonical; achievement "The Sea Keeps Her Secrets") or **Keep it one more night** (she puts it back in her pocket; the credits roll the same; achievement "A Woman's Heart is a Deep Ocean of Pockets"). Final image either way: her photographs on the nightstand — flying lessons, Santa Monica pier, a horse on the beach — then a dream-dissolve to the Grand Staircase, every character from §1 applauding, Jack at the clock. **Credits.**

---

## 3. Free-Roam Content Layer

### 3.1 Discoveries (each with a plaque of real history — 48 listed)

Plaques are brass, 2–3 sentences, factual, no film references. Discovery = enter the room's volume and read the plaque. Each grants a Ship's Log page and photo-mode spot.

| # | Discovery | Deck / Location | Plaque gist |
|---|---|---|---|
| 1 | Grand Staircase & clock | Boat–D Deck forward, under the glass dome | Oak, wrought iron, the clock panel "Honour and Glory Crowning Time"; five levels. |
| 2 | Gymnasium | Boat Deck starboard, by the Grand Staircase | Electric camel, electric horse, rowing machines; instructor T. W. McCawley. |
| 3 | Turkish Baths | F Deck starboard | Cooling room in Moorish tile; tickets 4 shillings; sexes at separate hours. |
| 4 | Swimming Bath | F Deck starboard | Heated seawater, 30 by 14 ft; one of the first pools at sea. |
| 5 | Squash Racquet Court | G Deck forward | Professional Fred Wright; spectator gallery on F Deck; 2 shillings a half hour. |
| 6 | Café Parisien | B Deck starboard aft | Trellis, wicker chairs, ivy; a first on a British liner. |
| 7 | À la Carte Restaurant | B Deck aft | Run by Luigi Gatti's concession; walnut panels; passengers paid extra. |
| 8 | Verandah Café & Palm Court | A Deck aft, both sides | Wicker and ivy; children's favourite; sliding windows to the promenade. |
| 9 | First Class Smoking Room | A Deck aft | Mahogany, stained glass, fireplace with the painting *Plymouth Harbour* by Norman Wilkinson. |
| 10 | Reading & Writing Room | A Deck forward, port | White Georgian; intended for ladies; bay window onto the promenade. |
| 11 | First Class Lounge | A Deck midships | Louis XV style after Versailles; bookcase and card tables. |
| 12 | First Class Dining Saloon | D Deck midships | Largest room afloat at 114 ft; 554 seats; Jacobean leaded windows. |
| 13 | Reception Room | D Deck forward of the saloon | Foot of the Grand Staircase; the orchestra played here after dinner. |
| 14 | Marconi Room | Boat Deck, officers' quarters, starboard | 5 kW set, call sign MGY; range about 400 miles by day. |
| 15 | Bridge & Wheelhouse | Boat Deck forward | Three engine telegraphs; the wheel in the enclosed wheelhouse. |
| 16 | Crow's Nest | Foremast, 50 ft above the forecastle | Reached by a ladder inside the mast; lookouts' binoculars were locked away and not aboard. |
| 17 | Forecastle & Anchors | Forecastle deck | Centre anchor 15½ tons, hauled through Belfast by 20 horses. |
| 18 | Boiler Room 6 | Tank top, forward | 29 boilers in six rooms; 159 furnaces; stokers worked four-hour shifts. |
| 19 | Reciprocating Engine Room | Tank top, aft of boilers | Two four-cylinder triple-expansion engines, 30,000 hp, four storeys high. |
| 20 | Turbine Engine Room | Tank top, aft | Parsons low-pressure turbine on exhaust steam; drove the centre screw; could not reverse. |
| 21 | Scotland Road | E Deck, port, full length | Crew's working corridor, named for the Liverpool street. |
| 22 | Third Class General Room | C Deck aft, under the poop | Pine panelling, teak benches, an upright piano. |
| 23 | Third Class Smoking Room | C Deck aft, port | Oak-panelled; adjoined the General Room. |
| 24 | Third Class Dining Saloon | F Deck midships | Two rooms seating 473; linen tablecloths; menus printed daily. |
| 25 | Second Class Library | C Deck aft | Sycamore panels; served as Second Class lounge; writing tables. |
| 26 | Second Class Dining Saloon | D Deck aft | Seated 394 at long tables; piano for hymns. |
| 27 | Second Class Smoking Room | B Deck aft | Oak; Second Class had its own promenade on the Boat Deck aft. |
| 28 | Barber Shop | C Deck forward, starboard | Haircut one shilling; sold souvenirs, pennants and dolls. |
| 29 | Post Office & Mail Room | G Deck forward (sorting), Orlop below | Five postal clerks; about 3,364 sacks of mail; they tried to carry registered mail up. |
| 30 | Kennels | F Deck | At least twelve dogs aboard; three small dogs survived in lifeboats. |
| 31 | Dummy Fourth Funnel | Boat Deck aft | Ventilation only; added for appearance and galley exhaust. |
| 32 | Poop Deck & Docking Bridge | Stern | Auxiliary bridge for docking; the last dry place aboard. |
| 33 | Captain's Quarters | Boat Deck starboard, behind the bridge | Sitting room, bedroom and a private bath. |
| 34 | No. 2 Hold — the Renault | Orlop Deck forward | A 1912 Renault Type CB Coupé de Ville shipped by a Philadelphia passenger; the only car aboard. |
| 35 | Parlour Suite B-51/53/55 | B Deck starboard | One of two suites with a private 50 ft promenade; the most expensive accommodation. |
| 36 | Cabin B-4 | B Deck forward, port | Example of a First Class stateroom; one of several period decorative styles. |
| 37 | Lifeboat Stations | Boat Deck | 14 wooden boats (65 each), 2 cutters (40), 4 collapsibles (47): 1,178 places for 2,208 aboard. |
| 38 | Cherub Lamp | Grand Staircase, D Deck newel | Bronze cherub lamp standard at the foot of the stair. |
| 39 | First Class Galley | D Deck midships | Served both First and Second Class saloons; 19-ft ranges. |
| 40 | Hospital | D Deck aft, starboard | Twelve beds and an isolation ward; two surgeons aboard. |
| 41 | Printing Office | C Deck | Printed daily menus and the *Atlantic Daily Bulletin*. |
| 42 | Firemen's Passage & Spiral Stairs | F–Tank top, forward | Private tunnel from stokers' quarters to the boiler rooms. |
| 43 | Chart Room | Boat Deck behind the wheelhouse | Ice warnings received 14 April were posted here; one went to Dismay's pocket. |
| 44 | Third Class Open Space | D Deck forward well deck | Steerage promenade; the only outdoor space forward for Third Class. |
| 45 | Officers' Mess & Cabins | Boat Deck | Eight officers; Lamplighter's cabin faced the funnel. |
| 46 | Linen Room | E Deck | Over 200,000 pieces of linen; towels alone numbered 40,000. |
| 47 | Refrigerated Stores | G Deck / Orlop aft | 75,000 lb fresh meat, 40,000 eggs, 1,500 gallons of milk for the crossing. |
| 48 | Musicians' Cabins | E Deck | Eight bandsmen, employed via a Liverpool agency; two ensembles, not one. |

### 3.2 Collectibles

- **White Star Menu Cards (15).** One per meal per class actually printed 10–14 April where documented (e.g. First Class dinner 14 April: oysters, consommé Olga, filet mignon Lili, Waldorf pudding). Found on tables, in pantries, pressed in library books. Reward at 15: "Eat Like 1912" cookbook page.
- **Postcards (12).** Period-style views: Belfast gantry, Southampton Berth 44, Cherbourg tender, Queenstown, the four funnels, the bow at sea, the Grand Staircase, Café Parisien, the Gymnasium, the Marconi Room, the poop deck, a night sky. Found at the Barber Shop (3 for purchase with pocket change) and on NPCs who will trade.
- **Passenger Tickets (20).** Parodic contract tickets (White Star layout) for the roster — "Hockstone, C., Pittsburgh, Parlour Suite" through "Fortunato, F., Steerage, G-62". Jack's own is the first. Pickpocket mini-game is **not** used; tickets are gifted, found or won.
- **Souvenir: Ice.** One-off, melts in inventory over 20 real minutes; achievement if photographed.

### 3.3 Photo Mode

Brass "Kodak Brownie" overlay; sepia, autochrome, and plate-glass filters; depth of field; time-of-day lock within the current Watch; NPC pose wheel (period poses only). Watch IV disables filters that read as glamour (no bokeh hearts). Presets: Bow, Flight, Staircase, Boat Deck Night.

### 3.4 Side Quests (12)

1. **The Bandleader's Case.** Heartstring's violin case went to the wrong cabin at Southampton. Trail: baggage master (F Deck) → Second Class Library → a child using it as a boat. Reward: a request slot — the band plays a tune of your choice at dinner; Reputation 1st +1.
2. **Freckles in the Kennels.** Dolly's Pomeranian has escaped the F Deck kennels. Follow paw prints through the galley to the Turkish Baths cooling room. Reward: Dolly's patronage (dinner jacket available early); a dog follower in free roam. In Watch IV Freckles is found already in Boat 6 (dogs did survive).
3. **A Marconigram for Mrs. Stoutheart.** Sparks is backlogged; Groom asks the player to run a received wire to B Deck. Three stops; the message is a birthday greeting from a granddaughter. Reward: the Stouthearts' story (Isidore's spectacles quest unlocks).
4. **A Hand Against Hockstone.** In the A Deck Smoking Room, Cal plays brag for stakes. Beat him twice in five hands (card mini-game with a cheating-detection twist: catch Killjoy signalling). Reward: Cal's cigarette case (sellable to the barber) and Reputation 1st −2 / 3rd +2 ("you took his money").
5. **The Missing Binoculars.** Fleetfoot wants the lookouts' glasses. They were locked in a cabin by an officer who left the ship at Southampton (history). Find the locker; it is empty; return the key. Reward: Discovery "Crow's Nest" and a sombre plaque.
6. **Hopscotch Rules.** Nora needs chalk and a judge. Three rounds on the forward well deck. Reward: Nora will warn Jack when Killjoy approaches in Watch III (a gameplay aid).
7. **Mr. Rivetts's Notebook.** He's left it in the Reading Room — or the Gymnasium — or the Turkish Baths. Return it; read three pages (facts about the ship). Reward: deck plans unlock the full map.
8. **The Atlantic Daily Bulletin.** Collect five wireless headlines from passengers for the ship's paper (Printing Office). Reward: Discovery "Printing Office"; a printed copy appears on every First Class breakfast table next Watch.
9. **Ice for the Café.** The Café Parisien needs ice for Dolly's lemonade; the cook sends you to the refrigerated stores aft. Reward: "Refrigerated Stores" discovery; a lemonade (restores cold meter in Watch IV, one use).
10. **Fio's Lucky Coin.** Fio lost his mother's coin at the poop deck rail. Lean over: it's wedged in the scupper. Reward: Fio's biscotti (cold-meter item) and a Reputation 3rd +1.
11. **A Letter Posted.** Bridget needs a letter to Boston posted before Queenstown. Run it to G Deck. Reward: she teaches the player one verse of a lullaby (unlocks an extra line in IV.8).
12. **Fifteen-All.** Play Fred Wright at squash (G Deck) — a simple timing game. Reward: Discovery "Squash Court"; Fred's line "I'm booked for 07:30 Monday, sir. Don't be late." (He never was late; the court flooded first.)

### 3.5 Easter Eggs (all parodic, none verbatim)

- A Second Class passenger practising a speech at the rail: "I'm the... duke of this deck! No. Lord of the lifeboats? No..." and giving up.
- The "panel" from IV.11 appears in the Third Class General Room in Watch II, being used as a table. Interacting: "Sturdy. Could hold two if you balanced it right. Probably."
- Lew's sinking diagram is pinned in the Chart Room with a note from Rivetts: "Broadly correct. Stern angle exaggerated."
- A passenger asks Rosie to "draw her like one of your Philadelphia girls"; Rosie: "I don't draw. I'm drawn. Frankly, it's exhausting."
- Dolly's cabin has a goldfish bowl.
- In the Epilogue, a hatbox photo shows Old Rosamund astride a horse on a beach — ridden sidesaddle, with a note on the back: "Nobody said how."
- Hidden in the Gymnasium is an "electric camel" the player can ride; the score card reads "Unsinkable".
- Steward Promptly, asked about the lifts: "Going up? They always say that. Nobody ever asks about down."

---

## 4. Dialogue System Specification

- **Shape.** Branching nodes with **2–3 choices**; every choice is a complete sentence of ≤ 80 characters shown on a brass plate. NPC lines ≤ **140 characters** including punctuation; one speaker per bubble; max three consecutive bubbles before a choice or exit. Long speeches (Rivetts's verdict, Rosamund's reminiscence) are split and paced by player input.
- **Choice grammar.** Each node offers at most one of each: **Heart** (sincere), **Wit** (deflecting), **Spine** (confrontational). Not every node has all three. Icons: a sapphire heart, a quill, an anchor.
- **Tone.** Writers follow each character's Voice line in §1. Period idiom without pastiche; no anachronistic slang (banned list: "okay" before 1996 frame, "awesome", "literally", "guys" for mixed groups). Modern frame characters may use modern slang.
- **Reputation.** Two meters, **First Class** and **Third Class**, each −10..+10, shown as the player's standing in the Ship's Log as a purser's note.
  - Heart choices with steerage: 3rd +1. Wit at a swell's expense: 1st −1, 3rd +1. Spine at Cal: 1st −1 (public) or 0 (private). Etiquette successes: 1st +1. Side quests as listed.
  - **Effects:** 1st ≥ 4 opens the A Deck Smoking Room and Café Parisien to Jack without escort; ≥ 7 lets Promptly fetch the dinner jacket for free. 3rd ≥ 4 unlocks the Third Class Smoking Room's card table and the tin-whistle lesson; ≥ 6 enables the Nora-over-the-gate branch (IV.7c). 1st ≤ −5: Killjoy follows Jack in Watch II free roam (a stealth nuisance, not a fail). 3rd ≤ −3: the party in II.6 is cooler (fewer dancers; Tommy needles you).
  - Reputation never gates the main story. It flavours outcomes and three optional survivals (Nora, Freckles's position, Promptly at the gate).
- **Fail-safes.** Every conversation has an exit line ("I'll think on it.") that costs nothing. Repeating a conversation after exit shows abridged text.
- **Localization.** Puns in names are preserved in English; translators receive a glossary of the pun targets and may re-pun (e.g. Dismay/Rivetts/Groom are flagged as "re-pun permitted").

---

## 5. Content Rating Notes (PG-13)

- **Nudity: none.** The portrait sitting is never shown. III.3 fades on charcoal sharpening and fades up on the **finished sketch** (shoulders and the necklace; a tasteful crop at the collarbone, charcoal, not photoreal) with Rosie in a dressing gown. Jack's portfolio contains only clothed Parisian subjects and hands. The corset scene is framed from behind Prudence with Rosie fully covered. Rosie's "en pointe" in II.6 is in a day dress and stockings.
- **Sexual content:** one kiss at the bow, one in the car, then **fade to black**; the fogged-glass handprint is replaced by Rosie's buttons being done up wrong on the well deck. No dialogue references the act.
- **Violence:** Cal's one shot is at a chandelier; Hardaport's revolver is thrown into the sea unfired; Killjoy's is never drawn. No blood, no corpse close-ups. The frozen crewman in IV.11 is seen only as a lifebelt and a hand; the camera stays on Rosie's face. Jack's death is a slow sink out of frame; no face, no eyes.
- **Deaths of real-analogue characters** (Captain, Rivetts, Heartstring, Gildenheim, the Stouthearts, Bibles, Bridget and her children, Fio, Tommy) are **implied by final tableau**, never shown. Each gets a quiet beat and the log records "Last seen: …". The Epilogue's applause dream is the game's only "afterlife" image.
- **Cold/drowning mechanics** use vignette and audio dulling, never gasping close-ups. The "faint" fail state has a steward carrying the player back; the "trapped" fail state cuts to black and reloads.
- **Language:** no profanity stronger than "damn" (used by Tommy, Dolly, Hardaport). No slurs; the class snobbery is written as snobbery, not bigotry.
- **Alcohol/tobacco:** period-accurate; the player can hold a pint at the party and Jack can smoke in cutscenes; neither is a mechanic.
- **Humour in Watch IV** is limited to Lamplighter's one line of geometry, Promptly's "Purely," and the panel joke, all of which are spent by 02:00. Nothing after the lights fail is played for laughs.
- **Historical dignity:** plaques never editorialise. Real victims are not named in game text; the roster's parodic names stand in for them, and the credits carry a single card: "In memory of the 1,496."

---

### Appendix A — Beat Timing Table (Watch IV, real time)

| Clock | Beat | Water | List |
|---|---|---|---|
| 23:40 | IV.1 Three Bells | Forepeak, holds 1–3, BR 6 | 0° |
| 00:05 | IV.2–3 Inspection / Jewel | Mail room, squash court | 2° |
| 00:15 | IV.5 Rosie descends | E Deck forward ankle-deep | 3° |
| 00:45 | IV.6 The Axe; Boat 7 away | E Deck forward knee-deep | 5° |
| 01:15 | IV.8 Band; Boat 13/14/15/16 | D Deck forward | 8° |
| 01:50 | IV.8 Rosie jumps back | Grand Staircase D Deck | 12° |
| 02:05 | IV.9 Collapsible D away | A Deck forward | 18° |
| 02:17 | IV.10 Lights fail | Bridge under | 30°→vertical |
| 02:20 | IV.11 Gone | — | — |

### Appendix B — Name Key (internal only; never shipped)

Drawson/Bouquet = the lovers · Hockstone = fiancé · Prudence = mother · Killjoy = valet · Fortunato = Italian friend · Brannigan = Irish friend · Beige = Denver lady · Smythe-Steadfast = captain · Rivetts = builder · Dismay = chairman · Hardaport = 1st officer · Lamplighter = 2nd officer · Heartstring = bandleader · Fleetfoot/Leeward = lookouts · Sparks/Groom = wireless · Lootwell/Bodkin = 1996 team · Culvert = old heiress & granddaughter · Cartwheel = little girl · Stoutheart = elderly couple · Gildenheim = millionaire · Lullaby = mother of two · Bibles = priest · Manacle = Master-at-Arms · Promptly = steward · Spoke = quartermaster.
