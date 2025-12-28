# Settings Page Guide

Configure Tempus to match your tax situation, workflow preferences, and visual requirements.

## Purpose
The Settings page is where you configure Tempus's core behaviour and enable optional features. Core settings (financial year, tax rates, superannuation, themes) are always visible. Feature-specific settings appear in collapsible sections when you enable their corresponding feature flags. This data-driven design ensures you only see settings relevant to the features you're using.

## Accessing Settings

1. Open the main navigation menu (☰ in the header).
2. Select **Settings**.
3. The Settings page opens showing the Core section expanded by default.
4. Scroll to view other sections or use the Expand/Collapse controls at the top.

## Core Settings

Core settings are always visible and control fundamental Tempus behaviour. These don't require feature flags to be enabled.

### Time Entries Rounding (minutes)
**What it does:** Automatically rounds all time entry durations to intervals of this many minutes.

**Options:** 0-60 minutes
- **0**: No rounding (hours recorded exactly as entered or calculated)
- **1**: Round to nearest minute
- **5**: Round to nearest 5 minutes (common for payroll)
- **6**: Round to 0.1 hours
- **15**: Round to nearest quarter hour
- **30**: Round to nearest half hour

**Default:** 0 (no rounding)

**When to change:** Set this to match your payroll system's rounding requirements. Many employers use 6-minute (0.1 hour) or 15-minute rounding.

**Important:** Changing this setting automatically re-rounds all existing time entries to the new interval.

### Theme
**What it does:** Changes the colour scheme of the Tempus interface.

**Options:**
- **Dark**: Default dark theme with blue accents
- **Light**: Light theme with blue accents
- **The OG**: Theme inspired by the Timesheet 1.0 colour scheme
- **Rose Gold**: Light theme with rose gold accents
- **Sierra 117**: Green military-inspired theme
- **Protanopia Friendly**: Optimised for red-blind users (requires *Enable colour blind themes*)
- **Deuteranopia Friendly**: Optimised for green-blind users (requires *Enable colour blind themes*)
- **Tritanopia Friendly**: Optimised for blue-blind users (requires *Enable colour blind themes*)
- **Monochrome**: High-contrast black and white (requires *Enable colour blind themes*)
- **Custom**: User-defined colour palette (requires *Enable custom themes*)

**Default:** Dark

**When to change:** Choose a theme that's comfortable for your eyes and working environment. Enable colour-blind themes if you have colour vision deficiency.

**Note:** The Configure button appears when Custom theme is selected, allowing you to define custom colours.

### Status Notifications
**What it does:** Controls how Tempus displays progress messages, warnings, and errors.

**Options:**
- **Status bar only**: Messages appear in the bar at the top of the page
- **Toast notifications only**: Messages appear as temporary pop-up toasts
- **Both toast and status bar**: Messages appear in both locations

**Default:** Status bar only

**When to change:** Use toast notifications if you prefer more prominent alerts, or "both" if you want maximum visibility.

## Superannuation Guarantee Rates

Manage the superannuation guarantee percentage rates by date range to ensure accurate calculations as ATO rates change.

### Accessing Super Rates
1. Scroll to the **Superannuation Guarantee Rates** section on the Settings page.
2. The current rates are listed in a table, sorted by start date (most recent first).
3. Use the **Add Rate**, **Edit**, and **Delete** buttons to manage rates.

### Adding a Super Rate
1. Click **Add Rate**.
2. Enter the **Start Date** when the new rate takes effect.
3. Enter the **Rate (%)** as a percentage (e.g., `11.5` for 11.5%).
4. Click **Save**.
5. The rate appears in the table.

**Important:** Rates apply from their start date forward until the next rate's start date. The system automatically uses the correct rate based on the date of each time entry.

### Editing a Super Rate
1. Click **Edit** next to the rate you want to modify.
2. Update the start date or percentage.
3. Click **Save**.

### Deleting a Super Rate
1. Click **Delete** next to the rate you want to remove.
2. Confirm the deletion.

**Warning:** Deleting a rate affects all income calculations for periods covered by that rate. Only delete rates if they were entered incorrectly.

### Current Super Rates (as of 2024)
The Australian superannuation guarantee rate is **11.5%** (effective 1 July 2023). The rate increases to:
- **12%** from 1 July 2025

**Tip:** Update your super rates when the ATO announces changes to ensure accurate income calculations.

## Feature Flags

Feature flags enable optional Tempus features. All flags are disabled by default - enable only the ones you need.

### Accessing Feature Flags
1. Scroll to the **Feature Flags** section on the Settings page.
2. Flags are organised into groups:
   - **Income**: Deductions, actual income tracking, rate preview
   - **Time Entries**: Hour types, bulk operations, payroll helpers, recurring entries
   - **Company**: Invoicing, BAS reporting, company income tracking
   - **Utilities**: Interface preferences, cache controls, mobile access
   - **Accessibility**: Themes and colour-blind support
3. Click a group header to expand and view its flags.

### Enabling a Feature Flag
1. Find the flag you want to enable.
2. Click the toggle switch next to the flag name.
3. The flag activates immediately.
4. Any associated UI elements (pages, buttons, settings sections) appear automatically.
5. If the flag adds settings, a new collapsible section appears on the Settings page.

**Example:** Enabling *Enable multiple hour types* adds:
- Hour Types page to the navigation menu
- Hour type selector to time entry forms
- Hour Types settings section with related configuration

### Disabling a Feature Flag
1. Find the flag you want to disable.
2. Click the toggle switch to turn it off.
3. The feature deactivates immediately.
4. Associated UI elements are hidden.

**Important:** Disabling a flag hides the feature but does not delete your data. If you re-enable the flag later, your data (deductions, invoices, hour types, etc.) will still be there.

### Feature Flag Groups

#### Income Flags
- **Enable deduction tracking**: Salary sacrifice and pre-tax deductions
- **Enable deduction category management**: Categorise deductions for reporting
- **Enable company income tracking**: Separate company vs employee income
- **Enable actual income tracking**: Record real earnings vs estimates
- **Enable contract rate preview page**: Model rate changes and their impact

#### Time Entries Flags
- **Enable multiple hour types**: Categorise time (work, leave, training)
- **Enable default hours for time entries**: Quick entry templates
- **Enable recurring time entries**: Automated repeating entries
- **Enable bulk time entry tool**: Fill multiple days at once
- **Enable Xero payroll helper**: Weekly hours formatted for Xero
- **Enable MYOB payroll helper**: Weekly hours formatted for MYOB
- **Enable monthly hours print view**: Printable A4 calendar
- **Enable Timesheet 1.0 importer**: Import from old Timesheet app

#### Company Flags
- **Enable invoices page**: Create and manage client invoices
- **Switch from monthly to quarterly BAS reporting**: Quarterly BAS periods
- **Enable Google Docs invoice generation**: Generate formatted invoices
- **Is sole trader**: Changes PAYG and income treatment

#### Utilities Flags
- **Show clear cache button**: Manual cache clearing
- **Show mobile view button**: Access mobile entry interface
- **Remember last page on refresh**: Reopen last viewed page
- **Enable public holidays**: Mark public holidays on calendar
- **Suggest end times for punch entries**: Auto-suggest clock-out times
- **Enable expected monthly hours insights**: Project hour variance

#### Accessibility Flags
- **Enable colour blind themes**: Protanopia, deuteranopia, tritanopia, monochrome themes
- **Enable custom themes**: Define your own colour palette

See [Feature Flags Reference](docs/feature-flags.md) for complete details on every flag.

## Feature-Specific Settings

When you enable a feature flag, a settings section for that feature appears on the Settings page (if the feature has configurable settings). These sections are collapsible and only visible when their flag is enabled.

### How Feature-Specific Settings Work

1. **Section appears when flag is enabled**: The section ID matches the flag ID. For example, enabling `enable_multiple_hour_types` creates a section titled "Enable multiple hour types".

2. **Section contains related controls**: Each feature's settings are grouped together. For instance, the `enable_public_holidays` section contains the "Public holiday state" dropdown.

3. **Collapse to hide**: Click the section header to collapse it and save space. Your collapse state is remembered in cache.

### Common Feature-Specific Settings

#### Public Holiday State
(**Requires:** *Enable public holidays*)

Select your Australian state/territory to mark the correct public holidays on your calendar.

**Options:** ACT, NSW, NT, QLD, SA, TAS, VIC, WA

**Default:** ACT

#### Minimum End Time
(**Requires:** *Suggest end times for punch entries*)

The earliest time Tempus will suggest when you punch in. If you punch in after this time, the suggestion uses the next day.

**Default:** 17:00 (5:00 PM)

**Example:** If minimum end time is 17:00 and you punch in at 14:30, Tempus suggests 17:00 as your punch-out time.

#### Lost Super Recovery Mode
(**Requires:** *Enable company income tracking* and *No lost super to deductions*)

How the superannuation normally lost to deductions is reclaimed.

**Options:**
- **Extra contribution**: Adds the amount directly back to superannuation
- **Additional income**: Adds the money back as income, distributing it between super, tax, and net income

**Default:** Extra contribution

#### Monthly Insights Trend Method
(**Requires:** *Enable expected monthly hours insights*)

The method used to calculate expected hours for projections.

**Options:**
- **Standard contract hours**: Uses the standard hours per day from your contract
- **Current month**: Based on hours logged so far this month
- **Last 3 months**: Average of the last 3 months
- **Contract lifetime**: Average across all time on this contract
- **Same month last year**: Hours from the same month last year

**Default:** Standard contract hours

#### Projections Variance Value
(**Requires:** *Enable expected monthly hours insights*)

What the variance compares against when showing projected hours differences.

**Options:**
- **Monthly capacity**: Total possible hours for the month
- **Trend average**: Expected hours based on trend method

**Default:** Monthly capacity

#### PAYG Instalment Rate
(**Requires:** *Is sole trader*)

The PAYG instalment rate for sole traders (percentage).

**Default:** 2%

## Expand/Collapse Controls

At the top of the Settings page, expand/collapse controls let you quickly scan all sections.

**Expand all**: Opens all collapsible sections to view all settings at once.

**Collapse all**: Closes all collapsible sections except Core (which always remains open).

**Use this to:** Quickly find a specific setting or scan all available options.

## Open Mobile View

At the bottom of the Core section, the **Open Mobile View** button (when *Show mobile view button* is enabled) launches the mobile entry interface in a new tab.

**What it does:** Opens the mobile-optimised time entry view designed for phones and tablets.

**When to use:** When you need to access Tempus on a mobile device and want the streamlined mobile interface rather than the full desktop view.

See [Mobile Entry documentation](docs/mobile-entry.md) for details.

## Clear Cache

When the *Show clear cache button* flag is enabled, a **Clear Cache** button appears in the settings.

**What it does:** Clears all locally cached data, forcing a full reload from Google Sheets on the next sync.

**When to use:**
- UI appears stale after manual spreadsheet edits
- Troubleshooting unexpected behaviour
- After major updates that change data structures

See [Cache Management documentation](docs/cache.md) for details.

## Saving Settings

1. Make your changes to any settings or feature flags.
2. Scroll to the bottom of the page.
3. Click **Save Settings**.
4. Tempus updates your settings in Google Sheets and refreshes the cache.
5. A success message confirms the save.

**Important:** Settings changes apply immediately after saving. Feature flag changes take effect without needing to save - they activate/deactivate as soon as you toggle them.

## Tips for Using Settings

- **Start with core settings**: Configure financial year, tax rates, and superannuation guarantee before enabling feature flags.
- **Enable flags gradually**: Don't enable everything at once. Add features as you need them to avoid overwhelming the interface.
- **Collapse sections you don't use**: Keep the Settings page tidy by collapsing sections for features you've configured and don't frequently change.
- **Update super rates when ATO changes them**: Check for super guarantee rate updates annually and add new rates with appropriate start dates.
- **Test rounding carefully**: Changing the rounding interval re-rounds all existing entries. Test on a backup first if you're concerned about the impact.
- **Theme switching is instant**: You can try different themes without saving - switch freely to find one you like.
- **Feature-specific sections match flag names**: If you can't find a setting, look for a section with the same name as the feature flag you enabled.
- **Clear cache sparingly**: Cache clearing is safe but slows down the next load. Only clear when necessary.
- **Mobile view button is optional**: Most users access mobile view by opening Tempus on their phone. The button is for convenience when testing or sharing the URL.
- **Bookmark settings**: If you frequently adjust settings, bookmark the Settings page URL for quick access.

## Summary

Settings configure Tempus's core behaviour (tax rates, super, rounding, themes) and enable optional features through feature flags. Core settings are always visible, whilst feature-specific sections appear when you enable their flags.

For detailed information on specific features, see [Feature Flags Reference](docs/feature-flags.md).
