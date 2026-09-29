# Expenses

The Expenses page is where you record what the business buys and pays for. It appears when company tracking and the expense ledger are both switched on in Settings.

Salary sacrifice and extra super stay on the Deductions page. Business costs are recorded only on the Expenses page. Deductions no longer has a "Company expense" switch.

The page has three tabs:

- **Transactions**: every expense. Upcoming payments from your schedules are listed first under **Due and upcoming**. Everything you have recorded follows under **Recorded**.
- **Schedules**: bills that repeat.
- **FY report**: totals for a financial year.

## Set up a recurring expense

Use a schedule for anything you pay on a regular cycle, such as insurance, rent or a subscription.

1. Open **Schedules** and choose **New schedule**.
2. Enter the vendor and the amount you pay each time, including GST.
3. Choose a **Frequency**: weekly, fortnightly, monthly, quarterly, yearly or once only.
4. Set the **Start date**, which is the date of the first payment. Later payments repeat from it. Monthly, quarterly and yearly schedules keep the start date's day. When a month is too short for it, that payment falls on the month's last day, and the next one returns to the usual day. A schedule starting 31 January pays on 28 February, 31 March and 30 April.
5. Leave **End date (optional)** blank to keep the schedule going, or set the date of the last payment.
6. Check the category, GST treatment and business-use percentage, then choose **Save schedule**.

Before you save, the form shows the next five payment dates. When you save, Tempus lists every payment due in the next 12 months under **Transactions → Due and upcoming**. Dates before today are not added. Record a past purchase as a one-off expense instead.

Each schedule row shows how often it repeats, its start and end dates, whether it is **Active** or **Paused**, when the next payment is due, and the next five dates.

### Change, pause or stop a schedule

- **Edit schedule** opens the same form. When you save, Tempus rebuilds the upcoming payments from the new details. Payments you have already recorded or paid keep their original amount and date.
- Turn off **Active** to pause a schedule. Its upcoming payments are removed, and payments already recorded stay. Editing a paused schedule leaves it paused unless you turn **Active** back on.
- **Stop schedule** (you confirm with a second click) ends the schedule today and removes its upcoming payments.
- **Extend to 12 months ahead** tops up every active schedule so a full year of payments stays listed. Saving a schedule does this for that schedule, so you only need this button now and then for long-running schedules.

## Pay a scheduled bill

Upcoming payments show **Upcoming**. Once the date arrives they show **Due**. They don't count as money spent until you act on them:

- **Mark paid** records the expense and a payment for the full amount in one step. The payment date defaults to today. You can add a reference, such as a bank or card reference, and notes.
- **Record as unpaid bill** records the expense without a payment, for a bill that has arrived but hasn't been paid yet.
- **Edit** changes this one payment only, for example when this month's bill is a different amount.
- **Skip** (you confirm with a second click) marks this payment void. The schedule won't recreate it.

## Record a one-off expense

1. Choose **Record expense**.
2. Enter the vendor, purchase date, amount including GST, category, GST treatment and business use.
3. Leave **Paid now** on if you have already paid. Tempus records a payment for the full amount, dated today unless you change it, with an optional reference.
4. Turn **Paid now** off for a bill you will pay later.
5. Choose **Save expense**.

## See what is paid

Every recorded expense shows its payment status:

- **Paid**: paid in full.
- **Part-paid**: some has been paid. The row shows the amount paid and the amount still outstanding.
- **Unpaid**: nothing has been paid yet. The row shows the amount outstanding.

Each payment is listed under its expense with the date, amount, reference and notes. Receipts appear as links.

To pay an unpaid or part-paid expense, choose **Record payment**. The amount defaults to what is still owing, and the date defaults to today. You can pay in instalments. A payment can't be more than the amount still owing.

## Receipts and reconciling

- **Add receipt** attaches a link to the receipt or tax invoice, for example a Google Drive link.
- **Reconcile** confirms that the expense matches your bank statement and tax invoice. For a taxable expense, you choose whether to claim the GST credit. If the invoice shows a different amount, you can enter the GST amount from the invoice. Claiming a GST credit needs a receipt attached first.

Reconciling locks the expense. After that it can't be edited, and its payments and receipts can't be removed. You can still record a payment that is owing and add more receipts.

## Fix a mistake

- Wrong details on an expense that isn't reconciled: choose **Edit**. You can't lower the amount below what has already been paid. Remove a payment first.
- A payment recorded in error: choose **Remove payment** under the expense, then confirm.
- A wrong receipt link: choose **Remove receipt**, then confirm.
- An expense that shouldn't exist: choose **Void**, then confirm. Void expenses stay on the list for the record and are left out of every total.
- A mistake on a reconciled expense: void it and record the corrected expense.

## What counts toward BAS and income

The expense ledger is the only source of company expenses. The dashboard income figure, the BAS table (including field 1B) and the backend BAS calculation all use the same figures.

- **Cash basis** (the default): an expense counts in the period it is **paid**, in proportion to the payments made in that period. An unpaid expense counts as $0 until you record a payment. That is why **Paid now** is on by default.
- **Accrual basis**: an expense counts in the period of its supplier invoice date, or its purchase date if there is no invoice date, whether or not it has been paid.
- **GST credits (1B)** count only for taxable expenses that are reconciled with the GST credit claimed. Any other expense counts at its full amount. Upcoming (scheduled) and void expenses never count.
- Choose the accounting basis on the BAS page. Sole traders default to accrual if no basis has been saved.

Upcoming payments from schedules appear as forecasts on the BAS page (**Scheduled expenses**), never as actuals.

## Older company expenses

Company expenses entered on the Deductions page before the expense ledger existed were moved into the ledger when Tempus upgraded. They arrived as schedules and paid transactions. They still need reconciling before they give a GST credit.

If any company-expense deductions are still listed on the Deductions page, they are read-only history, marked **Not used in calculations**. Record them on the Expenses page if they still apply.
