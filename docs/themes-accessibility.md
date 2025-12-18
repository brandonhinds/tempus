# Themes & Accessibility

Theme and accessibility options, most controlled via feature flags.

## Built-in Themes
- Standard themes available by default; Custom and colorblind options are flag-controlled.

## Feature Flags
- `enable_colorblind_themes`: adds colorblind-friendly theme presets and warnings for problematic hour type colors.
- `custom_theme`: adds Custom theme with 8-color palette and live preview; validates contrast before saving.

## Usage
- Change theme from Settings; Custom opens a configure button when the flag is enabled.
- Hour type colors are checked for accessibility when colorblind themes are on.

## Tips
- Keep high contrast for calendar badges and punch inputs.
- Verify print readability if using custom palettes.

