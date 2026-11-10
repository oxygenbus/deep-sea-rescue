# Deep Sea Rescue

A browser game about piloting a rescue submarine. Artwork, colors, and code are original. No install, build step, or external assets.

## Run

From this folder:

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000) in a browser.

## Controls

- Arrow keys or WASD: move
- Space: fire torpedo
- P: pause / resume
- Enter: start, or play again after game over
- M: mute / unmute
- On-screen buttons: Start, Pause/Resume, Restart

## How to play

Touch friendly divers to bring them aboard (six maximum). Surface anywhere to drop off one diver and slowly refill oxygen. You cannot dive until that oxygen bar is full. Surfacing with no diver aboard explodes the sub. Patrol boats cross the surface and destroy the sub on contact. Dive and surface again to drop another. Surfacing with six divers clears the boat and awards an extra life. Torpedoes destroy sharks, jellyfish, eels, and enemy submarines. Running out of oxygen, or colliding with an enemy or an enemy torpedo, costs a life. You start with three lives.

Score: shark 40, jellyfish 50, eel 70, enemy sub 80, each delivered diver 100. Spawn rate, enemy speed, and oxygen drain rise as the score climbs. At higher scores, enemy submarines arrive two or three at a time. Enemy submarines begin firing after 500 points. The best score is shared across players and kept in `data/highscore.json`, so a new deploy does not wipe it. A siren sounds while the oxygen bar is red. Press M to mute.
