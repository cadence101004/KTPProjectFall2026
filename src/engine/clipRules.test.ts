import { describe, expect, it } from 'vitest'
import type { GameClip } from '../types/level'
import type { DurationMeta, TaskMeta } from '../types/minigame'
import { defaultHits, hitTimes, repsFor, usesBeatMap } from './clipRules'

// At 120 BPM a beat is 0.5 s, so a 2-beat task cycle is 1 s.
const task: TaskMeta = { id: 'fire_cannon', kind: 'task', prompt: 'FIRE!', hint: 'SPACE', baseBeats: 2 }
const duration: DurationMeta = {
  id: 'dodge_kraken',
  kind: 'duration',
  prompt: 'DODGE!',
  hint: '← →',
  minDuration: 4,
  canBeatSync: true,
}

describe('repsFor', () => {
  it('fits whole task cycles into the clip', () => {
    expect(repsFor(task, 3, 120)).toBe(3)
  })

  it('rounds to the nearest whole cycle', () => {
    expect(repsFor(task, 3.4, 120)).toBe(3)
    expect(repsFor(task, 3.6, 120)).toBe(4)
  })

  it('fits more cycles into the same clip on a faster song', () => {
    expect(repsFor(task, 3, 240)).toBe(6)
  })

  it('always gives at least one rep', () => {
    expect(repsFor(task, 0.2, 120)).toBe(1)
  })

  it('is not thrown off by floating point error', () => {
    expect(repsFor({ ...task, baseBeats: 1 }, 1, 180)).toBe(3)
  })

  it('gives duration games a single rep', () => {
    expect(repsFor(duration, 10, 120)).toBe(1)
  })
})

describe('beat maps', () => {
  const cannon: TaskMeta = { ...task, defaultHits: [1] } // press on the 2nd beat of each 2-beat cycle
  const kraken: DurationMeta = { ...duration, defaultHits: [0, 2] } // slams on beats 1 and 3 of each bar
  const clip = (extra: Partial<GameClip> = {}): GameClip => ({
    type: 'game',
    gameId: 'x',
    start: 10,
    end: 14,
    difficulty: 1,
    ...extra,
  })

  it('repeats the default pattern each cycle', () => {
    expect(defaultHits(cannon, 4, 120)).toEqual([1, 3, 5, 7]) // 4 s at 120 BPM = 8 beats = 4 cycles
  })

  it('repeats a duration game pattern each bar', () => {
    expect(defaultHits(kraken, 4, 120)).toEqual([0, 2, 4, 6])
  })

  it('turns a custom beat map into song times', () => {
    expect(hitTimes(cannon, clip({ hits: [1, 1.5, 3] }), 120)).toEqual([10.5, 10.75, 11.5])
  })

  it('drops hits past the end of a shortened clip', () => {
    expect(hitTimes(cannon, clip({ hits: [1, 9] }), 120)).toEqual([10.5])
  })

  it('only gives duration games a beat map when beat sync is on', () => {
    expect(usesBeatMap(kraken, clip())).toBe(false)
    expect(usesBeatMap(kraken, clip({ beatSync: true }))).toBe(true)
    expect(hitTimes(kraken, clip(), 120)).toBeNull()
  })

  it('gives games without default hits no beat map', () => {
    expect(hitTimes(task, clip(), 120)).toBeNull()
  })
})
