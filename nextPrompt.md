# Features / Updates

## In-Progress Changes

- Invoice TODOs:
    * Test the workflow for Publishing an invoice (as yet untested)
    * Check with Lil how she wants the invoice numbers to default to being randomly generated.
    * Check image.png to see that the default line does not have the exact same UI, because label, desciption, and input method are on their own rows when they should all share one row.
    * Need to allow hour decimals to go up to 4 decimal places (Lil needs at least 3 for invoices)
    * Allow the 'hours' field to be relabeled via config. To make it as Lil friendly as possible (likely the only consumer of the invoices screen) the hours numbers could be replaced with 'reports', or even the type of assessment (standard, enhanced, early cancellation, late cancellation).
    * Maybe that is another potential amount entry, where you define a dropdown of possible types of line items, and that type has a number of hours/amount associated with it.
        * Feature flag this

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents (they should be put back into company profit)
    * Provide export/print options for monthly or quarterly lodgements

## Things to Check in Beta

- How are the cents in BAS reporting meant to be handled? Do they just get rounded off and ignored, or do they get rounded off and added somewhere else?

## Big Changes

- Refactor scripts sheet to split up all functions into relevant categories

- Make the time entry work nicely on mobile
    * The UI is responsive, but it still isn't usable on a mobile

## Medium Changes

- Add new light-weight page that loads extremely quickly, that is only used to edit time for that day
    * Maybe this can be part of the mobile-centric design, as it will be most likely used on mobile devices after work.

- Projected monthly hours updates:
    * The projected variance needs to account for leave/other inputs
        * Project income based on "standard hours" (make standard hours a setting)
    * Add report that shows your hour variance to the current date vs the expected burndown up to that point on the contract screen
    * Add ability to assume a regular number of hours worked for the rest of the month in the monthly insights view

- Implement phase 10 of UI suggestion improvements.

- Build importer from old sheets to pull historical data

- Embed a scratch pad sheet into the Web app

- Non-optimistic UI
    * Adding contract
    * Adding deduction category
    * Adding default hours

## Small Changes

- Add the easter easter egg. Add a Konami Code.
    * Add cool neon theme as easter egg?
    * Can we implement brick breaker using the CSS elements as bricks?

- Implement some sort of loading screen. Can we expand on that cool CSS box?

- Company expenses on annual view
	* Company income
	* Company expenses

- Either add ability to add attachments to deductions, or remove the text saying we will have that feature

- Add the ability to optionally associate a default with an hour type. If set, the hour type is included when using the default, otherwise it just adds the hours to the currently selected hour type

- Add the ability to define a reoccurring time entry, for things like parental leave. These can auto populate up to the dates covered by contracts, to avoid making them for all time.

- Fix the calculation used by thinkStack to return lost super (make it match whatever David is doing)

- Update contract burndown so the actual average projection accounts for the pro-rate rate this month and projects out to the end of the month using the monthly average

## May Not Be Possible / Reconsider
- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.
    * Consider whether this is a good idea, because it would be the only feature that is truly incompatible with other parts of the sheet.

- Things that may not be possible:
    * Add colours to hour type drop down (or dots of the colour or something)

- Add alternative views to hours, such as weekly and fortnightly (feature flag)