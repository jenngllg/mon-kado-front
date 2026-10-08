import { createActionLink } from "./index.js";
import { RoutePaths } from "../app/routeContracts.js";
import { disposeComponent, registerComponentCleanup } from "./componentLifecycle.js";
import { createAccountIcon } from "./accountIcon.js";

/** @type {ReadonlyArray<{label: string, href: string, icon: Parameters<typeof createAccountIcon>[0]}>} */
const Categories = [
  { label: "Profil", href: RoutePaths.Profile, icon: "user" },
  { label: "Adresse e-mail", href: RoutePaths.EmailChange, icon: "email" },
  { label: "Mot de passe", href: RoutePaths.PasswordChange, icon: "password" },
  { label: "Données personnelles", href: RoutePaths.PersonalData, icon: "shield" },
  { label: "Authentificateur", href: RoutePaths.Authenticator, icon: "authenticator" },
];

/** Wraps an account category in the shared navigation layout.
 * @param {HTMLElement} content Disposable category view.
 * @param {string} currentPath Active category path.
 * @param {{getSnapshot: () => {user: {roles: readonly string[], isGoogleLinked?: boolean} | null}, subscribe: (listener: () => void) => () => void}} [session] Trusted application session.
 * @returns {HTMLElement} Account layout.
 */
export function createAccountLayout(content, currentPath, session) {
  const layout = document.createElement("section");
  layout.className = "profile-layout";
  const sidebar = document.createElement("aside");
  sidebar.className = "profile-view__settings";
  const heading = content.querySelector(":scope > h1");
  if (heading) layout.append(heading);
  const navigation = document.createElement("nav");
  navigation.setAttribute("aria-label", "Paramètres du compte");
  function updateNavigation() {
    const isAdmin = session?.getSnapshot().user?.roles.includes("Admin") === true;
    const isGoogleLinked = session?.getSnapshot().user?.isGoogleLinked === true;
    disposeComponent(navigation);
    navigation.replaceChildren();
    for (const category of Categories) {
      if (category.href === RoutePaths.Authenticator && !isAdmin) continue;
      if (isGoogleLinked && (category.href === RoutePaths.EmailChange || category.href === RoutePaths.PasswordChange)) continue;
      const link = createActionLink({ ...category, decorativeElement: createAccountIcon(category.icon) });
      if (category.href === currentPath) link.setAttribute("aria-current", "page");
      navigation.append(link);
    }
  }
  updateNavigation();
  if (session) registerComponentCleanup(layout, session.subscribe(updateNavigation));
  sidebar.append(navigation);
  content.classList.add("profile-view");
  layout.append(sidebar, content);
  return layout;
}
