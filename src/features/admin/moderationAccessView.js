import { createActionLink } from "../../components/index.js";
import { RoutePaths } from "../../app/routeContracts.js";

/** Creates the same access refusal for local eligibility and server denial.
 * @returns {HTMLElement} Refusal with an ordinary member destination.
 */
export function createModerationAccessDeniedView() {
  const view = document.createElement("section");
  view.className = "flow";
  const title = document.createElement("h1");
  title.textContent = "Accès administrateur requis";
  title.tabIndex = -1;
  view.append(title, createActionLink({ label: "Mes listes", href: RoutePaths.Lists }));
  return view;
}
