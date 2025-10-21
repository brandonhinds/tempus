# Features / Updates

## In-Progress Changes

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents (they should be put back into company profit)
    * Provide export/print options for monthly or quarterly lodgements

## Big Changes

- Add the invoice requirements (all behind feature flags)
    * Already had one attempt at this but it got too big / unwieldy. We need a simpler way to define default fields, line items, and amounts.

- Add a thinkStack employee feature flag, which will do things like include the lost super in the expected pay

- Make buttons / UI element *sexy* like JB's

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

## Medium Changes

- Projected monthly hours updates:
    * The projected variance needs to account for leave/other inputs
        * Project income based on "standard hours" (make standard hours a setting)
    * Add report that shows your hour variance to the current date vs the expected burndown up to that point on the contract screen
    * Add ability to assume a regular number of hours worked for the rest of the month in the monthly insights view

## Small Changes

- Fix the theme not being honoured sometimes on refresh.

- Add the easter easter egg. Add a Konami Code.

- Implement some sort of loading screen. Can we expand on that cool CSS box?

- Update some settings to force a cache flush when enabled or updated (e.g the superannuation percentage)

- Make all interactions with the UI optimistic. Examples that currently aren't:
    * Deleting entries

- *GEOFF REQUEST* The ability to print/save to PDF the month's timesheet, including any hour types indicated to be included. The work hour's should be obvious (e.g. bold). This view also needs to include a summary of the total number of hours for each type for the month, in a way that can be sent to the client for review.

- Company expenses on annual view
	* Company income
	* Company expenses

- Split up feature flags into categories for better organisation

- Add Koffee link

- Add hover icons for all settings explaining what they do. Alternatively, make them sub-texts.

- Update "State/Territory" to make it clear it is related to the public holidays that are displayed.

- Update the Favicon to something real (especially important because we cannot set the tab title without the pop-up issue)

- Remove the `[Actual Income]` debugging in the console log

- Remove the `Rendering hour types pie chart with data` debugging in the console log of the annual view

## May Not Be Possible / Reconsider
- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.
    * Consider whether this is a good idea, because it would be the only feature that is truly incompatible with other parts of the sheet.

- Things that may not be possible:
    * Add colours to hour type drop down (or dots of the colour or something)
