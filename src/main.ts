import './style.css'
import { mountDebugPage } from './debug/DebugPage'

// Build step 1: the debug page stands in for the game until the minigames exist.
mountDebugPage(document.querySelector<HTMLDivElement>('#app')!)
