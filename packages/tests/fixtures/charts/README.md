# Test charts

Hand-picked `.osu` beatmap difficulties used by the performance scenarios in
[`src/scenarios.test.ts`](../../src/scenarios.test.ts). Each file is one mania
difficulty; tests load it by filename with `loadBeatmap('<file>.osu')`.

## Adding a chart

1. Get a single `.osu` difficulty (unzip an `.osz` and copy the difficulty you
   want, or export one). The repo already has 100+ `.osz` under
   [`packages/client/public/beatmaps/`](../../../client/public/beatmaps/) to pull from.
2. **It must be 4K mania** (`Mode: 3`, `CircleSize: 4`). The bot's strain
   analysis assumes 4 columns - other key counts won't simulate correctly.
3. Drop it here with a clear name (e.g. `hard-aiae-mx.osu`) and reference that
   name in a scenario.

## Writing a scenario

```ts
import { runScenario } from './harness';

// the whole bot plays (every skill contributes)
runScenario('expert · hard chart · all L60', {
  chart: 'hard-aiae-mx.osu',
  skills: 60,                            // a number = every skill at that level…
  // skills: { accuracy: 80, speed: 60 },// …or per-skill levels (rest → 0)
  runs: 20,
  expect:   { score: 994_000, accuracy: 0.999, grade: GRADE.S, fail: false },
  tolerance:{ score: 15_000, accuracy: 0.01, gradeTiers: 1 },   // optional
});

// one skill scored in isolation (strain-debug mechanism: every note judged by
// only that skill's strain offset - other skills don't matter)
runScenario('accuracy-only · L20 · medium chart', {
  chart: 'medium-aiae-nm.osu',
  skill: 'accuracy', level: 20,
  expect: { accuracy: 0.99, grade: GRADE.S },
});
```

### Metrics

| `expect` field | meaning | tolerance key |
|---|---|---|
| `score` | mean total score (0–1,000,000) | `score` |
| `accuracy` | mean accuracy (0–1) | `accuracy` |
| `grade` | typical (modal) grade | `gradeTiers` (grade-tier distance) |
| `fail` | should the play fail (HP→0)? checked vs fail rate | `failRate` |
| `failTime` | song time (ms) of failure - *how soon / how late* HP hits 0 | `failTime` |

Every metric is a **tolerance band** (the bot is stochastic, so nothing is
exact). The run prints an expected-vs-actual-vs-Δ report regardless of pass/fail.
Omit a metric from `expect` to skip it.

Need raw numbers instead of pass/fail? Call `aggregate(input)` (also in
`harness.ts`) and assert on `meanScore` / `meanAccuracy` / `modalGrade` /
`failRate` / `meanFailTime` yourself.

> Beatmaps are the property of their respective mappers / artists; they're
> included here only as test fixtures.
