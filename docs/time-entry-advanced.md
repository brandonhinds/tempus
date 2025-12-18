# Advanced Punch Entry

Guide to the punch-based entry flow.

## Overview
- Stores an ordered list of punch ranges per entry; open punches are ignored until closed.
- Requires a contract; hour type optional unless the selected type requires a contract (flagged).

## Core Controls
- Contract selector filtered by contract validity for the chosen date.
- Hour type (when `hour_types` enabled); selection can auto-require a contract.
- Punch list: each row has In/Out times with Add/Remove.
- Punch In/Out toggle switches between opening a new punch and closing the latest open punch.
- Save/Update buttons; Delete when editing an existing entry.

## Behavior
- Focus jumps to the first empty field; Enter key attempts to save after syncing current inputs.
- Prevents switching to manual if an advanced entry already exists for the date/hour type.
- End-time suggestion appears when `suggest_end_time` flag is on.
- Contract change re-renders punches for that date/contract, loading an existing entry if present.

## Editing
- Selecting a date loads any existing entry for that contract/date; Update Entry writes changes.
- Deleting clears the entry and associated metrics.

## Defaults
- Advanced defaults can prefill punch ranges (and hour type when set); punches are cloned so edits do not alter the saved default. See `time-entry-defaults.md`.

