# Navigation & Layout Conventions

- Desktop-first UI inside a 1280px `.ts-container`; `.ts-container--fluid` only for extra-wide layouts (e.g., BAS).
- Header menu contains all primary destinations; toggled by the ☰ button.
- Tabs switch between manual/punch modes on Time Entry; do not stack modals (confirm inside the same modal).

## Pages at a Glance
- Time Entry: default landing; manual and punch tabs with calendar sidebar.
- Contracts: contract list and detail panel with burndown/summary.
- Dashboard: monthly calendar with hours/income badges and default context menu.
- Annual Views: yearly summaries and category breakdowns.
- Settings: grouped by core vs feature-flag sections.
- (Flagged) Invoices, BAS, Rate Preview, Recurring/Bulk tools, Payroll helpers, Importer.

## Patterns
- Modals close on backdrop click or X; destructive confirmations stay inside the modal content.
- `.ts-toggle` is the standard for binary settings.
- Calendar context menu appears on right-click when defaults are enabled; click outside or press Esc to dismiss.

