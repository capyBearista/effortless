---
name: test-harness-facts
description: How effortless's test harness (claude-code/testing) behaves: seeding the store, denied $ calls, desktop Text keys, command.run without a host answer.
metadata:
  type: reference
---

- `mock.store(on, entries)` seeds the plugin's store. effortless's `engine(on, env, model, said, seed)` passes the seed through. Seeded `savedSettings` is read only at `$.session.start`, so a test can change Min/Max by seeding it and then starting the session again.
- A test's `$` has no `store`: write settings through `mock.store` seeds, not `$.store.set`.
- A `{ deny }` answered by a test hook on `command.run` resolves to `{}` through the plugin's `next(e)`: it does not reject. A run that no hook answers does reject (`HooksError: no implementation for command.run`), so a test that needs `$.command.run` to fail should leave the command unanswered.
- A desktop Text's `key` is not in the drawn JSON. Find a desktop word by its children, e.g. `toContain('"children":["High"]')`. Buttons keep `key` and `press` works on them (`band.press({ key: 'dash-e-high' })`).
- A session start with `setupDone` unset opens the setup guide over the band; seed `setupDone: true` when the test needs the band after a second start.
- `mock.clock(on)` is needed for any test that calls `/effortless save`, `debug` or `stats` (they read the clock).
- A handler may return a Promise: `on('model.complete', async () => { started(); await gate; return {...} })` holds a judge open, so a test can press a button while it runs (verified 2026-11-09).
- `ui.find({ key })` returns the Button's props as JSON, so `"label":"low · manual"` is checkable (verified 2026-11-09).
- A read inside a hook after an `await` can still give the value from before another hook's write: the judge's hook still saw Auto on and no pick after a click that the band (another hook) drew as Auto off. Carry hand changes across hooks through module state, as `heldPick` and `engineEffort` do (verified 2026-11-09, `handChanges` in hooks/register.tsx).
- A sibling module may call `$`, but past an import the engine follows `$` only into a function DECLARATION (`function f($) {}` / `async function f($) {}`). A `const f = ($) => ...` that receives `$` makes the whole hooks module fail to load (`claude plugin validate` exits 1; every test fails with a HooksError). So every function that takes `$` in a split-out file must be a declaration (verified 2026-11-09, hooks/env.ts). Check with `claude plugin validate . --json`: the `./register.tsx calls:` note must list the same `$.x.y` set as before.
- `read($, X)` and `update($, X, …)` need X to be an `atom(...)` const declared in the same file as that call (or an inline atom). An atom imported from another module makes the hooks module fail to load: `HooksError: … the state library's read takes a source the scan can read`, `claude plugin validate` exits 1, and every test fails. A scratch copy of HEAD showed this for both read and update; a same-file control passed (verified 2026-11-09). So atoms cannot move to a sibling module without the read and update calls that use them.
- Update this when the harness changes (it was read from the claude-code testing types on 2026-11-09).

**Why:** each of these cost a failed run while writing the band tests.
**How to apply:** when a new band or settings test fails with a harness error rather than an assertion, check these first.
