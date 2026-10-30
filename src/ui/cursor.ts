import { findHookTip } from './hookTip'

// The pirate hook cursors (art by Cadence, in public/assets/sprites/mousecursor/). The images are too big
// for browser cursors (which top out around 128 px), so each one is shrunk on a canvas when the page loads
// and handed to CSS as a data URL, with its click point on the hook's tip. style.css uses the variables.

const FOLDER = '/assets/sprites/mousecursor'
const SCALE = 0.28 // every hook is shrunk by the same amount, so the hook stays the same size between states

// Cursor state -> image, and the system cursor to fall back on while it loads or if it fails.
const CURSORS = {
  default: { file: 'hook', fallback: 'auto' },
  hover: { file: 'hoverhook', fallback: 'pointer' }, // over anything clickable
  press: { file: 'presshook', fallback: 'pointer' }, // mouse button down
  drag: { file: 'draghook', fallback: 'grabbing' }, // dragging
  wait: { file: 'hourglass', fallback: 'wait' }, // loading
}

const DRAG_DISTANCE = 4 // pixels the mouse must move while held before it counts as a drag

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

// Turns one image into a CSS cursor value: `url(data:...) x y, fallback`.
async function makeCursor(file: string, fallback: string, centerHotspot: boolean): Promise<string> {
  const image = await loadImage(`${FOLDER}/${file}.png`)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * SCALE))
  canvas.height = Math.max(1, Math.round(image.height * SCALE))
  const context = canvas.getContext('2d')!
  context.imageSmoothingEnabled = false // keep the pixel art crisp
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const tip = centerHotspot
    ? { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) }
    : findHookTip(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)
  return `url(${canvas.toDataURL()}) ${tip.x} ${tip.y}, ${fallback}`
}

// A burst of sparkles where the mouse is pressed. Purely decoration, so CSS animates it.
function sparkle(event: PointerEvent): void {
  const burst = document.createElement('img')
  burst.src = `${FOLDER}/glowythings.png`
  burst.className = 'click-sparkle'
  burst.style.left = `${event.clientX}px`
  burst.style.top = `${event.clientY}px`
  burst.addEventListener('animationend', () => burst.remove())
  document.body.append(burst)
}

// Sets up the pirate cursors on this page. Call once from each page's entry point.
export async function installPirateCursor(): Promise<void> {
  const root = document.documentElement
  let pressedAt: { x: number; y: number } | null = null
  window.addEventListener('pointerdown', event => {
    pressedAt = { x: event.clientX, y: event.clientY }
    root.classList.add('pressing')
    sparkle(event)
  })
  window.addEventListener('pointermove', event => {
    if (pressedAt && Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y) > DRAG_DISTANCE) {
      root.classList.add('dragging')
    }
  })
  const release = () => {
    pressedAt = null
    root.classList.remove('pressing', 'dragging')
  }
  window.addEventListener('pointerup', release)
  window.addEventListener('pointercancel', release)

  await Promise.all(
    Object.entries(CURSORS).map(async ([state, { file, fallback }]) => {
      try {
        root.style.setProperty(`--cursor-${state}`, await makeCursor(file, fallback, state === 'wait'))
      } catch {
        // a missing image just leaves the system cursor in place
      }
    }),
  )
}

// Shows the hourglass while something loads, e.g. a song or a video.
export function setWaiting(on: boolean): void {
  document.documentElement.classList.toggle('waiting', on)
}
