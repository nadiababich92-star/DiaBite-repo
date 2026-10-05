---
name: implementation-specs
description: >
  Expands the approved engineering document (docs/engineering/engineering-doc.md)
  into granular, buildable implementation specs for DiaBite. Use it after
  /engineering-planner and before any code is written. Trigger when the user
  says "generate implementation specs", "break the plan into buildable specs",
  "what do I need to start building", or asks for a migration or env list.
---

## Input
`docs/engineering/engineering-doc.md`, approved by the user.

## Steps
1. **Read** the engineering doc in full, then `CLAUDE.md`.
2. **Identify** each distinct concern: an endpoint, a tool change, a prompt
   change, a screen, a table, an eval.
3. **Decide the files from the plan**; do not use a fixed list. Write them to
   `docs/specs/`, each named for what it specifies.
4. **Do not ask clarifying questions.** Everything was decided in the plan; if
   something was not, stop and say the plan is incomplete.

## Every spec file is
- **Self-contained** — a developer can read it alone and know what to build.
- **Concrete** — types, paths, error shapes, exact copy for user-facing text.
- **Verifiable** — it ends with the checks that prove it works: the eval cases
  to add, the tool-result fields a check should read, the screen to look at.

## Always include, when the plan touches them

**`supabase/migrations/<timestamp>_<name>.sql`** — follow the existing
`supabase/migrations/` convention. Must run on the live project without
errors and be safe to apply twice. Enable RLS on every new table and write the
policies; a table with no policy is a table nobody can use, and a table with a
loose one is a leak. Remember PostgREST returns at most 1,000 rows unless the
client pages.

**`.env.example`** — add every new variable, grouped by service, empty, each
with a comment saying what it is and where to get it. Mark anything that must
never reach the browser `# SERVER ONLY`. Vite inlines every `VITE_*` value into
the bundle, so nothing secret may carry that prefix.

**Evaluation cases** — additions to `eval/cases.json` (engine and agent), with
the expectation each one asserts. A feature without cases is not finished.

## After generating
Print each file created with its path and one sentence on what it specifies.
Then stop and wait for approval before Stage 3.
