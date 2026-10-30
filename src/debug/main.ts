import '../style.css'
import { installPirateCursor } from '../ui/cursor'
import { mountDebugPage } from './DebugPage'

// Build step 1 debug page: play the hardcoded test level and watch clip switches.
mountDebugPage(document.querySelector<HTMLDivElement>('#app')!)

void installPirateCursor()
