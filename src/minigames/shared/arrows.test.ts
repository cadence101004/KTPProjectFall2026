import { describe, expect, it } from 'vitest'
import { directionGrade } from './arrows'
import { judgePress } from './judgePress'

describe('directionGrade', () => {
  const hits = [11]

  it('grades the right arrow on time', () => {
    expect(directionGrade(judgePress(hits, 0, 11.01, 10), 'up', 'up')).toBe('perfect')
  })

  it('misses with the wrong arrow, even on time', () => {
    expect(directionGrade(judgePress(hits, 0, 11.01, 10), 'down', 'up')).toBe('miss')
  })

  it('misses an early or late press', () => {
    expect(directionGrade(judgePress(hits, 0, 10.7, 10), 'up', 'up')).toBe('miss')
    expect(directionGrade(judgePress(hits, 0, 11.3, 10), 'up', 'up')).toBe('miss')
  })

  it('ignores a press long before the next hit', () => {
    expect(directionGrade(judgePress([11, 12], 1, 11.2, 10), 'up', 'up')).toBeNull()
  })
})
