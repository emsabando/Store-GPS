// STUB — replaced by the research synthesis (ARCHITECTURE.md §1-2). Minimal placeholder so the scaffold boots.
export const SHIP = {
  meta: { stub: true },
  dims: { loa: 269.06, lbp: 259.84, beamMoulded: 28.19, draught: 10.54, keelToBoatDeck: 29.5 },
  hull: { stations: [], colours: { hull: '#111214', superstructure: '#e9e6dc', funnelBuff: '#c9a66b' } },
  decks: [
    { id: 'boat', name: 'Boat Deck', y: 19.0, heightToNext: 2.9, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'A', name: 'A Deck', y: 16.1, heightToNext: 2.9, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'B', name: 'B Deck', y: 13.2, heightToNext: 2.9, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'C', name: 'C Deck', y: 10.3, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'D', name: 'D Deck', y: 7.7, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'E', name: 'E Deck', y: 5.1, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'F', name: 'F Deck', y: 2.5, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'G', name: 'G Deck', y: -0.1, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'orlop', name: 'Orlop Deck', y: -2.7, heightToNext: 2.6, rooms: [], deckhouses: [], corridors: [], stairs: [] },
    { id: 'tankTop', name: 'Tank Top', y: -8.9, heightToNext: 6.2, rooms: [], deckhouses: [], corridors: [], stairs: [] },
  ],
  funnels: [{ n: 1, x: 65, baseY: 19, height: 21 }, { n: 2, x: 30, baseY: 19, height: 21 }, { n: 3, x: -5, baseY: 19, height: 21 }, { n: 4, x: -40, baseY: 19, height: 21, dummy: true }],
  masts: [], lifeboats: [], bulkheads: [], machinery: {}, cargo: {}, materials: {}, lighting: {},
  sinkingTimeline: [{ time: '23:40', minutesAfter: 0, trimDeg: 0, listDeg: 0, sinkM: 0, event: 'strike' }],
  filmScenes: [],
};
