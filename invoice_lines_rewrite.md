# Invoice Line Items: Full Rewrite Plan

## Goals
- Replace the current invoice line item implementation end-to-end with a clean, deterministic design that avoids schema drift and mode confusion.
- Support all four input modes with clear server/client responsibilities: `hours` (number_of_hours), `monthly_hour_type`, `amount` (raw_amount), and `contract_template`.
- Keep draft invoices dynamic (amounts recalculated automatically) and lock values when an invoice is published/generated.
- Ensure contract names and timesheet linkage are handled consistently and safely.
- Remove reliance on heuristics; use explicit, canonical schemas and mode fields.

## Problem Summary (Reasons for Rewrite)
- Header/schema drift: extra/misaligned columns caused values to shift (`contract_id` became `monthly_hour_type`, `timesheet_entry_id` held contract names, etc.).
- Mixed heuristics: client guessed `amount_mode` from values; server sometimes recalculated in ways that overrode intent.
- Inconsistent contract snapshots: client-provided names leaked into persisted data; names shifted when headers misaligned.
- Timesheet sync misuse: entries were synced/cleared inconsistently across modes.
- Edit UX: editing hour-type lines flipped to raw amount, hard-coding dynamic values.
- Publish/lock: generated invoices were not consistently locked; dynamic modes were effectively frozen at the wrong times.

## Functional Requirements
1) **Canonical Schema (20 columns, fixed order)**
   - `id, invoice_id, is_default, default_label, position, line_date, description, hours, hour_type_id, hour_type_name_snapshot, amount, amount_mode, contract_id, contract_name_snapshot, timesheet_entry_id, entry_snapshot_json, last_synced_at, source_default_id, created_at, updated_at`
   - Enforce on every access: trim extra columns, rebuild header if divergent, always write in this exact order.

2) **Modes and Semantics**
   - `hours` (number_of_hours):
     - Input: `hours`, `hour_type_id`, `contract_id` required; `amount` optional (if provided, mark `amount_provided=true`).
     - Calculation: `amount = hours * contract_rate` when `amount_provided` is false.
     - Timesheet: create/update linked entry; store `timesheet_entry_id` and `entry_snapshot_json`.
     - Recalc: recompute amount from hours×rate; preserve hours; keep mode = `hours` until publish lock.
   - `monthly_hour_type`:
     - Input: `hour_type_id`, `contract_id` required; `hours` ignored/forced to 0.
     - Calculation: `amount = monthly total of hour_type_id (optionally filtered by contract_id) * contract_rate`.
     - Timesheet: none (no linked entry).
     - Recalc: recompute amount, force `hours=0`; keep mode = `monthly_hour_type` until lock.
   - `amount` (raw_amount):
     - Input: `amount` required; `hours` ignored/forced to 0; `hour_type_id` optional/ignored for calc.
     - Calculation: none; use provided amount; treat as provided.
     - Timesheet: none.
     - Recalc: leave amount as-is; force `hours=0`.
   - `contract_template`:
     - Input: `contract_id` + template selector; `amount` resolved from contract template; `hours=0`.
     - Calculation: use template amount; treat as provided.
     - Timesheet: none.
     - Recalc: ensure `hours=0`; amount from template or stored value.

3) **Dynamic vs Locked**
   - Draft invoices: recalc on load and before summary for `hours` and `monthly_hour_type`; `amount` and `contract_template` stay as provided.
   - Publish/Generated: run final recalc, then switch all lines to `amount_mode='amount'`, set `amount_provided=true`, and disable edits/deletes.

4) **Server Responsibilities**
   - Schema guard: enforce canonical header and trim extra columns on every entry point (sheet getter, recalc, upsert).
   - Normalization/build: map by header name against canonical list; never depend on live header order.
   - Contract snapshot: always set `contract_name_snapshot` server-side from contracts sheet; ignore client-supplied name.
   - Timesheet sync: only for `hours` mode with `hours>0` and `hour_type_id`; store snapshot JSON; skip for other modes.
   - Recalk helper: `recalculateInvoiceLineAmounts(invoice, { lock })` covering all modes; lock sets mode to `amount` and clears timesheet links for non-hours modes.
   - API flow:
     - `api_getInvoice`: recalc (lock if generated), return invoice, lineItems, defaults, summary.
     - `api_upsertInvoiceLineItem`: reject if invoice is generated; compute per mode; set snapshots; write via canonical builder.
     - `api_generateInvoiceDocument` and/or status change to generated: call recalc with lock=true before returning.

5) **Client Responsibilities**
   - Trust `amount_mode` from server; no heuristics.
   - Form modes map directly: `number_of_hours`→`hours`, `total_hours`→`monthly_hour_type`, `raw_amount`→`amount`, `contract_template`→`contract_template`.
   - On edit: set form mode from row’s `amount_mode`; populate fields accordingly; clear amount when mode isn’t `amount`/`contract_template`.
   - Payload: include `amount_mode`; set `amount_provided=true` only for raw_amount/contract_template (and manual amount in hours if explicitly entered); force `hours=0` for non-hours modes.
   - Rendering: show contract via `getContractName(contract_id) || contract_name_snapshot`; show mode badge; show “Locked” when generated; disable add/edit/delete/refresh/forms when locked.
   - Defaults: stored with the same schema/modes; when inserting into an invoice, preserve mode and let the server recalc.

6) **Migration (optional but recommended)**
   - If existing data remains: one-time migration that rewrites rows onto canonical headers (20 cols), trims extra columns, recomputes amounts per mode, and clears timesheet links for non-hours modes. (You’ve deleted data, so this can be skipped, but keep the helper available.)

7) **Testing/Validation Steps (for future implementation)**
   - Create each mode and verify sheet rows align to canonical headers and correct columns.
   - Edit each mode and confirm form mode stays correct and values aren’t hard-coded for dynamic types.
   - Publish invoice: verify lock, mode flip to `amount`, timesheet links cleared for non-hours modes, buttons disabled.
   - Contract rename: ensure contract_name_snapshot refreshes on load/recalc.

8) **Notes for Next Session (implementation details)**
   - Use a single canonical header constant shared by schema guard, normalizer, and builder.
   - All sheet writes go through the canonical builder; never rely on sheet header order.
   - Recalc runs on get/list/lock; caches cleared when rows are updated.
   - Timesheet sync only for hours mode; others keep entry fields empty.
   - Client removes amount-mode heuristics and respects server mode; generated status gates all edits.
