import { describe, expect, it } from 'vitest'
import type { Clip } from '../types/level'
import { clipIndexAt, LevelRunner, type RunnerEvent } from './LevelRunner'
import { testLevel } from './testLevel'

describe('clipIndexAt', () => {
  const clips = testLevel.clips

  it('finds the clip containing a time', () => {
    expect(clipIndexAt(clips, 5)).toBe(1)
    expect(clipIndexAt(clips, 12.3)).toBe(3)
  })

  it('switches to the next clip exactly at a boundary', () => {
    expect(clipIndexAt(clips, 3.999)).toBe(0)
    expect(clipIndexAt(clips, 4)).toBe(1)
  })

  it('returns -1 before the song starts', () => {
    expect(clipIndexAt(clips, -0.05)).toBe(-1)
  })

  it('returns -1 once the last clip ends', () => {
    expect(clipIndexAt(clips, 24)).toBe(-1)
  })

  it('returns -1 in a gap between clips', () => {
    const gappy: Clip[] = [
      { type: 'buffer', start: 0, end: 2 },
      { type: 'buffer', start: 3, end: 5 },
    ]
    expect(clipIndexAt(gappy, 2.5)).toBe(-1)
  })
})

describe('LevelRunner.update', () => {
  // Fake clock: tests set `t` by hand instead of playing audio.
  function setup() {
    const clock = { t: -0.05, songTime() { return this.t } }
    const runner = new LevelRunner(testLevel, clock)
    // Advances the clock and returns the events as short strings, e.g. ['end:0', 'start:1'].
    const at = (t: number) => {
      clock.t = t
      return runner.update().map(label)
    }
    return { at, runner }
  }

  function label(e: RunnerEvent): string {
    return e.type === 'levelEnd' ? 'levelEnd' : `${e.type === 'clipStart' ? 'start' : 'end'}:${e.index}`
  }

  it('reports nothing before the song starts', () => {
    const { at } = setup()
    expect(at(-0.05)).toEqual([])
  })

  it('starts the first clip at time 0', () => {
    const { at } = setup()
    expect(at(0)).toEqual(['start:0'])
  })

  it('ends one clip and starts the next on the same frame at a boundary', () => {
    const { at } = setup()
    at(0)
    expect(at(4)).toEqual(['end:0', 'start:1'])
  })

  it('does not repeat events while a clip is running', () => {
    const { at } = setup()
    at(4)
    expect(at(5)).toEqual([])
    expect(at(6)).toEqual([])
  })

  it('never skips a clip during a lag spike', () => {
    const { at } = setup()
    at(3.9)
    expect(at(8.5)).toEqual(['end:0', 'start:1', 'end:1', 'start:2'])
  })

  it('reports levelEnd exactly once after the last clip', () => {
    const { at } = setup()
    at(23)
    expect(at(24)).toEqual(['end:6', 'levelEnd'])
    expect(at(25)).toEqual([])
  })

  it('seeking mid-clip starts that clip on the next update', () => {
    const { at, runner } = setup()
    runner.seek(12)
    expect(at(12)).toEqual(['start:3'])
  })

  it('seeking to a boundary starts the later clip only', () => {
    const { at, runner } = setup()
    runner.seek(8)
    expect(at(8)).toEqual(['start:2'])
  })

  it('restarting after the level ended plays it again from the top', () => {
    const { at, runner } = setup()
    at(30)
    runner.seek(0)
    expect(at(0)).toEqual(['start:0'])
    expect(at(30)).toContain('levelEnd')
  })

  it('seeking past the last clip ends the level', () => {
    const { at, runner } = setup()
    runner.seek(30)
    expect(at(30)).toEqual(['levelEnd'])
  })
})
