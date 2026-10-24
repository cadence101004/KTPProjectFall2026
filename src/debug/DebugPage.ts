import { AudioClock } from '../audio/AudioClock'
import { clipIndexAt, LevelRunner, type RunnerEvent } from '../engine/LevelRunner'
import { testLevel } from '../engine/testLevel'
import type { Clip } from '../types/level'

// Temporary build step 1 harness: load an MP3, play the test level, and check clip switches land on the beat.
export function mountDebugPage(root: HTMLElement): void {
  root.innerHTML = `
    <div class="debug">
      <h1>PirateWare debug</h1>
      <input type="file" id="song" accept="audio/*,video/mp4" />
      <p id="status">Pick a song to load.</p>
      <div class="controls">
        <button id="play" disabled>Play from start</button>
        <button id="pause" disabled>Pause</button>
      </div>
      <div class="readout">
        <div>Song time <b id="time">0.00</b> s</div>
        <div>Current <b id="current">none</b></div>
        <div>Next <b id="next">none</b></div>
      </div>
      <div id="flash" class="flash"></div>
      <ol id="log" class="log"></ol>
    </div>`

  const $ = <T extends HTMLElement>(id: string) => root.querySelector<T>('#' + id)!
  const songInput = $<HTMLInputElement>('song')
  const playButton = $<HTMLButtonElement>('play')
  const pauseButton = $<HTMLButtonElement>('pause')

  const clock = new AudioClock()
  const runner = new LevelRunner(testLevel, clock)
  const clips = testLevel.clips
  let running = false // false while paused or while play() is still starting, so update() never sees stale time

  const label = (clip: Clip | undefined) =>
    !clip ? 'none' : clip.type === 'game' ? clip.gameId : 'buffer'

  async function playFrom(time: number): Promise<void> {
    running = false
    await clock.play(time)
    runner.seek(time)
    running = true
    pauseButton.textContent = 'Pause'
  }

  function logEvent(event: RunnerEvent, time: number): void {
    const item = document.createElement('li')
    if (event.type === 'levelEnd') {
      item.textContent = `${time.toFixed(2)}s  LEVEL END`
    } else {
      const edge = event.type === 'clipStart' ? 'start' : 'end'
      const planned = event.type === 'clipStart' ? event.clip.start : event.clip.end
      item.textContent = `${time.toFixed(2)}s  ${edge} ${label(event.clip)} (planned ${planned.toFixed(2)}s)`
    }
    $('log').prepend(item)
  }

  function flash(text: string): void {
    const el = $('flash')
    el.textContent = text
    el.animate([{ opacity: 1, transform: 'scale(1.15)' }, { opacity: 0.25, transform: 'scale(1)' }], {
      duration: 400,
      fill: 'forwards',
    })
  }

  function frame(): void {
    const time = clock.songTime()
    if (running) {
      for (const event of runner.update()) {
        logEvent(event, time)
        if (event.type === 'clipStart') flash(label(event.clip).toUpperCase())
        if (event.type === 'levelEnd') flash('LEVEL END')
      }
    }
    $('time').textContent = time.toFixed(2)
    $('current').textContent = label(clips[clipIndexAt(clips, time)])
    $('next').textContent = label(clips.find(clip => clip.start > time))
    requestAnimationFrame(frame)
  }

  songInput.addEventListener('change', async () => {
    const file = songInput.files?.[0]
    if (!file) return
    $('status').textContent = `Loading ${file.name}...`
    try {
      await clock.load(file)
      $('status').textContent = `Loaded ${file.name}`
      playButton.disabled = false
      pauseButton.disabled = false
    } catch {
      $('status').textContent = `Could not decode ${file.name}`
    }
  })

  playButton.addEventListener('click', () => {
    $('log').replaceChildren()
    void playFrom(0)
  })

  pauseButton.addEventListener('click', () => {
    if (running) {
      running = false
      clock.stop()
      pauseButton.textContent = 'Resume'
    } else {
      void playFrom(clock.songTime())
    }
  })

  requestAnimationFrame(frame)
}
