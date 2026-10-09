# Design QA — Fondations graphiques MonKado

## 2026-10-09 — Reservation status and cancellation refinement

- Latest modal adjustment: reducing to 32rem caused the desktop buttons to wrap (P2). Increased only to 33rem (528 px) while keeping left alignment and unchanged button sizes. `test-results/reservation-design/cancel-inline-final.png` confirms both controls on the same row, each top at 463.984375 px. Responsive wrapping remains enabled on narrow screens. This supersedes the earlier 36rem modal-size evidence.

- Modal-size refinement: cancellation width is now capped at 36rem rather than the common 42rem, with tighter responsive padding. Browser evidence `test-results/reservation-design/cancel-compact-final.png` measures 576 px wide; the named question wraps naturally and both centered actions remain visible. 77 targeted style/dialog tests pass. Mobile width/scroll constraints are preserved from the common modal rule; no fresh mobile capture for this size-only follow-up.

- Confirmation-copy follow-up: user-provided annotated modal is the visual source for removing explanatory prose, suppressing quantity for one item and centering actions. Browser capture `test-results/reservation-design/cancel-single-final.png` confirms the named question and centered two-button group without intermediate prose. The browser's multi-item dialog shows only “Quantité réservée : 2.”; no real cancellation was submitted. 98 targeted tests, affected lint and typecheck pass; confirmation lifecycle is unchanged.

- Latest vertical balance correction supersedes top alignment: the user requested equal space above/below each right-hand group. `align-self: center` preserves the shared horizontal track. Post-fix capture: `test-results/reservation-design/balanced-final.png`; active top/bottom gaps 28.40625/28.421875 px (subpixel rounding), unavailable 29.015625/29.015625 px. Both groups retain left edge 672.265625 px. 86 targeted tests passed; no remaining vertical-balance finding.

- Follow-up alignment correction: independent intrinsic right tracks shifted the active/unavailable groups, a P2 inconsistency reported by the user. Replaced with a shared compact 12rem track and top alignment. Post-fix evidence: `test-results/reservation-design/aligned-final.png`; both status left edges and date left edges measure 672.265625 px, and their card-relative vertical offsets are respectively 17 px and 58.59375 px for both rows. This latest user instruction supersedes the content-sized track description below. The focused screenshot supplied by the user and the new two-row capture show consistent grouping, with no separate action track. 86 targeted style/view tests pass.

- Source: `C:/Users/Jenn/.codex/generated_images/01a0718e-0d03-7b82-8d1e-7ce8ef19c56d/exec-b8a1860b-9ac9-4e91-a3b5-5d06bd960724.png`, superseded by user instructions to remove right-side whitespace and make the information icon non-button.
- Render: `test-results/reservation-design/refined-final.png`; paired full-view comparison: `refinement-comparison.png`. Source 1536 × 1024; implementation 933 × 892 at default browser sizing, CSS viewport 933 px wide. Images are aspect-preserving downscaled into adjacent 900 px panels, not used for pixel-perfect measurement. Source and rendered states both include one active and one unavailable reservation with the information bubble open. Header/footer and contained fictional photographs intentionally reuse the existing site/harness rather than the generated mock's revised framing. Right-column alignment is judged against the user's later annotation, not the mock's unwanted empty track.
- Focused evidence: the entire two-row render makes the status, icon, dates and button readable; measured right gaps are 17 px on both rows (normal 16 px padding plus border), with no action track. Tooltip bounds 544–864 px are inside the viewport. A separate focus crop is unnecessary for these readable controls.
- Typography: existing locally bundled Nunito Sans and body tokens retained. Spacing: three tracks, last track content-sized; square contained media; cancellation below dates, aligned with the status. Colors: active sage, unavailable pale yellow, cancelled coral, primary coral/white cancellation. Assets: existing information-circle asset, no generated production image. Copy: possible loss of sharing/public access is explained without inventing a known cause; no bottom note.
- Earlier P2 finding: at 320 px with root text 200%, the status word broke into fragments. Fix: allow the status/icon row to wrap and bound pill padding; follow-up screenshot confirms “Indisponible” stays whole. Tooltip padding also adapts to narrow viewports. No horizontal page overflow (scroll width 305 px within 320 px viewport before the padding refinement).
- Interactions: keyboard focus opens information, Escape dismisses; pointer enter/leave covered by unit tests. Icon is not a button and has no click action. Cancellation opens the existing confirmation; Escape restores its trigger. No live account mutations were performed. Browser console errors: none in the controlled demo.
- Validation: 149 targeted tests, affected lint and application typecheck passed. No screen reader test or WCAG certification claimed. Hover-only interaction was not separately exercised by native mouse movement; its listeners are covered in Happy DOM.
- No outstanding P0–P2 findings for this scoped refinement. Production data/contracts and eligibility are unchanged; temporary fixtures/captures remain ignored.
- final result: passed

## 2026-10-09 — Selected reservation history concept

- Source visual truth: `C:/Users/Jenn/.codex/generated_images/01a0718e-0d03-7b82-8d1e-7ce8ef19c56d/exec-9b469059-2559-409d-8336-38c1c64651a0.png` (second displayed concept).
- Implementation evidence: `test-results/reservation-design/desktop.png`, `comparison.png`, `focus.png`, `mobile.png`, `320.png`, `tablet.png`, `text200.png`. These temporary captures and fixtures are ignored, not production data or assets.
- Desktop viewport: 1487 × 1058 CSS pixels. Source pixels: 1487 × 1058; captured content: 1472 × 1047, excluding the browser scrollbar/capture edge. Full comparison preserves aspect ratios in two 892 × 635 regions; the focus comparison pairs first-row information crops. No browser chrome is compared.
- State: three fictional reservations (two active, one cancelled); source photograph crops are used only in the temporary QA harness. Production continues to use API-provided images, names, links and quantities. Existing header, date abbreviation and shared 44px trash control are intentionally retained instead of introducing mock-only header/avatar changes.

### Findings and comparison history

1. [P2, fixed] Initial information hierarchy used undersized wish titles and bold metadata links, with too much horizontal distance before status. Increased titles to 1.75rem, restored quiet inline metadata and widened the status/date track. Final `comparison.png` and `focus.png` show the corrected hierarchy.
2. [P2, fixed] At 768px with root text enlarged to 200%, viewport-only breakpoints squeezed the title into arbitrary word fragments. Added an inline-size container query measured in rem, and proportional circular action dimensions. The post-fix `text200.png` and DOM bounds show stacked content without overflow, also checked at 320px/200%.
3. Fonts/typography: existing bundled Nunito Sans and site heading scale retained; titles, quantities and status have distinct weights. Metadata uses normal readable text. Date formatting intentionally remains the existing French abbreviated calendar format.
4. Spacing/layout: large contained media on the left, description in the middle, status/dates together on the right, cancellation upper right; quiet border/radius and no shadows. Tablet and mobile stack without dropping information.
5. Colors/tokens: existing ivory, forest, sage and semantic muted/warning surfaces; statuses are textual, never color-only. Shared focus outlines and destructive icon styling preserved.
6. Images/assets: production retains real images with `object-fit: contain`, decorative empty alternatives and existing cleanup/recovery behavior. No generated image or source crop was added to production assets. Header/icons use existing assets/components.
7. Copy/content: supported quantity, list/member, status and lifecycle dates preserved. `Statut :` remains available to assistive technology without duplicating the visible pill. No extra counts, prices or unsupported actions.

### Interaction and validation evidence

- In-app Chromium: selected active/cancelled filters, checked empty/unavailable states, opened the real cancellation component with fake operations, dismissed with Escape and verified focus returns to its trigger. Unavailable items have no shared-wish links or cancellation controls.
- Viewports: desktop 1487×1058, tablet 768×1024, mobile 360×800 and 320×800; text 200% at 768px and 320px. No horizontal overflow in DOM bounds; normal cancellation targets 44×44px. No captured browser console errors.
- Lint and all three TypeScript configurations passed; production build passed (existing >500kB chunk warning remains). All 169 unit-test files passed: 4,337 tests, including the new DOM grouping/accessible-label regression and existing cancellation/filter/session tests.
- Real-account history remains empty; populated browser evidence is controlled simulation, not a backend reservation mutation. No screen reader or production certification claimed.
- Follow-up polish: none required for this selected layout. Site-wide typography/header and date format remain intentionally consistent with sibling pages.

final result: passed

## Current pass — Remaining site theme

Scope: extend the original mockup charter to home, authentication, account settings, reservation history, public/shared lists, shared wish reservation and legal documents. This is a visual harmonization of existing capabilities, not implementation of every feature depicted in the mockups. Historical reports follow unchanged.

### Visual truth and evidence

- Source directory: `C:/Users/Jenn/source/repos/mon-kado/prototypes/wishlist-site/design/mockups/`.
- Direct sources: `03-shared-wishlist-selected-concept.png`, `06-reservations-overview.png`, `09-reserve-gift.png`. Sources 05 and 07 provide shared surface, form and navigation styling for routes without a dedicated mockup. Comparing login with 07 evaluates its design language, not an identical screen or content state.
- Evidence directory: `C:/Users/Jenn/source/repos/mon-kado/TestResults/MK938/`. Reproducible harness: `site-theme-qa.mjs`; actual components, isolated Chromium, fixture services. No real account writes or user-session changes.
- Source and desktop capture: 1487 × 1058 pixels, viewport 1487 × 1058 CSS pixels, deviceScaleFactor 1. Final desktop captures take the first 1058 pixels of a full-page screenshot to avoid transient Chromium viewport capture artifacts. Fonts and images are decoded before capture.
- Baselines: `theme-before-{home,login,register,recovery,profile,password,email,privacy,history,shared,reservation}-desktop.png` and `theme-before-compare-{shared,history,reservation,login,profile}.png`.
- Final captures: `theme-after-{home,login,register,recovery,profile,password,email,privacy,history,history-empty,history-error,history-loading,shared,reservation}-desktop.png`. Legal pages: `theme-after-{legal-notice,privacy-policy,terms-of-use}-desktop.png`.
- Full comparisons: `theme-after-compare-{shared,history,reservation,login,profile}.png`, each 1488 × 529 pixels containing equally scaled source and implementation in one image.
- Focus comparisons: `theme-after-focus-{shared,history,reservation,login,profile}.png`; additional correctly positioned form/sidebar/panel crops in `theme-after-controls-{login,profile,reservation}.png`. These pair unscaled source and implementation regions for typography, controls and image treatment.
- Responsive captures: each application screen at widths 1024, 768, 390 and 320, viewport height 844, full-page PNGs named `theme-after-{screen}-{width}.png`. Legal pages also at 320. No supplied mobile reference: these check responsive usability, not pixel matching to an invented mobile mockup.
- Error focus screenshots: `theme-after-login-invalid-320.png`, `theme-after-reservation-invalid-320.png`.

### Findings and comparison history

1. **[P1, fixed] Reservation history inherited illustrated wishlist styling.** The baseline comparison with 06 showed text spread across two-column image-card tracks despite no history images. Dedicated `.reservation-history-list` rows and explicit description/status/date groups restore a scannable horizontal composition. Final history comparison and 390px capture verify the fix; a regression test prohibits reuse of the wishlist grid.
2. **[P1, fixed] Shared detail placed the reservation below an oversized product/details row.** Baseline 09 comparison showed its primary action below the product. The final `.shared-wish-results` grid places the real reservation panel beside product information and stacks it below at narrow widths. Final full comparison, panel crop and invalid-quantity mobile capture verify layout and validation focus.
3. **[P2, fixed] Authentication/account panels retained heavy shadows and coral top edges.** Original 05/07 use flat ivory pages and quiet sage panels. Removed enclosing form cards, kept readable field widths, and applied sage account navigation without tall content minimum heights. Login/profile paired comparisons plus registration tablet and password mobile captures verify it.
4. **[P2, fixed] Shared browsing used vertical image cards instead of horizontal image/content cards.** The 03 comparison drove the horizontal two-column desktop grid and sage context sidebar. A first revision letterboxed imagery; final shared cards use cover crops while the product detail retains contain to show the full item. Images are actual service data in the app; source crops exist only in QA fixtures.
5. **[P2, fixed] Anonymous desktop navigation was centered by member-specific margins.** The second pass moves public navigation to the right; final login/home captures verify it without changing member navigation.
6. **[P2, fixed] Empty history retained a large filled sage box.** State inspection found the old empty-state treatment inconsistent with the quiet page surfaces. Empty states now use simple left-aligned text without a surrounding panel. Final `theme-after-history-empty-390.png` is the post-fix evidence.

The first comparison was blocked by findings 1–4. After their fixes, the second visual inspection found 5–6 and the image letterboxing issue. Final captures were regenerated and inspected after those corrections. The old four-screen harness was also rerun to check the existing list layouts and key interactions.

### Required fidelity surfaces

- **Typography:** existing Nunito Sans, forest headings, serif brand; consistent responsive heading scale and 16px form text. Existing Google brand button typography remains provider-specific. Readable wrapping at 320px; focus remains visible in validation states.
- **Spacing/layout:** original sidebar, horizontal card and two-column reservation patterns; common page gutters, flat forms, compact account content and consistent radii. Mobile stacks without horizontal overflow at all tested widths.
- **Colors/tokens:** ivory background, forest text, coral primary actions and sage contextual panels reuse existing tokens. Danger/warning/validation colors retain semantic meaning; legal publication warnings are preserved.
- **Image quality:** reused original botanical assets, no new generated imagery, fake avatars or CSS illustration substitutes. Product fixtures are smaller crops of original mockups and are not production data. Shared-card cover cropping is intentional; detail images remain uncropped. No missing-image errors in the final fixture capture.
- **Copy/content:** business copy and authorization-sensitive quantities remain real and unchanged. No additional marketing/helper text was introduced. Existing shortened labels and icon actions remain intact. Legal content and draft notices are unmodified.

### Intentional differences and limits

- There are no dedicated original login, home, profile or legal mockups in this source set: they use the common charter, not a claimed pixel-exact reconstruction.
- History API does not provide images or an authorized return link to a list. No fictional photos or reconstructed sharing URLs were added. Existing four-status filter and explicit apply behavior remain; the mockup's three grouped tabs are not a new API contract.
- Shared browsing retains the site's header/footer, availability controls and real quantities, so vertical density differs from 03. The owner portrait and mockup-only counts are not fabricated.
- Reservation panel preserves existing lookup, validation and mutation behavior. Mockup-only metadata and features are not added. This pass does not claim removal of existing refresh/retry controls or a new authentication flow.
- No live OAuth, email delivery, export, deletion, account mutation or real reservation was exercised. Admin authenticator and every transient Google/confirmation state were not individually browser-captured; they inherit common view rules and their existing tests pass.

### Verification and checklist

- [x] 17 representative screen/states captured; 14 application variants at five widths, three static legal documents at desktop/320.
- [x] Mobile menu open/close, history filter application, shared availability filter, profile draft/cancel, invalid login and reservation quantity tested in the isolated browser.
- [x] No page errors or horizontal overflow detected. Full-page and focused paired images visually inspected; validation, empty, error, disabled and loading states sampled.
- [x] Previous list overview/detail/create/wish harness passed at five widths, including menu Escape, share-panel focus, live preview and automatic URL import.
- [x] 3360 tests / 130 files passed; TypeScript, ESLint and production build passed.
- [x] `DESIGN_SYSTEM.md` updated with reusable route patterns and constraints for future screens.

No actionable P0/P1/P2 visual issue remains in this harmonization scope. Broader feature/copy changes are explicitly outside the claim above.

**final result: passed**

## Previous pass — Original mockup restoration (2026-09-28)

This pass supersedes the earlier charter adaptation below. The original mockups are visual source of truth, not inspiration. Scope: owned-list overview, owner detail, list creation and wish creation. This is visual restoration of existing capabilities, not a claim that every feature depicted in the mockups is implemented.

### Source and comparison evidence

- Source directory: C:/Users/Jenn/source/repos/mon-kado/prototypes/wishlist-site/design/mockups/.
- Sources: 04-lists-overview.png, 05-wishlist-management.png, 07-create-wishlist.png, 08-add-gift.png; each 1487 × 1058 px.
- Evidence directory: C:/Users/Jenn/source/repos/mon-kado/TestResults/MK938/.
- Rendered screenshots: fidelity-{lists,detail,create,wish}-desktop.png; viewport 1487 × 1058 CSS px, deviceScaleFactor 1, image 1487 × 1058 px.
- Full-view comparisons: fidelity-comparison-{lists,detail,create,wish}.png. Each combines the reference and rendered result in the same image, equally scaled to half width. Focus comparisons: fidelity-focus-{lists,detail,create,wish}.png, paired 1:1 crops for text, controls and imagery.
- Responsive screenshots: fidelity-{lists,detail,create,wish}-{1024,768,390,320}.png, height 844 CSS px with full-page capture. There are no supplied mobile mockups; these verify readable reflow rather than mobile pixel fidelity.
- Same reference list/wish names and source product imagery in an isolated test browser, using actual production components and fake services. Date of the creation fixture is 2027 to remain valid. No user session or records were changed. Product pictures in fixtures are cropped from the source for comparison only, never inserted into real wishes.

### Findings and correction history

1. P1: the earlier compact, image-free overview and centered one-column creation forms discarded the original composition. Restored split illustrated overview cards, unboxed creation form plus live preview, and form/image columns for wish import.
2. P1: owner settings were absent as a right-hand region. Restored the sage settings panel and independent wish rows; retained the user's explicitly requested top-right actions and three icon controls.
3. P2: initial extracted botanical artwork contained a sliver of source text and a visible rectangular background. Recropped below the text and isolated the artwork from the background; latest comparisons show foliage without source text or a rectangular patch.
4. P2: first mobile overview capture allowed decorative foliage to overlap the main action. Suppressed this decoration on narrow screens, then recaptured all four screens at all five widths.
5. P2: wish metadata initially remained stacked despite the reference's horizontal grouping. Restored information, quantity and price columns on desktop, with a readable stacked mobile layout. Icons remain top right as requested.

### Required fidelity surfaces

- Typography: local Nunito Sans retained; serif brand treatment and source leaf restored. Display headings, card headings, labels and controls checked in full-size focused comparisons. Editable text is actual DOM content, never a screenshot of a page.
- Layout: overview cover/text split, two-column grid, reference-sized card surfaces, right-hand settings, creation preview and import image column restored. Long real names wrap; 44-pixel action targets preserved. At narrow widths columns stack without horizontal overflow.
- Colors: ivory, forest text, coral actions and sage panels retained. Existing accessible dark button labels and strong keyboard focus are intentionally retained instead of lower-contrast reference labels. No action text underlines were reintroduced.
- Images: cover and icon artwork comes from the original supplied images; source foliage isolated and reused. Product images still use the real import/user workflow and contain sizing. The creation preview uses decorative occasion artwork, not a fabricated account portrait.
- Copy: user's shorter labels, souhait terminology, one creation entry point and two-second automatic import retained. No removed explanatory text or analysis button was restored.

### Explicit capability differences — not implemented in this pass

- Existing API does not provide list recipient/profile portrait, overview wish counts/share status/update date, merchant offers, size/color options, or a configurable surprise mode. Those are not fabricated or made into nonfunctional controls. Their absence changes content density; full feature parity with the images remains unimplemented.
- Sharing uses the actual tokenized URL and existing creation/renewal/revocation workflow rather than the short sample URL. Public footer and account/logout navigation remain available as requested. The existing navigation labels are preserved.
- Reservation/shared browsing screens were not redesigned in this four-screen pass. No claim of whole-site visual completion.

### Verification

- Isolated Chromium: list action menu opens and closes with Escape; Share focuses the settings panel; creation preview updates as the name/date/occasion change; URL import applies metadata and displays the returned image automatically.
- All five viewport widths: no horizontal overflow. No browser page errors.
- 3,359 unit/integration tests pass across 130 files. Type checking, lint and production build pass. No production deployment.
- Charter and repository UI instructions now require source fidelity, with user-requested refinements taking precedence. Follow-up: implement missing capabilities only with a separate agreed scope; do not misrepresent this visual pass as their implementation.

final result: passed

---

Historical reports below are retained for traceability; their adaptation rationale is superseded by the current pass.

## Références et état comparé

- Source visuelle : `../mon-kado/prototypes/wishlist-site/design/mockups/03-shared-wishlist-selected-concept.png`
- Capture de l’implémentation : `mk854-desktop.png`, capture temporaire du navigateur non versionnée
- Source : 1487 × 1058 px
- Implémentation : viewport et capture 1440 × 900 px, densité 1
- État : écran de démarrage avec une configuration API valide
- Comparaison combinée : `mk854-comparison.png`, artefact temporaire non versionné

Les deux captures ne représentent volontairement pas le même écran fonctionnel :
cette US transpose uniquement les fondations graphiques de la maquette sur
l’écran de démarrage existant.

## Comparaison générale

La typographie Nunito Sans, le fond ivoire, la surface claire, le texte vert
forêt, l’accent corail, le rayon et l’ombre légère reprennent le langage visuel
de la maquette. La hiérarchie reste lisible sans introduire de navigation, de
composant métier ou d’asset du prototype.

## Surfaces de fidélité

- Typographie : Nunito Sans Variable est chargée localement ; les graisses,
  interlignages et tailles fluides produisent une hiérarchie proche de la
  référence, sans synthèse de police.
- Espacement et mise en page : la carte conserve un rythme généreux et reste
  centrée. Les contrôles à 320, 360, 768 et 1440 px ne montrent aucun
  débordement horizontal.
- Couleurs et tokens : l’ivoire, le sauge, le vert forêt et le corail sont
  cohérents avec la maquette et centralisés dans les tokens sémantiques.
- Images : aucune image n’est attendue dans l’écran socle et aucun asset de la
  maquette n’a été copié ou remplacé par un dessin CSS.
- Contenu : les textes techniques existants sont conservés et restent lisibles
  dans les états normal et erreur.

Une comparaison focalisée supplémentaire n’est pas nécessaire : la surface
livrée ne contient qu’un bloc typographique et ses détails restent lisibles dans
la comparaison générale.

## Responsive, accessibilité et comportement

- Viewports vérifiés : 320 × 800, 360 × 800, 768 × 1024 et 1440 × 900.
- L’état d’erreur de configuration a été vérifié à 360 × 800.
- Les styles reposent sur des unités relatives, des dimensions fluides et une
  largeur minimale de 320 px ; le stress test à la largeur minimale conserve
  tout le contenu visible.
- Le zoom navigateur n’est pas pilotable par l’outil de capture ; sa résilience
  est couverte par les unités `rem`, le retour à la ligne et le test à 320 px.
- La réduction des mouvements et le focus visible sont définis dans le socle.
- L’écran ne contient encore aucun contrôle interactif à tester au clavier.
- Aucun avertissement ni erreur n’a été relevé dans la console.

## Findings

Aucun écart P0, P1 ou P2 n’a été identifié dans le périmètre de cette US.

## Comparison history

La première comparaison n’a révélé aucun écart nécessitant une itération P0,
P1 ou P2. La ligne décorative initiale a été remplacée avant la capture finale
par une bordure sémantique, afin de conserver l’accent visuel sans fabriquer un
asset en CSS.

## Follow-up polish

- [P3] Réévaluer la largeur maximale de l’écran socle lorsque le véritable shell
  applicatif sera développé.

final result: passed

## 2026-09-27 — Lists and durable interface charter

### Scope and visual truth

Reference files: `C:/Users/Jenn/source/repos/mon-kado/prototypes/wishlist-site/design/mockups/04-lists-overview.png` and `05-wishlist-management.png` (1487 × 1058).

This is a charter adaptation, not an exact clone. The user's subsequent decisions supersede the mockups: compact cards, no redundant opening link, no permanent sharing sidebar, actions at the upper right, short copy, “souhaits”, and commands without underlines. `DESIGN_SYSTEM.md` records these decisions for existing and future screens.

Browser evidence lives in `C:/Users/Jenn/source/repos/mon-kado/TestResults/MK938/`:

- `charter-lists-desktop.png` and `charter-detail-desktop.png`: 1487 × 1058 CSS/pixels, density 1.
- `charter-comparison-lists.png` and `charter-comparison-detail.png`: reference left, implementation right, both uniformly reduced to half width in a single comparison capture.
- `charter-detail-320.png`, `charter-detail-390.png` and `charter-lists-mobile.png`: mobile and contextual-menu checks, density 1.
- Reproducible capture harness: `charter-qa.mjs`, outside the frontend checkout.

State: synthetic four-list overview and three-wish populated detail, including a real prototype product photo and long/missing-image cases. The harness mounts real components with fake services in an isolated browser; it does not create real records, use private account sessions or change API behaviour. The anonymous outer shell and absent API fields differ from the historical mockups and are not an authenticated-shell fidelity claim.

### Required fidelity surfaces

- Typography: retained locally bundled Nunito Sans and token hierarchy. Desktop title/action hierarchy is clear; mobile long titles now use the available width.
- Spacing/layout: retained two-column overview; compact cards intentionally omit mockup-only data and covers. Owner detail uses full-width horizontal rows, thin borders and modest shadows. Actions group at the upper right and wrap on mobile.
- Colors/tokens: existing ivory/forest/coral palette preserved; sage is an accent, not a large empty surface. Shared commands explicitly avoid underlines in all states.
- Images: actual product images use contain sizing, without stretching. No stock list cover, avatar, decorative branch, merchant, count or sharing state is fabricated. Missing-image state remains explicit. These are intentional capability/content differences, not missing generated artwork.
- Copy/content: “souhaits” replaces entity labels; concise copy, explicit accessible action names and useful validation are preserved. The active import mode uses bold weight plus its surface and accessible pressed state, not an underline.

### Comparison history and findings

1. Initial desktop comparison: visual language and grouped actions matched the revised charter, with documented intentional differences from the historical mockups.
2. [P2, fixed] At 320px, a side-by-side thumbnail compressed a long wish title into an excessively narrow column. Changed narrow owner rows to one column with a small image above the full-width content.
3. Captured the revised desktop and 320/390px views again. Inspected the combined desktop comparison and full-size mobile capture: long words and titles are legible; no horizontal overflow. Full-size mobile inspection supplies the focused typography/layout check; no additional cropped comparison was necessary for the controls visible at this scale.

### Verification and limits

- Sharing disclosure opens; Escape closes it. List contextual actions remain reachable. Existing route/mutation/authorization tests remain unchanged in behaviour.
- Browser page errors: none in the isolated rendering checks. These are not an end-to-end production/API validation.
- 3,348 tests pass, including charter regression tests. Type checking passes.
- No production deployment, new feature, new data field or backend change.
- Existing shared/public browsing grids remain supported; this pass does not claim every application route was visually re-audited.

final result: passed
