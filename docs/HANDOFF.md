# HANDOFF: effortless (capyBearista fork), version-free prompts, clean-up and a partial split of register.tsx

## Objective

- **Request:** in the personal fork `capyBearista/effortless` (a Claude Code mod that picks the reasoning effort for each prompt):
  1. remove model version numbers from prompts and UI text, so the plugin works for future releases;
  2. split the 5,000-line `hooks/register.tsx` where possible;
  3. remove dead weight left by the upstream author.
- **Next-session goal:** not chosen yet. Likely candidates: the real-app checks below, a release bump, then more of the split if the user wants it.

## Current state

- **Branch:** `chore/versionless-and-cleanup`, one PR, 12 commits on top of `main` (`82007a6`). Not pushed and no PR opened yet.
- **Verified with tools:** `bash tools/test.sh` 237 pass, 0 fail. `claude plugin validate .` passes and its `$.x.y` call set is identical to `main`. A scratch typecheck against the real plugin types matches the baseline (41 errors that were already there). No import cycles. Every `bench/hard/tasks.json` snippet occurs once in its `file`.
- **Reviewed:** one independent Sonnet review: 0 critical, 0 important, 3 minor, 4 info. Minor items are handled or listed below.
- **Not verified:** anything in the real desktop app, `tools/render-band` renders (they need the app), and bench runs (they read `git archive HEAD`).
- **Version:** `.claude-plugin/plugin.json` is `1.71.0-fork.12`. No bump yet; `/plugin` will not install this branch until it is bumped.
- `register.tsx` went from 5,339 to about 3,900 lines. New modules: `env.ts`, `config.ts`, `judge.ts`, `handoff.ts`, `stats.ts`, `usage.ts`, `svgs.ts`, `setup.ts`.

## Decisions and constraints

- **Haiku id stays pinned:** `HAIKU_MODEL = 'claude-haiku-5-5'` in `hooks/config.ts`. Older Claude Code builds map the plain `haiku` alias to a much pricier Haiku. The user chose to keep the pin. Do not switch it to the alias.
- **Versions removed from:** the judge prompt (`MODEL_LEVELS` in `hooks/judge.ts`), UI text, `plugin.json`, `types/index.d.ts` and most of the README. A test fails if a digit-dot-digit appears in the judge instructions.
  - Kept on purpose: the benchmark table and "## Models" quote in the README, `bench/`, and session-model ids such as `claude-opus-5-5` in test fixtures.
  - The edited prompt was not re-scored on decisionbench (its holdout is spent). A comment in `judge.ts` says so.
- **Split is pure moves only** (user's choice). Two engine rules force it:
  1. `$` is followed past an import only into function declarations (`function f($)`), not arrow constants. An arrow that receives `$` makes the whole module fail to load.
  2. Every `read($, X)` / `update($, X, …)` must name an `atom(...)` declared in the same file. Atoms, and any code that reads or updates one, stay in `register.tsx`. The first attempt at a `state.ts` module broke plugin loading for this reason.
  - Both rules are in `.claude/agent-memory-local/shared-workflow-fixer/test-harness-facts.md`.
  - Two setters exist (`setConfig`, `setLoadedSession`), added in the first two moves. This breaks the later "no setters" rule on purpose; it is harmless because ES bindings are live.
- **Progress bar and sounds removed.** The code was never wired in. Hide keys `progress` and `sounds` are gone; `readConfig` drops them from old saved settings.
- **`.claude/` is tracked** except `settings.local.json`. `docs/HANDOFF.md` is tracked.
- **Earlier decisions that still hold:**
  - cache safety follows the model family, not the version (`cacheSafe` in `config.ts`);
  - no migration code for old stats;
  - stacked PRs only for big changes (this work is one PR by request);
  - never push to upstream `HeyCubit/effortless`.

## Work completed

- `1c9949b` housekeeping; `67b6bfb` dead weight (about 26,000 lines: mockups, specs, sounds, progress bar); `6a4a54d` version-free text.
- `e52819f` env, `2d515bc` config, `68e297b` judge, `0f240f5` handoff, `606b21e` stats and usage, `557f445` svgs and theme colours, and the setup commit: each is a verified verbatim move.

## Investigations and pitfalls

- A split commit can pass the tests while a band is broken: the AbovePrompt hook swallows a missing import into `lastRenderError`. Always run the typecheck diff, not only the tests. `tsc -p .` is broken (its base config is missing), so use a scratch tsconfig that includes the plugin's `claude-code.d.ts` and compare errors with line numbers and union order normalised.
- Plugin API types ship with the installed Claude Code (`plugin-authoring/types/claude-code.d.ts` in its bundled skills); the path changes per session, so find it with a glob.
- `claude plugin validate . --json` lists the `$` calls the engine sees ("./register.tsx calls:"). Compare it before and after any move.
- Claude Code 2.1.321 changed `$.ui.mount`: use the `drawsNothing` helper in the tests, never `rejects.toThrow()`.
- Bench runs read `git archive HEAD`: a bench change shows only after a commit.

## Remaining work

1. **Real-app checks** (none done): change Theme and a setting in the panel and watch the accent and band update (cross-module `export let` bindings); click a level; save mode; `/compact` with Haiku; a Fable session with `EFFORTLESS_LOG` set.
2. **Release:** bump `plugin.json` when the user asks.
3. **Leftovers from the review (minor):** README lines about the benchmark and the "## Models" note still name versions on purpose; decide if the "## Models" sentence should be family-level.
4. **More split, only with a design change:** the render blocks, bars, bands and settings stay in `register.tsx` because they share atoms. Moving them needs store accessors (about 200 call sites), which is a rewrite, not a move.
5. **Known follow-ups:** `ICE` lives in `usage.ts` while `ICE_BG` and `ICE_EDGE` are in `svgs.ts`; `tests/effortless.test.ts` has an unused `ART_COLUMNS` import; `hooks/progress.tsx` now holds only the step model and drawing helpers, so its name is misleading; `tsconfig.json` is broken; the items in `docs/known-issues.md`.
6. **Optional cleanup:** delete the three merged remote branches `feat/decision-chain`, `feat/fable-tuned-prompt` and `feat/band-and-fallbacks`.

## Resume instructions

- Start: `git status -sb && git log --oneline -14`, then `bash tools/test.sh`. Expect 237 pass.
- Read first: this file, `docs/known-issues.md`, `README.md` "## Models", and the two engine rules above before moving any code.
- Suggested skills: `plugin-authoring`, `shared-workflow:systematic-debugging`, `shared-workflow:verification-before-completion`.
- Avoid repeating: switching the Haiku pin; moving atoms out of `register.tsx`; arrow-function helpers that take `$` in other files; calling anything verified before the real-app check.
