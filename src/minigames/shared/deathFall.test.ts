import { describe, expect, it } from 'vitest'
import { DEATH_FREEZE, DEATH_RISE, deathLift } from './deathFall'

describe('deathLift', () => {
  it('stays put during the freeze', () => {
    expect(deathLift(0)).toBe(0)
    expect(deathLift(DEATH_FREEZE)).toBe(0)
  })

  it('jumps up to its peak, then falls off below where it started', () => {
    expect(deathLift(DEATH_FREEZE + 0.35)).toBeCloseTo(DEATH_RISE)
    expect(deathLift(DEATH_FREEZE + 0.7)).toBeCloseTo(0)
    expect(deathLift(DEATH_FREEZE + 1.5)).toBeLessThan(-1) // well off the bottom of the screen
  })
})
