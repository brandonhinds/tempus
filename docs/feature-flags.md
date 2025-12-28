# Feature Flags Reference

Control which features appear in your Tempus application by enabling or disabling feature flags.

## Purpose
Feature flags let you customise Tempus to match your workflow. Enable only the features you need to keep the interface clean and focused. Most features are disabled by default, allowing you to gradually adopt advanced functionality as your needs evolve.

## Accessing Feature Flags
Navigate to Settings from the main navigation menu, then scroll to the Feature Flags section. Each flag displays a toggle switch, name, and description. Click the toggle to enable or disable features immediately.

## How Feature Flags Work

### Grouped Organisation
Feature flags are organised into logical groups for easier navigation:
- **Income**: Deductions, income tracking, rate modelling, and superannuation
- **Time Entries**: Entry templates, hour types, bulk operations, and payroll helpers
- **Company**: Business tracking, invoicing, BAS reporting, and sole trader mode
- **Utilities**: Interface preferences and cache management
- **Accessibility**: Themes and colour-blind support

### Expand/Collapse Controls
Use the **Expand All** and **Collapse All** buttons in the Feature Flags toolbar to show or hide all groups at once.

### Dependent Features
Some flags require other flags to be enabled first. For example:
- **Enable contract line item templates** requires **Enable invoices page** to be enabled.
- **Switch from monthly to quarterly BAS reporting** requires **Enable company income tracking** to be enabled.
- **Enable sole trader mode** requires **Enable company income tracking** to be enabled.

When a dependent flag is disabled, features that rely on it become inactive automatically.

### Settings Integration
Many feature flags unlock additional settings. When you enable a flag, a new collapsible section appears in the Settings page containing related configuration options. For example, enabling **Reclaim lost super to deductions** adds a "Reclaim lost super to deductions" settings section where you can configure the recovery method.

## Income Flags

### Enable deduction tracking
**Default:** Disabled

Adds category management for deductions and groups them on the deductions page and annual reports.

**What it enables:**
- Category management modal on the Deductions page
- Colour-coded deduction categories
- Category-based grouping on the Deductions page
- Category breakdowns in [Annual Views](docs/annual-views.md) and [BAS Reporting](docs/bas-reporting.md)
- Expand/collapse controls for category groups

**When to enable:** If you have multiple deductions and want to organise them into categories like "Tools", "Office supplies", "Professional development", etc.

### Enable actual income tracking
**Default:** Disabled

Allows recording actual income so you can compare estimated versus received amounts with variance indicators.

**What it enables:**
- **Add Actual Income** button on the Time Entry page
- Actual income entry modal
- Actual vs estimated comparison in the income breakdown badge
- Variance indicators showing differences between calculated and actual income
- Actual income data in [Annual Views](docs/annual-views.md)

**When to enable:** If you want to track the difference between your estimated income (based on hours worked) and what you actually receive in your bank account.

See [Actual Income documentation](docs/actual-income.md) for details.

### Enable expected monthly hours insights
**Default:** Disabled

Adds a calendar badge that projects contract hours for the month and shows whether you are ahead or behind.

**What it enables:**
- Expected Hours badge in the calendar header
- Per-contract breakdown of expected vs actual hours
- Projection based on remaining working days in the month
- Visual indicators showing if you're on pace to meet monthly targets

**When to enable:** If you want to track progress towards monthly hour targets and see projections based on your current pace.

### Enable contract rate preview page
**Default:** Disabled

Unlocks the rate preview view to model hourly rate changes and see their impact across a contract.

**What it enables:**
- Rate Preview page in the main navigation
- Interactive rate change modelling
- Before/after comparisons showing income impact
- Contract-specific projections

**When to enable:** If you're negotiating rate changes or want to understand how different hourly rates affect your total income over a contract period.

### Reclaim lost super to deductions
**Default:** Disabled

Recovers super guarantee lost to pre-tax deductions. Configure the recovery method on the Settings tab.

**What it enables:**
- Super restoration calculation in income breakdown
- Settings section for configuring recovery method (two-step or single-step)
- "Super lost due to deductions" row shows the recovered amount

**When to enable:** If your employer restores superannuation guarantee lost when you make pre-tax deductions (like salary sacrifice). Common in public sector employment.

**Important:** Only enable this if your employer actually restores lost super. Check your payslip or employment contract to confirm.

## Time Entry Flags

### Enable default hours for time entries
**Default:** Disabled

Allows saving reusable entry templates that can be applied when adding new time entries.

**What it enables:**
- **Create Default** button when viewing time entries
- Default entry management (Basic and Advanced modes)
- Right-click context menu on calendar days to insert defaults
- Quick entry workflow for repetitive patterns

**When to enable:** If you frequently log the same hours (e.g., "Standard Day: 7.5 hours", "Half Day: 3.75 hours") and want to apply them quickly.

See [Entry Defaults documentation](docs/time-entry-defaults.md) for details.

### Enable multiple hour types
**Default:** Disabled

Lets you categorise hours (work, annual, sick, training, etc.) and visualise their impact on income.

**What it enables:**
- Hour Type dropdown on time entry forms
- Hour type management page
- Per-type income contribution settings
- Hour type filter on the calendar
- Colour-coded calendar days based on hour type
- Hour type breakdowns in income badge and annual views

**When to enable:** If you need to track different categories of time (billable, leave, training, overtime, etc.) and understand how each affects your income.

See [Hour Types documentation](docs/time-entry-hour-types-contracts.md) for details.

### Enable reoccurring time entries
**Default:** Disabled

Adds a scheduler to automatically create weekly or monthly entries that stay within active contract dates.

**What it enables:**
- **Reoccurring Entries** button on the Time Entry page
- Recurring entry management modal
- Scheduled entry generation (weekly, fortnightly, monthly)
- Contract date validation for generated entries

**When to enable:** If you work consistent schedules and want to pre-populate your timesheet automatically (e.g., every Monday and Wednesday, 7.5 hours).

See [Recurring Time Entries documentation](docs/time-entry-recurring.md) for details.

### Enable bulk time entries
**Default:** Disabled

Adds a tool to apply identical entries across a date range with weekend and public holiday filters.

**What it enables:**
- **Bulk Entries** button on the Time Entry page
- Bulk entry modal with date range selection
- Weekend and public holiday exclusion options
- Contract and hour type selection for bulk entries

**When to enable:** If you need to fill multiple days with the same entry (e.g., apply 7.5 hours to every weekday in January).

See [Bulk Time Entries documentation](docs/time-entry-bulk.md) for details.

### Suggest exact end time
**Default:** Disabled

Uses your rounding rule and preferred finish time to recommend when to clock off for tidy totals.

**What it enables:**
- End time suggestion in Advanced punch entry mode
- Automatic calculation based on rounding preferences
- Preferred finish time setting
- Visual hint showing suggested punch out time

**When to enable:** If you want help achieving round hour totals (like exactly 7.5 hours) when using punch-based time entry.

### Enable automatic public holiday display
**Default:** Disabled

Automatically overlays Australian public holidays on the calendar view and keeps them in sync.

**What it enables:**
- Public holiday labels on calendar days
- Automatic synchronisation with Australian public holiday API
- Visual distinction for non-working days
- Public holiday exclusion in bulk operations

**When to enable:** If you want to see Australian public holidays marked on your calendar and exclude them from bulk entry operations.

### Enable Xero payroll helper
**Default:** Disabled

Adds a modal that slices the active month into Xero-aligned weekly ranges with cumulative hour totals.

**What it enables:**
- **Xero Payroll Helper** button on the Time Entry page
- Week-based hour breakdown aligned to Xero pay periods
- Cumulative totals for Xero import
- Copy-to-clipboard functionality

**When to enable:** If you use Xero for payroll and need to generate weekly hour totals for import.

See [Payroll Helpers documentation](docs/payroll-helpers.md) for details.

### Enable MYOB payroll helper
**Default:** Disabled

Adds a modal that groups the active month into MYOB-ready weekly totals with a monthly cross-check.

**What it enables:**
- **MYOB Payroll Helper** button on the Time Entry page
- Weekly hour totals formatted for MYOB
- Monthly cross-check to verify totals
- Export-ready format

**When to enable:** If you use MYOB for payroll and need to generate weekly summaries for import.

See [Payroll Helpers documentation](docs/payroll-helpers.md) for details.

### Enable monthly hours print view
**Default:** Disabled

Adds a printable calendar showing hour breakdowns by type that fits on one A4 page for timesheets or records.

**What it enables:**
- **Print Monthly Hours** button on the Time Entry page
- Printer-friendly monthly summary
- Hour type breakdowns (when hour types are enabled)
- A4-optimised layout

**When to enable:** If you need to print physical copies of your monthly timesheets for records or approval processes.

See [Print View documentation](docs/print-view.md) for details.

### Enable Timesheet 1.0 importer
**Default:** Disabled

Adds an importer on the Time Entries page to pull legacy spreadsheet hours with mapping, contract checks, and duplicate detection.

**What it enables:**
- **Import Timesheet 1.0** button on the Time Entry page
- Legacy timesheet import modal
- Column mapping interface
- Contract validation and duplicate detection
- Preview before import

**When to enable:** If you're migrating from the original Timesheet 1.0 spreadsheet and need to import historical data.

See [Timesheet 1.0 Importer documentation](docs/time-entry-importer.md) for details.

## Company Flags

### Enable company income tracking
**Default:** Disabled

Unlocks company-focused features including company deductions, BAS reporting, and invoice tooling.

**What it enables:**
- Company expense toggle on deductions
- GST tracking for company expenses
- Company income calculations in income breakdown
- Invoice total and company income rows in income waterfall
- BAS Reporting page (when quarterly BAS is also enabled)
- Foundation for invoicing features

**When to enable:** If you run a company (not just employed) and need to track business expenses, client invoicing, and company-level income separate from your personal employee income.

**Important:** This is a foundational flag that enables several company-specific features. Other company flags require this to be enabled first.

### Switch from monthly to quarterly BAS reporting
**Default:** Disabled

Shows BAS reporting in quarterly totals instead of monthly when company income tracking is enabled.

**What it enables:**
- Quarterly BAS view on the BAS Reporting page
- Quarter-based summaries (Q1: Jul-Sep, Q2: Oct-Dec, Q3: Jan-Mar, Q4: Apr-Jun)
- GST calculations aligned to ATO quarterly periods

**When to enable:** If your business reports BAS quarterly rather than monthly. Requires **Enable company income tracking** to be enabled first.

**Important:** Australian BAS reporting defaults to quarterly for most small businesses. Enable this if you report to the ATO quarterly.

See [BAS Reporting documentation](docs/bas-reporting.md) for details.

### Enable invoices page
**Default:** Disabled

Enables invoice management, default line items, and Google Docs generation using your template.

**What it enables:**
- Invoices page in the main navigation
- Invoice creation and management
- Default line item templates
- Google Docs invoice generation
- Invoice tracking in BAS reporting

**When to enable:** If you invoice clients and want to track invoices alongside your time entries and income. Requires **Enable company income tracking** to be enabled first.

### Enable contract line item templates
**Default:** Disabled

Allows defining reusable line item templates with predefined descriptions and amounts on each contract.

**What it enables:**
- Line item templates section on the Contracts page
- Pre-configured invoice line items per contract
- Quick insertion when creating invoices
- Template management (add, edit, delete)

**When to enable:** If you have standard line items that you invoice repeatedly for each contract (e.g., "Standard assessment: $500") and want to avoid retyping them. Requires **Enable invoices page** to be enabled first.

### Enable sole trader mode
**Default:** Disabled

Indicates the business operates as a sole trader and adjusts PAYG income calculations accordingly.

**What it enables:**
- Sole trader tax treatment in income calculations
- PAYG withholding adjustments
- Sole trader-specific income derivation

**When to enable:** If your business structure is a sole trader (not a company or partnership). This affects how income and tax are calculated. Requires **Enable company income tracking** to be enabled first.

**Important:** Only enable this if your business is legally structured as a sole trader. Consult your accountant if unsure.

## Utilities Flags

### Remember last page on refresh
**Default:** Disabled

When enabled, the app reopens on the most recently viewed page after a reload.

**What it enables:**
- Automatic navigation to last viewed page on refresh
- Page state preservation across sessions
- Seamless workflow continuity

**When to enable:** If you frequently refresh the browser and want to return to the page you were working on instead of starting at Time Entry.

### Show zero hours on days with no time entered
**Default:** Disabled

Displays a 0 for days without logged time instead of leaving them blank on the calendar.

**What it enables:**
- "0" displayed on empty calendar days
- Visual distinction between no entry and zero hours logged

**When to enable:** If you prefer to see explicit zeros on days without time entries rather than blank cells.

### Show clear cache button
**Default:** Disabled

Adds a button to wipe cached entries, settings, and remembered preferences from this browser.

**What it enables:**
- **Clear Local Cache** button in Settings
- Manual cache clearing for troubleshooting
- Complete browser storage wipe

**When to enable:** If you want the ability to manually clear the cache for troubleshooting or if you frequently need to reset local data.

**Important:** This is primarily for troubleshooting. Most users don't need this enabled.

See [Cache Management documentation](docs/cache.md) for details.

## Accessibility Flags

### Enable custom theme
**Default:** Disabled

Adds a Custom theme option with configurable colours.

**What it enables:**
- Custom theme option in theme dropdown
- **Configure Theme** button when Custom theme is selected
- Colour picker for all theme variables
- Custom theme editor modal
- Contrast checking for accessibility

**When to enable:** If none of the built-in themes suit your preferences and you want to create your own colour scheme.

See [Themes & Accessibility documentation](docs/themes-accessibility.md) for details.

### Enable colour blind themes
**Default:** Disabled

Adds colour-blind friendly theme presets and warns about difficult hour type colour combinations.

**What it enables:**
- Colour-blind friendly theme options in theme dropdown
- Contrast warnings for hour type colours
- Accessibility-focused colour palettes

**When to enable:** If you have colour vision deficiency (colour blindness) and need high-contrast, accessible colour schemes.

See [Themes & Accessibility documentation](docs/themes-accessibility.md) for details.

## Managing Feature Flags

### Enabling a Flag
1. Navigate to Settings.
2. Scroll to the Feature Flags section.
3. Find the flag you want to enable.
4. Click the toggle switch to enable it.
5. The feature is activated immediately.
6. If the flag adds a Settings section, it will appear in the Settings page.
7. If the flag adds a page, it will appear in the main navigation.

### Disabling a Flag
1. Navigate to Settings.
2. Scroll to the Feature Flags section.
3. Find the flag you want to disable.
4. Click the toggle switch to disable it.
5. The feature is deactivated immediately.
6. Any associated Settings sections, pages, or buttons are hidden.

**Important:** Disabling a flag hides the feature but does not delete your data. If you re-enable the flag later, your data (deductions, invoices, hour types, etc.) will still be there.

## Tips
- **Start minimal**: Begin with only the flags you need and enable more as your workflow evolves.
- **Check dependencies**: Some flags require others to be enabled first. The description will indicate if dependencies exist.
- **Test one at a time**: If you're unsure about a feature, enable the flag, explore the feature, and disable it if it doesn't suit your workflow.
- **Review periodically**: As Tempus adds new features, check the Feature Flags section occasionally to see what's available.
- **Settings sections**: When you enable a flag that adds settings, a new collapsible section appears in Settings. Look for the flag's name in the Settings page.
- **Read the documentation**: Each flag description includes a link to detailed documentation (when available). Use these to understand how features work before enabling them.
- **Company tracking foundation**: If you're running a business, start by enabling **Enable company income tracking** first, then enable other company-specific flags as needed.
- **Accessibility first**: If you have visual impairments or colour vision deficiency, enable **Enable colour blind themes** early to ensure comfortable usage.

## Summary

Feature flags let you enable optional Tempus features as needed. Start with the basics and activate advanced capabilities like invoicing, BAS reporting, hour types, or deductions when your workflow requires them. All flags are disabled by default.
