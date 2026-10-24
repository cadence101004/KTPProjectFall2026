import type { GameButton, GameInput } from '../types/minigame'
import type { TimeSource } from './LevelRunner'

const KEY_BUTTONS: Record<string, GameButton> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'action',
  Enter: 'action',
}

// Which game button a keyboard key (KeyboardEvent.code) maps to, if any.
export function buttonForKey(code: string): GameButton | null {
  return KEY_BUTTONS[code] ?? null
}

// Sends key presses and releases as GameInputs stamped with song time. Returns a function that stops listening.
export function listenForKeys(clock: TimeSource, onInput: (input: GameInput) => void): () => void {
  const handler = (pressed: boolean) => (event: KeyboardEvent) => {
    if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    const button = buttonForKey(event.code)
    if (!button) return
    event.preventDefault() // stop Space and the arrows from scrolling the page
    onInput({ kind: 'button', button, pressed, songTime: clock.songTime() })
  }
  const onDown = handler(true)
  const onUp = handler(false)
  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  return () => {
    window.removeEventListener('keydown', onDown)
    window.removeEventListener('keyup', onUp)
  }
}
