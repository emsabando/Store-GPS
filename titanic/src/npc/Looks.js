/**
 * Looks — randomised period costumes per faction (ARCHITECTURE.md §2 'look' shape) and
 * generic idle chatter for anonymous crowd NPCs. Pure data + functions, no three.js.
 */

/** Small deterministic PRNG (mulberry32) so crowds are reproducible per spawn. */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const range = (rng, a, b) => a + (b - a) * rng();

const SKIN = ['#f1d2b6', '#e8c39e', '#d9a887', '#c48e6a', '#a9734f', '#7a4a2e'];
const HAIR = ['#1b1410', '#2d1e14', '#4a3222', '#6b4a2b', '#8a5a2b', '#b08a4a', '#d9c08a', '#8d8d8d', '#d8d8d8'];

const JEWEL = ['#0f6b4f', '#1f3b8a', '#8a1530', '#5a2a7a', '#b8923a', '#1b5e6b', '#7a1f4a', '#2f4f8f'];
const IVORY = ['#efe6d2', '#e8dcc0', '#f3ecd9'];
const DARK_FORMAL = ['#101014', '#15151c', '#1b1a2e', '#0e0f14'];
const SUITS = ['#3b3a44', '#4b3a2c', '#2f3a4f', '#55504a', '#3a3f4a', '#4a4440'];
const DRESSES2 = ['#4a5a7a', '#6b3a4a', '#3f5a46', '#5a4a6a', '#6a5a3a', '#4a4a5a'];
const THIRD = ['#5a4632', '#6b6258', '#3e3a35', '#7a6a52', '#4d4a44', '#6a5a46', '#574b3f'];
const SHAWLS = ['#7a2e2e', '#2e4a3a', '#5a3a6a', '#8a6a3a', '#4a4a4a', '#6a3a2a'];
const NAVY = ['#1a2440', '#14203a', '#1c2a4a'];

export const FACTION_TITLES = {
  first: 'a first-class passenger',
  second: 'a second-class passenger',
  third: 'a steerage passenger',
  crew: 'a steward',
  officer: 'an officer',
  band: 'a bandsman',
  modern: 'a passenger',
};

export function factionTitle(faction) { return FACTION_TITLES[faction] || FACTION_TITLES.modern; }

/** Capitalised short speaker name for toasts ("Steward", "First-class lady"). */
export function speakerName(faction, sex) {
  switch (faction) {
    case 'first': return sex === 'f' ? 'First-class lady' : 'First-class gentleman';
    case 'second': return sex === 'f' ? 'Second-class lady' : 'Second-class gentleman';
    case 'third': return sex === 'f' ? 'Steerage woman' : 'Steerage man';
    case 'crew': return sex === 'f' ? 'Stewardess' : 'Steward';
    case 'officer': return 'Officer';
    case 'band': return 'Bandsman';
    default: return 'Passenger';
  }
}

/**
 * Generate a look for an anonymous NPC of the given faction.
 * @param {'first'|'second'|'third'|'crew'|'officer'|'band'|'modern'} faction
 * @param {() => number} rng
 */
export function makeLook(faction, rng = Math.random) {
  const sexRoll = rng();
  let sex = sexRoll < 0.5 ? 'm' : 'f';
  if (faction === 'officer' || faction === 'band') sex = 'm';
  if (faction === 'crew') sex = sexRoll < 0.85 ? 'm' : 'f';
  const skin = pick(rng, SKIN);
  const hairColor = pick(rng, HAIR);
  const look = {
    sex,
    skin,
    hair: { color: hairColor, style: sex === 'f' ? pick(rng, ['bun', 'bun', 'long']) : pick(rng, ['short', 'short', 'moustache', 'bald']) },
    hat: 'none',
    top: { color: '#333333', kind: sex === 'f' ? 'dress' : 'jacket' },
    bottom: { color: '#222222', kind: sex === 'f' ? 'skirt' : 'trousers' },
    accent: '#ffffff',
    height: sex === 'f' ? range(rng, 1.58, 1.72) : range(rng, 1.68, 1.86),
  };
  switch (faction) {
    case 'first':
      if (sex === 'm') {
        const c = pick(rng, DARK_FORMAL);
        look.top = { color: c, kind: rng() < 0.8 ? 'tailcoat' : 'suit' };
        look.bottom = { color: c, kind: 'trousers' };
        look.hat = rng() < 0.7 ? 'tophat' : 'none';
        look.accent = pick(rng, IVORY);
      } else {
        const c = pick(rng, JEWEL);
        look.top = { color: c, kind: 'gown' };
        look.bottom = { color: c, kind: 'gown' };
        look.hat = rng() < 0.4 ? 'wide' : 'none';
        look.accent = rng() < 0.5 ? '#d8b25a' : pick(rng, IVORY);
      }
      break;
    case 'second':
      if (sex === 'm') {
        const c = pick(rng, SUITS);
        look.top = { color: c, kind: 'suit' };
        look.bottom = { color: c, kind: 'trousers' };
        look.hat = rng() < 0.75 ? 'bowler' : 'none';
        look.accent = '#e6e0d0';
      } else {
        const c = pick(rng, DRESSES2);
        look.top = { color: c, kind: 'dress' };
        look.bottom = { color: c, kind: 'skirt' };
        look.hat = rng() < 0.5 ? 'bonnet' : 'none';
        look.accent = pick(rng, ['#e6e0d0', '#c9b58a', '#d0c4c4']);
      }
      break;
    case 'third':
      if (sex === 'm') {
        const c = pick(rng, THIRD);
        look.top = { color: c, kind: rng() < 0.6 ? 'jacket' : 'waistcoat' };
        look.bottom = { color: pick(rng, THIRD), kind: 'trousers' };
        look.hat = rng() < 0.8 ? 'flatcap' : 'none';
        look.accent = pick(rng, ['#d9d2c0', '#b9b2a0', '#8a7a62']);
      } else {
        look.top = { color: pick(rng, THIRD), kind: 'blouse' };
        look.bottom = { color: pick(rng, THIRD), kind: 'skirt' };
        look.hat = rng() < 0.3 ? 'bonnet' : 'none';
        look.accent = pick(rng, SHAWLS); // shawl colour
      }
      break;
    case 'crew':
      if (rng() < 0.5) {
        look.top = { color: '#ece7dc', kind: 'jacket' }; // white steward jacket
        look.bottom = { color: '#15151c', kind: 'trousers' };
        look.accent = '#15151c';
      } else {
        const c = pick(rng, NAVY);
        look.top = { color: c, kind: 'uniform' };
        look.bottom = { color: c, kind: 'trousers' };
        look.accent = '#c9a349';
      }
      if (sex === 'f') { look.top = { color: '#f2eee6', kind: 'blouse' }; look.bottom = { color: '#2a2a33', kind: 'skirt' }; look.accent = '#ffffff'; }
      look.hat = 'none';
      break;
    case 'officer': {
      const c = pick(rng, NAVY);
      look.top = { color: c, kind: 'uniform' };
      look.bottom = { color: c, kind: 'trousers' };
      look.hat = 'officer';
      look.accent = '#c9a349'; // brass
      look.hair.style = rng() < 0.5 ? 'moustache' : 'short';
      break;
    }
    case 'band':
      look.top = { color: '#101014', kind: 'tailcoat' };
      look.bottom = { color: '#101014', kind: 'trousers' };
      look.hat = 'none';
      look.accent = '#f4f1ea';
      break;
    default:
      look.top = { color: pick(rng, SUITS), kind: 'jacket' };
      look.bottom = { color: '#2a2a2a', kind: 'trousers' };
      break;
  }
  return look;
}

// ---------------------------------------------------------------------------------------------
// Idle chatter (original text, <= 140 chars, period idiom; see design/STORY_AND_CHARACTERS.md §4).
// ---------------------------------------------------------------------------------------------

export const CHATTER = {
  first: [
    'Have you seen the Café Parisien? Quite the Continental touch.',
    'The Captain\'s table tonight, I\'m told. One simply must dress.',
    'Forty-six thousand tons, and she rides like a drawing room.',
    'My maid says the lifts are faster than the ones at the Ritz.',
    'Do mind the draught on the promenade. Bracing, they call it.',
    'The Turkish bath, then tea. One must keep up one\'s strength.',
    'They say the Smoking Room fire never goes out. Marvellous extravagance.',
    'New York by Wednesday. The newspapers will be unbearable.',
  ],
  second: [
    'Second class on this ship is first class anywhere else, mark my words.',
    'The library has a Baedeker for every port. I\'ve read Queenstown twice.',
    'We dock in New York on Wednesday morning, the purser says.',
    'Did you hear the band at tea? Ragtime, of all things.',
    'The children have discovered the barber\'s shop sells toys. Heaven help us.',
    'A clergyman led hymns in the dining saloon. Rather moving, actually.',
    'Our cabin has an electric heater. An electric heater, at sea!',
  ],
  third: [
    'There\'s a General Room with a piano and nobody minding who plays it.',
    'Four bunks to a cabin and running water. Running water!',
    'They lock the gates to the upper decks, but you can hear the music through them.',
    'Me brother\'s in Boston. He says the streets are wide as rivers.',
    'Keep your ticket close. The stewards ask twice.',
    'Fresh bread every morning. I could get used to this ship.',
    'The lads are getting up a dance tonight. Bring your boots.',
    'I hear the swells upstairs have a staircase bigger than our church.',
  ],
  crew: [
    'Mind the wet deck, sir. Fresh-swabbed.',
    'Dinner is at seven, madam. The bugle will sound.',
    'Two thousand souls aboard and every one of them wants tea at four.',
    'Scotland Road is the quick way aft, if you don\'t mind the stokers.',
    'Lost? Follow the carpet. Red for first class, lino for the rest of us.',
    'Can\'t stop, sir. Thirty cabins and only the one pair of hands.',
  ],
  officer: [
    'Twenty-two knots and steady. She\'s a fine ship.',
    'The lookouts have the glass tonight. Clear as a bell, cold as the grave.',
    'Carry on. Keep to the starboard side of the deck, if you please.',
    'Ice warnings? We have them every crossing. The Atlantic is a cold place.',
    'The bridge is not a promenade, sir. Kindly step aft.',
  ],
  band: [
    'Requests after the fish course, if you please.',
    'We\'ve a waltz, a two-step and a hymn or two. Something for everyone.',
    'Eight of us, two ensembles, and one cold Boat Deck between us.',
    'The cellist swears his strings go flat north of forty degrees.',
  ],
  modern: [
    'Good day to you.',
    'Fine weather for the crossing.',
    'Have you seen the Grand Staircase? Extraordinary.',
  ],
};

export const PANIC_LINES = [
  'Where are the boats? They said there were boats!',
  'Women and children first. I heard the officer say it myself.',
  'She\'s listing. Can\'t you feel it? She\'s listing!',
  'My children are below. Let me through!',
  'Keep calm, keep calm. The band\'s still playing, isn\'t it?',
  'Put your lifebelt on. Put it on now!',
  'Which way to the Boat Deck? For pity\'s sake, which way?',
  'They say she can\'t sink. They say. Look at the bow!',
];

/** Pick n distinct idle lines for a faction. */
export function pickLines(faction, rng = Math.random, n = 3) {
  const pool = (CHATTER[faction] || CHATTER.modern).slice();
  const out = [];
  while (pool.length && out.length < n) out.push(pool.splice(Math.floor(rng() * pool.length) % pool.length, 1)[0]);
  return out;
}
