# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

Tempus is a Google Apps Script time, invoice, expense, assessment, and BAS evidence application backed by Google Sheets. It is a sister project to Aurum (`../aurum`). See `README.md` and `docs/` for details.

## Development Commands

- `npm test` runs the test suite locally against an in-memory Apps Script/Sheets harness (no Google credentials needed).
- `clasp push` deploys. **Never run it automatically.** Brandon deploys manually.

## Work Tracking (beads)

This project uses **bd (beads)** for issue tracking and work planning. The database lives on the homelab Dolt server (configured in `.beads/`), not in markdown files.

- **Plan work in beads.** Before writing code, find or create the issue it belongs to. For anything bigger than a quick fix, break it into an epic with child tasks (`--parent=<id>`) and dependencies (`bd dep add`) instead of writing a plan document or TODO list.
- **Start of session:** run `bd prime` for the workflow reference (hooks may already inject it), then `bd ready` to see unblocked work.
- **While working:** `bd update <id> --claim` when you start. Record discoveries as new issues rather than widening scope, and link them back with `--deps discovered-from:<id>`.
- **Finishing:** `bd close <id> --reason="..."` once the acceptance criteria are met, then check `bd ready` for anything newly unblocked.
- Write issues so another agent can pick them up cold: include the problem, relevant files, the intended approach, and `--acceptance` criteria.
- Never use `bd edit` (it opens an interactive editor). Use `bd update <id> --description/--notes/--design` instead.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
