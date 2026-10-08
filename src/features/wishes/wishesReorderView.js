import { ApiError, isAbortError } from "../../api/apiError.js";
import { isStrongEntityTag } from "../../api/entityTag.js";
import { registerComponentCleanup, addComponentEventListener } from "../../components/componentLifecycle.js";
import { createAlert, createButton, createLoadingState, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { isWishlistId } from "../wishlists/wishlistValidation.js";
import { createWishGalleryCard } from "./wishGalleryCard.js";
import { installWishReorderDrag } from "./wishReorderDrag.js";
import gripSource from "../../assets/icons/grip-vertical.svg?raw";

/** @typedef {import("./wishesService.js").WishCollection} Collection */
/** Complete, local order editor; no request occurs during a move.
 * @param {{wishlistId: string, loadWishlist: import("../wishlists/wishlistsService.js").LoadWishlist,
 * loadWishes: import("./wishesService.js").LoadWishes, reorder: import("./wishesService.js").ReorderWishes,
 * onSaved: () => void | Promise<void>, onCancel: () => void | Promise<void>, signal?: AbortSignal}} options Operations.
 * @returns {HTMLElement} Owned editor.
 */
export function createWishesReorderView({ wishlistId, loadWishlist, loadWishes, reorder, onSaved, onCancel, signal }) {
  const view = node("section", ""); view.className = "wish-reorder-view flow";
  const title = node("h2", "Réorganiser les souhaits"); title.tabIndex = -1;
  const help = node("p", "Glisse les souhaits pour changer leur ordre.");
  help.className = "wish-reorder-help";
  const keyboardHelp = node("p", "Espace pour déplacer, flèches pour positionner, Entrée pour déposer, Échap pour annuler le déplacement.");
  keyboardHelp.id = `wish-reorder-keyboard-${wishlistId}`; keyboardHelp.className = "visually-hidden";
  const feedback = node("div", ""); feedback.className = "flow";
  const comparison = node("div", ""); comparison.className = "wish-reorder-comparison flow"; comparison.hidden = true;
  const grid = node("ul", ""); grid.className = "wish-grid wish-grid--gallery"; grid.setAttribute("role", "list");
  const status = node("p", ""); status.setAttribute("role", "status"); status.className = "wish-reorder-status visually-hidden";
  const lifetime = new AbortController();
  /** @type {Collection | null} */ let base = null;
  /** @type {Collection | null} */ let latest = null;
  /** @type {string[]} */ let draft = [];
  let busy = false, disposed = false, blocked = true, suspended = false, terminal = false, completed = false, differentMembership = false, decision = false, needsRead = false;
  /** @type {{id: string, original: string[]} | null} */ let keyboardMove = null;
  let repositioning = false;
  /** @type {Map<string, {card: HTMLLIElement, title: HTMLElement, rank: HTMLElement, handle: HTMLButtonElement}>} */ const cards = new Map();
  const saveButtons = [createButton({ label: "Enregistrer", onClick: () => { void save(); } })];
  const cancelButtons = [createButton({ label: "Annuler", variant: "secondary", onClick: () => { void leave(completed); } })];
  const bar = node("div", ""); bar.className = "cluster wish-reorder-actions"; bar.append(cancelButtons[0], saveButtons[0]);
  const introduction = node("div", ""); introduction.className = "wish-reorder-introduction"; introduction.append(title, help);
  const toolbar = node("div", ""); toolbar.className = "wish-reorder-toolbar"; toolbar.append(introduction, bar);
  const reread = createButton({ label: "Relire les souhaits", variant: "secondary", onClick: () => { void read(true); } });
  const adopt = createButton({ label: "Utiliser l’ordre enregistré", variant: "secondary", onClick: useLatest });
  view.append(toolbar, feedback, reread, comparison, adopt, status, keyboardHelp, grid);
  const stopDrag = installWishReorderDrag(view, grid, { enabled: canMove, move: (id, index) => move(id, index, cards.get(id)?.handle) });
  const stopMovement = () => { stopDrag(); finishKeyboard(false); };
  addComponentEventListener(view, grid, "pointerdown", () => finishKeyboard(false));
  addComponentEventListener(view, grid, "keydown", event => {
    const key = /** @type {KeyboardEvent} */ (event);
    const handle = key.target instanceof Element ? key.target.closest("[data-reorder-handle]") : null;
    const id = /** @type {HTMLElement | null} */ (handle?.closest("[data-wish-id]"))?.dataset.wishId;
    if (!id || !canMove()) return;
    if (key.key === " " || key.key === "Enter") { key.preventDefault(); toggleKeyboard(id); return; }
    if (keyboardMove?.id !== id) return;
    if (key.key === "Escape") { key.preventDefault(); finishKeyboard(true); return; }
    if (key.key === "Tab") { finishKeyboard(false); return; }
    const index = draft.indexOf(id);
    const firstTop = grid.firstElementChild?.getBoundingClientRect().top;
    const columns = Math.max(1, [...grid.children].filter(card => Math.abs(card.getBoundingClientRect().top - (firstTop ?? 0)) < 4).length);
    const targets = { ArrowLeft: index - 1, ArrowRight: index + 1, ArrowUp: index - columns, ArrowDown: index + columns, Home: 0, End: draft.length - 1 };
    if (!(key.key in targets)) return;
    key.preventDefault(); move(id, Math.max(0, Math.min(draft.length - 1, targets[/** @type {keyof typeof targets} */ (key.key)])), cards.get(id)?.handle);
  });
  addComponentEventListener(view, grid, "focusout", event => {
    if (!repositioning && keyboardMove && /** @type {FocusEvent} */ (event).relatedTarget !== cards.get(keyboardMove.id)?.handle) finishKeyboard(false);
  });
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); stopMovement(); base = null; latest = null; draft = []; cards.clear();
    clear(grid); clear(feedback); clear(comparison); status.textContent = ""; sync();
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  sync(); if (!disposed) void read(false);
  return view;

  function canMove() { return !disposed && !busy && !blocked && !suspended && !terminal && !completed && !differentMembership && !!base && draft.length >= 2 && draft.length <= 1000; }
  function changed() { return !!base && draft.some((id, i) => id !== base?.wishes[i]?.id.toLowerCase()); }
  function sync() {
    view.setAttribute("aria-busy", String(busy));
    help.textContent = keyboardMove ? "Flèches pour déplacer · Entrée pour déposer · Échap pour annuler" : "Glisse les souhaits pour changer leur ordre.";
    for (const button of saveButtons) { button.disabled = !canMove() || !changed(); button.textContent = decision ? "Enregistrer mon ordre" : "Enregistrer"; }
    for (const button of cancelButtons) { button.disabled = disposed || busy; button.textContent = completed ? "Retour aux souhaits" : "Annuler"; }
    reread.hidden = disposed || terminal || completed || (!needsRead && base !== null); reread.disabled = busy;
    adopt.hidden = disposed || completed || terminal || !latest; adopt.disabled = busy || suspended || (latest?.wishes.length ?? 0) > 1000;
    adopt.textContent = differentMembership ? "Repartir de la collection actualisée" : "Utiliser l’ordre enregistré";
    draft.forEach((id, index) => {
      const row = cards.get(id); if (!row) return;
      row.rank.textContent = String(index + 1);
      row.rank.setAttribute("aria-label", `Position ${index + 1} sur ${draft.length}`);
      row.handle.disabled = !canMove();
      row.handle.setAttribute("aria-pressed", String(keyboardMove?.id === id));
      row.card.classList.toggle("wish-reorder-selected", keyboardMove?.id === id);
    });
  }
  /** @param {string} id Wish selected using its handle. */
  function toggleKeyboard(id) {
    if (!canMove()) return;
    stopDrag();
    const previous = keyboardMove?.id; finishKeyboard(false);
    if (previous === id) return;
    keyboardMove = { id, original: [...draft] }; sync();
    status.textContent = `« ${cards.get(id)?.title.textContent} » sélectionné. Utilise les flèches pour déplacer le souhait.`;
  }
  /** @param {boolean} restore Escape cancels only the current keyboard gesture. */
  function finishKeyboard(restore) {
    if (!keyboardMove) return;
    const previous = keyboardMove; keyboardMove = null;
    if (restore) {
      draft = previous.original;
      repositioning = true;
      for (const id of draft) { const row = cards.get(id); if (row) grid.append(row.card); }
      cards.get(previous.id)?.handle.focus(); repositioning = false; status.textContent = "Déplacement annulé.";
    }
    else status.textContent = "Souhait déposé. Enregistre pour conserver cet ordre.";
    sync();
  }
  /** @param {Parameters<typeof createAlert>[0]} options Safe copy. */
  function show(options) { clear(feedback); const alert = createAlert({ variant: "error", ...options }); alert.tabIndex = -1; feedback.append(alert); return alert; }
  function focusError() { /** @type {HTMLElement | null} */ (feedback.firstElementChild)?.focus(); }
  /** @param {string} id Stable identity. @param {number} target Zero-based position. @param {HTMLElement} [focus] Active control. */
  function move(id, target, focus) {
    if (!canMove() || !Number.isInteger(target) || target < 0 || target >= draft.length) return;
    const index = draft.indexOf(id); if (index < 0 || index === target) return;
    draft.splice(index, 1); draft.splice(target, 0, id);
    const moved = cards.get(id);
    repositioning = true;
    if (moved) grid.insertBefore(moved.card, cards.get(draft[target + 1])?.card ?? null);
    sync(); const row = cards.get(id);
    if (row) { (focus ?? row.handle).focus(); status.textContent = `« ${row.title.textContent} » déplacé à la position ${target + 1} sur ${draft.length}.`; }
    repositioning = false;
  }
  function renderCards() {
    stopMovement(); clear(grid); cards.clear();
    if (!base) return;
    const fragment = document.createDocumentFragment();
    const byId = new Map(base.wishes.map(item => [item.id.toLowerCase(), item]));
    for (const id of draft) {
      const item = byId.get(id); if (!item) continue;
      const card = createWishGalleryCard(item, suspended, { reordering: true }); card.dataset.wishId = id;
      const heading = /** @type {HTMLElement} */ (card.querySelector("h3")); heading.tabIndex = -1;
      const rank = node("span", ""); rank.className = "wish-reorder-rank";
      const handle = createButton({ label: `Déplacer le souhait « ${item.name} »`, variant: "secondary", onClick: () => toggleKeyboard(id) });
      handle.dataset.reorderHandle = ""; handle.classList.add("wish-reorder-handle");
      handle.setAttribute("aria-label", `Déplacer le souhait « ${item.name} »`); handle.setAttribute("aria-describedby", keyboardHelp.id);
      handle.title = "Déplacer ce souhait";
      const icon = new DOMParser().parseFromString(gripSource, "image/svg+xml").documentElement;
      icon.setAttribute("aria-hidden", "true"); icon.setAttribute("focusable", "false"); handle.replaceChildren(document.importNode(icon, true));
      card.append(rank, handle); fragment.append(card);
      cards.set(id, { card, title: heading, rank, handle });
    }
    grid.append(fragment);
    if (!busy) sync();
  }
  /** @param {Collection} value Loaded complete snapshot. */
  function validCollection(value) {
    return isStrongEntityTag(value.etag) && value.wishes.every(item => isWishlistId(item.id)) && new Set(value.wishes.map(item => item.id.toLowerCase())).size === value.wishes.length;
  }
  function compare() {
    clear(comparison); comparison.hidden = false;
    if (!base || !latest) return;
    const names = new Map([...base.wishes, ...latest.wishes].map(item => [item.id.toLowerCase(), item.name]));
    for (const [label, ids] of [["Ton ordre proposé", draft], ["Ordre enregistré", latest.wishes.map(item => item.id.toLowerCase())]]) {
      comparison.append(node("h3", /** @type {string} */ (label))); const order = node("ol", "");
      for (const id of /** @type {string[]} */ (ids)) order.append(node("li", names.get(id) ?? "Souhait indisponible"));
      comparison.append(order);
    }
  }
  /** @param {boolean} explicit Retry or conflict reread. */
  async function read(explicit) {
    if (disposed || busy || terminal || completed) return;
    stopMovement(); busy = true; blocked = true; clear(feedback); feedback.append(createLoadingState({ label: "Chargement de l’ordre des souhaits…" })); sync();
    try {
      if (!isWishlistId(wishlistId)) throw new ApiError({ kind: "http", statusCode: 404 });
      const list = await loadWishlist(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      const loaded = await loadWishes(wishlistId, { signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      if (!validCollection(loaded)) throw new ApiError({ kind: "invalidResponse" });
      suspended = list.wishlist.isSuspended || !!list.wishlist.isArchived; needsRead = suspended; clear(feedback);
      if (!base) { base = loaded; draft = loaded.wishes.map(item => item.id.toLowerCase()); }
      else {
        latest = loaded; const ids = new Set(loaded.wishes.map(item => item.id.toLowerCase()));
        differentMembership = draft.length !== ids.size || draft.some(id => !ids.has(id));
        if (!differentMembership) { base = loaded; decision = true; }
        compare();
      }
      blocked = suspended || differentMembership || loaded.wishes.length > 1000;
      renderCards();
      if (suspended) show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" });
      else if (loaded.wishes.length > 1000) show({ title: "Réorganisation indisponible", message: "La réorganisation est limitée à 1 000 souhaits. Aucun ordre partiel ne sera envoyé." });
      else if (differentMembership) show({ title: "Le contenu de la liste a changé", message: "Des souhaits ont été ajoutés ou supprimés. Repars de la collection actualisée pour choisir un nouvel ordre.", variant: "warning" });
      else if (draft.length < 2) show({ title: "Aucun déplacement nécessaire", message: "Il faut au moins deux souhaits pour les réorganiser.", variant: "info" });
      else if (latest && !changed()) show({ title: "L’ordre est déjà enregistré", message: "Aucune nouvelle écriture n’est nécessaire.", variant: "info" });
      if (explicit && feedback.childElementCount) focusError(); else title.focus();
    } catch (error) { if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) { failure(error, false); focusError(); } }
    finally { if (!disposed) { busy = false; sync(); } }
  }
  function useLatest() {
    if (!latest || disposed || busy || terminal || completed || suspended || latest.wishes.length > 1000) return;
    stopMovement(); base = latest; latest = null; draft = base.wishes.map(item => item.id.toLowerCase()); differentMembership = false; decision = false; blocked = false; needsRead = false;
    clear(comparison); comparison.hidden = true; clear(feedback); renderCards(); title.focus();
  }
  /** @param {boolean} saved Confirmed operation, never retry it. */
  async function leave(saved) {
    if (disposed || busy) return;
    stopMovement(); busy = true; sync();
    try { await (saved ? onSaved() : onCancel()); }
    catch { if (!disposed) show({ title: completed ? "Ordre des souhaits enregistré" : "Retour indisponible", message: "Le retour aux souhaits a échoué. Réessaie le retour sans renvoyer l’ordre.", variant: completed ? "success" : "error" }).focus(); }
    finally { if (!disposed) { busy = false; sync(); } }
  }
  async function save() {
    if (!canMove() || !changed() || !base) return;
    if (draft.length !== base.wishes.length || new Set(draft).size !== draft.length || base.wishes.some(item => !draft.includes(item.id.toLowerCase()))) { blocked = true; needsRead = true; sync(); return; }
    stopMovement(); busy = true; clear(feedback); sync(); status.textContent = "Enregistrement de l’ordre…"; title.focus();
    try {
      await reorder(wishlistId, [...draft], { etag: base.etag, signal: lifetime.signal });
      if (disposed || lifetime.signal.aborted) return;
      completed = true; blocked = true; base = null; latest = null; draft = []; cards.clear(); clear(grid); clear(comparison); comparison.hidden = true;
      show({ title: "Ordre des souhaits enregistré", message: "L’enregistrement est confirmé.", variant: "success" });
    } catch (error) {
      if (!disposed && !lifetime.signal.aborted && !isAbortError(error)) { failure(error, true); focusError(); }
    } finally { if (!disposed) { busy = false; status.textContent = ""; sync(); } }
    if (completed && !disposed) await leave(true);
  }
  /** @param {unknown} error Safe error. @param {boolean} mutation PATCH may have reached the server. */
  function failure(error, mutation) {
    stopMovement();
    if (error instanceof ApiError && error.statusCode === 404) {
      terminal = true; base = null; latest = null; draft = []; cards.clear(); clear(grid); clear(comparison); comparison.hidden = true;
      show({ title: "Liste introuvable", message: "Cette liste n’est pas disponible." }); return;
    }
    const precondition = error instanceof ApiError && (error.statusCode === 412 || error.statusCode === 428 || error.errorCode === "WISH_ORDER_CONFLICT" || error.validationErrors.some(item => item.propertyName === "ifMatch"));
    const uncertain = mutation && (!(error instanceof ApiError) || error.kind !== "http" || (error.statusCode ?? 0) >= 500);
    if (precondition || uncertain || !mutation) { blocked = true; needsRead = true; decision = false; latest = null; clear(comparison); comparison.hidden = true; }
    if (error instanceof ApiError && error.errorCode === "WISHLIST_SUSPENDED") {
      suspended = true; blocked = true; needsRead = true; show({ title: "Liste suspendue", message: "Consultation uniquement", variant: "warning" }); return;
    }
    const translated = toUserFacingError(error); const detail = [];
    if (error instanceof ApiError && error.correlationId) detail.push(`Référence : ${error.correlationId}`);
    if (error instanceof ApiError && error.statusCode === 429 && error.retryAfterSeconds !== null) detail.push(`Réessaie dans ${error.retryAfterSeconds} seconde(s).`);
    const invalidOrder = error instanceof ApiError && (error.statusCode === 413 || error.validationErrors.some(item => item.propertyName?.startsWith("wishIds")));
    show({ title: precondition ? "Actualisation nécessaire" : translated.title,
      message: precondition ? "La collection a été modifiée ailleurs. Ton ordre est conservé. Relis les souhaits avant de continuer." :
        uncertain ? "L’enregistrement de l’ordre ne peut pas être confirmé. Relis les souhaits avant de réessayer." :
        invalidOrder ? "L’ordre complet ne peut pas être envoyé. Relis les souhaits ; aucun envoi partiel ne sera effectué." : translated.message,
      detail: detail.join(" ") || null });
    if (invalidOrder) { blocked = true; needsRead = true; }
  }
}
/** @param {HTMLElement} element Owned subtree. */
function clear(element) { disposeComponent(element); element.replaceChildren(); }
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe text. @returns {HTMLElementTagNameMap[T]} Node. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
