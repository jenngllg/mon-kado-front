import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const entryStyles = readStyleFile("../src/styles.css");
const tokens = readStyleFile("../src/styles/tokens.css");
const baseStyles = readStyleFile("../src/styles/base.css");
const layoutStyles = readStyleFile("../src/styles/layout.css");
const componentStyles = readStyleFile("../src/styles/components.css");
const shellStyles = readStyleFile("../src/styles/shell.css");
const viewStyles = readStyleFile("../src/styles/views.css");
const galleryStyles = readStyleFile("../src/styles/wish-gallery.css");
const mockupStyles = readStyleFile("../src/styles/mockup-fidelity.css");
const utilities = readStyleFile("../src/styles/utilities.css");

describe("graphic foundations", () => {
  it("lets field information use the full control width without forcing a single line", () => {
    const information = componentStyles.match(/\.form-field__description--info\s*\{([^}]+)\}/)?.[1];
    expect(information).toContain("max-width: none");
    expect(information).not.toContain("nowrap");
  });
  it("groups overview categories and creation below the title using the shared compact primary control", () => {
    const toolbar = viewStyles.match(/\.wishlists-view__toolbar\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(toolbar).toContain("display: flex");
    expect(toolbar).toContain("align-items: center");
    expect(toolbar).toContain("flex-wrap: wrap");
    expect(toolbar).toContain("gap: var(--space-4)");
    expect(viewStyles).toContain(".wishlists-view__toolbar > .ui-button");
    const button = componentStyles.match(/\.ui-button,\s*\.action-link\.ui-button\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(button).toContain("padding: var(--space-3) min(4vw, var(--space-5))");
    expect(button).toContain("border: 1px solid transparent");
    expect(componentStyles.match(/\.page-primary-action\s*\{([^}]+)\}/)?.[1]).toContain("line-height: 1.25");
    expect(componentStyles).toContain('.action-link:not(.ui-button):not([aria-disabled="true"]):hover { background-color: var(--color-surface-muted); }');
    expect(mockupStyles).not.toContain(".wishlists-view__header > .home-hero__primary-action");
    expect(readStyleFile("../src/styles/site-theme.css")).not.toContain(".wishlists-view__header > .home-hero__primary-action");
  });
  it("shares the unboxed paired-field layout and wrapping footer between list creation and editing", () => {
    const form = mockupStyles.match(/:is\(\.wishlist-create-view, \.wishlist-edit-view\) > \.wishlist-form\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(form).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(form).toContain("var(--space-6) var(--space-7)");
    expect(mockupStyles).toContain(":is(.wishlist-create-view, .wishlist-edit-view) .wishlist-form > * { grid-column: 1 / -1");
    expect(mockupStyles).toContain(".wishlist-form__occasion, .wishlist-form__eventDate) { grid-column: auto");
    expect(mockupStyles).toMatch(/@media \(max-width: 48rem\)[\s\S]*:is\(\.wishlist-create-view, \.wishlist-edit-view\) > \.wishlist-form\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
    expect(mockupStyles).toContain(".wishlist-form__footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap");
    expect(mockupStyles).not.toContain("wishlist-live-preview");
  });
  it("uses one readable wish form column without reserving a missing preview track", () => {
    const layout = mockupStyles.match(/:is\(\.wish-create-view, \.wish-edit-view\)\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(layout).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(mockupStyles).toContain(":is(.wish-create-view, .wish-edit-view) > :is(.wishlist-form, .wish-import) { width: min(100%, var(--content-narrow))");
    expect(mockupStyles).not.toContain("minmax(0, 1.7fr)");
    expect(mockupStyles).not.toContain("max-width: calc(100% - 19rem)");
    expect(mockupStyles).toContain(".wish-create-view > .wish-import { border: 0; padding: 0; }");
    expect(mockupStyles).toContain(".wish-create-view .wish-import > form > :is(p, div):empty { display: none; }");
  });
  it("aligns the account frame with site gutters without widening its readable forms", () => {
    const theme = readStyleFile("../src/styles/site-theme.css");
    const layout = theme.match(/\.profile-layout\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(layout).toContain("width: 100%");
    expect(layout).toContain("max-width: none");
    expect(theme).toContain(".profile-layout .recovery-form { max-width: 42rem; }");
    expect(viewStyles).toMatch(/@media \(max-width: 48rem\)\s*\{\s*\.profile-layout\s*\{[^}]*max-width: none/);
  });
  it("fills the available gallery width with at most four equal tracks and reveals commands without moving content", () => {
    expect(entryStyles).toContain('@import "./styles/wish-gallery.css" layer(components)');
    expect(galleryStyles).toContain("repeat(auto-fill, minmax(var(--wish-gallery-track-min), 1fr))");
    expect(galleryStyles).toContain("--wish-gallery-tile-min-width: 14rem");
    expect(galleryStyles).toContain("calc((100% - 3 * var(--wish-gallery-column-gap)) / 4)");
    expect(galleryStyles).toContain("max-width: none");
    expect(galleryStyles).not.toContain("max-width: 63rem");
    expect(galleryStyles).toContain("--wish-gallery-column-gap: calc(var(--space-4) + 0.625rem)");
    expect(galleryStyles).toContain("gap: calc(var(--space-7) + 0.625rem) var(--wish-gallery-column-gap)");
    const title = galleryStyles.match(/\.wish-gallery__content h3 \.action-link\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(title).toContain("white-space: nowrap");
    expect(title).toContain("text-overflow: ellipsis");
    expect(title).toContain("overflow: hidden");
    const remove = galleryStyles.match(/\.wish-gallery__delete\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(remove).toContain("inset-block-start: var(--space-2)");
    expect(remove).toContain("inset-inline-end: calc(44px + 2 * var(--space-2))");
    expect(galleryStyles).not.toContain("padding-inline-end: 3.25rem");
    expect(galleryStyles).not.toContain("--container-max-width");
    expect(galleryStyles).not.toContain(".app-main");
    expect(galleryStyles).toContain("@media (hover: hover) and (pointer: fine)");
    expect(galleryStyles).toContain(":is(:hover, :focus-within)");
    expect(galleryStyles).toContain(".wish-gallery__delete { opacity: 1; pointer-events: auto; }");
    expect(galleryStyles).not.toContain("wish-gallery__menu");
    expect(galleryStyles).toContain("opacity: 0; pointer-events: none");
    expect(galleryStyles).not.toContain("visibility: hidden");
    const hoverControls = galleryStyles.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]+?)\n\}/)?.[1] ?? "";
    expect(hoverControls).not.toContain("display: none");
    expect(hoverControls).not.toContain("wish-gallery__favorite");
    expect(galleryStyles).toContain("@media (max-width: 18rem)");
    expect(galleryStyles).toContain(".wishlist-details-view--gallery .wish-grid.wish-grid--gallery");
    expect(galleryStyles).toContain(".wishlist-details-view--gallery .wish-card.wish-card--gallery");
    const image = galleryStyles.match(/\.wishlist-details-view--gallery \.wish-card--gallery \.wish-card__media img\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(image).toContain("object-fit: contain");
    expect(image).toContain("border-radius: var(--radius-md)");
    expect(image).toContain("max-width: 100%");
    expect(image).toContain("max-height: 100%");
    const media = galleryStyles.match(/\.wishlist-details-view--gallery \.wish-card--gallery \.wish-card__media\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(media).toContain("border-radius: var(--radius-md)");
    expect(media).toContain("overflow: hidden");
  });
  it("shares image action sizing and keeps destructive icons visible on their light surface", () => {
    expect(viewStyles).toContain(".wish-image-section__media > .icon-action { border-radius: var(--radius-full); background: var(--color-surface); }");
    expect(viewStyles).toContain(".wish-image-section__media > .icon-action--danger { color: var(--color-danger); }");
    const shared = viewStyles.match(/\.wish-image-section__media > \.icon-action\s*\{([^}]+)\}/)?.[1];
    expect(shared).toContain("width: 44px");
    expect(shared).toContain("height: 44px");
  });
  it("keeps owner detail action icons round with accessible touch target sizes", () => {
    const actions = galleryStyles.match(/\.wish-owner-detail__actions \.icon-action\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(actions).toContain("border-radius: var(--radius-full)");
    expect(actions).toContain("width: 44px"); expect(actions).toContain("height: 44px");
  });
  it("groups reading identity and message separately from event details with a mobile stack", () => {
    expect(galleryStyles).toContain(".wishlist-details-view:is(.shared-wishlist-view, .wishlist-details-view--banner) .wishlist-details-layout { grid-template-columns: minmax(0, 1fr); gap: var(--space-5); }");
    const banner = galleryStyles.match(/\.wishlist-details-view:is\(\.shared-wishlist-view, \.wishlist-details-view--banner\) \.wishlist-details-info\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(banner).toContain("min-height: 0");
    expect(banner).toContain("padding-inline: min(4vw, var(--space-7))");
    expect(banner).toContain("background-position: right center");
    expect(galleryStyles).toContain("grid-template-columns: minmax(0, 7fr) minmax(0, 5fr)");
    expect(galleryStyles).toContain("flex-direction: column");
    expect(galleryStyles).toContain("border-inline-start: 1px solid var(--color-border-strong)");
    expect(galleryStyles).toContain(".wishlist-details-view .shared-wishlist-summary { grid-template-columns: minmax(0, 1fr); }");
    expect(galleryStyles).toContain("border-block-start: 1px solid var(--color-border-strong)");
    expect(galleryStyles).toContain(".wishlist-details-view .shared-wishlist-summary:not(:has(> .shared-wishlist-metadata)) { grid-template-columns: minmax(0, 1fr); }");
  });
  it("preserves flow spacing before email-change controls", () => {
    const controls = viewStyles.match(/\.email-change-view__controls\s*\{([^}]+)\}/)?.[1];
    expect(controls).toContain("margin-inline: 0");
    expect(controls).toContain("margin-block-end: 0");
    expect(controls).not.toMatch(/(?:^|\s)margin\s*:/);
    expect(controls).not.toContain("margin-block-start:");
  });
  it("bounds horizontal gutters at enlarged text sizes without reducing body text", () => {
    expect(tokens).toContain("--content-gutter: clamp(min(1rem, 5vw), 4vw, 3.75rem)");
    expect(componentStyles.match(/\.ui-alert\s*\{([^}]+)\}/)?.[1]).toContain("padding-inline: min(var(--space-4), 5vw)");
    const theme = readStyleFile("../src/styles/site-theme.css");
    expect(theme).toContain("font-size: clamp(1.75rem, 3.8vw, 2.5rem)");
  });
  it("separates recovery codes and keeps their confirmation touch accessible", () => {
    expect(componentStyles.match(/\.recovery-codes\s*\{([^}]+)\}/)?.[1]).toContain("gap: var(--space-3)");
    expect(componentStyles.match(/\.recovery-codes li\s*\{([^}]+)\}/)?.[1]).toContain("overflow-wrap: anywhere");
    expect(componentStyles.match(/\.recovery-codes-confirmation\s*\{([^}]+)\}/)?.[1]).toContain("min-height: var(--control-min-size)");
  });
  it("keeps order comparisons readable with enlarged text on narrow screens", () => {
    expect(viewStyles.match(/\.wish-reorder-comparison\s*\{([^}]+)\}/)?.[1]).toContain("padding-inline: min(4vw, var(--space-4))");
    const list = viewStyles.match(/\.wish-reorder-comparison ol\s*\{([^}]+)\}/)?.[1];
    expect(list).toContain("padding-inline-start: 0");
    expect(list).toContain("list-style-position: inside");
  });
  it("leaves room for the sticky header and label when focusing a field", () => {
    expect(componentStyles.match(/\.form-field__control\s*\{([^}]+)\}/)?.[1]).toContain("scroll-margin-block-start: 9rem");
  });
  it("keeps the account avatar and its navigation highlight content-sized", () => {
    const avatar = componentStyles.match(/\.app-navigation__link \.member-avatar\s*\{([^}]+)\}/)?.[1];
    expect(avatar).toContain("width: var(--avatar-size)");
    expect(avatar).toContain("height: var(--avatar-size)");
    expect(avatar).toContain("flex: 0 0 var(--avatar-size)");
    const account = componentStyles.match(/\.app-navigation__link:has\(\.member-avatar\)\s*\{([^}]+)\}/)?.[1];
    expect(account).toContain("width: fit-content");
    expect(account).toContain("max-width: 100%");
  });
  it("aligns overview headings while keeping the search form readable", () => {
    const theme = readStyleFile("../src/styles/site-theme.css");
    const overview = theme.match(/:is\(\.wishlists-view, \.reservation-history-view, \.member-search-view\)\s*\{([^}]+)\}/)?.[1];
    expect(overview).toContain("width: 100%");
    expect(overview).toContain("max-width: none");
    const title = theme.match(/:is\(\.wishlists-view, \.reservation-history-view, \.member-search-view\) h1\s*\{([^}]+)\}/)?.[1];
    expect(title).toContain("margin: 0");
    expect(title).toContain("line-height: 1.15");
    const header = theme.match(/\.wishlists-view__header\s*\{([^}]+)\}/)?.[1];
    expect(header).toContain("min-height: 0");
    expect(header).toContain("padding: 0");
    expect(header).toContain("align-items: flex-start");
    expect(theme).toContain(".member-search-view > :is(form, div) { max-width: 48rem; }");
  });
  it("does not add a second vertical gutter around authentication forms", () => {
    const theme = readStyleFile("../src/styles/site-theme.css");
    const authentication = theme.match(/:is\(\.registration-view[^{}]+\.authenticator-view\)\s*\{([^}]+)\}/)?.[1];
    expect(authentication).toContain("width: min(100%, 36rem)");
    expect(authentication).not.toMatch(/padding(?:-block(?:-start|-end)?)?\s*:/);
  });
  it("preserves the original wordmark and coral dot without a mockup override", () => {
    expect(shellStyles.match(/\.app-brand::after\s*\{([^}]+)\}/)?.[1]).toContain('content: "."');
    expect(shellStyles.match(/\.app-brand::after\s*\{([^}]+)\}/)?.[1]).toContain("var(--color-accent)");
    expect(readStyleFile("../src/styles/mockup-fidelity.css")).not.toMatch(/\.app-brand\b/);
    expect(readStyleFile("../src/styles/site-theme.css")).not.toMatch(/\.app-brand\b/);
  });
  it("keeps all shared confirmation gutters bounded by the viewport with enlarged text", () => {
    const dialog = viewStyles.match(/\.wish-delete-dialog,\s*\.reservation-cancel-dialog,\s*\.wishlist-share-revoke-dialog,\s*\.wishlist-share-renew-dialog\s*\{([^}]+)\}/)?.[1];
    expect(dialog).toContain("width: min(var(--content-narrow), calc(100% - min(var(--space-6), 8vw)))");
    expect(dialog).toContain("padding-inline: min(var(--space-6), 4vw)");
    expect(dialog).toContain("max-width: 100%");
  });
  it("preserves the flow spacing above the reservation editor and wraps its actions", () => {
    const editor = viewStyles.match(/\.reservation-edit-group\s*\{([^}]+)\}/)?.[1];
    expect(editor).toContain("margin-inline: 0");
    expect(editor).not.toMatch(/margin\s*:|margin-block-start\s*:/);
    expect(layoutStyles.match(/\.cluster\s*\{([^}]+)\}/)?.[1]).toContain("flex-wrap: wrap");
    expect(viewStyles.match(/\.wishlist-form__actions\s*\{([^}]+)\}/)?.[1]).toContain("--cluster-space: var(--space-3)");
  });
  it("keeps the availability filter target touch accessible and its long label wrappable", () => {
    expect(viewStyles.match(/\.shared-wishlist-filter\s*\{([^}]+)\}/)?.[1]).toContain("min-block-size: var(--control-min-size)");
    expect(viewStyles.match(/\.shared-wishlist-filter span\s*\{([^}]+)\}/)?.[1]).toContain("overflow-wrap: anywhere");
    expect(viewStyles.match(/\.shared-wishlist-filter input\s*\{([^}]+)\}/)?.[1]).toContain("flex-shrink: 0");
  });
  it("keeps private share URLs bounded and actions wrapping at narrow widths", () => {
    expect(viewStyles.match(/\.wishlist-share textarea\s*\{([^}]+)\}/)?.[1]).toContain("min-inline-size: 0");
    expect(viewStyles.match(/\.wishlist-share__actions\s*\{([^}]+)\}/)?.[1]).toContain("flex-wrap: wrap");
  });
  it("bounds gift image previews and keeps the native file action touch accessible", () => {
    expect(viewStyles).toContain('.wish-image-section__preview img { max-width: 100%;');
    expect(viewStyles.match(/\.wish-image-section input::file-selector-button\s*\{([^}]+)\}/)?.[1]).toContain("min-height: 44px");
    expect(viewStyles.match(/\.wish-image-section input\[type="file"\]\s*\{([^}]+)\}/)?.[1]).toContain("min-width: 0");
  });
  it("loads each stylesheet in the declared cascade order", () => {
    // Arrange
    const expectedImports = [
      "reset.css",
      "tokens.css",
      "base.css",
      "layout.css",
      "components.css",
      "shell.css",
      "views.css",
      "utilities.css",
    ];

    // Act
    const importPositions = expectedImports.map((fileName) =>
      entryStyles.indexOf(fileName));

    // Assert
    expect(importPositions.every((position) => position >= 0)).toBe(true);
    expect(importPositions).toEqual([...importPositions].sort((a, b) => a - b));
  });

  it.each([
    "--color-",
    "--font-",
    "--space-",
    "--radius-",
    "--shadow-",
    "--content-",
  ])("exposes the %s token family", (tokenPrefix) => {
    // Arrange
    const expectedToken = tokenPrefix;

    // Act
    const tokenIsDefined = tokens.includes(expectedToken);

    // Assert
    expect(tokenIsDefined).toBe(true);
  });

  it.each([
    ".container",
    ".flow",
    ".cluster",
    ".responsive-grid",
  ])("provides the %s layout primitive", (className) => {
    // Arrange
    const expectedClass = className;

    // Act
    const classIsDefined = layoutStyles.includes(expectedClass);

    // Assert
    expect(classIsDefined).toBe(true);
  });

  it("provides reduced motion and screen-reader support", () => {
    // Arrange
    const reducedMotionPreference = "prefers-reduced-motion: reduce";
    const visuallyHiddenUtility = ".visually-hidden";

    // Act
    const supportsReducedMotion = baseStyles.includes(reducedMotionPreference);
    const supportsVisuallyHiddenContent = utilities.includes(
      visuallyHiddenUtility,
    );

    // Assert
    expect(supportsReducedMotion).toBe(true);
    expect(supportsVisuallyHiddenContent).toBe(true);
  });

  it.each([
    ".ui-button",
    ".action-link",
    ".form-field",
    ".ui-alert",
    ".empty-state",
    ".loading-state",
    ".notification-region",
  ])("provides the %s component styles", (className) => {
    // Arrange
    const expectedClass = className;

    // Act
    const classIsDefined = componentStyles.includes(expectedClass);

    // Assert
    expect(classIsDefined).toBe(true);
  });

  it("provides the responsive application shell contract", () => {
    // Arrange
    const expectedSelectors = [
      ".skip-link",
      ".app-header",
      ".app-menu-button",
      ".app-navigation",
      ".app-main",
    ];

    // Act
    const selectorsAreDefined = expectedSelectors.every((selector) =>
      shellStyles.includes(selector));

    // Assert
    expect(selectorsAreDefined).toBe(true);
    expect(shellStyles).toContain("@media (min-width: 80rem)");
    expect(readStyleFile("../src/styles/mockup-fidelity.css")).toContain("@media (min-width: 80rem)");
    expect(readStyleFile("../src/styles/mockup-fidelity.css")).toContain("grid-template-columns: clamp(10rem, 15vw, 15rem) minmax(0, 1fr)");
    expect(shellStyles).toContain('data-open="true"');
  });

  it("provides home and placeholder view styles", () => {
    // Arrange
    const expectedSelectors = [
      ".home-hero",
      ".placeholder-view",
      ".error-view",
    ];

    // Act
    const selectorsAreDefined = expectedSelectors.every((selector) =>
      viewStyles.includes(selector));

    // Assert
    expect(selectorsAreDefined).toBe(true);
  });

  it("keeps enlarged text from being squeezed by fixed card and button insets", () => {
    // Arrange / Act
    const placeholder = viewStyles.match(/\.placeholder-view\s*\{([^}]+)\}/)?.[1] ?? "";
    const cards = viewStyles.match(/\.registration-view,\s*\.recovery-view,[^{]+\{([^}]+)\}/)?.[1] ?? "";
    // Assert
    expect(placeholder).toContain("padding-inline: min(7vw, var(--space-8))");
    expect(cards).toContain("padding-inline: min(4vw, var(--space-7))");
    expect(componentStyles).toContain("padding: var(--space-3) min(4vw, var(--space-5))");
  });

  it("keeps list covers unboxed with one, two or four flexible columns and wrapping names", () => {
    // Arrange / Act
    const grid = viewStyles.match(/\.wishlists-grid\s*\{([^}]+)\}/)?.[1] ?? "";
    const card = viewStyles.match(/\.wishlist-card\s*\{([^}]+)\}/)?.[1] ?? "";
    // Assert
    expect(grid).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(viewStyles).toMatch(/@media \(min-width: 36rem\)\s*\{\s*\.wishlists-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    expect(viewStyles).toMatch(/@media \(min-width: 64rem\)\s*\{\s*\.wishlists-grid\s*\{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(card).toContain("overflow-wrap: anywhere");
    expect(card).toContain("min-width: 0");
    expect(card).toContain("background: transparent");
    expect(card).toContain("padding: 0");
    expect(card).toContain("border: 0");
    expect(viewStyles.match(/\.wishlist-card__cover\s*\{([^}]+)\}/)?.[1]).toContain("aspect-ratio: 4 / 5");
    expect(viewStyles).toContain(".wishlist-card__actions .icon-action { border-radius: var(--radius-full); }");
    expect(viewStyles).toContain(".wishlist-card__actions { opacity: 0; pointer-events: none; }");
    expect(viewStyles).toContain(".wishlist-card:focus-within .wishlist-card__actions { opacity: 1; pointer-events: auto; }");
    expect(mockupStyles).not.toContain(".wishlist-card__icon");
    expect(mockupStyles).not.toContain(".wishlists-grid > .wishlist-card");
    expect(viewStyles.match(/\.wishlist-card__suspension\s*\{([^}]+)\}/)?.[1]).toContain("padding-inline: min(4vw, var(--space-4))");
  });
  it("allows native creation fields to shrink at 320px with enlarged text", () => {
    // Arrange / Act
    const field = viewStyles.match(/\.wishlist-form \.form-field\s*\{([^}]+)\}/)?.[1] ?? "";
    const control = viewStyles.match(/\.wishlist-form \.form-field__control\s*\{([^}]+)\}/)?.[1] ?? "";
    // Assert
    expect(field).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(field).toContain("min-width: 0");
    expect(control).toContain("min-width: 0");
    expect(control).toContain("padding-inline: min(3vw, var(--space-4))");
  });
  it("shares the creation card with editing and wraps comparison content and actions", () => {
    expect(viewStyles).toMatch(/\.wishlist-create-view,\s*\.wish-create-view,\s*\.wish-edit-view,\s*\.wishlist-edit-view\s*\{/);
    const comparison = viewStyles.match(/\.wishlist-edit-view__comparison\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(comparison).toContain("overflow-wrap: anywhere");
    expect(comparison).toContain("var(--color-warning-soft)");
    expect(viewStyles).toContain(".wishlist-form__actions > *");
    expect(viewStyles.match(/\.wishlist-edit-view__comparison dd\s*\{([^}]+)\}/)?.[1]).toContain("white-space: pre-wrap");
  });
  it("keeps owner details fluid and gift images stable without changing the public tokens", () => {
    expect(viewStyles.match(/\.wish-grid\s*\{([^}]+)\}/)?.[1]).toContain("minmax(min(100%, 17rem), 1fr)");
    expect(viewStyles.match(/\.wishlist-details-note\s*\{([^}]+)\}/)?.[1]).toContain("white-space: pre-wrap");
    expect(viewStyles.match(/^\.wish-card__media\s*\{([^}]+)\}/m)?.[1]).toContain("aspect-ratio: 4 / 3");
    expect(viewStyles.match(/\.wish-card__media img\s*\{([^}]+)\}/)?.[1]).toContain("object-fit: contain");
    expect(viewStyles).toMatch(/@media \(min-width: 64rem\)\s*\{\s*\.wishlist-details-layout/);
  });
  it("keeps reordering touch interception on the handle only and insertion markers layout-neutral", () => {
    expect(viewStyles.match(/\.wish-reorder-handle\s*\{([^}]+)\}/)?.[1]).toContain("touch-action: none");
    const indicator = viewStyles.match(/\.wish-reorder-after::after\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(indicator).toContain("position: absolute"); expect(indicator).toContain("z-index: 1");
    expect(indicator).toContain("pointer-events: none"); expect(indicator).toContain("background: var(--color-text)");
    expect(viewStyles).toContain(".wish-reorder-before::after { inset-inline-start: calc((var(--wish-gallery-column-gap, 1.625rem) + var(--space-1)) / -2); }");
    expect(viewStyles).toContain(".wish-reorder-after::after { inset-inline-end: calc((var(--wish-gallery-column-gap, 1.625rem) + var(--space-1)) / -2); }");
  });
  it("bounds the native gift modal to the viewport with internal scrolling and token-based presentation", () => {
    const modal = viewStyles.match(/\.wish-delete-dialog,\s*\.reservation-cancel-dialog,\s*\.wishlist-share-revoke-dialog,\s*\.wishlist-share-renew-dialog\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(modal).toContain("width: min(var(--content-narrow), calc(100% - min(var(--space-6), 8vw)))");
    expect(modal).toContain("max-height: calc(100dvh - var(--space-6))");
    expect(modal).toContain("overflow: auto");
    expect(modal).toContain("overscroll-behavior: contain");
    expect(modal).toContain("overflow-wrap: anywhere");
    expect(modal).toContain("background: var(--color-surface)");
    expect(viewStyles).toContain(".wish-delete-dialog::backdrop");
    expect(viewStyles).toContain(".reservation-cancel-dialog::backdrop");
    expect(viewStyles).not.toContain(".wish-edit-view__deletion");
  });
  it("separates deletion from editing and wraps the destructive confirmation at enlarged text sizes", () => {
    expect(viewStyles).not.toContain(".wishlist-edit-view__deletion");
    expect(viewStyles).toContain(".account-deletion-dialog::backdrop");
  });
  it("keeps the import image choice a full tactile target using shared tokens", () => {
    expect(viewStyles.match(/\.wish-import__keep\s*\{([^}]+)\}/)?.[1]).toContain("min-block-size: var(--control-min-size)");
    expect(viewStyles.match(/\.wish-import\s*\{([^}]+)\}/)?.[1]).toContain("var(--color-border)");
    expect(viewStyles.match(/\.wish-import__keep input\s*\{([^}]+)\}/)?.[1]).toContain("accent-color: var(--color-text)");
  });
  it("makes the selected import mode visible without relying on color alone", () => {
    const selected = viewStyles.match(/\.wish-import__modes \[aria-pressed="true"\]\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(selected).toContain("background: var(--color-surface-sage)");
    expect(selected).toContain("color: var(--color-text)");
    expect(selected).toContain("text-decoration: none");
    expect(selected).toContain("font-weight: var(--font-weight-bold)");
  });
  it("shares readable comparison styling between list and gift drafts", () => {
    for (const suffix of ["", " h2", " dt", " dd"]) {
      expect(viewStyles).toContain(`.wish-edit-view__comparison${suffix},\n.wishlist-edit-view__comparison${suffix} {`);
    }
  });
  it("keeps multiline notes and responsive shared details without fixed widths", () => {
    expect(viewStyles).toMatch(/\.wishlist-details-note\s*\{[^}]*white-space:\s*pre-wrap/);
    expect(viewStyles).toMatch(/\.shared-wish-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(viewStyles).toMatch(/@media \(min-width: 48rem\)\s*\{\s*\.shared-wish-layout/);
  });
});

/**
 * @param {string} relativePath Path relative to this test file.
 * @returns {string} Stylesheet contents.
 */
function readStyleFile(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}
