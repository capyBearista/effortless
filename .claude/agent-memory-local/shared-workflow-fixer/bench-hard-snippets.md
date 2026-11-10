---
name: bench-hard-snippets
description: bench/hard/tasks.json snippet `file` fields are read from `git archive HEAD`, so after a code move they resolve only once the commit lands.
metadata:
  type: reference
---

- bench/hard/run.sh, verify.cjs and helpers/agentic runners build their repo copy with `git archive HEAD` (run.sh:26, verify.cjs:16). A snippet's `file` is therefore the committed path, not the working copy.
- After moving a snippet's code to another file, its `file` field must name that file. The check (all counts 1) only passes on the working copy; the bench itself only sees the new path after the commit.
- Checked 2026-11-09 during the judge split: tasks b5, b8 and b10 moved to hooks/judge.ts.

**Why:** a split that moves bench snippets looks green in the working copy, but the bench plants from HEAD.
**How to apply:** when a split moves code that a bench task's `find` names, update that task's `file`, rerun the count one-liner from split-rules.md, and note in the report that bench runs need the commit first.
