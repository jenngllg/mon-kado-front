import {
  createHomeView,
  createPlaceholderView,
} from "../views/index.js";
import {
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";
import { createSessionGuard } from "../auth/sessionGuards.js";
import { createRegistrationService } from "../features/registration/registrationService.js";
import { createRegistrationView } from "../features/registration/registrationView.js";
import { createEmailConfirmationService } from "../features/emailConfirmation/emailConfirmationService.js";
import { createEmailConfirmationView } from "../features/emailConfirmation/emailConfirmationView.js";
import { createProfileService } from "../features/profile/profileService.js";
import { createProfileView } from "../features/profile/profileView.js";
import { createLoginService } from "../features/login/loginService.js";
import { createLoginView } from "../features/login/loginView.js";
import { createPasswordRecoveryService } from "../features/passwordRecovery/passwordRecoveryService.js";
import { createForgotPasswordView, createResetPasswordView } from "../features/passwordRecovery/passwordRecoveryViews.js";
import { createPasswordChangeService } from "../features/passwordChange/passwordChangeService.js";
import { createPasswordChangeView } from "../features/passwordChange/passwordChangeView.js";

export {
  NavigationItems,
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";

const PlaceholderMessage =
  "Cette fonctionnalité sera disponible dans un prochain lot.";

/** @param {import("../auth/sessionManager.js").SessionManager} session Session facade.
 * @param {() => boolean} consumePasswordChangeNotice Local, single-use login notice.
 */
function createPageRoutes(session, consumePasswordChangeNotice) {
  return Object.freeze([
    {
      name: RouteNames.Login,
      path: RoutePaths.Login,
      title: "Se connecter · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createLoginView({ login: createLoginService(session), session, signal: context.signal,
          passwordChanged: consumePasswordChangeNotice() }),
    },
    createPlaceholderRoute(
      RouteNames.LinkGoogle,
      RoutePaths.LinkGoogle,
      "Connexion avec Google",
      "Compte MonKado",
    ),
    {
      name: RouteNames.Register,
      path: RoutePaths.Register,
      title: "Créer un compte · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createRegistrationView({ register: createRegistrationService(session), signal: context.signal }),
    },
    {
      name: RouteNames.ConfirmEmail,
      path: RoutePaths.ConfirmEmail,
      title: "Confirmer l’adresse e-mail · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createEmailConfirmationView({ ...createEmailConfirmationService(session),
          consumeFragment: context.consumeFragment, signal: context.signal }),
    },
    createPlaceholderRoute(
      RouteNames.ConfirmEmailChange,
      RoutePaths.ConfirmEmailChange,
      "Confirmer la nouvelle adresse e-mail",
      "Sécurité du compte",
    ),
    {
      name: RouteNames.ForgotPassword, path: RoutePaths.ForgotPassword, title: "Mot de passe oublié · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createForgotPasswordView({ ...createPasswordRecoveryService(session), signal: context.signal }),
    },
    {
      name: RouteNames.ResetPassword, path: RoutePaths.ResetPassword, title: "Réinitialiser le mot de passe · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createResetPasswordView({ ...createPasswordRecoveryService(session), consumeFragment: context.consumeFragment, signal: context.signal }),
    },
    {
      name: RouteNames.Profile,
      path: RoutePaths.Profile,
      title: "Mon profil · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createProfileView({ ...createProfileService(session), signal: context.signal }),
    },
    {
      name: RouteNames.PasswordChange, path: RoutePaths.PasswordChange, title: "Changer mon mot de passe · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createPasswordChangeView({ ...createPasswordChangeService(session), signal: context.signal }),
    },
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
}

/**
 * Creates the complete frontend route catalogue.
 *
 * @param {{session: import("../auth/sessionManager.js").SessionManager, consumePasswordChangeNotice?: () => boolean}} options Session and local notice dependencies.
 * @returns {ReadonlyArray<import("../router/router.js").RouteDefinition>} Application routes.
 */
export function createApplicationRoutes({ session, consumePasswordChangeNotice = () => false }) {
  return [
    Object.freeze({
      name: RouteNames.Home,
      path: RoutePaths.Home,
      title: "MonKado · Les cadeaux qui font vraiment plaisir",
      render: createHomeView,
    }),
    ...createPageRoutes(session, consumePasswordChangeNotice).map(route => Object.freeze({ ...route, beforeEnter: createSessionGuard(route.name, session) })),
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
