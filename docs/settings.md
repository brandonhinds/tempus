# Settings Page Guide

How settings are organized and controlled.

## Layout
- Controls are grouped into sections:
  - Core: always visible.
  - Feature-specific: section appears only when the governing flag is enabled (section id matches flag id).
- Each control is rendered from hidden templates in `views/partials/settings.html` driven by `SETTINGS_CONFIG`.

## Common Controls
- Superannuation rate (%).
- Rounding intervals and projection preferences.
- Cache controls (when `show_clear_cache` is enabled).
- Themes and color options (see `themes-accessibility.md`).

## Behavior
- Sections can expand/collapse; toggles use `.ts-toggle`.
- Feature flags in `DEFAULT_FEATURE_FLAGS` populate the flags list automatically.
- “Remember last page” flag reopens the last viewed page on refresh.

## Tips
- When adding new settings, register template + `SETTINGS_CONFIG` with the correct section id (flag id).
- Use inline confirmation for destructive actions; do not stack modals.

