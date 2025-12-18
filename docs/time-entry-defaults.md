# Entry Defaults (Basic & Advanced)

Reusable templates for faster entry.

## Enabling
- Controlled by feature flag `default_inputs`. When off, defaults UI is hidden.

## Creating
- Populate manual or punch form, then choose Create Default (basic or advanced).
- Name the default; optionally pin an hour type (when `hour_types` enabled). Pinned types override current selection on apply.

## Applying
- From Time Entry: use “Enter Default” (auto-applies if only one) or pick from the selection modal.
- From Calendar: right-click a date to open the context menu and choose a default; the app applies and saves immediately when valid.
- Advanced defaults clone punches on apply; editing the entry will not mutate the default.

## Managing
- Edit: change name, punches/hours, or hour type; optimistic UI updates and persists via `api_updateEntryDefault`.
- Delete: removes the default; confirmation stays inline.

## Requirements
- Basic defaults require duration > 0.
- Advanced defaults require at least one complete punch range.
- Contract must be selected before saving an applied default.

