# Timesheet 1.0 Importer

Migrate legacy Timesheet 1.0 spreadsheets into Tempus with automated mapping, duplicate detection, and validation.

## Purpose
The Timesheet 1.0 Importer transforms data from the legacy Timesheet 1.0 Google Sheets format into Tempus time entries automatically, preserving all historical hours whilst mapping old hour type labels to your current hour type configuration. Instead of manually re-entering months or years of time data, the importer reads month-based sheets from the legacy workbook, identifies hour type labels and dates, maps them to your Tempus contracts and hour types, detects duplicate entries to prevent double-counting, and bulk-creates entries with full validation. The process supports public holiday exclusion, handles unmapped hour types through an interactive mapping interface, and provides contract selection when multiple valid contracts exist for the same period.

**Important:** The importer creates basic (manual) time entries with midnight-based punches representing the total duration. All imported entries are treated as standard time entries and can be edited or deleted individually after import.

## Enabling the Timesheet 1.0 Importer

**Requires:** *Enable Timesheet 1.0 importer* feature flag

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Time Entries** group.
4. Enable *Enable Timesheet 1.0 importer*.
5. Click **Save Settings**.
6. The **Import Timesheet 1.0** button appears on the Time Entry page.

## Accessing the Importer

1. Navigate to the **Time Entry** page.
2. Click **Import Timesheet 1.0** (appears in the toolbar when the flag is enabled).
3. The Timesheet 1.0 Importer modal opens.

## Understanding the Import Process

The importer follows a multi-stage workflow:

### Stage 1: File Selection
Provide the Google Sheets file ID for your legacy Timesheet 1.0 workbook. The importer reads all month-named sheets (January, February, etc.) and extracts date rows with their associated hour type labels and values.

### Stage 2: Preview & Mapping
Tempus analyses the extracted data and presents:
- **Hour type mapping**: Match legacy hour type labels to your current hour types
- **Contract selection**: Choose which contract(s) to assign entries to
- **Duplicate detection**: Identify entries that already exist in Tempus
- **Summary statistics**: Review total importable entries, duplicates, and warnings

### Stage 3: Import Execution
After resolving all mapping and contract requirements, run the import to create entries in bulk. The importer processes entries in batches, handling large datasets with continuation tokens to avoid timeout issues.

**Continuation handling:** If import takes longer than the Apps Script time limit (~5 minutes), Tempus automatically continues from where it left off with progress tracking.

## Preparing for Import

Before importing, complete these setup steps to streamline the process:

### Configure Contracts
Create contracts in Tempus that cover the date ranges in your legacy data. The importer requires every hour type flagged as "requires contract" to have a valid contract for each entry date.

**Example:** If your Timesheet 1.0 data spans Jan 2023 - Dec 2023, create a contract with start date 1 Jan 2023 and end date 31 Dec 2023 (or use multiple contracts for different periods/clients).

See [Contracts documentation](contracts.md) for contract setup.

### Configure Hour Types
If your Timesheet 1.0 data uses multiple hour type labels (Work, Leave, Training, etc.), enable hour types in Tempus and create matching hour types before importing.

**Mapping behaviour:**
- **Automatic matching**: The importer auto-matches labels by name (case-insensitive). If your legacy sheet has "Work" and you have a "Work" hour type in Tempus, it maps automatically.
- **Manual mapping**: Unmapped labels require manual selection during preview. You choose which Tempus hour type corresponds to each legacy label.

**Tip:** Create hour types with names matching your legacy labels to minimise manual mapping.

See [Hour Types documentation](hour-types.md) for hour type configuration.

### Check Public Holidays Configuration
The importer can skip public holidays automatically if you have public holidays enabled. Entries falling on configured public holidays are excluded from import if the "Skip public holidays" toggle is enabled.

See [Settings documentation](settings.md) for public holiday configuration.

## Using the Importer

### Step-by-Step Import Workflow

1. **Open the importer modal** by clicking **Import Timesheet 1.0** on the Time Entry page.
2. **Enter the Google Sheets file ID**:
   - Open your legacy Timesheet 1.0 spreadsheet in Google Sheets
   - Copy the file ID from the URL (the long string between `/d/` and `/edit`)
   - Paste it into the "Google Sheets File ID" field
3. **Toggle "Skip public holidays"** if you want to exclude entries on public holidays (enabled by default when public holidays are configured).
4. **Click "Preview Import"** to analyse the legacy data.
5. **Review the preview**:
   - Check the summary statistics (importable, duplicates, unmapped)
   - Scroll through months to see what will be imported
6. **Map unmapped hour types**:
   - If any hour type labels couldn't be auto-matched, they appear in the Hour Type Mapping section
   - Use the dropdown next to each legacy label to select the corresponding Tempus hour type
   - Click "Preview Import" again to refresh with updated mappings
7. **Select contracts**:
   - For each month and hour type that requires a contract, choose from valid contracts in the Contract Selection section
   - If no valid contracts exist, create them in the Contracts page first
   - Click "Preview Import" again to refresh with contract selections
8. **Review the final preview**:
   - Verify all hour types are mapped
   - Verify all contracts are selected
   - Check the importable count and duplicate count
9. **Click "Run Import"** to execute the import.
10. **Wait for completion**:
    - Progress appears in the status message
    - Large imports may show continuation messages ("X added so far, Y remaining")
    - When finished, a summary shows total imported, duplicates skipped, and breakdown by month/hour type
11. **Close the modal** and verify entries appear on the calendar.

## The Importer Interface

### Google Sheets File ID Field

Enter the file ID for your legacy Timesheet 1.0 spreadsheet.

**Finding the file ID:**
1. Open your Timesheet 1.0 spreadsheet in Google Drive
2. Look at the URL: `https://docs.google.com/spreadsheets/d/FILE_ID_HERE/edit`
3. Copy the long string between `/d/` and `/edit` (e.g., `1A2B3C4D5E6F7G8H9I0J`)
4. Paste it into the field

**Validation:** The importer verifies the spreadsheet exists and is accessible when you click Preview Import.

### Skip Public Holidays Toggle

**Default:** Enabled (when public holidays are configured)

**When enabled:**
- Entries falling on configured public holidays are excluded from import
- Skipped count appears in the summary: "X public holidays skipped"

**When disabled:**
- All entries are imported, including those on public holidays

**Use case:** If you worked on public holidays or logged leave on those days in Timesheet 1.0, disable this toggle to import all entries.

### Preview Import Button

Click to analyse the legacy spreadsheet and generate a preview showing:
- What will be imported (month, hour type, entry count, total hours)
- What mappings are needed (hour types, contracts)
- How many duplicates exist
- Any validation warnings

The preview does not create entries - it only analyses. You can preview multiple times after adjusting mappings or contract selections.

**Loading time:** Preview can take 10-30 seconds for large spreadsheets with many months of data.

### Hour Type Mapping Section

**Appears when:** The preview finds hour type labels that don't auto-match existing hour types.

Each unmapped label shows:
- **Legacy label**: The name used in Timesheet 1.0
- **Dropdown**: Select which Tempus hour type this label maps to
- **Entry count**: How many entries use this label

**Example:**
```
Legacy Label: "Client Work"
Map to: [Dropdown: Work ▼]
Entries: 45
```

**Behaviour:** Selecting a mapping and re-running preview updates the analysis with the new mapping. All future previews and imports use your selected mapping.

**Tip:** If a legacy label doesn't match any current hour type, create the hour type in Tempus first, then return to the importer and preview again.

### Contract Selection Section

**Appears when:** Hour types flagged as "requires contract" need a contract selected for import.

Each month/hour type combination shows:
- **Month**: The month being imported (e.g., "January 2023")
- **Hour type**: Which hour type needs a contract
- **Dropdown**: Choose from contracts valid for all dates in that month
- **Entry count**: How many entries will use this contract

**Example:**
```
Month: 2023-01
Hour Type: Work
Contract: [Dropdown: Client A - 2023 ▼]
Entries: 20
```

**Valid contracts:** Only contracts whose date range covers all entry dates in that month appear in the dropdown.

**No valid contracts warning:** If no contracts cover the required dates, a warning appears: "No valid contracts cover all dates for this hour type. Create a contract first." You must create a contract in the Contracts page before importing.

**Tip:** Use one contract per client/year for simplest mapping, or create multiple contracts for different periods if your billing changed mid-year.

### Preview Summary Section

**Appears when:** Preview completes successfully.

Shows a month-by-month breakdown:
- **Month name**: e.g., "January (Sheet: January)"
- **Totals by hour type**: Entry count and total hours for each hour type in that month
- **Duplicates**: Entries that already exist in Tempus (skipped on import)
- **Unmapped warnings**: Labels that couldn't be mapped

**Example summary:**
```
January (Sheet: January)
- Work: 20 entries, 150.0 hours
- Leave: 2 entries, 15.0 hours
Duplicates: 0
```

**Overall totals** appear at the top:
- **Importable**: Total entries that will be created
- **Duplicates**: Total entries that already exist (skipped)
- **Unmapped**: Total entries with unmapped hour types (must resolve before import)
- **Skipped public holidays**: Total entries excluded due to public holiday toggle

### Run Import Button

**Enabled when:** Preview succeeds, all hour types are mapped, and all required contracts are selected.

**Disabled when:** No preview exists, unmapped hour types remain, or contract selections are missing.

Click to execute the import and create entries in Tempus. The button disables during import to prevent duplicate execution.

**Progress tracking:** Status message updates with progress: "Importing entries... (45 added so far, 2 duplicates skipped; 30 remaining)".

### Import Summary Section

**Appears when:** Import completes successfully.

Shows final results:
- **Total imported**: Number of new entries created
- **Duplicates skipped**: Number of entries that already existed
- **Breakdown by month/hour type**: Detailed list showing entries and hours imported per month and hour type

**Example:**
```
Import Complete!
Imported: 180 entries
Duplicates skipped: 5

Breakdown:
- January 2023 / Work: 20 entries, 150.0 hours
- January 2023 / Leave: 2 entries, 15.0 hours
- February 2023 / Work: 18 entries, 135.0 hours
...
```

**Next steps:** Close the modal and verify entries appear on the calendar. Check monthly totals match your expectations.

## Timesheet 1.0 Sheet Format

The importer expects month-named sheets (January, February, etc.) with this structure:

### Date Row
A row containing dates in cells B-H (Monday through Sunday). Dates can be:
- Google Sheets date format (automatic)
- Text format: `dd/mm/yyyy` or `dd/mm/yy`
- Serial date numbers

### Hour Type Rows
Immediately below each date row, the next 4 rows contain:
- **Column A**: Hour type label (e.g., "Work", "Leave", "Training")
- **Columns B-H**: Hours for each date (numeric values)

**Example layout:**
```
Row 1:  [blank]  | 1/1/2023 | 2/1/2023 | 3/1/2023 | ...
Row 2:  Work     | 7.5      | 8        | 7.5      | ...
Row 3:  Leave    |          |          |          | ...
Row 4:  Training | 2        |          |          | ...
Row 5:  Overtime |          |          | 1.5      | ...
```

**Parsing rules:**
- The importer scans for date rows first, then reads the next 4 rows for hour type data
- Empty cells are ignored (no entry created)
- Zero or negative values are ignored
- Values are treated as hours (decimal format)

**Limitations:**
- Only processes month-named sheets (other sheets are ignored)
- Only reads columns A-I (first 9 columns)
- Dates outside 2000-2100 are ignored to avoid mis-parsing numeric data

## Duplicate Detection

The importer prevents double-importing by checking for existing entries with the same key:

**Duplicate key:** `date + hour_type_id + contract_id`

**Behaviour:**
- Before import, Tempus loads all existing entries and builds an index
- Each import candidate is checked against the index
- Duplicates are skipped and counted separately
- Only new entries are created

**Example scenario:**
- You previously imported January 2023
- You run the importer again with the same file
- All January entries are detected as duplicates and skipped
- February entries (if new) are imported normally

**Tip:** Safe to re-run import after partial failures. Duplicates are skipped automatically, so only missing entries are created.

## Validation and Error Handling

The importer validates data at multiple stages:

### Spreadsheet Access Validation
- **Error:** "Spreadsheet not found" or "Permission denied"
- **Cause:** Invalid file ID or insufficient Google Drive permissions
- **Fix:** Verify the file ID is correct and you have view access to the spreadsheet

### Hour Type Mapping Validation
- **Error:** "Unmapped hour types exist"
- **Cause:** Legacy labels don't match any Tempus hour type and manual mapping wasn't completed
- **Fix:** Map all unmapped labels using the dropdowns, then preview again

### Contract Selection Validation
- **Error:** "Missing contract selection"
- **Cause:** Hour types requiring contracts don't have a contract selected
- **Fix:** Choose a contract for each month/hour type combination, or create a contract if none exist

### Contract Date Range Validation
- **Warning:** "No valid contracts cover all dates"
- **Cause:** No contracts exist with date ranges covering all entry dates for a given hour type/month
- **Fix:** Create a contract with appropriate start/end dates in the Contracts page

### Public Holiday Validation
- **Info:** "X public holidays skipped"
- **Cause:** "Skip public holidays" is enabled and entries fall on configured public holidays
- **Fix:** Disable the toggle if you want to import those entries

### Time Budget Validation
- **Info:** Continuation messages during long imports
- **Cause:** Import exceeds Apps Script execution time limit (~5 minutes)
- **Fix:** No action needed - Tempus automatically continues from where it left off

## Continuation and Progress Tracking

Large imports may exceed the Apps Script execution time limit. Tempus handles this automatically:

**How continuation works:**
1. Import starts processing entries in batches
2. After ~4 minutes 30 seconds, Tempus saves progress and returns a continuation token
3. Client immediately resumes the import with the continuation token
4. Import continues from where it left off
5. Process repeats until all entries are imported

**User experience:**
- Status message updates: "Importing entries... (120 added so far, 5 duplicates skipped; 80 remaining)"
- No manual intervention required
- Import completes automatically with full progress tracking

**Maximum import size:** No hard limit. The continuation system handles spreadsheets with thousands of entries across multiple years.

## Tips for Using the Importer

- **Create contracts first:** Set up contracts covering your legacy data date ranges before importing. This avoids missing contract warnings.
- **Match hour type names:** Name your Tempus hour types to match Timesheet 1.0 labels (e.g., both use "Work", "Leave", "Training"). Auto-matching saves manual mapping time.
- **Preview multiple times:** Adjust mappings, select contracts, then preview again to verify changes before running import.
- **Review summary carefully:** Check total importable count and breakdown by month. Verify it matches your expectations before clicking Run Import.
- **Skip public holidays by default:** If you didn't work on public holidays, leave the toggle enabled to avoid importing zero-work days.
- **Check for duplicates:** If duplicate count is high, you may have already imported some months. Verify by checking the calendar before re-importing.
- **Import incrementally:** If unsure, import one month at a time by creating temporary contracts for single months, then expand after verifying.
- **Verify after import:** Check the calendar and monthly totals after import completes. Spot-check a few dates to ensure hours match legacy data.
- **Keep legacy spreadsheet:** Don't delete the Timesheet 1.0 file until you've verified all data imported correctly.
- **Use continuation for large imports:** Don't worry about timeout errors - continuation handles them automatically. Just wait for the final summary.

## Common Importer Questions

### Can I import from multiple Timesheet 1.0 files?
Yes. Import each file separately. Duplicate detection prevents double-importing if entries overlap.

### What happens if I import the same file twice?
All entries are detected as duplicates and skipped. The importer shows "Duplicates skipped: X" with no new entries created.

### Can I edit imported entries after import?
Yes. Imported entries are standard time entries and can be edited or deleted individually like any manual entry.

### How does the importer handle entries spanning multiple contracts?
You select one contract per month/hour type combination. If your work changed contracts mid-month in the legacy data, the importer assigns all entries for that month to the selected contract. For more granular control, manually adjust entries after import.

### Why do some entries show as duplicates when I haven't imported before?
Duplicates are detected by `date + hour_type + contract`. If you manually created entries for those dates with the same hour type and contract, they're treated as duplicates.

### How long does import take?
Preview: 30-60 seconds for most files. Import: a couple of minutes.

### Can I cancel an import in progress?
No. Once import starts, it processes to completion (or continuation). If you accidentally start an import, let it finish. You can delete imported entries afterwards if needed.

### What happens if the importer times out?
Tempus automatically resumes via continuation. You'll see progress messages updating every few minutes until import completes.

### Does the importer validate hours against contract rates?
No. The importer creates entries with the hours from Timesheet 1.0. Income calculations use your current contract rates, which may differ from legacy rates.

### Can I import into a different Google account?
No. The importer runs in your current Google account context and creates entries in your active Tempus deployment. Ensure you're logged into the correct account before importing.

### Why doesn't my legacy file appear in the preview?
Check:
- **File ID is correct** (copy from the URL between `/d/` and `/edit`)
- **You have view access** to the spreadsheet
- **The file is a Google Sheets file** (not Excel or other formats)
- **Sheets are named after months** (January, February, etc.)

### What if I have hour types in Tempus that weren't in Timesheet 1.0?
No problem. The importer only maps labels found in the legacy file. New hour types in Tempus remain unused during import.

### Can I re-map hour types after import?
Not automatically. You'd need to manually edit each imported entry to change its hour type. Best to get mappings correct before running import.

## Summary

Timesheet 1.0 Importer migrates legacy data with automated hour type mapping, contract selection, duplicate detection, and bulk entry creation. Preview before importing, resolve all mappings and contract selections, then run to create entries with continuation support for large datasets.

For manual time entry after import, see [Basic Time Entry documentation](time-entry-basic.md). For contract setup, see [Contracts documentation](contracts.md). For hour type configuration, see [Hour Types documentation](hour-types.md).
