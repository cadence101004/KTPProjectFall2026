import '../style.css'
import './sandbox.css'
import { createGameView } from '../engine/gameView'
import { listenForKeys } from '../engine/input'
import { allGames } from '../minigames/allGames'
import { MetronomeClock } from './MetronomeClock'
import { SandboxScene } from './SandboxScene'

// Minigame sandbox: play any one minigame on its own, with a metronome standing in for the song.
const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="sandbox">
    <h1>Minigame sandbox</h1>
    <div class="controls">
      <label>Game <select id="game">${Object.keys(allGames).map(id => `<option>${id}</option>`).join('')}</select></label>
      <label>BPM <input id="bpm" type="number" min="40" max="300" value="120" /></label>
      <label>Length (s) <input id="length" type="number" min="1" max="60" step="0.5" value="8" /></label>
      <label>Difficulty <input id="difficulty" type="number" min="1" max="5" value="1" /></label>
      <label><input id="beatSync" type="checkbox" /> Beat sync</label>
      <button id="start">Start</button>
    </div>
    <div id="stage" class="stage"></div>
    <p class="help">Arrows or WASD to move, Space or Enter for action, mouse for pointer games.</p>
  </div>`

const $ = <T extends HTMLElement>(id: string) => app.querySelector<T>('#' + id)!
const clock = new MetronomeClock()
const scene = new SandboxScene(clock)

void createGameView('stage', scene)

listenForKeys(clock, input => scene.send(input))

$('start').addEventListener('click', () => {
  // Drop focus so Space and the arrows reach the game instead of the form controls.
  ;(document.activeElement as HTMLElement | null)?.blur()
  void scene.play({
    id: $<HTMLSelectElement>('game').value,
    bpm: Number($<HTMLInputElement>('bpm').value) || 120,
    length: Number($<HTMLInputElement>('length').value) || 8,
    difficulty: Number($<HTMLInputElement>('difficulty').value) || 1,
    beatSync: $<HTMLInputElement>('beatSync').checked,
  })
})
