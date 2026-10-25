# Expenses

The Expenses page is where you record what the business pays for. It appears when company tracking and the expense ledger are both switched on in Settings.

Salary sacrifice and extra super stay on the Deductions page. Business costs are recorded only on the Expenses page. Deductions no longer has a "Company expense" switch.

Tempus isn't meant to be your system of record. Your bank feed and your accountant's software are. An expense here is either **paid** (it has a paid date) or **unpaid**. There are no part payments, no reconciliation step and no void: if something is wrong, edit or delete it.

The page has three tabs:

- **Transactions**: every expense. Upcoming payments from your schedules are listed first under **Due and upcoming**. Everything you have recorded follows under **Recorded**.
- **Schedules**: bills that repeat, laid out like the Deductions page: schedules on the left grouped under their categories, and the selected schedule's form on the right.
- **FY report**: totals for a financial year.

## Record a one-off expense

1. Choose **Record expense**.
2. Enter the vendor, category, amount, GST treatment and business use. Type the amount including or excluding GST and the other fills in (see [Amounts including and excluding GST](#amounts-including-and-excluding-gst)).
3. **Paid** is on, with today as the paid date. Change the date if you paid on another day, and choose **Paid by**. A reference is optional.
4. **Invoice date** is optional. Leave it blank if it's the day you paid.
5. Turn **Paid** off for a bill you haven't paid yet. It then needs an invoice date.
6. Choose **Save expense**.

## Set up a recurring expense

Use a schedule for anything you pay on a regular cycle, such as insurance, rent or a subscription.

1. Open **Schedules** and choose **New schedule**.
2. Enter the vendor and the amount you pay each time, including GST.
3. Choose a **Frequency**: weekly, fortnightly, monthly, quarterly, yearly or once only.
4. Set the **Start date**, which is the date of the first payment. Later payments repeat from it. Monthly, quarterly and yearly schedules keep the start date's day. When a month is too short for it, that payment falls on the month's last day, and the next one returns to the usual day. A schedule starting 31 January pays on 28 February, 31 March and 30 April.
5. Leave **End date (optional)** blank to keep the schedule going, or set the date of the last payment. An end date before the start date means the schedule never lists a payment.
6. Check the category, GST treatment and business-use percentage, then choose **Save schedule**.

Before you save, the form shows the next five payment dates. When you save, Tempus lists the schedule's payments under **Transactions → Due and upcoming**, as far ahead as **List scheduled expenses** allows (see below). Dates before today are not added. Record a past purchase as a one-off expense instead.

Each schedule card shows the amount including and excluding GST, how often it repeats, its start and end dates and when the next payment is due. It also shows **Ended** once the end date has passed (ended schedules sort last in their category), a GST treatment other than Taxable, or a business use under 100%, when those apply. Click a card to open it.

With more than five schedules a search box appears. With three or more categories, or more than six schedules, the categories collapse, one open at a time, with **Expand all** and **Collapse all**.

### List scheduled expenses

**List scheduled expenses** in Settings (company features, with the expense ledger on) decides how far ahead each schedule's expenses are listed:

- **On the day they're due**: each one appears on its due date.
- **For the current month** (the default): all of this month's, from the 1st. Next month's appear on the 1st of next month.
- **For the whole financial year**: everything to 30 June. Next year's appear from 1 July.

Payments are created whenever Tempus or the Expenses page opens, including any that fell due while Tempus wasn't opened; those show as **Due**. Switching to a shorter option removes upcoming payments past the new window, and switching to a longer one adds them. Payments you have edited are kept.

### Change or end a schedule

The **End date** is the only thing that stops a schedule. There is no pause switch or stop button.

- **Stop paying for something**: open the schedule and set the end date to the last payment you'll make, or choose **Ends today**, then **Save schedule**. Every unpaid payment after the end date is removed, including ones that are Due and ones you edited. Due payments up to the end date stay, so you can mark them paid or skip them.
- **The amount changes**: open the schedule, type the new amount and save. Upcoming payments (due today or later) take the new amount. A Due payment, or one you changed with **Edit**, keeps its amount unless you tick the box to update it too.
- **Restart a schedule**: clear or move the end date. Payments are created again from today; nothing before today is added back.

When saving would update or remove any unpaid payments, Tempus lists them under the form before anything changes, for example "Removes 1 unpaid payment after 10 Oct 2026 (15 Oct 2026): one is Due." Choose **Save changes** to go ahead or **Go back** to keep editing. Changes that don't touch any unpaid payment, such as notes or a later end date, save straight away. Paid and skipped payments never change.

If an end date is set some other way (in the sheet, say), the unpaid payments after it are removed the next time Tempus opens.

## Pay a scheduled bill

Upcoming payments show **Upcoming**. Once the date arrives they show **Due**. They don't count as money spent until you mark them paid:

- **Mark paid** records the payment. The paid date defaults to the due date once it has arrived (today if you pay early), and **Paid by** to how you last paid that vendor. A reference is optional.
- **Edit** changes this one payment only, for example when this month's bill is a different amount. If you later change the schedule, the edited payment keeps its details unless you choose to update it (see above). Ending the schedule before it removes it. Turning **Paid** on there marks it paid too.
- **Skip** (you confirm with a second click) sets this payment aside. It doesn't count, and the schedule won't recreate it. It moves to the **Skipped** group (see below).

### Skipped payments

Skipped payments are listed at the bottom of **Transactions** under **Skipped**, folded away until you choose **Show skipped**. Each one is marked **Skipped**, greyed out, newest first.

**Restore** (you confirm with a second click) brings a payment back as it was: Due or Upcoming, or Paid if it had been paid before you deleted it. A payment dated after its schedule's end date can't be restored; move or clear the end date first. Restoring a paid payment into a BAS period marked as submitted warns you first.

A skipped payment can't be deleted, because the schedule would then list it again.

## Unpaid expenses

An unpaid expense shows **Unpaid**. Choose **Mark paid** once you've paid it.

## Fix a mistake

You can always **Edit** or **Delete** any expense. Deleting a payment that came from a schedule works like **Skip**: it moves to **Skipped**, so the schedule doesn't list it again, and you can restore it from there.

If the change would alter a BAS you've marked as submitted, Tempus warns you and names the period. Choose **Save anyway** to go ahead, or **Cancel** to leave it unchanged. The lodged BAS will no longer match Tempus if you go ahead.

## Receipts

**Add receipt** attaches a link to the receipt or tax invoice, for example a Google Drive link. Receipts are optional and don't change any figures.

## Categories

Expenses, schedules and deductions share one category list, with the same names and colours.

- Pick a category from the **Category** list on the expense or schedule form. Choose **New category…** to add one without leaving the form.
- **Manage categories** on the Expenses page (or on the Deductions page) renames, recolours or deletes them. Renaming a category renames it everywhere, including reports. Deleting one makes anything filed under it Uncategorised.
- The FY report, CSV export and the accountant report's Expenses tab group by category name.

## Amounts including and excluding GST

Every expense and schedule stores both amounts, and the expense list shows both: the amount including GST (what left your bank account) with the amount excluding GST under it.

- On the form, type either amount and the other fills in. For a Taxable expense the GST is one-eleventh of the amount including GST.
- The amount including GST is what you paid, so changing the GST treatment keeps it and recalculates the amount excluding GST. For anything other than Taxable the two are the same.
- If an invoice shows a slightly different GST, type both amounts as the invoice has them. Tempus keeps the difference as the GST.
- When business use is under 100%, the list also shows what the expense **counts** as: the amount including GST less the share of GST claimed.

## Company expenses on Time Entry

The **Company expenses** line in the Time Entry income breakdown is this month's expenses on your accounting basis, less their GST credits. Select its ⓘ to see the expenses behind it, each with its date, amount including and excluding GST, and (when business use is under 100%) what it counts as. The total matches the line. **Edit** opens that expense on the Expenses page.

## GST treatment

- **Taxable**: the price includes GST, and you get the GST credit (one-eleventh of the amount, scaled by business use).
- **GST-free**, **Input taxed** and **Out of scope**: no GST credit. Tempus treats these three the same. The labels are there for your records and your accountant.

You don't need a receipt or a reconciliation step for the credit to count. If a taxable expense shouldn't give a credit, change its GST treatment.

Business use only scales the GST credit. The full amount still counts as the expense.

## What counts toward BAS and income

The expense ledger is the only source of company expenses. The dashboard income figure, the BAS table (including field 1B) and the backend BAS calculation all use the same figures.

- **Cash basis** (the default): an expense counts on its **paid date**. An unpaid expense counts as $0 until you mark it paid. That is why **Paid** is on by default.
- **Accrual basis**: an expense counts on the **earlier of its invoice date and paid date**, whether or not it has been paid.
- The GST credit counts in the same period as the expense.
- Upcoming (scheduled) payments never count. They appear as forecasts on the BAS page (**Scheduled expenses**).
- Choose the accounting basis on the BAS page. Sole traders default to accrual if no basis has been saved.

## Upgrading from part payments and reconciliation

Earlier versions tracked payments, reconciliation and void separately. The October 2026 upgrade converts each expense once:

- Paid in full: paid on its last payment date, keeping that payment's method and reference. If it was paid across several payments, a note lists them.
- Unpaid: stays unpaid.
- **Part-paid**: before anything changes, the upgrade page lists these and you can cancel. If you continue, each becomes unpaid, keeps its full amount and gets a note of what was paid, so you can set the paid date or fix the amount.
- Void: removed (it's kept in the upgrade archive). A skipped schedule payment stays skipped.
- Every expense and schedule stores its amount excluding GST. A taxable expense's GST becomes one-eleventh of its amount, unless you corrected it from the invoice when reconciling. This fixes occurrences of old company-expense deductions whose amount you had adjusted, which kept the usual amount's GST.
- Every expense and schedule is filed under the shared category list. Company expenses moved from the Deductions page kept their category; a category you had typed is matched to the list by name, or added to it.
- The invoice date becomes the supplier invoice date, or the old purchase date if there wasn't one, so accrual figures don't move. A GST amount you corrected when reconciling becomes the expense's GST amount.
- A taxable expense you reconciled without claiming GST now claims it, with a note. Change its GST treatment if it shouldn't.
- The "Claim GST credits on taxable expenses automatically" setting is gone, because that's now how every expense works.
- The schedule **Active** switch is gone. A paused schedule gets an end date of the day before it was paused (unless it already ended sooner) and a note saying so, so it stays stopped. Clear or move the end date to restart it.

The old `expense_payments` sheet is left as it was, unused, as a record.

## Older company expenses

Company expenses entered on the Deductions page before the expense ledger existed were moved into the ledger when Tempus upgraded, including any added after the first move. They arrived as schedules and paid transactions.

A company-expense deduction is left on the Deductions page only when it has no start date Tempus can read. It is read-only history, marked **Not used in calculations**, with a review note. Record it on the Expenses page if it still applies.
