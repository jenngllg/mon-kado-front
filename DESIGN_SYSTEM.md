# MonKado — interface reference

This charter applies to existing screens and all future interface work. It extends the existing tokens and components; it does not introduce a new theme or change API behaviour.

## Sources and precedence

Visual references in the backend repository: `prototypes/wishlist-site/design/mockups/04-lists-overview.png`, `05-wishlist-management.png`, `07-create-wishlist.png`, `08-add-gift.png` and `03-shared-wishlist-selected-concept.png`.

Priority: explicit user decisions, original mockups, then this charter and shared components/tokens. Reproduce the mockups' composition, illustrations, typography, surfaces and proportions; do not reinterpret them as merely inspiration. Preserve explicitly requested copy/action changes and never fabricate personal data or unsupported functionality.

## Visual language

- Keep the user-selected original wordmark: **MonKado.** in bold Nunito Sans with a coral terminal dot, as defined in `shell.css`. No botanical mark or serif replacement, including on future screens and legal pages.
- Use `src/styles/tokens.css`: ivory background, clear surfaces, forest-green text, coral primary actions and restrained sage accents. Never invent per-screen palettes.
- Use the locally bundled Nunito Sans, existing weight/size tokens and the spacing scale. Reserve display-size headings for overview pages; forms and sections use smaller headings.
- Use thin borders, modest radii and light shadows. Avoid large coloured empty blocks and oversized minimum heights.
- Reuse actual user images without stretching or cropping product details. List cover artwork is decorative and comes from the original mockups, selected by occasion. Never substitute it for a user's product image or invent sharing states, counts or owners absent from the API.

## Navigation and actions

- Successful e-mail and Google sign-in always open the authenticated member's own “Mes listes”, including sign-in reached from another page. Do not restore a previously requested page after successful authentication.
- Desktop: title and metadata on the left, primary page actions on the upper right. On mobile, wrap below the title without overflow or reducing touch targets below 44 pixels.
- Overview pages (lists, reservations and member search) share the same heading origin, typography and top gutter. Constrain readable forms below the heading rather than centring the entire page in a narrower column; do not add a title-only inset or vertical centring.
- One primary coral action per action group. Secondary actions use quiet outlined or neutral controls. Destructive actions stay in a contextual menu and retain the existing confirmation flow.
- Page and section toolbars place secondary controls on the right. Do not scatter edit actions underneath unrelated content.
- Do not add “Actualiser” buttons or replace them with routine “Réessayer” buttons. Load fresh data on navigation and after mutations; read-only panels may refresh when returning to the window, without replacing drafts, interrupting a dialog, stealing focus or replaying a mutation.
- Never underline buttons, navigation, tabs, category labels or action links, including hover, focus and selected states. Use a surface, border and visible focus outline. Prose hyperlinks may remain underlined.
- Use native links for navigation and buttons for commands. Visual treatment must not change semantics. Keep accessible labels for icon-only controls, keyboard activation and Escape dismissal for disclosures.
- Return arrows belong to actual navigation, not switching account categories. Account navigation remains on the left across categories.
- Public legal documents share the application tokens, typography, return-arrow styling and footer. Keep them readable and navigable without JavaScript or authentication; never remove publication-review warnings as part of a visual cleanup.

## Lists and wishes

- Call list entries **souhaits**, not **cadeaux**. Gift-related marketing text may retain cadeaux.
- Owner (including archived) and shared wish sections use an immediate native “Trier par” selector in the right-aligned section toolbar. Keep the choice in the URL, preserve it when returning from a wish, and sort a copy of the complete displayed collection. Default to manual list order; hide manual reordering while another display sort is selected. Hide availability sorts when the API masks reservation quantities. Controls wrap without overlap on mobile.
- Owner favorites are multiple “coups de cœur”, never visitor bookmarks, and never change manual wish ordering. Owner cards use a 44-pixel outlined heart command, filled coral when selected, saved directly with a fresh ETag and no conflict retry; do not duplicate this heart beside the title when the command is present. Creation/editing use a “Coup de cœur” choice after quantity and before the image, saved only with the form. URL imports preserve this choice. Shared and read-only views show a noninteractive filled heart beside the title.
- Display prices only when provided, including zero. Omit missing-price placeholders and empty price rows in cards, details and confirmations.
- “Mes listes”: two-column illustrated cards, cover on the left and information on the right, matching mockup 04. The title link opens the card through its stretched hit area. No redundant “Ouvrir” action. Contextual actions belong in the upper-right corner, outside the opening link.
- Owner detail: title, occasion and date above wish rows on the left, sage settings panel on the right as in mockup 05. Align four compact icon actions to the right of the title: plus (add wish), pencil (edit), trash (delete with existing confirmation), archive (or restore). No large add button or disclosure menu on this detail; retain accessible names, hover labels and 44-pixel targets. Wrap below the title on narrow screens. Sharing actions belong only in the settings panel; do not duplicate them with a “Partager” shortcut. On mobile, settings follow the wishes.
- An active share link makes the list public. Directly below that link, show five 44-pixel icon actions: WhatsApp, Facebook, Discord, Messenger and mail. Use unchanged locally served official channel marks and a generic envelope, with accessible names and hover labels. Never create or renew a link by clicking a channel. Discord/Messenger copy the message then open the application; mail opens the user's composer. Hide channel actions when sharing is absent, archived, suspended or uncertain; never claim a message was sent.
- List creation: unboxed form on the left and live sage preview on the right, matching mockup 07; only existing editable data are shown. Wish creation: form on the left, actual imported image on the right, matching mockup 08. Do not reintroduce the explicitly removed analysis button or duplicate product URL.
- Owner wishes use horizontal rows on desktop, with the real image, information and right-aligned actions; stack actions on small screens. Public browsing may retain an image-card grid for discoverability.
- Owner wish actions use the same square 44-pixel icon controls and thin visible borders as list-detail and reservation actions (view, edit, delete), with accessible names, hover labels and no movement on hover. Keep destructive icons red. Direct deletion is an exception to contextual destructive actions and must open the existing confirmation dialog before any mutation.
- Empty state: one short line, without filler copy or a large coloured panel. Keep an obvious add action available to the owner.
- “Ajouter un souhait” opens the single creation page directly, without an intermediate menu; manual entry and URL import are available on that page.
- Never reveal reservation information to owners through a visual redesign. Preserve suspended/read-only states and existing authorization checks.

## Forms and copy

- The mode-surprise explanation lives in a tooltip beside its label, on a small circled information icon. Reveal it on hover, keyboard focus or touch activation; Escape dismisses it without changing the switch.
- Prefer concise labels and actionable errors. Do not add obvious helper text or duplicate a heading, current context or legal links.
- Across the site, never add “Annuler les modifications” buttons. Save buttons previously labelled “Enregistrer les modifications” use “Enregistrer”, including conflict states. Preserve explicit conflict-resolution controls and cancellation of destructive confirmations.
- Wish editing uses “Enregistrer” for the save action and no “Annuler les modifications” button. Keep the return arrow and explicit conflict-resolution controls.
- List editing also uses “Enregistrer”, without an “Annuler les modifications” button or a deletion section. List deletion stays in the list's contextual actions.
- Required fields have an asterisk and native required semantics; optional labels do not say “facultatif”.
- Use inline password-eye controls with accessible names, consistent field heights and aligned trailing icons.
- URL import starts after two seconds of inactivity on a valid URL. Cancel obsolete work on editing, switching mode or disposal; do not automatically create a wish or overwrite a draft.
- Wish creation always shows one optional product-link field, without manual/link tabs or explanatory text. While retrieving product data, show only a spinner with an accessible label. An empty link still allows manual creation.
- Retain necessary validation, security warnings, legal information and accessible status announcements.
- Profile photos use circular previews and avatars. Before uploading, offer local zoom and positioning (pointer and keyboard controls); save the selected square crop, not the original framing. Keep product images unaffected.
- Image replacement stays local until the page's save action, placed below the image editor. Validating a profile crop prepares the image without uploading it. Save text first when changed, then upload with the refreshed version; preserve the selected image on failure. Image deletion remains a direct cross action without confirmation.

## Remaining routes and future screens

- `src/styles/site-theme.css` extends the original mockup theme to authentication, account settings, reservations, shared browsing and the home page. Reuse these view families for future routes instead of introducing another card treatment.
- Authentication and account forms sit on the ivory page, without an enclosing shadow or coral top border. Keep a readable form width and the same field/button components as list creation (mockup 07).
- Account settings retain a sage left navigation on desktop and move above the form on mobile; the content height follows the form, without a tall empty minimum-height panel. The active category is a sage fill with a forest accent, never an underlined link.
- Accounts linked to Google do not show local e-mail/password settings. Use the server-provided association, never infer it from an e-mail domain or a browser-only login marker; direct visits to those forms return to the profile.
- Reservation history uses its own `.reservation-history-list` and `.reservation-history-card` rows (mockup 06), never `.wishlists-grid` or `.wishlist-card`. Show the actual product image, list author's public name, “Quantité réservée”, status and calendar dates without time or a UTC suffix. The title and thumbnail open the wish using current API-provided sharing access, without an eye button; unavailable wishes remain plain content. Never invent photos, owners or sharing secrets.
- Shared lists follow mockup 03: sage context sidebar, horizontal image-and-title cards in two desktop columns and one mobile column. Each whole card is a single native link to the wish detail. Show only its image and title; keep prices, quantities, product links and reservation actions on the detail. Keep the availability filter without explanatory prose. Do not add a fictional owner portrait or list participation block.
- Shared list context shows the calendar-day countdown directly below a future event date (“104 jours restants”, “1 jour restant”), or “Aujourd’hui” on the date itself. Do not show a negative countdown for past dates or one for undated lists; use the visitor's local calendar day without daylight-saving rounding errors.
- Active, accessible reservations can be cancelled directly from their history card using the compact destructive icon at the upper right. Reuse the existing confirmation with a fresh reservation version; never cancel on a read or replay an uncertain mutation. Keep the history stable while the dialog is open, then refresh it after a confirmed cancellation.
- In reservation history, the list name opens its current shared list and the owner's name opens their public profile. Use native, un-underlined links with visible focus; unavailable destinations stay plain text. Identify owners by the API identifier, never by their display name.
- Reservation dates show “Réservée le” and, after cancellation, “Annulée le”; omit “Dernière activité”. Use “Indisponible depuis” for an unavailable lifecycle, never describe it as a user cancellation.
- The reservation status dropdown applies its filter immediately on change and resets pagination to page one, without an apply button. Keep focus on the dropdown and announce updated results.
- Do not display reservation/page counts above the history cards. Keep pagination controls when needed and the screen-reader-only announcement of updated results.
- Shared wish details follow mockup 09: product information on the left, a `.reservation-panel` on the right, stacked on narrow screens. Keep mutation/authorization behavior independent of presentation.
- Shared wish reservation panels omit the “Ma réservation” heading and the signed-in member's display name. The explicit account continuation action reads “Je réserve ce cadeau”.
- When the desired quantity is one, “Je réserve ce cadeau” reserves one item without a quantity field or second confirmation, including after explicit account identification. Reads and page returns must never initiate a reservation. Multi-item wishes retain quantity selection; existing single-item reservations expose cancellation without a quantity editor.
- Legal pages load the common theme and footer without requiring authentication or application JavaScript; retain publication notices and legal content.
- Preserve existing behavior while harmonizing presentation. Visual mockups do not authorize adding capabilities or replacing server-derived state with decorative fixture data.

## Delivery checklist

1. Inspect the relevant historical mockup and existing sibling components before implementation.
2. Reuse shared action links, buttons, disclosure menus, form fields and toolbars; put reusable rules in shared CSS rather than patching one screen.
3. Verify populated, empty, loading, error, disabled, selected and menu-open states relevant to the change. Use only the actual authenticated account capabilities.
4. Check keyboard focus, long names, narrow screens and that controls never overlap or cause horizontal scrolling.
5. Run affected tests, type checking and lint. Compare rendered desktop/mobile screenshots with the reference and record intentional deviations rather than claiming exact fidelity.

For a new pattern not covered here, agree on it before introducing a conflicting visual convention, then update this charter and its tests together.
- Keep the home action only in the shared header; do not duplicate an “Accueil” button in page content.
- Owner archives are reversible and read-only, separated by “Actives / Archivées” links in the overview. Archive/restore actions belong to contextual menus on overview cards and the icon toolbar on owner details, without a confirmation. Archived lists retain deletion, but hide content editing and sharing. Existing reservations stay active without wish/list navigation or cancellation until restoration.
