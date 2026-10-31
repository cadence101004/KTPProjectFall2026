import { describe, expect, it } from 'vitest'
import { gradeFor, judgePress, tooManyMisses } from './judgePress'

describe('tooManyMisses', () => {
  it('fails at a quarter or more of the hits missed', () => {
    expect(tooManyMisses(1, 8)).toBe(false)
    expect(tooManyMisses(2, 8)).toBe(true)
    expect(tooManyMisses(1, 4)).toBe(true)
    expect(tooManyMisses(2, 12)).toBe(false)
    expect(tooManyMisses(3, 12)).toBe(true)
  })

  it('never fails with no misses or no hits', () => {
    expect(tooManyMisses(0, 8)).toBe(false)
    expect(tooManyMisses(0, 0)).toBe(false)
  })
})

// Hits at 11 s and 12 s, in a clip that starts at 10 s.
const hits = [11, 12]

describe('gradeFor', () => {
  it('grades by distance from the beat', () => {
    expect(gradeFor(0.01)).toBe('perfect')
    expect(gradeFor(0.06)).toBe('great')
    expect(gradeFor(0.12)).toBe('good')
    expect(gradeFor(0.2)).toBeNull()
  })

  it('is exactly as forgiving early as late', () => {
    for (const offset of [0.02, 0.05, 0.1, 0.15, 0.17]) expect(gradeFor(-offset)).toBe(gradeFor(offset))
  })

  it('shrinks every window with the scale', () => {
    expect(gradeFor(0.12, 0.65)).toBeNull() // good at full size, a miss at difficulty 3
    expect(gradeFor(0.03, 0.65)).toBe('great')
  })
})

describe('judgePress', () => {
  it('grades a press inside the window and reports how far off it was', () => {
    expect(judgePress(hits, 0, 11.01, 10)).toEqual({ result: 'hit', grade: 'perfect', offset: expect.closeTo(0.01) })
    expect(judgePress(hits, 0, 10.85, 10).grade).toBe('good')
    expect(judgePress(hits, 0, 11.15, 10).grade).toBe('good')
  })

  it('fails a press just before the window', () => {
    expect(judgePress(hits, 0, 10.7, 10).result).toBe('early')
  })

  it('fails a press after the window', () => {
    expect(judgePress(hits, 0, 11.3, 10).result).toBe('late')
  })

  it('ignores a press well before the run-up, like a double tap after the last hit', () => {
    expect(judgePress(hits, 1, 11.2, 10).result).toBe('ignore') // just after hit 1, long before hit 2
    expect(judgePress(hits, 1, 11.6, 10).result).toBe('early') // past halfway to hit 2
  })

  it('ignores presses once every hit is done', () => {
    expect(judgePress(hits, 2, 12.5, 10).result).toBe('ignore')
  })
})
