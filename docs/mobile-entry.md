# Mobile Entry Overview

A minimal, mobile-optimised interface for quick time entry updates when away from your desktop.

## Purpose
The mobile entry view provides a streamlined interface for adding or editing time entries on phones and tablets. It is **intentionally barebones** - Tempus is designed as a desktop application, and the mobile view exists solely for quick updates when you don't have access to your computer.

**Important:** This is not a full mobile app. Most advanced features (invoices, BAS reporting, deductions, payroll helpers, defaults management, annual views, and more) are only available on desktop. Use mobile entry for basic time logging, then return to desktop for everything else.

## Accessing Mobile Entry

### From Desktop
1. Open Tempus on your desktop browser.
2. Copy the web app URL from your browser's address bar.
3. Open the same URL on your mobile device.
4. The interface automatically adapts to mobile screens.

**Tip:** Bookmark the URL on your phone for quick access.

### Direct Access
If you already have the URL bookmarked on your mobile device, simply tap the bookmark to load Tempus. The mobile-optimised view loads automatically on small screens.

## What's Available on Mobile

### Single-Day Calendar Card
The mobile view displays a single calendar day card showing:
- The selected date with navigation arrows
- Day number
- Hour type chips (when *Enable multiple hour types* is enabled)
- Total hours for the day

**Navigation:**
- Tap the **◀** and **▶** buttons to move between days
- Tap the date label to open the day picker modal
- Select any day from the month grid

### Time Entry Modes
Mobile entry supports both Basic and Advanced modes, mirroring desktop functionality:

#### Basic Mode
- Date selection (via navigation or day picker)
- Hour Type dropdown (when hour types are enabled)
- Contract selection
- Total hours input (decimal format, e.g., 7.5)
- Rounding uses your configured settings

**Buttons:**
- **Add Entry**: Saves a new entry
- **Save Changes**: Updates an existing entry (when editing)
- **Delete Entry**: Removes the entry (when editing)
- **Cancel Edit**: Discards changes and returns to add mode

#### Advanced Mode
- Date selection
- Hour Type dropdown (when enabled)
- Contract selection
- Punch in/out interface
- Punch list showing all in/out pairs
- Duration calculation from closed punches
- Open punch warnings

**Buttons:**
- **Punch In** / **Punch Out**: Toggle button to record times
- **Add Entry**: Saves punches
- **Save Changes**: Updates existing punches (when editing)
- **Discard Changes**: Reverts unsaved punch modifications
- **Delete Entry**: Removes all punches for this entry

### Features That Work on Mobile
- ✅ Add time entries (Basic and Advanced)
- ✅ Edit existing entries
- ✅ Delete entries
- ✅ View daily totals
- ✅ Navigate between days
- ✅ Select contracts (only those valid for the selected date)
- ✅ Select hour types (when enabled)
- ✅ Punch in/out tracking
- ✅ Contract validation warnings

## What's NOT Available on Mobile

The following features are **desktop-only** and will not appear in mobile view:

### Desktop-Only Features
- ❌ Monthly calendar view
- ❌ Income badges and breakdowns
- ❌ Annual views and reports
- ❌ Contract management (view, add, edit contracts)
- ❌ Deduction management
- ❌ Invoice creation and management
- ❌ BAS reporting
- ❌ Payroll helpers (Xero, MYOB)
- ❌ Default entry templates (create, manage, apply)
- ❌ Recurring time entries
- ❌ Bulk time entries
- ❌ Hour type management
- ❌ Settings configuration
- ❌ Feature flag management
- ❌ Print view
- ❌ Timesheet 1.0 importer
- ❌ Rate preview
- ❌ Contract burndown charts
- ❌ Cache management
- ❌ Theme customisation

**Why these limitations?** These features require larger screens, complex interactions, or multi-step workflows that don't translate well to mobile. Tempus is a desktop application first, and attempting to squeeze all features into a mobile interface would compromise usability on both platforms.

## Mobile Workflow

### Adding a New Entry

1. Open Tempus on your mobile device.
2. Use the navigation arrows to select the date (or tap the date label to open the day picker).
3. Choose **Basic** or **Advanced** tab depending on your entry style.
4. Select a contract from the dropdown.
5. If hour types are enabled, select the appropriate hour type.
6. Enter your time:
   - **Basic**: Enter total hours (e.g., 7.5)
   - **Advanced**: Tap **Punch In** and **Punch Out** to record times
7. Tap **Add Entry** to save.
8. The day card updates to show your total hours.

### Editing an Existing Entry

1. Navigate to the day with an existing entry (you'll see hours displayed on the card).
2. The form automatically loads with the existing entry data.
3. Modify the fields as needed.
4. Tap **Save Changes** to update, or **Delete Entry** to remove.

### Switching to Desktop View

At the bottom of the mobile interface, you'll see a **Desktop view** link (when available). Tap it to:
- Switch to the full desktop interface on your mobile device
- Access features not available in mobile view
- Use advanced features like invoicing, BAS, or settings

**Note:** The desktop view is not mobile-optimised. Text may be small, interactions may be awkward, and some features may be difficult to use on a small screen. This is intended as a temporary workaround when you absolutely need a desktop-only feature while mobile.

## Limitations and Considerations

### Intentionally Minimal
The mobile view is **deliberately stripped down**. This is not a limitation to be fixed - it's by design. Tempus's power comes from its sophisticated desktop features (income calculations, contract burndown, BAS reporting, invoicing, etc.), and these simply don't work well on mobile screens.

**Philosophy:** Mobile entry is for convenience when logging hours on the go. Everything else should be done on desktop where you have proper screen space and input methods.

### No Full Mobile App
Tempus is not a native mobile app and will never be. It's a web application optimised for desktop browsers. The mobile view is a lightweight accommodation for basic time logging, not a replacement for the desktop experience.

### Data Consistency
Entries created on mobile use the same validation, rounding, and storage as desktop:
- Contract dates are validated
- Rounding rules from your settings are applied
- Hour types must match those configured on desktop
- Punch times follow the same formatting rules

**Tip:** Configure contracts, hour types, and settings on desktop before using mobile entry. The mobile view cannot create or modify these resources.

### Browser Compatibility
Mobile entry works best on modern mobile browsers:
- iOS Safari
- Chrome on Android
- Edge on mobile

Older or less common browsers may experience layout issues or limited functionality.

## Tips for Mobile Users

- **Use desktop for setup**: Create contracts, configure hour types, set up defaults, and adjust settings on desktop. Mobile is for logging time only.
- **Bookmark the URL**: Save Tempus as a bookmark on your phone's home screen for quick access.
- **Keep it simple**: Mobile entry is best for straightforward time logging. If you need to do complex operations (bulk entries, recurring entries, invoice generation), wait until you're on desktop.
- **Check on desktop**: After logging time on mobile, verify on desktop that income calculations, contract burndown, and other metrics are updating as expected.
- **Consistent hour types**: If using hour types, ensure you select the same ones on mobile and desktop to keep data aligned.
- **Desktop view as last resort**: Only switch to desktop view on mobile if absolutely necessary. The experience will be poor, but it's better than nothing in emergencies.
- **Cache works on mobile**: Mobile view uses the same caching system as desktop. First load may be slow, but subsequent loads will be faster.
- **Landscape orientation**: If you must use desktop view on mobile, rotate to landscape for slightly better usability.

## Common Mobile Questions

### Why can't I manage contracts on mobile?
Contract management requires viewing burndown charts, configuring complex settings (hour caps, weekend counting, etc.), and making financial decisions. These tasks need a full-sized screen and aren't suitable for mobile.

### Can I create deductions on mobile?
No. Deduction management, categories, and occurrence adjustments are desktop-only. These features involve detailed financial configuration that requires the full interface.

### Where's the income badge on mobile?
Income breakdowns are not available on mobile. The calculations still happen (entries you add on mobile affect your income), but you need desktop to view the breakdown.

### Can I access settings on mobile?
No. All settings, feature flags, and configuration are desktop-only. This is intentional - you shouldn't be making app-wide configuration changes on a small screen.

### Why doesn't the calendar show the full month on mobile?
A full monthly calendar with all features (income badges, hour type filters, context menus, etc.) doesn't fit on mobile screens in a usable way. The single-day view keeps the interface clean and focused.

### Can I use recurring entries on mobile?
You can see the results of recurring entries (they appear as regular entries), but you cannot create or manage recurring entry schedules on mobile. That requires desktop.

### Will there ever be a full mobile app?
No. Tempus is fundamentally a desktop application. The complexity of features like BAS reporting, contract burndown, invoice generation, and advanced income calculations require desktop screen space and interactions. Mobile entry exists for convenience, not as a full mobile experience.

## When to Use Mobile Entry

**Good use cases:**
- Adding today's hours whilst commuting home
- Logging time during lunch break when away from desk
- Quick updates to an entry you forgot to log earlier
- Checking if you logged time for a specific day
- Simple punch in/out when on the go

**Bad use cases:**
- Creating invoices
- Reviewing monthly income breakdowns
- Managing contracts or deductions
- Bulk operations across multiple days
- Configuring settings or hour types
- Running payroll helpers
- Generating BAS reports
- Any task requiring detailed review or complex workflows

## Summary

Mobile entry is a **convenience feature** for basic time logging when you don't have desktop access. It is intentionally minimal and will always remain that way. Tempus is a desktop application first and foremost - use mobile entry for quick updates, then return to desktop for everything else.

For the full Tempus experience with all features, income calculations, reporting, and advanced functionality, use a desktop or laptop computer. The mobile view is just a lightweight companion, not a replacement.
