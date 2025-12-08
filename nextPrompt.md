# Features / Updates

## In-Progress Changes

- Invoice TODOs:
    * Check with Lil how she wants the invoice numbers to default to being randomly generated.
    * Test the workflow for Publishing an invoice (as yet untested)

- BAS fixes:
    * Figure out differences in company vs sole trader mode for BAS. Ensure the sole trader feature flag behaves as expected.
    * Deal with the rounding off the cents on the invoice GST, by rounding that number down, and then increasing company income by the amount that was rounded off.
    * Provide export/print options for monthly or quarterly lodgements

- Mobile view:
    * Needs to respect the theme
    * The form could use some rework. It's very busy.
    * The date picker should be styled similarly to the monthly one on the calendar view.
    * It seems to load slowly. After today's entry has loaded it should lazy load the other days 14 days either side.
    * Should be able to use defaults
    * Link to the mobile view from the about screen

## Things to Check in Beta

- How are the cents in BAS reporting meant to be handled? Do they just get rounded off and ignored, or do they get rounded off and added somewhere else?

## Big Changes

- 

- 

## Medium Changes

- 

- Non-optimistic UI
    * Adding contract
    * Adding deduction category
    * Adding default hours

## Small Changes

- Add the easter easter egg. Add a Konami Code.
    * Add cool neon theme as easter egg?
    * Can we implement brick breaker using the CSS elements as bricks?

- Company expenses on annual view
	* Company income
	* Company expenses

- Fix the calculation used by thinkStack to return lost super (make it match whatever David is doing)
