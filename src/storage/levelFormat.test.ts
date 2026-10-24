import { describe, expect, it } from 'vitest'
import { normalizeLevel } from './levelFormat'

describe('normalizeLevel', () => {
  it('fills in fields that older levels are missing', () => {
    const level = normalizeLevel({ title: 'Old', audioHash: 'abc', bpm: 128, clips: [] })
    expect(level.beatOffset).toBe(0)
    expect(level.media).toEqual([])
  })

  it('sorts clips by start time', () => {
    const level = normalizeLevel({
      clips: [
        { type: 'buffer', start: 4, end: 6 },
        { type: 'buffer', start: 0, end: 2 },
      ],
    })
    expect(level.clips.map(c => c.start)).toEqual([0, 4])
  })

  it('drops broken clips', () => {
    const level = normalizeLevel({
      clips: [
        { type: 'buffer', start: 2, end: 1 }, // ends before it starts
        { type: 'game', start: 0, end: 1 }, // game with no gameId
        { type: 'mystery', start: 0, end: 1 },
        { type: 'game', gameId: 'fire_cannon', start: 3, end: 5, difficulty: 1 },
      ],
    })
    expect(level.clips).toHaveLength(1)
  })

  it('rejects data that is not a level', () => {
    expect(() => normalizeLevel('hello')).toThrow()
    expect(() => normalizeLevel({ title: 'no clips' })).toThrow()
  })
})
