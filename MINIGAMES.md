# PirateWare Minigames

Every minigame we plan to build. Claim one by putting your name in **Owner**, then follow [`src/minigames/README.md`](src/minigames/README.md).

- **Task** games: one task per cycle of `baseBeats`, repeated as many times as fit in the clip. Always on the beat, so the same game gets faster on a faster song. Missing any task fails the game.
- **Default hits** (beat map): games with discrete hits list their default pattern, in beats from the start of one cycle (task) or one 4-beat bar (duration, beat sync on). Level designers can then edit every hit per clip, osu-style. Beat 0 is the first beat, so `[1]` means the 2nd beat.
- **Duration** games: survive until the clip ends. `minDuration` (seconds) is the shortest clip allowed. Timing is free by default. Games with **Beat sync: optional** have a beat-synced version that the level creator can turn on per clip. Games with **Beat sync: no** never sync.

## Tracker

| Done | Game | ID | Kind | Beat sync | Priority | Owner |
|---|---|---|---|---|---|---|
| [ ] | Fire the Cannon | `fire_cannon` | task | always | 1 | Connor |
| [ ] | Swab the Deck | `swab_the_deck` | task | always | 1 | Connor |
| [ ] | Dodge the Kraken | `dodge_kraken` | duration | optional | 1 | Connor |
| [ ] | Catch the Fruit | `catch_the_fruit` | duration | optional | 2 | Connor |
| [ ] | X Marks the Spot | `x_marks_the_spot` | duration | optional | 2 | Connor |
| [ ] | Flotsam Hop | `flotsam_hop` | duration | optional | 2 | Connor |
| [ ] | Patch the Hull | `patch_the_hull` | task | always | 2 | Cole |
| [ ] | Parrot Says | `parrot_says` | task | always | 2 | Connor |
| [ ] | Parry! | `parry` | task | always | 2 | Connor |
| [ ] | Walk the Plank | `walk_the_plank` | duration | optional | 2 | |
| [ ] | Hoist the Colors | `hoist_the_colors` | task | always | idea | |
| [ ] | Spyglass | `spyglass` | task | always | idea | |
| [ ] | Steer Through the Rocks | `steer_the_rocks` | duration | optional | idea | |
| [ ] | Cannonball Barrage | `cannonball_barrage` | duration | optional | 2 | Connor |
| [ ] | Musket Volley | `musket_volley` | duration | no | idea | |

Priority 1 games cover every case the engine has to handle, so build those first. "Idea" games are proposals: change them, cut them, or add your own.

---

## Task games

### Fire the Cannon (`fire_cannon`)
- **Prompt / hint:** `FIRE!` / `SPACE`
- **baseBeats:** 2. **Default hits:** `[1]` (fire on the 2nd beat)
- **Mechanic:** A fuse burns toward a mark. Press `action` exactly when it reaches the mark, which lands on the second beat of each cycle.
- **Win a rep:** press within the hit window around the beat. **Fail:** pressing too early, too late, or not at all.
- **Difficulty:** a narrower hit window, and a fuse that's harder to read (faster at the end).
- **Art:** cannon, fuse, spark, mark, explosion.

### Swab the Deck (`swab_the_deck`)
- **Prompt / hint:** `SWAB!` / `MOUSE`
- **baseBeats:** 4. **Default hits:** none (no discrete hits, so it uses cycle windows)
- **Mechanic:** Grime spots appear on the deck. Drag the pointer over each one to scrub it clean.
- **Win a rep:** every spot is clean before the cycle ends. **Fail:** any spot is left dirty.
- **Difficulty:** more spots, smaller spots, and spots that need more scrubbing.
- **Art:** deck planks, grime spots (2 or 3 levels of dirty), mop.

### Patch the Hull (`patch_the_hull`)
- **Prompt / hint:** `PATCH!` / `MOUSE`
- **baseBeats:** 2. **Default hits:** `[0]` (a leak springs on each cycle's first beat)
- **Mechanic:** Whack-a-mole. A leak springs on a beat, and you click it to plug it.
- **Win a rep:** plug the leak before the cycle ends. **Fail:** the leak is still open when the cycle ends.
- **Difficulty:** two or three leaks per cycle, and leaks that move.
- **Art:** hull wall, water spray, wooden plug, hammer.

### Parrot Says (`parrot_says`)
- **Prompt / hint:** `REPEAT!` / `ARROWS`
- **baseBeats:** 8. **Default hits:** `[4, 5, 6, 7]` (the player's four answers)
- **Mechanic:** Call and response. The beat map's hits are the player's answers; the parrot squawks each answer's arrow 4 beats earlier (shown in its speech bubble and in a row of slots), and the player presses that arrow on the beat. Charting an offbeat answer moves its call too.
- **Graded per answer:** Perfect / Great / Good by timing; the wrong arrow, early, late, or no press is a Miss. **Fail:** a quarter or more missed (the pirate is knocked out with the death fall). **Win:** every answer settled under that.
- **Difficulty:** at 1 the called arrows stay in the slots; from 2 they vanish a beat after each call, so the sequence must be remembered. Hit windows narrow too.
- **Art:** the parrot is placeholder shapes for now (wanted: parrot idle and squawk frames). Cadence's idle pirate answers it, on a deck under a sky that can be hidden for a level video.

### Parry! (`parry`)
- **Prompt / hint:** `PARRY!` / `ARROWS`
- **baseBeats:** 2. **Default hits:** `[1]` (block on the strike)
- **Mechanic:** A rival pirate winds up with an arrow (up, down, left, or right) over their head and a ring shrinking onto it, then lunges on the hit. Press that arrow on the beat to parry: the player counters and the rival is knocked back.
- **Graded per strike:** Perfect / Great / Good by timing; the wrong arrow, early, late, or no press is a Miss. **Fail:** a quarter or more missed (the player is knocked out with the death fall). **Win:** every strike settled under that.
- **Difficulty:** a shorter wind-up (1, then 0.75, then 0.5 beats) and narrower hit windows. Feints are a future idea.
- **Art:** Cadence's `punching_character` frames for both fighters (the rival is mirrored and tinted until it has its own art), on a deck under a sky that can be hidden for a level video.

### Hoist the Colors (`hoist_the_colors`), idea
- **Prompt / hint:** `HOIST!` / `UP`
- **baseBeats:** 4. **Default hits:** `[0, 1, 2, 3]`
- **Mechanic:** Press `up` on each of the 4 beats to haul the flag up the mast one notch at a time.
- **Win a rep:** all 4 pulls on the beat. **Fail:** a missed or off-beat pull drops the flag.
- **Art:** mast, flag, rope.

### Spyglass (`spyglass`), idea
- **Prompt / hint:** `LAND HO!` / `SPACE`
- **baseBeats:** 2. **Default hits:** `[1]`
- **Mechanic:** The spyglass view sweeps across the horizon. Press `action` when the island is centered, which happens on the beat.
- **Win a rep:** press while the island is in the center zone. **Fail:** pressing on open sea, or not at all.
- **Art:** spyglass vignette, horizon, island, sea monsters as decoys.

---

## Duration games

### Flotsam Hop (`flotsam_hop`)
- **Prompt / hint:** `HOP!` / `← →  ↑ JUMP`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0]` (a raft sinks on beat 1 of each bar)
- **Mechanic:** Side-view platformer over the sea, with real gravity. Hold left or right to run, up (or action) to jump. Three rafts bob on the beat (the middle one also slides) and barrels drift past higher up as a second route. Standing on a moving raft carries you with it.
- **Beat sync on:** on each beat map hit, the raft you're standing on shakes red for a beat, then sinks for a beat and a half. **Off:** sinks come at their own pace.
- **Fail:** falling in the sea three times (each fall is a Miss and respawns you on a safe raft, blinking). **Win:** reaching the clip end.
- **Art:** Cadence's side-view pirate (`pirateside1/2` as a run cycle) and sideways jump frames. A sky over the sea can be hidden for a level video. Wanted: raft and barrel sprites (placeholder shapes for now).

### X Marks the Spot (`x_marks_the_spot`)
- **Prompt / hint:** `DIG!` / `← ↑ → ↓`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0, 2]` (a dig on beats 1 and 3 of each bar)
- **Mechanic:** A top-down island. An X appears on the sand with a ring shrinking around it, and the crew digs there on the beat. Walk freely in any direction (hold the arrows) to be standing on the X when it's dug. Each X spawns within walking reach of the last.
- **Graded per dig (a race, not an aim test):** standing anywhere on the X when it's dug is a Perfect, arriving up to 0.16 s late is a Good (a chest pops up either way), later than that is a Miss (an empty hole). **Fail:** a quarter or more missed. **Win:** reaching the clip end.
- **Difficulty:** a smaller X to stand on, and (beat sync off) digs closer together.
- **Art:** Cadence's `birds-eye view` pirate (front, back, and two-frame walks left and right) on `floortiles/sand.png`. The island is the playfield, so it always shows. Wanted: chest and hole sprites (placeholder shapes for now).

### Catch the Fruit (`catch_the_fruit`)
- **Prompt / hint:** `CATCH!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0, 2]` (fruit lands on beats 1 and 3 of each bar)
- **Mechanic:** Fruit falls onto a beach, and the pirate walks left and right (hold the arrows) to catch each one in her bucket. Every fruit spawns within walking reach of the last, so all of it is catchable.
- **Beat sync on:** every fruit lands in the bucket on a beat map hit. **Off:** fruit falls at its own pace.
- **Graded per catch:** dead center is Perfect, then Great and Good toward the rim; a dropped fruit is a Miss. **Fail:** a quarter or more of the fruit dropped. **Win:** reaching the clip end.
- **Difficulty:** a smaller bucket, and (beat sync off) fruit closer together.
- **Art:** Cadence's `bucket_character` (front and two walking frames) and `fruits`, on `floortiles/sand.png`.

### Dodge the Kraken (`dodge_kraken`)
- **Prompt / hint:** `DODGE!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0, 2]` (slams on beats 1 and 3 of each bar)
- **Mechanic:** The deck is split into 3 lanes. A tentacle shadow appears over a lane, then slams down. Move left and right to stay out of it.
- **Beat sync on:** the shadow appears one beat early and the slam lands on the beat. **Off:** slams come at their own varied pace.
- **Fail:** getting hit by a slam. **Win:** surviving to the end of the clip.
- **Difficulty:** two lanes slam at once, and the warning gets shorter.
- **Art:** deck, pirate (use `idle_character` / `jumping_character`), tentacle, shadow.

### Walk the Plank (`walk_the_plank`)
- **Prompt / hint:** `BALANCE!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0]` (a gust each bar)
- **Mechanic:** A balance meter drifts, and gusts of wind shove it. Press left and right to keep it centered.
- **Beat sync on:** gusts hit on the beat. **Off:** gusts come at random.
- **Fail:** the meter hits either end. **Win:** surviving to the end of the clip.
- **Difficulty:** stronger and more frequent gusts.
- **Art:** plank, pirate wobbling, sharks below, meter.

### Steer Through the Rocks (`steer_the_rocks`), idea
- **Prompt / hint:** `STEER!` / `← →`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0, 1, 2, 3]` (a row of rocks each beat)
- **Mechanic:** A top-down ship moves forward automatically, and rocks scroll toward it. Steer left and right.
- **Beat sync on:** a new row of rocks arrives on each beat. **Off:** rocks are spaced at random.
- **Fail:** hitting a rock. **Win:** surviving to the end of the clip.
- **Art:** ship (top-down), rocks, water tiles (`floortiles/water.png`, `shoreline.png`).

### Cannonball Barrage (`cannonball_barrage`)
- **Prompt / hint:** `DODGE!` / `↑ JUMP  ↓ DUCK`
- **minDuration:** 4 s. **Beat sync:** optional. **Default hits:** `[0, 2]` (a ball reaches her on beats 1 and 3 of each bar)
- **Mechanic:** Side view on a deck. An enemy cannon on the right fires cannonballs high or low. Press up to jump over a low ball; hold down to duck under a high one (no ducking in mid-air).
- **Beat sync on:** every ball reaches the pirate on a beat map hit. **Off:** balls come at their own pace.
- **Graded per ball:** a dodge is a Perfect, a hit is a Miss (she flinches red). **Fail:** a quarter or more hit (the shared death fall). **Win:** reaching the clip end.
- **Art:** Cadence's side-view pirate (`idle_character/pirateside1`), her sideways jump frames, and the cannon (mirrored), cannonball, and firing frame. A sky and sea behind the deck can be hidden for a level video. Wanted: a crouch frame (ducking is a squash for now).

### Musket Volley (`musket_volley`), idea
- **Prompt / hint:** `DODGE!` / `ARROWS`
- **minDuration:** 4 s. **Beat sync:** no
- **Mechanic:** Bullet-hell lite. Musket shots streak across the deck in patterns, and the player moves in all 4 directions to weave between them.
- **Fail:** getting hit. **Win:** surviving to the end of the clip.
- **Difficulty:** denser patterns and faster shots.
- **Art:** pirate (top-down or side), musket flashes, bullets, redcoat ship.
