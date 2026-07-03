# Assessments

Available when the *Enable assessments mode* feature flag is enabled under the *Company* section.

## Purpose
Assessments mode supports billing per assessment instead of per hour. It is purpose-built for users whose work follows the pattern of one fee per interview, with the actual hours of preparation, interview, and report writing tracked separately for personal record-keeping. Each saved assessment automatically creates a billable time entry of the right value so income, BAS, and Annual Views reflect the assessment fee without any manual entry. Monthly invoicing is generated from the same screen.

## Accessing the Feature
- Enable the *Enable assessments mode* feature flag under *Company* in Settings. The Assessments page appears in the navigation menu.
- Under Settings, configure the **Assessment types** catalogue, the monthly invoice template and output folder, and the default invoice email recipients.
- On each contract (organisation), choose which assessment types it offers and configure any per-organisation multiplier overrides and email recipients.

## The Assessments Page

The page is month-centric: the toolbar shows the active month, a summary string (number of assessments, total to invoice, total hours spent), an *Add assessment* button, and prev/next/today month navigation.

### Assessments table
- One row per assessment recorded in the selected month.
- Columns: interview date, organisation, type, interviewee, surge, effective fee, hours spent.
- Click a row to open the assessment for editing.

### Invoices for this month
Beneath the table is a list of monthly invoices generated for the displayed month. Each row shows the invoice number, status, contract name (or "combined"), and action buttons to open the Doc/PDF, regenerate, send, or unlock the invoice.

## Adding or Editing an Assessment

Clicking *Add assessment* (or a table row) opens the assessment modal:

- **Interview date**: The date the assessment interview was conducted. Used to determine which contract is active and which month the invoice rolls up to.
- **Organisation**: The contract for the organisation the assessment was for. The picker only lists contracts active on the chosen date that have at least one assessment type enabled.
- **Type**: The assessment type. Filtered to types the chosen organisation offers.
- **Interviewee name**: Rendered on the invoice as the *Clearance Subject*.
- **Interviewee DOB**: Rendered alongside the name on the invoice.
- **Surge %**: Decimal value (e.g., `0.2` for a 20% surge). Leave blank for no surge.
- **Notes**: Internal-only notes, not shown on the invoice.

### Effective fee preview
The form shows the calculated fee live as you change the form values. The breakdown is the base hourly rate of the contract, multiplied by the assessment type's per-line multipliers, with the surge factor applied. Example: a $300/hr base rate with an Enhanced (×1.105) assessment and 20% surge resolves to $300 × 1.105 × 1.2 = $397.80.

### Time Spent
The lower half of the modal lists actual hours spent on this assessment. Each row has a date, a duration in hours, and an **hour type** picker. The picker lists every non-income hour type configured in the app; pick whichever category best describes the work (e.g., "Assessment prep", "Report writing", or just the auto-created "Assessment work"). The default selection is the *Default hour type for assessment time entries* setting (see [Settings](docs/settings.md)); leave the dropdown on "Assessment work (default)" to fall back to the auto-created type. Entries are written to `timesheet_entries` linked back to the assessment by `assessment_id`. They appear in the calendar and Annual Views like any other non-income entry.

Both the billable (auto-generated) entry and every actual-hours row show up on the regular Time Entry calendar. The billable entry uses the *Work* hour type; the actual-hours entries use whatever hour type was picked on the row.

For a brand-new assessment the *Time Spent* section is locked with a hint reading *"Save the assessment first to log time against it"*. After the first save the modal switches into edit mode and the section becomes interactive.

### Saving and deleting
- **Save** persists the metadata and immediately syncs the billable `timesheet_entries` row (1 hour × total multiplier × (1 + surge%), in minutes, rounded by your *Time entries rounding* setting).
- **Delete** first swaps the modal footer to an inline confirmation. Confirming cascades the delete: the assessment, its billable entry, and every logged time-spent entry are removed. Cancelling returns to the normal Save/Cancel/Delete controls.
- **Delete on a time-spent row** shows a confirmation directly under that row. Confirming removes only that logged actual-hours entry.
- If a related monthly invoice has been generated but is not locked, the edit auto-resets that invoice to *draft* so it surfaces a *needs regeneration* hint.

## Monthly Invoices

The *Generate monthly invoice* button (top of the page) produces one invoice per group depending on the grouping setting:

- **Combined** (default): one invoice per month containing every assessment regardless of organisation.
- **Per organisation**: one invoice per (month, organisation) pair.

Invoices are numbered automatically as `YYMM{SEQ:3}` (e.g., `2605001`) and the sequence resets monthly. The number can be overridden by editing the `assessment_invoices` sheet directly if needed.

### Doc rendering
At generation time the configured template is copied to the configured output folder and the following placeholders are replaced. The placeholder format matches the legacy `Invoice Template` used by the original spreadsheet.

- `{{invoiceNumber}}`, `{{date}}`
- `{{date1}}..{{dateN}}`, `{{serviceDescription1}}..{{serviceDescriptionN}}`, `{{amount1}}..{{amountN}}`
- `{{subtotal}}`, `{{gst}}`, `{{total}}`

`N` is configurable via the *Invoice line placeholder limit* setting (default 18). Unused placeholders are blanked out.

For an Enhanced or Reval assessment the doc renders two lines per assessment (the main report and a Document Review Fee). Cancellations render a single short-notice cancellation line. Each line's description template lives on the type and uses `{org}`, `{name}`, `{dob}`, and `{surge_suffix}` substitutions.

### Send and lock workflow
- **Send**: exports the Doc as a PDF named `LPham Invoice {number} - MM-YY.pdf`, attaches it to an email built from the per-contract subject/body templates (with global defaults as fallback), and sends through Gmail. On success the invoice is marked *sent* and *locked*.
- **Locked invoices** block downstream edits and deletes to their underlying assessments — the user has to click *Unlock* before changing anything. The sent date is preserved through unlock cycles.
- **Regenerate** replaces the Doc in place (the previous file is trashed). Disabled while the invoice is locked.

## Recommended Workflow

1. Configure the **Assessment types** catalogue once in Settings → Assessment types. Adjust the default line breakdowns and multipliers if needed; built-in types can be edited but not deleted.
2. For each organisation she works with, set up a contract: hourly rate, dates, and an opt-in list of assessment types (with per-contract overrides if necessary). Set per-organisation invoice email recipients on the contract.
3. Throughout the month, add each assessment as it happens — including DOB, surge, and any actual-hours entries that span the report-writing period.
4. At month end, click *Generate monthly invoice* on the Assessments page. Review the Doc, then click *Send* to email the PDF and lock the period.

## Tips
- **Surge values are decimals**, not percentages: `0.2`, not `20`.
- **Cancellation multipliers** are inverted from what feels intuitive: under-24-hour cancellations pay more than longer-notice ones (`<24h` = 0.75, `>24h` = 0.5).
- **Rate changes are best handled by ending the old contract and starting a new one** rather than editing `hourly_rate` on an existing contract; this keeps historical assessments at their original fee.
- **Default invoice email settings** are used by combined-mode invoices automatically, and as a fallback for per-organisation invoices when the contract has nothing set.
- If a generated Doc no longer matches the assessments (because you edited an assessment after generation), the invoice status reverts to *draft* and the *Generate / Regenerate* button reactivates so you can refresh it before sending.

## Summary

Assessments mode is an end-to-end workflow for per-assessment billing: record assessments through the month with a quick form, the billable entries are kept in sync automatically, and at month-end you generate, review, send, and lock invoices in a few clicks. Hours actually spent on each assessment are tracked separately for personal record-keeping without affecting billing.
