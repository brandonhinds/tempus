# Features / Updates

## In-Progress Changes

- Invoice TODOs:
    * When editing an a line item that uses the hours worked method for input, the amount stays at the previously calculated amount. The UI should always show "Auto-calculated" whenever that mode is used, rather than the amount that was previously calculated.
    * Have the linked entry part of the card also optimistically update when editing / adding a line item.
    * Hide the "Hour type" label for line items that use raw amounts.
    * Move Contract and Amount to the left of the line item card, so that way the hours and hour type fields are on the right side when they disappear. Also have these inputs properly share the space 25% each.
    * When editing a line item or default line item the edit should happen in place of the entry being edited. At the moment the edited entry is visible as if we were making a new entry, which is confusing.
    * Ensure default item adds/edits work the same way the line items do.
    * Test the workflow for Publishing an invoice (as yet untested)
    * Update invoice names to not include the date
    * Check with Lil how she wants the invoice numbers to default to being randomly generated.
    * Remove all the debug statements
    * Add a way to view all invoices for the financial year, probably as another table on the BAS reporting screen.

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents (they should be put back into company profit)
    * Provide export/print options for monthly or quarterly lodgements

## Big Changes

- Add the invoice requirements (all behind feature flags)
    * Already had one attempt at this but it got too big / unwieldy. We need a simpler way to define default fields, line items, and amounts.

- Make buttons / UI element *sexy* like JB's

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Make the UI dynamic based on browser width

- Make the sheet (at least some of it) work on mobile

- Refactor scripts sheet to split up all functions into relevant categories

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

- Standardise the names of the feature flags (capitalisation all over the place, phrasing, etc.)
    * Figure out if the values in the sheet are actually used, outside of the backend name and whether it is enabled or not. I suspect the labels are all from the client code than the backend table.

- Remove the company parts of the income breakdown when company feature flag is disabled

## May Not Be Possible / Reconsider
- Have a new, basic time entry mode where someone just puts in the total hours. In this mode double clicking on a calendar cell would allow the entry to be directly edited there. This mode would need to be feature flagged because it would be incompatible with the other data entry methods.
    * Consider whether this is a good idea, because it would be the only feature that is truly incompatible with other parts of the sheet.

- Things that may not be possible:
    * Add colours to hour type drop down (or dots of the colour or something)

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