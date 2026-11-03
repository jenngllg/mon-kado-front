import { createLoadingState } from "../components/index.js";
import { withResourcePageTitle } from "./resourcePageTitle.js";
import { createGroupsService } from "../features/groups/groupsService.js";
import { createDashboardService } from "../features/home/dashboardService.js";
import { createGroupMemberProfileService } from "../features/groups/groupMemberProfileService.js";
import { createGroupJoinContinuation } from "../features/groups/groupJoinContinuation.js";
import { createGroupWishlistService } from "../features/groups/groupWishlistService.js";
import { createGroupWishReservation } from "../features/groups/groupWishReservation.js";
import { createGroupSuggestionsService } from "../features/groups/groupSuggestionsService.js";
import { memberOriginQuery } from "../features/members/memberNavigation.js";
import { withWishSort } from "../features/wishes/wishSorting.js";
import { ApiError, createAbortError } from "../api/apiError.js";
import {
  createSessionHomeView,
  createPlaceholderView,
} from "../views/index.js";
import {
  RouteNames,
  RoutePaths,
} from "./routeContracts.js";
import { createSessionGuard, getLoginDestination } from "../auth/sessionGuards.js";
import { createWishlistReportReviewService } from "../features/admin/wishlistReportReviewService.js";
import { createWishlistModerationService } from "../features/admin/wishlistModerationService.js";
import { createWishlistHistoryService } from "../features/admin/wishlistHistoryService.js";
import { createReportedWishlistsService } from "../features/admin/reportedWishlistsService.js";
import { createMemberSearchService } from "../features/members/memberSearchService.js";
import { createMemberProfileService } from "../features/members/memberProfileService.js";
import { createMemberNavigation } from "../features/members/memberNavigation.js";
import { createReservationHistoryService } from "../features/reservations/reservationHistoryService.js";
import { createWishlistSubscriptionsService } from "../features/subscriptions/wishlistSubscriptionsService.js";
import { createWishlistSubscriptionControl } from "../features/subscriptions/wishlistSubscriptionControl.js";
import { createButton } from "../components/button.js";
import { applyActionIcon } from "../components/actionIcon.js";
import { registerComponentCleanup } from "../components/componentLifecycle.js";
import { createRegistrationService } from "../features/registration/registrationService.js";
import { createEmailConfirmationService } from "../features/emailConfirmation/emailConfirmationService.js";
import { createProfileService } from "../features/profile/profileService.js";
import { readProfilePhoto } from "../features/profile/profileImageService.js";
import { createAccountLayout } from "../components/accountLayout.js";
import { createPersonalDataService } from "../features/privacy/personalDataService.js";
import { createAccountDeletionService } from "../features/privacy/accountDeletionService.js";
import { createAuthenticatorService } from "../features/twoFactor/authenticatorService.js";
import { createLoginService } from "../features/login/loginService.js";
import { createPasswordRecoveryService } from "../features/passwordRecovery/passwordRecoveryService.js";
import { createPasswordChangeService } from "../features/passwordChange/passwordChangeService.js";
import { createEmailChangeService } from "../features/emailChange/emailChangeService.js";
import { createWishlistsService } from "../features/wishlists/wishlistsService.js";
import { createWishlistShareService } from "../features/wishlists/wishlistShareService.js";
import { createWishesService } from "../features/wishes/wishesService.js";
import { readExtensionProduct } from "../features/extension/extensionProduct.js";
import { createSharedWishlistContext } from "../features/sharing/sharedWishlistContext.js";
import { createSharedWishlistService } from "../features/sharing/sharedWishlistService.js";
import { createWishlistReportService } from "../features/sharing/wishlistReportService.js";
import { createSharedWishReservation } from "../features/sharing/sharedWishReservation.js";
import { createGiftReservationService } from "../features/sharing/giftReservationService.js";
import { createOwnedGiftReservationService } from "../features/sharing/ownedGiftReservationService.js";
import { createPersonalReservationsReader } from "../features/sharing/personalReservations.js";
import { createReservationCancelDialog } from "../features/sharing/reservationCancelDialog.js";

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
 * @param {WishlistCreatedHandler} onWishlistUpdated Confirmed list update completion.
 * @param {ReturnType<typeof createGroupJoinContinuation>} groupJoin Pending group admission.
 */
function createPageRoutes(session, consumePasswordChangeNotice, googleFlow, onWishlistCreated, onWishlistDeleted, apiBaseUrl, onWishCreated, onWishDeleted, sharing, sharingSignIn, onWishlistShareRevoked, onWishlistUpdated, groupJoin) {
  /** Recover only a currently published link from its public member profile, never from browser storage.
   * @param {import("../router/router.js").RouteContext} context Current navigation.
   * @param {string} memberId Public origin.
   * @param {(photoUrl: string | null) => void} [onOwnerPhoto] Validated public owner photo, without retaining bearer links.
   * @returns {Promise<"ready" | "unavailable">} Fresh public access state. */
  async function recoverMemberAccess(context, memberId, onOwnerPhoto = () => {}) {
    try {
      const profile = await createMemberProfileService(session, { apiBaseUrl, frontendOrigin: window.location.origin }).load(memberId, { signal: context.signal });
      if (context.signal.aborted) throw createAbortError();
      const link = profile.wishlists.find(list => new URL(list.shareHref, window.location.origin).pathname === `/shared-wishlists/${context.params.shareLinkId.toLowerCase()}`);
      if (!link) return "unavailable";
      onOwnerPhoto(profile.photo.imageUrl);
      return sharing.enter(context.params.shareLinkId, new URL(link.shareHref, window.location.origin).hash) === "ready" ? "ready" : "unavailable";
    } catch (error) {
      if (context.signal.aborted) throw createAbortError();
      if (error instanceof ApiError && error.statusCode === 404) return "unavailable";
      throw error;
    }
  }
  /** @param {string} shareLinkId Current private context. @returns {import("../features/sharing/wishCopyActions.js").WishCopyOperations} Explicit authenticated operations. */
  function copyOperations(shareLinkId) {
    const lists = createWishlistsService(session);
    const source = createSharedWishlistService(session, { apiBaseUrl, context: sharing, authentication: "required", includeCurrent: false });
    /** @type {string | null} */ let sourceWishlistId = null;
    return {
      loadLists: async options => {
        const destinations = await lists.load(options);
        if (options.signal.aborted) throw createAbortError();
        if (!destinations.some(item => !item.isArchived && !item.isSuspended)) return destinations;
        // A share-link ID is not the list ID. Resolve it once per screen, without comparing names or inspecting each owned list.
        if (sourceWishlistId === null) {
          const wishlist = await source.load(shareLinkId, { signal: options.signal });
          if (options.signal.aborted) throw createAbortError();
          sourceWishlistId = wishlist.id.toLowerCase();
        }
        return Object.freeze(destinations.filter(item => item.id.toLowerCase() !== sourceWishlistId));
      },
      copy: (wishlistId, wishId, { signal }) => sharing.run(shareLinkId, (shareToken, contextSignal) =>
        createWishesService(session, { apiBaseUrl }).copy(wishlistId, shareLinkId, wishId, { shareToken, signal: AbortSignal.any([signal, contextSignal]) })),
    };
  }
  /** @param {string} sourceWishlistId Owned source. @returns {import("../features/sharing/wishCopyActions.js").WishCopyOperations} No sharing required. */
  function ownedCopyOperations(sourceWishlistId) {
    return {
      loadLists: createWishlistsService(session).load,
      copy: (destinationWishlistId, wishId, options) => createWishesService(session, { apiBaseUrl }).copyOwned(sourceWishlistId, wishId, destinationWishlistId, options),
    };
  }
  /** @param {string} groupId Membership scope. @param {string} sourceWishlistId Private source. @returns {import("../features/sharing/wishCopyActions.js").WishCopyOperations} */
  function groupCopyOperations(groupId, sourceWishlistId) {
    return {
      loadLists: async options => Object.freeze((await createWishlistsService(session).load(options)).filter(item => item.id.toLowerCase() !== sourceWishlistId.toLowerCase())),
      copy: (destinationWishlistId, wishId, options) => createWishesService(session, { apiBaseUrl }).copyGroup(groupId, sourceWishlistId, wishId, destinationWishlistId, options),
    };
  }
  const memberSearchState = { query: "", page: 1 };
  const memberNavigation = createMemberNavigation();
  const { google, onGoogleDestination = () => {}, onGoogleAuthenticated = () => {}, onGoogleLinkRequired = () => {}, onGoogleLinkDestination = () => {} } = googleFlow;
  return Object.freeze([
    {
      name: RouteNames.GroupJoin, path: RoutePaths.GroupJoin, title: "Rejoindre un groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createGroupJoinView } = await import("../features/groups/groupJoinView.js");
        if (context.signal.aborted) throw createAbortError();
        const path = RoutePaths.GroupJoin;
        const fragment = takeFragment();
        if (fragment) groupJoin.clear();
        return createGroupJoinView({ session, service: createGroupsService(session), apiBaseUrl, code: fragment || groupJoin.codeFor(path), signal: context.signal, navigate: path => { void context.navigate(path); },
          onAuthenticate: code => groupJoin.prepare(path, code), onJoined: groupJoin.clear });
      },
    },
    {
      name: RouteNames.GroupInvitation, path: RoutePaths.GroupInvitation, title: "Invitation au groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createGroupJoinView } = await import("../features/groups/groupJoinView.js");
        if (context.signal.aborted) throw createAbortError();
        const path = RoutePaths.GroupInvitation.replace(":groupId", context.params.groupId);
        const fragment = takeFragment();
        if (fragment) groupJoin.clear();
        return createGroupJoinView({ session, service: createGroupsService(session), apiBaseUrl, groupId: context.params.groupId, code: fragment || groupJoin.codeFor(path), signal: context.signal, navigate: path => { void context.navigate(path); },
          onAuthenticate: code => groupJoin.prepare(path, code), onJoined: groupJoin.clear });
      },
    },
    {
      name: RouteNames.Groups, path: RoutePaths.Groups, title: "Mes groupes · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createGroupsView } = await import("../features/groups/groupsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createGroupsView({ service: createGroupsService(session), apiBaseUrl, signal: context.signal, navigate: path => { void context.navigate(path); } });
      },
    },
    {
      name: RouteNames.GroupEdit, path: RoutePaths.GroupEdit, title: "Modifier le groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createGroupEditView } = await import("../features/groups/groupEditView.js");
        if (context.signal.aborted) throw createAbortError();
        return createGroupEditView({
        service: createGroupsService(session), groupId: context.params.groupId, memberId: session.getSnapshot().user?.id ?? "", apiBaseUrl,
        signal: context.signal, navigate: path => { void context.navigate(path); },
      });
      },
    },
    {
      name: RouteNames.Group, path: RoutePaths.Group, title: "Mon groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createGroupView } = await import("../features/groups/groupsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createGroupView({
        service: createGroupsService(session), groupId: context.params.groupId, memberId: session.getSnapshot().user?.id ?? "", apiBaseUrl,
        signal: context.signal, navigate: path => { void context.navigate(path); },
      });
      },
    },
    {
      name: RouteNames.GroupMember, path: RoutePaths.GroupMember, title: "Listes du membre · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createMemberProfileView } = await import("../features/members/memberProfileView.js");
        if (context.signal.aborted) throw createAbortError();
        return createMemberProfileView({
        memberId: context.params.memberId, backHref: `/groups/${context.params.groupId}`, backLabel: "Retour au groupe", signal: context.signal,
        load: withResourcePageTitle(createGroupMemberProfileService(createGroupsService(session), { groupId: context.params.groupId, apiBaseUrl, currentUserId: session.getSnapshot().user?.id }).load, context, profile => profile.displayName),
      });
      },
    },
    {
      name: RouteNames.GroupWishlist, path: RoutePaths.GroupWishlist, title: "Liste du groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createGroupSuggestionsView }, { createSharedWishlistView }] = await Promise.all([import("../features/groups/groupSuggestionsView.js"), import("../features/sharing/sharedWishlistView.js")]);
        if (context.signal.aborted) throw createAbortError();
        const { groupId, wishlistId } = context.params;
        const wishes = createGroupWishlistService(session, { groupId, apiBaseUrl });
        return createSharedWishlistView({ groupId, shareLinkId: wishlistId, currentUserId: session.getSnapshot().user?.id, loadPersonalReservations: createPersonalReservationsReader(session), signal: context.signal, fromMemberId: context.searchParams.get("fromMember"),
          copy: groupCopyOperations(groupId, wishlistId),
          createSuggestions: ({ownerName, signal, returnSort}) => createGroupSuggestionsView({service:createGroupSuggestionsService(session, {groupId,wishlistId}),ownerName,signal,getReturnSort:returnSort,listHref:withWishSort(`/groups/${groupId}/wishlists/${wishlistId}${memberOriginQuery(context.searchParams.get("fromMember"))}`,context.searchParams.get("sort"))}),
          load: withResourcePageTitle(wishes.load, context, result => result.name), loadOne: wishes.loadOne,
          createSubscription: ({ signal, onUnavailable }) => createWishlistSubscriptionControl({
            shareLinkId: wishlistId, ...createWishlistSubscriptionsService(session, { groupId }), signal, onUnavailable,
          }),
          createReservation: (signal, onCancel) => createGroupWishReservation({ session, groupId, wishlistId, loadOne: wishes.loadOne, signal, confirmation: true, onCancel }),
          initialSort: context.searchParams.get("sort"), onSortChange: sort => context.replaceSearchParameter("sort", sort === "listOrder" ? null : sort),
          loadOwnerPhoto: async ({ signal, ownerId }) => {
            const members = await createGroupsService(session).members(groupId, { signal });
            const owner = members.items.find(item => item.id === ownerId);
            return owner ? readProfilePhoto(owner.profileImageUrl, owner.id, apiBaseUrl).imageUrl : null;
          },
        });
      },
    },
    {
      name: RouteNames.GroupSuggestion, path: RoutePaths.GroupSuggestion, title: "Idée du groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createGroupSuggestionsView } = await import("../features/groups/groupSuggestionsView.js");
        if (context.signal.aborted) throw createAbortError();
        const {groupId,wishlistId,suggestionId} = context.params;
        const wishes = createGroupWishlistService(session,{groupId,apiBaseUrl});
        return createGroupSuggestionsView({service:createGroupSuggestionsService(session,{groupId,wishlistId}),ownerName:"",signal:context.signal,detailId:suggestionId,
          listHref:withWishSort(`/groups/${groupId}/wishlists/${wishlistId}${memberOriginQuery(context.searchParams.get("fromMember"))}`,context.searchParams.get("sort")),
          loadOwnerName:async signal => (await wishes.load(wishlistId,{signal})).ownerDisplayName,
          setTitle:title => context.setTitle?.(title), navigate:href => { void context.navigate(href); },
        });
      },
    },
    {
      name: RouteNames.GroupWish, path: RoutePaths.GroupWish, title: "Souhait du groupe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createSharedWishView } = await import("../features/sharing/sharedWishView.js");
        if (context.signal.aborted) throw createAbortError();
        const { groupId, wishlistId, wishId } = context.params;
        const wishes = createGroupWishlistService(session, { groupId, apiBaseUrl });
        return createSharedWishView({ groupId, shareLinkId: wishlistId, wishId, signal: context.signal, fromMemberId: context.searchParams.get("fromMember"), returnSort: context.searchParams.get("sort"),
          copy: groupCopyOperations(groupId, wishlistId),
          loadOne: withResourcePageTitle(wishes.loadOne, context, result => result.name),
          createReservation: createGroupWishReservation({ session, groupId, wishlistId, loadOne: wishes.loadOne, signal: context.signal }),
        });
      },
    },
    {
      name: RouteNames.Notifications, path: RoutePaths.Notifications, title: "Notifications · MonKado",
      render: () => createLoadingState({ label: "Chargement…" }),
    },
    {
      name: RouteNames.FollowedLists, path: RoutePaths.FollowedLists, title: "Listes suivies · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishlistSubscriptionsView } = await import("../features/subscriptions/wishlistSubscriptionsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishlistSubscriptionsView({ ...createWishlistSubscriptionsService(session), signal: context.signal,
          onOpen: href => {
            const target = new URL(href, window.location.origin);
            if (target.pathname.startsWith("/groups/")) { void context.navigate(target.pathname); return; }
            if (sharing.enter(target.pathname.split("/")[2], target.hash) === "ready") void context.navigate(target.pathname);
          } });
      },
    },
    {
      name: RouteNames.WishlistReportHistory, path: RoutePaths.WishlistReportHistory, title: "Historique du signalement · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createAdminView }, { createWishlistReportHistoryView }] = await Promise.all([import("../features/admin/adminAccess.js"), import("../features/admin/wishlistHistoryView.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createWishlistReportHistoryView({ wishlistId: context.params.wishlistId, reportId: context.params.reportId, ...createWishlistHistoryService(session), signal: context.signal }),
      });
      },
    },
    {
      name: RouteNames.WishlistModerationHistory, path: RoutePaths.WishlistModerationHistory, title: "Historique de modération · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createAdminView }, { createWishlistModerationHistoryView }] = await Promise.all([import("../features/admin/adminAccess.js"), import("../features/admin/wishlistHistoryView.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createWishlistModerationHistoryView({ wishlistId: context.params.wishlistId, ...createWishlistHistoryService(session), signal: context.signal }),
      });
      },
    },
    {
      name: RouteNames.WishlistModeration, path: RoutePaths.WishlistModeration, title: "Suspension de la liste · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createAdminView }, { createWishlistModerationView }] = await Promise.all([import("../features/admin/adminAccess.js"), import("../features/admin/wishlistModerationView.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createWishlistModerationView({ wishlistId: context.params.wishlistId, ...createWishlistModerationService(session), signal: context.signal }),
      });
      },
    },
    {
      name: RouteNames.WishlistReportReview, path: RoutePaths.WishlistReportReview, title: "Examiner un signalement · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createAdminView }, { createWishlistReportReviewView }] = await Promise.all([import("../features/admin/adminAccess.js"), import("../features/admin/wishlistReportReviewView.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createWishlistReportReviewView({ wishlistId: context.params.wishlistId, reportId: context.params.reportId, ...createWishlistReportReviewService(session), signal: context.signal }),
      });
      },
    },
    {
      name: RouteNames.Activity, path: RoutePaths.Activity, title: "Activité des membres · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createActivityView }, { createAdminView }] = await Promise.all([import("../features/admin/activityView.js"), import("../features/admin/adminAccess.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createActivityView(session, context.signal),
      });
      },
    },
    {
      name: RouteNames.AdminMembers, path: RoutePaths.AdminMembers, title: "Comptes · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createAdminMembersView }, { createAdminView }] = await Promise.all([import("../features/admin/adminMembersView.js"), import("../features/admin/adminAccess.js")]);
        if (context.signal.aborted) throw createAbortError();
        return createAdminView(session, {
        signal: context.signal, createView: () => createAdminMembersView(session, context.signal),
      });
      },
    },
    {
      name: RouteNames.ReportedWishlists, path: RoutePaths.ReportedWishlists, title: "Listes signalées · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createAdminReportedWishlistsView } = await import("../features/admin/adminAccess.js");
        if (context.signal.aborted) throw createAbortError();
        return createAdminReportedWishlistsView(session, { ...createReportedWishlistsService(session), signal: context.signal });
      },
    },
    {
      name: RouteNames.Members, path: RoutePaths.Members, title: "Rechercher un membre · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createMemberSearchView } = await import("../features/members/memberSearchView.js");
        if (context.signal.aborted) throw createAbortError();
        const query = context.searchParams.get("q");
        if (query !== null && query !== memberSearchState.query) { memberSearchState.query = query; memberSearchState.page = 1; }
        return createMemberSearchView({ ...createMemberSearchService(session, { apiBaseUrl }), signal: context.signal, state: memberSearchState });
      },
    },
    {
      name: RouteNames.MemberProfile, path: RoutePaths.MemberProfile, title: "Profil du membre · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createMemberProfileView } = await import("../features/members/memberProfileView.js");
        if (context.signal.aborted) throw createAbortError();
        return createMemberProfileView({ memberId: context.params.memberId, ...createMemberProfileService(session, { apiBaseUrl, frontendOrigin: window.location.origin }), signal: context.signal });
      },
    },
    {
      name: RouteNames.Login,
      path: RoutePaths.Login,
      title: "Se connecter · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createLoginView } = await import("../features/login/loginView.js");
        if (context.signal.aborted) throw createAbortError();
        return createLoginView({ login: createLoginService(session), session, signal: context.signal,
          sharedReturn: sharingSignIn.continuation?.bindLogin(context.signal),
          passwordChanged: consumePasswordChangeNotice(), startGoogle: google?.enabled ? google.start : undefined,
          returnTo: getLoginDestination(context.searchParams) === RoutePaths.ExtensionAdd && readExtensionProduct() ? RoutePaths.ExtensionAdd : RoutePaths.Home });
      },
    },
    {
      name: RouteNames.LinkGoogle, path: RoutePaths.LinkGoogle, title: "Associer Google · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createGoogleLinkView } = await import("../features/google/googleLinkView.js");
        if (context.signal.aborted) throw createAbortError();
        takeFragment();
        return createGoogleLinkView({ continuation: google?.takeLinkContinuation() ?? null, session,
          signal: context.signal, onDestination: onGoogleLinkDestination, onAuthenticated: onGoogleAuthenticated });
      },
    },
    {
      name: RouteNames.GoogleReturn, path: RoutePaths.GoogleReturn, title: "Connexion avec Google · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createGoogleReturnView } = await import("../features/google/googleReturnView.js");
        if (context.signal.aborted) throw createAbortError();
        if (!google) {
          takeFragment();
          return createPlaceholderView({ title: "Connexion Google indisponible", message: "Tu peux utiliser la connexion par e-mail.", eyebrow: "Compte MonKado" });
        }
        return createGoogleReturnView({ google, session, consumeFragment: takeFragment, signal: context.signal,
          onDestination: onGoogleDestination, onAuthenticated: onGoogleAuthenticated, onLinkRequired: onGoogleLinkRequired });
      },
    },
    {
      name: RouteNames.Register,
      path: RoutePaths.Register,
      title: "Créer un compte · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createRegistrationView } = await import("../features/registration/registrationView.js");
        if (context.signal.aborted) throw createAbortError();
        return createRegistrationView({ register: createRegistrationService(session), signal: context.signal,
          startGoogle: google?.enabled ? google.start : undefined });
      },
    },
    {
      name: RouteNames.ConfirmEmail,
      path: RoutePaths.ConfirmEmail,
      title: "Confirmer l’adresse e-mail · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) =>
        {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createEmailConfirmationView } = await import("../features/emailConfirmation/emailConfirmationView.js");
        if (context.signal.aborted) throw createAbortError();
        // Finish initial session selection before preparing the confirmation CSRF token.
        if (pendingFragment) await session.start();
        if (context.signal.aborted) throw createAbortError();
        return createEmailConfirmationView({ ...createEmailConfirmationService(session),
          consumeFragment: takeFragment, signal: context.signal });
      },
    },
    {
      name: RouteNames.ConfirmEmailChange, path: RoutePaths.ConfirmEmailChange, title: "Confirmer la nouvelle adresse e-mail · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) =>
        {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createEmailChangeConfirmationView } = await import("../features/emailChange/emailChangeConfirmationView.js");
        if (context.signal.aborted) throw createAbortError();
        return createEmailChangeConfirmationView({ ...createEmailChangeService(session), consumeFragment: takeFragment, signal: context.signal });
      },
    },
    {
      name: RouteNames.ForgotPassword, path: RoutePaths.ForgotPassword, title: "Mot de passe oublié · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createForgotPasswordView } = await import("../features/passwordRecovery/passwordRecoveryViews.js");
        if (context.signal.aborted) throw createAbortError();
        return createForgotPasswordView({ ...createPasswordRecoveryService(session), signal: context.signal });
      },
    },
    {
      name: RouteNames.ResetPassword, path: RoutePaths.ResetPassword, title: "Réinitialiser le mot de passe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) =>
        {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createResetPasswordView } = await import("../features/passwordRecovery/passwordRecoveryViews.js");
        if (context.signal.aborted) throw createAbortError();
        return createResetPasswordView({ ...createPasswordRecoveryService(session), consumeFragment: takeFragment, signal: context.signal });
      },
    },
    {
      name: RouteNames.Profile,
      path: RoutePaths.Profile,
      title: "Mon profil · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createProfileView } = await import("../features/profile/profileView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createProfileView({ ...createProfileService(session, { apiBaseUrl }), signal: context.signal }), RoutePaths.Profile, session);
      },
    },
    {
      name: RouteNames.PasswordChange, path: RoutePaths.PasswordChange, title: "Changer mon mot de passe · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createPasswordChangeView } = await import("../features/passwordChange/passwordChangeView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createPasswordChangeView({ ...createPasswordChangeService(session), signal: context.signal }), RoutePaths.PasswordChange, session);
      },
    },
    {
      name: RouteNames.NotificationPreferences, path: RoutePaths.NotificationPreferences, title: "Mes notifications · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const [{ createNotificationPreferencesView }, { createNotificationPreferencesService }] = await Promise.all([
          import("../features/notifications/notificationPreferencesView.js"),
          import("../features/notifications/notificationPreferencesService.js"),
        ]);
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createNotificationPreferencesView({
          service: createNotificationPreferencesService(session), signal: context.signal,
        }), RoutePaths.NotificationPreferences, session);
      },
    },
    {
      name: RouteNames.PersonalData, path: RoutePaths.PersonalData, title: "Mes données personnelles · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createPersonalDataView } = await import("../features/privacy/personalDataView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createPersonalDataView({ service: createPersonalDataService(session), signal: context.signal }), RoutePaths.PersonalData, session);
      },
    },
    {
      name: RouteNames.Authenticator, path: RoutePaths.Authenticator, title: "Mon authentificateur · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createAuthenticatorView } = await import("../features/twoFactor/authenticatorView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createAuthenticatorView({ service: createAuthenticatorService(session), session, signal: context.signal,
          onFinished: () => { void context.navigate(RoutePaths.Login); } }), RoutePaths.Authenticator, session);
      },
    },
    {
      name: RouteNames.ConfirmAccountDeletion, path: RoutePaths.ConfirmAccountDeletion, title: "Supprimer mon compte · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) =>
        {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const { createAccountDeletionLinkView } = await import("../features/privacy/accountDeletionLinkView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountDeletionLinkView({ session, service: createAccountDeletionService(session), consumeFragment: takeFragment, signal: context.signal });
      },
    },
    {
      name: RouteNames.EmailChange, path: RoutePaths.EmailChange, title: "Changer mon adresse e-mail · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createEmailChangeView } = await import("../features/emailChange/emailChangeView.js");
        if (context.signal.aborted) throw createAbortError();
        return createAccountLayout(createEmailChangeView({ load: createProfileService(session).load, ...createEmailChangeService(session), signal: context.signal }), RoutePaths.EmailChange, session);
      },
    },
    {
      name: RouteNames.Lists, path: RoutePaths.Lists, title: "Mes listes · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishlistsView } = await import("../features/wishlists/wishlistsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishlistsView({ ...createWishlistsService(session), isArchived: context.searchParams.get("isArchived") === "true", signal: context.signal });
      },
    },
    {
      name: RouteNames.ExtensionAdd, path: RoutePaths.ExtensionAdd, title: "Ajouter un souhait · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createExtensionAddView } = await import("../features/extension/extensionAddView.js");
        if (context.signal.aborted) throw createAbortError();
        return createExtensionAddView({
        lists: createWishlistsService(session), wishes: createWishesService(session, { apiBaseUrl }),
        signal: context.signal,
      });
      },
    },
    {
      name: RouteNames.NewList, path: RoutePaths.NewList, title: "Créer une liste · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishlistView } = await import("../features/wishlists/createWishlistView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishlistView({ create: createWishlistsService(session).create, groups: createGroupsService(session), signal: context.signal,
          onCreated: created => onWishlistCreated(created, context) });
      },
    },
    {
      name: RouteNames.EditList, path: RoutePaths.EditList, title: "Modifier ma liste · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishlistEditView } = await import("../features/wishlists/wishlistEditView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishlistEditView({ ...createWishlistsService(session), update: withResourcePageTitle(createWishlistsService(session).update, context, result => result.wishlist.name), loadOne: withResourcePageTitle(createWishlistsService(session).loadOne, context, result => result.wishlist.name), wishlistId: context.params.listId, signal: context.signal, onSaved: saved => onWishlistUpdated(saved, context) });
      },
    },
    {
      name: RouteNames.NewWish, path: RoutePaths.NewWish, title: "Ajouter un souhait · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishCreateView } = await import("../features/wishes/wishCreateView.js");
        if (context.signal.aborted) throw createAbortError();
        const wishes = createWishesService(session, { apiBaseUrl });
        return createWishCreateView({ wishlistId: context.params.listId, loadOne: createWishlistsService(session).loadOne,
          create: wishes.create, uploadImage: wishes.uploadImage, loadWish: wishes.loadOne,
          signal: context.signal, onCreated: created => onWishCreated(created, context) });
      },
    },
    {
      name: RouteNames.EditWish, path: RoutePaths.EditWish, title: "Modifier un souhait · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishEditView } = await import("../features/wishes/wishEditView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishEditView({ ...createWishesService(session, { apiBaseUrl }), update: withResourcePageTitle(createWishesService(session, { apiBaseUrl }).update, context, result => result.wish.name), loadOne: withResourcePageTitle(createWishesService(session, { apiBaseUrl }).loadOne, context, result => result.wish.name), wishlistId: context.params.listId, wishId: context.params.wishId,
          returnSort: context.searchParams.get("sort"),
          loadWishlist: createWishlistsService(session).loadOne, signal: context.signal, onDeleted: () => onWishDeleted(context) });
      },
    },
    {
      name: RouteNames.WishDetails, path: RoutePaths.WishDetails, title: "Détail du souhait · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishDetailsView } = await import("../features/wishes/wishDetailsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishDetailsView({ ...createWishesService(session, { apiBaseUrl }), loadOne: withResourcePageTitle(createWishesService(session, { apiBaseUrl }).loadOne, context, result => result.wish.name), wishlistId: context.params.listId, wishId: context.params.wishId,
          copy: ownedCopyOperations(context.params.listId),
          reservations: createOwnedGiftReservationService(session),
          loadWishlist: createWishlistsService(session).loadOne, onDeleted: () => onWishDeleted(context),
          signal: context.signal, returnSort: context.searchParams.get("sort") });
      },
    },
    {
      name: RouteNames.ListDetails, path: RoutePaths.ListDetails, title: "Détail de la liste · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createWishlistDetailsView } = await import("../features/wishlists/wishlistDetailsView.js");
        if (context.signal.aborted) throw createAbortError();
        return createWishlistDetailsView({ wishlistId: context.params.listId, loadOne: withResourcePageTitle(createWishlistsService(session).loadOne, context, result => result.wishlist.name),
          groups: createGroupsService(session),
          copy: ownedCopyOperations(context.params.listId),
          initialSort: context.searchParams.get("sort"), onSortChange: sort => context.replaceSearchParameter("sort", sort === "listOrder" ? null : sort),
          setArchived: createWishlistsService(session).setArchived,
          removeWishlist: createWishlistsService(session).remove, onWishlistDeleted: () => onWishlistDeleted(context),
          favorite: createWishesService(session, { apiBaseUrl }),
          deletion: createWishesService(session, { apiBaseUrl }),
          onDeleted: () => onWishDeleted(context),
          loadPersonalReservations: createPersonalReservationsReader(session),
          loadWishes: createWishesService(session, { apiBaseUrl }).load, reorder: createWishesService(session, { apiBaseUrl }).reorder, signal: context.signal,
          share: { ...createWishlistShareService(session, { frontendOrigin: window.location.origin }),
            onRevoked: () => onWishlistShareRevoked(context),
            copyText: text => navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : Promise.reject(new Error("Clipboard unavailable")) } });
      },
    },
    {
      name: RouteNames.Reservations, path: RoutePaths.Reservations, title: "Mes réservations · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const { createReservationHistoryView } = await import("../features/reservations/reservationHistoryView.js");
        if (context.signal.aborted) throw createAbortError();
        return createReservationHistoryView({ ...createReservationHistoryService(session, { apiBaseUrl }), signal: context.signal,
          createCancel: (item, callbacks) => {
            if (item.isSuggestion && item.wishHref) {
              const target = new URL(item.wishHref, window.location.origin);
              const [, , groupId, , wishlistId] = target.pathname.split("/");
              const suggestionId = target.hash.slice("#suggestion-".length);
              const suggestions = createGroupSuggestionsService(session, {groupId,wishlistId});
              return createReservationCancelDialog({ ...callbacks, signal: context.signal,
                cancel: (etag, signal) => suggestions.cancel(suggestionId, etag, signal),
                load: async signal => {
                  const suggestion = await suggestions.get(suggestionId,signal);
                  const reservation = await suggestions.reservation(suggestionId,signal);
                  return {name:suggestion.name,lookup:reservation ? {state:"reserved",reservation} : {state:"absent"}};
                },
              });
            }
            if (item.wishHref?.startsWith("/groups/")) {
              const [, , groupId, , wishlistId, , wishId] = item.wishHref.split("/");
              const reservations = createOwnedGiftReservationService(session, { groupId });
              const wishes = createGroupWishlistService(session, { groupId, apiBaseUrl });
              return createReservationCancelDialog({ ...callbacks, signal: context.signal,
                cancel: (etag, signal) => reservations.cancel(wishlistId, wishId, { etag, signal }),
                load: async signal => ({ name: (await wishes.loadOne(wishlistId, wishId, { signal })).name, lookup: await reservations.loadCurrent(wishlistId, wishId, { signal }) }),
              });
            }
            if (item.wishHref?.startsWith("/lists/")) {
              const [, , wishlistId, , wishId] = item.wishHref.split("/");
              const reservations = createOwnedGiftReservationService(session);
              const wishes = createWishesService(session, { apiBaseUrl });
              return createReservationCancelDialog({ ...callbacks, signal: context.signal,
                cancel: (etag, signal) => reservations.cancel(wishlistId, wishId, { etag, signal }),
                load: async signal => {
                  const wish = await wishes.loadOne(wishlistId, wishId, { signal });
                  const lookup = await reservations.loadCurrent(wishlistId, wishId, { signal });
                  return { name: wish.wish.name, lookup };
                },
              });
            }
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
            if (href.startsWith("/lists/") || href.startsWith("/groups/")) { void context.navigate(href); return; }
            const target = new URL(href, window.location.origin);
            const shareLinkId = target.pathname.split("/")[2];
            if (sharing.enter(shareLinkId, target.hash) === "ready") void context.navigate(target.pathname);
          } });
      },
    },
    {
      name: RouteNames.SharedWishlist, path: RoutePaths.SharedWishlist, title: "Liste de souhaits partagée · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const [{ createSharedWishlistView, createSharedWishlistEntryView }, { createSharedSessionView }] = await Promise.all([import("../features/sharing/sharedWishlistView.js"), import("../features/sharing/sharedSessionView.js")]);
        if (context.signal.aborted) throw createAbortError();
        const fragment = takeFragment();
        const fromMemberId = memberNavigation.read(context.params.shareLinkId, context.searchParams, !!fragment);
        const entry = sharing.enter(context.params.shareLinkId, fragment);
        /** @type {string | null | undefined} */ let recoveredOwnerPhoto;
        const state = entry === "missing" && fromMemberId ? await recoverMemberAccess(context, fromMemberId, photo => { recoveredOwnerPhoto = photo; }) : entry;
        if (state !== "ready") return createSharedWishlistEntryView(state, fromMemberId);
        return createSharedSessionView(session, identity => createSharedWishlistView({ shareLinkId: context.params.shareLinkId, signal: context.signal, fromMemberId,
          createSubscription: ({ signal, onUnavailable }) => {
            if (identity.authentication === "required") return createWishlistSubscriptionControl({
              shareLinkId: context.params.shareLinkId, ...createWishlistSubscriptionsService(session, { context: sharing }), signal, onUnavailable,
            });
            const button = createButton({ label: "Se connecter pour suivre", variant: "secondary",
              onClick: () => { sharingSignIn.onSignIn?.(context.params.shareLinkId); } });
            applyActionIcon(button, "bell", "Se connecter pour suivre");
            button.classList.add("wishlist-subscription-action");
            return button;
          },
          loadOwnerPhoto: async ({ signal, ownerId }) => {
            // Prefer the verified author returned by the shared-list API, including direct links.
            if (ownerId) {
              const profile = await createMemberProfileService(session, { apiBaseUrl, frontendOrigin: window.location.origin }).load(ownerId, { signal });
              return profile.id.toLowerCase() === ownerId.toLowerCase() ? profile.photo.imageUrl : null;
            }
            if (!fromMemberId) return null;
            if (recoveredOwnerPhoto !== undefined) return recoveredOwnerPhoto;
            const profile = await createMemberProfileService(session, { apiBaseUrl, frontendOrigin: window.location.origin }).load(fromMemberId, { signal });
            // The navigation origin alone is not proof of list ownership.
            return profile.wishlists.some(list => new URL(list.shareHref, window.location.origin).pathname === `/shared-wishlists/${context.params.shareLinkId}`) ? profile.photo.imageUrl : null;
          },
          ...(identity.authentication === "required" ? { copy: copyOperations(context.params.shareLinkId) } : {}),
          ...(identity.includeCurrent ? {
            loadOne: createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne,
            createReservation: (signal, onCancel) => createSharedWishReservation({ session, apiBaseUrl, sharing,
              shareLinkId: context.params.shareLinkId, identity, signal, fromMemberId, confirmation: true, onCancel,
              onSignIn: wishId => sharingSignIn.onSignIn?.(context.params.shareLinkId, wishId) }),
          } : {}),
          initialSort: context.searchParams.get("sort"), onSortChange: sort => context.replaceSearchParameter("sort", sort === "listOrder" ? null : sort),
          accessSignal: sharing.observe(context.params.shareLinkId) ?? undefined,
          report: createWishlistReportService(session, { context: sharing }).report,
          load: withResourcePageTitle(createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).load, context, result => result.name) }), context.signal);
      },
    },
    {
      name: RouteNames.SharedWish, path: RoutePaths.SharedWish, title: "Souhait partagé · MonKado",
      render: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        let pendingFragment = context.consumeFragment();
        const takeFragment = () => { const value = pendingFragment; pendingFragment = ""; return value; };
        const [{ createSharedWishlistEntryView }, { createSharedWishView }, { createSharedSessionView }] = await Promise.all([import("../features/sharing/sharedWishlistView.js"), import("../features/sharing/sharedWishView.js"), import("../features/sharing/sharedSessionView.js")]);
        if (context.signal.aborted) throw createAbortError();
        // Only an original list link can establish access; a detail fragment is discarded.
        takeFragment();
        const fromMemberId = memberNavigation.read(context.params.shareLinkId, context.searchParams);
        const entry = sharing.enter(context.params.shareLinkId, "");
        const state = entry === "missing" && fromMemberId ? await recoverMemberAccess(context, fromMemberId) : entry;
        if (state !== "ready") return createSharedWishlistEntryView(state, fromMemberId);
        const resumeAccount = sharingSignIn.continuation?.takeResume(context.params.shareLinkId);
        return createSharedSessionView(session, identity => createSharedWishView({ shareLinkId: context.params.shareLinkId, wishId: context.params.wishId, signal: context.signal, fromMemberId,
          ...(identity.authentication === "required" ? { copy: copyOperations(context.params.shareLinkId) } : {}),
          returnSort: context.searchParams.get("sort"),
          ...(identity.includeCurrent ? { createReservation: createSharedWishReservation({ session, apiBaseUrl, sharing,
            shareLinkId: context.params.shareLinkId, identity, signal: context.signal, fromMemberId, resumeAccount,
            onSignIn: wishId => sharingSignIn.onSignIn?.(context.params.shareLinkId, wishId) }) } : {}),
          accessSignal: sharing.observe(context.params.shareLinkId) ?? undefined,
          loadOne: withResourcePageTitle(createSharedWishlistService(session, { apiBaseUrl, context: sharing, ...identity }).loadOne, context, result => result.name) }), context.signal);
      },
    },
  ]);
}

/** @typedef {{continuation?: import("../features/sharing/sharedSignInContinuation.js").SharedSignInContinuation, onSignIn?: (id: string, wishId?: string) => void}} SharingSignInOptions */
/**
 * Creates the complete frontend route catalogue.
 *
 * @param {{session: import("../auth/sessionManager.js").SessionManager, apiBaseUrl: string, groupJoin?: ReturnType<typeof createGroupJoinContinuation>, sharingSignIn?: SharingSignInOptions, sharing?: import("../features/sharing/sharedWishlistContext.js").SharedWishlistContext, consumePasswordChangeNotice?: () => boolean, onWishlistCreated?: WishlistCreatedHandler, onWishlistUpdated?: WishlistCreatedHandler, onWishlistDeleted?: WishlistDeletedHandler, onWishCreated?: WishCreatedHandler, onWishDeleted?: WishlistDeletedHandler, onWishlistShareRevoked?: WishlistDeletedHandler} & GoogleRouteOptions} options Session and local notice dependencies.
 * @returns {ReadonlyArray<import("../router/router.js").RouteDefinition>} Application routes.
 */
export function createApplicationRoutes({ session, apiBaseUrl, groupJoin = createGroupJoinContinuation(), sharingSignIn = {}, sharing = createSharedWishlistContext(), consumePasswordChangeNotice = () => false, onWishlistCreated = () => {}, onWishlistUpdated = () => {}, onWishlistDeleted = () => {}, onWishCreated = () => {}, onWishDeleted = () => {}, onWishlistShareRevoked = () => {}, ...googleFlow }) {
  return [
    Object.freeze({
      name: RouteNames.Home,
      path: RoutePaths.Home,
      title: "MonKado · Les souhaits qui font vraiment plaisir",
      render: context => createSessionHomeView(session, { service: createDashboardService({ wishlists: createWishlistsService(session), groups: createGroupsService(session), subscriptions: createWishlistSubscriptionsService(session) }), signal: context.signal, apiBaseUrl }),
    }),
    ...createPageRoutes(session, consumePasswordChangeNotice, googleFlow, onWishlistCreated, onWishlistDeleted, apiBaseUrl, onWishCreated, onWishDeleted, sharing, sharingSignIn, onWishlistShareRevoked, onWishlistUpdated, groupJoin).map(route => {
      const guard = createSessionGuard(route.name, session);
      if (route.name === RouteNames.Login || route.name === RouteNames.Register) return Object.freeze({ ...route, beforeEnter: async (/** @type {import("../router/router.js").RouteContext} */ context) => {
        const result = await guard?.(context);
        const destination = result?.redirectTo === RoutePaths.Home ? groupJoin.takeDestination() : null;
        return destination ? { redirectTo: destination, replace: true } : result;
      } });
      if (route.name !== RouteNames.Notifications) return Object.freeze({ ...route, beforeEnter: guard });
      return Object.freeze({ ...route, beforeEnter: async (/** @type {import("../router/router.js").RouteContext} */ context) =>
        await guard?.(context) ?? { redirectTo: "/?notifications=open", replace: true } });
    }),
  ];
}
