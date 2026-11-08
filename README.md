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

Touch friendly divers to bring them aboard (six maximum). Surface anywhere to drop off one diver and slowly refill oxygen. Surfacing with no diver aboard explodes the sub. Dive and surface again to drop another. Surfacing with six divers clears the boat and awards an extra life. Torpedoes destroy sharks, jellyfish, eels, and enemy submarines. Running out of oxygen, or colliding with an enemy or an enemy torpedo, costs a life. You start with three lives.

Score: shark 40, jellyfish 50, eel 70, enemy sub 80, each delivered diver 100. Spawn rate, enemy speed, and oxygen drain rise as the score climbs. Enemy submarines begin firing after 500 points. A siren sounds while the oxygen bar is red. Press M to mute.
