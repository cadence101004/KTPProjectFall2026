import '../style.css'
import './editor.css'
import { AudioClock } from '../audio/AudioClock'
import { installPirateCursor, setWaiting } from '../ui/cursor'
import { fullscreenButton } from '../ui/fullscreen'
import { hashFile } from '../audio/hash'
import { defaultHits, hitTimes, repsFor, usesBeatMap } from '../engine/clipRules'
import { autoCountdownRate, countdownNeeds, shortCountdownBuffers } from '../engine/countdown'
import { createGameView, loadCountdownSound } from '../engine/gameView'
import { listenForKeys } from '../engine/input'
import { LevelScene } from '../engine/LevelScene'
import { MediaLayer } from '../engine/MediaLayer'
import { allGames, metaFor } from '../minigames/allGames'
import { listLevels, loadLevel, loadSong, saveLevel, saveMedia, saveSong } from '../storage/db'
import { loadMediaFiles, type MediaFile, mediaUrls } from '../storage/mediaFiles'
import type { Clip, GameClip, Level, MediaClip } from '../types/level'
import type { MiniGameMeta } from '../types/minigame'
import { type BeatGrid, beatTimes, snapToGrid } from './beatGrid'
import { freeGaps, placeMove, placeResize, snapLength } from './clipEditing'
import { cutMedia, trimMedia } from './mediaEditing'
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
      <label title="Misses are counted instead of costing lives, so the preview never ends in Game Over">
        <input id="practice" type="checkbox" checked /> Practice</label>
      <button id="fullscreen" title="Fill the screen with the gameplay view (F). Esc leaves fullscreen.">Fullscreen</button>
      <span class="time"><b id="time">0.00</b> / <span id="length">0.00</span> s</span>
      <label>BPM <input id="bpm" type="number" min="40" max="300" step="0.01" value="120" /></label>
      <label title="Speed of the 3, 2, 1, GO countdown. Leave empty for auto: one count per beat.">Countdown
        <input id="countdownRate" type="number" min="0.25" max="4" step="0.05" placeholder="auto" /> x
        <span id="countdownNeeds" class="needs"></span></label>
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
    <div class="media-controls">
      <b>Media track</b>
      <label title="Turns the whole media track on or off in the game"><input id="mediaOn" type="checkbox" checked /> On</label>
      <label class="file-button">Add video or image at playhead<input id="mediaFile" type="file" accept="video/*,image/*" /></label>
      <button id="cutMedia" title="Split the media clip under the playhead into two pieces (C)">Cut at playhead</button>
      <span id="mediaInfo"></span>
    </div>
    <div id="mediaOptions" class="media-options"></div>
    <div class="palette">
      <span>Add at playhead:</span>
      <button data-add="">Buffer</button>
      ${Object.keys(allGames).map(id => `<button data-add="${id}">${id}</button>`).join('')}
      <button id="delete" class="danger" disabled>Delete clip</button>
    </div>
    <p id="countdownWarning" class="warning" hidden></p>
    <p id="selection" class="selection">No clip selected.</p>
    <div id="clipOptions" class="clip-options"></div>
    <p class="help">Drag the yellow handle in the bar above the waveform to move the playhead (works mid-preview too),
      or click empty waveform. Space plays and pauses. Drag a clip to move it,
      drag its edges to resize. Delete removes the selected clip. Set BPM and the first beat so the grid lines
      land on the drums; clip edges then snap to the grid. Drag a media block's edges to trim it. Cut (C) splits the media under the playhead so each
      piece can have its own blur and dim. Ctrl+S saves. Preview (P) plays the level as a player
      sees it, with the game controls live; Esc stops it. Fullscreen (F) fills the screen with the gameplay view.</p>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!
const playButton = $<HTMLButtonElement>('play')

const clock = new AudioClock()
const timeline = new Timeline($('waveform'))
const levelScene = new LevelScene(clock)

void createGameView('stage', levelScene)
void loadCountdownSound(clock, levelScene).then(render) // render again to show the auto countdown speed

// In the editor, Restart replays the preview from where it began, and Main Menu goes back to editing.
let previewOrigin = 0
levelScene.setIdleText('Press Preview to play the level')
levelScene.setPractice(true)
levelScene.setGameOverOptions([
  {
    label: 'Restart Level',
    action: () => {
      pause() // first, since pausing moves the playhead to the current song time
      playhead = previewOrigin
      void startPreview()
    },
  },
  { label: 'Main Menu', action: () => pause() },
])

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
let selectedMedia = -1 // index of the selected media clip, or -1 (only one of the two is ever selected)
const mediaFiles = new Map<string, MediaFile>() // media files this session knows about, by mediaHash
const mediaLayer = new MediaLayer($('stage'), currentTime, () => playing) // shows the frame under the playhead too

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
  previewOrigin = playhead
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
  renderMedia()
  renderCountdown()
}

// The countdown speed field's "auto" hint, and a warning when buffers are too short for the whole
// countdown. Waits for the countdown sound, since both depend on where its counts fall.
function renderCountdown(): void {
  const fileBeats = levelScene.countdownFileBeats()
  if (!fileBeats) return
  $<HTMLInputElement>('countdownRate').placeholder = `auto ${autoCountdownRate(fileBeats, level.bpm).toFixed(2)}`
  const needs = countdownNeeds(fileBeats, level.bpm, level.countdownRate)
  $('countdownNeeds').textContent = `(buffers need ${needs.toFixed(2)} s)`
  const short = shortCountdownBuffers(level.clips, needs)
  const warning = $('countdownWarning')
  warning.hidden = short.length === 0
  warning.textContent =
    `${short.length} buffer${short.length === 1 ? ' is' : 's are'} shorter than the countdown needs ` +
    `(${needs.toFixed(2)} s at this speed), so the countdown there starts partway. ` +
    'Lengthen them, or speed up the countdown.'
}

// The media track: lane blocks, the on/off switch, the live background layer, and the selected clip's settings.
function renderMedia(): void {
  const on = level.mediaEnabled !== false
  timeline.showMedia(
    level.media.map((clip, index) => ({ start: clip.start, end: clip.end, label: clip.src || clip.kind, selected: index === selectedMedia })),
  )
  $<HTMLInputElement>('mediaOn').checked = on
  document.querySelector('.media-lane')?.classList.toggle('off', !on)
  mediaLayer.setMedia(level.media, mediaUrls(mediaFiles), on)
  const missing = level.media.filter(clip => !mediaFiles.has(clip.mediaHash)).length
  $('mediaInfo').textContent = missing ? `${missing} media file${missing === 1 ? '' : 's'} not in this browser` : ''
  renderMediaOptions(level.media[selectedMedia])
}

// Settings for the selected media clip. Sliders update the clip directly; the media layer redraws every
// frame, so changes show live in the gameplay view.
function renderMediaOptions(clip: MediaClip | undefined): void {
  const panel = $('mediaOptions')
  panel.replaceChildren()
  if (!clip) return
  const field = (label: string, input: HTMLInputElement) => {
    const wrap = document.createElement('label')
    wrap.append(`${label} `, input)
    return wrap
  }
  const input = (type: string, value: number, min: string, step: string, max = '') => {
    const element = document.createElement('input')
    element.type = type
    element.min = min
    element.step = step
    if (max) element.max = max
    element.value = String(value)
    return element
  }

  const blur = input('range', clip.effects.blur, '0', '1', '20')
  blur.addEventListener('input', () => (clip.effects.blur = Number(blur.value)))
  const dim = input('range', clip.effects.dim, '0', '0.05', '1')
  dim.addEventListener('input', () => (clip.effects.dim = Number(dim.value)))

  const length = input('number', +(clip.end - clip.start).toFixed(2), '0.25', '0.25')
  length.addEventListener('change', () => {
    const index = level.media.indexOf(clip)
    const span = placeResize(level.media, index, 'end', clip.start + Number(length.value), null, level.bpm, songLength)
    if (span) clip.end = span.end
    render()
  })
  const offset = input('number', clip.mediaOffset, '0', '0.5')
  offset.disabled = clip.kind !== 'video'
  offset.addEventListener('change', () => {
    clip.mediaOffset = Math.max(0, Number(offset.value) || 0)
    render()
  })

  const remove = Object.assign(document.createElement('button'), { textContent: 'Delete media', className: 'danger' })
  remove.addEventListener('click', deleteSelected)
  panel.append(
    Object.assign(document.createElement('b'), { textContent: clip.src || clip.kind }),
    field('Blur', blur),
    field('Dim', dim),
    field('Length (s)', length),
    field('Video starts at (s)', offset),
    remove,
  )
}

// Adds a video or image to the media track at the playhead, as long as the video (or 8 s for an image),
// cut short if it would run into the next media clip or the end of the song.
async function addMedia(file: File): Promise<void> {
  if (songLength === 0) {
    setStatus('Load a song before adding media.')
    return
  }
  const kind = file.type.startsWith('image/') ? 'image' : 'video'
  setWaiting(true) // hashing and measuring a big video takes a moment
  let hash: string
  let wanted: number
  try {
    hash = await hashFile(file)
    const url = mediaFiles.get(hash)?.url ?? URL.createObjectURL(file)
    mediaFiles.set(hash, { name: file.name, file, url })
    wanted = kind === 'video' ? await videoLength(url) : 8
  } finally {
    setWaiting(false)
  }
  const at = snapToGrid(playhead, grid())
  const gap = freeGaps(level.media, -1, songLength).find(g => at >= g.start - 1e-6 && at < g.end)
  if (!gap) {
    setStatus('There is already media at the playhead. Move the playhead to an empty part of the media track.')
    return
  }
  const start = Math.max(at, gap.start)
  const clip: MediaClip = {
    kind,
    src: file.name,
    mediaHash: hash,
    start,
    end: Math.min(start + wanted, gap.end),
    mediaOffset: 0,
    effects: { blur: 8, dim: 0.4 },
  }
  level.media.push(clip)
  level.media.sort((a, b) => a.start - b.start)
  selectedMedia = level.media.indexOf(clip)
  selected = -1
  render()
}

// A video file's length in seconds (8 if the browser can't tell).
function videoLength(url: string): Promise<number> {
  return new Promise(resolve => {
    const probe = document.createElement('video')
    probe.preload = 'metadata'
    probe.onloadedmetadata = () => resolve(Number.isFinite(probe.duration) ? probe.duration : 8)
    probe.onerror = () => resolve(8)
    probe.src = url
  })
}

// Applies a drag on the media lane, keeping media clips from overlapping (snaps back if there's no room).
function moveMedia(index: number, start: number): void {
  const clip = level.media[index]
  const span = placeMove(level.media, index, snapToGrid(start, grid()), clip.end - clip.start, songLength)
  if (span) {
    clip.start = span.start
    clip.end = span.end
  }
  level.media.sort((a, b) => a.start - b.start)
  selectedMedia = level.media.indexOf(clip)
  render()
}

// Applies an edge drag on the media lane: the edge snaps to the beat grid and stops at the neighbouring
// media clips (and the song's ends), then trimMedia keeps the video in place if the start moved.
function resizeMedia(index: number, side: 'start' | 'end', time: number): void {
  const clip = level.media[index]
  const gap = freeGaps(level.media, index, songLength).find(g => clip.start >= g.start - 1e-6 && clip.end <= g.end + 1e-6)
  if (!gap) return
  const to = Math.min(gap.end, Math.max(gap.start, snapToGrid(time, grid())))
  Object.assign(clip, trimMedia(clip, side, to))
  render()
}

// Splits the media clip under the playhead in two (snapped to the beat grid), so each piece can get its
// own blur and dim, or be deleted to cut a scene out. The second piece is selected afterwards.
function cutMediaAtPlayhead(): void {
  const at = snapToGrid(currentTime(), grid())
  const index = level.media.findIndex(clip => at > clip.start && at < clip.end)
  const pieces = index === -1 ? null : cutMedia(level.media[index], at)
  if (!pieces) {
    setStatus('Put the playhead inside a media clip (not right at its edge) to cut it.')
    return
  }
  level.media.splice(index, 1, ...pieces)
  selectedMedia = index + 1
  selected = -1
  render()
}

function selectMedia(index: number): void {
  selectedMedia = index
  selected = -1
  render()
}

// Settings for the selected clip: the beat sync toggle (duration games that support it) and the beat map grid.
function renderClipOptions(clip: Clip | undefined): void {
  const panel = $('clipOptions')
  panel.replaceChildren()
  if (clip?.type !== 'game') return
  const meta = metaFor(clip.gameId)
  if (!meta) return

  // For games that allow it (canHideBackground), untick to skip the minigame's background (its sky) so the
  // level's video shows through behind its floor and characters. Other games always keep their background.
  if (meta.canHideBackground) {
    const background = document.createElement('label')
    background.title = 'Untick to let the media track (e.g. a video) show behind this minigame'
    const showBackground = Object.assign(document.createElement('input'), { type: 'checkbox', checked: !clip.hideBackground })
    showBackground.addEventListener('change', () => {
      endPreview()
      if (showBackground.checked) delete clip.hideBackground
      else clip.hideBackground = true
      render()
    })
    background.append(showBackground, ' Minigame background')
    panel.append(background)
  }

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
  $<HTMLInputElement>('countdownRate').value = level.countdownRate === undefined ? '' : String(level.countdownRate)
}

// A countdown speed from the field: a number sets it, empty (or nonsense) goes back to auto.
function changeCountdownRate(text: string): void {
  const rate = Number(text)
  if (text.trim() === '' || !(rate > 0)) delete level.countdownRate
  else level.countdownRate = Math.min(4, Math.max(0.25, rate))
  syncInputs()
  render()
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
  if (level.media[selectedMedia]) {
    level.media.splice(selectedMedia, 1)
    selectedMedia = -1
    render()
    return
  }
  if (!level.clips[selected]) return
  endPreview()
  level.clips.splice(selected, 1)
  selected = -1
  render()
}

// Decodes a song and draws it, and loads any stored media the level uses. Leaves the level's clips alone.
async function openSong(file: Blob, name: string): Promise<void> {
  if (playing) pause()
  setStatus(`Loading ${name}...`)
  setWaiting(true) // the hourglass cursor, until the song and its media are ready
  try {
    await clock.load(file)
    for (const [hash, media] of await loadMediaFiles(level.media.filter(clip => !mediaFiles.has(clip.mediaHash)))) {
      mediaFiles.set(hash, media)
    }
  } finally {
    setWaiting(false)
  }
  const buffer = clock.getBuffer()!
  song = { file, name }
  songLength = buffer.duration
  playhead = 0
  selected = -1
  selectedMedia = -1
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
  for (const hash of new Set(level.media.map(clip => clip.mediaHash))) {
    const media = mediaFiles.get(hash)
    if (media) await saveMedia(hash, media.name, media.file)
  }
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
  selectedMedia = -1
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
fullscreenButton($<HTMLButtonElement>('fullscreen'), $('stage'))
$<HTMLInputElement>('practice').addEventListener('change', event => {
  levelScene.setPractice((event.target as HTMLInputElement).checked)
})
listenForKeys(clock, input => {
  if (previewing) levelScene.send(input)
})
timeline.onSeek(seek)
timeline.onScrub(scrub)
timeline.onClipEdit(editClip)
timeline.onMediaEdit(selectMedia, moveMedia, resizeMedia)
$('cutMedia').addEventListener('click', cutMediaAtPlayhead)
$<HTMLInputElement>('mediaOn').addEventListener('change', event => {
  level.mediaEnabled = (event.target as HTMLInputElement).checked
  render()
})
$<HTMLInputElement>('mediaFile').addEventListener('change', event => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // so picking the same file again still fires
  if (file) void addMedia(file)
})
timeline.onClipClick(index => {
  selectedMedia = -1
  selected = index
  render()
})
$<HTMLInputElement>('zoom').addEventListener('input', event => {
  timeline.zoom(Number((event.target as HTMLInputElement).value))
})
$<HTMLInputElement>('countdownRate').addEventListener('change', event => {
  changeCountdownRate((event.target as HTMLInputElement).value)
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
  if (event.code === 'KeyC' && !event.ctrlKey && !event.metaKey) {
    cutMediaAtPlayhead()
  } else if (event.code === 'KeyP') {
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

void installPirateCursor()
