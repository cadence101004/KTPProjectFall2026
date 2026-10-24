import '../style.css'
import './editor.css'
import { AudioClock } from '../audio/AudioClock'
import { computePeaks } from './peaks'
import { Timeline } from './Timeline'

// Timeline editor (build step 4). Step 4a: load a song, see its waveform, play and scrub on the audio clock.
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="editor">
    <h1>Timeline editor</h1>
    <div class="controls">
      <input type="file" id="song" accept="audio/*,video/mp4" />
      <button id="play" disabled>Play</button>
      <span class="time"><b id="time">0.00</b> / <span id="length">0.00</span> s</span>
      <label>Zoom <input id="zoom" type="range" min="10" max="400" value="50" /></label>
    </div>
    <p id="status">Pick a song to start a level.</p>
    <div id="waveform" class="waveform"></div>
    <p class="help">Click or drag the waveform to move the playhead. Space plays and pauses.</p>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!
const playButton = $<HTMLButtonElement>('play')

const clock = new AudioClock()
const timeline = new Timeline($('waveform'))
let songLength = 0
let playing = false
let playhead = 0 // song time while paused; while playing, the clock is the truth

function currentTime(): number {
  return playing ? clock.songTime() : playhead
}

async function play(): Promise<void> {
  playing = true
  playButton.textContent = 'Pause'
  await clock.play(playhead)
}

function pause(): void {
  playhead = Math.min(songLength, clock.songTime())
  clock.stop()
  playing = false
  playButton.textContent = 'Play'
}

function togglePlay(): void {
  if (songLength === 0) return
  if (playing) pause()
  else void play()
}

// Moves the playhead. If the song is playing it keeps playing from the new spot.
function seek(time: number): void {
  playhead = Math.max(0, Math.min(songLength, time))
  if (playing) void clock.play(playhead)
  timeline.setPlayhead(playhead)
}

function frame(): void {
  const time = currentTime()
  if (playing && time >= songLength) {
    pause()
    playhead = songLength
  }
  timeline.setPlayhead(Math.max(0, time))
  $('time').textContent = Math.max(0, time).toFixed(2)
  requestAnimationFrame(frame)
}

$<HTMLInputElement>('song').addEventListener('change', async event => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (playing) pause()
  $('status').textContent = `Loading ${file.name}...`
  try {
    await clock.load(file)
    const buffer = clock.getBuffer()!
    songLength = buffer.duration
    playhead = 0
    await timeline.show(computePeaks(buffer.getChannelData(0), buffer.sampleRate), songLength)
    $('length').textContent = songLength.toFixed(2)
    $('status').textContent = file.name
    playButton.disabled = false
  } catch {
    $('status').textContent = `Could not decode ${file.name}`
  }
})

playButton.addEventListener('click', togglePlay)
timeline.onSeek(seek)
$<HTMLInputElement>('zoom').addEventListener('input', event => {
  timeline.zoom(Number((event.target as HTMLInputElement).value))
})

window.addEventListener('keydown', event => {
  if (event.code !== 'Space' || event.target instanceof HTMLInputElement) return
  event.preventDefault()
  togglePlay()
})

requestAnimationFrame(frame)
