import {
  createHomeView,
  createPlaceholderView,
} from "../views/index.js";
import {
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";
import { createSessionGuard } from "../auth/sessionGuards.js";

export {
  NavigationItems,
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";

const PlaceholderMessage =
  "Cette fonctionnalité sera disponible dans un prochain lot.";

const PlaceholderRoutes = Object.freeze([
  createPlaceholderRoute(
    RouteNames.Login,
    RoutePaths.Login,
    "Connexion",
    "Compte MonKado",
  ),
  createPlaceholderRoute(
    RouteNames.LinkGoogle,
    RoutePaths.LinkGoogle,
    "Connexion avec Google",
    "Compte MonKado",
  ),
  createPlaceholderRoute(
    RouteNames.Register,
    RoutePaths.Register,
    "Créer un compte",
    "Compte MonKado",
  ),
  createPlaceholderRoute(
    RouteNames.ConfirmEmail,
    RoutePaths.ConfirmEmail,
    "Confirmer l’adresse e-mail",
    "Sécurité du compte",
  ),
  createPlaceholderRoute(
    RouteNames.ConfirmEmailChange,
    RoutePaths.ConfirmEmailChange,
    "Confirmer la nouvelle adresse e-mail",
    "Sécurité du compte",
  ),
  createPlaceholderRoute(
    RouteNames.ForgotPassword,
    RoutePaths.ForgotPassword,
    "Mot de passe oublié",
    "Sécurité du compte",
  ),
  createPlaceholderRoute(
    RouteNames.ResetPassword,
    RoutePaths.ResetPassword,
    "Réinitialiser le mot de passe",
    "Sécurité du compte",
  ),
  createPlaceholderRoute(
    RouteNames.Profile,
    RoutePaths.Profile,
    "Mon profil",
    "Compte MonKado",
  ),
  createPlaceholderRoute(
    RouteNames.Lists,
    RoutePaths.Lists,
    "Mes listes",
    "Listes de cadeaux",
  ),
  createPlaceholderRoute(
    RouteNames.NewList,
    RoutePaths.NewList,
    "Créer une liste",
    "Listes de cadeaux",
  ),
  createPlaceholderRoute(
    RouteNames.ListDetails,
    RoutePaths.ListDetails,
    "Détail de la liste",
    "Listes de cadeaux",
  ),
  createPlaceholderRoute(
    RouteNames.Reservations,
    RoutePaths.Reservations,
    "Mes réservations",
    "Cadeaux réservés",
  ),
  createPlaceholderRoute(
    RouteNames.SharedWishlist,
    RoutePaths.SharedWishlist,
    "Liste de cadeaux partagée",
    "Accès invité",
  ),
]);

/**
 * Creates the complete frontend route catalogue.
 *
 * @param {{session: Pick<import("../auth/sessionManager.js").SessionManager, "ensureSession">}} options Session dependency.
 * @returns {ReadonlyArray<import("../router/router.js").RouteDefinition>} Application routes.
 */
export function createApplicationRoutes({ session }) {
  return [
    Object.freeze({
      name: RouteNames.Home,
      path: RoutePaths.Home,
      title: "MonKado · Les cadeaux qui font vraiment plaisir",
      render: createHomeView,
    }),
    ...PlaceholderRoutes.map(route => Object.freeze({ ...route, beforeEnter: createSessionGuard(route.name, session) })),
  ];
}

/**
 * @param {string} name Route name.
 * @param {string} path Route path.
 * @param {string} title View title.
 * @param {string} eyebrow View eyebrow.
 * @returns {import("../router/router.js").RouteDefinition} Placeholder route.
 */
function createPlaceholderRoute(name, path, title, eyebrow) {
  return Object.freeze({
    name,
    path,
    title: `${title} · MonKado`,
    render: () => createPlaceholderView({
      eyebrow,
      title,
      message: PlaceholderMessage,
    }),
  });
}
