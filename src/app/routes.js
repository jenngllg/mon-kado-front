import {
  createHomeView,
  createPlaceholderView,
} from "../views/index.js";
import {
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";
import { createSessionGuard } from "../auth/sessionGuards.js";
import { createMemberSearchService } from "../features/members/memberSearchService.js";
import { createMemberSearchView } from "../features/members/memberSearchView.js";
import { createMemberProfileService } from "../features/members/memberProfileService.js";
import { createMemberProfileView } from "../features/members/memberProfileView.js";
import { createMemberNavigation } from "../features/members/memberNavigation.js";
import { createReservationHistoryService } from "../features/reservations/reservationHistoryService.js";
import { createReservationHistoryView } from "../features/reservations/reservationHistoryView.js";
import { registerComponentCleanup } from "../components/componentLifecycle.js";
import { createRegistrationService } from "../features/registration/registrationService.js";
import { createRegistrationView } from "../features/registration/registrationView.js";
import { createEmailConfirmationService } from "../features/emailConfirmation/emailConfirmationService.js";
import { createEmailConfirmationView } from "../features/emailConfirmation/emailConfirmationView.js";
import { createProfileService } from "../features/profile/profileService.js";
import { createProfileView } from "../features/profile/profileView.js";
import { createAccountLayout } from "../components/accountLayout.js";
import { createPersonalDataService } from "../features/privacy/personalDataService.js";
import { createPersonalDataView } from "../features/privacy/personalDataView.js";
import { createAccountDeletionView } from "../features/privacy/accountDeletionView.js";
import { createAccountDeletionService } from "../features/privacy/accountDeletionService.js";
import { createAuthenticatorService } from "../features/twoFactor/authenticatorService.js";
import { createAuthenticatorView } from "../features/twoFactor/authenticatorView.js";
import { createLoginService } from "../features/login/loginService.js";
import { createLoginView } from "../features/login/loginView.js";
import { createPasswordRecoveryService } from "../features/passwordRecovery/passwordRecoveryService.js";
import { createForgotPasswordView, createResetPasswordView } from "../features/passwordRecovery/passwordRecoveryViews.js";
import { createPasswordChangeService } from "../features/passwordChange/passwordChangeService.js";
import { createPasswordChangeView } from "../features/passwordChange/passwordChangeView.js";
import { createEmailChangeService } from "../features/emailChange/emailChangeService.js";
import { createEmailChangeView } from "../features/emailChange/emailChangeView.js";
import { createEmailChangeConfirmationView } from "../features/emailChange/emailChangeConfirmationView.js";
import { createGoogleReturnView } from "../features/google/googleReturnView.js";
import { createGoogleLinkView } from "../features/google/googleLinkView.js";
import { createWishlistsService } from "../features/wishlists/wishlistsService.js";
import { createWishlistShareService } from "../features/wishlists/wishlistShareService.js";
import { createWishImportService } from "../features/wishes/wishImportService.js";
import { createWishlistsView } from "../features/wishlists/wishlistsView.js";
import { createWishlistView } from "../features/wishlists/createWishlistView.js";
import { createWishlistEditView } from "../features/wishlists/wishlistEditView.js";
import { createWishlistDeleteView } from "../features/wishlists/wishlistDeleteView.js";
import { createWishlistDetailsView } from "../features/wishlists/wishlistDetailsView.js";
import { createWishesService } from "../features/wishes/wishesService.js";
import { createWishCreateView } from "../features/wishes/wishCreateView.js";
import { createWishEditView } from "../features/wishes/wishEditView.js";
import { createWishDetailsView } from "../features/wishes/wishDetailsView.js";
import { createSharedWishlistContext } from "../features/sharing/sharedWishlistContext.js";
import { createSharedWishlistService } from "../features/sharing/sharedWishlistService.js";
import { createWishlistReportService } from "../features/sharing/wishlistReportService.js";
import { createSharedWishlistView, createSharedWishlistEntryView } from "../features/sharing/sharedWishlistView.js";
import { createSharedWishView } from "../features/sharing/sharedWishView.js";
import { createSharedSessionView } from "../features/sharing/sharedSessionView.js";
import { createGiftReservationService } from "../features/sharing/giftReservationService.js";
import { createGiftReservationSection } from "../features/sharing/giftReservationSection.js";
import { createReservationCreateForm } from "../features/sharing/reservationCreateForm.js";
import { createReservationEditForm } from "../features/sharing/reservationEditForm.js";
import { createReservationCancelDialog } from "../features/sharing/reservationCancelDialog.js";
import { createWishlistParticipationService } from "../features/sharing/wishlistParticipationService.js";
import { createGuestParticipationHost } from "../features/sharing/guestParticipationHost.js";

/** @typedef {(created: import("../features/wishlists/wishlistsService.js").CreatedWishlist, context: import("../router/router.js").RouteContext) => void | Promise<void>} WishlistCreatedHandler */
/** @typedef {(context: import("../router/router.js").RouteContext) => void | Promise<void>} WishlistDeletedHandler */
/** @typedef {(created: import("../features/wishes/wishesService.js").CreatedWish, context: import("../router/router.js").RouteContext) => void | Promise<void>} WishCreatedHandler */

/** @typedef {{google?: import("../features/google/googleService.js").GoogleService,
 * onGoogleDestination?: (path: string) => void, onGoogleAuthenticated?: () => void,
 * onGoogleLinkDestination?: (path: string) => void,
 * onGoogleLinkRequired?: () => void}} GoogleRouteOptions */

export {
  NavigationItems,
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";

/** @param {import("../auth/sessionManager.js").SessionManager} session Session facade.
 * @param {() => boolean} consumePasswordChangeNotice Local, single-use login notice.
 * @param {GoogleRouteOptions} googleFlow External return integration.
 * @param {WishlistCreatedHandler} onWishlistCreated Local creation completion.
 * @param {WishlistDeletedHandler} onWishlistDeleted Local deletion completion.
 * @param {string} apiBaseUrl Trusted origin for signed gift images.
 * @param {WishCreatedHandler} onWishCreated Local gift creation completion.
 * @param {WishlistDeletedHandler} onWishDeleted Local gift deletion completion.
 * @param {import("../features/sharing/sharedWishlistContext.js").SharedWishlistContext} sharing Private tab context.
 * @param {SharingSignInOptions} sharingSignIn Dedicated sign-in integration.
 * @param {WishlistDeletedHandler} onWishlistShareRevoked Confirmed share revocation notice.
 */
function createPageRoutes(session, consumePasswordChangeNotice, googleFlow, onWishlistCreated, onWishlistDeleted, apiBaseUrl, onWishCreated, onWishDeleted, sharing, sharingSignIn, onWishlistShareRevoked) {
  const memberSearchState = { query: "", page: 1 };
  const memberNavigation = createMemberNavigation();
  const { google, onGoogleDestination = () => {}, onGoogleAuthenticated = () => {}, onGoogleLinkRequired = () => {}, onGoogleLinkDestination = () => {} } = googleFlow;
  return Object.freeze([
    {
      name: RouteNames.Members, path: RoutePaths.Members, title: "Rechercher un membre · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createMemberSearchView({ ...createMemberSearchService(session, { apiBaseUrl }), signal: context.signal, state: memberSearchState }),
    },
    {
      name: RouteNames.MemberProfile, path: RoutePaths.MemberProfile, title: "Profil du membre · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createMemberProfileView({ memberId: context.params.memberId, ...createMemberProfileService(session, { apiBaseUrl, frontendOrigin: window.location.origin }), signal: context.signal }),
    },
    {
      name: RouteNames.Login,
      path: RoutePaths.Login,
      title: "Se connecter · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createLoginView({ login: createLoginService(session), session, signal: context.signal,
          sharedReturn: sharingSignIn.continuation?.bindLogin(context.signal),
          passwordChanged: consumePasswordChangeNotice(), startGoogle: google?.enabled ? google.start : undefined,
          returnTo: RoutePaths.Lists }),
    },
    {
      name: RouteNames.LinkGoogle, path: RoutePaths.LinkGoogle, title: "Associer Google · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) => {
        context.consumeFragment();
        return createGoogleLinkView({ continuation: google?.takeLinkContinuation() ?? null, session,
          signal: context.signal, onDestination: onGoogleLinkDestination, onAuthenticated: onGoogleAuthenticated });
      },
    },
    {
      name: RouteNames.GoogleReturn, path: RoutePaths.GoogleReturn, title: "Connexion avec Google · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) => {
        if (!google) {
          context.consumeFragment();
          return createPlaceholderView({ title: "Connexion Google indisponible", message: "Tu peux utiliser la connexion par e-mail.", eyebrow: "Compte MonKado" });
        }
        return createGoogleReturnView({ google, session, consumeFragment: context.consumeFragment, signal: context.signal,
          onDestination: onGoogleDestination, onAuthenticated: onGoogleAuthenticated, onLinkRequired: onGoogleLinkRequired });
      },
    },
    {
      name: RouteNames.Register,
      path: RoutePaths.Register,
      title: "Créer un compte · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createRegistrationView({ register: createRegistrationService(session), signal: context.signal,
          startGoogle: google?.enabled ? google.start : undefined }),
    },
    {
      name: RouteNames.ConfirmEmail,
      path: RoutePaths.ConfirmEmail,
      title: "Confirmer l’adresse e-mail · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createEmailConfirmationView({ ...createEmailConfirmationService(session),
          consumeFragment: context.consumeFragment, signal: context.signal }),
    },
    {
      name: RouteNames.ConfirmEmailChange, path: RoutePaths.ConfirmEmailChange, title: "Confirmer la nouvelle adresse e-mail · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createEmailChangeConfirmationView({ ...createEmailChangeService(session), consumeFragment: context.consumeFragment, signal: context.signal }),
    },
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
        createAccountLayout(createProfileView({ ...createProfileService(session, { apiBaseUrl }), signal: context.signal }), RoutePaths.Profile, session),
    },
    {
      name: RouteNames.PasswordChange, path: RoutePaths.PasswordChange, title: "Changer mon mot de passe · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createAccountLayout(createPasswordChangeView({ ...createPasswordChangeService(session), signal: context.signal }), RoutePaths.PasswordChange, session),
    },
    {
      name: RouteNames.PersonalData, path: RoutePaths.PersonalData, title: "Mes données personnelles · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createAccountLayout(createPersonalDataView({ service: createPersonalDataService(session), signal: context.signal }), RoutePaths.PersonalData, session),
    },
    {
      name: RouteNames.Authenticator, path: RoutePaths.Authenticator, title: "Mon authentificateur · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createAccountLayout(createAuthenticatorView({ service: createAuthenticatorService(session), session, signal: context.signal,
          onFinished: () => { void context.navigate(RoutePaths.Login); } }), RoutePaths.Authenticator, session),
    },
    {
      name: RouteNames.ConfirmAccountDeletion, path: RoutePaths.ConfirmAccountDeletion, title: "Supprimer mon compte · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createAccountDeletionView({ session, service: createAccountDeletionService(session), consumeFragment: context.consumeFragment, signal: context.signal }),
    },
    {
      name: RouteNames.EmailChange, path: RoutePaths.EmailChange, title: "Changer mon adresse e-mail · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createAccountLayout(createEmailChangeView({ load: createProfileService(session).load, ...createEmailChangeService(session), signal: context.signal }), RoutePaths.EmailChange, session),
    },
    {
      name: RouteNames.Lists, path: RoutePaths.Lists, title: "Mes listes · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishlistsView({ ...createWishlistsService(session), isArchived: context.searchParams.get("isArchived") === "true", signal: context.signal }),
    },
    {
      name: RouteNames.NewList, path: RoutePaths.NewList, title: "Créer une liste · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishlistView({ create: createWishlistsService(session).create, signal: context.signal,
          onCreated: created => onWishlistCreated(created, context) }),
    },
    {
      name: RouteNames.EditList, path: RoutePaths.EditList, title: "Modifier ma liste · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishlistEditView({ ...createWishlistsService(session), wishlistId: context.params.listId, signal: context.signal }),
    },
    {
      name: RouteNames.DeleteList, path: RoutePaths.DeleteList, title: "Supprimer une liste · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishlistDeleteView({ ...createWishlistsService(session), wishlistId: context.params.listId, signal: context.signal,
          onDeleted: () => onWishlistDeleted(context) }),
    },
    {
      name: RouteNames.NewWish, path: RoutePaths.NewWish, title: "Ajouter un souhait · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const wishes = createWishesService(session, { apiBaseUrl });
        return createWishCreateView({ wishlistId: context.params.listId, loadOne: createWishlistsService(session).loadOne,
          create: wishes.create, uploadImage: wishes.uploadImage, loadWish: wishes.loadOne, preview: createWishImportService(session).preview,
          initialMode: context.searchParams.getAll("mode").length === 1 ? context.searchParams.get("mode") ?? "" : "",
          signal: context.signal, onCreated: created => onWishCreated(created, context) });
      },
    },
    {
      name: RouteNames.EditWish, path: RoutePaths.EditWish, title: "Modifier un souhait · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishEditView({ ...createWishesService(session, { apiBaseUrl }), wishlistId: context.params.listId, wishId: context.params.wishId,
          returnSort: context.searchParams.get("sort"),
          preview: createWishImportService(session).preview,
          loadWishlist: createWishlistsService(session).loadOne, signal: context.signal, onDeleted: () => onWishDeleted(context) }),
    },
    {
      name: RouteNames.WishDetails, path: RoutePaths.WishDetails, title: "Détail du souhait · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishDetailsView({ ...createWishesService(session, { apiBaseUrl }), wishlistId: context.params.listId, wishId: context.params.wishId, signal: context.signal, returnSort: context.searchParams.get("sort") }),
    },
    {
      name: RouteNames.ListDetails, path: RoutePaths.ListDetails, title: "Détail de la liste · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createWishlistDetailsView({ wishlistId: context.params.listId, loadOne: createWishlistsService(session).loadOne,
          initialSort: context.searchParams.get("sort"), onSortChange: sort => context.replaceSearchParameter("sort", sort === "listOrder" ? null : sort),
          setArchived: createWishlistsService(session).setArchived,
          favorite: createWishesService(session, { apiBaseUrl }),
          deletion: createWishesService(session, { apiBaseUrl }),
          onDeleted: () => onWishDeleted(context),
          loadWishes: createWishesService(session, { apiBaseUrl }).load, reorder: createWishesService(session, { apiBaseUrl }).reorder, signal: context.signal,
          share: { ...createWishlistShareService(session, { frontendOrigin: window.location.origin }),
            onRevoked: () => onWishlistShareRevoked(context),
            copyText: text => navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable")) } }),
    },
    {
      name: RouteNames.Reservations, path: RoutePaths.Reservations, title: "Mes réservations · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) =>
        createReservationHistoryView({ ...createReservationHistoryService(session, { apiBaseUrl }), signal: context.signal,
          createCancel: (item, callbacks) => {
            const access = createSharedWishlistContext();
            const target = new URL(item.wishHref ?? "", window.location.origin);
            const [, , shareLinkId, , wishId] = target.pathname.split("/");
            access.enter(shareLinkId, target.hash);
            const reservations = createGiftReservationService(session, { context: access, authentication: "required" });
            const wishes = createSharedWishlistService(session, { apiBaseUrl, context: access, authentication: "required" });
            const dialog = createReservationCancelDialog({ ...callbacks, signal: context.signal,
              cancel: (etag, signal) => reservations.cancel(shareLinkId, wishId, { etag, signal }),
              load: async signal => {
                const wish = await wishes.loadOne(shareLinkId, wishId, { signal });
                const lookup = await reservations.loadCurrent(shareLinkId, wishId, { signal });
                return { name: wish.name, lookup };
              },
            });
            registerComponentCleanup(dialog, () => access.dispose());
            return dialog;
          },
          onOpenWish: href => {
            const target = new URL(href, window.location.origin);
            const shareLinkId = target.pathname.split("/")[2];
            if (sharing.enter(shareLinkId, target.hash) === "ready") void context.navigate(target.pathname);
          } }),
    },
    {
      name: RouteNames.SharedWishlist, path: RoutePaths.SharedWishlist, title: "Liste de souhaits partagée · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const fragment = context.consumeFragment();
        const fromMemberId = memberNavigation.read(context.params.shareLinkId, context.searchParams, !!fragment);
        const state = sharing.enter(context.params.shareLinkId, fragment);
        if (state !== "ready") return createSharedWishlistEntryView(state, fromMemberId);
        return createSharedSessionView(session, identity => createSharedWishlistView({ shareLinkId: context.params.shareLinkId, signal: context.signal, fromMemberId,
          initialSort: context.searchParams.get("sort"), onSortChange: sort => context.replaceSearchParameter("sort", sort === "listOrder" ? null : sort),
          accessSignal: sharing.observe(context.params.shareLinkId) ?? undefined,
          report: createWishlistReportService(session, { context: sharing }).report,
          load: createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).load }), context.signal);
      },
    },
    {
      name: RouteNames.SharedWish, path: RoutePaths.SharedWish, title: "Souhait partagé · MonKado",
      render: (/** @type {import("../router/router.js").RouteContext} */ context) => {
        // Only an original list link can establish access; a detail fragment is discarded.
        context.consumeFragment();
        const fromMemberId = memberNavigation.read(context.params.shareLinkId, context.searchParams);
        const state = sharing.enter(context.params.shareLinkId, "");
        if (state !== "ready") return createSharedWishlistEntryView(state, fromMemberId);
        const resumeAccount = sharingSignIn.continuation?.takeResume(context.params.shareLinkId);
        return createSharedSessionView(session, identity => createSharedWishView({ shareLinkId: context.params.shareLinkId, wishId: context.params.wishId, signal: context.signal, fromMemberId,
          returnSort: context.searchParams.get("sort"),
          ...(identity.includeCurrent ? { createReservation: (onUnavailable, wish, onSaved, onBusy, onUnrecognized, onVerified) => createGiftReservationSection({
            shareLinkId: context.params.shareLinkId, wishId: context.params.wishId, signal: context.signal, onUnavailable, onBusy, onUnrecognized, fromMemberId,
            loadCurrent: createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).loadCurrent,
            createIdentification: onRecognized => createGuestParticipationHost(session, {
              shareLinkId: context.params.shareLinkId, signal: context.signal, onUnavailable, onRecognized,
              resumeAccount,
              onSignIn: () => sharingSignIn.onSignIn?.(context.params.shareLinkId, context.params.wishId),
              ...createWishlistParticipationService(session, { context: sharing }),
            }),
            onCancelled: () => onSaved("Réservation annulée"),
            createCancel: (onInvalidate, onClose) => createReservationCancelDialog({ signal: context.signal, onInvalidate, onClose, onUnavailable,
              cancel: (etag, signal) => createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).cancel(context.params.shareLinkId, wish.id, { etag, signal }),
              load: async signal => {
                const fresh = await createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne(context.params.shareLinkId, wish.id, { signal });
                const lookup = await createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).loadCurrent(context.params.shareLinkId, wish.id, { signal });
                if (lookup.state === "unrecognized") onUnrecognized();
                return { name: fresh.name, lookup };
              },
            }),
            editForm: wish.quantity === 1 ? undefined : (reservation, onBusy, showLookup) => createReservationEditForm({ reservation, available: wish.availableQuantity ?? 0, signal: context.signal, onSaved: () => onSaved("Réservation modifiée"), onUnavailable, onBusy,
              update: (quantity, etag, signal) => createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).update(context.params.shareLinkId, wish.id, quantity, { etag, signal }),
              verify: async signal => {
                const fresh = await createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne(context.params.shareLinkId, wish.id, { signal });
                const lookup = await createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).loadCurrent(context.params.shareLinkId, wish.id, { signal });
                onVerified(fresh); showLookup(lookup);
                if (lookup.state === "unrecognized") onUnrecognized();
                if (fresh.availableQuantity === null) throw new Error("Reservation quantities unavailable");
                return { available: fresh.availableQuantity, lookup };
              },
            }),
            createForm: (onBusy, showLookup, reserveImmediately) => createReservationCreateForm({ available: wish.availableQuantity ?? 0, singleItem: wish.quantity === 1, submitOnReady: reserveImmediately, signal: context.signal, onSaved, onUnavailable, onBusy,
              create: (quantity, signal) => createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).create(context.params.shareLinkId, wish.id, quantity, { signal }),
              verify: async signal => {
                const fresh = await createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne(context.params.shareLinkId, wish.id, { signal });
                const lookup = await createGiftReservationService(session, { context: sharing, authentication: identity.authentication }).loadCurrent(context.params.shareLinkId, wish.id, { signal });
                onVerified(fresh); showLookup(lookup);
                if (lookup.state === "unrecognized") onUnrecognized();
                if (fresh.availableQuantity === null) throw new Error("Reservation quantities unavailable");
                return { available: fresh.availableQuantity, lookup };
              },
            }),
          }) } : {}),
          accessSignal: sharing.observe(context.params.shareLinkId) ?? undefined,
          loadOne: createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne }), context.signal);
      },
    },
  ]);
}

/** @typedef {{continuation?: import("../features/sharing/sharedSignInContinuation.js").SharedSignInContinuation, onSignIn?: (id: string, wishId?: string) => void}} SharingSignInOptions */
/**
 * Creates the complete frontend route catalogue.
 *
 * @param {{session: import("../auth/sessionManager.js").SessionManager, apiBaseUrl: string, sharingSignIn?: SharingSignInOptions, sharing?: import("../features/sharing/sharedWishlistContext.js").SharedWishlistContext, consumePasswordChangeNotice?: () => boolean, onWishlistCreated?: WishlistCreatedHandler, onWishlistDeleted?: WishlistDeletedHandler, onWishCreated?: WishCreatedHandler, onWishDeleted?: WishlistDeletedHandler, onWishlistShareRevoked?: WishlistDeletedHandler} & GoogleRouteOptions} options Session and local notice dependencies.
 * @returns {ReadonlyArray<import("../router/router.js").RouteDefinition>} Application routes.
 */
export function createApplicationRoutes({ session, apiBaseUrl, sharingSignIn = {}, sharing = createSharedWishlistContext(), consumePasswordChangeNotice = () => false, onWishlistCreated = () => {}, onWishlistDeleted = () => {}, onWishCreated = () => {}, onWishDeleted = () => {}, onWishlistShareRevoked = () => {}, ...googleFlow }) {
  return [
    Object.freeze({
      name: RouteNames.Home,
      path: RoutePaths.Home,
      title: "MonKado · Les souhaits qui font vraiment plaisir",
      render: () => createHomeView(session),
    }),
    ...createPageRoutes(session, consumePasswordChangeNotice, googleFlow, onWishlistCreated, onWishlistDeleted, apiBaseUrl, onWishCreated, onWishDeleted, sharing, sharingSignIn, onWishlistShareRevoked).map(route => Object.freeze({ ...route, beforeEnter: createSessionGuard(route.name, session) })),
  ];
}
