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
