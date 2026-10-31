import { describe, expect, it } from 'vitest'
import { arrowShowing, callTimes, groupOf, pickArrows } from './calls'

// 120 BPM: a beat is 0.5 s, so the parrot calls 2 s before each answer. The clip starts at 10 s.
const beat = 0.5

describe('callTimes', () => {
  it('calls each arrow four beats before its answer', () => {
    expect(callTimes([12, 12.5, 13, 13.5], 10, beat)).toEqual([10, 10.5, 11, 11.5])
  })

  it('never calls before the clip starts', () => {
    expect(callTimes([11], 10, beat)).toEqual([10])
  })
})

describe('pickArrows', () => {
  it('picks one valid arrow per answer', () => {
    const arrows = pickArrows(20, () => 0.99)
    expect(arrows).toHaveLength(20)
    expect(arrows.every(arrow => ['up', 'down', 'left', 'right'].includes(arrow))).toBe(true)
  })
})

describe('groupOf', () => {
  it('puts each hit in its 8-beat cycle', () => {
    expect(groupOf(12, 10, 4)).toBe(0)
    expect(groupOf(13.5, 10, 4)).toBe(0)
    expect(groupOf(14, 10, 4)).toBe(1)
  })
})

describe('arrowShowing', () => {
  it('stays until answered at difficulty 1', () => {
    expect(arrowShowing(9.9, 10, beat, 1)).toBe(false) // not called yet
    expect(arrowShowing(13, 10, beat, 1)).toBe(true)
  })

  it('vanishes a beat after the call from difficulty 2, so it has to be remembered', () => {
    expect(arrowShowing(10.2, 10, beat, 2)).toBe(true)
    expect(arrowShowing(10.6, 10, beat, 2)).toBe(false)
  })
})
