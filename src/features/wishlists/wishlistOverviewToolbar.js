import { RoutePaths } from "../../app/routeContracts.js";
import { createActionLink } from "../../components/index.js";

/** Creates the shared list categories and creation action.
 * @param {"active" | "archived" | "followed"} category Current overview category.
 * @returns {HTMLElement} Native navigation with one current category.
 */
export function createWishlistOverviewToolbar(category) {
  const toolbar = document.createElement("div"); toolbar.className = "wishlists-view__toolbar";
  const tabs = document.createElement("nav"); tabs.className = "wishlist-archive-tabs cluster";
  tabs.setAttribute("aria-label", "Catégories de listes");
  for (const item of [
    { key: "active", label: "Actives", href: RoutePaths.Lists },
    { key: "archived", label: "Archivées", href: `${RoutePaths.Lists}?isArchived=true` },
    { key: "followed", label: "Listes suivies", href: RoutePaths.FollowedLists },
  ]) {
    const tab = createActionLink({ label: item.label, href: item.href });
    if (item.key === category) tab.setAttribute("aria-current", "page");
    tabs.append(tab);
  }
  const create = createActionLink({ label: "Créer une liste", href: RoutePaths.NewList });
  create.classList.add("ui-button", "ui-button--primary", "page-primary-action");
  toolbar.append(tabs, create);
  return toolbar;
}
