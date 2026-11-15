# Gemini and ElevenLabs

The fights are run by three parts working together:

- **The engine** (`src/encounter.js`, `src/bosses/`) owns every number and decides every win and loss.
  Each boss is a list of *moves* with fixed rules.
- **Gemini** gives the fight its voice. Each turn it narrates what the engine decided and offers
  about three FIGHT and three FLEE options. Each option is a label, one of the boss's moves and a
  risk tier (cautious / steady / reckless). SPEAK is typed by the player: Gemini reads the words as
  one of the boss's moves and judges the idea (weak / solid / inspired).
- **ElevenLabs** reads everything aloud: story pages, every turn, and the end screens.

Gemini never changes a number. Every option it offers is checked against the rules again in the
game before it is shown, and anything invalid is dropped.

## Run the game

```sh
npm ci
npm run dev
```

The AI only works through `npm run dev` or `npm run preview`, because the keys are used by that
local server (`server/ai.js`) and never sent to the browser. A plain upload of `dist/` (for
example to itch.io) still plays, but silently and with each boss's plain built-in options.

## Configure

1. Copy `.env.example` to `.env`.
2. Fill in `GEMINI_API_KEY` and `GEMINI_MODEL` (a fast model, e.g. `gemini-3.5-flash-lite`).
3. Fill in `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL_ID`.
4. Restart `npm run dev` after changing `.env`.

`.env` is ignored by Git. Do not use `VITE_` prefixes for keys: Vite exposes those to browser code.
`http://localhost:3001/api/status` shows whether both sets of keys were found.

## If something fails

- Gemini is overloaded or unreachable: the server retries, then tries stand-in models. If that
  also fails, the turn is told with the engine's own plain text and menu, so a fight never stalls.
- ElevenLabs is unreachable: the game carries on without the voice.
- Server errors are printed in the `npm run dev` terminal, prefixed with `[ai]`.

## Costs

Every spoken line is saved in `.cache/narration/` and reused, so story pages and end screens are
only paid for once. Turn narration is new each time (about 150-230 characters per turn).
Delete `.cache/` after changing the voice if you want old lines re-read.

## Adding or changing a boss

In the boss's file under `src/bosses/`:

- `scene` sets the scene for the narrator: the place, the monster's character, what is to hand.
- `rules` explains in words how the fight is won and lost.
- `describe(state)` says where the fight stands right now, in plain words.
- `moves` are the rules themselves. Each has an `action` (fight / speak / flee), a `hint` telling
  Gemini what it does, and `run`, which changes the numbers.

Then add the boss to `BOSSES` in `server/ai.js` and to `LEVELS` in `src/main.js`.

Before exposing the dev server to anyone else, add authentication and usage limits: the endpoints
spend your API credits.
