import './style.css'
import { installPirateCursor } from './ui/cursor'
import './home.css'

// Home menu. Each section is its own page.
const sections = [
  { href: '/play.html', title: 'Play', blurb: 'Pick a level and set sail.', disabled: false },
  { href: '/editor.html', title: 'Level Editor', blurb: 'Chart minigames to your own songs, then preview them.' },
  { href: '/sandbox.html', title: 'Minigame Sandbox', blurb: 'Try one minigame on its own with a metronome.' },
  { href: '/debug.html', title: 'Debug', blurb: 'The step 1 test page: clip timing against a song.' },
]

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="home">
    <h1>PirateWare</h1>
    <p class="tagline">A rhythm gauntlet on the high seas.</p>
    <nav class="menu">
      ${sections
        .map(s =>
          s.disabled
            ? `<span class="item disabled"><b>${s.title}</b><small>${s.blurb}</small></span>`
            : `<a class="item" href="${s.href}"><b>${s.title}</b><small>${s.blurb}</small></a>`,
        )
        .join('')}
    </nav>
  </main>`

void installPirateCursor()
