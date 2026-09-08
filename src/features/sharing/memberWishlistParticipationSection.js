import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createButton, disposeComponent } from "../../components/index.js";
import { toUserFacingError } from "../../errors/errorMessages.js";

/** @typedef {{displayName: string, shareLinkId: string,
 * loadCurrentMember: import("./wishlistParticipationService.js").LoadCurrentParticipant,
 * joinMember: import("./wishlistParticipationService.js").JoinMember,
 * onUnavailable: () => void, signal?: AbortSignal}} MemberParticipationOptions */

/** Account participation is explicit; the server owns any guest attachment.
 * @param {MemberParticipationOptions} options Disposable account-bound dependencies.
 * @returns {HTMLElement} Inline participation section.
 */
export function createMemberWishlistParticipationSection({ displayName, shareLinkId, loadCurrentMember, joinMember, onUnavailable, signal }) {
  const section = node("section", ""); section.className = "wishlist-participation flow";
  const title = node("h2", "Participer avec mon compte"); title.tabIndex = -1;
  const identity = node("p", `Nom d’affichage : ${displayName}`);
  const explanation = node("p", "Tu participeras avec ton compte MonKado. Si ce navigateur reconnaît une participation invitée à cette liste, elle pourra être rattachée à ton compte.");
  const status = node("p", ""); status.setAttribute("role", "status");
  const feedback = node("div", ""); feedback.hidden = true;
  const join = createButton({ label: "Participer avec mon compte", onClick: () => { void run(true); } });
  const refresh = createButton({ label: "Réessayer", variant: "secondary", onClick: () => { void run(false, true); } });
  section.append(title, identity, explanation, status, feedback, join, refresh);
  const lifetime = new AbortController();
  let disposed = false, busy = false, mustRead = true, joined = false, owner = false;
  function clearFeedback() { disposeComponent(feedback); feedback.replaceChildren(); feedback.hidden = true; }
  function controls() { join.disabled = busy || mustRead || joined || owner; join.hidden = joined || owner; refresh.disabled = busy; section.setAttribute("aria-busy", String(busy)); }
  /** @param {string} label Safe action text. */
  function lookup(label) { const text = refresh.querySelector(".ui-button__label"); if (text) text.textContent = label; refresh.hidden = false; }
  registerComponentCleanup(section, () => { disposed = true; lifetime.abort(); displayName = ""; identity.textContent = ""; status.textContent = ""; clearFeedback(); join.disabled = true; refresh.disabled = true; });
  if (signal) { addComponentEventListener(section, signal, "abort", () => disposeComponent(section), { once: true }); if (signal.aborted) disposeComponent(section); }
  if (!disposed) void run(false);
  return section;

  /** @param {boolean} mutation Explicit join, never inferred from a read.
   * @param {boolean} [explicit] User-requested lookup focus.
   */
  async function run(mutation, explicit = false) {
    if (disposed || busy || (mutation && (mustRead || joined || owner))) return;
    busy = true; clearFeedback(); refresh.hidden = true;
    if (!mutation) { mustRead = true; joined = false; identity.textContent = `Nom d’affichage : ${displayName}`; title.textContent = "Participer avec mon compte"; }
    controls(); status.textContent = mutation ? "Participation en cours…" : "Vérification de ta participation…";
    let announcement = "";
    try {
      const participant = await (mutation ? joinMember(shareLinkId, { signal: lifetime.signal }) : loadCurrentMember(shareLinkId, { signal: lifetime.signal }));
      if (disposed) return;
      mustRead = false;
      if (participant) {
        joined = true; title.textContent = "Tu participes à cette liste"; identity.textContent = `Nom d’affichage : ${participant.displayName}`;
        lookup("Actualiser ma participation");
        if (mutation) announcement = "created" in participant && participant.created ? "Participation enregistrée" : "Participation reconnue";
      }
      if (mutation || explicit) title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      const api = error instanceof ApiError ? error : null;
      if (api?.statusCode === 404) { onUnavailable(); return; }
      let message = null;
      if (mutation && (!api || ["network", "timeout", "invalidResponse"].includes(api.kind) || (api.statusCode ?? 0) >= 500)) {
        mustRead = true; message = "Ta participation ne peut pas être confirmée. Vérifie ta participation avant de réessayer."; lookup("Vérifier ma participation");
      } else if (api?.statusCode === 409 && api.errorCode === "WISHLIST_OWNER_CANNOT_JOIN") {
        owner = true; message = "Tu ne peux pas participer à ta propre liste.";
      } else {
        if (api?.errorCode === "WISHLIST_PARTICIPANT_LIMIT_REACHED") message = "Cette liste a atteint le nombre maximal de participants.";
        if (!mutation) lookup("Réessayer");
      }
      const translated = toUserFacingError(error), details = [];
      const correlation = api?.correlationId ?? translated.correlationId;
      if (correlation) details.push(`Référence : ${correlation}`);
      if (api?.statusCode === 429 && api.retryAfterSeconds !== null) details.push(`Réessaie dans ${api.retryAfterSeconds} seconde(s).`);
      const alert = createAlert({ ...translated, ...(message ? { title: "Participation indisponible", message } : {}), detail: details.join(" ") || null, variant: "error" });
      alert.tabIndex = -1; feedback.append(alert); feedback.hidden = false;
      if (mutation || explicit) alert.focus();
    } finally { if (!disposed) { busy = false; controls(); status.textContent = announcement; } }
  }
}

/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
