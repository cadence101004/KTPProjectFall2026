import { describe, expect, it } from 'vitest'
import { beatTimes, snapToGrid } from './beatGrid'

// At 120 BPM a beat is 0.5 s.
describe('snapToGrid', () => {
  it('snaps to the nearest beat', () => {
    expect(snapToGrid(1.2, { bpm: 120, offset: 0, division: 1 })).toBe(1)
    expect(snapToGrid(1.3, { bpm: 120, offset: 0, division: 1 })).toBe(1.5)
  })

  it('respects the offset of the first beat', () => {
    expect(snapToGrid(1.2, { bpm: 120, offset: 0.1, division: 1 })).toBeCloseTo(1.1)
  })

  it('snaps to half beats', () => {
    expect(snapToGrid(1.2, { bpm: 120, offset: 0, division: 2 })).toBe(1.25)
  })

  it('leaves time alone with no grid', () => {
    expect(snapToGrid(1.234, null)).toBe(1.234)
  })
})

describe('beatTimes', () => {
  it('lists every beat in the song and marks bar starts', () => {
    const beats = beatTimes(120, 0, 2.5)
    expect(beats.map(b => b.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5])
    expect(beats.map(b => b.barStart)).toEqual([true, false, false, false, true, false])
  })

  it('includes beats before the offset, keeping bars aligned to beat 0', () => {
    const beats = beatTimes(120, 0.6, 1.2)
    expect(beats[0].time).toBeCloseTo(0.1)
    expect(beats.find(b => Math.abs(b.time - 0.6) < 1e-9)?.barStart).toBe(true)
  })
})
