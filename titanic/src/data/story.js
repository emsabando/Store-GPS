/**
 * Narrative data (ARCHITECTURE.md §2) from design/STORY_AND_CHARACTERS.md. Four watches aboard, an epilogue.
 * LOCATIONS = ship landmarks + story-specific spots. All text is original; names are parodic.
 */
import { SHIP } from './shipSpec.js';
import { CHARACTERS, NAMED_NPC_IDS } from './characters.js';

const FT = 0.3048;
const x = (ft) => +(129.54 - ft * FT).toFixed(2);
const deckY = (id) => (SHIP.decks.find((d) => d.id === id) || { y: 0 }).y;

export const LOCATIONS = {
  ...Object.fromEntries(Object.entries(SHIP.landmarks).map(([id, l]) => [id, { ...l, id }])),
  a_deck_aft_rail_stbd: { id: 'a_deck_aft_rail_stbd', name: 'A-deck aft rail, starboard', deck: 'A', x: x(640), y: deckY('A'), z: 11.8, yaw: -Math.PI / 2 },
  boat_deck_bench_aft: { id: 'boat_deck_bench_aft', name: 'Aft boat deck bench', deck: 'boat', x: x(660), y: deckY('boat'), z: -6.0, yaw: Math.PI },
  lifeboat_6_station: { id: 'lifeboat_6_station', name: 'Lifeboat 6 station (port)', deck: 'boat', x: x(309), y: deckY('boat'), z: -11.5, yaw: -Math.PI / 2 },
  collapsible_D_station: { id: 'collapsible_D_station', name: 'Collapsible D station (port, by the bridge)', deck: 'boat', x: x(240), y: deckY('boat'), z: -11.5, yaw: -Math.PI / 2 },
  well_deck_fwd_hatch: { id: 'well_deck_fwd_hatch', name: 'Forward well deck, by No. 2 hatch', deck: 'C', x: x(140), y: deckY('C'), z: 4.0, yaw: 0 },
  boat_deck_entrance_fwd: { id: 'boat_deck_entrance_fwd', name: 'Boat deck, outside the first-class entrance', deck: 'boat', x: x(322), y: deckY('boat'), z: -9.5, yaw: Math.PI / 2 },
  debris_field: { id: 'debris_field', name: 'The debris field', deck: 'world', x: -60, y: 0.3, z: 40, yaw: Math.PI },
};

const spawnAll = (watch) => NAMED_NPC_IDS.filter((id) => CHARACTERS[id].locations && CHARACTERS[id].locations[watch]).map((id) => ({ type: 'spawn', npcId: id, locationId: CHARACTERS[id].locations[watch] }));
const log = (text) => ({ type: 'notify', text, kind: 'log' });
const B = (id, title, objective, locationId, trigger, extra = {}) => ({ id, title, objective, locationId, trigger, onStart: [], onComplete: [], dialogueId: null, next: null, ...extra });

export const STORY = {
  title: 'A Night to Remember Forever',
  watches: [
    {
      id: 'watch1', title: 'Watch I — Southampton & Sailing Day', date: '1912-04-10', startTime: '11:30',
      beats: [
        B('w1_tickets', 'A Pair of Threes', 'Find Fio on the forward well deck. You have just won two steerage tickets.', 'well_deck_fwd',
          { type: 'talk', npcId: 'fio' }, { dialogueId: 'fio_boarding', onStart: [...spawnAll('watch1'), log('Berth 44, Southampton. A pair of threes and a sprint up the gangway.')], onComplete: [{ type: 'discover', id: 'berth_44' }, { type: 'give', item: 'steerage_ticket' }] }),
        B('w1_suite', 'The Finest Suite Aboard', 'Find your way up to B deck. The DeWitt-Bouquet party is settling into the starboard parlour suite.', 'parlour_suite_B51_sitting_room',
          { type: 'reach', locationId: 'parlour_suite_B51_sitting_room', radius: 4 }, { dialogueId: 'cal_suite', onComplete: [{ type: 'give', item: 'modern_art_page' }] }),
        B('w1_departure', 'Noon Departure', 'Wind the watch to noon and find a spot at the forecastle rail.', 'forecastle',
          { type: 'time', at: '12:00' }, { onComplete: [log('Tugs pull her off the quay. Her wash snaps another liner from its moorings; she stops just short of it.'), { type: 'discover', id: 'the_near_miss' }, { type: 'give', item: 'postcard_southampton' }, { type: 'sound', id: 'horn' }] }),
        B('w1_bow', 'Top of the Ship', 'Get to the very point of the bow with Fio.', 'bow_tip',
          { type: 'reach', locationId: 'bow_tip', radius: 3.5 }, { dialogueId: 'fio_bow', onComplete: [{ type: 'discover', id: 'the_stem' }, log('The watch is yours.')] }),
      ],
    },
    {
      id: 'watch2', title: 'Watch II — The Crossing', date: '1912-04-11', startTime: '13:30',
      beats: [
        B('w2_ireland', 'The Last of Ireland', 'Tommy is at the stern rail as Ireland slides away. Go and meet him.', 'stern_rail',
          { type: 'talk', npcId: 'tommy' }, { dialogueId: 'tommy_ireland', onStart: [...spawnAll('watch2')], onComplete: [{ type: 'give', item: 'postcard_queenstown' }] }),
        B('w2_late', 'Late', 'Wind the watch to half past eleven. You cannot sleep; take a bench on the aft boat deck.', 'boat_deck_bench_aft',
          { type: 'time', at: '23:30' }, { onComplete: [{ type: 'moveNpc', npcId: 'rosie', locationId: 'stern_rail' }, { type: 'setFlag', flag: 'rosie_at_stern' }] }),
        B('w2_stern', 'The Stern Rail', 'Someone has run past you toward the stern. Follow.', 'stern_rail',
          { type: 'reach', locationId: 'stern_rail', radius: 5 }, { dialogueId: 'stern_rescue', onComplete: [{ type: 'reputation', faction: 'first', delta: 1 }, { type: 'give', item: 'dinner_invitation' }, { type: 'moveNpc', npcId: 'cal', locationId: 'stern_rail' }, { type: 'moveNpc', npcId: 'killjoy', locationId: 'docking_bridge' }] }),
        B('w2_promenade', 'The Promenade', 'Friday, eleven. Rosie is looking for you on the starboard A-deck promenade.', 'promenade_A_stbd',
          { type: 'time', at: '11:00', dayOffset: 0 }, { onStart: [{ type: 'setTime', time: '11:00', date: '1912-04-12' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'promenade_A_stbd' }], onComplete: [] }),
        B('w2_walk', 'A Walk the Length of A Deck', 'Walk aft along the promenade with Rosie and show her the portfolio.', 'a_deck_aft_rail_stbd',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'promenade_walk', onComplete: [{ type: 'give', item: 'portfolio' }, { type: 'reputation', faction: 'first', delta: 1 }] }),
        B('w2_spit', 'The Spitting Lesson', 'At the aft rail: hit the sea, not the deck below. Then face the consequences.', 'a_deck_aft_rail_stbd',
          { type: 'reach', locationId: 'a_deck_aft_rail_stbd', radius: 4 }, { dialogueId: 'spitting_lesson', onComplete: [{ type: 'moveNpc', npcId: 'dolly', locationId: 'a_deck_aft_rail_stbd' }, { type: 'setFlag', flag: 'dinner_jacket' }] }),
        B('w2_clock', 'Under the Clock', 'Saturday evening. In a borrowed dinner jacket, wait for Rosie at the clock on the A-deck landing.', 'grand_staircase_A',
          { type: 'time', at: '18:50' }, { onStart: [{ type: 'setTime', time: '18:00', date: '1912-04-13' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'forward_clock_landing' }, { type: 'moveNpc', npcId: 'cal', locationId: 'dining_saloon_head_table' }, { type: 'moveNpc', npcId: 'prudence', locationId: 'dining_saloon_head_table' }, { type: 'moveNpc', npcId: 'dolly', locationId: 'dining_saloon_head_table' }], onComplete: [] }),
        B('w2_descend', 'Descend to Dinner', 'Meet Rosie at the clock and go down to the Dining Saloon together.', 'forward_clock_landing',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'dinner_descent' }),
        B('w2_dinner', 'Seven Courses', "Survive dinner at the captain's table. Start from the outside and work in.", 'dining_saloon_head_table',
          { type: 'reach', locationId: 'dining_saloon_head_table', radius: 4 }, { dialogueId: 'dinner_duel', onComplete: [{ type: 'give', item: 'menu_card_saturday' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'grand_staircase_A' }] }),
        B('w2_note', 'Make the Clock', 'Pass Rosie the note as the men withdraw, then get down to the General Room before nine.', 'steerage_dance_floor',
          { type: 'time', at: '21:00' }, { onStart: [{ type: 'moveNpc', npcId: 'fio', locationId: 'steerage_dance_floor' }, { type: 'moveNpc', npcId: 'tommy', locationId: 'steerage_dance_floor' }, { type: 'moveNpc', npcId: 'nora', locationId: 'steerage_dance_floor' }], onComplete: [{ type: 'moveNpc', npcId: 'rosie', locationId: 'steerage_dance_floor' }, { type: 'moveNpc', npcId: 'killjoy', locationId: 'room_entrance_3rd_aft' }] }),
        B('w2_party', 'The Real Party', 'Dance with Nora. Then dance with Rosie. Then arm-wrestle Tommy.', 'steerage_dance_floor',
          { type: 'reach', locationId: 'steerage_dance_floor', radius: 5 }, { dialogueId: 'steerage_party', onComplete: [{ type: 'reputation', faction: 'third', delta: 3 }, { type: 'give', item: 'postcard_steerage' }, log('The watch is yours.')] }),
      ],
    },
    {
      id: 'watch3', title: 'Watch III — Sunday 14 April 1912', date: '1912-04-14', startTime: '10:30',
      beats: [
        B('w3_service', 'Sunday Service', 'Get a message to Rosie. The stewards will not let a borrowed coat into Divine Service.', 'room_reception_room',
          { type: 'reach', locationId: 'room_reception_room', radius: 6 }, { dialogueId: 'turned_away', onStart: [...spawnAll('watch3')], onComplete: [{ type: 'discover', id: 'the_gymnasium' }] }),
        B('w3_sunset', 'The Bow at Sunset', 'Wind the watch to a quarter past six and wait for Rosie at the bow.', 'bow_tip',
          { type: 'time', at: '18:15' }, { onComplete: [{ type: 'moveNpc', npcId: 'rosie', locationId: 'bow_tip' }] }),
        B('w3_flying', 'Close Your Eyes. Step Up.', 'Rosie is at the bow.', 'bow_tip',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'flying', onComplete: [{ type: 'reputation', faction: 'first', delta: -1 }, { type: 'moveNpc', npcId: 'rosie', locationId: 'parlour_suite_B51_sitting_room' }] }),
        B('w3_portrait', 'The Portrait', 'Half past eight. Rosie has gone to the suite. The jewel is out of the safe.', 'parlour_suite_B51_sitting_room',
          { type: 'time', at: '20:30' }, { onComplete: [] }),
        B('w3_sketch', 'Sign the Sketch', 'Draw her. Sign it. Choose a date.', 'parlour_suite_B51_sitting_room',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'the_portrait', onComplete: [{ type: 'give', item: 'the_sketch' }, { type: 'moveNpc', npcId: 'killjoy', locationId: 'cor_B_mid_stbd_post' }] }),
        B('w3_chase', 'Lose Him', "Killjoy is at the corridor's end. Down the Grand Staircase, through Scotland Road, the boilers, the holds. Lose him.", 'renault_car',
          { type: 'reach', locationId: 'renault_car', radius: 4 }, { onStart: [{ type: 'setTime', time: '21:00' }, log('Three gates between you and the hold. Shut them behind you.')], dialogueId: 'the_car', onComplete: [{ type: 'discover', id: 'the_renault' }, { type: 'fade', seconds: 2 }, { type: 'setTime', time: '23:35', immediate: true }, { type: 'teleport', locationId: 'well_deck_fwd_hatch' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'well_deck_fwd_hatch' }, log('Nothing to report.'), log('From here, the ship keeps her own time.')] }),
      ],
    },
    {
      id: 'watch4', title: 'Watch IV — The Iceberg', date: '1912-04-14', startTime: '23:35',
      beats: [
        B('w4_bells', 'Three Bells', 'Get some air on the forward well deck.', 'well_deck_fwd_hatch',
          { type: 'time', at: '23:40' }, { onStart: [...spawnAll('watch4'), { type: 'moveNpc', npcId: 'rosie', locationId: 'well_deck_fwd_hatch' }], onComplete: [{ type: 'startSinking' }, { type: 'shake', intensity: 0.8, seconds: 6 }, log('Ice tumbles onto the well deck.'), { type: 'give', item: 'souvenir_ice' }] }),
        B('w4_inspection', 'Overhear Mr. Rivetts', 'Follow the designer and the captain down to the mail room on G deck.', 'mail_room',
          { type: 'reach', locationId: 'mail_room', radius: 6 }, { onStart: [{ type: 'moveNpc', npcId: 'rivetts', locationId: 'mail_room' }, { type: 'moveNpc', npcId: 'captain', locationId: 'mail_room' }], dialogueId: 'rivetts_verdict', onComplete: [{ type: 'discover', id: 'post_office' }, { type: 'moveNpc', npcId: 'rivetts', locationId: 'grand_staircase_A' }, { type: 'moveNpc', npcId: 'captain', locationId: 'bridge' }] }),
        B('w4_planted', 'Warn Them', 'Go back up to the suite and tell Cal and Prudence the ship will founder.', 'parlour_suite_B51_sitting_room',
          { type: 'reach', locationId: 'parlour_suite_B51_sitting_room', radius: 4 }, { onStart: [{ type: 'moveNpc', npcId: 'cal', locationId: 'parlour_suite_B51_sitting_room' }, { type: 'moveNpc', npcId: 'killjoy', locationId: 'parlour_suite_B51_sitting_room' }, { type: 'moveNpc', npcId: 'manacle', locationId: 'parlour_suite_B51_sitting_room' }], dialogueId: 'planted_jewel', onComplete: [{ type: 'setFlag', flag: 'arrested' }, { type: 'fade', seconds: 1.5 }, { type: 'teleport', locationId: 'master_at_arms_desk' }, { type: 'moveNpc', npcId: 'manacle', locationId: 'master_at_arms_desk' }, { type: 'moveNpc', npcId: 'killjoy', locationId: 'master_at_arms_desk' }] }),
        B('w4_cuffed', 'Handcuffed', 'Manacle has cuffed you to a pipe and taken the key. Killjoy has the sapphire. Rosie will have to come down.', 'master_at_arms_desk',
          { type: 'talk', npcId: 'killjoy' }, { dialogueId: 'arrest', onComplete: [{ type: 'moveNpc', npcId: 'killjoy', locationId: 'boat_deck_stbd_aft' }, { type: 'moveNpc', npcId: 'manacle', locationId: 'boat_deck_port_fwd' }, { type: 'setPlayer', characterId: 'rosie' }, { type: 'teleport', locationId: 'boat_deck_port_fwd' }, { type: 'moveNpc', npcId: 'rivetts', locationId: 'boat_deck_entrance_fwd' }, log('You are Rosie now.')] }),
        B('w4_refuse', 'Not in the Boat', 'Mr. Rivetts has told you the truth. Cal and Mother want you in Boat 6. Find Jack instead.', 'boat_deck_entrance_fwd',
          { type: 'talk', npcId: 'rivetts' }, { dialogueId: 'boat_refusal', onComplete: [log('Lifts are off, miss. Stairs are free.'), { type: 'setFlag', flag: 'rosie_descends' }] }),
        B('w4_axe', 'The Axe', 'E deck forward. The office is locked and the water is at your knees. There is a fire axe in a glass case by the stairs.', 'master_at_arms_desk',
          { type: 'item', item: 'fire_axe' }, { onComplete: [log('Mind your hands.')] }),
        B('w4_cut', 'Mind Your Hands', 'Break the chain. Second swing if you must.', 'master_at_arms_desk',
          { type: 'reach', locationId: 'master_at_arms_desk', radius: 3 }, { dialogueId: 'axe_rescue', onComplete: [{ type: 'setPlayer', characterId: 'jack' }, { type: 'take', item: 'fire_axe' }, { type: 'discover', id: 'scotland_road' }, { type: 'moveNpc', npcId: 'fio', locationId: 'third_class_open_space' }, { type: 'moveNpc', npcId: 'tommy', locationId: 'third_class_open_space' }, { type: 'moveNpc', npcId: 'nora', locationId: 'third_class_open_space' }, { type: 'moveNpc', npcId: 'promptly', locationId: 'third_class_open_space' }] }),
        B('w4_gates', 'The Gates', 'The way aft is blocked. Down to the third-class open space: Fio and Tommy are behind a locked gate.', 'third_class_open_space',
          { type: 'reach', locationId: 'third_class_open_space', radius: 6 }, { dialogueId: 'the_gates', onComplete: [{ type: 'panic', level: 0.5 }, { type: 'moveNpc', npcId: 'fio', locationId: 'boat_deck_port_fwd' }, { type: 'moveNpc', npcId: 'tommy', locationId: 'boat_deck_port_fwd' }] }),
        B('w4_band', 'The Band and the Boats', 'Get everyone up to the boat deck. Get Rosie into a boat.', 'boat_deck_entrance_fwd',
          { type: 'reach', locationId: 'boat_deck_entrance_fwd', radius: 7 }, { onStart: [{ type: 'moveNpc', npcId: 'heartstring', locationId: 'boat_deck_entrance_fwd' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'collapsible_D_station' }, { type: 'moveNpc', npcId: 'cal', locationId: 'collapsible_D_station' }], dialogueId: 'the_boats', onComplete: [{ type: 'setFlag', flag: 'rosie_jumped_back' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'grand_staircase_D' }, { type: 'moveNpc', npcId: 'cal', locationId: 'grand_staircase_A' }, { type: 'panic', level: 0.8 }] }),
        B('w4_reunion', 'Down and Up', 'Rosie jumped back aboard. Find her on the D-deck landing, then get aft and get high.', 'grand_staircase_D',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'reunion', onComplete: [{ type: 'moveNpc', npcId: 'rosie', locationId: 'stern_rail' }, { type: 'moveNpc', npcId: 'bibles', locationId: 'poop_deck' }, log('Get aft. Get high.')] }),
        B('w4_stern', 'Hold On', 'The poop deck, the stern rail, the outside of it. Like the first night.', 'stern_rail',
          { type: 'reach', locationId: 'stern_rail', radius: 5 }, { dialogueId: 'hold_on', onComplete: [{ type: 'setFlag', flag: 'at_the_stern' }] }),
        B('w4_plunge', 'On Three', 'Breathe out. In. Kick away.', 'stern_rail',
          { type: 'time', at: '02:20' }, { onComplete: [{ type: 'fade', seconds: 3 }, { type: 'teleport', locationId: 'debris_field' }, { type: 'moveNpc', npcId: 'rosie', locationId: 'debris_field' }, { type: 'cutscene', id: 'the_panel', text: 'A carved oak panel floats in the debris. She climbs on; it tips when he tries.' }] }),
        B('w4_panel', 'The Panel That Was Not a Door', 'Stay with her. Keep talking.', 'debris_field',
          { type: 'talk', npcId: 'rosie' }, { dialogueId: 'the_panel', onComplete: [{ type: 'fade', seconds: 4 }, { type: 'setPlayer', characterId: 'rosie' }, log('A whistle. A boat comes back.'), { type: 'give', item: 'the_whistle' }] }),
      ],
    },
    {
      id: 'epilogue', title: 'Epilogue — Something to Return', date: '1996-08-14', startTime: '23:00',
      beats: [
        B('e_rail', 'The Stern Rail, Again', 'Barefoot, in a cardigan, walk to the stern rail with the Heart of the Deep in your pocket.', 'stern_rail',
          { type: 'reach', locationId: 'stern_rail', radius: 4 }, { onStart: [{ type: 'setPlayer', characterId: 'oldrosamund' }, { type: 'teleport', locationId: 'poop_deck' }], dialogueId: 'epilogue_choice', onComplete: [{ type: 'cutscene', id: 'credits', text: 'In memory of the 1,496.' }] }),
      ],
    },
  ],
};

export const DISCOVERIES = [
  { id: 'berth_44', name: 'Berth 44', deck: 'C', x: LOCATIONS.spawn_southampton.x, y: deckY('C'), z: 12, plaque: 'Titanic sailed from Berth 44, Southampton, at noon on 10 April 1912 with about 2,200 people aboard.' },
  { id: 'the_near_miss', name: 'The Near Miss', deck: 'B', x: x(60), y: deckY('B') + 2.5, z: 0, plaque: "As she left, her wash snapped the moorings of the liner New York, which swung within a few feet of Titanic's stern before tugs caught her." },
  { id: 'the_stem', name: 'The Stem', deck: 'B', x: LOCATIONS.bow_tip.x - 2, y: LOCATIONS.bow_tip.y, z: 0, plaque: 'The forecastle deck at the stem stood about 51 ft above the waterline. Her anchors weighed nearly eight tons each; the centre anchor over fifteen.' },
  { id: 'grand_staircase', name: 'The Grand Staircase', deck: 'A', x: LOCATIONS.grand_staircase_A.x, y: deckY('A'), z: 0, plaque: 'Oak panelling, wrought iron and gilt bronze; the clock panel on the landing shows Honour and Glory crowning Time. The staircase descended seven levels under a glass dome.' },
  { id: 'the_gymnasium', name: 'The Gymnasium', deck: 'boat', x: LOCATIONS.gymnasium.x, y: deckY('boat'), z: LOCATIONS.gymnasium.z, plaque: 'The gymnasium offered electric horse and camel machines, rowing and cycling machines, for ladies in the morning and gentlemen in the afternoon.' },
  { id: 'dining_saloon', name: 'The Dining Saloon', deck: 'D', x: LOCATIONS.dining_saloon.x, y: deckY('D'), z: 0, plaque: 'The largest room afloat in 1912: 114 ft long, the full 92 ft width of the ship, seating over 500 in Jacobean style painted white.' },
  { id: 'cafe_parisien', name: 'Café Parisien', deck: 'B', x: LOCATIONS.cafe_parisien.x, y: deckY('B'), z: 11, plaque: 'New on Titanic: a sun-lit verandah café with trellis and ivy, an annex of the à la carte restaurant on B deck starboard.' },
  { id: 'the_pool', name: 'The Swimming Bath', deck: 'F', x: LOCATIONS.pool.x, y: deckY('F'), z: 7, plaque: 'A heated salt-water bath 30 ft by 14 ft on F deck, with changing cubicles, among the first swimming pools at sea.' },
  { id: 'turkish_baths', name: 'The Turkish Baths', deck: 'F', x: LOCATIONS.turkish_bath.x, y: deckY('F'), z: 6, plaque: 'A cooling room in the style of seventeenth-century Arabia: blue-green tiles, teak, gilded beams and bronze lanterns.' },
  { id: 'squash_court', name: 'The Squash Court', deck: 'G', x: LOCATIONS.squash_court.x, y: deckY('G'), z: 3.5, plaque: 'A squash racquet court two decks high on G deck, with a professional in attendance at two shillings the half hour.' },
  { id: 'scotland_road', name: 'Scotland Road', deck: 'E', x: LOCATIONS.scotland_road.x, y: deckY('E'), z: -6.3, plaque: 'The crew called the long working alleyway on E deck Scotland Road, after the Liverpool street. It ran most of the length of the ship.' },
  { id: 'post_office', name: 'The Sea Post Office', deck: 'G', x: LOCATIONS.mail_room.x, y: deckY('G'), z: 9, plaque: 'Five postal clerks sorted mail on G deck. The mail room was afloat twenty minutes after the collision; the clerks tried to carry the sacks up.' },
  { id: 'boiler_room_6', name: 'Boiler Room No. 6', deck: 'tankTop', x: LOCATIONS.boiler_room_6.x, y: deckY('tankTop'), z: 0, plaque: 'The foremost boiler room, with four double-ended boilers. It was flooded within minutes of the collision.' },
  { id: 'engine_room', name: 'The Reciprocating Engine Room', deck: 'tankTop', x: LOCATIONS.engine_room.x, y: deckY('tankTop'), z: 0, plaque: 'Two four-cylinder triple-expansion engines about 30 ft tall drove the wing propellers; their exhaust steam drove a turbine on the centre shaft.' },
  { id: 'the_renault', name: 'The Renault', deck: 'orlop', x: LOCATIONS.cargo_hold_2.x, y: deckY('orlop'), z: -3, plaque: 'A crated 1912 Renault coupé de ville was carried in the forward hold. It was never found on the wreck.' },
  { id: 'marconi_room', name: 'The Marconi Room', deck: 'boat', x: LOCATIONS.marconi_room.x, y: deckY('boat'), z: 0, plaque: 'The wireless operators sent CQD and the new SOS call after midnight. Carpathia, 58 miles away, answered and came at full speed.' },
  { id: 'the_bridge', name: 'The Bridge', deck: 'boat', x: LOCATIONS.bridge.x, y: deckY('boat'), z: 0, plaque: 'At 23:40 the lookouts rang three bells. The helm was put hard over and the engines reversed; the iceberg struck the starboard bow.' },
  { id: 'lifeboats', name: 'The Lifeboats', deck: 'boat', x: LOCATIONS.boat_deck_port_fwd.x, y: deckY('boat'), z: -11, plaque: 'Twenty boats for 1,178 people, on a ship carrying about 2,200. The regulations of the day asked for no more.' },
  { id: 'the_band', name: 'The Band', deck: 'boat', x: LOCATIONS.boat_deck_entrance_fwd.x, y: deckY('boat'), z: -9, plaque: 'Eight musicians played on the boat deck as the boats were loaded. None survived.' },
  { id: 'third_class_general', name: 'The General Room', deck: 'C', x: LOCATIONS.third_class_general.x, y: deckY('C'), z: 7, plaque: 'White-enamelled pine, teak benches and a piano under the poop deck: the third-class common room.' },
  { id: 'the_poop', name: 'The Poop Deck', deck: 'B', x: LOCATIONS.poop_deck.x, y: LOCATIONS.poop_deck.y, z: 0, plaque: 'The third-class promenade. The docking bridge above it carried a telegraph, a compass and a third steering wheel.' },
  { id: 'the_break', name: 'Between the Third and Fourth Funnels', deck: 'A', x: SHIP.breakX, y: deckY('A'), z: 0, plaque: 'About 02:18 on 15 April the hull broke in two near here. The bow sank first; the stern rose, settled, then followed.' },
];

export const COLLECTIBLES = [
  { id: 'menu_card_saturday', kind: 'menu', name: 'Saturday dinner menu', deck: 'D', x: LOCATIONS.dining_saloon.x, y: deckY('D') + 0.8, z: 2, text: 'Consommé Olga · Salmon, mousseline sauce · Filet mignons Lili · Roast duckling · Peaches in chartreuse jelly.' },
  { id: 'menu_card_third', kind: 'menu', name: 'Third-class bill of fare', deck: 'F', x: LOCATIONS.third_class_dining.x, y: deckY('F') + 0.8, z: 6, text: 'Breakfast: oatmeal porridge, smoked herrings, ham and eggs, bread and marmalade, tea and coffee.' },
  { id: 'postcard_southampton', kind: 'postcard', name: 'Postcard: Southampton', deck: 'C', x: LOCATIONS.spawn_southampton.x, y: deckY('C') + 1.0, z: 11, text: 'A tinted card of the Ocean Dock, four funnels above the sheds.' },
  { id: 'postcard_queenstown', kind: 'postcard', name: 'Postcard: Queenstown', deck: 'B', x: LOCATIONS.poop_deck.x + 3, y: LOCATIONS.poop_deck.y + 1.0, z: 5, text: 'Tenders alongside; a last view of Ireland.' },
  { id: 'postcard_steerage', kind: 'postcard', name: 'Postcard: Steerage', deck: 'C', x: LOCATIONS.third_class_general.x, y: deckY('C') + 0.8, z: 9, text: 'Eight to a cabin and a piano in the General Room.' },
  { id: 'ticket_cardeza', kind: 'ticket', name: 'A parlour-suite ticket stub', deck: 'B', x: LOCATIONS.parlour_suite_B52.x, y: deckY('B') + 0.8, z: -5, text: 'B-52/54/56, with private promenade. Southampton to New York.' },
  { id: 'ticket_steerage', kind: 'ticket', name: 'A steerage ticket', deck: 'E', x: LOCATIONS.third_class_cabin.x, y: deckY('E') + 0.8, z: -10, text: 'Third class, berth G-62. Seven pounds, fifteen shillings.' },
  { id: 'marconigram', kind: 'postcard', name: 'An undelivered Marconigram', deck: 'boat', x: LOCATIONS.marconi_room.x, y: deckY('boat') + 0.9, z: 1, text: 'ARRIVING WEDNESDAY STOP ALL WELL STOP' },
];
