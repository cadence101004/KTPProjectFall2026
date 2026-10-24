import { describe, expect, it } from 'vitest'
import type { Clip } from '../types/level'
import { previewStart } from './preview'

const clips: Clip[] = [
  { type: 'buffer', start: 0, end: 4 },
  { type: 'game', gameId: 'fire_cannon', start: 4, end: 8, difficulty: 1 },
]

describe('previewStart', () => {
  it('backs up to the start of a minigame the playhead is inside', () => {
    expect(previewStart(clips, 6.5)).toBe(4)
  })

  it('starts right at the playhead inside a buffer or empty space', () => {
    expect(previewStart(clips, 2)).toBe(2)
    expect(previewStart(clips, 9)).toBe(9)
  })
})
