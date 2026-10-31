import { describe, expect, it } from 'vitest'
import { barrelX, type Body, GRAVITY, JUMP_SPEED, type Platform, raftAt, sinkState, sinkTimes, step } from './physics'

const beat = 0.5 // 120 BPM
const flat = (x: number, y: number, width = 0.2, solid = true): Platform => ({ x, y, width, solid })
const standing = (x: number, y: number, on: number): Body => ({ x, y, vy: 0, on })

describe('raftAt', () => {
  const raft = { x: 0.5, y: 0.6, width: 0.2, bobBeats: 2, bob: 0.05, slideBeats: 4, slide: 0.1, phase: 0 }

  it('bobs on the beat: a quarter of the way through its bob loop it is fully down', () => {
    expect(raftAt(raft, 0, beat).y).toBeCloseTo(0.6)
    expect(raftAt(raft, 0.25, beat).y).toBeCloseTo(0.65) // 2-beat loop = 1 s, so 0.25 s in is the low point
  })

  it('slides side to side on its own loop', () => {
    expect(raftAt(raft, 0.5, beat).x).toBeCloseTo(0.6) // 4-beat loop = 2 s, quarter way = full slide
  })
})

describe('barrelX', () => {
  it('drifts in from the right edge', () => {
    expect(barrelX(10, 10)).toBeCloseTo(1.1)
    expect(barrelX(10, 15)).toBeCloseTo(0.5)
  })
})

describe('sinkTimes and sinkState', () => {
  it('sinks on beat map hits, leaving out any with too little warning', () => {
    expect(sinkTimes([10.2, 11, 12], 10, 4, beat, () => 0.5)).toEqual([11, 12])
  })

  it('shakes for a beat, then stays under for a beat and a half', () => {
    expect(sinkState(10.6, 11, beat)).toBe('warning')
    expect(sinkState(11.2, 11, beat)).toBe('sunk')
    expect(sinkState(11.8, 11, beat)).toBe('normal')
  })
})

describe('step', () => {
  const aspect = 16 / 9
  const dt = 1 / 120

  it('stays put standing still on a platform', () => {
    const rafts = [flat(0.5, 0.6)]
    expect(step(standing(0.5, 0.6, 0), 0, false, dt, rafts, rafts, aspect)).toEqual(standing(0.5, 0.6, 0))
  })

  it('is carried along by a moving platform', () => {
    const body = step(standing(0.5, 0.6, 0), 0, false, dt, [flat(0.5, 0.6)], [flat(0.52, 0.62)], aspect)
    expect(body.x).toBeCloseTo(0.52)
    expect(body.y).toBeCloseTo(0.62)
    expect(body.on).toBe(0)
  })

  it('jumps off a platform with upward speed', () => {
    const rafts = [flat(0.5, 0.6)]
    const body = step(standing(0.5, 0.6, 0), 0, true, dt, rafts, rafts, aspect)
    expect(body.on).toBe(-1)
    expect(body.vy).toBeCloseTo(-JUMP_SPEED + GRAVITY * dt)
  })

  it('drops when the platform sinks under her', () => {
    const body = step(standing(0.5, 0.6, 0), 0, false, dt, [flat(0.5, 0.6)], [flat(0.5, 0.6, 0.2, false)], aspect)
    expect(body.on).toBe(-1)
  })

  it('lands on a platform it falls onto', () => {
    const rafts = [flat(0.5, 0.6)]
    const body = step({ x: 0.5, y: 0.595, vy: 1, on: -1 }, 0, false, dt, rafts, rafts, aspect)
    expect(body).toEqual(standing(0.5, 0.6, 0))
  })

  it('falls past a platform it is not over', () => {
    const rafts = [flat(0.2, 0.6)]
    const body = step({ x: 0.5, y: 0.595, vy: 1, on: -1 }, 0, false, dt, rafts, rafts, aspect)
    expect(body.on).toBe(-1)
    expect(body.y).toBeGreaterThan(0.6)
  })
})
