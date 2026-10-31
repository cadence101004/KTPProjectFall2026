import { describe, expect, it } from 'vitest'
import { HOP_HEIGHT, HOP_TIME, hopLift, hopProgress } from './motion'

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
