# Cat-Man 🐱

A maze-chase game for the browser. You are a cat in a back yard. Catch all the mice, and don't let the dogs catch you!

It works on tablets, phones and computers. No install is needed.

**Play:** https://jacowessels.github.io/cat-man/ (after the first deploy, see below)

## How to play

- **Swipe** up, down, left or right to steer the cat. On a computer, use the **arrow keys** or **WASD**. You can also turn on on-screen arrow buttons on the start screen.
- You can swipe just before a corner. The cat remembers the turn and takes it as soon as it can.
- Eat every **mouse** to finish the level. Each mouse is 10 points.
- **Catnip** 🌿 (50 points) scares the dogs for a few seconds. Catch scared dogs for 200, 400, 800 and 1600 points.
- A **fish** appears twice per level for bonus points.
- You start **every level with 3 lives**. Your score carries on from level to level.
- Each level is harder. The dogs get faster, chase more, and leave the kennel sooner. Catnip wears off sooner. Level 1 has 2 dogs, level 2 has 3, and level 3 and later have 4.
- Press **P** or the pause button to pause. The 🔊 button turns sound on and off.

On a tablet, use **Add to Home Screen** to play full screen like an app.

## Sound

The music is an original spy-thriller style tune in 5/4 time. The meows, mouse squeaks, barks and growls are all made in code with the Web Audio API, so the game has no audio files.

## High scores

Scores are saved in the browser on each device (`localStorage`), and the top 10 are kept. The game remembers the last player's name.

`js/scores.js` describes the score store's two methods: `submit` and `top`. A shared online leaderboard (for example Supabase or Firebase) can be added later as another store with the same methods. The rest of the game will not need to change.

## Run it on your computer

It is plain HTML, CSS and JavaScript, with no build step.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

Run the tests (Node 20 or later):

```bash
npm test
```

## Deploy (free, with GitHub Pages)

`.github/workflows/deploy.yml` runs the tests on every push and pull request. Each push to `main` also publishes the game to GitHub Pages.

One-time setup:

1. The repository must be public. GitHub Pages is free for public repositories.
2. In GitHub, go to **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Merge to `main`, or run the workflow by hand from the **Actions** tab.

The game will be at `https://jacowessels.github.io/cat-man/`.

## Code layout

| File | What it does |
| --- | --- |
| `js/maze.js` | The maze layout and tile rules |
| `js/movement.js` | Tile-by-tile movement and turn buffering |
| `js/dog.js` | Dog personalities and how they chase |
| `js/levels.js` | Difficulty settings for each level |
| `js/game.js` | Game rules: scoring, lives, levels, catnip |
| `js/render.js` | Drawing on the canvas |
| `js/audio.js` | Music and sound effects |
| `js/input.js` | Swipe, keyboard and arrow-button controls |
| `js/scores.js` | High scores |
| `js/main.js` | Screens and wiring everything together |
