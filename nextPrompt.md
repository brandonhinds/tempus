The next things we want to include:

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

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

- Add Xero reporting mode

- Add MYOB reporting mode (weekly total hours)

- Make it clear that the "Save Settings" button needs to be clicked when settings are updated. The theme, for example switches immediately, even though it has not be saved.

- It looks like defaults_hours are not being saved in the backend, so moving to a new browser or clearing your cache likely removes them.

- Geoff requests:
    * The ability to print/save to PDF the month's timesheet, including any hour types indicated to be included. The work hour's should be obvious (e.g. bold). This view also needs to include a summary of the total number of hours for each type for the month, in a way that can be sent to the client for review.
    * It should be possible to add company expenses with the same name, in the event that monthly costs bleed into one another due to the billing cycle.
    * Company expenses should be able to be categorised, and the categories can be sorted / subcategories filtered. This would help keep expenses organised.
    * Update the contract management view include a bar chart of the hours over the contract.
    * Include an optional field in the month that indicates at the current rate whether you will be above or below your contracted hours. This should be a badge like some other items.

---

That looks good. Now I would like to add another badge, which is behind a feature flag. This badge would only show when the month has data entries from a contract, and it would give an indication of whether the user was ahead of behind their expected average hours in the month based on the trend for that month, the number of hours in their whole contact, and the length of their contract. The badge, before it is expanded, should show the average number of daily hours for the  month (it should only take into account work days, unless there is a data entry on a weekend, in which case those hours should be included without including the day). When the badge is clicked, it should show a breakdown of the average number of daily hours, how many days are being included in the calculation, how many business hours remain, and whether the user will be over or under the expected hours for the month. Based on the current month's trends, it should show the expected total number of hours over/under for the month.

The feature flag should be called something like "expected_monthly_hours".

If a user has multiple contracts in a month we should analyse each contract separately.

Business days are mon-fri. No need to worry about public holidays, as they should be baked into the hours of the contract. The business hours remain, and all other analysis for this feature, should be contained to that month. There are other places that we report on hours for the whole contract.

We should calculate expected daily hours as contract hours divided by number of business days in the contract.

We should pro rata any mid-month calculations.

Weekend hours contribute to the total hours but should not count towards days worked. The assumption is any weekend work is bad, however that is not always valid, so maybe we can add a field to the contract management screen to see whether weekends should be included in expected average daily calculations (and if that is set then all days should be considered, and not just week days).

For the projection, we should show an absolute number rather than a percentage.

he badge style should match the other badges, as it should be visually consistent with the other badges. Colour should only be used in the breakdown after the badge is clicked.

Only hours types that contribute to income should be included. Even if other hours have been associated with a contract, they should not be considered.