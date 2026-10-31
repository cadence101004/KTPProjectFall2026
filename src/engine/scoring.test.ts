import { describe, expect, it } from 'vitest'
import { accuracyOf, addGrade, newSheet, rankOf, scoreClip, scoreOf } from './scoring'

describe('scoring', () => {
  it('scores hits by grade', () => {
    const sheet = newSheet()
    for (const grade of ['perfect', 'great', 'good', 'miss'] as const) addGrade(sheet, grade)
    expect(scoreOf(sheet)).toBe(600)
    expect(accuracyOf(sheet)).toBeCloseTo(0.5) // 600 of a possible 1200
  })

  it('scores a game without hits as one perfect if won, a miss if failed', () => {
    const sheet = newSheet()
    scoreClip(sheet, true, 0, 0)
    scoreClip(sheet, false, 0, 0)
    expect(scoreOf(sheet)).toBe(300)
    expect(accuracyOf(sheet)).toBeCloseTo(0.5)
    expect(sheet.fails).toBe(1)
  })

  it('counts the unplayed hits of a failed rhythm game as misses', () => {
    const sheet = newSheet()
    addGrade(sheet, 'perfect')
    addGrade(sheet, 'miss')
    scoreClip(sheet, false, 2, 4) // failed after 2 of 4 hits
    expect(sheet.grades.miss).toBe(3)
    expect(accuracyOf(sheet)).toBeCloseTo(0.25)
  })

  it('starts at full accuracy with nothing scored', () => {
    expect(accuracyOf(newSheet())).toBe(1)
  })
})

describe('rankOf', () => {
  const sheetWith = (perfect: number, good: number, failed = false) => {
    const sheet = newSheet()
    for (let i = 0; i < perfect; i++) addGrade(sheet, 'perfect')
    for (let i = 0; i < good; i++) addGrade(sheet, 'good')
    scoreClip(sheet, !failed, perfect + good, perfect + good)
    return sheet
  }

  it('ranks by accuracy', () => {
    expect(rankOf(sheetWith(20, 0))).toBe('S') // 100%
    expect(rankOf(sheetWith(17, 2))).toBe('A') // 93%
    expect(rankOf(sheetWith(7, 2))).toBe('B') // 85%
    expect(rankOf(sheetWith(5, 3))).toBe('C') // 75%
    expect(rankOf(sheetWith(1, 3))).toBe('D') // 50%
  })

  it('keeps S for runs with no minigame failed', () => {
    expect(rankOf(sheetWith(20, 0, true))).toBe('A')
  })
})
