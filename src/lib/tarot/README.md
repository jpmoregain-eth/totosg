# Tarot of Fortune — v1.2

An offline TypeScript tarot interpretation and entertainment-number engine, extending v1.1.

## v1.2 changes
- 132 independently authored Simplified Chinese card-by-topic reflection prompts (22 cards × 6 topics), in addition to the existing 132 English prompts.
- More substantive Chinese upright/reversed narrative passages.
- `explainNumberSymbolism(draws, locale)` exposes each selected card's fusion name, element, and symbolic digit metadata.
- Number results include `numbers.symbolism` and retain **uniformly randomized** 4D/Toto generation. Tarot numerology does not affect lottery odds or selection probability.
- 15 curated card-combination rules retained, with five-element narrative links and all six questions.

## Files
- `tarotEngine.ts`: v1.2 orchestration, interpretation, localization and symbolic metadata.
- `legacy-v1.ts`: card catalogue, question definitions and unbiased lottery generators.
- `test.cjs`: automated tests (Node).

## Integrate
Provide a cryptographically secure `RandomBytes` implementation using a maintained React Native native crypto provider. `Math.random()` is not suitable. Example:

```ts
import {prepareSpread,revealSelection,createReading} from './tarotEngine';
const bytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const prepared = prepareSpread('luck_today', bytes);
// Show facedown cards in the prepared order, then collect selected indices.
const draws = revealSelection(prepared, [3], bytes);
const reading = createReading('luck_today', draws, 'zh', bytes, true);
console.log(reading.interpretation, reading.numbers?.symbolism);
```

`crypto.getRandomValues` must actually be available through a verified secure RN provider. Commit to the shuffled deck before user selection. Save the `version`, `questionId`, `draws`, `locale`, full text and generated numbers with each reading. The current API enables number output for the `luck_today` question only, as configured in `legacy-v1.ts`.

## Build and verify
```sh
tsc --strict --noEmit --target es2020 tarotEngine.ts legacy-v1.ts
tsc --strict --target es2020 --module commonjs --outDir build tarotEngine.ts legacy-v1.ts
node test.cjs
```

## Remaining limitations
This is a **rule-based** system, not a language model. The Chinese lenses are unique by card and topic, but are intentionally concise; richer editorial copy can be added later. Card illustrations, UI, persistence and device integration are not included. Card number attributes are invented for this entertainment experience, not traditional canonical correspondences or predictions. Do not frame outputs as instructions to wager, financial advice, or health forecasts. Store approval is not guaranteed by an 18+ rating.
