# Features / Updates

## In-Progress Changes

- Invoice TODOs:
    * Check with Lil how she wants the invoice numbers to default to being randomly generated.
    * Test the workflow for Publishing an invoice (as yet untested)

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents on the invoice GST, by rounding that number down, and then increasing company income by the amount that was rounded off.
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

- Fix the calculation used by thinkStack to return lost super (make it match whatever David is doing)
