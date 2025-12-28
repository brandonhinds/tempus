# Navigation & Layout Conventions

How to navigate between pages and what to expect on each page in Tempus.

## Purpose
Tempus organises features into pages accessible from the main navigation menu. Core pages are always available, whilst optional pages appear when you enable specific feature flags. Understanding the page structure helps you find features quickly and know where to go for specific tasks.

## Accessing the Navigation Menu

The navigation menu is located in the header at the top of the screen.

1. Click the **☰** (hamburger menu) button in the top-right corner.
2. The navigation menu opens showing all available pages.
3. Click any page name to navigate to that page.
4. The menu closes automatically after selecting a page.

**Tip:** The **Tempus** logo in the header acts as a "Go to today" button when you're on the Time Entry or Dashboard pages.

## Core Pages

These pages are always available, regardless of feature flag settings.

### Time Entry
**Default landing page** - The primary interface for logging hours.

**What you'll find:**
- Basic and Advanced time entry modes (tabs)
- Monthly calendar view
- Income and hours badges (expandable for breakdowns)
- Action buttons for payroll helpers, bulk operations, etc. (when enabled)

**Use this page for:**
- Daily time logging
- Viewing monthly summaries
- Accessing income breakdowns
- Quick navigation between dates

See [Dashboard & Calendar documentation](docs/dashboard-calendar.md) for complete details.

### Annual Views
Yearly financial summaries and trends.

**What you'll find:**
- Financial year / calendar year toggle
- Year selection dropdown
- Contract filter
- Summary statistics (total hours, gross income, net income, tax, super, etc.)
- Income breakdown table by month
- Monthly income chart
- Expense categories breakdown (when deduction categories are enabled)
- Visual charts (income distribution, income by contract, hours by month, hours by type)
- Tax analysis section

**Use this page for:**
- Year-end financial review
- Tax planning and estimates
- Trend analysis across months
- Contract performance comparison

See [Annual Views documentation](docs/annual-views.md) for complete details.

### Contracts
Manage your client engagements and employment agreements.

**What you'll find:**
- Contract selector dropdown
- Contract details (name, dates, rate, hours)
- Edit and Delete buttons
- Burndown chart (for capped contracts)
- Monthly breakdown table
- Hours by type breakdown (when hour types are enabled)
- Invoice line item templates (when enabled)

**Use this page for:**
- Creating new contracts
- Updating rates or extending end dates
- Viewing contract progress and burndown
- Managing contract-specific invoice templates

See [Contracts documentation](docs/contracts.md) for complete details.

### Deductions
Manage salary sacrifice, company expenses, and extra super contributions.

**What you'll find:**
- Deductions list (grouped by category when categories are enabled)
- Add deduction button
- Manage categories button (when categories are enabled)
- Expand/collapse controls (when categories are enabled)

**Use this page for:**
- Adding deductions (one-off or recurring)
- Editing deduction schedules
- Managing deduction categories
- Organising business expenses

See [Deductions documentation](docs/deductions.md) for complete details.

### Settings
Configure Tempus to match your situation.

**What you'll find:**
- Core settings section (always visible)
  - Financial year start month
  - Tax-free threshold toggle
  - Tax rate type (weekly, fortnightly, monthly)
  - Superannuation guarantee rate
  - Theme selection
  - And more...
- Feature flag sections (appear when flags are enabled)
  - Each enabled flag adds its own settings section
  - Collapsible sections for organisation
- Feature Flags section
  - All available flags organised by group
  - Enable/disable toggles
  - Expand/collapse controls
- Save Settings button

**Use this page for:**
- Initial configuration
- Enabling/disabling features
- Updating tax rates when ATO changes them
- Customising the interface
- Adjusting financial settings

See [Settings documentation](docs/settings.md) for complete details.

### About
Application information, updates, and backups.

**What you'll find:**
- Current build date
- Update check status
- Update instructions (Manual and Automated tabs)
- Backup creation button
- Links to GitHub repository and documentation
- Privacy and security information
- Credits

**Use this page for:**
- Checking for updates
- Creating backups before updates
- Getting the automated update command
- Finding documentation links
- Viewing version information

## Optional Pages

These pages only appear when specific feature flags are enabled.

### Hour Types
**Requires:** *Enable multiple hour types* feature flag

Manage categories of time (work, leave, training, etc.).

**What you'll find:**
- Hour types list
- Add hour type button
- Edit and delete controls for each type
- Income contribution toggle per type
- Requires contract toggle per type
- Colour selection for visual identification

**Use this page for:**
- Creating hour type categories
- Configuring which types contribute to income
- Setting up leave types vs billable types
- Customising hour type colours

See [Hour Types documentation](docs/time-entry-hour-types-contracts.md) for complete details.

### BAS Reporting
**Requires:** *Enable company income tracking* AND *Switch from monthly to quarterly BAS reporting* feature flags

Australian BAS (Business Activity Statement) reporting.

**What you'll find:**
- Financial year selector
- Period toggle (monthly/quarterly based on settings)
- BAS summary table with all tax figures
- Detail modals for income and expenses
- Invoices summary table (when invoices are enabled)
- GST calculations
- PAYG withholding totals

**Use this page for:**
- Preparing quarterly BAS submissions
- Reviewing GST collected and paid
- Checking PAYG withholding amounts
- Reconciling invoices for tax purposes

See [BAS Reporting documentation](docs/bas-reporting.md) for complete details.

### Invoices
**Requires:** *Enable company income tracking* AND *Enable invoices page* feature flags

Create and manage client invoices.

**What you'll find:**
- Invoice list by month
- Month navigation
- Add invoice button
- Invoice details (client, date, line items, totals)
- Edit and delete controls
- Default line items drawer
- Google Docs generation (when template is configured)
- GST calculations

**Use this page for:**
- Creating client invoices
- Tracking invoice history
- Managing default line items
- Generating invoice documents
- Monitoring billed amounts

### Rate Preview
**Requires:** *Enable contract rate preview page* feature flag

Model the impact of rate changes on contracts.

**What you'll find:**
- Contract selector
- Current rate display
- New rate input
- Before/after comparison
- Income impact calculations
- Contract-specific projections

**Use this page for:**
- Negotiating rate increases
- Understanding income impact of rate changes
- Planning contract renewals
- Comparing different rate scenarios

## Navigation Patterns

### Opening the Menu
- Click the **☰** button in the header
- Menu appears below the header
- All available pages are listed

### Selecting a Page
- Click the page name in the menu
- The current page hides
- The selected page displays
- Menu closes automatically

### Page Visibility
- Core pages always appear in the menu
- Optional pages appear only when their feature flags are enabled
- If a page is missing, check Settings → Feature Flags

### Closing the Menu
- Click any page name
- Click outside the menu
- Press **Escape** key

### Go to Today
- Click the **Tempus** logo in the header
- Only works on Time Entry and Dashboard pages
- Navigates to the current date
- Useful for quickly returning to today after browsing other months

## Layout Conventions

Understanding common interface patterns helps you navigate Tempus efficiently.

### Modals
Modals (pop-up windows) are used for forms and detailed information:
- **Close with**: Click the **×** button, click outside the modal, or press **Escape**
- **Confirmations**: Destructive actions (like delete) show confirmation inside the same modal - no stacked modals
- **Forms**: Most creation and editing happens in modals

### Tabs
Tabs switch between related views on the same page:
- **Time Entry**: Basic vs Advanced modes
- **About**: Manual vs Automated update instructions
- Only one tab is active at a time
- Tab content changes instantly (no page reload)

### Toggles
Binary settings use the `.ts-toggle` switch:
- Click to toggle between enabled/disabled
- Visual indicator (track and thumb) shows current state
- Used throughout Settings and feature flags

### Expand/Collapse
Sections can be collapsed to save space:
- Click the section header to toggle
- Arrow indicator (▶ or ▼) shows current state
- Common in Settings sections and Feature Flag groups
- Use "Expand All" / "Collapse All" buttons for bulk operations

### Calendars
Calendar-based pages share common navigation:
- **Previous/Next arrows**: Navigate between months (or years)
- **Month/Year label**: Click to open picker for jumping to any period
- **Day cells**: Click to select and load data for that day

### Context Menus
Right-click interactions provide quick access:
- **Calendar days**: Right-click to insert default entries (when *Enable default inputs* is enabled)
- Click outside or press **Escape** to dismiss

## Tips for Navigation

- **Bookmark frequently used pages**: While you can't deep-link to specific pages, you can enable *Remember last page on refresh* to reopen your last viewed page.
- **Use keyboard shortcuts**: **Escape** closes modals and menus throughout the interface.
- **Check feature flags first**: If you can't find a page, it likely requires a feature flag to be enabled.
- **Go to today**: Click the logo to jump back to today's date quickly.
- **Keep menus open**: The navigation menu stays open until you select a page or click outside it.
- **Desktop-optimised**: Navigation is designed for desktop screens. Mobile users see a simplified interface.
- **Logical grouping**: Related features are often on the same page (e.g., all deduction management on the Deductions page).
- **Consistent patterns**: Once you learn one modal, all modals work the same way. Once you learn one calendar, all calendars work the same way.

## Where to Go for Specific Tasks

### Time Tracking
- **Log daily hours**: Time Entry page
- **View monthly summary**: Time Entry page → Expand income badge
- **Edit past entries**: Time Entry page → Select the date
- **Bulk fill dates**: Time Entry page → Bulk Entries button (when enabled)

### Financial Review
- **Monthly income**: Time Entry page → Income badge
- **Yearly totals**: Annual Views page
- **BAS reporting**: BAS Reporting page (when enabled)
- **Invoice tracking**: Invoices page (when enabled)

### Configuration
- **Contract setup**: Contracts page
- **Hour type setup**: Hour Types page (when enabled)
- **Deduction setup**: Deductions page
- **App settings**: Settings page
- **Feature flags**: Settings page → Feature Flags section

### Management
- **Rate changes**: Rate Preview page (when enabled) or Contracts page
- **Default entries**: Time Entry page → Create Default button (when enabled)
- **Categories**: Deductions page → Manage categories (when enabled)

### Maintenance
- **Updates**: About page
- **Backups**: About page
- **Cache clearing**: Settings page (when *Show clear cache button* is enabled)

## Common Navigation Questions

### Why can't I see a page that's mentioned in the documentation?
The page requires a feature flag to be enabled. Check Settings → Feature Flags and enable the required flag.

### How do I get back to Time Entry?
Click the navigation menu (☰) and select **Time Entry**, or click the **Tempus** logo if you're already on a time-related page.

### Can I open multiple pages at once?
No. Tempus is a single-page application - only one page is visible at a time. Navigation switches which page is displayed.

### Why doesn't the browser back button work?
Tempus doesn't use browser history for page navigation. Use the navigation menu to move between pages instead.

### Can I deep-link to a specific page?
Not directly, but you can enable *Remember last page on refresh* in Settings → Feature Flags to reopen your last viewed page automatically.

### What's the difference between Time Entry and Dashboard?
They're the same page. "Time Entry" is the menu name; "Dashboard & Calendar" describes what the page contains. The documentation sometimes uses both terms.

### How do I know which page I'm on?
The page title appears at the top of the content area, and the active page's menu item is visually distinct in the navigation menu.

## Summary

Tempus navigation is simple: open the menu, select a page, and start working. Core pages are always available for essential tasks like time entry, contracts, and settings. Optional pages appear when you enable their feature flags, gradually expanding the interface as you adopt more features. Once you understand the common patterns (modals, tabs, toggles), you'll navigate efficiently across all pages.
