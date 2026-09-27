import { ApiError, isAbortError } from "../../api/apiError.js";
import { addComponentEventListener, registerComponentCleanup } from "../../components/componentLifecycle.js";
import { createAlert, createLoadingState, disposeComponent } from "../../components/index.js";
import { createBackLink } from "../../components/backLink.js";
import { createMemberAvatar } from "../../components/memberAvatar.js";
import { toUserFacingError } from "../../errors/errorMessages.js";
import { WishlistOccasions } from "../wishlists/wishlistValidation.js";
import { wishlistArtwork } from "../wishlists/wishlistArtwork.js";

const DateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Displays the public profile without account-management capabilities.
 * @param {{memberId: string, load: import("./memberProfileService.js").LoadMemberProfile, signal?: AbortSignal}} options Read dependencies.
 */
export function createMemberProfileView({ memberId, load, signal }) {
  const view = node("section", ""); view.className = "member-profile-view flow";
  const title = node("h1", "Profil du membre"); title.tabIndex = -1;
  const header = node("header", ""); header.className = "member-profile-header"; header.append(title);
  const results = node("div", ""); results.className = "flow";
  view.append(createBackLink({ label: "Retour à la recherche", href: "/members" }), header, results);
  const lifetime = new AbortController();
  let disposed = false;
  registerComponentCleanup(view, () => {
    disposed = true; lifetime.abort(); disposeComponent(header); disposeComponent(results);
    header.replaceChildren(); results.replaceChildren(); results.setAttribute("aria-busy", "false");
  });
  if (signal) {
    addComponentEventListener(view, signal, "abort", () => disposeComponent(view), { once: true });
    if (signal.aborted) disposeComponent(view);
  }
  if (!disposed) void read();
  return view;

  async function read() {
    results.setAttribute("aria-busy", "true");
    results.append(createLoadingState({ label: "Chargement du profil…" }));
    try {
      const profile = await load(memberId, { signal: lifetime.signal });
      if (disposed) return;
      disposeComponent(results); results.replaceChildren(); title.textContent = profile.displayName;
      header.prepend(createMemberAvatar({ memberId: profile.id, imageUrl: profile.photo.imageUrl, size: 56 }));
      results.append(node("h2", "Listes partagées"));
      if (!profile.wishlists.length) results.append(node("p", "Aucune liste partagée"));
      else {
        const cards = node("ul", ""); cards.className = "member-profile-lists"; cards.setAttribute("role", "list");
        for (const list of profile.wishlists) {
          const item = node("li", ""); item.className = "member-profile-list";
          const link = node("a", ""); link.href = list.shareHref;
          const art = node("img", ""); art.src = wishlistArtwork(list.occasion); art.alt = ""; art.width = 180; art.height = 180; art.loading = "lazy";
          const content = node("div", ""); content.className = "member-profile-list__content flow";
          const occasion = node("span", WishlistOccasions[list.occasion]); occasion.className = "member-profile-list__occasion";
          content.append(occasion, node("h3", list.name));
          if (list.eventDate) {
            const date = node("time", DateFormat.format(new Date(list.eventDate + "T00:00:00Z"))); date.dateTime = list.eventDate; content.append(date);
          }
          link.append(art, content); item.append(link); cards.append(item);
          registerComponentCleanup(item, () => { link.removeAttribute("href"); art.removeAttribute("src"); });
        }
        results.append(cards);
      }
      title.focus();
    } catch (error) {
      if (disposed || isAbortError(error)) return;
      disposeComponent(results); results.replaceChildren();
      if (error instanceof ApiError && error.statusCode === 404) {
        title.textContent = "Profil introuvable";
        results.append(node("p", "Ce profil n’est pas disponible."));
      } else results.append(createAlert({ ...toUserFacingError(error), variant: "error" }));
      title.focus();
    } finally { if (!disposed) results.setAttribute("aria-busy", "false"); }
  }
}
/** @template {keyof HTMLElementTagNameMap} T @param {T} tag Native tag. @param {string} text Safe content. @returns {HTMLElementTagNameMap[T]} Native element. */
function node(tag, text) { const element = document.createElement(tag); element.textContent = text; return element; }
