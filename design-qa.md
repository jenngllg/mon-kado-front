# Dashboard design QA

final result: passed

## Sources and scope
- Selected populated visual: C:/Users/Jenn/.codex/generated_images/01a18cf7-a6b5-73e2-96c9-fd3d5490ae3e/exec-36c89d88-38ca-48f5-955a-9e6aea8a6ac3.png (1487 x 1058).
- Explicit approved deviations: equal 50/50 columns, existing production tokens/header/components and cover assets, deferred empty-state illustrations. This is the requested functional base, not a pixel-identical reconstruction.
- Real authenticated implementation: https://localhost:5189/.
- Desktop capture: .local/dashboard-qa/desktop.png (1487 CSS px viewport, full-page 1487 x 1173, density 1).
- Mobile capture: .local/dashboard-qa/mobile.png (390 x 844 CSS viewport, full page, density 1).
- Empty state captures: .local/dashboard-qa/empty-desktop.png and empty-mobile.png. These use the actual component with empty injected readers in an isolated ignored harness; the shell is intentionally absent. They do not modify account data.
- Combined reference/implementation input: .local/dashboard-qa/comparison.png. Both were opened together; scaled equally to 744px width, preserving aspect ratio, with differing full-page heights documented.

## Comparison history
1. Initial desktop observation found inherited action-link centering and rounded separators, missing secondary-action border and actions below rows (P2). Corrected row alignment/radii, secondary border and top-right actions. Equal panel geometry retained.
2. Revised desktop capture and combined comparison show left-aligned rows, real covers, correctly bordered join action and equal section widths (576px each). One pixel of inner width differs because of the divider border. No actionable P0/P1/P2 remains within the approved base scope.

## Required fidelity surfaces
- Typography: existing bundled Nunito Sans, common heading scale and existing terracotta heading stroke. Long names wrap, including on mobile; no clipped text observed.
- Spacing/layout: sage occasions rail above greeting and two columns; desktop columns each 576px. Responsive single column, 44px minimum controls, no horizontal overflow at 390px. Layout uses the existing 72rem content maximum rather than the mock's edge-to-edge page. Intentional existing-product constraint.
- Colors/tokens: existing ivory, forest, sage and terracotta tokens reused, no new palette.
- Images: existing occasion cover photographs and authorized real group photo reused. Empty illustration work deferred as requested; no invented portraits or illustrations.
- Copy/content: real authorized list/group names and dates. At most three previews per area, full-page links, first-list creation and group-admission actions. Future dates deduplicated by list ID; no fictitious recurrence or reservation data.

## Interaction and behavior checks
- Browser: clicked a real group preview and reached the correct group; clicked first-list creation in the empty-state harness and reached the real creation form, without submitting.
- View tests: chronological group occasions, owned/group deduplication, past exclusion, empty actions, explicit retry after partial failure, abort/late result protection, session logout clearing private content.
- Service tests: group and wishlist pagination with original abort signal.
- 41 targeted tests passed across dashboard, application routes and design audit regression (40 combined before adding the final session test, then all six dashboard tests rerun).
- Type checking: application, node and e2e projects passed. ESLint on touched JS passed. Production build passed; existing large main-bundle warning remains.
- Browser console reviewed: one historical missing-export error from the in-progress edit at 22:44:40Z, fixed by exporting the session-aware view. Subsequent navigation/reload renders successfully; no later error observed.

## Follow-up polish
- Illustrations remain deferred by explicit request. Existing header and real data differ from generated reference.
- Loading, retry and session transitions have automated coverage; no synthetic server failure was injected into the real account's browser.

## Editable list header — 1 November 2026

- Applied Jenn's requested order: return arrow, separate centered title, sage event/description banner, then right-aligned list commands and sorting. Desktop event metadata is left of the description; mobile stacks it first. Personal lists opened from groups use the same layout.
- Inspected final Chromium captures at 1487px and 390px: `.local/wishlist-layout-qa/desktop.png` and `mobile.png`. Existing fonts, colors, controls and gallery remain in use. The new hierarchy intentionally supersedes the attached screenshot's old positions; synthetic fixture content differs from Jenn's list.
- 32 browser scenarios passed, covering widths from 240px to 3440px, event metadata variants, loading, errors, empty lists, keyboard focus, sharing dialogs, archives/suspension, group permissions, sorting and reorder save. All API calls were intercepted with synthetic data.
- 233 affected unit/application tests passed; type checking, repository lint and the subsequent lint of changed test files passed. Production build and the final browser-test build passed. The existing large-bundle advisory remains.
- Confirmed the existing frontend server on port 5173 serves the updated owner component (HTTP 200).

### Centered commands refinement

- Centered the owner command group independently of right-aligned sorting. Sorting moves to its own row below 88rem; wrapped mobile command rows remain centered.
- Inspected updated 1487px and 390px screenshots in `.local/wishlist-layout-qa/`; all 11 affected browser scenarios passed, including keyboard navigation, group-origin editing and loading/error/empty states. These scenarios use intercepted API fixtures.
- The existing real HTTPS frontend at `https://localhost:5189` serves the updated CSS; frontend and API/database readiness return HTTP 200. The live OpenAPI type check, lint and type checking passed; the browser-test build passed.
- Direct inspection of Jenn's authenticated Chrome list was blocked by the computer-use tool because user input was active in the window. No live-list visual verification is claimed for this refinement.

## Group member card widths — 1 November 2026

- Group rosters use four equal-width columns above 64rem, two up to 64rem and one up to 40rem. Existing avatars, wrapping names/handles and accessible removal controls are preserved.
- Inspected 1440px and 390px fixture screenshots in `.local/group-member-grid-qa/`. Five synthetic members verify four cards on the first desktop row and the fifth on the next; a long name stays within its card. Six affected browser scenarios passed, including keyboard focus and group/list navigation. Lint, type checking and the browser-test build passed.
- Opened the real authenticated local group “La famille GLLG” in Chrome. Its two existing members occupy quarter-width desktop tracks in the maximized window and two tracks in the original narrower window. Did not add members or change group data. Restored the original window size after inspection.
- The real frontend serves the updated CSS; frontend and API/database readiness return HTTP 200. Actual group, membership, invitations and image reads returned HTTP 200.

## Four workflow refinements — 2 November 2026

- Unified owned-list sharing under independent Mes groupes / Lien public tabs; kept dirty group choices across keyboard tab changes and confirmed saves after reloading the real local application. Fixed the close lifecycle so a successful group save dismisses the hub.
- Added the group-member proposal shortcut with current-group multi-list destinations. Created a photo idea in two real local test lists and reloaded each; verified absence in another group, the beneficiary's reading view and their own profile. Edited description/quantity on mobile and confirmed persistence and retained photo after reload.
- Prioritized Modifier on wish details and Inviter un proche on group details, grouping secondary commands in accessible Options disclosures. Opened and cancelled copy/delete/leave dialogs; focus returned to their visible Options trigger.
- Shortened the idea editor with native Précisions, optional extension help, mobile footer and a close control. Observed name/quantity validation, automatic disclosure expansion, invalid-field focus and cancellation without saving.
- Native browser checks: 1440×1000, 390×844 and narrow 320×740 layouts; no horizontal overflow on the changed controls. At 390×480 with a text field focused, the footer uses normal flow. This is browser viewport testing, not a physical phone keyboard test.
- All 5,187 unit/integration tests passed across 222 files, including loading/empty/error destinations, partial and uncertain batch outcomes. Lint, all three type configurations, OpenAPI type verification and Vite build passed. Playwright expectations were updated but its CLI suite was not run; native browser observations provide the UI evidence for this pass.
- Before/after screenshots and review page: `.local/workflow-improvements-20261102/verification-et-comparaison.html`. The actual HTTPS frontend at port 5189 and API/database remain running. Only local fixtures changed; no production deployment.

## Consistent group audience labels — 2 November 2026

- Positive group counts use Partagée avec X groupes in both sharing states; a separate pill shows Lien public actif or Lien public inactif. Existing no-group, loading and failed-read behavior is retained.
- Observed the real public list (two groups) and private list (three groups) at 1440×1000 and 390×844; checked wrapping without horizontal overflow at 320×740. Keyboard navigation still moves from sorting to Partager. Captures are in `.local/audience-labels-20261102/`.
- All 78 affected audience/details tests passed, including singular/plural and independent link states, zero-group results, failed reads and stale responses. Lint, all three type configurations and Vite build passed. No sharing permissions or data were changed.
