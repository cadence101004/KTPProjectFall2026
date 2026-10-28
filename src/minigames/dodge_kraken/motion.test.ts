import { describe, expect, it } from 'vitest'
import { DEATH_FREEZE, DEATH_RISE, deathLift, HOP_HEIGHT, HOP_TIME, hopLift, hopProgress } from './motion'

describe('hopProgress', () => {
  it('runs from 0 to 1 over the hop', () => {
    expect(hopProgress(10, 10)).toBe(0)
    expect(hopProgress(10 + HOP_TIME / 2, 10)).toBeCloseTo(0.5)
    expect(hopProgress(10 + HOP_TIME, 10)).toBeCloseTo(1)
    expect(hopProgress(11, 10)).toBe(1) // long after landing
  })

  it('reads as landed when no hop has happened', () => {
    expect(hopProgress(10, -Infinity)).toBe(1)
  })
})

describe('hopLift', () => {
  it('arcs up and back down', () => {
    expect(hopLift(0)).toBeCloseTo(0)
    expect(hopLift(0.5)).toBeCloseTo(HOP_HEIGHT)
    expect(hopLift(1)).toBeCloseTo(0)
  })
})

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
