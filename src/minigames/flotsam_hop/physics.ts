// Pure platforming logic for Flotsam Hop: how the rafts and barrels move, when rafts sink, and how the
// pirate runs, jumps, falls, and lands. No Phaser in here, so it can be tested with plain Vitest.
// Units: x is 0..1 across the screen, y is 0..1 down it (feet and platform tops), and speeds are in screen
// heights per second, with x stretched by the aspect ratio so moving feels the same in every direction.
// Everything runs on song time, per the game's core rule.

export const GRAVITY = 3.2 // screen heights per second squared
export const JUMP_SPEED = 1.35 // upward speed at the start of a jump (peaks about 0.28 screen heights up)
export const RUN_SPEED = 0.6 // screen heights per second, sideways
export const SEA_Y = 0.86 // the water line: feet below it means she fell in
export const DRIFT_SPEED = 0.12 // how fast barrels drift right to left, in screen widths per second
export const WARN_BEATS = 1 // a raft shakes this long before it sinks
export const SUNK_BEATS = 1.5 // and stays under this long
const MIN_WARN = 0.5 // a sink with less warning than this (right at the clip start) is left out

// One raft: it bobs up and down (and maybe slides side to side) in loops measured in beats.
export interface Raft {
  x: number // center when still
  y: number // top when still
  width: number
  bobBeats: number // beats per bob up and down
  bob: number // how far it bobs, in screen heights
  slideBeats: number // beats per slide side to side
  slide: number // how far it slides, in screen widths (0 for none)
  phase: number // 0..1, so the rafts don't all move together
}

export interface Platform {
  x: number // center
  y: number // top
  width: number
  solid: boolean // false while a raft is sunk (and can't be stood on)
}

export interface Body {
  x: number
  y: number // feet
  vy: number // up is negative
  on: number // index of the platform she's standing on, or -1 in the air
}

// Where a raft is at `songTime`: loops of its bob and slide, timed in beats.
export function raftAt(raft: Raft, songTime: number, beatLength: number): { x: number; y: number } {
  const wave = (beats: number) => Math.sin(2 * Math.PI * (songTime / (beats * beatLength) + raft.phase))
  return { x: raft.x + (raft.slide ? wave(raft.slideBeats) * raft.slide : 0), y: raft.y + wave(raft.bobBeats) * raft.bob }
}

// Where a barrel that set off from the right edge at `launchedAt` is: drifting left at DRIFT_SPEED.
export function barrelX(launchedAt: number, songTime: number): number {
  return 1.1 - (songTime - launchedAt) * DRIFT_SPEED
}

// When a raft sinks (song times). Beat sync on: one per beat map hit. Off: random gaps through the clip.
export function sinkTimes(hits: number[] | null, clipStart: number, duration: number, beatLength: number, random: () => number): number[] {
  const earliest = clipStart + Math.max(MIN_WARN, WARN_BEATS * beatLength)
  if (hits) return hits.filter(hit => hit >= earliest - 1e-6)
  const times: number[] = []
  for (let at = earliest + 0.5; at < clipStart + duration; at += 1.6 + random() * 1.2) times.push(at)
  return times
}

// What a sinking raft is doing: shaking during its warning, under water while sunk, otherwise normal.
export function sinkState(songTime: number, sinkAt: number, beatLength: number): 'normal' | 'warning' | 'sunk' {
  if (songTime >= sinkAt - WARN_BEATS * beatLength && songTime < sinkAt) return 'warning'
  if (songTime >= sinkAt && songTime < sinkAt + SUNK_BEATS * beatLength) return 'sunk'
  return 'normal'
}

// Whether x is over a platform (within its width).
function over(x: number, platform: Platform): boolean {
  return Math.abs(x - platform.x) <= platform.width / 2
}

// One step of the pirate's movement, `dt` seconds long. `before` and `after` are every platform's position at
// the start and end of the step. Standing on a platform carries her along with it; walking off its edge, or
// it sinking, drops her. Falling, she lands on any solid platform whose top she passes down through.
export function step(body: Body, run: number, jump: boolean, dt: number, before: Platform[], after: Platform[], aspect: number): Body {
  let { x, y, vy, on } = body
  x = Math.min(0.98, Math.max(0.02, x + (run * RUN_SPEED * dt) / aspect))

  if (on >= 0) {
    const standing = after[on]
    if (standing.solid && over(x, standing)) {
      x += standing.x - before[on].x // carried along
      y = standing.y
      if (!jump) return { x, y, vy: 0, on }
      vy = -JUMP_SPEED
    }
    on = -1 // jumped, walked off the edge, or the raft sank
  }

  const lastY = y
  vy += GRAVITY * dt
  y += vy * dt
  if (vy > 0) {
    // Falling: land on a solid platform whose top she just passed down through.
    const landing = after.findIndex((p, i) => p.solid && over(x, p) && lastY <= Math.max(before[i].y, p.y) + 1e-6 && y >= p.y)
    if (landing >= 0) return { x, y: after[landing].y, vy: 0, on: landing }
  }
  return { x, y, vy, on }
}
