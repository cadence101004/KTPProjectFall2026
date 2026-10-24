import { describe, expect, it } from 'vitest'
import { judgePress } from './judgePress'

// Hits at 11 s and 12 s, in a clip that starts at 10 s.
const hits = [11, 12]

describe('judgePress', () => {
  it('counts a press inside the window, a little early or late', () => {
    expect(judgePress(hits, 0, 11, 10)).toBe('hit')
    expect(judgePress(hits, 0, 10.85, 10)).toBe('hit')
    expect(judgePress(hits, 0, 11.15, 10)).toBe('hit')
  })

  it('fails a press just before the window', () => {
    expect(judgePress(hits, 0, 10.7, 10)).toBe('early')
  })

  it('fails a press after the window', () => {
    expect(judgePress(hits, 0, 11.3, 10)).toBe('late')
  })

  it('ignores a press well before the run-up, like a double tap after the last hit', () => {
    expect(judgePress(hits, 1, 11.2, 10)).toBe('ignore') // just after hit 1, long before hit 2
    expect(judgePress(hits, 1, 11.6, 10)).toBe('early') // past halfway to hit 2
  })

  it('ignores presses once every hit is done', () => {
    expect(judgePress(hits, 2, 12.5, 10)).toBe('ignore')
  })
})
