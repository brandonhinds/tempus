The next things we want to include:

- Incorporate the public holiday API to update the public holidays once a day. We can use [this website](https://date.nager.at/swagger/index.html). We will need the user to provide their state from a dropdown list (assume ACT).

- Add the ability to add salary sacrifice options, as well as a novated lease.

- Add the invoice requirements (all behind feature flags)

- Add a thinkStack employee feature flag, which will do things like include the lost super in the expected pay

- Add BAS tracking
    * Enable both monthly and quarterly payments

- Add ability to switch months using a date picker (with just months and years)

- Add ability to add actual pay for comparison

- Update some settings to force a cache flush when enabled or updated (e.g the superannuation percentage)

- Remove the New Entry button from the entries list at the bottom of the sheet.

- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.

- Make it clear that the "Save Settings" button needs to be clicked when settings are updated. The theme, for example switches immediately, even though it has not be saved.

- Make buttons / UI element *sexy* like JB's

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Geoff requests:
    * The ability to print/save to PDF the month's timesheet, including any hour types indicated to be included. The work hour's should be obvious (e.g. bold). This view also needs to include a summary of the total number of hours for each type for the month, in a way that can be sent to the client for review.
    * It should be possible to add company expenses with the same name, in the event that monthly costs bleed into one another due to the billing cycle.
    * Company expenses should be able to be categorised, and the categories can be sorted / subcategories filtered. This would help keep expenses organised.
    * Update the contract management view include a bar chart of the hours over the contract.
