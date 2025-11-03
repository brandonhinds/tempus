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

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

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

- Update the Favicon to something real (especially important because we cannot set the tab title without the pop-up issue)

- Move the punch in/out button down next to Add Entry

- Improve custom theme implementation
    * Add constraints or auto-generated supporting shades (derived lighter/darker variants) to maintain readability.
    * Provide preview indicators (contrast checks) when users pick low-contrast palettes.

- Today's date is auto-prepop'd when loading the calendar, but it should pre-pop the whole entry if there is an existing entry. This allows people to edit today's entry quickly.

- Either add ability to add attachments to deductions, or remove the text saying we will have that feature

- Add the ability to optionally associate a default with an hour type. If set, the hour type is included when using the default, otherwise it just adds the hours to the currently selected hour type

- Add the ability to define a reoccurring time entry, for things like parental leave. These can auto populate up to the dates covered by contracts, to avoid making them for all time.

- Fix the calculation used by thinkStack to return lost super (make it match whatever David is doing)

## May Not Be Possible / Reconsider
- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.
    * Consider whether this is a good idea, because it would be the only feature that is truly incompatible with other parts of the sheet.

- Things that may not be possible:
    * Add colours to hour type drop down (or dots of the colour or something)

## Bugs from Initial Creation

- The total hours for the month, without any hours added in the entire sheet, is `0.02`.

- The hour entries are not displaying until some feature flags are enabled. Will need to track down which.

- When adding a deduction the "No categories yet" message takes up a lot of room. A user shouldn't need to add a category, so there should be a way to opt out of that message.

- The spacing of the add deduction modal is all out

- The projected variance is out by a fairy amount. It thinks monthly hours should be 112, rather than 143.75.

- Public holidays are loading into the database but are not showing up in the calendar view

- Days without time are coming through as 0.02, rather than 0, on the payroll helper. This is probably related to the hours showing 0.02 when the sheet is empty.

- Have the number of hours persist switching hours, as long as both the old and new values don't already exist

- Fix update process:
    * Download latest version of repo
    * Open directory with clasp clone and delete all non-hidden files
    * Replace contents with files from git repo
    * clasp push

    We should be able to automate that whole process

- Prevent users from modifying settings until they've been synced (they are visible but read only)

## Logo

https://www.design.com/maker/logo/geometric-time-hourglass-237278?text=Tempus&layoutOrientation=auto&colorPalette=grayscale&isVariation=True&searchImpressionId=d5f8f130-bed6-4a24-b02a-ebafdba1e506

## Invoice Initial Prompt

I would like the ability to add invoices to Tempus. The features I would like this to have include:

- The ability to make one or more invoices per month. Most users who use this would only need one invoice, but I don't want to assume that is always the case.
- For each invoice, specify the following:
  * Single details like date and invoice number
  * Multiple line items, each of which has its own details like date, service description, and amount

When adding a line item, I want to be able to specify all the fields manually, but also maintain a list of "default" line items that I can select from, which would insert some placeholder values that I can then either take as is, or edit further.

Assuming the hour types feature is enabled (I will likely make this mandatory in the future) then a line item should also be able to be associated with both an hour type and a number of hours. This will effectively allow people to track their work through the invoice form, but those time sheet entries should also be visible on the normal calendar view too.

Invoices will be generated by cloning a template that a user has in their Google drive and updating the placeholders in it. We need a setting that specifies where the template is inside their drive. We also need buttons that will allow us to create an invoice once all the config has been added.

Can you please design this implementation and present a detailed plan. We've already attempted this feature implementation once before and it didn't work, and while I think I rolled out all the code from that implementation, but it is worth double checking.

Please ask any clarifying questions before beginning.
