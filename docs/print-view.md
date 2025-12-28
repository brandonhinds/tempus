# Print View

A printable monthly calendar showing hour breakdowns by type, formatted to fit on a single A4 page for timesheets and records.

## Purpose
The Print View feature generates a printer-friendly monthly calendar that displays your time entries organised by hour type. Each day shows income-generating hours as a combined total and non-income hours (like leave or training) as separate labelled entries. The output is optimised for A4 paper, making it easy to print physical timesheets for record-keeping, client submissions, or payroll verification.

**Important:** This feature requires hour types to be enabled. Without hour types, there's nothing to categorise and display in the print view.

## Enabling Print View

**Requires:** *Enable monthly hours print view* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable *Enable monthly hours print view*.
5. Click **Save Settings**.
6. The **Print Monthly Hours** button appears below the calendar on the Time Entry page.

**Note:** You must also have *Enable multiple hour types* enabled, as the print view categorises hours by type.

## Accessing Print View

1. Navigate to the **Time Entry** page (or **Dashboard & Calendar**).
2. Select the month you want to print using the calendar navigation arrows.
3. Scroll below the calendar to the action buttons.
4. Click **Print Monthly Hours**.
5. The hour type selection modal opens.

## Selecting Hour Types

The print view limits which hour types can be included to ensure the calendar fits on a single A4 page:

### Hour Type Limits
- **Income-generating hours**: Select at least **one** (all selected income types are combined into a single total per day)
- **Non-income hours**: Select up to **two** (each displays separately with labels)

**Why these limits?** Including too many hour types makes the calendar cells too tall, causing the layout to overflow onto multiple pages. The limits ensure readability whilst fitting on one A4 sheet.

### Selection Modal

The modal divides hour types into two sections:

#### Income-Generating Hours
All hour types marked as "Contributes to income" appear here. You can select one or more - they will all be summed together and displayed as a single total per day on the printed calendar.

**Example:** If you select "Standard Work" (8 hours) and "Overtime" (2 hours) for a day, the printed calendar shows **10** as the combined income total for that day.

#### Other Hour Types
Non-income hour types (leave, training, admin, etc.) appear here. You can select up to two. Each selected type displays separately with its label on the printed calendar.

**Tip:** Use the **Unselect all** button to quickly clear all non-income selections if you only want billable hours on your printout.

### Validation

The modal validates your selection in real time:
- **Warning if no income types selected**: "Select at least one income hour type."
- **Warning if more than 2 non-income types selected**: "Maximum 2 non-income hour types allowed."
- The **Generate Print View** button is disabled until your selection is valid.

## Generating the Print View

1. Select your hour types (ensuring at least one income type and no more than two non-income types).
2. Click **Generate Print View**.
3. A new browser window opens with the printable calendar.
4. The calendar shows:
   - Month and year header
   - 7-column grid (Monday to Sunday)
   - Each day cell with:
     - Day number
     - Non-income hours (if any) with labels and subtle styling
     - Income hours as a bold total at the bottom of the cell
5. Summary tables below the calendar:
   - **Billable Hours** table listing each selected income hour type with totals
   - **Other Hours** table listing each selected non-income hour type with totals

## Printing the Calendar

Once the print view opens:

1. Use your browser's print function (**Ctrl+P** or **Cmd+P**, or **File → Print**).
2. Verify the print preview shows the calendar fitting on one A4 page.
3. Adjust your browser's print settings if needed:
   - **Paper size**: A4
   - **Orientation**: Portrait
   - **Margins**: Default (the layout includes 10mm top/bottom, 15mm left/right)
   - **Headers and footers**: Disable browser headers/footers for cleaner output
4. Click **Print** to send to your printer or save as PDF.

**Tip:** If you only need a PDF copy, use your browser's "Save as PDF" option instead of printing to a physical printer.

## How Income Hours Are Combined

All selected income-generating hour types are summed together and displayed as a single total per day:

- **On the calendar**: Each day shows one bold number representing the combined income hours for that day
- **In the summary table**: The "Billable Hours" table breaks down the totals by individual hour type for the entire month

**Example:**
- You have two income hour types: "Regular Work" and "Overtime"
- On 15 Jan, you logged 7.5 hours of "Regular Work" and 2 hours of "Overtime"
- The calendar cell for 15 Jan shows: **9.5** (bold, at the bottom of the cell)
- The summary table shows:
  - Regular Work: 150 hours (for the full month)
  - Overtime: 20 hours (for the full month)
  - **Total: 170 hours**

This design keeps the calendar clean and readable whilst providing detailed breakdowns in the summary table.

## Understanding the Print Layout

### Calendar Grid
- **Day headers**: Monday to Sunday in bold capitals
- **Day cells**:
  - **Day number** in the top-left
  - **Non-income hours** (if any) in small grey boxes with labels (e.g., "4 Leave")
  - **Income hours** as a large bold number anchored to the bottom
- **Empty days**: Days with no logged hours appear as empty cells
- **Colour coding**: Hour type colours (from your hour type settings) appear as small dots in the summary tables

### Summary Tables
Two tables appear below the calendar:

#### Billable Hours Table
- Lists each selected income hour type
- Shows total hours for the month per type
- Grand total row at the bottom
- Green accent colour for income emphasis

#### Other Hours Table (if applicable)
- Lists each selected non-income hour type
- Shows total hours for the month per type
- Grand total row at the bottom
- Grey accent colour for non-income distinction

### Page Layout
- **A4 portrait orientation**: 210mm × 297mm
- **Margins**: 10mm top/bottom, 15mm left/right
- **Single page**: All content fits on one A4 sheet
- **Print-optimised styling**: High contrast, clear typography, minimal colours for better printing

## Tips for Using Print View

- **Complete entries first**: Ensure all time entries for the month are logged and finalised before generating the print view. The view is a snapshot - it doesn't update automatically if you edit entries later.
- **Choose relevant hour types**: Only select the hour types you need on the printout. If you only want billable hours, select all income types and zero non-income types.
- **Combine income hours**: Use the income-combining behaviour to keep the calendar clean. If you track multiple billable hour types (work, overtime, consulting), they all sum together on the calendar whilst the summary table shows the breakdown.
- **Limit non-income types**: Be selective with non-income hour types. If you track leave, training, and admin but only need leave on your printout, select only leave.
- **Check print preview**: Always review the print preview before printing to ensure the layout fits correctly. Adjust your browser zoom or print scaling if needed.
- **Save as PDF**: If you need a digital record, save the print view as a PDF instead of printing to paper.
- **Month boundaries**: The print view only shows days within the selected month. Weeks don't span months like in payroll helpers.
- **Hour type colours**: The hour type colours from your settings appear as small dots in the summary tables for visual identification.
- **Regenerate if needed**: If you make changes to entries after generating the print view, close the print window and regenerate to see the updated data.
- **Theme independence**: The print view uses fixed styling (black text on white background) regardless of your active theme, ensuring consistent print output.

## Common Print View Questions

### Why can't I see the Print Monthly Hours button?
You need to enable both the *Enable monthly hours print view* feature flag and the *Enable multiple hour types* feature flag. Print view requires hour types to categorise entries.

### Can I select more than two non-income hour types?
No. The layout is designed to fit on one A4 page, and including more than two non-income hour types causes cells to overflow. Keep non-income selections to two or fewer.

### Why are all my income hours combined into one number?
This is intentional. Combining income hour types keeps the calendar cells clean and readable. The summary table below the calendar shows the breakdown by individual hour type.

### Can I customise the print layout?
No. The layout is fixed to ensure reliable A4 output. If you need different formatting, consider using the calendar view or export features (if available).

### Why does the print view open in a new window?
Opening in a new window allows you to print without disrupting your current session. You can close the print window after printing and continue working in Tempus.

### Do I need to select all hour types?
No. Only select the hour types you want on the printout. If you only care about billable hours, select just the income types and leave non-income types unselected.

### Can I print multiple months at once?
No. Each print view generates one month at a time. To print multiple months, generate and print each month separately.

### Why don't my hour type colours appear on the printed calendar?
Hour type colours are minimised on the calendar itself (shown as small dots in the summary tables) to ensure good contrast and readability when printed. The calendar uses high-contrast black-and-white styling for the main content.

### What if my calendar doesn't fit on one page?
This usually happens if your browser's print scaling is incorrect. Check your print preview settings:
- Ensure "Fit to page" or "Scale: 100%" is selected
- Disable any browser-added headers/footers
- Verify the paper size is set to A4

If the content still overflows, you may have selected too many non-income hour types. Reduce to two or fewer.

## Summary

Print View transforms your monthly time entries into a printable A4 calendar optimised for physical timesheets and record-keeping. By combining income hour types into clean daily totals and limiting non-income types to two, the layout stays readable whilst fitting on a single page. Generate the view, select your hour types, and print directly from your browser to create professional timesheet documentation.

For the full Tempus time tracking experience, see [Dashboard & Calendar documentation](docs/dashboard-calendar.md).
