// The player's timing settings, set on the Timing Calibration page and saved in this browser.
// Storage can be unavailable (e.g. private windows), so every read and write falls back quietly.

const LATENCY_KEY = 'pirateware.latencyMs'
const SHOW_OFFSETS_KEY = 'pirateware.showOffsets'
export const MAX_LATENCY_MS = 300 // the calibration slider runs from -300 to +300

// How late (in ms) the player hears the music compared to the game's clock. The whole game runs this much
// later so the beats line up with what they hear (see AudioClock.songTime). 0 until calibrated.
export function loadLatencyMs(): number {
  try {
    const value = Number(localStorage.getItem(LATENCY_KEY))
    return Number.isFinite(value) ? Math.max(-MAX_LATENCY_MS, Math.min(MAX_LATENCY_MS, value)) : 0
  } catch {
    return 0
  }
}

export function saveLatencyMs(ms: number): void {
  try {
    localStorage.setItem(LATENCY_KEY, String(Math.round(ms)))
  } catch {
    // not saved; the game keeps using the old value
  }
}

// Whether hit judgements in game also show how many ms early or late the press was (a debugging aid).
export function loadShowOffsets(): boolean {
  try {
    return localStorage.getItem(SHOW_OFFSETS_KEY) === 'true'
  } catch {
    return false
  }
}

export function saveShowOffsets(on: boolean): void {
  try {
    localStorage.setItem(SHOW_OFFSETS_KEY, String(on))
  } catch {
    // not saved
  }
}
