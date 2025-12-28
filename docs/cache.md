# Cache Management

Controls for managing local browser cache to improve performance and troubleshoot data issues.

## Purpose
Provides a Clear Cache button to remove locally stored data when troubleshooting or after manual sheet edits. The cache dramatically improves app performance by storing data in the browser, but occasionally needs to be cleared to force a fresh reload from Google Sheets.

## Accessing the Feature
- Enable the *Show clear cache button* feature flag in Settings.
- Navigate to the Settings page.
- The Clear Cache button appears at the bottom of the page.

## How Cache Works

### Performance Benefits
- **First load**: Data loads from Google Sheets (slower, typically 2-5 seconds).
- **Subsequent loads**: Data loads from browser cache (fast, typically <1 second).
- **Background sync**: Updates from Google Sheets merge into cache automatically.
- **Optimistic updates**: Changes you make appear instantly, then sync in the background.

### What Gets Cached
The app stores the following in browser local storage:

- **Time entries**: All time entry data
- **Contracts**: Contract definitions and settings
- **Hour types**: Custom hour type configurations
- **Deductions**: Deduction records, categories, and exceptions
- **Invoices**: Invoice data, default line items, and filters
- **Settings**: User preferences and theme settings
- **Feature flags**: Feature flag states
- **Recurring entries**: Scheduled recurring time entry templates
- **Bulk entries**: Bulk entry configurations
- **Public holidays**: Cached holiday data
- **Actual income**: Recorded actual income values
- **Income summaries**: Pre-calculated monthly income breakdowns
- **UI state**: Last viewed page, collapsed sections, filter selections, and BAS year

## Clearing Cache

### What Gets Cleared
Clicking Clear Cache removes all cached data from browser local storage (see list above).

### What Does NOT Get Cleared
The cache clear only affects browser storage. The following remain unchanged:

- **Google Sheets data**: All data in your timesheet spreadsheet is preserved
- **Server-side calculations**: Tax rates, super guarantee rates, and formulas
- **Google Apps Script state**: No server-side data is affected

After clearing cache, the app reloads all data fresh from Google Sheets on the next sync.

### Workflow
1. Navigate to the Settings page.
2. Scroll to the bottom and click the *Clear Cache* button.
3. Confirm the action in the dialog.
4. The app displays a success message.
5. Data automatically reloads from Google Sheets on next sync or page refresh.

## When to Clear Cache

### Common Scenarios
- **UI appears stale**: Data doesn't reflect recent changes you know exist.
- **After manual sheet edits**: You edited data directly in Google Sheets rather than through the app.
- **Feature flag changes**: Some feature flag changes require cache clear to fully take effect.
- **Troubleshooting**: Resolving unexpected UI behaviour or data display issues.
- **After major updates**: When deploying a new version that changes data structures.

### What Happens After Clear
- The app displays a success message confirming cache was cleared.
- On next page load or sync, all data reloads from Google Sheets.
- UI returns to default state (no remembered page, collapsed sections reset, etc.).
- Performance may be slightly slower on first load while rebuilding cache.

## Tips
- Clear cache is safe - your Google Sheets data is never affected.
- Use sparingly in normal operation; the cache improves performance significantly.
- After clearing, wait for the full reload to complete before making changes.
- If you're experiencing persistent issues after cache clear, check the browser console for errors.
- The "Remember last page" feature requires cache, so clearing resets you to the default page on next load.
- Cache is browser-specific; clearing in Chrome doesn't affect Firefox, and vice versa.

## Summary

Tempus caches data locally for fast performance. Clear cache when the UI appears stale, after manual sheet edits, or when troubleshooting. Clearing is safe and never affects your Google Sheets data.
