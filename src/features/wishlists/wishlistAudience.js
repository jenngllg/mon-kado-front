import { isAbortError } from "../../api/apiError.js";
import { createButton, disposeComponent } from "../../components/index.js";
import { registerComponentCleanup } from "../../components/componentLifecycle.js";

/** @typedef {Awaited<ReturnType<ReturnType<typeof import('../groups/groupsService.js').createGroupsService>['wishlistVisibility']>>} AudienceResponse */

/** Reads a concise audience summary without changing sharing permissions.
 * @param {{load:(options:{signal:AbortSignal})=>Promise<AudienceResponse>, signal:AbortSignal}} options Authorized visibility read and lifetime.
 */
export function createWishlistAudience({ load, signal }) {
  const element = document.createElement("div"); element.className = "wishlist-audience";
  const status = document.createElement("div"); status.className = "wishlist-audience__status"; status.setAttribute("role", "status");
  const groupAudience = document.createElement("p");
  const publicLink = document.createElement("p"); publicLink.className = "wishlist-audience__public";
  const retry = createButton({ label: "Réessayer la visibilité", variant: "secondary", onClick: () => { void refresh(); } }); retry.hidden = true;
  element.append(status, retry);
  const lifetime = new AbortController();
  let generation = 0;
  registerComponentCleanup(element, () => { generation++; lifetime.abort(); status.textContent = ""; disposeComponent(retry); });
  async function refresh() {
    const current = ++generation;
    const readSignal = AbortSignal.any([signal, lifetime.signal]);
    if (readSignal.aborted) return;
    if (!status.hasChildNodes()) status.textContent = "Vérification de la visibilité…";
    retry.hidden = true;
    try {
      const { visibility } = await load({ signal: readSignal });
      if (readSignal.aborted || current !== generation) return;
      const count = visibility.groups.filter(group => group.isVisible).length;
      groupAudience.textContent = count ? `Partagée avec ${count} groupe${count > 1 ? "s" : ""}` : visibility.isPublic ? "Aucun groupe" : "Seulement moi";
      publicLink.textContent = visibility.isPublic ? "Lien public actif" : "Lien public inactif";
      publicLink.classList.toggle("wishlist-audience__public--active", visibility.isPublic);
      status.replaceChildren(groupAudience, publicLink);
    } catch (error) {
      if (readSignal.aborted || current !== generation || isAbortError(error)) return;
      status.textContent = "Visibilité à vérifier"; retry.hidden = false;
    }
  }
  return { element, refresh };
}
