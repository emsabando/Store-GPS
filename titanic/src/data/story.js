// STUB — replaced by the narrative data engineer (ARCHITECTURE.md §2, §11).
export const LOCATIONS = {
  spawn_southampton: { name: 'First-class entrance, C Deck', deck: 'C', x: 40, y: 8.2, z: 12, yaw: Math.PI / 2 },
  bow_tip: { name: 'The bow', deck: 'boat', x: 128, y: 13.5, z: 0, yaw: 0 },
  stern_rail: { name: 'Stern rail, poop deck', deck: 'B', x: -128, y: 13.5, z: 0, yaw: Math.PI },
};
export const DISCOVERIES = [];
export const COLLECTIBLES = [];
export const STORY = {
  watches: [
    { id: 'watch1', title: 'Sailing Day', date: '1912-04-10', startTime: '11:30', beats: [
      { id: 'w1_board', title: 'All aboard', objective: 'Find your way to the bow.', locationId: 'bow_tip', trigger: { type: 'reach', locationId: 'bow_tip', radius: 4 }, onStart: [], onComplete: [], dialogueId: null, next: null },
    ] },
  ],
};
