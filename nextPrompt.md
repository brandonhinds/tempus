The next things we want to include:

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

- Make it clear that the "Save Settings" button needs to be clicked when settings are updated. The theme, for example switches immediately, even though it has not be saved.

- Make buttons / UI element *sexy* like JB's

- Payroll helper reports need to respect rounding setting

- Xero add accumulated hours to weekly report

- Add alternative views to hours, such as weekly and fortnightly (feature flag)

- Geoff requests:
    * The ability to print/save to PDF the month's timesheet, including any hour types indicated to be included. The work hour's should be obvious (e.g. bold). This view also needs to include a summary of the total number of hours for each type for the month, in a way that can be sent to the client for review.
    * It should be possible to add company expenses with the same name, in the event that monthly costs bleed into one another due to the billing cycle.
    * Company expenses should be able to be categorised, and the categories can be sorted / subcategories filtered. This would help keep expenses organised.
    * Update the contract management view include a bar chart of the hours over the contract.

---

The users should be able to toggle the views, with the default being financial. I am not sure the best way to present this; maybe there are two inputs; one for annual view vs FY view, and then a dropdown for all years with available data in them.

This also reminds me that I would like the FY view specifically to have a breakdown of paid tax vs expected tax (expected tax is based off the broader Australian tax brackets + the 2% medicare levy). If you don't have those formulas handy let me know and I can provide them in a future prompt. We also need to add a toggle in the settings for whether the user is liable for the additional 2% medicare levy that happens when you are over 30 and don't have health insurance (I think I am remembering those requirements properly).

Lets make the stacked columns, from bottom to top; tax, deductions, superannuation, net income. The total will be the gross income. I would like the stacked parts of the column to have data labels for their individual sections, with the gross income being listed at the top. That does leave out superannuation lost to deductions, so maybe we can find a way to visualise that too.

The pie chart should show the breakdown of where income goes, but if there is more than one contract for the year (either annual or financial) then hae another pie chart show this split in gross incomes.

Pick the best charting library you can think of for my requirements. I don't have a preference.

For more than one contract can you please make it a filter similar to the multiple hour types on the calendar view, where I can select more than one, select all, select none, etc.

The pie chart for hour types should respect the contract filter I just mentioned above.

Month bars for the data granularity. I don't think it needs to be configurable.

---

The views are now loading, but it doesn't feel good to use because the data keeps popping in and out. Can you please implement caching so the data is nice and snappy.

I have noticed that toggling the financial year/annual year toggle does not immediately update the view. I then have to select an option in the year dropdown, even though the view I want is the default selected. Can you please update it so toggling the view instantly loads the data for the corresponding view. When switching between annual and FY, the calendar year corresponds with the first half of the financial year.

I also noticed I have options for dates way in the future of data actually in the sheet. I have public holidays loaded until 2028, however I only have time entries for the second half of 2025. That means I should only be able to see 2025 in the calendar year, and FY 2025-26 in the financial year review. If I add data into June 2025 I should then be able to load the previous FY, but still only have 2025 as the calendar view.

I also don't mind the graphs, but they could look a bit sexier. Can you please review the styling?

---

The rounded edges on the bar chart look a little strange. Can you please revert those. I do like the donuts, though can you make the hole in the middle a little smaller?

I also noticed the deductions aren't being populated correctly.

The year picker also shows lots of years that I do not have data for. At the moment it shows 2024 - 2027 in the calendar year view, and FY 23-24 to FY 27-28, despite only having inputs for 2025 and FY 25-26.

The data also still isn't immediately switching when I change the year / toggle. It is ok if the data needs to be collected, but then maybe the fields and graphs need to get fuzzy to indicate they are still loading.

---

{
  "startYear": 2025,
  "hourTypeBreakdown": [],
  "monthlyData": [
    {
      "extraSuper": 0,
      "otherDeductions": 0,
      "totalHours": 17.75,
      "year": 2025,
      "taxableIncome": 1562,
      "companyIncome": 1775,
      "tax": 34,
      "label": "Jul 2025",
      "grossIncome": 1775,
      "companyExpenses": 0,
      "hourTypeHours": {
        "advanced": 1065
      },
      "invoiceTotal": 1952.5000000000002,
      "companyExpensesGst": 0,
      "superGuarantee": 213,
      "month": 6,
      "contractIncome": {
        "da5f3460-f184-4b1b-b817-270e92e3c01e": 1775
      },
      "netIncome": 1528,
      "superLost": 0
    },
    {
      "otherDeductions": 0,
      "extraSuper": 0,
      "companyIncome": 23512.5,
      "taxableIncome": 20691,
      "year": 2025,
      "totalHours": 213.75,
      "tax": 8232,
      "label": "Aug 2025",
      "grossIncome": 23512.5,
      "companyExpenses": 0,
      "hourTypeHours": {
        "basic": 12825
      },
      "invoiceTotal": 25863.750000000004,
      "companyExpensesGst": 0,
      "superGuarantee": 2821.5,
      "month": 7,
      "contractIncome": {
        "8a0455f0-47c6-4488-8384-4d09655a03a4": 23512.5
      },
      "netIncome": 12459,
      "superLost": 0
    },
    {
      "otherDeductions": 0,
      "extraSuper": 0,
      "totalHours": 42.08333333333333,
      "companyIncome": 4629.166666666666,
      "year": 2025,
      "taxableIncome": 4073.666666666666,
      "tax": 738,
      "label": "Sep 2025",
      "grossIncome": 4629.166666666666,
      "companyExpenses": 0,
      "hourTypeHours": {
        "basic": 2525
      },
      "invoiceTotal": 5092.083333333333,
      "companyExpensesGst": 0,
      "superGuarantee": 555.4999999999999,
      "month": 8,
      "contractIncome": {
        "8a0455f0-47c6-4488-8384-4d09655a03a4": 4629.166666666666
      },
      "netIncome": 3335.666666666666,
      "superLost": 0
    },
    {
      "otherDeductions": 3500,
      "extraSuper": 0,
      "companyIncome": 14520,
      "totalHours": 132,
      "year": 2025,
      "taxableIncome": 8853.1,
      "tax": 4109,
      "grossIncome": 14520,
      "label": "Oct 2025",
      "companyExpenses": 4.5,
      "hourTypeHours": {
        "basic": 3405,
        "advanced": 4515
      },
      "invoiceTotal": 15972.000000000002,
      "companyExpensesGst": 0,
      "superGuarantee": 1742.3999999999999,
      "month": 9,
      "contractIncome": {
        "8a0455f0-47c6-4488-8384-4d09655a03a4": 14520
      },
      "netIncome": 4744.1,
      "superLost": 420
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "taxableIncome": -204.89999999999998,
      "companyIncome": 1045,
      "year": 2025,
      "totalHours": 9.5,
      "tax": 0,
      "label": "Nov 2025",
      "grossIncome": 1045,
      "companyExpenses": 4.5,
      "hourTypeHours": {
        "basic": 570
      },
      "invoiceTotal": 1149.5,
      "companyExpensesGst": 0,
      "superGuarantee": 125.39999999999999,
      "month": 10,
      "contractIncome": {
        "8a0455f0-47c6-4488-8384-4d09655a03a4": 1045
      },
      "netIncome": 0,
      "superLost": 120
    },
    {
      "otherDeductions": 1000,
      "extraSuper": 0,
      "companyIncome": 0,
      "totalHours": 0,
      "taxableIncome": -1124.5,
      "year": 2025,
      "tax": 0,
      "label": "Dec 2025",
      "grossIncome": 0,
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 11,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "otherDeductions": 1000,
      "extraSuper": 0,
      "totalHours": 0,
      "taxableIncome": -1124.5,
      "companyIncome": 0,
      "year": 2026,
      "tax": 0,
      "grossIncome": 0,
      "label": "Jan 2026",
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 0,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "companyIncome": 0,
      "totalHours": 0,
      "taxableIncome": -1124.5,
      "year": 2026,
      "tax": 0,
      "label": "Feb 2026",
      "grossIncome": 0,
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 1,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "taxableIncome": -1124.5,
      "totalHours": 0,
      "year": 2026,
      "companyIncome": 0,
      "tax": 0,
      "label": "Mar 2026",
      "grossIncome": 0,
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 2,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "taxableIncome": -1124.5,
      "year": 2026,
      "companyIncome": 0,
      "totalHours": 0,
      "tax": 0,
      "label": "Apr 2026",
      "grossIncome": 0,
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 3,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "companyIncome": 0,
      "taxableIncome": -1124.5,
      "totalHours": 0,
      "year": 2026,
      "tax": 0,
      "grossIncome": 0,
      "label": "May 2026",
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 4,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    },
    {
      "extraSuper": 0,
      "otherDeductions": 1000,
      "companyIncome": 0,
      "totalHours": 0,
      "year": 2026,
      "taxableIncome": -1124.5,
      "tax": 0,
      "label": "Jun 2026",
      "grossIncome": 0,
      "companyExpenses": 4.5,
      "hourTypeHours": {},
      "invoiceTotal": 0,
      "companyExpensesGst": 0,
      "superGuarantee": 0,
      "month": 5,
      "contractIncome": {},
      "netIncome": 0,
      "superLost": 120
    }
  ],
  "yearTotals": {
    "otherDeductions": 11500,
    "extraSuper": 0,
    "superGuarantee": 5457.799999999999,
    "totalHours": 415.0833333333333,
    "companyIncome": 45481.666666666664,
    "netIncome": 22066.766666666663,
    "superLost": 1380,
    "tax": 13113,
    "grossIncome": 45481.666666666664,
    "companyExpenses": 40.5,
    "invoiceTotal": 50029.833333333336
  },
  "contractBreakdown": [
    {
      "contractId": "da5f3460-f184-4b1b-b817-270e92e3c01e",
      "contractName": "Mid month contract",
      "grossIncome": 1775
    },
    {
      "contractId": "8a0455f0-47c6-4488-8384-4d09655a03a4",
      "contractName": "DFAT 25/26",
      "grossIncome": 43706.666666666664
    }
  ],
  "yearType": "financial"
}