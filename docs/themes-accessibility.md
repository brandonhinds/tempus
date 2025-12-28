# Themes & Accessibility

Customise Tempus's visual appearance and enable accessibility features for colour vision deficiencies.

## Purpose
Tempus offers multiple themes to suit different visual preferences and working environments. Beyond aesthetic choice, the themes system includes accessibility features for users with colour vision deficiencies (colour blindness) and a custom theme builder for full palette control. Choose a built-in theme, enable colour-blind friendly presets, or design your own custom palette with live preview and contrast validation.

## Accessing Theme Settings

1. Open the main navigation menu (☰ in the header).
2. Select **Settings**.
3. Scroll to the **Core** section.
4. Use the **Theme** dropdown to select your theme.
5. If using the Custom theme, click **Configure** to open the custom theme builder.

## Built-in Themes

Tempus includes five standard themes available without feature flags:

### Dark (Default)
The default Tempus theme with a dark blue-grey background and blue accents. Designed for low-light environments and extended screen time.

### Light
A light theme with bright backgrounds and blue accents. Clean, professional appearance suitable for well-lit offices.

### The OG
The original Tempus theme from version 1.0. Nostalgic design with the classic colour palette.

### Rose Gold
A dark theme with warm rose gold accents instead of blue. Softer, warmer visual tone.

### Sierra 117
A military-inspired green theme with olive and forest green accents. Named after the iconic Spartan.

## Colour-Blind Friendly Themes

**Requires:** *Enable colour blind themes* feature flag

Enabling this flag adds four accessibility-focused themes designed for specific types of colour vision deficiency:

### Protanopia Friendly
Optimised for users with protanopia (red-blindness). Avoids red-green colour combinations that appear similar to protanopes.

**What it does:** Uses blue and yellow as primary distinction colours, avoiding red tones that protanopes cannot distinguish from green.

**Best for:** Users with protanopia or protanomaly (reduced red sensitivity).

### Deuteranopia Friendly
Optimised for users with deuteranopia (green-blindness). Avoids green-red colour combinations that appear similar to deuteranopes.

**What it does:** Uses blue and orange as primary distinction colours, avoiding green tones that deuteranopes cannot distinguish from red.

**Best for:** Users with deuteranopia or deuteranomaly (reduced green sensitivity). This is the most common form of colour blindness.

### Tritanopia Friendly
Optimised for users with tritanopia (blue-blindness). Avoids blue-yellow colour combinations that appear similar to tritanopes.

**What it does:** Uses red and cyan as primary distinction colours, avoiding blue and yellow tones that tritanopes cannot distinguish.

**Best for:** Users with tritanopia or tritanomaly (reduced blue sensitivity).

### Monochrome
High-contrast black and white theme. Removes all colour distinction, relying entirely on contrast, typography, and spacing for visual hierarchy.

**What it does:** Eliminates all colour information, providing pure greyscale interface.

**Best for:** Users with complete colour blindness (achromatopsia), users who prefer minimal visual noise, high-contrast accessibility needs.

## Enabling Colour-Blind Themes

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Accessibility** group.
4. Enable *Enable colour blind themes*.
5. The four colour-blind friendly themes appear in the **Theme** dropdown.
6. Select your preferred accessibility theme.

**Important:** When colour-blind themes are enabled, Tempus also warns you if hour type colours use problematic combinations that may be difficult to distinguish with your selected theme.

## Custom Theme Creation

**Requires:** *Enable custom themes* feature flag

The custom theme feature lets you design your own 8-colour palette with live preview and automatic contrast validation.

### Enabling Custom Themes

1. Navigate to **Settings**.
2. Scroll to the **Feature Flags** section.
3. Expand the **Accessibility** group.
4. Enable *Enable custom themes*.
5. The **Custom** option appears in the **Theme** dropdown.
6. Select **Custom** from the dropdown.
7. The **Configure** button appears next to the theme selector.
8. Click **Configure** to open the custom theme builder.

### Understanding the 8-Colour Palette

Custom themes define eight core colours that Tempus uses to generate the full interface palette:

#### 1. Background
The primary page background colour. Should be the darkest colour for dark themes or lightest for light themes.

**Used for:** Main page backgrounds, modal backdrops.

**Tip:** Choose a colour that's comfortable to look at for extended periods. Very dark (#0b1220) or very light (#ffffff) tones work best.

#### 2. Surface
The colour for cards, panels, and elevated elements. Should contrast with the background.

**Used for:** Calendar cards, settings panels, modal windows, table headers.

**Tip:** For dark themes, make this slightly lighter than the background (e.g., background #0b1220, surface #1a2332). For light themes, make it slightly darker or use a subtle tint.

#### 3. Primary
Your main accent colour. Used for interactive elements, highlights, and branding.

**Used for:** Buttons, links, active states, selected days on calendar, focus outlines.

**Tip:** Choose a vibrant colour that stands out. Blue (#3b82f6), green (#10b981), purple (#8b5cf6), or teal (#14b8a6) work well. Ensure it contrasts well with both background and surface.

#### 4. Success
Colour for positive actions, confirmations, and success states.

**Used for:** Save buttons, success messages, positive variances, completion indicators.

**Tip:** Green tones (#10b981, #22c55e) are conventional for success. Ensure it's distinct from primary if primary is also green.

#### 5. Warning
Colour for caution, alerts, and actions that need attention.

**Used for:** Warning messages, destructive action confirmations, validation alerts.

**Tip:** Orange (#f59e0b) or amber (#f97316) tones work well. Must be distinct from both success and danger.

#### 6. Danger
Colour for errors, destructive actions, and critical alerts.

**Used for:** Delete buttons, error messages, negative variances, validation failures.

**Tip:** Red tones (#ef4444, #dc2626) are conventional. Ensure strong contrast against the background for visibility.

#### 7. Text
Primary text colour. Should have strong contrast against both background and surface.

**Used for:** Body text, headings, labels, most interface text.

**Tip:** For dark themes, use light grey (#e5e7eb, #f3f4f6) rather than pure white to reduce eye strain. For light themes, use dark grey (#1f2937, #111827) rather than pure black.

#### 8. Muted
Secondary text colour for less important content. Should be noticeably lighter (dark themes) or darker (light themes) than primary text.

**Used for:** Placeholder text, secondary labels, disabled states, metadata.

**Tip:** Aim for 60-70% of the contrast level of your primary text colour. For dark themes, use mid-grey (#9ca3af, #6b7280). For light themes, use lighter grey (#6b7280, #9ca3af).

### Using the Custom Theme Builder

1. Open the custom theme builder by selecting **Custom** theme and clicking **Configure**.
2. The modal displays eight colour pickers, one for each palette colour.
3. Click any colour swatch to open the colour picker.
4. Choose your desired colour using:
   - Visual colour picker
   - Hex code input (e.g., #3b82f6)
   - HSL/RGB sliders (browser-dependent)
5. As you change colours, the **live preview panel** updates immediately, showing how buttons, text, and cards will appear.
6. The system automatically validates contrast ratios between text and background colours.
7. Click **Save** to apply your custom theme.
8. Click **Reset to Defaults** to restore the default custom theme palette.

**Important:** The colour pickers show your exact colour selections. The theme engine automatically generates lighter and darker shades from these base colours for borders, hovers, and other UI states.

### Live Preview Panel

The preview panel shows:
- **Sample text** in both primary and muted colours against the background
- **Primary button** with your primary colour
- **Success button** with your success colour
- **Card surface** with your surface colour
- **Text on surface** to verify surface/text contrast

**Use this to:** Verify that your colour choices work together before saving. Check that text is readable on both background and surface colours, and that buttons stand out clearly.

### Contrast Validation

Tempus validates that your text colours have sufficient contrast against background and surface colours:

**Minimum contrast ratios** (WCAG AA standard):
- **Body text** (small text): 4.5:1 contrast ratio
- **Large text** (headings): 3:1 contrast ratio

**If validation fails:**
- A warning appears below the failing colour picker
- You can still save the theme, but be aware that text may be difficult to read
- Adjust the text colour to a lighter (dark themes) or darker (light themes) shade until the warning clears

**Tip:** Aim for 7:1 contrast for body text and 4.5:1 for large text (WCAG AAA standard) if you want maximum accessibility.

## Tips for Creating Good Custom Themes

### Colour Harmony

**Use a colour palette generator:**
- Tools like [Coolors](https://coolors.co) or [Adobe Color](https://color.adobe.com) help generate harmonious palettes
- Start with your primary colour and generate complementary colours
- Export hex codes and paste them into the custom theme builder

**Stick to a consistent temperature:**
- **Warm themes:** Use warm greys for background/surface, orange/red/yellow for accents
- **Cool themes:** Use blue-grey for background/surface, blue/teal/purple for accents
- Mixing warm and cool can work but requires careful balance

**Limit your palette:**
- Your 8 base colours generate dozens of shades automatically
- Don't try to use every colour in the rainbow - cohesion comes from restraint
- Primary, success, warning, and danger should be distinct but harmonious

### Contrast Best Practices

**Text contrast is non-negotiable:**
- Always ensure text meets WCAG AA minimum (4.5:1 for body, 3:1 for headings)
- Test your theme with the live preview before saving
- If warnings appear, adjust text colours first before tweaking background

**Interactive elements need visibility:**
- Primary colour must stand out against both background and surface
- Buttons should be immediately recognizable as clickable
- Links should be distinguishable from regular text

**Consider surface elevation:**
- Surface should be noticeably different from background
- Too little contrast makes cards disappear; too much creates jarring boxes
- Aim for 10-15% lighter (dark themes) or darker (light themes) than background

### Testing Your Custom Theme

**Test in context:**
- After saving, navigate to different pages (Dashboard, Time Entry, Contracts, Settings)
- Check that all UI elements are visible and readable
- Pay special attention to:
  - Calendar day cells (hover states, selected states)
  - Modal windows (text on surface)
  - Form inputs (borders, focus states)
  - Data tables (row striping, headers)

**Test with real content:**
- Add some time entries, contracts, and settings data
- View the dashboard with actual income figures
- Check that positive/negative variances are distinguishable

**Test at different times of day:**
- A theme that looks good at night might be harsh in bright daylight
- If you work in varying lighting conditions, test accordingly
- Consider creating multiple custom themes for different environments

**Print preview (if applicable):**
- If you use the print view feature, test that your custom theme doesn't interfere with print styling
- Print views generally override custom themes, but check to be sure

## Hour Type Colour Warnings

When colour-blind themes are enabled, Tempus checks your hour type colours against the active theme:

**What it checks:**
- Whether hour type colours are distinguishable for protanopes, deuteranopes, or tritanopes
- Whether colour combinations might appear similar to users with colour vision deficiencies

**If a problem is detected:**
- A warning appears on the Hour Types page
- The warning explains which hour types have problematic colour combinations
- You can update hour type colours to use more distinguishable options

**Example:** If you have one hour type in red and another in green, deuteranopes (green-blind) may not be able to distinguish them. The warning will recommend using blue/orange or other distinguishable pairs.

**Tip:** If you rely on hour type colours for quick identification, choose colours from the safe palette for your colour vision type:
- **Protanopia/Deuteranopia:** Blue and orange/yellow
- **Tritanopia:** Red and cyan/green
- **All types:** High-contrast dark/light pairs

## Saving and Reverting Themes

### Saving Theme Changes

1. Select your theme from the **Theme** dropdown.
2. If using Custom, configure your palette and click **Save** in the modal.
3. Scroll to the bottom of the Settings page.
4. Click **Save Settings**.
5. Your theme preference is saved to Google Sheets and applied immediately.

### Reverting to Default

To switch back to the default Dark theme:
1. Open **Settings**.
2. Select **Dark** from the **Theme** dropdown.
3. Click **Save Settings**.

To reset a custom theme palette:
1. Open the custom theme builder.
2. Click **Reset to Defaults**.
3. The palette resets to the default custom theme colours.
4. Click **Save** to apply.

**Important:** Theme preferences are stored both in browser cache and in Google Sheets settings. Clearing your cache will temporarily revert to the saved theme from Sheets. Saving settings synchronises both locations.

## Accessibility Best Practices

### For Users with Colour Vision Deficiencies

- **Enable the appropriate colour-blind theme** for your type of colour blindness
- **Rely on text labels** in addition to colours for critical information
- **Use hour type names** rather than colours when logging time if distinctions are unclear
- **Check variance direction** using the +/− symbols, not just colour coding

### For Users with Low Vision

- **Choose high-contrast themes** like Monochrome or themes with strong text contrast
- **Use browser zoom** (Ctrl/Cmd +) to enlarge the interface
- **Enable screen reader support** if available in your browser
- **Use keyboard navigation** (Tab, Enter, Escape) to navigate the interface

### For All Users

- **Test theme changes** before committing to a custom palette
- **Consider your working environment** when choosing a theme (bright office vs. dim home office)
- **Switch themes seasonally** if your lighting conditions change (e.g., more daylight in summer)
- **Save multiple custom themes** by exporting your palette hex codes and keeping them in a note

## Common Questions

### Can I use the same custom theme across multiple devices?
Yes, if you're logged into the same Google account. Theme settings are saved to Google Sheets and synchronise across devices.

### Why do my hour type colours look different in the colour-blind theme?
Colour-blind themes don't change your hour type colours - they change the interface colours. The warnings help you choose hour type colours that remain distinguishable in your selected theme.

### Does changing themes affect print views?
No. Print views use fixed styling (black text on white background) regardless of your active theme to ensure consistent, readable printouts.

### Why doesn't my custom theme look exactly like the preview?
The preview shows a simplified subset of UI elements. Some interface components (like data tables, modals, and complex widgets) may use generated shades that aren't visible in the preview. Always test in the full interface.

### What happens if I disable the custom theme flag after creating a custom theme?
Your custom theme palette is saved, but the Custom option disappears from the theme dropdown. Re-enabling the flag restores access to your saved custom palette.

## Summary

Tempus offers themes for aesthetics and accessibility. Choose from five built-in themes, enable colour-blind friendly presets for protanopia/deuteranopia/tritanopia, or design custom palettes with an 8-colour builder featuring live preview and contrast validation.
