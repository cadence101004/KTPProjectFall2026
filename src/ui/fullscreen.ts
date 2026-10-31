// Fullscreen for the game view. Phaser's FIT scaling notices the bigger stage and scales the game up to fill
// it, centered. The browser's own Esc leaves fullscreen.

// Puts `element` into fullscreen, or leaves fullscreen if something already is.
export function toggleFullscreen(element: HTMLElement): void {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void element.requestFullscreen().catch(() => undefined) // e.g. refused outside a click or key press
}

// Wires a button (and the F key) to toggle fullscreen for `element`, and keeps the button's label in step.
// The button gives up focus after a click, so Space goes to the game instead of pressing it again.
export function fullscreenButton(button: HTMLButtonElement, element: HTMLElement): void {
  button.addEventListener('click', () => {
    button.blur()
    toggleFullscreen(element)
  })
  window.addEventListener('keydown', event => {
    if (event.code !== 'KeyF' || event.repeat || event.ctrlKey || event.metaKey) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
    toggleFullscreen(element)
  })
  document.addEventListener('fullscreenchange', () => {
    button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'
  })
}
