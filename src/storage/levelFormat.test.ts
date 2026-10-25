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

  it('keeps valid media clips, fills in missing effects, and drops broken ones', () => {
    const level = normalizeLevel({
      clips: [],
      mediaEnabled: false,
      media: [
        { kind: 'video', src: 'intro.mp4', mediaHash: 'abc', start: 0, end: 8 },
        { kind: 'gif', mediaHash: 'x', start: 0, end: 1 }, // unknown kind
        { kind: 'image', start: 0, end: 1 }, // no hash
      ],
    })
    expect(level.media).toHaveLength(1)
    expect(level.media[0].effects).toEqual({ blur: 0, dim: 0 })
    expect(level.mediaEnabled).toBe(false)
  })

  it('rejects data that is not a level', () => {
    expect(() => normalizeLevel('hello')).toThrow()
    expect(() => normalizeLevel({ title: 'no clips' })).toThrow()
  })
})
