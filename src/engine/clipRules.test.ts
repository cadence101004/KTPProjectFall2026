import { describe, expect, it } from 'vitest'
import type { DurationMeta, TaskMeta } from '../types/minigame'
import { repsFor } from './clipRules'

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
