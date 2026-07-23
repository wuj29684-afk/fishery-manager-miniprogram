# 0.3.0 Eight-Screen Design QA

## Comparison Target

- Source visual truth: `C:\Users\26288\.codex\generated_images\019f4216-b404-7df3-a968-d8ccc35cc633\exec-3fa24e03-5890-43c7-9003-1f669bbf8884.png`
- Required states: field home, overview home, unit list, cage form, cage detail, feed form, water/anomaly form, and records/data settings.
- Viewport: WeChat DevTools iPhone 12/13 simulator, 488 x 941 screenshot pixels.
- Final combined evidence: `qa-captures/design-vs-implementation-pass2.png`.

## Final Findings

- No actionable P0, P1, or P2 visual findings remain.
- Navigation: all eight states now use the selected five-column navigation. The raised center quick-record action remains stable and the active item matches each screen.
- Typography and density: the Chinese hierarchy, medium-density rows, field labels, values, and section headings remain readable without clipping or overlap.
- Layout: the two home modes, grouped unit list, medium-density cage form, five-tab detail, feed and water forms, and combined record/settings screen preserve the reference information order.
- Actions: detail edit/record actions and record save/save-and-continue actions remain visible above the bottom navigation at the target viewport.
- Colors: sea blue is the primary color; cyan/green communicate normal water and operating states; orange/red remain reserved for reminders and risk.
- Assets: the cage artwork is a real transparent raster asset with a clean crop. No checkerboard, opaque placeholder, CSS drawing, emoji, or handcrafted SVG substitute is present.
- Domain substitutions: counts, dates, alerts, and sample values come from deterministic QA data. They may differ from the illustrative mock while preserving the same component structure and hierarchy.

## Comparison History

### Baseline - blocked

- The previous implementation used a different layout direction and had not captured all eight required states.

### Pass 1 - blocked

- Cage creation lacked visible dimensions and stocking quantity.
- Feed and water core forms were too light and their row density did not match the selected medium-density form.
- Cage detail displayed a pond-area value for a cage.
- The old DevTools project loaded a stale bundle and the earlier cage image path.

### Pass 2 - passed

- Rebuilt the eight selected states from a fresh temporary WeChat DevTools project.
- Added cage dimensions and stocking quantity to the core form.
- Converted the core record fields to medium-density single rows.
- Corrected cage detail sizing and tightened its vertical rhythm so all nine summary rows remain available.
- Kept detail and record-form primary actions visible above the five-column navigation.
- Added the missing five-column navigation to the cage creation screen.
- Replaced the stale/opaque cage image path with `src/assets/offshore-cage.png`.

## Evidence

- Individual screenshots: `qa-captures/pass2-01-home-field.png` through `qa-captures/pass2-08-records-settings.png`.
- Eight-screen implementation sheet: `qa-captures/pass2-eight-screens.png`.
- Same-input source comparison: `qa-captures/design-vs-implementation-pass2.png`.

## Follow-Up Polish

- P3: later iterations may refine illustrative sample counts and alert copy without changing the approved layout or interaction model.

final result: passed
