# PirateWare Minigames

Every minigame we plan to build. Claim one by putting your name in **Owner**, then follow [`src/minigames/README.md`](src/minigames/README.md).

- **Task** games: one task per cycle of `baseBeats`, repeated as many times as fit in the clip. Always on the beat, so the same game gets faster on a faster song. Missing any task fails the game.
- **Duration** games: survive until the clip ends. `minDuration` (seconds) is the shortest clip allowed. Timing is free by default. Games with **Beat sync: optional** have a beat-synced version that the level creator can turn on per clip. Games with **Beat sync: no** never sync.

## Tracker

| Done | Game | ID | Kind | Beat sync | Priority | Owner |
|---|---|---|---|---|---|---|
| [ ] | Fire the Cannon | `fire_cannon` | task | always | 1 | |
| [ ] | Swab the Deck | `swab_the_deck` | task | always | 1 | |
| [ ] | Dodge the Kraken | `dodge_kraken` | duration | optional | 1 | |
| [ ] | Patch the Hull | `patch_the_hull` | task | always | 2 | |
| [ ] | Parrot Says | `parrot_says` | task | always | 2 | |
| [ ] | Parry! | `parry` | task | always | 2 | |
| [ ] | Walk the Plank | `walk_the_plank` | duration | optional | 2 | |
| [ ] | Hoist the Colors | `hoist_the_colors` | task | always | idea | |
| [ ] | Spyglass | `spyglass` | task | always | idea | |
| [ ] | Steer Through the Rocks | `steer_the_rocks` | duration | optional | idea | |
| [ ] | Cannonball Barrage | `cannonball_barrage` | duration | optional | idea | |
| [ ] | Musket Volley | `musket_volley` | duration | no | idea | |

Priority 1 games cover every case the engine has to handle, so build those first. "Idea" games are proposals: change them, cut them, or add your own.

---

## Task games

### Fire the Cannon (`fire_cannon`)
- **Prompt / hint:** `FIRE!` / `SPACE`
- **baseBeats:** 2
- **Mechanic:** A fuse burns toward a mark. Press `action` exactly when it reaches the mark, which lands on the second beat of each cycle.
- **Win a rep:** press within the hit window around the beat. **Fail:** pressing too early, too late, or not at all.
- **Difficulty:** a narrower hit window, and a fuse that's harder to read (faster at the end).
- **Art:** cannon, fuse, spark, mark, explosion.

### Swab the Deck (`swab_the_deck`)
- **Prompt / hint:** `SWAB!` / `MOUSE`
- **baseBeats:** 4
- **Mechanic:** Grime spots appear on the deck. Drag the pointer over each one to scrub it clean.
- **Win a rep:** every spot is clean before the cycle ends. **Fail:** any spot is left dirty.
- **Difficulty:** more spots, smaller spots, and spots that need more scrubbing.
- **Art:** deck planks, grime spots (2 or 3 levels of dirty), mop.

### Patch the Hull (`patch_the_hull`)
- **Prompt / hint:** `PATCH!` / `MOUSE`
- **baseBeats:** 2
- **Mechanic:** Whack-a-mole. A leak springs on a beat, and you click it to plug it.
- **Win a rep:** plug the leak before the cycle ends. **Fail:** the leak is still open when the cycle ends.
- **Difficulty:** two or three leaks per cycle, and leaks that move.
- **Art:** hull wall, water spray, wooden plug, hammer.

### Parrot Says (`parrot_says`)
- **Prompt / hint:** `REPEAT!` / `ARROWS`
- **baseBeats:** 8
- **Mechanic:** On beats 1 to 4 the parrot squawks four arrows. On beats 5 to 8 the player repeats them.
- **Win a rep:** the whole sequence is correct. **Fail:** any wrong arrow or a missed arrow.
- **Difficulty:** repeats on the beat are required (not just in the right order), and the sequences get trickier.
- **Art:** parrot (idle, squawk), arrow bubbles.

### Parry! (`parry`)
- **Prompt / hint:** `PARRY!` / `ARROWS`
- **baseBeats:** 2
- **Mechanic:** A rival pirate winds up on beat 1, showing the direction of the strike, and strikes on beat 2. Press that direction on beat 2 to block.
- **Win a rep:** the right direction within the hit window. **Fail:** the wrong direction, or bad timing.
- **Difficulty:** a shorter wind-up tell, and feints.
- **Art:** rival pirate (wind-up in 4 directions, strike), sword clash spark.

### Hoist the Colors (`hoist_the_colors`), idea
- **Prompt / hint:** `HOIST!` / `UP`
- **baseBeats:** 4
- **Mechanic:** Press `up` on each of the 4 beats to haul the flag up the mast one notch at a time.
- **Win a rep:** all 4 pulls on the beat. **Fail:** a missed or off-beat pull drops the flag.
- **Art:** mast, flag, rope.

### Spyglass (`spyglass`), idea
- **Prompt / hint:** `LAND HO!` / `SPACE`
- **baseBeats:** 2
- **Mechanic:** The spyglass view sweeps across the horizon. Press `action` when the island is centered, which happens on the beat.
- **Win a rep:** press while the island is in the center zone. **Fail:** pressing on open sea, or not at all.
- **Art:** spyglass vignette, horizon, island, sea monsters as decoys.

---

## Duration games

### Dodge the Kraken (`dodge_kraken`)
- **Prompt / hint:** `DODGE!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional
- **Mechanic:** The deck is split into 3 lanes. A tentacle shadow appears over a lane, then slams down. Move left and right to stay out of it.
- **Beat sync on:** the shadow appears one beat early and the slam lands on the beat. **Off:** slams come at their own varied pace.
- **Fail:** getting hit by a slam. **Win:** surviving to the end of the clip.
- **Difficulty:** two lanes slam at once, and the warning gets shorter.
- **Art:** deck, pirate (use `idle_character` / `jumping_character`), tentacle, shadow.

### Walk the Plank (`walk_the_plank`)
- **Prompt / hint:** `BALANCE!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional
- **Mechanic:** A balance meter drifts, and gusts of wind shove it. Press left and right to keep it centered.
- **Beat sync on:** gusts hit on the beat. **Off:** gusts come at random.
- **Fail:** the meter hits either end. **Win:** surviving to the end of the clip.
- **Difficulty:** stronger and more frequent gusts.
- **Art:** plank, pirate wobbling, sharks below, meter.

### Steer Through the Rocks (`steer_the_rocks`), idea
- **Prompt / hint:** `STEER!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional
- **Mechanic:** A top-down ship moves forward automatically, and rocks scroll toward it. Steer left and right.
- **Beat sync on:** a new row of rocks arrives on each beat. **Off:** rocks are spaced at random.
- **Fail:** hitting a rock. **Win:** surviving to the end of the clip.
- **Art:** ship (top-down), rocks, water tiles (`floortiles/water.png`, `shoreline.png`).

### Cannonball Barrage (`cannonball_barrage`), idea
- **Prompt / hint:** `DUCK!` / `↑ ↓`
- **minDuration:** 4 s. **Beat sync:** optional
- **Mechanic:** Cannonballs fly in high or low. Hold `up` to jump or `down` to duck.
- **Beat sync on:** each cannonball arrives on a beat. **Off:** they come at random.
- **Fail:** getting hit. **Win:** surviving to the end of the clip.
- **Art:** pirate jumping and ducking (`jumping_character`), cannonballs, an enemy ship in the background.

### Musket Volley (`musket_volley`), idea
- **Prompt / hint:** `DODGE!` / `ARROWS`
- **minDuration:** 4 s. **Beat sync:** no
- **Mechanic:** Bullet-hell lite. Musket shots streak across the deck in patterns, and the player moves in all 4 directions to weave between them.
- **Fail:** getting hit. **Win:** surviving to the end of the clip.
- **Difficulty:** denser patterns and faster shots.
- **Art:** pirate (top-down or side), musket flashes, bullets, redcoat ship.
