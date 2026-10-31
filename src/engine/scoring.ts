import type { HitGrade } from '../types/minigame'

// Score and rank for one play of a level, osu-style: every hit earns points by its grade, and accuracy is
// the share of the best possible score. Minigames without hits (survival games, scrubbing) count as one
// item each: a perfect if cleared, a miss if failed.

export const POINTS: Record<HitGrade, number> = { perfect: 300, great: 200, good: 100, miss: 0 }
const BEST = POINTS.perfect

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D'

export interface ScoreSheet {
  grades: Record<HitGrade, number> // hits by grade, from rhythm minigames
  noHitGames: number // minigames scored as a whole (won or failed) because they have no hits
  clears: number // ...and how many of those were won
  games: number // minigames played to their end
  fails: number // minigames failed, of any kind
}

export function newSheet(): ScoreSheet {
  return { grades: { perfect: 0, great: 0, good: 0, miss: 0 }, noHitGames: 0, clears: 0, games: 0, fails: 0 }
}

// One hit, as reported by a minigame while it runs.
export function addGrade(sheet: ScoreSheet, grade: HitGrade): void {
  sheet.grades[grade]++
}

// Scores a finished minigame clip. `reported` is how many hits the game reported; `hitCount` is how many
// its beat map had. A game that reported hits but failed partway has its unplayed hits counted as misses,
// so failing early can't protect accuracy. A game that reported none is scored as a whole.
export function scoreClip(sheet: ScoreSheet, won: boolean, reported: number, hitCount: number): void {
  sheet.games++
  if (!won) sheet.fails++
  if (reported > 0) {
    sheet.grades.miss += Math.max(0, hitCount - reported)
  } else {
    sheet.noHitGames++
    if (won) sheet.clears++
  }
}

export function scoreOf(sheet: ScoreSheet): number {
  const fromHits = (Object.keys(POINTS) as HitGrade[]).reduce((sum, grade) => sum + sheet.grades[grade] * POINTS[grade], 0)
  return fromHits + sheet.clears * BEST
}

// Share of the best possible score so far, from 0 to 1. 1 before anything has been scored.
export function accuracyOf(sheet: ScoreSheet): number {
  const { perfect, great, good, miss } = sheet.grades
  const items = perfect + great + good + miss + sheet.noHitGames
  return items === 0 ? 1 : scoreOf(sheet) / (items * BEST)
}

// S needs 95% accuracy and no minigame failed; then A, B, and C at 90%, 80%, and 70%; D below that.
export function rankOf(sheet: ScoreSheet): Rank {
  const accuracy = accuracyOf(sheet)
  if (accuracy >= 0.95 && sheet.fails === 0) return 'S'
  if (accuracy >= 0.9) return 'A'
  if (accuracy >= 0.8) return 'B'
  if (accuracy >= 0.7) return 'C'
  return 'D'
}
