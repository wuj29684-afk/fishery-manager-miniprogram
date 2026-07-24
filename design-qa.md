# 0.4.0 Option 3 Twelve-Screen Design QA

## Comparison Target

- Source visual truth: `C:\Users\26288\.codex\generated_images\019f4216-b404-7df3-a968-d8ccc35cc633\call_CA5cSx9Irx01vf6H52HQ0YDs.png`
- Required states: empty home, field-duty home, business-overview home, unit list, unit creation, unit detail, quick record, feed form, water form, record list, function center, and data sync.
- Viewport: WeChat DevTools mobile simulator, 487 x 904 screenshot pixels.
- Final combined evidence: `qa-captures/design-vs-implementation-option3.jpg`.

## Final Findings

- No actionable P0, P1, or P2 visual findings remain in the twelve required states.
- Navigation: all daily screens use the selected five-column navigation with a stable raised quick-record action and correct active states.
- Hierarchy: the selected compact header, segmented home modes, grouped unit list, medium-density forms, detail tabs, function groups, and sync sections retain the reference order and visual weight.
- Actions: creation, detail, and form actions remain visible above the bottom navigation at the target viewport.
- Colors: water blue is primary, aquaculture green communicates normal states, and orange/red remain reserved for reminders and risk.
- Assets: all four aquaculture-unit types now use a single bright semi-realistic editorial illustration system. Net cage, outdoor pond, indoor RAS tank, and ecological aquaculture remain recognizable in both 72 x 54 thumbnails and wide detail crops.
- Indoor aquaculture: the indoor image clearly shows a bright recirculating aquaculture facility with circular culture tanks, filtration equipment, and circulation pipes. It no longer reads as an unrelated industrial or outdoor scene.
- Local-first account behavior and existing business functions are preserved; the visual rebuild does not reintroduce forced login.

## Aquaculture Image Evidence

- Unit creation screen: `qa-captures/option3-05-create-unit.png`.
- Scrolled unit list: `qa-captures/option3-unit-images-list.png`.
- Outdoor pond detail: `qa-captures/option3-unit-image-pond.png`.
- Indoor RAS detail: `qa-captures/option3-unit-image-tank.png`.
- Ecological aquaculture detail: `qa-captures/option3-unit-image-other.png`.
- Net cage detail: `qa-captures/option3-06-unit-detail.png`.

## Asset Mapping

- `cage`: `src/assets/sea-cage-photo.jpg`
- `pond`: `src/assets/outdoor-pond-photo.jpg`
- `tank`: `src/assets/indoor-ras-tanks.jpg`
- `other`: `src/assets/other-eco-aquaculture.jpg`

The same mapping is used by the home, unit list, unit creation, unit detail, and record forms.

## Remaining P3 Polish

- Illustrative sample values and copy may continue to evolve with real-user feedback without changing the approved structure.
- The generated scenes can later receive species-specific variants when user-uploaded unit photography is added to the product scope.

final result: passed
