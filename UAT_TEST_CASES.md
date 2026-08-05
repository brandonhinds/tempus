# Tempus user acceptance test cases

Use these cases against a copied spreadsheet and a test Apps Script deployment. Do not connect the test deployment to the production spreadsheet, and do not send test invoices or assessment documents to real recipients.

## Test record

- Build commit:
- Deployment URL:
- Spreadsheet copy:
- Tester:
- Browser/device:
- Test date:

Record each case as **Pass**, **Fail**, or **Blocked**. For a failure, capture the case ID, visible message, relevant record IDs, screenshot, and browser console output.

## Preparation

Prepare two spreadsheet copies:

1. A realistic pre-upgrade copy containing existing contracts, hour types, time entries, deductions, invoices, and—if used—assessments.
2. A clean test copy for destructive and concurrency tests.

Before upgrading the realistic copy, record its sheet names, row counts, several known record totals, and a sample of important relationships such as invoice-to-line and assessment-to-contract links.

## Stage 1 — Upgrade and data preservation

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-01 | P0 | Verified one-time upgrade | Open the test deployment against the realistic pre-upgrade copy. Start the upgrade and open the backup link. After completion, select **Open Tempus**. | A dated Drive backup exists beside the source and opens successfully. The upgrade finishes without hidden errors, **Open Tempus** loads the application, and refreshing also loads it. |
| UAT-02 | P0 | Migrated data integrity | Compare the upgraded workbook with the pre-test counts and samples. Inspect time entries, contracts, deductions, invoices, assessment records, and archived migration rows. | Existing records and relationships remain present. Unknown named columns are preserved. Superseded data is archived rather than silently deleted. Financial pages become available only after completion. |
| UAT-03 | P1 | Upgrade rerun and resume | Reload after a completed upgrade and, on a separate disposable copy, interrupt an upgrade before completion and run it again. | A completed upgrade does not run again or change row counts. An interrupted upgrade resumes from the unfinished migration and reuses the verified backup record. |
| UAT-04 | P0 | Duplicate-header safety | On a disposable copy, add two `icon` columns to `hour_types`, leaving one value blank or duplicating the same value per row, then upgrade. Repeat with two different icon values in the same row. | Lossless duplicates are combined into one `icon` column. Conflicting values stop the upgrade with the exact sheet, header, and row; neither value is silently discarded. |

## Stage 2 — Time, schedules, import, and holidays

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-05 | P0 | Manual time entry identity | Create two separate entries on the same date with the same contract and hour type but different notes or sessions. Edit one and delete the other. | Both entries are retained independently. Editing or deleting one does not affect the other, and notes survive reloads. |
| UAT-06 | P0 | Recurring and bulk idempotency | Create weekly, fortnightly, month-end monthly, and bulk schedules. Generate entries, note the results, then run each sync again. Include a duplicate and one invalid input in a bulk request. | The first run reports one result per input as added, duplicate, or failed. The second sync creates no duplicate rows and performs no spurious updates. Cursors advance only for successfully written data. |
| UAT-07 | P1 | Date boundaries and full days | Preview or generate entries across leap day, 30 June/1 July, month end, and both Sydney daylight-saving transitions. Add a full-day entry. | Dates remain on the selected local calendar day, month-end rules retain their intended anchor, durations remain stable across DST, and a full day is not represented by fake punch times. |
| UAT-08 | P0 | Timesheet import | Import a file containing local dates, a full-day row, a known duplicate, and a continuation row. Also try an invalid date and an invalid continuation. | Valid rows import on the correct date. Duplicates are excluded from added totals. Invalid dates/continuations produce clear errors without corrupting other rows. |
| UAT-09 | P0 | Agenda, mobile, and punch persistence | Create entries from Agenda and mobile views, start a punch, reload or resume the browser, then stop it. Test without a contract where the selected hour type permits that. | Views hydrate dates in order, mobile data does not erase desktop cache data, the open punch survives reload, rollback errors restore server truth, and optional-contract entries save successfully. |
| UAT-10 | P1 | Regional public holidays | Configure two regions with different holidays, including two regional holidays on the same date. View the holiday page and Agenda, then run automatic population twice. | All views show the same catalogue records, regional holidays remain distinct, and the second population run does not create duplicate time entries. |
| UAT-11 | P0 | Reference and deletion protection | Reference a contract and hour type from schedules, entries, an assessment, and an issued invoice. Attempt to delete or archive each referenced item. | Unsafe deletion or archival is blocked with a useful explanation. Unreferenced configuration can still be changed or removed. |

## Stage 3 — Expense ledger

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-12 | P0 | Expense transaction lifecycle | Record a taxable business expense with vendor, supplier date, category, business-use percentage, notes, and two receipt references. Add a partial payment, add the balance, then reconcile it as claimable. | Payment state and remaining balance are correct, overpayment is rejected, attachments persist, and eligible GST is based on the stored GST and business-use percentage. A reconciled transaction cannot be silently rewritten. |
| UAT-13 | P0 | Expense rules versus history | Create a recurring expense rule, generate scheduled occurrences, then change its vendor, category, amount, and end date. Generate again. | Existing transactions retain their original snapshots. Only future scheduled occurrences reflect the edited rule, and the same rule/date occurrence is never generated twice. |
| UAT-14 | P0 | Legacy expense reconciliation | Locate a migrated company deduction marked `legacy_unreconciled`. Compare the annual expense report and BAS, then attach evidence and reconcile it if eligible. | It appears in expense/annual actuals before reconciliation but contributes no GST credit. After valid reconciliation, only eligible claimable GST enters the appropriate BAS calculation. |
| UAT-15 | P1 | Expense filters and export | Filter expenses by financial year, date, status, reconciliation state, and category. Export CSV and open it in spreadsheet software. Include text beginning with `=`, `+`, `-`, or `@`. | Screen totals agree with filtered transactions and distinguish actual, scheduled, unreconciled, creditable, and non-creditable values. CSV columns and totals agree, and user text is not executed as a formula. |

## Stage 4 — Invoices and assessments

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-16 | P0 | Standard invoice lifecycle | Create a standard draft from test time entries, edit its lines, and run explicit recalculation. Issue it, mark it sent, and then attempt to alter its number, header, or lines. | Draft changes and recalculation are explicit. Issue assigns one server-generated number. Issued/sent content is immutable and reads do not change totals or source data. |
| UAT-17 | P0 | Payments, void, and revision | Add a partial invoice payment and then the balance. Create another issued invoice, void it with a reason, and create a revision. | Payment state progresses unpaid → part-paid → paid without inferring legacy payments. The void invoice remains in history, is excluded where appropriate, and its revision is a linked editable draft with a new number only when issued. |
| UAT-18 | P1 | Invoice-number concurrency | In two browser sessions, prepare two drafts and issue them as close together as possible. | Both issue successfully or one receives a recoverable busy response; invoice numbers are unique and ordered, with no duplicated sequence. |
| UAT-19 | P0 | Generic assessment workflow | Enable assessments, create a type with required text/date fields and two stable invoice-line templates using tokens. Create two same-day assessments, preview them, and generate a grouped or per-organisation draft invoice. | Configured values and tokens render correctly, both same-day records and derived rows remain distinct, and invoice lines retain their assessment source identities and pricing snapshots. |
| UAT-20 | P0 | Assessment locks and release | Issue an assessment invoice, try to edit/delete its sources and referenced configuration, then void the invoice. Revise the assessment and generate a replacement invoice. | Issuance locks referenced records and configuration. Voiding retains the audit trail but releases the assessment for revision and re-invoicing. The replacement is not mistaken for the void invoice. |
| UAT-21 | P1 | Assessment document and email | Configure a test template, folder, filename pattern, recipient, subject, and body. Export a document and send only to a controlled test address. | Output uses configured values and tokens with no hard-coded names or organisations. The document is stored in the configured folder and the email content/recipient match the preview. |

## Stage 5 — BAS, annual reporting, and tax

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-22 | P0 | Cash versus accrual BAS | Use a taxable invoice and taxable business expense whose invoice/purchase dates and partial payment dates fall in different BAS periods. Compare cash and accrual calculations. | Cash actuals are allocated proportionally to payments in each period. Accrual actuals use the applicable invoice/supplier event. Forecasts remain separate from ledger-backed actuals. |
| UAT-23 | P0 | BAS reconciliation and snapshot | Review uninvoiced time, unpaid invoices, unreconciled expenses, and missing receipts. Submit a BAS test snapshot, then change underlying draft/current-period data and reopen the submission. | Warnings identify each reconciliation backlog. The submission retains its original basis, totals, hash, and snapshot; current changes produce a variance/change warning without rewriting the submitted evidence. |
| UAT-24 | P0 | Annual-view consistency | Compare Dashboard, Annual View, Rate Preview, invoice totals, expense totals, and exported values for one known financial year. Apply a contract filter. | Gross, taxable income, tax, net income, super treatment, rates, and filtered denominators are consistent across views. Printed/exported totals and GST rounding match on-screen figures. |
| UAT-25 | P1 | PAYG financial-year handling | Check estimates on 30 June and 1 July around the FY2026–27 boundary, then select a date after the newest bundled table. | The correct versioned table is selected through FY2026–27. Later years clearly warn that the bundled PAYG table is stale rather than presenting it as current. |

## Stage 6 — Security, resilience, usability, and release smoke test

| ID | Priority | Test | Actions | Pass criteria |
| --- | --- | --- | --- | --- |
| UAT-26 | P0 | Unsafe text and URL handling | Enter HTML/script payloads and spreadsheet-formula prefixes into representative notes, names, descriptions, invoice lines, and imports. Try configurable URLs using `javascript:`, malformed URLs, and valid `http`/`https` URLs. | Payloads display as inert text, exported spreadsheet cells remain inert, unsafe URL schemes are rejected, and valid URLs continue to work. |
| UAT-27 | P1 | Cache and quota recovery | Populate enough data to exercise core, income, and report caches. Simulate or trigger a local-storage quota failure, reload, and resync. | A visible warning explains the cache failure, server data remains intact, the UI can recover by syncing, and legacy/mobile cache data is not incorrectly discarded. |
| UAT-28 | P1 | Responsive and accessible operation | Run the primary time, expense, invoice, assessment, and BAS flows at desktop and phone widths. Operate quick-action menus using click, context menu, Menu/Shift+F10, arrows, Enter, and Escape. Check light/dark/custom themes. | Content remains usable without clipped controls or unreadable text. Menus expose correct keyboard behavior and focus return. New workflows remain visually consistent in supported themes. |
| UAT-29 | P1 | Errors and locking | Trigger recoverable validation failures and start conflicting mutations from two sessions for settings, schedules, expenses, invoices, or BAS. | Recoverable failures return a clear message without a partial write. Concurrent mutations are serialized or return a useful busy/conflict response, and refreshing shows server truth. |
| UAT-30 | P0 | Final test-deployment smoke run | From a fresh browser session, open the deployed test copy and visit Agenda/calendar, mobile entry, expenses, invoices, assessments, BAS, annual reports, Help, and About/update information. Create one representative record in each enabled workflow. | Every page loads without console errors, saved records survive refresh, Help matches the implemented workflows, and build/update metadata identifies the tested release. No production spreadsheet or deployment is changed. |

## Exit criteria

The build is ready for user acceptance sign-off when:

- Every P0 case passes.
- No open defect risks data loss, incorrect financial reporting, security exposure, or invoice/BAS audit history.
- Any failed P1 case has an agreed owner and disposition.
- The tested build commit, deployment URL, spreadsheet copy, and evidence are recorded above.
- The production deployment remains untouched until sign-off.
