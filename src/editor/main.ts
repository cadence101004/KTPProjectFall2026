import Phaser from 'phaser'
import '../style.css'
import './editor.css'
import { AudioClock } from '../audio/AudioClock'
import { hashFile } from '../audio/hash'
import { findOnsets } from '../audio/onsets'
import { defaultHits, hitTimes, repsFor, usesBeatMap } from '../engine/clipRules'
import { countdownBeats } from '../engine/countdown'
import { listenForKeys } from '../engine/input'
import { LevelScene } from '../engine/LevelScene'
import { allGames, metaFor } from '../minigames/allGames'
import { listLevels, loadLevel, loadSong, saveLevel, saveSong } from '../storage/db'
import type { Clip, GameClip, Level } from '../types/level'
import type { MiniGameMeta } from '../types/minigame'
import { type BeatGrid, beatTimes, snapToGrid } from './beatGrid'
import { placeMove, placeResize, snapLength } from './clipEditing'
import { computePeaks } from './peaks'
import { previewStart } from './preview'
import { type ClipView, Timeline } from './Timeline'

// Timeline editor (build step 4). 4a: waveform, play, scrub. 4b: clips. 4c: beat grid. 4d: save and load.
// 4e: preview viewer, which runs the level in the real LevelScene.
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="editor">
    <h1>Timeline editor</h1>
    <div class="controls">
      <label>Level <input id="title" type="text" value="Untitled level" /></label>
      <button id="save" disabled>Save</button>
      <select id="levels"><option value="">Saved levels...</option></select>
      <button id="load">Load</button>
      <button id="new">New level</button>
    </div>
    <div class="controls">
      <input type="file" id="song" accept="audio/*,video/mp4" />
      <button id="play" disabled>Play</button>
      <button id="preview" disabled title="Play the level from the playhead in the gameplay view (P)">Preview</button>
      <span class="time"><b id="time">0.00</b> / <span id="length">0.00</span> s</span>
      <label>BPM <input id="bpm" type="number" min="40" max="300" step="0.01" value="120" /></label>
      <label>First beat (s) <input id="offset" type="number" min="0" step="0.01" value="0" /></label>
      <button id="setOffset" disabled title="Set the first beat to the playhead">Beat here</button>
      <label>Snap <select id="snap">
        <option value="0">Off</option>
        <option value="1" selected>Beat</option>
        <option value="2">1/2 beat</option>
        <option value="4">1/4 beat</option>
      </select></label>
      <label>Zoom <input id="zoom" type="range" min="10" max="400" value="50" /></label>
    </div>
    <p id="status">Pick a song to start a level, or load a saved one.</p>
    <div id="stage" class="stage"></div>
    <div id="waveform" class="waveform"></div>
    <div class="palette">
      <span>Add at playhead:</span>
      <button data-add="">Buffer</button>
      ${Object.keys(allGames).map(id => `<button data-add="${id}">${id}</button>`).join('')}
      <button id="delete" class="danger" disabled>Delete clip</button>
    </div>
    <p id="selection" class="selection">No clip selected.</p>
    <div id="clipOptions" class="clip-options"></div>
    <p class="help">Drag the yellow handle in the bar above the waveform to move the playhead (works mid-preview too),
      or click empty waveform. Space plays and pauses. Drag a clip to move it,
      drag its edges to resize. Delete removes the selected clip. Set BPM and the first beat so the grid lines
      land on the drums; clip edges then snap to the grid. Ctrl+S saves. Preview (P) plays the level as a player
      sees it, with the game controls live; Esc stops it.</p>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!
const playButton = $<HTMLButtonElement>('play')

const clock = new AudioClock()
const timeline = new Timeline($('waveform'))
const levelScene = new LevelScene(clock)

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'stage',
  width: 480,
  height: 270,
  backgroundColor: '#123047',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [levelScene],
})

// Loads the 321GO sound and finds its four counts so the countdown can line them up with the beat.
async function loadCountdown(): Promise<void> {
  try {
    const buffer = await clock.loadSfx('/assets/audio/321GO_sfx.mp3')
    const beats = countdownBeats(findOnsets(buffer.getChannelData(0), buffer.sampleRate), buffer.duration)
    console.info('321GO counts found at', beats.map(b => b.toFixed(2)).join(', '), 's into the file')
    levelScene.setCountdownSound({ buffer, beats })
  } catch {
    console.warn('Could not load the 321GO sound; buffers will play without a countdown.')
  }
}
void loadCountdown()

function newLevel(audioHash = ''): Level {
  return { title: 'Untitled level', audioHash, bpm: 120, beatOffset: 0, clips: [], media: [] }
}

let level = newLevel()
let levelId: string = crypto.randomUUID() // the level's key in storage; Save overwrites the same entry
let song: { file: Blob; name: string } | null = null // the MP3 this level is built on
let waitingForSong: { id: string; level: Level } | null = null // a loaded level whose MP3 wasn't stored
let snapDivision = 1 // grid lines per beat for snapping, 0 = off
let beatMapDivision = 2 // beat map grid cells per beat: 2 = half beats, 4 = quarter beats
let songLength = 0
let playing = false
let previewing = false // playing with the level running in the gameplay view and game controls live
let playhead = 0 // song time while paused; while playing, the clock is the truth
let selected = -1 // index of the selected clip, or -1

function setStatus(text: string): void {
  $('status').textContent = text
}

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
  if (previewing) {
    previewing = false
    levelScene.stop()
    $('preview').textContent = 'Preview'
  }
}

// Plays the level from the playhead (backed up to the start of a minigame it's inside) in the gameplay view.
async function startPreview(): Promise<void> {
  if (songLength === 0) return
  if (playing) pause()
  ;(document.activeElement as HTMLElement | null)?.blur() // so Space reaches the game, not a focused button
  playhead = previewStart(level.clips, playhead)
  previewing = true
  $('preview').textContent = 'Stop preview'
  await play()
  levelScene.startAt(level, playhead)
}

// Clip edits and seeks during a preview would pull the timeline out from under it, so they end the preview.
function endPreview(): void {
  if (previewing) pause()
}

// Dragging the scrub bar. Playback (or a preview) pauses while you drag and picks back up where you let go.
let resumeAfterScrub: 'play' | 'preview' | null = null
function scrub(time: number, phase: 'start' | 'move' | 'end'): void {
  if (phase === 'start') {
    resumeAfterScrub = previewing ? 'preview' : playing ? 'play' : null
    if (playing) pause()
  }
  playhead = Math.max(0, Math.min(songLength, time))
  timeline.setPlayhead(playhead)
  if (phase !== 'end') return
  const resume = resumeAfterScrub
  resumeAfterScrub = null
  if (resume === 'preview') void startPreview()
  else if (resume === 'play') void play()
}

function togglePlay(): void {
  if (songLength === 0) return
  if (playing) pause()
  else void play()
}

// Moves the playhead. If the song is playing it keeps playing from the new spot.
function seek(time: number): void {
  endPreview()
  playhead = Math.max(0, Math.min(songLength, time))
  if (playing) void clock.play(playhead)
  timeline.setPlayhead(playhead)
}

// The grid clip edges snap to, or null when snapping is off.
function grid(): BeatGrid | null {
  return snapDivision ? { bpm: level.bpm, offset: level.beatOffset, division: snapDivision } : null
}

// The game a clip runs, or null for a buffer.
function clipMeta(clip: Clip) {
  return clip.type === 'game' ? metaFor(clip.gameId) : null
}

// Name tag and color for a clip: grey buffers, orange task games, teal duration games.
function viewOf(clip: Clip, index: number): ClipView {
  const meta = clipMeta(clip)
  const strength = index === selected ? 0.55 : 0.3
  let label = 'buffer'
  let color = `rgba(170, 170, 170, ${strength})`
  if (clip.type === 'game') {
    label = clip.gameId
    color = `rgba(60, 200, 180, ${strength})`
    if (meta?.kind === 'task') {
      label += ` x${repsFor(meta, clip.end - clip.start, level.bpm)}`
      color = `rgba(255, 140, 60, ${strength})`
    }
  }
  const length = clip.end - clip.start
  const hits = clip.type === 'game' && meta ? (hitTimes(meta, clip, level.bpm) ?? []) : []
  return {
    start: clip.start,
    end: clip.end,
    label,
    color,
    selected: index === selected,
    hits: hits.map(time => (time - clip.start) / length),
  }
}

// Keeps clips in time order (LevelRunner relies on it) and keeps the same clip selected.
function sortClips(keepSelected: Clip | null): void {
  level.clips.sort((a, b) => a.start - b.start)
  selected = keepSelected ? level.clips.indexOf(keepSelected) : -1
}

function render(): void {
  timeline.showClips(level.clips.map(viewOf))
  const clip = level.clips[selected]
  $<HTMLButtonElement>('delete').disabled = !clip
  $('selection').textContent = clip
    ? `${viewOf(clip, selected).label}: ${clip.start.toFixed(2)} s to ${clip.end.toFixed(2)} s (${(clip.end - clip.start).toFixed(2)} s)`
    : 'No clip selected.'
  renderClipOptions(clip)
}

// Settings for the selected clip: the beat sync toggle (duration games that support it) and the beat map grid.
function renderClipOptions(clip: Clip | undefined): void {
  const panel = $('clipOptions')
  panel.replaceChildren()
  if (clip?.type !== 'game') return
  const meta = metaFor(clip.gameId)
  if (!meta) return

  if (meta.kind === 'duration' && meta.canBeatSync) {
    const toggle = document.createElement('label')
    const box = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !!clip.beatSync })
    box.addEventListener('change', () => {
      endPreview()
      clip.beatSync = box.checked
      render()
    })
    toggle.append(box, ' Beat sync')
    panel.append(toggle)
  }
  if (usesBeatMap(meta, clip)) panel.append(beatMapEditor(clip, meta))
}

// A row of cells, one per half (or quarter) beat across the clip. Click a cell to add or remove a hit.
function beatMapEditor(clip: GameClip, meta: MiniGameMeta): HTMLElement {
  const editor = document.createElement('div')
  editor.className = 'beat-map'
  const length = clip.end - clip.start
  const hits = clip.hits ?? defaultHits(meta, length, level.bpm)
  const has = (beat: number) => hits.some(hit => Math.abs(hit - beat) < 1e-6)

  const header = document.createElement('div')
  header.className = 'beat-map-header'
  const division = document.createElement('select')
  division.innerHTML = '<option value="2">1/2 beat</option><option value="4">1/4 beat</option>'
  division.value = String(beatMapDivision)
  division.addEventListener('change', () => {
    beatMapDivision = Number(division.value)
    render()
  })
  const reset = Object.assign(document.createElement('button'), { textContent: 'Reset to default' })
  reset.disabled = !clip.hits
  reset.addEventListener('click', () => {
    endPreview()
    delete clip.hits
    render()
  })
  header.append(`Beat map (${hits.length} hits${clip.hits ? ', custom' : ', default'})`, division, reset)

  const cells = document.createElement('div')
  cells.className = 'beat-map-cells'
  const steps = Math.round((length / (60 / level.bpm)) * beatMapDivision)
  for (let step = 0; step < steps; step++) {
    const beat = step / beatMapDivision
    const cell = document.createElement('button')
    cell.className = 'cell'
    if (step % beatMapDivision === 0) cell.classList.add('on-beat')
    if (beat % 4 === 0) cell.classList.add('bar')
    if (has(beat)) cell.classList.add('hit')
    cell.title = `Beat ${beat + 1}`
    cell.addEventListener('click', () => {
      endPreview()
      clip.hits = has(beat) ? hits.filter(hit => Math.abs(hit - beat) >= 1e-6) : [...hits, beat].sort((a, b) => a - b)
      render()
    })
    cells.append(cell)
  }
  editor.append(header, cells)
  return editor
}

function drawGrid(): void {
  if (songLength > 0) timeline.showBeatGrid(beatTimes(level.bpm, level.beatOffset, songLength))
}

// Copies the level's settings into the toolbar inputs.
function syncInputs(): void {
  $<HTMLInputElement>('title').value = level.title
  $<HTMLInputElement>('bpm').value = String(level.bpm)
  $<HTMLInputElement>('offset').value = level.beatOffset.toFixed(2)
}

// Adds a clip at the playhead. gameId '' means a buffer.
function addClip(gameId: string): void {
  if (songLength === 0) return
  endPreview()
  const meta = gameId ? metaFor(gameId) : null
  const length = snapLength(meta, gameId ? 4 : 2, level.bpm)
  const span = placeMove(level.clips, -1, snapToGrid(playhead, grid()), length, songLength)
  if (!span) {
    setStatus('No room for that clip at the playhead. Move the playhead to an empty spot.')
    return
  }
  const clip: Clip = gameId
    ? { type: 'game', gameId, start: span.start, end: span.end, difficulty: 1 }
    : { type: 'buffer', start: span.start, end: span.end }
  level.clips.push(clip)
  sortClips(clip)
  render()
}

// Applies a drag or resize from the timeline, or snaps the clip back if the new spot isn't legal.
// The dragged edge (or a moved clip's start) snaps to the beat grid first.
function editClip(index: number, side: 'start' | 'end' | undefined, start: number, end: number): void {
  endPreview()
  const clip = level.clips[index]
  const span = side
    ? placeResize(level.clips, index, side, snapToGrid(side === 'end' ? end : start, grid()), clipMeta(clip), level.bpm, songLength)
    : placeMove(level.clips, index, snapToGrid(start, grid()), clip.end - clip.start, songLength)
  if (span) {
    clip.start = span.start
    clip.end = span.end
  }
  sortClips(clip)
  queueMicrotask(render) // redraw after wavesurfer finishes its own drag handling
}

// A new BPM changes task cycle lengths, so re-snap every task clip (shrinking if a neighbour is in the way).
function changeBpm(bpm: number): void {
  if (!(bpm > 0)) return
  endPreview()
  level.bpm = bpm
  level.clips.forEach((clip, index) => {
    const meta = clipMeta(clip)
    if (meta?.kind !== 'task') return
    const span = placeResize(level.clips, index, 'end', clip.end, meta, bpm, songLength)
    if (span) clip.end = span.end
  })
  drawGrid()
  render()
}

function changeOffset(offset: number): void {
  if (!(offset >= 0)) return
  level.beatOffset = offset
  $<HTMLInputElement>('offset').value = offset.toFixed(2)
  drawGrid()
}

function deleteSelected(): void {
  if (!level.clips[selected]) return
  endPreview()
  level.clips.splice(selected, 1)
  selected = -1
  render()
}

// Decodes a song and draws it. Leaves the level's clips alone.
async function openSong(file: Blob, name: string): Promise<void> {
  if (playing) pause()
  setStatus(`Loading ${name}...`)
  await clock.load(file)
  const buffer = clock.getBuffer()!
  song = { file, name }
  songLength = buffer.duration
  playhead = 0
  selected = -1
  await timeline.show(computePeaks(buffer.getChannelData(0), buffer.sampleRate), songLength)
  $('length').textContent = songLength.toFixed(2)
  playButton.disabled = false
  $<HTMLButtonElement>('preview').disabled = false
  $<HTMLButtonElement>('setOffset').disabled = false
  $<HTMLButtonElement>('save').disabled = false
  drawGrid()
  render()
}

// The song picker. Normally this starts a fresh level on the new song; if a loaded level is waiting for
// its MP3, this supplies it instead (with a warning if it isn't the same file the level was made with).
async function pickSong(file: File): Promise<void> {
  try {
    const hash = await hashFile(file)
    let note = ''
    if (waitingForSong) {
      if (waitingForSong.level.audioHash && waitingForSong.level.audioHash !== hash) {
        note = ' Warning: this is not the same file this level was made with, so timings may be off.'
      }
      level = waitingForSong.level
      levelId = waitingForSong.id
      waitingForSong = null
    } else {
      level = newLevel()
      levelId = crypto.randomUUID()
    }
    level.audioHash = hash
    syncInputs()
    await openSong(file, file.name)
    setStatus(`${level.title}: ${file.name}.${note}`)
  } catch {
    setStatus(`Could not decode ${file.name}`)
  }
}

// Saves the level and its song to this browser.
async function save(): Promise<void> {
  if (!song) {
    setStatus('Load a song before saving.')
    return
  }
  level.title = $<HTMLInputElement>('title').value.trim() || 'Untitled level'
  await saveSong(level.audioHash, song.name, song.file)
  await saveLevel(levelId, level)
  await refreshLevelList(levelId)
  setStatus(`Saved "${level.title}".`)
}

// Opens a saved level. If its song is stored too it opens straight away; otherwise it asks for the MP3.
async function open(id: string): Promise<void> {
  const saved = await loadLevel(id)
  if (!saved) return
  const stored = saved.audioHash ? await loadSong(saved.audioHash) : null
  if (!stored) {
    waitingForSong = { id, level: saved }
    setStatus(`"${saved.title}" needs its song. Pick the MP3 with the file picker.`)
    return
  }
  waitingForSong = null
  level = saved
  levelId = id
  syncInputs()
  await openSong(stored.file, stored.name)
  setStatus(`Opened "${level.title}".`)
}

// Starts an empty level, keeping the current song.
function startNewLevel(): void {
  level = newLevel(level.audioHash)
  levelId = crypto.randomUUID()
  waitingForSong = null
  selected = -1
  syncInputs()
  drawGrid()
  render()
  setStatus('New level.')
}

async function refreshLevelList(selectId = ''): Promise<void> {
  const records = await listLevels()
  $<HTMLSelectElement>('levels').innerHTML =
    '<option value="">Saved levels...</option>' +
    records
      .map(r => {
        const name = r.level.title.replace(/</g, '&lt;')
        const when = new Date(r.updatedAt).toLocaleString()
        return `<option value="${r.id}"${r.id === selectId ? ' selected' : ''}>${name} (${when})</option>`
      })
      .join('')
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

$<HTMLInputElement>('song').addEventListener('change', event => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void pickSong(file)
})
$('save').addEventListener('click', () => void save())
$('load').addEventListener('click', () => {
  const id = $<HTMLSelectElement>('levels').value
  if (id) void open(id)
})
$('new').addEventListener('click', startNewLevel)
playButton.addEventListener('click', togglePlay)
$('preview').addEventListener('click', () => (previewing ? pause() : void startPreview()))
listenForKeys(clock, input => {
  if (previewing) levelScene.send(input)
})
timeline.onSeek(seek)
timeline.onScrub(scrub)
timeline.onClipEdit(editClip)
timeline.onClipClick(index => {
  selected = index
  render()
})
$<HTMLInputElement>('zoom').addEventListener('input', event => {
  timeline.zoom(Number((event.target as HTMLInputElement).value))
})
$<HTMLInputElement>('bpm').addEventListener('change', event => {
  changeBpm(Number((event.target as HTMLInputElement).value))
})
$<HTMLInputElement>('offset').addEventListener('change', event => {
  changeOffset(Number((event.target as HTMLInputElement).value))
})
$('setOffset').addEventListener('click', () => changeOffset(currentTime()))
$<HTMLSelectElement>('snap').addEventListener('change', event => {
  snapDivision = Number((event.target as HTMLSelectElement).value)
})
for (const button of app.querySelectorAll<HTMLButtonElement>('[data-add]')) {
  button.addEventListener('click', () => addClip(button.dataset.add ?? ''))
}
$('delete').addEventListener('click', deleteSelected)

window.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
    event.preventDefault()
    void save()
    return
  }
  if (event.target instanceof HTMLInputElement) return
  if (previewing) {
    // During a preview the keys belong to the game; only Esc is kept for stopping it.
    if (event.code === 'Escape') pause()
    return
  }
  if (event.code === 'KeyP') {
    void startPreview()
  } else if (event.code === 'Space') {
    event.preventDefault()
    togglePlay()
  } else if (event.code === 'Delete' || event.code === 'Backspace') {
    deleteSelected()
  }
})

void refreshLevelList()
requestAnimationFrame(frame)
