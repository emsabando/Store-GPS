// Narrative data — LOCATIONS come from the ship spec's landmarks (ARCHITECTURE.md §2, §11).
// STORY / DISCOVERIES / COLLECTIBLES are a minimal placeholder until the narrative data pass.
import { SHIP } from './shipSpec.js';

export const LOCATIONS = Object.fromEntries(Object.entries(SHIP.landmarks).map(([id, l]) => [id, { ...l, id }]));
export const DISCOVERIES = [];
export const COLLECTIBLES = [];
export const STORY = {
  watches: [
    { id: 'watch1', title: 'Sailing Day', date: '1912-04-10', startTime: '11:30', beats: [
      { id: 'w1_board', title: 'All aboard', objective: 'Find your way to the bow.', locationId: 'bow_tip', trigger: { type: 'reach', locationId: 'bow_tip', radius: 4 }, onStart: [], onComplete: [], dialogueId: null, next: null },
    ] },
  ],
};
