import type { Level } from '../types/level'

// Hardcoded level for build step 1. Works with any MP3: clips sit on whole seconds so switches are easy to hear.
export const testLevel: Level = {
  title: 'Test Voyage',
  audioHash: '',
  bpm: 120,
  clips: [
    { type: 'buffer', start: 0, end: 4 },
    { type: 'game', gameId: 'fire_cannon', start: 4, end: 8, difficulty: 1 },
    { type: 'buffer', start: 8, end: 10 },
    { type: 'game', gameId: 'dodge_kraken', start: 10, end: 16, difficulty: 1 },
    { type: 'buffer', start: 16, end: 18 },
    { type: 'game', gameId: 'swab_the_deck', start: 18, end: 22, difficulty: 1 },
    { type: 'buffer', start: 22, end: 24 },
  ],
  media: [],
}
