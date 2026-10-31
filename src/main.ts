
import './style.css'
import { installPirateCursor } from './ui/cursor'
import './home.css'

const sections = [
  { href: '/play.html', title: 'Play', blurb: 'Pick a level and set sail.' },
  { href: '/editor.html', title: 'Level Editor', blurb: 'Chart minigames to your own songs, then preview them.' },
  { href: '/sandbox.html', title: 'Minigame Sandbox', blurb: 'Try one minigame on its own with a metronome.' },
  { href: '/calibrate.html', title: 'Timing Calibration', blurb: 'Line the beat up with your speakers or headphones.' },
  { href: '/debug.html', title: 'Debug', blurb: 'The step 1 test page: clip timing against a song.' },
]

const assets = '/assets/sprites/menu/'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="home">
    <div class="home-content">

      <img
        class="home-logo"
        src="${assets}Title.png"
        alt="Ship Happens!"
      />

      <p class="tagline">A rhythm gauntlet on the high seas!</p>

      <nav class="menu" aria-label="Main menu">
        ${sections.map((section, index) => `
          <a
            class="item ${index === 0 ? 'play-item' : ''}"
            href="${section.href}"
            aria-label="${section.title}"
          >
            ${index === 0 ? `
              <img
                class="play-art"
                src="${assets}PlayButton.png"
                alt=""
              />
            ` : `
              <span class="button-label">${section.title}</span>
            `}
          </a>
        `).join('')}
      </nav>

      <div class="menu-decorations" aria-hidden="true">
        <img src="${assets}Heart.png" alt="" />
        <img src="${assets}Sparkle.png" alt="" />
        <img src="${assets}Skull.png" alt="" />
        <img src="${assets}Sparkle.png" alt="" />
        <img src="${assets}Heart.png" alt="" />
      </div>

    </div>
  </main>
`

void installPirateCursor()

