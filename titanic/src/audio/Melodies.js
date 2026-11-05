/**
 * Note data for the band (importable without Web Audio). Each piece: { tempo (bpm), voice, notes:[{ n, d (beats), c?:[chord notes], v? }] }.
 * Public-domain tunes: the hymn tune "Bethany" (Lowell Mason, 1856; "Nearer, My God, to Thee"), the opening theme of
 * "An der schönen blauen Donau" (Johann Strauss II, 1866). "Autumn Dream" and "Steerage Rag" are original period-style pieces.
 */
const SEMI = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function parseNote(name) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(name);
  if (!m) return 440;
  const midi = 12 * (parseInt(m[2], 10) + 1) + SEMI[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const N = (n, d, c, v) => ({ n, d, ...(c ? { c } : {}), ...(v ? { v } : {}) });
const G = ['G3', 'B3', 'D4'], C = ['C4', 'E4', 'G4'], D7 = ['D4', 'F#4', 'A4', 'C5'], Em = ['E3', 'G3', 'B3'], Am = ['A3', 'C4', 'E4'], E7 = ['E3', 'G#3', 'B3'], Dm = ['D3', 'F3', 'A3'], F = ['F3', 'A3', 'C4'], Cc = ['C3', 'E3', 'G3'], G7 = ['G3', 'B3', 'F4'], Dmaj = ['D3', 'F#3', 'A3'], A7 = ['A3', 'C#4', 'G4'];

export const MELODIES = {
  // Bethany — "Nearer, My God, to Thee" (4/4, slow). Melody transcribed from the hymnal setting.
  nearerMyGod: { tempo: 66, voice: 'strings', notes: [
    N('G4', 1.5, G), N('G4', 0.5), N('E4', 1, Em), N('G4', 1, G), N('B4', 1.5, G), N('A4', 0.5), N('G4', 2, G),
    N('B4', 1.5, G), N('B4', 0.5), N('A4', 1, D7), N('B4', 1, G), N('D5', 4, G),
    N('G4', 1.5, G), N('G4', 0.5), N('E4', 1, Em), N('G4', 1, G), N('B4', 1.5, G), N('A4', 0.5), N('G4', 2, G),
    N('B4', 1.5, G), N('B4', 0.5), N('A4', 1, D7), N('B4', 1, D7), N('G4', 4, G),
    N('D5', 1.5, G), N('D5', 0.5), N('B4', 1, G), N('D5', 1, G), N('G5', 1.5, C), N('F#5', 0.5), N('E5', 2, C),
    N('D5', 1.5, G), N('D5', 0.5), N('B4', 1, G), N('D5', 1, D7), N('A4', 4, D7),
    N('G4', 1.5, G), N('G4', 0.5), N('E4', 1, Em), N('G4', 1, G), N('B4', 1.5, G), N('A4', 0.5), N('G4', 2, G),
    N('B4', 1.5, G), N('B4', 0.5), N('A4', 1, D7), N('B4', 1, D7), N('G4', 4, G), N('r', 2),
  ] },
  // The Blue Danube — opening theme (3/4).
  waltz: { tempo: 150, voice: 'strings', notes: [
    N('D4', 1, Dmaj), N('D4', 1), N('F#4', 1), N('A4', 1, Dmaj), N('A4', 2), N('r', 1), N('A4', 1, Dmaj), N('A4', 2), N('r', 1), N('F#4', 1, Dmaj), N('F#4', 2),
    N('D4', 1, Dmaj), N('D4', 1), N('F#4', 1), N('A4', 1, Dmaj), N('A4', 2), N('r', 1), N('A4', 1, A7), N('A4', 2), N('r', 1), N('G4', 1, A7), N('G4', 2),
    N('D4', 1, A7), N('D4', 1), N('G4', 1), N('B4', 1, A7), N('B4', 2), N('r', 1), N('B4', 1, A7), N('B4', 2), N('r', 1), N('G4', 1, A7), N('G4', 2),
    N('D4', 1, A7), N('D4', 1), N('G4', 1), N('B4', 1, A7), N('B4', 2), N('r', 1), N('A4', 1, Dmaj), N('A4', 2), N('r', 1), N('F#4', 1, Dmaj), N('F#4', 2), N('r', 3),
  ] },
  // Autumn Dream — original waltz in A minor in the manner of a 1908 ballroom piece.
  autumn: { tempo: 138, voice: 'strings', notes: [
    N('E5', 2, Am), N('C5', 1), N('A4', 3, Am), N('B4', 2, E7), N('C5', 1), N('B4', 3, E7),
    N('A4', 2, Am), N('C5', 1), N('E5', 3, Am), N('D5', 2, Dm), N('C5', 1), N('B4', 3, E7),
    N('C5', 2, Am), N('D5', 1), N('E5', 3, Am), N('F5', 2, F), N('E5', 1), N('D5', 3, Dm),
    N('C5', 2, Am), N('B4', 1), N('A4', 3, E7), N('G#4', 2, E7), N('B4', 1), N('A4', 3, Am), N('r', 3),
  ] },
  // Steerage Rag — original syncopated phrase (2/4 feel written in quarter beats).
  ragtime: { tempo: 180, voice: 'piano', notes: [
    N('E4', 0.5, Cc), N('G4', 0.5), N('C5', 1), N('E5', 0.5, Cc), N('C5', 0.5), N('G4', 1), N('A4', 0.5, F), N('C5', 0.5), N('F5', 1), N('A5', 0.5, F), N('F5', 0.5), N('C5', 1),
    N('G4', 0.5, G7), N('B4', 0.5), N('D5', 1), N('F5', 0.5, G7), N('D5', 0.5), N('B4', 1), N('C5', 0.5, Cc), N('E5', 0.5), N('G5', 1), N('E5', 0.5, Cc), N('C5', 0.5), N('r', 1),
    N('E5', 0.5, Cc), N('E5', 0.5), N('D5', 0.5), N('C5', 0.5), N('A4', 0.5, F), N('C5', 0.5), N('A4', 1), N('D5', 0.5, G7), N('D5', 0.5), N('C5', 0.5), N('B4', 0.5), N('G4', 0.5, G7), N('B4', 0.5), N('G4', 1),
    N('C5', 0.5, Cc), N('E5', 0.5), N('G5', 0.5), N('E5', 0.5), N('C5', 0.5, Cc), N('E5', 0.5), N('G5', 1), N('C6', 1, Cc), N('r', 1),
  ] },
};
