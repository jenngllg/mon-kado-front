const StateKey = "monkadoReturn";
const PendingKey = "monkado.return.v1";
const MaximumDepth = 24;
const MaximumPathLength = 384;
const MaximumPendingBytes = 12000;
const PendingLifetime = 5 * 60 * 1000;
const Identifier = "[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}";
const PagePattern = new RegExp(`^(?:/|/groups(?:/${Identifier}(?:/edit|/members/${Identifier}|/wishlists/${Identifier}(?:/wishes/${Identifier})?)?)?|/lists(?:/new|/${Identifier}(?:/edit|/wishes/(?:new|${Identifier}(?:/edit)?))?)?|/shared-wishlists/${Identifier}(?:/wishes/${Identifier})?|/members(?:/${Identifier})?|/reservations|/followed-lists|/profile(?:/(?:data|authenticator|password|email))?|/admin/reported-wishlists(?:/${Identifier}(?:/moderation(?:/history)?|/reports/${Identifier}(?:/history)?))?|/(?:legal-notice|privacy-policy|terms-of-use)(?:\\.html)?)$`, "i");
const Sorts = new Set(["listOrder", "nameAsc", "nameDesc", "priceAsc", "priceDesc", "favoriteFirst", "availableFirst", "merchantAsc", "merchantDesc"]);

/** @typedef {{page: string, trail: string[]}} ReturnState */

/** Keeps only recognized same-origin pages and non-secret display preferences.
 * @param {string | URL} value Candidate location.
 * @param {Window} browserWindow Browser owning the navigation.
 * @returns {string | null} Safe local path, never a bearer fragment or arbitrary query.
 */
function safePage(value, browserWindow) {
  try {
    const raw = String(value);
    if (raw.length > 4096 || raw.startsWith("//")) return null;
    const url = new URL(raw, browserWindow.location.origin);
    if (url.origin !== browserWindow.location.origin || url.username || url.password || !PagePattern.test(url.pathname)) return null;
    const query = new URLSearchParams();
    for (const key of ["sort", "fromMember", "isArchived", "isSuspended", "status", "reason", "page", "pageSize"]) {
      const values = url.searchParams.getAll(key);
      if (values.length !== 1) continue;
      const item = values[0];
      const valid = key === "sort" ? Sorts.has(item) : key === "fromMember" ? new RegExp(`^${Identifier}$`, "i").test(item) :
        key === "isArchived" || key === "isSuspended" ? /^(true|false)$/.test(item) :
          key === "page" || key === "pageSize" ? /^[1-9][0-9]{0,8}$/.test(item) && (key !== "pageSize" || Number(item) <= 100) :
            key === "status" ? /^(active|cancelled|unavailable|pending|upheld|dismissed)$/.test(item) : /^(spamOrScam|inappropriateContent|privacyViolation|other)$/.test(item);
      if (valid) query.set(key, item);
    }
    const path = url.pathname + (query.size ? `?${query}` : "");
    return path.length <= MaximumPathLength ? path : null;
  } catch { return null; }
}

/** @param {unknown} value Untrusted history/storage value. @param {Window} browserWindow Owning browser. @returns {ReturnState | null} Validated non-secret context. */
function parseState(value, browserWindow) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = /** @type {Partial<ReturnState>} */ (value);
  if (typeof input.page !== "string" || safePage(input.page, browserWindow) !== input.page || !Array.isArray(input.trail) || input.trail.length > MaximumDepth ||
    !input.trail.every(path => typeof path === "string" && path.startsWith("/") && safePage(path, browserWindow) === path)) return null;
  return { page: input.page, trail: [...input.trail] };
}

/** @param {Window} browserWindow Owning browser. @returns {ReturnState | null} Context bound to the current page. */
function currentState(browserWindow) {
  const state = parseState(browserWindow.history.state?.[StateKey], browserWindow);
  return state?.page === safePage(browserWindow.location.href, browserWindow) ? state : null;
}

/** Identifies the independently served legal documents.
 * @param {string | URL} value Candidate link. @param {Window} [browserWindow] Owning browser. @returns {boolean} Whether native document navigation is required.
 */
export function isLegalDocument(value, browserWindow = window) {
  const path = safePage(value, browserWindow)?.split("?")[0];
  return !!path && /^\/(legal-notice|privacy-policy|terms-of-use)(\.html)?$/.test(path);
}

/** Creates bounded history metadata. Replacements consume an ancestor rather than creating a return loop.
 * @param {Window} browserWindow Owning browser. @param {string | URL} target Destination. @param {"push" | "replace"} mode History operation.
 * @returns {{monkadoReturn: ReturnState | null}} Non-secret history state.
 */
export function returnNavigationState(browserWindow, target, mode) {
  const page = safePage(target, browserWindow);
  const currentPage = safePage(browserWindow.location.href, browserWindow);
  if (!page || !currentPage) return { [StateKey]: page ? { page, trail: [] } : null };
  const previous = currentState(browserWindow)?.trail ?? [];
  const ancestor = previous.indexOf(page);
  // Successful form saves navigate to a resource, not back into the submitted draft.
  const leavingDraft = /\/(new|edit)$/.test(currentPage.split("?")[0]) && new RegExp(`^/lists/${Identifier}(?:/wishes/${Identifier})?$`, "i").test(page.split("?")[0]);
  const trail = ancestor >= 0 ? previous.slice(ancestor + 1) : mode === "push" && page !== currentPage && !leavingDraft ? [currentPage, ...previous].slice(0, MaximumDepth) : previous;
  return { [StateKey]: { page, trail } };
}

/** Initializes direct entries or consumes a one-shot native legal-page handoff.
 * @param {Window} [browserWindow] Owning browser.
 */
export function initializeReturnNavigation(browserWindow = window) {
  if (currentState(browserWindow)) {
    try { browserWindow.sessionStorage.removeItem(PendingKey); } catch { /* History already owns the validated context. */ }
    return;
  }
  const page = safePage(browserWindow.location.href, browserWindow);
  if (!page) return;
  let trail = /** @type {string[]} */ ([]);
  try {
    const raw = browserWindow.sessionStorage.getItem(PendingKey);
    browserWindow.sessionStorage.removeItem(PendingKey);
    if (raw && raw.length <= MaximumPendingBytes && isLegalDocument(page, browserWindow)) {
      const pending = JSON.parse(raw);
      const origin = parseState(pending.origin, browserWindow);
      const age = Date.now() - pending.createdAt;
      if (pending.target === page && origin && Number.isFinite(age) && age >= 0 && age <= PendingLifetime) trail = origin.page === page ? origin.trail : [origin.page, ...origin.trail].slice(0, MaximumDepth);
    }
  } catch { /* Storage restrictions keep the explicit fallback navigation usable. */ }
  browserWindow.history.replaceState({ ...browserWindow.history.state, [StateKey]: { page, trail } }, "", browserWindow.location.href);
}

/** Resolves the actual origin without using arbitrary browser history or changing authorization.
 * @param {Window} [browserWindow] Owning browser. @returns {{href: string, label: string} | null} Contextual return or explicit fallback.
 */
export function contextualReturn(browserWindow = window) {
  const state = currentState(browserWindow);
  if (!state) return null;
  const href = state.trail[0];
  if (!href || href === state.page) return null;
  const path = href.split("?")[0];
  const label = path === "/" ? "Retour à l’accueil" : path === "/lists" ? (href.includes("isArchived=true") ? "Retour aux listes archivées" : "Retour à Mes listes") :
    path === "/groups" ? "Retour à Mes groupes" : /^\/groups\/[^/]+\/members\/[^/]+$/.test(path) ? "Retour aux listes du membre" : /^\/groups\/[^/]+$/.test(path) ? "Retour au groupe" : /^\/groups\/[^/]+\/wishlists\/[^/]+$/.test(path) ? "Retour à la liste" :
    path === "/reservations" ? "Retour à Mes réservations" : path === "/followed-lists" ? "Retour aux listes suivies" : path === "/members" ? "Retour à la recherche" : path.startsWith("/members/") ? "Retour au profil" :
      /\/wishes\/[^/]+$/.test(path) ? "Retour au souhait" : path.startsWith("/lists/") || path.startsWith("/shared-wishlists/") ? "Retour à la liste" :
        /legal-notice/.test(path) ? "Retour aux mentions légales" : /privacy-policy/.test(path) ? "Retour à la confidentialité" : /terms-of-use/.test(path) ? "Retour aux conditions d’utilisation" :
          path.startsWith("/profile") ? "Retour à Mon compte" : path === "/admin/reported-wishlists" ? "Retour aux listes signalées" : "Retour à la page précédente";
  return { href, label };
}

/** Updates an existing return link without re-enabling disabled links or recovery links in dialogs.
 * @param {HTMLAnchorElement} link Existing return control. @param {Window} [browserWindow] Owning browser.
 */
export function synchronizeReturnLink(link, browserWindow = window) {
  if (!link.hasAttribute("href") || link.dataset.fixedReturn === "true" || link.getAttribute("aria-disabled") === "true" || link.closest("dialog")) return;
  const destination = contextualReturn(browserWindow);
  if (!destination) return;
  if (link.getAttribute("href") !== destination.href) link.setAttribute("href", destination.href);
  if (link.title !== destination.label) link.title = destination.label;
  if (link.getAttribute("aria-label") !== destination.label) link.setAttribute("aria-label", destination.label);
  const label = link.querySelector(":scope > span");
  if (label && label.textContent !== destination.label) label.textContent = destination.label;
}

/** Installs native-document handoffs and keeps asynchronously rendered return controls in sync.
 * @param {Window & typeof globalThis} browserWindow Owning browser. @param {HTMLElement} root View root. @returns {() => void} Cleanup.
 */
export function watchReturnNavigation(browserWindow, root) {
  const synchronize = () => {
    for (const link of root.querySelectorAll("a.back-link")) synchronizeReturnLink(/** @type {HTMLAnchorElement} */ (link), browserWindow);
  };
  const observer = new browserWindow.MutationObserver(synchronize);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["href", "aria-disabled"] });
  /** @param {MouseEvent} event Normal same-tab navigation only. */
  const nativeHandoff = event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof browserWindow.Element)) return;
    const link = /** @type {HTMLAnchorElement | null} */ (event.target.closest("a[href]"));
    if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") || link.getAttribute("aria-disabled") === "true" || !isLegalDocument(link.href, browserWindow)) return;
    const origin = currentState(browserWindow);
    const target = safePage(link.href, browserWindow);
    if (!origin || !target) return;
    try { browserWindow.sessionStorage.setItem(PendingKey, JSON.stringify({ target, origin, createdAt: Date.now() })); } catch { /* Keep ordinary native navigation. */ }
  };
  browserWindow.document.addEventListener("click", nativeHandoff, true);
  synchronize();
  return () => { observer.disconnect(); browserWindow.document.removeEventListener("click", nativeHandoff, true); };
}
