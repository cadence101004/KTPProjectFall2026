import '../style.css'
import { mountDebugPage } from './DebugPage'

// Build step 1 debug page: play the hardcoded test level and watch clip switches.
mountDebugPage(document.querySelector<HTMLDivElement>('#app')!)
