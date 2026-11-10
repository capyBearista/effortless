# HANDOFF — effortless (capyBearista fork): decision chain, Fable judging, band fixes merged

## Objective

- **Original request:** in the user's personal fork `capyBearista/effortless` (a Claude Code mod that picks the reasoning effort for each prompt):
  - check the review comments on the stacked PRs #8–#10 and judge each one;
  - check prompt caching for Fable 5.2;
  - make sure future releases of the same model family (Opus 6.1, for example) still work;
  - fix the review findings that were not dropped;
  - reply to the review threads;
  - merge the stack and sync `main`.

  All of this is done.
- **Next-session goal:** not chosen yet. The likely candidates are the real-app checks (Remaining work, item 1), then a release bump (item 2). Ask the user first.

## Current state

- **Status:** merged. Verified by tests only. **No real-app check has been done.**
- **Repo / branch / PR:**
  - Local branch: `main` at `dfbc106`, level with `origin/main`.
  - PRs #8, #9 and #10 were merged in that order, with merge commits `2c12c3d`, `66c6cd2` and `dfbc106`. Before each merge, I checked that the rebased head's tree was unchanged. The final tree on `main` is identical to `ecb25e9`, the commit that was tested and reviewed.
  - Issue #6 (judge Fable) is closed.
  - The remote branches `feat/decision-chain`, `feat/fable-tuned-prompt` and `feat/band-and-fallbacks` are kept and not deleted.
- **Working tree / artifacts:**
  - Clean, except an untracked `.claude/` folder. It holds local agent memory and `settings.local.json`. Never commit it.
  - This file is excluded from git through `.git/info/exclude`.
- **Version:** `.claude-plugin/plugin.json` is still `1.71.0-fork.11`, so `/plugin` reports "already at the latest" and does not install the merged code. A version bump is needed before the user can run it.
- **Verification:**
  - `bash tools/test.sh` on `ecb25e9`: 241 pass, 0 fail. This runs `claude plugin test .` with the installed Claude Code 2.1.321.
  - Code review: one Sonnet `code-reviewer` pass on the fix commit. It found nothing critical or important.
  - CI on #10: the "PR Reviewer / Multi-agent review" check failed. The user said the failure was not caused by this code and told me to merge. No new review comments arrived for `ecb25e9`.
  - Not verified: anything in the real app, and typechecking. `tsc -p .` fails because `tsconfig.json` extends a missing `./.claude-plugin/types/tsconfig.json`.

## Decisions and constraints

- **Cache safety follows the model family, not the version.** This was the user's decision this session. `cacheSafe` (`hooks/register.tsx:~27`) is `/opus|sonnet|haiku|fable/`, so every release of those four families is treated as keeping the prompt cache when effort changes. Only models outside the four families pause Auto.
  - There is no version or provider check. This limit is stated in the README's "## Models" section.
  - The user won't use older models.
  - A side effect: Haiku 4.5 is no longer paused, and Auto may try to set an effort on it.
- **Evidence for Fable 5.2:**
  - Claude Code's docs (https://code.claude.com/docs/en/prompt-caching, "Changing effort level") say "keeps the cache on Fable 5.1 and later, Opus 5.5, Sonnet 5.5, and Haiku 5.5". This holds with an API key or a subscription, but not on Bedrock, Google Cloud's Agent Platform, a Claude apps gateway, with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` set, or in a HIPAA organisation.
  - The API's effort docs list Fable 5.2 among the models with per-message effort, which keeps the cache.
  - Nothing was measured.
- **Model-family detection:**
  - `keyOf` (`:~1069`) and `sessionModel` (`:~1121`) match family names as substrings, so future IDs map to the right family.
  - `MODEL_LEVELS` text still names "Opus 5.5", "Fable 5.1" and so on. A new release gets the old release's tuning.
  - An unknown family falls back to `'sonnet'` in `sessionModel`.
- **Review dispositions (replies are on each thread):**
  - **Won't fix (no migration code, by design):** the legacy `judge.jev` and `judge.haiku` stats shapes.
  - **Won't fix:** try/catch around `resettle`.
  - **Not changed:** helper fallback. It is already logged as ", none applies".
  - **Unproven, to check in the real app:** whether `$.command.run` resolving really means the level changed (`pickEffort`).
  - **Left open on GitHub:** the #8 and #9 test-gap threads, which are only partly addressed. The #10 threads were replied to but not resolved, as the user asked.
- **New rule from the user:** stacked PRs are only for significant changes. A couple of commits go in one PR. This is saved in agent memory.
- **Earlier settled decisions still hold:**
  - Judge options are `auto` and `haiku`.
  - The judge prompt is decisionbench's tuned prompt plus `EFFORT_RULES`.
  - The unsure threshold stays at confidence 0.5.
  - A click is a manual pick with Auto off, run through `/effort`.
  - The holdout evidence is in decisionbench `/home/arjun/decisionbench-tune-nov8b/holdout/`. The holdout is now spent.

## Work completed

- **`ecb25e9`, merged as `5e96df6` by #10:** "Fork: review fixes, and every Opus, Sonnet, Haiku and Fable release keeps the cache".
  - `typedTypesafeKey` handles a pasted `TYPESAFE_API_KEY=…` line for both Save and Test. A line with no value falls back to `routeKey`.
  - `saveTypesafeKey` returns a boolean, and the setup step stops when a save fails.
  - `modelIs`: on a model switch with no sure answer for the new model, the judged pick keeps its level with `why: UNSURE`, so the band shows "kept".
  - `saveSetting` calls `resettle`, so a Min or Max saved in the panel re-bounds the pick at once.
  - The verdict block checks `handChanges === handsBefore` again just before `choose`. In that window the stats and the proof line still count the verdict, and a comment says so.
  - `countPrompt` adds judge tokens only when there is a judge kind.
  - `cacheSafe` matches the family. The dead Haiku hover text was removed.
  - README "## Models" now states the limitation.
  - Tests:
    - a new `drawsNothing` helper (see Pitfalls) replaces 15 assertions that expected a mount to throw;
    - new tests for the pasted key in the setup step, the draft key in Test, a lower Max saved in the panel, and a switch with no answer;
    - the Haiku 4.5 test and the handoff-fork cache test now use `'some-other-model'`.
- **Earlier in the stack (already described in the PR bodies):**
  - `9cef118` / #8: decision models replace the Jev-only path.
  - `260f69b` / #9: Fable judged, tuned prompt.
  - `de8502a` / #10: band labels kept/manual, click sets the effort, Haiku-fallback reasons.

## Investigations, attempted approaches and pitfalls

- **Claude Code 2.1.321 changed `$.ui.mount`.** When the plugin draws nothing, the mount no longer rejects. It resolves, and `drawn()` returns `{"type":"engine","ref":N}`. This made 14 tests fail on the unchanged branch.
  - Use `drawsNothing($, at)` in `tests/effortless.test.ts`. Never use `rejects.toThrow()` on a mount.
  - The test runner uses the installed `claude`, so an app update can break tests on its own.
- **`git checkout -p` reverted more than intended.** It removed a whole hunk, which contained an unrelated test edit next to the probe line. Check `git diff` after any partial revert.
- **Stacked merges:** `gh pr merge` refuses a PR that is part of a stack. Use `gh api -X PUT repos/capyBearista/effortless/pulls/N/merge-async -f merge_method=merge -f merge_action=direct_merge -f sha=<head>`, then wait for `MERGED`. GitHub rebases the next PR and gives it a new head. Check `git diff --quiet <old>^{tree} <new>^{tree}` before each merge.
- **Review-fix placement:** all fixes for #8 and #9 went into #10's branch. That is fine for a merge of the whole stack, but it would have left `main` buggy if #8 or #9 had been merged alone. Another reason to avoid small stacks.
- **Chain order:** `opencode/jev-1.13-free` is first in the user's chain and returned HTTP 429 (free quota) in benchmark runs. Not changed.
- **Plugin API types** are at `/tmp/claude-1000/bundled-skills/<version>/…/plugin-authoring/types/claude-code.d.ts`. The path changes between sessions. In the test UI, `ui.input({key,text})` submits, and `kind:'change'` only types.

## Remaining work

1. **Real-app checks.** Done when, in the `minimal` layout:
   - clicking a level sets it, and the level holds on the next prompt;
   - a click made while the judge runs keeps the click;
   - save mode and a lower Max saved in the panel re-bound the level at once;
   - a kept level shows "kept";
   - `$.command.run` really moves the app's effort (this settles the unproven #10 thread);
   - a Fable 5.1 or 5.2 session with `EFFORTLESS_LOG` set shows a `fable` judgement in the proof log, and the request goes out at that effort.
2. **Release:** bump `.claude-plugin/plugin.json`, for example to `1.71.0-fork.12`, and push to `main`, but only when the user asks. Without the bump, `/plugin` won't install the merged code.
3. **Open test gaps:**
   - #8: no check that the TypeSafe route is appended to an existing chain;
   - #9: no end-to-end test of a decision model setting Fable's level, and none of the Haiku retry or the kept level when Fable's answer is missing or unsure;
   - #10: no test for the late-click window.
4. **Known follow-ups (ask which matter):**
   - `resettle` replaces a decision model's own `why` with the sure words;
   - a held lower verdict can still apply after a click plus an Auto toggle;
   - the desktop minimal look shows no kept or manual label;
   - `MODEL_LEVELS` names exact versions;
   - module-level `let` state is drawn by the band;
   - `tsconfig.json` is broken;
   - a `console.log` (AGENT_TREE) sits at about `tests/effortless.test.ts:3352`;
   - a full handoff turn runs at Medium while the band shows the pick.
5. **Optional cleanup:** delete the three merged remote branches if the user wants.
6. **Decisionbench:** a new round needs new holdout Cases from the user. Issue `capybearista/decisionbench#17` is open.

## Resume instructions

- **Start here:** `cd /home/arjun/effortless && git status -sb && git log --oneline -3`. Expect `main` at `dfbc106`. Then ask the user: real-app checks, or release bump first?
- **Read first:**
  - `README.md`, the "## Models" section;
  - `docs/known-issues.md`;
  - `hooks/register.tsx`: `cacheSafe`, `modelIs`, `resettle`, `saveSetting`, `pickEffort`, and the verdict block in `prompt.submit`;
  - the merged PRs https://github.com/capyBearista/effortless/pull/8, /9 and /10, including the review replies.
- **Suggested skills:**
  - `run` or `plugin-authoring`: real-app checks and engine API types;
  - `shared-workflow:systematic-debugging`: any failure found there;
  - `shared-workflow:verification-before-completion`: before claiming done;
  - `shared-workflow:gh-cli`: GitHub work.
  - The user's preferred subagents: `shared-workflow:fixer` (Haiku, xhigh) to implement and `shared-workflow:code-reviewer` (Sonnet, medium) to review.
- **Avoid repeating:**
  - adding version or provider gates to `cacheSafe` (the user rejected them);
  - migration code for old stats;
  - stacked PRs for small changes;
  - committing `.claude/` or this file;
  - pushing to upstream `HeyCubit/effortless`;
  - calling the band fixes verified before the real-app check.
