# Assessments Mode — Implementation Plan

A staged plan for delivering the `enable_assessments_mode` feature for Lilian's clone of Tempus.
The final design is captured in the discovery transcript; this document translates it into
shippable, reviewable stages. Each stage ends in a working state and can be tested
independently.

## Conventions
- All new code is gated behind `enable_assessments_mode` (or `enable_expense_report` for Stage 9).
  When the flag is off the app behaves identically to today.
- Follow the existing style guide in `CLAUDE.md` (server `var`, client `const`/`let`,
  2-space indent, `api_*` for endpoints, `.ts-toggle` for binaries, `.ts-container` default).
- Update `sheetSchemas.md`, `featureFlags.md`, `AGENTS.md`, and the relevant `docs/` markdown as
  part of the stage that introduces each change — not as a separate clean-up pass.
- British English in `docs/` (organise, behaviour, colour, …).

## Pending inputs from Brandon
These do not block early stages but must arrive before Stage 7 (invoice generation).
- Full placeholder set of Lilian's existing invoice template.
- Rollout date for the clone.
- Decision on Drive folder convention (keep `Assessments Financial Tracking/Invoices` or move to
  configurable path stored in settings).

---

## Stage 0 — Feature flag & scaffolding

**Goal:** wire the flag and an empty navigable screen so subsequent stages have a target.

**Tasks**
- Add `enable_assessments_mode` to:
  - `featureFlags.md` (new row, snake_case, disabled by default)
  - `DEFAULT_FEATURE_FLAGS` in `views/partials/scripts.html`
  - `docs/settings.md` Feature Flag Groups section
- Add a feature-flag check that hides the legacy Invoices nav entry only when both
  `enable_invoices` is false AND `enable_assessments_mode` is true (in this clone it'll always be
  the latter — but the codebase serves both deployments).
- Add a new nav entry "Assessments" gated by the flag (after Time Entries, before Contracts).
- Create `views/partials/assessments.html` containing only the page shell + month nav skeleton.
- Create `backend/assessments.gs` containing only the file header and constants:
  ```
  var ASSESSMENT_SHEET_NAME = 'assessments';
  var ASSESSMENT_TYPE_SHEET_NAME = 'assessment_types';
  var ASSESSMENT_INVOICE_SHEET_NAME = 'assessment_invoices';
  var ASSESSMENT_CACHE_PREFIX = 'assessments_v1_';
  ```
- Add a stub `api_getAssessmentsForMonth(year, month)` returning `[]` so the front-end can wire up.

**Acceptance**
- Toggling the flag on shows an empty Assessments page; toggling off hides it.
- Legacy Invoices page still works when its own flag is on.
- `clasp push` completes; no console errors on the empty page.

---

## Stage 1 — Sheets & schema

**Goal:** all new tables exist with headers; existing tables gain their new columns.

**Tasks**
- In `backend/assessments.gs`, add `ensureAssessmentSchema()`, `ensureAssessmentTypeSchema()`,
  `ensureAssessmentInvoiceSchema()` following the patterns in `backend/invoices.gs` /
  `backend/contracts.gs` (idempotent header writes via `getOrCreateSheet`).
- `assessments` columns:
  `id, interview_date, contract_id, assessment_type_id, interviewee_name, interviewee_dob,
   surge_percentage, notes, created_at, updated_at`
- `assessment_types` columns:
  `id, name, display_order, default_lines_json, created_at, updated_at`
- `assessment_invoices` columns:
  `id, year, month, contract_id, invoice_number, invoice_date, status, locked,
   generated_doc_id, generated_doc_url, generated_at, pdf_file_id, pdf_file_url, sent_at,
   template_doc_id, output_folder_id, notes, created_at, updated_at`
- Extend `backend/contracts.gs` schema to add columns (additive only — never reorder):
  `assessment_type_multipliers_json, invoice_email_to, invoice_email_cc, invoice_email_bcc,
   invoice_email_subject_template, invoice_email_body_template`
- Extend `backend/entries.gs` schema to add `assessment_id`.
- Update `sheetSchemas.md` for every new column and the three new sheets.
- Seed the five default assessment types on first read of the catalogue when the flag is on:
  - Standard (`mul: 1.0`, single line)
  - Enhanced (two lines, `mul: 1.0` + `mul: 0.105`)
  - Reval (two lines, `mul: 1.0` + `mul: 0.105`, with "(Reval)" in line 1)
  - Cancellation (<24 hrs) (single line, `mul: 0.75`)
  - Cancellation (>24 hrs) (single line, `mul: 0.5`)
  - Description templates use placeholders: `{org}`, `{name}`, `{dob}`, `{surge_suffix}`. See
    `oldAssessmentSheet/GenerateInvoice.js::createServiceItems` for canonical wording.

**Acceptance**
- Opening the assessments page on a fresh sheet creates all three new sheets with correct headers.
- The five default types appear in `assessment_types` on first load.
- Existing sheets unaffected for clones where the flag is off.

---

## Stage 2 — Backend APIs for assessments and types

**Goal:** full CRUD APIs for assessments and the type catalogue, plus the pricing resolver.

**Tasks**
- `api_listAssessmentTypes()` → all types, ordered.
- `api_upsertAssessmentType({id?, name, display_order, default_lines_json})`.
- `api_deleteAssessmentType(id)` (refuse if any assessment references it — referential integrity
  same pattern as contract deletes).
- `api_getAssessmentsForMonth(year, month)` → assessments in that calendar month with
  resolved effective fee + total actual hours spent (joined via `assessment_id` on
  `timesheet_entries`).
- `api_upsertAssessment({...})` — validates contract is active on `interview_date` (warn but
  allow if not — match the project's general permissiveness).
- `api_deleteAssessment(id)` — cascades to the billable entry and all actual-hours entries with
  the same `assessment_id`; blocked if the assessment's invoice is `locked`.
- Internal helper `resolveAssessmentLines(assessment, contract, type)`:
  1. Look up the contract's multiplier override for this type (`assessment_type_multipliers_json`).
     If no override, use the type's `default_lines_json` multipliers.
  2. For each line, compute `amount = contract.hourly_rate * line.multiplier * (1 + surge%)`.
  3. Render the description by substituting `{org}` (contract name), `{name}`, `{dob}` (dd/MM/yyyy),
     `{surge_suffix}` (` + N% Surge` or empty).
  4. Return `{ lines: [{description, amount, multiplier}], total_amount, total_multiplier }`.
- Cache invalidation on every mutation (`cacheClearPrefix(ASSESSMENT_CACHE_PREFIX)`).

**Acceptance**
- All APIs callable from Apps Script logs.
- `resolveAssessmentLines` produces the same outputs as
  `oldAssessmentSheet/GenerateInvoice.js::createServiceItems` for the five default types and
  representative surge values.

---

## Stage 3 — Assessment Types management UI

**Goal:** Lilian can view and edit the type catalogue from Settings.

**Tasks**
- Add a section to `views/partials/settings.html` (gated by `enable_assessments_mode`) titled
  "Assessment types". Per the data-driven settings convention in CLAUDE.md, register the
  controls in `SETTINGS_CONFIG`.
- Show one card per type with: name, display order, lines table (description template +
  multiplier, add/remove rows), save.
- "Add type" button creates a new type with one blank line.
- The five default types are editable but not deletable (mirror the protection on the built-in
  Work hour type — `is_built_in` flag).

**Acceptance**
- She can rename "Enhanced" to "Enhanced (PAR)" and the change persists.
- She can add a sixth type, configure its lines, and use it on a contract in Stage 4.
- Attempting to delete a built-in type shows a clear error.

---

## Stage 4 — Contracts: per-contract config

**Goal:** the Contracts page lets her configure which types each org offers, the multiplier
overrides per line, and the invoice email defaults for that contract.

**Tasks**
- Extend `views/partials/contracts.html` with a collapsible "Assessment configuration" section,
  visible only when `enable_assessments_mode` is on.
  - Type chooser: a checklist of all `assessment_types`. Ticking one opens the per-line
    multiplier inputs (pre-filled with type defaults).
- Extend the contract edit form with an "Invoice email" section:
  - To, CC, BCC, subject template, body template (textarea, monospace).
  - Help text listing available placeholders: `{invoiceNumber}`, `{monthYear}`, `{org}`, `{total}`.
- Persist via `api_upsertContract` — extend the existing contract endpoint to accept the new
  fields. Both `assessment_type_multipliers_json` and email fields are optional.
- Validate: any type referenced by an existing assessment cannot be removed from that contract.

**Acceptance**
- Configuring "Acme" with Standard + Enhanced (default multipliers) saves and round-trips.
- Trying to deselect a type with existing assessments shows a clear error pointing to the
  offending assessments.

---

## Stage 5 — Assessments screen (read + create + edit)

**Goal:** the full month-centric screen, minus the invoice generation/email actions
(those land in Stage 7-8).

**Tasks**
- Build out `views/partials/assessments.html`:
  - Toolbar: month nav (prev / current month label / next), "Add assessment" button on the right.
  - Summary strip: `n assessments · $X.XX to invoice · Y.YY hours spent`.
  - Table columns: date, organisation (contract name), type, interviewee, effective fee,
    actual hours spent. Row click opens the side-drawer.
- Side-drawer for assessment detail:
  - Metadata form: date (defaults to today on add), contract picker (active contracts only),
    type picker (filtered to types the contract offers), interviewee name, DOB, surge %, notes.
  - "Time Spent" sub-table below the form. Columns: date, duration (decimal hours input).
    Inline add row; inline edit and delete. Total displayed at the bottom of the section.
  - Save / Cancel / Delete buttons in the drawer footer.
- Time-spent rows are persisted as `timesheet_entries` rows with:
  - `hour_type_id` = the auto-created "Assessment work" hour type (see Stage 6)
  - `contract_id` = the assessment's contract
  - `assessment_id` = the assessment's id
  - `entry_type` = `basic`, `punches_json` = `[{"in":"00:00","out":"HH:mm"}]` for duration
- Auto-create the "Assessment work" hour type the first time the flag-gated assessment screen
  loads. `contributes_to_income = FALSE`, `requires_contract = FALSE`, `is_built_in = TRUE`.
- All saves immediately trigger Stage 6's billable-entry sync.

**Acceptance**
- She can create a Standard assessment for Acme on today's date with surge 0.2, and see it in
  the table with the right effective fee.
- She can add three time-spent rows over three different dates and see the total update.
- Deleting the assessment removes the time-spent entries too (confirmation lists what'll go).
- Closing and reopening the drawer for the same row shows the saved data exactly.

---

## Stage 6 — Save-time billable entry sync

**Goal:** every saved assessment has exactly one billable `timesheet_entries` row that reflects
its current rate × multiplier × surge. Income, BAS, Annual Views, and the dashboard pick it up
automatically because they all read `timesheet_entries`.

**Tasks**
- Inside `api_upsertAssessment`, after writing the assessment row, call
  `syncAssessmentBillableEntry(assessment)`:
  1. Compute total effective multiplier via `resolveAssessmentLines`.
  2. `duration_minutes = round(60 * total_multiplier * (1 + surge_pct))` to the user's
     `round_to_nearest` setting.
  3. Locate existing entry by `assessment_id` + `hour_type = Work` + matching date.
  4. Upsert: insert if missing, update otherwise. `entry_type = basic`, `contract_id =
     assessment.contract_id`, `hour_type_id = Work`, `punches_json = [{"in":"00:00","out": ...}]`.
- Inside `api_deleteAssessment`, remove the billable entry too.
- Edits change the existing entry rather than orphaning it.
- Edge cases:
  - Interview date moved → billable entry's date moves with it.
  - Contract changed → billable entry's `contract_id` updates.
  - Surge or type changed → duration recomputed.

**Acceptance**
- Saving an Enhanced assessment for Acme ($300 base) with surge 0.2 produces a billable entry
  of duration `60 × 1.105 × 1.2 = 79.56 → rounded 80` minutes (with 5-min rounding) on the
  interview date.
- BAS shows the expected income for that month immediately.
- Moving the assessment to a different date moves the billable entry too.
- Deleting the assessment removes the billable entry.

---

## Stage 7 — Monthly invoice generation (Doc only)

**Goal:** "Generate monthly invoice" button creates `assessment_invoices` rows and produces the
Google Doc(s) using the existing template, mirroring `oldAssessmentSheet/GenerateInvoice.js`.

**Tasks**
- Add the `assessment_invoice_grouping` setting (`combined` default / `per_org`) to Settings.
- Add template/output folder settings: `assessment_invoice_template_doc_id`,
  `assessment_invoice_template_path`, `assessment_invoice_output_folder_id`,
  `assessment_invoice_output_folder_path`. Mirror the legacy invoice settings UX.
- Implement `api_generateAssessmentInvoices(year, month)`:
  1. Resolve the month's assessments.
  2. Group per the setting (`combined` → 1 group with all; `per_org` → one group per contract_id).
  3. For each group:
     - Find or create the `assessment_invoices` row for `(year, month, contract_id?)`.
     - Allocate `invoice_number` = `YYMM{SEQ:3}` where SEQ is the per-month running count
       (across both modes; if she switches modes mid-month, numbers may jump — acceptable).
     - Resolve every assessment's lines via `resolveAssessmentLines`.
     - Copy the template Doc to the output folder named
       `Invoice {invoice_number} - {MM-yy}` (matches existing convention).
     - Replace placeholders: `{{invoiceNumber}}`, `{{date}}`, `{{date1..N}}`,
       `{{serviceDescription1..N}}`, `{{amount1..N}}`, `{{subtotal}}`, `{{gst}}`, `{{total}}`.
     - Trim unused table rows. (Port `getDocumentTables` / `findInvoiceTable` /
       `removeExtraTableRows` from the old script.)
     - Persist `generated_doc_id`, `generated_doc_url`, `generated_at`, set `status = generated`.
- Add an "Invoices for this month" section to the Assessments screen, listing the
  `assessment_invoices` rows for the current month with: number, status, doc link, "Regenerate",
  "Send" (Stage 8), "Unlock" (when locked).
- Editing an assessment in a month whose invoice is `generated` but not `locked` resets that
  invoice's status to `draft` and surfaces a "needs regeneration" banner.

**Pending inputs**
- Brandon to confirm placeholder set if it differs from above.
- Brandon to confirm Drive folder convention.

**Acceptance**
- For a month with 3 Standard + 1 Enhanced assessments, `combined` mode produces one Doc with
  4 line groups (Enhanced contributing two rows in the line table — totalling 5 visible rows).
- `per_org` mode with two orgs in the same month produces two Docs, each numbered with the
  same `YYMM` prefix and incremental SEQ.
- Regenerate replaces the Doc in place (no duplicates).

---

## Stage 8 — PDF + email send + lock

**Goal:** "Send invoice" button exports to PDF, emails per-contract recipients, and locks the
invoice + its assessments.

**Tasks**
- Implement `api_sendAssessmentInvoice(invoice_id)`:
  1. Generate PDF from the Doc, named `LPham Invoice {number} - {MM-yy}.pdf` in the same folder
     (port `createInvoicePdfOnce` / `handleExistingPdfs` from the old script).
  2. Build recipient list: prefer the per-contract `invoice_email_*` fields; for combined
     invoices, fall back to a global default in settings.
  3. Substitute `{invoiceNumber}`, `{monthYear}`, `{org}`, `{total}` in subject/body templates.
  4. Send via `GmailApp.sendEmail` with the PDF blob attached.
  5. Set `sent_at`, `status = sent`, `locked = true` on the invoice.
- Add an "Unlock" button on locked invoices that clears the lock so she can adjust if needed
  (audit-friendly: keeps `sent_at` for the record, but allows edits to flow again).
- Update `api_upsertAssessment` / `api_deleteAssessment` to refuse if the relevant invoice is
  locked. The error message points the user to the Assessments invoice list to unlock.

**Acceptance**
- Sending a generated invoice attaches the right PDF and uses the contract's configured
  recipient + body.
- After send, the underlying assessments cannot be edited or deleted until she clicks Unlock.
- Unlocking and editing an assessment resets `status = draft` and re-enables Regenerate.

---

## Stage 9 — Expense report (independent feature)

**Goal:** new feature flag `enable_expense_report` adds a CSV export to BAS reporting. Independent
of `enable_assessments_mode`.

**Tasks**
- Add `enable_expense_report` to `featureFlags.md`, `DEFAULT_FEATURE_FLAGS`, `docs/settings.md`.
- Extend `views/partials/bas.html` with a collapsible "Expense Report" section, gated by the
  flag. Shows the selected FY's company-deduction rows grouped by category with subtotals.
- "Download CSV" button. Columns: `date, category, name, notes, amount_ex_gst, gst,
  amount_inc_gst`. One row per occurrence (recurring deductions expanded by date).
- Server endpoint `api_buildExpenseReportCsv(financialYear)` returns a CSV string; client
  triggers download.
- Add `docs/bas-reporting.md` section describing the report (British English).

**Acceptance**
- Toggling the flag on shows the section; off hides it cleanly.
- CSV opens in Sheets/Excel with the right columns and one row per expense occurrence.

---

## Stage 10 — Documentation and polish

**Goal:** every change is reflected in user-facing docs and the agent-facing CLAUDE.md / AGENTS.md.

**Tasks**
- New `docs/assessments.md` covering: purpose, accessing the screen, fields, time-spent,
  invoice generation, send flow, lock behaviour, troubleshooting. Follow the structure of
  `docs/actual-income.md` for detail level.
- Update `docs/contracts.md`: assessment-type config and invoice-email config sections.
- Update `docs/settings.md`: new flag entries and Feature-Specific Settings entries for
  `assessment_invoice_grouping`, the template/folder settings.
- Update `docs/bas-reporting.md`: expense report section (covered in Stage 9 but worth a polish
  pass alongside the rest).
- Update `CLAUDE.md` + `AGENTS.md` to mention `enable_assessments_mode` and the new sheets.
- Update `featureFlags.md` with both new flags (handled in earlier stages — verify still
  accurate).
- One last manual smoke pass through the full monthly workflow:
  1. Add four assessments across two orgs (mix of types and surges).
  2. Add time-spent entries spread over a fortnight.
  3. Switch invoice grouping in settings, regenerate, verify both modes produce sensible Docs.
  4. Send one invoice, verify lock prevents downstream edits.
  5. Unlock, edit an assessment, verify status resets to draft.
  6. Open BAS, verify income reflects the new entries; download the expense CSV.

**Acceptance**
- New user (Lilian) can follow `docs/assessments.md` end-to-end without asking for help.
- The smoke pass completes without bugs.
