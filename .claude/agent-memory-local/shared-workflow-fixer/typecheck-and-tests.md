---
name: typecheck-and-tests
description: How to run effortless's tests and a type check here; `tsc -p .` cannot run as configured (tsconfig extends a missing file).
metadata:
  type: reference
---

- Tests: `bash tools/test.sh` (runs `claude plugin test .`). About 30 s. Last full run: 237 pass, 0 fail (band, judge-stats and the click-while-judging test work).
- `npx tsc --noEmit -p .` fails before checking: `tsconfig.json` extends `./.claude-plugin/types/tsconfig.json`, which does not exist. There is no `node_modules` and no global `tsc`.
- A TypeScript 5.9.3 is in `~/.cache/opencode/node_modules/typescript/bin/tsc`. Use a scratch `tsconfig.json` (jsx react-jsx, strict, bundler resolution, include `hooks/*.ts(x)` and `types/*.d.ts`) and diff the output against HEAD (`git archive HEAD hooks types`). The `claude-code` package types are missing, so the baseline already shows many implicit-any errors. Compare, do not read them as absolute.
- Scratch-config method used on 2026-11-09: `git archive HEAD hooks types` into a scratch dir, a tsconfig with jsx react-jsx, strict, bundler resolution, include hooks/*.ts(x) and types/*.d.ts; HEAD and the working copy both give 127 errors (mostly missing claude-code types). Compare the messages with line numbers stripped.
- Re-check this before relying on it: the tsconfig, the cached compiler path and the test count can all change.

**Why:** these are the commands that were needed to verify a refactor, and the `tsc -p .` failure is not obvious from the repo.
**How to apply:** when asked to typecheck this repo, go straight to the scratch-config diff method and report that `-p .` is broken.
