# UI Modernisation Roadmap

This note expands each of the proposed improvements so future work can scope, prioritise, and implement them confidently.

---

## 1. Refresh the Visual Hierarchy
- **Typography scale:** Move to a stepped rhythm (e.g. 12 / 14 / 16 / 20 / 24 / 32) so headers, subheaders, body copy, and meta text are visually distinct. This helps users scan dense screens quickly and creates a more premium feel.
- **Weight and tracking:** Increase heading weights (600–700) and apply subtle letter-spacing on section titles to reinforce importance without relying solely on font size.
- **Spacing tokens:** Adopt a documented spacing set (4, 8, 12, 16, 24, 32) and refactor component padding/margins to those values. Consistency here makes the UI feel deliberate and removes the “one-off” gaps currently set inline.
- **Outcomes:** Cleaner scannability, stronger visual rhythm, easier maintenance because spacing and type decisions can be referenced directly in the design token catalogue.

## 2. Refine the Colour Story
- **Gradient + shadow tuning:** Replace heavy shadows with softer versions (e.g. rgba(15, 23, 42, 0.12) 0 8px 24px) and use more modern gradients on stat tiles for depth without noise.
- **Theme harmonisation:** Balance accent colours across light/dark themes so success, warning, and danger states read consistently regardless of background; this also ensures accessibility thresholds.
- **Surface accents:** Introduce subtle background tints for secondary panels or inactive states to break up large monochrome areas.
- **Outcomes:** A more polished brand identity and improved contrast accessibility, especially for colour-blind users now that warning tokens exist across all themes.

## 3. Upgrade Key Components
- **Buttons:** Slimmer border radius (8px), larger horizontal padding, and optional leading icons elevate CTA clarity. Add tertiary text buttons that adopt `ghost` styling for lightweight actions.
- **Toggles & inputs:** Apply micro-shadow and focus halo to `ts-toggle` and form controls to signal interactivity; align focus states across keyboard and pointer inputs.
- **Modals:** Standardise modal headers with title + optional subtitle, fix footers to the bottom for long forms, and add a gentle fade/scale open animation.
- **Outcomes:** Components feel cohesive and “designed”; future additions reuse a shared pattern instead of bespoke CSS.

## 4. Responsive Polish
- **Toolbar responsiveness:** Convert `ts-toolbar` to wrap into a column below ~960px, ensuring action buttons stay accessible without overflow.
- **Cards & grids:** Update `ts-annual-summary-grid` and other data grids to degrade gracefully—two columns on tablets, single column on phones—without requiring inline overrides.
- **Tables:** For tables like BAS and invoices, render an accordion/list variant under 768px with key metrics surfaced first; secondary data can collapse behind a disclosure.
- **Outcomes:** Mobile, tablet, and small window users get a first-class experience and we remove inline `@media` blocks sprinkled across templates.

## 5. Micro-Interactions & Motion
- **State transitions:** Apply a 120–180 ms ease-out fade/slide when switching tabs, opening detail panels, or loading data; we already have `fadeInUp`, so reuse/extend it consistently.
- **Feedback cues:** Animate KPI numbers or badges when values change (e.g. count-up animation or colour pulse) so data updates feel alive.
- **Hover/focus treatment:** Introduce uniform hover/focus states for buttons, badges, and list items to reinforce affordances and support accessibility.
- **Outcomes:** The product feels responsive and modern without overwhelming animations, signalling polish to end users.

## 6. Empty & Feedback States
- **Empty states:** Replace plain descriptions with a consistent illustration/emoji set plus actionable guidance (“Add your first contract to see projections”).
- **Loading & error cues:** Pair existing notes with micro-illustrations or icon badges to reinforce status and make transitions less jarring.
- **Success confirmations:** Introduce inline celebration elements (e.g., confetti burst, subtle badge flash) for major tasks like invoice generation.
- **Outcomes:** Users gain clearer direction when data is missing or still loading, while success moments feel intentional.

## 7. Content & Loading Framing
- **Skeleton loaders:** Swap out raw `--` placeholders with skeleton blocks/blurs for cards, tables, and charts to provide immediate feedback during fetches.
- **Toast/alert consistency:** Consolidate success/error/warning banners into the same component family as `ts-badge--warn`, ensuring location, colour, and typography match.
- **Copy refinement:** Audit helper text and notes to use concise, action-oriented language; remove “Still need to figure out what this means” placeholders.
- **Outcomes:** Perceived performance improves, messaging feels professional, and user trust increases because all states look intentional.

## 8. Layout Consistency
- **Grid system:** Introduce a 12-column CSS grid wrapper so sections align vertically regardless of content type. Cards, forms, and tables should snap to column spans (e.g. 6/12 for half-width).
- **Container usage:** Limit `.ts-container--fluid` to dashboards that require wide charts; all other screens should honour the 1280px max for readability.
- **Spacing utilities:** Document reusable helpers (e.g. `.ts-stack`, `.ts-stack--sm`, `.ts-gap-lg`) to reduce inline flex/gap declarations.
- **Outcomes:** Developers can assemble pages quickly, and the app lets content breathe while keeping everything aligned.

## 9. Data Export & Reporting Enhancements
- **Toolbar actions:** Add dedicated icon buttons for PDF/CSV export on analytics-heavy views (Annual, BAS, Invoices) with contextual tooltips.
- **Chart upgrades:** Use Chart.js options for crisper tooltips, legend badges that match our badge styling, and optional dark/light background toggles per theme.
- **Print-optimised styling:** Expand the print view modal work—ensure exported/printed documents inherit typography/color improvements so reports match the in-app experience.
- **Outcomes:** Reporting features feel integrated and enterprise-ready, reinforcing Tempus as a professional tool rather than a personal utility.

## 10. Brand & Identity Assets (Final Phase)
- **Logotype & iconography:** Convert the existing logo into a clean SVG, finalise a Tempus wordmark/glyph pair, and weave them into the navbar, favicon, and share images.
- **Visual language:** Establish a lightweight illustration pack (empty states, success, error) that echoes the brand palette without overpowering the UI.
- **Theme selector presentation:** Surface appearance options with previews or thumbnails to celebrate the expanded theme library.
- **Update Loading Screen** With the logo in place, the loading screens can be updated to show the animated logo in the centre of the screen, rather than the current, subtle loading text.
- **Outcomes:** A united visual identity that carries through marketing, web app, and documentation touchpoints once the groundwork is complete.

---

### Next Steps

Only step 10 is outstanding, and needs the logo to be finalised to action.
