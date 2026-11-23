# Assessments

Assessments mode (the `enable_lil_assessments_mode` feature flag) records psychological assessments against a contract, prices them from a fixed catalogue, and generates one invoice per month.

## Assessment types

The catalogue lives in `LIL_ASSESSMENT_TYPES` (`backend/assessments.js`). Each type has one or more invoice lines, and each line has a wording template and a default fee written as a multiplier of the contract's hourly rate:

| Type | Lines (default fee) | Offered by default |
| --- | --- | --- |
| Standard | Report (1 × rate) | Yes |
| Enhanced | Report (1 × rate), Document review (0.105 × rate) | Yes |
| Reval | Report (1 × rate), Document review (0.105 × rate) | Yes |
| Cancellation (<24 hrs) | Fee (0.75 × rate) | Yes |
| Cancellation (>24 hrs) | Fee (0.5 × rate) | Yes |
| Cancellation (<48 hrs) | Fee (0.75 × rate) | No: a contract must opt in |

The percentage adjustment (surge) is applied on top of every line.

## Pricing per contract

On the Contracts page, in assessments mode, each contract has an **Assessment types and fees** table, stored in the contract's `assessment_pricing_json` column:

- **Offered**: whether new assessments on this contract can use the type.
- **Fee**: leave it blank for the default, enter a fixed dollar amount (**$**), or enter a multiplier of the contract's hourly rate (**×**).

A contract with nothing entered prices exactly as the original contract did. If a contract uses fixed fees for every line of a type, it doesn't need an hourly rate for that type. The billing entry then records the fee as one hour.

## Saved prices never move

When an assessment is saved, its fee is frozen in `pricing_snapshot_json`, along with each line's wording and where the fee came from (`default` or `contract`). Changing a contract's fees later doesn't change assessments that are already saved. An assessment is only repriced when you change its contract, type or adjustment.

## Retiring a type (data integrity)

The catalogue only ever grows:

- **Never remove a type, change its id, or remove or reorder its lines.** Saved assessments store the type id, and both their pricing snapshot and their invoice line items store line ids of the form `<type id>-<line number>`. If you remove a type, every old assessment of that type shows as "Historical type — review needed" and blocks its month from being invoiced again.
- **To retire a type, stop offering it.** Untick it on the contracts that no longer use it. Old assessments keep their type and their saved fee, and can still be edited. The Type list shows a retired type as "(no longer offered)", but only on the assessments already saved with it.
- An assessment can't be switched to a type its contract doesn't offer, or moved to a contract that doesn't offer its type. The form and the server both refuse it, with the same reason.
- **Add new types with `offered_by_default: false`.** Existing contracts then keep offering exactly what they always did.

## Who pays super

Each contract also has a **Super** setting (`super_paid_by`):

- **I pay my own super from these fees** (`self`, the default): super is set aside at the super guarantee rate on profit, and comes off before tax. This is how every contract worked before the setting existed.
- **The employer pays super on top** (`employer`): the client pays super straight to the fund, on top of the fees excluding GST. It isn't on the invoice and isn't Lil's taxable income. Tempus sets nothing aside for it and the fees are taxed in full. The **Employer super rate** is optional; leave it blank to follow the super guarantee rate table in Settings.

This affects three places. All of them use `invoiceSuperSplit_` (`backend/financialReporting.js`), which reads each invoice line's contract:

- **Invoice breakdown on the Assessments page.** Super is set aside only on the self-paid share of the month's fees. Business expenses are split between the two in proportion to fees. Employer super is shown as a note, not as part of the breakdown.
- **Monthly transfer split (BAS page).** The Super column covers self-paid fees only. A month's employer super is in `employer_super`, in the CSV's last column, and in a note under the table.
- **Accountant workbook.** An invoice from an employer-pays contract has nil super, and its description says "(super paid by employer)".

## Invoices and money figures

Generating a month's invoice saves its money figures with it: fees, GST, business expenses, super, tax, and what's yours to transfer. If the month's assessments change afterwards, or its business expenses do (an expense added, changed or marked paid in that month), the month shows **Changes since generation** and the figures are greyed out until you generate the invoice again.

The document template, output folder, invoice numbering and email settings are user settings, not hard-coded organisational data.
