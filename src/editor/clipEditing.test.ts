import { describe, expect, it } from 'vitest'
import type { Clip } from '../types/level'
import type { DurationMeta, TaskMeta } from '../types/minigame'
import { fitLength, freeGaps, placeMove, placeResize, snapLength } from './clipEditing'

// At 120 BPM a 2-beat task cycle is 1 s.
const task: TaskMeta = { id: 't', kind: 'task', prompt: '', hint: '', baseBeats: 2 }
const survive: DurationMeta = { id: 'd', kind: 'duration', prompt: '', hint: '', minDuration: 4, canBeatSync: false }
const buffer = (start: number, end: number): Clip => ({ type: 'buffer', start, end })

describe('snapLength', () => {
  it('snaps task games to whole cycles', () => {
    expect(snapLength(task, 2.4, 120)).toBe(2)
    expect(snapLength(task, 2.6, 120)).toBe(3)
  })

  it('enforces the minimum for duration games and buffers', () => {
    expect(snapLength(survive, 1, 120)).toBe(4)
    expect(snapLength(null, 0.1, 120)).toBe(0.25)
  })
})

describe('fitLength', () => {
  it('rounds a task game down to the cycles that fit the room', () => {
    expect(fitLength(task, 5, 3.5, 120)).toBe(3)
  })

  it('gives null when even the minimum does not fit', () => {
    expect(fitLength(survive, 5, 3, 120)).toBeNull()
    expect(fitLength(task, 5, 0.5, 120)).toBeNull()
  })
})

describe('freeGaps', () => {
  it('lists the space around clips', () => {
    expect(freeGaps([buffer(2, 4), buffer(6, 8)], -1, 10)).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
      { start: 8, end: 10 },
    ])
  })

  it('ignores the clip being edited', () => {
    expect(freeGaps([buffer(2, 4)], 0, 10)).toEqual([{ start: 0, end: 10 }])
  })
})

describe('placeMove', () => {
  const clips = [buffer(0, 2), buffer(6, 8)]

  it('places a clip where it is dropped when there is room', () => {
    expect(placeMove(clips, -1, 3, 2, 10)).toEqual({ start: 3, end: 5 })
  })

  it('pushes a clip in so it touches its neighbour instead of overlapping', () => {
    expect(placeMove(clips, -1, 4.5, 2, 10)).toEqual({ start: 4, end: 6 })
  })

  it('keeps clips inside the song', () => {
    expect(placeMove(clips, -1, 9.5, 1, 10)).toEqual({ start: 9, end: 10 })
  })

  it('refuses a drop whose center lands on another clip', () => {
    expect(placeMove(clips, -1, 6.5, 1, 10)).toBeNull()
  })

  it('refuses a gap that is too small', () => {
    expect(placeMove(clips, -1, 3, 5, 10)).toBeNull()
  })
})

describe('placeResize', () => {
  const clips: Clip[] = [{ type: 'game', gameId: 't', start: 2, end: 4, difficulty: 1 }, buffer(7, 9)]

  it('snaps a task clip to whole cycles while dragging its end', () => {
    expect(placeResize(clips, 0, 'end', 5.3, task, 120, 10)).toEqual({ start: 2, end: 5 })
  })

  it('stops at the next clip', () => {
    expect(placeResize(clips, 0, 'end', 9, task, 120, 10)).toEqual({ start: 2, end: 7 })
  })

  it('moves the start edge and keeps the end fixed', () => {
    expect(placeResize(clips, 0, 'start', 0.6, task, 120, 10)).toEqual({ start: 1, end: 4 })
  })
})
