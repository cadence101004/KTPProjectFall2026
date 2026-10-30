import '../style.css'
import './play.css'
import { AudioClock } from '../audio/AudioClock'
import { installPirateCursor, setWaiting } from '../ui/cursor'
import { hashFile } from '../audio/hash'
import { createGameView, loadCountdownSound } from '../engine/gameView'
import { listenForKeys } from '../engine/input'
import { LevelScene } from '../engine/LevelScene'
import { MediaLayer } from '../engine/MediaLayer'
import { listLevels, type LevelRecord, loadSong, saveSong } from '../storage/db'
import { loadMediaFiles, type MediaFile, mediaUrls } from '../storage/mediaFiles'
import type { Level } from '../types/level'

// Play page: pick a saved level, then play it with real lives. Esc or Levels returns to the list.
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="play">
    <header>
      <a href="/" class="home-link">&larr; Home</a>
      <h1>Choose a level</h1>
    </header>

    <section id="select" class="select">
      <ul id="levels" class="levels"></ul>
      <div id="needSong" class="need-song" hidden>
        <p id="needSongText"></p>
        <input type="file" id="songFile" accept="audio/*,video/mp4" />
      </div>
    </section>

    <section id="game" class="game" hidden>
      <div class="bar">
        <b id="levelTitle"></b>
        <label title="Misses are counted instead of costing lives"><input id="practice" type="checkbox" /> Practice</label>
        <button id="start">Start</button>
        <button id="back">Levels</button>
      </div>
      <div id="stage" class="stage"></div>
      <p class="help">Arrows or WASD to move, Space or Enter for action, mouse for pointer games. Esc goes back.</p>
    </section>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!

const clock = new AudioClock()
const levelScene = new LevelScene(clock)
let level: Level | null = null // the level picked from the list
let waitingForSong: Level | null = null // a picked level whose MP3 isn't stored in this browser
let playing = false
let media = new Map<string, MediaFile>() // the picked level's media files, by mediaHash
const mediaLayer = new MediaLayer($('stage'), () => clock.songTime(), () => playing)

void createGameView('stage', levelScene)
void loadCountdownSound(clock, levelScene)
levelScene.setIdleText('Press Start to set sail!')
levelScene.setGameOverOptions([
  { label: 'Restart Level', action: () => void start() },
  { label: 'Main Menu', action: () => (window.location.href = '/') },
])

// Fills the level list from this browser's saved levels, newest first.
async function showLevelList(): Promise<void> {
  const records = await listLevels()
  const list = $('levels')
  list.replaceChildren()
  if (records.length === 0) {
    const empty = document.createElement('li')
    empty.className = 'empty'
    empty.innerHTML = 'No levels yet. Make one in the <a href="/editor.html">Level Editor</a> and save it.'
    list.append(empty)
    return
  }
  for (const record of records) list.append(levelButton(record))
}

function levelButton(record: LevelRecord): HTMLLIElement {
  const games = record.level.clips.filter(clip => clip.type === 'game').length
  const item = document.createElement('li')
  const button = document.createElement('button')
  button.className = 'level'
  const title = document.createElement('b')
  title.textContent = record.level.title
  const details = document.createElement('small')
  details.textContent = `${games} minigame${games === 1 ? '' : 's'}, ${Math.round(record.level.bpm)} BPM`
  button.append(title, details)
  button.addEventListener('click', () => void pick(record.level))
  item.append(button)
  return item
}

// Picks a level. Its song is normally stored with it; if not, the player supplies the MP3.
async function pick(picked: Level): Promise<void> {
  const song = picked.audioHash ? await loadSong(picked.audioHash) : null
  if (!song) {
    waitingForSong = picked
    $('needSongText').textContent = `"${picked.title}" needs its song. Pick the MP3 to play it.`
    $('needSong').hidden = false
    return
  }
  await openLevel(picked, song.file)
}

// Decodes the song, loads the level's stored media, and shows the game view, ready to Start.
async function openLevel(picked: Level, file: Blob): Promise<void> {
  setWaiting(true) // the hourglass cursor, until the song and its media are ready
  try {
    await clock.load(file)
    media = await loadMediaFiles(picked.media)
  } finally {
    setWaiting(false)
  }
  mediaLayer.setMedia(picked.media, mediaUrls(media), picked.mediaEnabled !== false)
  level = picked
  waitingForSong = null
  $('needSong').hidden = true
  $('levelTitle').textContent = picked.title
  $('select').hidden = true
  $('game').hidden = false
  document.querySelector('h1')!.textContent = 'Set sail'
}

// The MP3 for a level that didn't have it stored. Warns if it isn't the file the level was made with.
async function supplySong(file: File): Promise<void> {
  if (!waitingForSong) return
  const picked = waitingForSong
  const hash = await hashFile(file)
  if (picked.audioHash && hash !== picked.audioHash) {
    const keepGoing = window.confirm('This is not the same song file this level was made with, so timings may be off. Play anyway?')
    if (!keepGoing) return
  } else if (picked.audioHash) {
    await saveSong(hash, file.name, file) // remember it for next time
  }
  await openLevel(picked, file)
}

// Plays the level from the top with full lives. Also used by Restart Level.
async function start(): Promise<void> {
  if (!level) return
  ;(document.activeElement as HTMLElement | null)?.blur() // so Space reaches the game, not a focused button
  playing = true
  $('start').textContent = 'Restart'
  await clock.play(0)
  levelScene.startAt(level, 0)
}

// Stops the game and returns to the level list.
function backToLevels(): void {
  clock.stop()
  levelScene.stop()
  playing = false
  level = null
  mediaLayer.setMedia([], new Map(), false)
  for (const file of media.values()) URL.revokeObjectURL(file.url) // free the video files' memory
  media = new Map()
  $('start').textContent = 'Start'
  $('game').hidden = true
  $('select').hidden = false
  document.querySelector('h1')!.textContent = 'Choose a level'
  void showLevelList()
}

$('start').addEventListener('click', () => void start())
$('back').addEventListener('click', backToLevels)
$<HTMLInputElement>('practice').addEventListener('change', event => {
  levelScene.setPractice((event.target as HTMLInputElement).checked)
})
$<HTMLInputElement>('songFile').addEventListener('change', event => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) void supplySong(file)
})

listenForKeys(clock, input => {
  if (playing) levelScene.send(input)
})
window.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !$('game').hidden) backToLevels()
})

void showLevelList()

void installPirateCursor()
