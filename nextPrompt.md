The next things we want to include:

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents (they should be put back into company profit)

- Add the easter easter egg. Add a Konami Code.

- Implement some sort of loading screen. Can we expand on that cool CSS box?

- Make the BAS table clickable to get relevant details in BAS form format

- Add ability to make BAS entry as reported

- Add the invoice requirements (all behind feature flags)

- Add a thinkStack employee feature flag, which will do things like include the lost super in the expected pay

- Expand BAS reporting
    * Provide export/print options for monthly or quarterly lodgements

- Add ability to switch months using a date picker (with just months and years)

- Add ability to add actual pay for comparison

- Update some settings to force a cache flush when enabled or updated (e.g the superannuation percentage)

- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.

- Make buttons / UI element *sexy* like JB's

- Xero add accumulated hours to weekly report

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Make all interactions with the UI optimistic. Examples that currently aren't:
    * Deleting entries

- Add ability to have alternate hours that will calculate effective hourly rate (for Lil's scenario)

- Geoff requests:
    * The ability to print/save to PDF the month's timesheet, including any hour types indicated to be included. The work hour's should be obvious (e.g. bold). This view also needs to include a summary of the total number of hours for each type for the month, in a way that can be sent to the client for review.
    * It should be possible to add company expenses with the same name, in the event that monthly costs bleed into one another due to the billing cycle.
    * Company expenses should be able to be categorised, and the categories can be sorted / subcategories filtered. This would help keep expenses organised.
    * Update the contract management view include a bar chart of the hours over the contract.
