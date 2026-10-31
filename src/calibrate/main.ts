import '../style.css'
import './calibrate.css'
import { GRADE_WINDOWS, gradeFor } from '../minigames/shared/judgePress'
import { MetronomeClock } from '../sandbox/MetronomeClock'
import { loadLatencyMs, loadShowOffsets, MAX_LATENCY_MS, saveLatencyMs, saveShowOffsets } from '../settings/timing'
import { installPirateCursor } from '../ui/cursor'
import { beatsInView, median, offsetToBeat } from './offsets'

// Timing Calibration: a metronome clicks, the player taps along, and each tap shows how early or late it
// was. The typical offset (the median) becomes the game's latency setting, so the game runs that much later
// to match what the player actually hears.
//
// Two charts: the main one shows raw taps against the click (what the offset is measured from); the thin one
// shows the same taps with the current offset applied (how the game would judge them). The beat visualizer
// slides notes toward a hit line, shifted by the current offset, so with a good offset each note crosses the
// line as its click is heard. It can be turned off to calibrate by ear alone, since seeing notes can pull
// taps toward the picture instead of the sound.

const BPM = 100
const BEAT = 60 / BPM
const CHART_MS = 250 // both charts run from -250 ms to +250 ms
const KEEP_TAPS = 24 // taps shown on the charts and used for the median
const LOOKAHEAD = 2 // seconds of upcoming notes shown on the visualizer
const LOOKBEHIND = 0.4 // seconds a note stays visible after passing the hit line
const HIT_LINE = 0.15 // where the hit line sits, as a fraction of the visualizer's width

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="calibrate">
    <header>
      <a href="/" class="home-link">&larr; Home</a>
      <h1>Timing calibration</h1>
      <p>Press <b>Start</b>, then tap <b>Space</b> (or click the pad) on every click you hear. Use the speakers
        or headphones you'll play with. After a dozen or so taps, press <b>Apply</b>.</p>
    </header>

    <div class="controls">
      <button id="start">Start</button>
      <span id="tapCount">0 taps</span>
      <label title="Turn off to calibrate by ear alone"><input id="showLane" type="checkbox" checked /> Show beat visualizer</label>
    </div>

    <canvas id="lane" class="lane"></canvas>

    <button id="pad" class="pad" disabled>
      <span id="last" class="last">Tap along with the clicks</span>
      <span id="grade" class="grade"></span>
    </button>

    <div class="chart-label">Your taps vs the click</div>
    <div class="chart" id="chart">
      <div class="zone good"></div><div class="zone great"></div><div class="zone perfect"></div>
      <div class="center"></div>
      <span class="edge left">early</span><span class="edge right">late</span>
    </div>
    <div class="chart-label">After your game offset (how the game judges them)</div>
    <div class="chart thin" id="adjusted">
      <div class="zone good"></div><div class="zone great"></div><div class="zone perfect"></div>
      <div class="center"></div>
    </div>

    <div class="result">
      <div>Your typical offset: <b id="median">no taps yet</b></div>
      <button id="apply" disabled>Apply as game offset</button>
    </div>

    <section class="settings">
      <label>Game offset <input id="offset" type="range" min="${-MAX_LATENCY_MS}" max="${MAX_LATENCY_MS}" step="1" />
        <b id="offsetValue"></b></label>
      <button id="reset">Reset to 0</button>
      <label><input id="showMs" type="checkbox" /> Show ms early/late under hit grades in game</label>
      <p class="help">Positive means you hear the music late (common with Bluetooth headphones), so the game waits
        for you. The grade under each tap, and the thin bar, are what the game would give with your current offset.
        A good offset puts the thin bar's dots on its center line.</p>
    </section>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!
const clock = new MetronomeClock(0) // measure raw: no offset applied while calibrating
const taps: number[] = [] // offsets from the nearest click, in seconds, newest last
const tapTimes: number[] = [] // when each recent tap happened (raw clock), for the visualizer's tap marks
let running = false

const ms = (seconds: number) => `${seconds >= 0 ? '+' : ''}${Math.round(seconds * 1000)} ms`
const latency = () => loadLatencyMs() / 1000

// Shades both charts' perfect, great, and good zones from the same windows the game judges with.
function drawZones(): void {
  for (const [zone, seconds] of Object.entries(GRADE_WINDOWS)) {
    for (const element of app.querySelectorAll<HTMLElement>(`.zone.${zone}`)) {
      const width = ((seconds * 1000) / CHART_MS) * 50 // percent of the chart, each side of center
      element.style.left = `${50 - width}%`
      element.style.width = `${width * 2}%`
    }
  }
}

// Puts one dot per tap on a chart, at `shift` seconds from each tap's raw offset. The newest is highlighted.
function drawDots(chart: HTMLElement, shift: number): void {
  chart.querySelectorAll('.dot').forEach(dot => dot.remove())
  taps.forEach((value, i) => {
    const dot = document.createElement('div')
    dot.className = i === taps.length - 1 ? 'dot latest' : 'dot'
    const shifted = (value - shift) * 1000
    dot.style.left = `${50 + (Math.max(-CHART_MS, Math.min(CHART_MS, shifted)) / CHART_MS) * 50}%`
    chart.append(dot)
  })
}

// Both charts: raw taps on the main one, the same taps after the game offset on the thin one.
function drawCharts(): void {
  drawDots($('chart'), 0)
  drawDots($('adjusted'), latency())
}

function showOffsetSetting(): void {
  const value = loadLatencyMs()
  $<HTMLInputElement>('offset').value = String(value)
  $('offsetValue').textContent = `${value >= 0 ? '+' : ''}${value} ms`
  drawCharts() // the thin bar moves with the offset
}

// One tap: measure it against the nearest click, then redraw the readout, charts, and median.
function tap(): void {
  if (!running) return
  const time = clock.songTime()
  const offset = offsetToBeat(time, BEAT)
  taps.push(offset)
  tapTimes.push(time)
  if (taps.length > KEEP_TAPS) taps.shift()
  if (tapTimes.length > 8) tapTimes.shift()

  $('last').textContent = `${ms(offset)} ${offset < 0 ? 'early' : 'late'}`
  const inGame = gradeFor(offset - latency())
  $('grade').textContent = inGame ? inGame.toUpperCase() : 'MISS'
  $('grade').className = `grade ${inGame ?? 'miss'}`

  drawCharts()
  $('tapCount').textContent = `${taps.length} tap${taps.length === 1 ? '' : 's'}`
  $('median').textContent = ms(median(taps))
  $<HTMLButtonElement>('apply').disabled = taps.length < 4
}

// The beat visualizer: notes slide right to left and cross the hit line on their beat, shifted by the game
// offset so they line up with what's heard. Taps show as marks at the same shift, so a tap mark sitting on a
// note's crossing point means it was on time.
function drawLane(): void {
  const canvas = $<HTMLCanvasElement>('lane')
  const scale = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (canvas.width !== Math.round(width * scale)) canvas.width = Math.round(width * scale)
  if (canvas.height !== Math.round(height * scale)) canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')!
  context.setTransform(scale, 0, 0, scale, 0, 0)
  context.clearRect(0, 0, width, height)

  const hitX = width * HIT_LINE
  const pxPerSecond = (width - hitX) / LOOKAHEAD
  const now = clock.songTime() - latency() // what's being heard right now
  const xAt = (time: number) => hitX + (time - now) * pxPerSecond
  const mid = height / 2

  context.fillStyle = '#ffcc4d'
  context.fillRect(hitX - 1, 6, 2, height - 12) // the hit line
  if (!running) return

  for (const beat of beatsInView(now - LOOKBEHIND, now + LOOKAHEAD, BEAT)) {
    const x = xAt(beat * BEAT)
    const barStart = beat % 4 === 0
    context.globalAlpha = x < hitX ? Math.max(0, 1 - (hitX - x) / (LOOKBEHIND * pxPerSecond)) : 1 // fade once past
    context.fillStyle = barStart ? '#ffcc4d' : '#6fa8c9'
    context.beginPath()
    context.arc(x, mid, barStart ? 12 : 9, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
  context.fillStyle = '#f4e9d0'
  for (const tapAt of tapTimes) {
    const x = xAt(tapAt - latency())
    if (x >= 0 && x <= width) context.fillRect(x - 1.5, mid + 14, 3, 12) // a tick just under the lane
  }
}

async function toggle(): Promise<void> {
  ;(document.activeElement as HTMLElement | null)?.blur() // so Space taps instead of pressing the button
  if (running) {
    clock.stop()
    running = false
    $('start').textContent = 'Start'
    $<HTMLButtonElement>('pad').disabled = true
    return
  }
  tapTimes.length = 0 // the clock restarts at 0, so old tap marks no longer line up
  await clock.start(BPM)
  running = true
  $('start').textContent = 'Stop'
  $<HTMLButtonElement>('pad').disabled = false
}

function frame(): void {
  clock.scheduleClicks()
  if (!$('lane').hidden) drawLane()
  requestAnimationFrame(frame)
}

$('start').addEventListener('click', () => void toggle())
$('pad').addEventListener('pointerdown', tap)
window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.repeat) return
  event.preventDefault()
  tap()
})
$<HTMLInputElement>('showLane').addEventListener('change', event => {
  $('lane').hidden = !(event.target as HTMLInputElement).checked
})
$('apply').addEventListener('click', () => {
  saveLatencyMs(median(taps) * 1000)
  showOffsetSetting()
})
$<HTMLInputElement>('offset').addEventListener('input', event => {
  saveLatencyMs(Number((event.target as HTMLInputElement).value))
  showOffsetSetting()
})
$('reset').addEventListener('click', () => {
  saveLatencyMs(0)
  showOffsetSetting()
})
$<HTMLInputElement>('showMs').checked = loadShowOffsets()
$<HTMLInputElement>('showMs').addEventListener('change', event => {
  saveShowOffsets((event.target as HTMLInputElement).checked)
})

drawZones()
showOffsetSetting()
requestAnimationFrame(frame)
void installPirateCursor()
