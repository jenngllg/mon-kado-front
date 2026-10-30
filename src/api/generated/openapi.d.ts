/**
 * This file was generated from the MonKado OpenAPI contract.
 * Do not edit it manually. Run `pnpm api:types` instead.
 */

export interface paths {
    readonly "/api/v1/admin/audit-events": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetPage */
        readonly get: operations["AdministrativeAudit_GetPage"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/data-exports": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Request */
        readonly post: operations["AdministrativeDataExports_Request"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/data-exports/{exportId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["AdministrativeDataExports_Get"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/data-exports/{exportId}/archive": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Download */
        readonly get: operations["AdministrativeDataExports_Download"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/data-exports/latest": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetLatest */
        readonly get: operations["AdministrativeDataExports_GetLatest"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/erasure-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Execute */
        readonly post: operations["AdministrativeAccountErasures_Execute"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/members/{memberId}/session-revocations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Execute */
        readonly post: operations["AdministrativeSessionRevocations_Execute"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetPage */
        readonly get: operations["ReportedWishlists_GetPage"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists/{wishlistId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["ReportedWishlists_Get"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists/{wishlistId}/reports": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetReports */
        readonly get: operations["ReportedWishlists_GetReports"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists/{wishlistId}/reports/{reportId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["WishlistReportReviews_Get"];
        /** Update */
        readonly put: operations["WishlistReportReviews_Update"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists/{wishlistId}/reports/{reportId}/events": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetEvents */
        readonly get: operations["WishlistReportReviews_GetEvents"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/reported-wishlists/{wishlistId}/wishes/{wishId}/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetImage */
        readonly get: operations["ReportedWishlists_GetImage"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/wishlists/{wishlistId}/moderation": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["WishlistModeration_Get"];
        /** Update */
        readonly put: operations["WishlistModeration_Update"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/admin/wishlists/{wishlistId}/moderation/events": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetEvents */
        readonly get: operations["WishlistModeration_GetEvents"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/email-change-confirmations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Confirms a pending member email change. */
        readonly post: operations["EmailConfirmations_ConfirmEmailChange"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/email-confirmation-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Requests a new account confirmation email. */
        readonly post: operations["EmailConfirmations_RequestConfirmation"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/email-confirmations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Confirms an account email address. */
        readonly post: operations["EmailConfirmations_Confirm"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Starts Google sign-in with Authorization Code, PKCE, state and nonce. */
        readonly get: operations["GoogleAuthentication_Challenge"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google/callback": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Consumes a browser-bound Google form-post callback and returns a frontend completion flow. */
        readonly post: operations["GoogleAuthentication_Callback"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google/completions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Finalizes a validated browser flow and creates a MonKado bearer session. */
        readonly post: operations["GoogleAuthentication_Complete"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/google/link": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Proves the current MonKado password and explicitly links the validated Google identity. */
        readonly post: operations["GoogleAuthentication_Link"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/password-reset-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Requests an account password reset email. */
        readonly post: operations["PasswordResets_Request"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/password-resets": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Resets an account password using a password reset link. */
        readonly post: operations["PasswordResets_Reset"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/registrations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Registers an account and schedules its confirmation email. */
        readonly post: operations["AuthRegistrations_Register"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Authenticates an account and creates its server-side session. */
        readonly post: operations["AuthSessions_Login"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets the current authenticated member session from persistence. */
        readonly get: operations["AuthSessions_GetCurrent"];
        readonly put?: never;
        readonly post?: never;
        /** Ends the current browser refresh session. */
        readonly delete: operations["AuthSessions_Logout"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/sessions/refresh": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Rotates the current refresh session and issues a new access token. */
        readonly post: operations["AuthSessions_Refresh"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/two-factor/completions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Complete */
        readonly post: operations["TwoFactorAuthentication_Complete"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/two-factor/recovery-codes/regenerations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** RegenerateRecoveryCodes */
        readonly post: operations["TwoFactorAuthentication_RegenerateRecoveryCodes"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/two-factor/setup": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** GetSetup */
        readonly post: operations["TwoFactorAuthentication_GetSetup"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/auth/two-factor/setup/confirmations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** ConfirmSetup */
        readonly post: operations["TwoFactorAuthentication_ConfirmSetup"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/group-invitations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * List invitations addressed to me
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_13"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/group-invitations/{invitationId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read an invitation addressed to me
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_14"];
        readonly put?: never;
        readonly post?: never;
        /**
         * Decline an invitation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_15"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/group-invitations/{invitationId}/accept": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Accept an invitation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly post: operations["Groups_16"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * List my groups
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_1"];
        readonly put?: never;
        /**
         * Create a private group
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly post: operations["Groups_2"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a group
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_3"];
        /**
         * Rename an owned group
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly put: operations["Groups_4"];
        readonly post?: never;
        /**
         * Delete an owned group without deleting lists
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_5"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a private group photo
         * @description A short-lived signed image grant is required. Live accepted membership and the current photo are rechecked; UUID knowledge and pending invitations grant no access.
         */
        readonly get: operations["Groups_26"];
        /**
         * Replace the group photo
         * @description Only the organizer can change the group photo. Accepted non-owners receive 403; outsiders receive 404. Requires the current strong group ETag and CSRF protection. Photos are normalized to a metadata-free WebP at most 512 pixels per edge; replacements and file deletion outbox entries are atomic.
         */
        readonly put: operations["Groups_27"];
        readonly post?: never;
        /**
         * Remove the group photo
         * @description Only the organizer can change the group photo. Accepted non-owners receive 403; outsiders receive 404. Requires the current strong group ETag and CSRF protection. Photos are normalized to a metadata-free WebP at most 512 pixels per edge; replacements and file deletion outbox entries are atomic.
         */
        readonly delete: operations["Groups_28"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/invitations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * List pending invitations as an accepted group member
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_9"];
        readonly put?: never;
        /**
         * Invite a searchable registered member
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly post: operations["Groups_10"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/invitations/{invitationId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a pending invitation as an accepted group member
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_11"];
        readonly put?: never;
        readonly post?: never;
        /**
         * Revoke a pending invitation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_12"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/join-link": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read the active group join link as an accepted member
         * @description Any accepted member may read or explicitly create the shared join link. Only the owner may revoke it with its current ETag. Reading never creates a link or membership. Codes are random, hashed for lookup and purpose-bound encrypted at rest. An authenticated holder explicitly joins via POST without organizer approval. Joining locks membership/capacity atomically, consumes any pending named invitation, and preserves independent sharing. Revocation invalidates the link, code and QR immediately for new joins; existing memberships remain. No join code is returned by public reads. Named invitations still require recipient acceptance.
         */
        readonly get: operations["Groups_ReadJoinLink"];
        readonly put?: never;
        /**
         * Create a shared group join link as an accepted member
         * @description Any accepted member may read or explicitly create the shared join link. Only the owner may revoke it with its current ETag. Reading never creates a link or membership. Codes are random, hashed for lookup and purpose-bound encrypted at rest. An authenticated holder explicitly joins via POST without organizer approval. Joining locks membership/capacity atomically, consumes any pending named invitation, and preserves independent sharing. Revocation invalidates the link, code and QR immediately for new joins; existing memberships remain. No join code is returned by public reads. Named invitations still require recipient acceptance.
         */
        readonly post: operations["Groups_CreateJoinLink"];
        /**
         * Revoke the shared group join link as owner
         * @description Any accepted member may read or explicitly create the shared join link. Only the owner may revoke it with its current ETag. Reading never creates a link or membership. Codes are random, hashed for lookup and purpose-bound encrypted at rest. An authenticated holder explicitly joins via POST without organizer approval. Joining locks membership/capacity atomically, consumes any pending named invitation, and preserves independent sharing. Revocation invalidates the link, code and QR immediately for new joins; existing memberships remain. No join code is returned by public reads. Named invitations still require recipient acceptance.
         */
        readonly delete: operations["Groups_RevokeJoinLink"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/members": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * List accepted group members
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_6"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/members/{memberId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        readonly post?: never;
        /**
         * Remove a non-owner member
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_8"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/members/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        readonly post?: never;
        /**
         * Leave a group and withdraw own group sharing
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_7"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/preview": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Read the publicly advertised invitation identity */
        readonly get: operations["Groups_PreviewInvitation"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/preview/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Read the current advertised group photo or MonKado fallback */
        readonly get: operations["Groups_PreviewInvitationImage"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * List explicitly shared active wishlists
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_17"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a group wishlist
         * @description Requires current membership and effective group visibility. Owners may read their own list. Reservation quantities are null for owners when surprise mode is enabled; availability filtering cannot reveal hidden reservations. Owners cannot reserve through the group view.
         */
        readonly get: operations["Groups_18"];
        /**
         * Share an owned active wishlist
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly put: operations["Groups_19"];
        readonly post?: never;
        /**
         * Withdraw sharing of an owned wishlist
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_20"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/subscriptions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Follow a private group wishlist
         * @description Requires current group membership and current access to the wishlist. The owner cannot follow their own wishlist. Following is an explicit command and never creates a public share link, participation or reservation. The follow remains bound to its original access source; removal from that group or withdrawal of group access revokes access. At most one follow per member and wishlist, shared across group and public entry points. Responses contain an authorized frontend group URL without a share secret for group-derived follows.
         */
        readonly post: operations["CreateGroupWishlistSubscription"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/subscriptions/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read current group wishlist follow
         * @description Requires current group membership and current access to the wishlist. The owner cannot follow their own wishlist. Following is an explicit command and never creates a public share link, participation or reservation. The follow remains bound to its original access source; removal from that group or withdrawal of group access revokes access. At most one follow per member and wishlist, shared across group and public entry points. Responses contain an authorized frontend group URL without a share secret for group-derived follows.
         */
        readonly get: operations["GetCurrentGroupWishlistSubscription"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/wishes/{wishId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a group wishlist wish
         * @description Requires current membership and effective group visibility. Owners may read their own list. Reservation quantities are null for owners when surprise mode is enabled; availability filtering cannot reveal hidden reservations. Owners cannot reserve through the group view.
         */
        readonly get: operations["Groups_21"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/wishes/{wishId}/copies": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Copy an accessible group wish into an owned wishlist
         * @description Requires authenticated current group membership and current access to the source wishlist. Source membership and effective audience are rechecked under parent locks. The destination must be owned, active and unsuspended. Creation is explicit and returns an independent wish and image with new identifiers and version; favorites and reservations are not copied. Does not create a public sharing link, participation or reservation. Revoked membership, hidden or archived/suspended sources and foreign source children return 404. Destination conflicts and capacity limits return 409. Image copying uses the same bounded admission, hash verification and atomic database/file lifecycle as owned and publicly shared copies.
         */
        readonly post: operations["CopyGroupWish"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/wishes/{wishId}/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read a member-bound short-lived group image grant
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_25"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/{groupId}/wishlists/{wishlistId}/wishes/{wishId}/reservations/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read my reservation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly get: operations["Groups_22"];
        /**
         * Create or update my reservation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly put: operations["Groups_23"];
        readonly post?: never;
        /**
         * Cancel my reservation
         * @description Private groups require accepted membership. Invitations never grant list access. All accepted members may invite and read pending invitations. Only owners rename/delete groups, revoke invitations and remove other members. Each list owner explicitly shares their own lists. All accesses are rechecked server-side; removal, leaving, archive and suspension revoke group-derived access. Public links and subscriptions remain independent. Reservations use global quantities, disclose no other participant identities and are unavailable to the list owner through group routes. Owners use their existing wishlist view. Mutations are atomic; reads never enroll or reserve. Invitations expire after 14 days. Group limit: 100 members including pending invitations; member limit: 50 groups.
         */
        readonly delete: operations["Groups_24"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/groups/join": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Preview an invitation without enrolling or authenticating */
        readonly get: operations["Groups_PreviewByCode"];
        readonly put?: never;
        /**
         * Join a group using its bearer code without approval
         * @description Any accepted member may read or explicitly create the shared join link. Only the owner may revoke it with its current ETag. Reading never creates a link or membership. Codes are random, hashed for lookup and purpose-bound encrypted at rest. An authenticated holder explicitly joins via POST without organizer approval. Joining locks membership/capacity atomically, consumes any pending named invitation, and preserves independent sharing. Revocation invalidates the link, code and QR immediately for new joins; existing memberships remain. No join code is returned by public reads. Named invitations still require recipient acceptance.
         */
        readonly post: operations["Groups_JoinByCode"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Manages authenticated members. */
        readonly get: operations["Members_Search"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/{memberId}/profile": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Retrieves a confirmed public identity and its active shared lists. */
        readonly get: operations["GetPublicMemberProfile"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/{memberId}/profile/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["ProfileImages_Get"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/data-exports": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Request */
        readonly post: operations["PersonalDataExports_Request"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/data-exports/{exportId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["PersonalDataExports_Get"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/data-exports/{exportId}/archive": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Download */
        readonly get: operations["PersonalDataExports_Download"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/data-exports/latest": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetLatest */
        readonly get: operations["PersonalDataExports_GetLatest"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/deletion-requests": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** RequestAccountDeletion */
        readonly post: operations["Members_RequestAccountDeletion"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/deletion-requests/confirm": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** ConfirmAccountDeletion */
        readonly post: operations["Members_ConfirmAccountDeletion"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/email": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Requests a change to the current authenticated member email address. */
        readonly put: operations["Members_UpdateEmail"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/password": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Changes the password of the current authenticated member. */
        readonly put: operations["Members_UpdatePassword"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/profile": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Updates the display name of the current authenticated member. */
        readonly put: operations["Members_UpdateProfile"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/profile/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        /** Upsert */
        readonly put: operations["ProfileImages_Upsert"];
        readonly post?: never;
        /** Delete */
        readonly delete: operations["ProfileImages_Delete"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/reservations": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets one page of the current member's reservation history. */
        readonly get: operations["Members_GetReservationHistory"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/two-factor": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetStatus */
        readonly get: operations["MemberTwoFactor_GetStatus"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/members/current/two-factor/reauthentications": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Reauthenticate */
        readonly post: operations["MemberTwoFactor_Reauthenticate"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["SharedWishlists_Get"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/participants": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Enrolls an authenticated member or anonymous guest through an active share proof.
         * @description Authenticated members use their live profile display name and may omit the body. Anonymous guests must provide nonblank displayName text containing at most 80 Unicode scalar values after trimming. Existing participation returns 200; newly created participation returns 201 and Location. Guest identity is retained in the private browser cookie.
         */
        readonly post: operations["SharedWishlists_Join"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/participants/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetCurrent */
        readonly get: operations["SharedWishlists_GetCurrent"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/preview": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Read explicitly public share preview metadata */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    readonly shareLinkId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Public preview */
                readonly 200: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "text/html": string;
                    };
                };
                /** @description Request failed */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
                readonly 429: {
                    headers: {
                        readonly "Retry-After"?: number;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        /** Read explicitly public share preview metadata */
        readonly head: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    readonly shareLinkId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Public preview */
                readonly 200: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "text/html": string;
                    };
                };
                /** @description Request failed */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
                readonly 429: {
                    headers: {
                        readonly "Retry-After"?: number;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/preview/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Read explicitly public share preview metadata */
        readonly get: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    readonly shareLinkId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Public preview */
                readonly 200: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "image/jpeg": string;
                    };
                };
                /** @description Request failed */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
                readonly 429: {
                    headers: {
                        readonly "Retry-After"?: number;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        /** Read explicitly public share preview metadata */
        readonly head: {
            readonly parameters: {
                readonly query?: never;
                readonly header?: never;
                readonly path: {
                    readonly shareLinkId: string;
                };
                readonly cookie?: never;
            };
            readonly requestBody?: never;
            readonly responses: {
                /** @description Public preview */
                readonly 200: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "image/jpeg": string;
                    };
                };
                /** @description Request failed */
                readonly 400: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 404: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
                readonly 429: {
                    headers: {
                        readonly "Retry-After"?: number;
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
                /** @description Request failed */
                readonly 503: {
                    headers: {
                        readonly [name: string]: unknown;
                    };
                    content: {
                        readonly "application/json": components["schemas"]["ErrorResponse"];
                    };
                };
            };
        };
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/reports": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Exposes shared wishlist content and participant operations to holders of a valid share link. */
        readonly post: operations["SharedWishlists_Report"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/subscriptions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** CreateWishlistSubscription */
        readonly post: operations["CreateWishlistSubscription"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/subscriptions/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetCurrentWishlistSubscription */
        readonly get: operations["GetCurrentWishlistSubscription"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/wishes/{wishId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetWish */
        readonly get: operations["SharedWishlists_GetWish"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/wishes/{wishId}/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets a current gift image through a short-lived active share-link grant. */
        readonly get: operations["WishImages_GetShared"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/shared-wishlists/{shareLinkId}/wishes/{wishId}/reservations/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetCurrentReservation */
        readonly get: operations["SharedWishlists_GetCurrentReservation"];
        /** UpsertCurrentReservation */
        readonly put: operations["SharedWishlists_UpsertCurrentReservation"];
        readonly post?: never;
        /** CancelCurrentReservation */
        readonly delete: operations["SharedWishlists_CancelCurrentReservation"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlist-subscriptions": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetWishlistSubscriptions */
        readonly get: operations["GetWishlistSubscriptions"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlist-subscriptions/{id}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** GetWishlistSubscription */
        readonly get: operations["GetWishlistSubscription"];
        readonly put?: never;
        readonly post?: never;
        /** DeleteWishlistSubscription */
        readonly delete: operations["DeleteWishlistSubscription"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets all private wishlists owned by the current member. */
        readonly get: operations["Wishlists_GetAll"];
        readonly put?: never;
        /** Creates a private wishlist for the current member. */
        readonly post: operations["Wishlists_Create"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets a private wishlist owned by the current member. */
        readonly get: operations["Wishlists_Get"];
        /** Updates a private wishlist owned by the current member. */
        readonly put: operations["Wishlists_Update"];
        readonly post?: never;
        /** Deletes a private wishlist owned by the current member. */
        readonly delete: operations["Wishlists_Delete"];
        readonly options?: never;
        readonly head?: never;
        /** Archives or restores an owned wishlist. */
        readonly patch: operations["SetWishlistArchivedRequest"];
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/group-visibility": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /**
         * Read group audience
         * @description Only the list owner may read or change visibility. Public lists (active public share link) are visible by default in all current and future owner groups, except explicitly unchecked groups. Private lists require explicit grants. No public capability is exposed. GET is side-effect free. PUT requires the visibility row xmin ETag, affects only supplied current memberships and atomically preserves omitted groups. Leaving removes the owner grants and exclusions. Public-link revocation removes default access without removing independent private grants. Images and reservation access use the same effective visibility.
         */
        readonly get: operations["Wishlists_ReadGroupVisibility"];
        /**
         * Set group audience atomically
         * @description Only the list owner may read or change visibility. Public lists (active public share link) are visible by default in all current and future owner groups, except explicitly unchecked groups. Private lists require explicit grants. No public capability is exposed. GET is side-effect free. PUT requires the visibility row xmin ETag, affects only supplied current memberships and atomically preserves omitted groups. Leaving removes the owner grants and exclusions. Public-link revocation removes default access without removing independent private grants. Images and reservation access use the same effective visibility.
         */
        readonly put: operations["Wishlists_SetGroupVisibility"];
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/share-link": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Get */
        readonly get: operations["WishlistShareLinks_Get"];
        /** Rotate */
        readonly put: operations["WishlistShareLinks_Rotate"];
        /** Manages the active share link of an owned wishlist. */
        readonly post: operations["WishlistShareLinks_Create"];
        /** Delete */
        readonly delete: operations["WishlistShareLinks_Delete"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wish-images/resolve": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /**
         * Resolve one explicitly selected product image.
         * @description Requires an authenticated owner of an active wishlist. Downloads only the submitted image through the public-only transport, without analyzing a product page or persisting data. Destinations and every redirect are validated; source bytes and image dimensions are bounded.
         */
        readonly post: operations["WishImages_ResolveSelected"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wish-import-previews": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Create */
        readonly post: operations["WishImportPreviews_Create"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets all gift wishes from an owned private wishlist. */
        readonly get: operations["Wishes_GetCollection"];
        readonly put?: never;
        /** Adds a gift wish manually to an owned private wishlist. */
        readonly post: operations["Wishes_Create"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        /** Replaces the complete order of gift wishes in an owned private wishlist. */
        readonly patch: operations["Wishes_Reorder"];
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/{wishId}": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets one gift wish from an owned private wishlist. */
        readonly get: operations["Wishes_Get"];
        /** Updates a gift wish in an owned private wishlist. */
        readonly put: operations["Wishes_Update"];
        readonly post?: never;
        /** Deletes a gift wish from an owned private wishlist. */
        readonly delete: operations["Wishes_Delete"];
        readonly options?: never;
        readonly head?: never;
        /** Sets the favorite preference of an owned wish. */
        readonly patch: operations["SetWishFavoriteRequest"];
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/{wishId}/copies": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Create an independent wish copy */
        readonly post: operations["Wishes_CopyOwned"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/{wishId}/image": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Gets a current private gift image through a short-lived owner grant. */
        readonly get: operations["WishImages_GetOwned"];
        /** Adds or replaces the normalized image of one owned gift wish. */
        readonly put: operations["Wishes_UpsertImage"];
        readonly post?: never;
        /** DeleteImage */
        readonly delete: operations["Wishes_DeleteImage"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/{wishId}/reservations/current": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        /** Manages only the authenticated owner reservation on an owned wish. */
        readonly get: operations["OwnedSharedWishlists_GetCurrentReservation"];
        /** Manages only the authenticated owner reservation on an owned wish. */
        readonly put: operations["OwnedSharedWishlists_UpsertCurrentReservation"];
        readonly post?: never;
        /** Manages only the authenticated owner reservation on an owned wish. */
        readonly delete: operations["OwnedSharedWishlists_CancelCurrentReservation"];
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/api/v1/wishlists/{wishlistId}/wishes/copies": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get?: never;
        readonly put?: never;
        /** Create an independent wish copy */
        readonly post: operations["Wishes_CopyShared"];
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/liveness": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get: operations["Liveness"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/readiness": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get: operations["Readiness"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
    readonly "/security/csrf-token": {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly get: operations["Security_GetCsrfToken"];
        readonly put?: never;
        readonly post?: never;
        readonly delete?: never;
        readonly options?: never;
        readonly head?: never;
        readonly patch?: never;
        readonly trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        readonly AccessTokenResponse: {
            readonly accessToken: string;
            /** Format: int32 */
            readonly expiresIn: number;
            readonly tokenType: string;
        };
        /** @enum {string} */
        readonly AdministrativeAuditAction: "wishlistSuspended" | "wishlistSuspensionReasonUpdated" | "wishlistReactivated" | "memberDataExportRequested" | "memberDataExportDownloadStarted" | "memberErased" | "memberSessionsRevoked";
        readonly AdministrativeAuditEventResponse: {
            readonly action: components["schemas"]["AdministrativeAuditAction"];
            readonly administratorDisplayName: string | null;
            readonly administratorId: string | null;
            /** Format: date-time */
            readonly createdAt: string;
            readonly exportId: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly memberId: string | null;
            readonly reason: string | null;
            readonly requestReference: string | null;
            readonly wishlistId: string | null;
        };
        readonly AdministrativeAuditRequest: {
            readonly action?: components["schemas"]["AdministrativeAuditAction"] | null;
            readonly administratorId?: string | null;
            readonly exportId?: string | null;
            readonly from?: string | null;
            readonly memberId?: string | null;
            readonly page?: number | null;
            readonly pageSize?: number | null;
            readonly requestReference?: string | null;
            readonly to?: string | null;
            readonly wishlistId?: string | null;
        };
        readonly CompleteGoogleSessionRequest: {
            readonly flow?: string | null;
        };
        readonly ConfirmEmailRequest: {
            readonly token?: string | null;
            readonly userId?: string | null;
        };
        readonly ConfirmMemberAccountDeletionRequest: {
            readonly token?: string | null;
        };
        readonly ConfirmMemberEmailChangeRequest: {
            readonly requestId?: string | null;
            readonly token?: string | null;
        };
        readonly CopyOwnedWishRequest: {
            /** Format: uuid */
            readonly destinationWishlistId: string;
        };
        readonly CopyWishRequest: {
            /** Format: uuid */
            readonly sourceShareLinkId: string;
            /** Format: uuid */
            readonly sourceWishId: string;
        };
        readonly CreateWishImportPreviewRequest: {
            readonly url?: string | null;
        };
        readonly CreateWishlistRequest: {
            readonly eventDate?: string | null;
            readonly message?: string | null;
            readonly name?: string | null;
            readonly occasion?: components["schemas"]["WishlistOccasion"] | null;
            readonly surpriseMode?: boolean | null;
        };
        readonly CreateWishRequest: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            readonly isFavorite?: boolean | null;
            /** @description Open-ended wish: name is its universe, note its preferences and price the optional maximum EUR budget per item. Omitted/null defaults to false on creation and preserves the saved value on update. */
            readonly isSurprise?: boolean | null;
            readonly name?: string | null;
            readonly note?: string | null;
            readonly price?: number | null;
            readonly quantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly url?: string | null;
        };
        readonly CsrfTokenResponse: {
            readonly token: string;
        };
        readonly CurrentSessionResponse: {
            readonly displayName: string;
            /** @description Server-assigned immutable account tag; never supplied when updating the display name. */
            readonly displayNameTag: string;
            readonly email: string;
            /** Format: uuid */
            readonly id: string;
            /** @description Whether the current account is associated with Google, independent of the session's sign-in method. */
            readonly isGoogleLinked: boolean;
            readonly isVisibleInMemberSearch: boolean;
            readonly profileImageUrl: string | null;
            readonly roles: readonly string[];
        };
        readonly ErrorResponse: {
            readonly errorCode: string | null;
            readonly message: string | null;
            /** Format: int32 */
            readonly statusCode: number;
            readonly title: string | null;
            readonly validationErrors: readonly components["schemas"]["ValidationError"][] | null;
        };
        readonly ExecuteAdministrativeAccountErasureRequest: {
            readonly confirmedMemberId?: string | null;
            readonly requestReference?: string | null;
        };
        readonly FileStreamResult: unknown;
        readonly "FileStreamResult), StatusCodes.Status200OK, WebpContentType)]\n    [ProducesResponseType(typeof(ErrorResponse": unknown;
        readonly GiftReservationHistoryResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly endedAt: string | null;
            /** Format: uuid */
            readonly groupId?: string | null;
            /** @description Current group-authorized frontend wish path, without any public sharing capability. */
            readonly groupWishPath?: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            /**
             * @description Known current access restriction. Lifecycle status remains independent; unavailable sources grant no media or navigation.
             * @enum {string|null}
             */
            readonly inaccessibilityReason?: "wishlistDeleted" | "notShared" | "suspended" | "archived" | "wishDeleted" | null;
            readonly isArchived: boolean;
            /** Format: date-time */
            readonly lastActivityAt: string;
            readonly ownedWishPath: string | null;
            readonly ownerDisplayName: string | null;
            readonly ownerId: string | null;
            /** Format: int32 */
            readonly quantity: number;
            readonly shareLinkId: string | null;
            readonly shareUrl: string | null;
            readonly status: components["schemas"]["GiftReservationHistoryStatus"];
            /** Format: uuid */
            readonly wishId: string;
            /** Format: uuid */
            readonly wishlistId: string;
            readonly wishlistName: string;
            readonly wishName: string;
        };
        /** @enum {string} */
        readonly GiftReservationHistoryStatus: "active" | "cancelled" | "unavailable";
        readonly GiftReservationResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly id: string;
            /** Format: int32 */
            readonly quantity: number;
            readonly updatedAt: string | null;
            /** Format: uuid */
            readonly wishId: string;
        };
        readonly GroupInvitationResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly displayName: string;
            readonly displayNameTag: string;
            /** Format: date-time */
            readonly expiresAt: string;
            /** Format: uuid */
            readonly groupId: string;
            readonly groupName: string;
            /** Format: uuid */
            readonly id: string;
            /** Format: uuid */
            readonly memberId: string;
            readonly ownerDisplayName: string;
        };
        readonly GroupJoinLinkResponse: {
            /** @description 80-bit bearer credential. Never log or store in browser persistence. */
            readonly code: string;
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly groupId: string;
            /**
             * Format: uri
             * @description Frontend /groups/join URL containing the code only in its fragment.
             */
            readonly joinUrl: string;
        };
        readonly GroupJoinPreviewResponse: {
            /** Format: uuid */
            readonly id: string;
            readonly memberCount: number;
            readonly name: string;
            readonly profileImageUrl: string | null;
        };
        readonly GroupMemberResponse: {
            readonly displayName: string;
            readonly displayNameTag: string;
            /** Format: uuid */
            readonly id: string;
            /** Format: date-time */
            readonly joinedAt: string;
            /** Format: uri */
            readonly profileImageUrl: string | null;
        };
        readonly GroupResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly id: string;
            readonly memberCount: number;
            readonly name: string;
            /** Format: uuid */
            readonly ownerId: string;
            /**
             * Format: uri
             * @description Short-lived image grant restricted to a current accepted member; null when no photo is set.
             */
            readonly profileImageUrl: string | null;
            /** Format: date-time */
            readonly updatedAt: string | null;
        };
        readonly GroupWishlistResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: date */
            readonly eventDate: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly name: string;
            /** @enum {string} */
            readonly occasion: "birthday" | "christmas" | "wedding" | "birth" | "other";
            readonly ownerDisplayName: string;
            /** Format: uuid */
            readonly ownerId: string;
        };
        readonly InviteGroupMemberRequest: {
            /** Format: uuid */
            readonly memberId: string;
        };
        /** @description Guest details are required only for anonymous enrollment; authenticated members ignore these details. */
        readonly JoinSharedWishlistRequest: {
            /** @description Guest display name: nonblank, no control characters, at most 80 Unicode scalar values after trimming. */
            readonly displayName?: string | null;
        } | null;
        readonly LinkGoogleAccountRequest: {
            readonly currentPassword?: string | null;
            readonly flow?: string | null;
        };
        readonly LoginRequest: {
            readonly email?: string | null;
            readonly password?: string | null;
            readonly rememberMe?: boolean;
        };
        readonly MemberProfileResponse: {
            readonly displayName: string;
            /** @description Server-assigned immutable account tag; never supplied when updating the display name. */
            readonly displayNameTag: string;
            readonly isVisibleInMemberSearch: boolean;
            readonly profileImageUrl: string | null;
        };
        readonly PaginatedResponseOfAdministrativeAuditEventResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["AdministrativeAuditEventResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfGiftReservationHistoryResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["GiftReservationHistoryResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfGroupInvitationResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["GroupInvitationResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfGroupMemberResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["GroupMemberResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfGroupResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["GroupResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfGroupWishlistResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["GroupWishlistResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfReportedWishlistSummary: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["ReportedWishlistSummary"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfUserSearchResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["UserSearchResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfWishlistModerationEventResponse: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["WishlistModerationEventResponse"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfWishlistReportDetails: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["WishlistReportDetails"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PaginatedResponseOfWishlistReportReviewEventDetails: {
            readonly currentPage: number;
            readonly hasNextPage: boolean;
            readonly hasPreviousPage: boolean;
            readonly items: readonly components["schemas"]["WishlistReportReviewEventDetails"][];
            readonly pageSize: number;
            readonly totalCount: number;
            readonly totalPages: number;
        };
        readonly PersonalDataExportResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly errorCode: string | null;
            readonly expiresAt: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly readyAt: string | null;
            readonly sizeInBytes: number | null;
            readonly snapshotAt: string | null;
            readonly status: components["schemas"]["PersonalDataExportStatus"];
        };
        /** @enum {string} */
        readonly PersonalDataExportStatus: "queued" | "processing" | "ready" | "failed" | "expired";
        readonly PublicMemberProfileResponse: {
            readonly displayName?: string;
            /** @description Server-assigned immutable account tag; never supplied when updating the display name. */
            readonly displayNameTag?: string;
            /** Format: uuid */
            readonly id?: string;
            /** Format: uri */
            readonly profileImageUrl?: string | null;
            readonly wishlists?: readonly components["schemas"]["PublicMemberWishlistResponse"][];
        };
        readonly PublicMemberWishlistResponse: {
            /** Format: date */
            readonly eventDate?: string | null;
            /** Format: uuid */
            readonly id?: string;
            readonly name?: string;
            readonly occasion?: components["schemas"]["WishlistOccasion"];
            /** Format: uri */
            readonly shareUrl?: string;
        };
        readonly RegisterAccountRequest: {
            readonly displayName?: string | null;
            readonly email?: string | null;
            readonly password?: string | null;
        };
        readonly ReorderWishesRequest: {
            readonly wishIds?: readonly string[] | null;
        };
        readonly ReportedWishlistResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly eventDate: string | null;
            readonly isSuspended: boolean;
            readonly message: string | null;
            readonly name: string;
            readonly occasion: components["schemas"]["WishlistOccasion"];
            readonly ownerDisplayName: string;
            /** Format: uuid */
            readonly ownerId: string;
            readonly suspendedAt: string | null;
            readonly suspensionReason: string | null;
            readonly updatedAt: string | null;
            readonly wishes: readonly components["schemas"]["ReportedWishResponse"][];
            /** Format: uuid */
            readonly wishlistId: string;
        };
        readonly ReportedWishlistSummary: {
            readonly isSuspended: boolean;
            /** Format: date-time */
            readonly lastReportedAt: string;
            readonly name: string;
            readonly ownerDisplayName: string;
            /** Format: uuid */
            readonly ownerId: string;
            /** Format: int32 */
            readonly reportCount: number;
            /** Format: uuid */
            readonly wishlistId: string;
        };
        readonly ReportedWishResponse: {
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            readonly name: string;
            readonly note: string | null;
            /** Format: int64 */
            readonly position: number;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly updatedAt: string | null;
            readonly url: string | null;
        };
        readonly ReportSharedWishlistRequest: {
            readonly details?: string | null;
            readonly reason?: components["schemas"]["WishlistReportReason"] | null;
        };
        readonly RequestAdministrativeDataExportRequest: {
            readonly requestReference?: string | null;
        };
        readonly RequestEmailConfirmationRequest: {
            readonly email?: string | null;
        };
        readonly RequestPasswordResetRequest: {
            readonly email?: string | null;
        };
        readonly ResetPasswordRequest: {
            readonly newPassword?: string | null;
            readonly token?: string | null;
            readonly userId?: string | null;
        };
        readonly ResolveWishImageRequest: {
            /** Format: uri */
            readonly url: string;
        };
        readonly RevokeMemberSessionsRequest: {
            readonly confirmedMemberId?: string | null;
            readonly requestReference?: string | null;
        };
        readonly SaveGroupRequest: {
            readonly name: string;
        };
        readonly SetWishFavoriteRequest: {
            readonly isFavorite: boolean;
        };
        readonly SetWishlistArchivedRequest: {
            readonly isArchived: boolean;
        };
        readonly SetWishlistGroupVisibilityRequest: {
            readonly groups: readonly {
                /** Format: uuid */
                readonly groupId: string;
                readonly isVisible: boolean;
            }[];
        };
        readonly SharedWishDetailResponse: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean;
            /** Format: int32 */
            readonly availableQuantity: number | null;
            /** @description False for the authenticated owner: this shared view is read-only regardless of surprise mode. */
            readonly canReserve: boolean;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            readonly currentParticipantReservedQuantity: number | null;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            readonly isFavorite?: boolean;
            /** @description Open-ended wish: price is an optional maximum EUR budget per item, not an exact product price. */
            readonly isSurprise?: boolean;
            readonly name: string;
            readonly note: string | null;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            /** Format: int32 */
            readonly reservedQuantity: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly url: string | null;
        };
        readonly SharedWishlistResponse: {
            /** @description False for the authenticated owner: this shared view is read-only regardless of surprise mode. */
            readonly canReserve: boolean;
            readonly canSubscribe?: boolean;
            readonly currentParticipant: components["schemas"]["WishlistParticipantResponse"] | null;
            readonly eventDate: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly message: string | null;
            readonly name: string;
            readonly occasion: components["schemas"]["WishlistOccasion"];
            readonly ownerDisplayName: string;
            /** Format: uuid */
            readonly ownerId: string;
            readonly wishes: readonly components["schemas"]["SharedWishResponse"][];
        };
        readonly SharedWishResponse: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean;
            /** Format: int32 */
            readonly availableQuantity: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            readonly currentParticipantReservedQuantity: number | null;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            readonly isFavorite?: boolean;
            /** @description Open-ended wish: price is an optional maximum EUR budget per item, not an exact product price. */
            readonly isSurprise?: boolean;
            readonly name: string;
            /** @description Optional public wish description. */
            readonly note?: string | null;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            /** Format: int32 */
            readonly reservedQuantity: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly url: string | null;
        };
        readonly TwoFactorChallengeResponse: {
            /** Format: date-time */
            readonly expiresAt: string;
            readonly flow: string;
            readonly requiredAction: components["schemas"]["TwoFactorRequiredAction"];
        };
        readonly TwoFactorCompletionRequest: {
            readonly code?: string | null;
            readonly flow?: string | null;
            readonly recoveryCode?: string | null;
        };
        /** @enum {string} */
        readonly TwoFactorFlowPurpose: "signIn" | "replaceAuthenticator" | "regenerateRecoveryCodes";
        readonly TwoFactorFlowRequest: {
            readonly flow?: string | null;
        };
        readonly TwoFactorReauthenticationRequest: {
            readonly code?: string | null;
            readonly purpose?: components["schemas"]["TwoFactorFlowPurpose"] | null;
            readonly recoveryCode?: string | null;
        };
        readonly TwoFactorRecoveryCodesResponse: {
            readonly recoveryCodes: readonly string[];
        };
        /** @enum {string} */
        readonly TwoFactorRequiredAction: "verify" | "enroll" | "replace" | "complete";
        readonly TwoFactorSetupConfirmationRequest: {
            readonly code?: string | null;
            readonly flow?: string | null;
        };
        readonly TwoFactorSetupResponse: {
            readonly manualKey: string;
            readonly otpAuthUri: string;
        };
        readonly TwoFactorStatusResponse: {
            readonly isEnabled: boolean;
            /** Format: int32 */
            readonly remainingRecoveryCodes: number;
        };
        readonly UpdateMemberEmailRequest: {
            readonly currentPassword?: string | null;
            readonly email?: string | null;
        };
        readonly UpdateMemberPasswordRequest: {
            readonly currentPassword?: string | null;
            readonly newPassword?: string | null;
        };
        readonly UpdateMemberProfileRequest: {
            readonly displayName?: string | null;
            readonly isVisibleInMemberSearch?: boolean | null;
        };
        readonly UpdateWishlistModerationRequest: {
            readonly isSuspended?: boolean | null;
            readonly reason?: string | null;
        };
        readonly UpdateWishlistReportReviewRequest: {
            readonly reviewNote?: string | null;
            readonly status?: components["schemas"]["WishlistReportStatus"] | null;
        };
        readonly UpdateWishlistRequest: {
            readonly eventDate?: string | null;
            readonly message?: string | null;
            readonly name?: string | null;
            readonly occasion?: components["schemas"]["WishlistOccasion"] | null;
            readonly surpriseMode?: boolean | null;
        };
        readonly UpdateWishRequest: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            readonly isFavorite?: boolean | null;
            /** @description Open-ended wish: name is its universe, note its preferences and price the optional maximum EUR budget per item. Omitted/null defaults to false on creation and preserves the saved value on update. */
            readonly isSurprise?: boolean | null;
            readonly name?: string | null;
            readonly note?: string | null;
            readonly price?: number | null;
            readonly quantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly url?: string | null;
        };
        readonly UpsertGiftReservationRequest: {
            readonly quantity?: number | null;
        };
        readonly UserSearchResponse: {
            readonly displayName: string;
            /** @description Server-assigned immutable account tag; never supplied when updating the display name. */
            readonly displayNameTag: string;
            /** Format: uuid */
            readonly id: string;
            readonly profileImageUrl: string | null;
        };
        readonly ValidationError: {
            readonly errorMessage: string | null;
            readonly propertyName: string | null;
        };
        readonly WishCollectionItemResponse: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean;
            /** Format: int32 */
            readonly availableQuantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            /** Format: date-time */
            readonly createdAt: string;
            readonly entityTag: string;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            readonly isFavorite?: boolean;
            /** @description Open-ended wish: price is an optional maximum EUR budget per item, not an exact product price. */
            readonly isSurprise?: boolean;
            readonly name: string;
            readonly note: string | null;
            /** Format: int64 */
            readonly position: number;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            /** Format: int32 */
            readonly reservedQuantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly updatedAt: string | null;
            readonly url: string | null;
            /** Format: uuid */
            readonly wishlistId: string;
        };
        readonly WishCollectionResponse: {
            readonly wishes: readonly components["schemas"]["WishCollectionItemResponse"][];
        };
        readonly WishImportImage: {
            readonly contentBase64: string | null;
            readonly contentType: string | null;
        };
        readonly WishImportPreview: {
            readonly image: components["schemas"]["WishImportImage"] | null;
            readonly name: string | null;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            readonly url: string | null;
            readonly warnings: readonly string[];
        };
        readonly WishlistGroupVisibilityResponse: {
            readonly groups: readonly components["schemas"]["WishlistGroupVisibilityResponseItem"][];
            readonly isPublic: boolean;
            /** Format: uuid */
            readonly wishlistId: string;
        };
        readonly WishlistGroupVisibilityResponseItem: {
            /** Format: uuid */
            readonly groupId: string;
            readonly isVisible: boolean;
            readonly name: string;
        };
        /** @enum {string} */
        readonly WishlistModerationAction: "suspended" | "reasonUpdated" | "reactivated";
        readonly WishlistModerationEventResponse: {
            readonly action: components["schemas"]["WishlistModerationAction"];
            readonly administratorId: string | null;
            /** Format: uuid */
            readonly id: string;
            /** Format: date-time */
            readonly occurredAt: string;
            readonly reason: string | null;
        };
        readonly WishlistModerationResponse: {
            readonly isSuspended: boolean;
            readonly suspendedAt: string | null;
            readonly suspensionReason: string | null;
            /** Format: uuid */
            readonly wishlistId: string;
        };
        /** @enum {string} */
        readonly WishlistOccasion: "birthday" | "christmas" | "wedding" | "birth" | "other";
        readonly WishlistParticipantResponse: {
            readonly displayName: string;
            /** Format: uuid */
            readonly id: string;
        };
        readonly WishlistReportDetails: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly details: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly reason: components["schemas"]["WishlistReportReason"];
            readonly reviewedAt: string | null;
            readonly reviewedByAdministratorId: string | null;
            readonly reviewNote: string | null;
            readonly status: components["schemas"]["WishlistReportStatus"];
        };
        /** @enum {string} */
        readonly WishlistReportReason: "spamOrScam" | "inappropriateContent" | "privacyViolation" | "other";
        readonly WishlistReportReviewEventDetails: {
            readonly administratorId: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly note: string | null;
            /** Format: date-time */
            readonly occurredAt: string;
            readonly previousStatus: components["schemas"]["WishlistReportStatus"];
            readonly status: components["schemas"]["WishlistReportStatus"];
        };
        /** @enum {string} */
        readonly WishlistReportStatus: "pending" | "upheld" | "dismissed";
        /** @enum {string} */
        readonly WishlistReportStatusFilter: "pending" | "upheld" | "dismissed" | "all";
        readonly WishlistResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            readonly eventDate: string | null;
            /** Format: uuid */
            readonly id: string;
            readonly isArchived?: boolean;
            readonly isSuspended: boolean;
            readonly message: string | null;
            readonly name: string;
            readonly occasion: components["schemas"]["WishlistOccasion"];
            readonly surpriseMode?: boolean;
            readonly suspendedAt: string | null;
            readonly suspensionReason: string | null;
            readonly updatedAt: string | null;
        };
        readonly WishlistShareLinkResponse: {
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly id: string;
            readonly shareUrl: string;
            readonly updatedAt: string | null;
        };
        readonly WishlistSubscriptionResponse: {
            /** Format: date-time */
            readonly createdAt?: string;
            /** Format: date */
            readonly eventDate?: string | null;
            /** Format: uuid */
            readonly id?: string;
            readonly name?: string;
            readonly occasion?: components["schemas"]["WishlistOccasion"];
            readonly ownerDisplayName?: string;
            /**
             * Format: uri
             * @description Authorized frontend URL: either a public shared wishlist with its fragment capability or a private /groups/{groupId}/wishlists/{wishlistId} route requiring current membership.
             */
            readonly shareUrl?: string;
            /** Format: uuid */
            readonly wishlistId?: string;
        };
        readonly WishOrderItemResponse: {
            readonly entityTag: string;
            /** Format: uuid */
            readonly id: string;
            /** Format: int64 */
            readonly position: number;
        };
        readonly WishOrderResponse: {
            readonly wishes: readonly components["schemas"]["WishOrderItemResponse"][];
        };
        readonly WishResponse: {
            /** @description Second-hand gifts are welcome; false does not require new. Omitted/null preserves the value on update, defaults to false on creation. */
            readonly acceptsSecondHand?: boolean;
            /** Format: int32 */
            readonly availableQuantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly color?: string | null;
            /** Format: date-time */
            readonly createdAt: string;
            /** Format: uuid */
            readonly id: string;
            readonly imageUrl: string | null;
            readonly isFavorite?: boolean;
            /** @description Open-ended wish: price is an optional maximum EUR budget per item, not an exact product price. */
            readonly isSurprise?: boolean;
            readonly name: string;
            readonly note: string | null;
            /** Format: int64 */
            readonly position: number;
            readonly price: number | null;
            /** Format: int32 */
            readonly quantity: number;
            /** Format: int32 */
            readonly reservedQuantity?: number | null;
            /** @description Optional single-line variant; blank values are normalized to null. */
            readonly size?: string | null;
            readonly updatedAt: string | null;
            readonly url: string | null;
            /** Format: uuid */
            readonly wishlistId: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    readonly AdministrativeAudit_GetPage: {
        readonly parameters: {
            readonly query?: {
                readonly action?: components["schemas"]["AdministrativeAuditAction"] | null;
                readonly administratorId?: string | null;
                readonly exportId?: string | null;
                readonly from?: string | null;
                readonly memberId?: string | null;
                readonly page?: number;
                readonly pageSize?: number;
                readonly requestReference?: string | null;
                readonly to?: string | null;
                readonly wishlistId?: string | null;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfAdministrativeAuditEventResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeDataExports_Request: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["RequestAdministrativeDataExportRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeDataExports_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly exportId: string;
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeDataExports_Download: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly exportId: string;
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/zip": components["schemas"]["FileStreamResult"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeDataExports_GetLatest: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeAccountErasures_Execute: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ExecuteAdministrativeAccountErasureRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AdministrativeSessionRevocations_Execute: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["RevokeMemberSessionsRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ReportedWishlists_GetPage: {
        readonly parameters: {
            readonly query?: {
                readonly isSuspended?: boolean;
                readonly page?: number;
                readonly pageSize?: number;
                readonly reason?: components["schemas"]["WishlistReportReason"] | null;
                readonly status?: components["schemas"]["WishlistReportStatusFilter"] | null;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfReportedWishlistSummary"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ReportedWishlists_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ReportedWishlistResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ReportedWishlists_GetReports: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
                readonly reason?: components["schemas"]["WishlistReportReason"] | null;
                readonly status?: components["schemas"]["WishlistReportStatusFilter"] | null;
            };
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfWishlistReportDetails"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistReportReviews_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly reportId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistReportDetails"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistReportReviews_Update: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly reportId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateWishlistReportReviewRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistReportDetails"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistReportReviews_GetEvents: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path: {
                readonly reportId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfWishlistReportReviewEventDetails"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ReportedWishlists_GetImage: {
        readonly parameters: {
            readonly query: {
                readonly token: string;
            };
            readonly header?: never;
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "image/webp": string;
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistModeration_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistModerationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistModeration_Update: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateWishlistModerationRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistModerationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistModeration_GetEvents: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfWishlistModerationEventResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly EmailConfirmations_ConfirmEmailChange: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ConfirmMemberEmailChangeRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly EmailConfirmations_RequestConfirmation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["RequestEmailConfirmationRequest"];
            };
        };
        readonly responses: {
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly EmailConfirmations_Confirm: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ConfirmEmailRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GoogleAuthentication_Challenge: {
        readonly parameters: {
            readonly query?: {
                readonly rememberMe?: boolean;
                readonly returnPath?: string | null;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 302Found */
            readonly 302: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GoogleAuthentication_Callback: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/x-www-form-urlencoded": {
                    readonly code?: string;
                    readonly error?: string;
                    readonly error_description?: string;
                    readonly state?: string;
                };
            };
        };
        readonly responses: {
            /** @description 302Found */
            readonly 302: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Request failed */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GoogleAuthentication_Complete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CompleteGoogleSessionRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["AccessTokenResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorChallengeResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GoogleAuthentication_Link: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["LinkGoogleAccountRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["AccessTokenResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorChallengeResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PasswordResets_Request: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["RequestPasswordResetRequest"];
            };
        };
        readonly responses: {
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PasswordResets_Reset: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ResetPasswordRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AuthRegistrations_Register: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["RegisterAccountRequest"];
            };
        };
        readonly responses: {
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AuthSessions_Login: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["LoginRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["AccessTokenResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorChallengeResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AuthSessions_GetCurrent: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["CurrentSessionResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AuthSessions_Logout: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly AuthSessions_Refresh: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["AccessTokenResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly TwoFactorAuthentication_Complete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["TwoFactorCompletionRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["AccessTokenResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorChallengeResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly TwoFactorAuthentication_RegenerateRecoveryCodes: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["TwoFactorFlowRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorRecoveryCodesResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly TwoFactorAuthentication_GetSetup: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["TwoFactorFlowRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorSetupResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly TwoFactorAuthentication_ConfirmSetup: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["TwoFactorSetupConfirmationRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorRecoveryCodesResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_13: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGroupInvitationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_14: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly invitationId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupInvitationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_15: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly invitationId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_16: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly invitationId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_1: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGroupResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_2: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["SaveGroupRequest"];
            };
        };
        readonly responses: {
            /** @description Success */
            readonly 201: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_3: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_4: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["SaveGroupRequest"];
            };
        };
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_5: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_26: {
        readonly parameters: {
            readonly query: {
                readonly token: string;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "image/webp": string;
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_27: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "multipart/form-data": {
                    /** Format: binary */
                    readonly image: string;
                };
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 429TooManyRequests */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_28: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 429TooManyRequests */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_9: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGroupInvitationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_10: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["InviteGroupMemberRequest"];
            };
        };
        readonly responses: {
            /** @description Success */
            readonly 201: {
                headers: {
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupInvitationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_11: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly invitationId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupInvitationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_12: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly invitationId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_ReadJoinLink: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK; an existing membership is returned idempotently. */
            readonly 200: {
                headers: {
                    /** @description Strong join-link version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupJoinLinkResponse"];
                };
            };
            /** @description Invalid input or CSRF */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member without owner permission for revocation */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Group or active join code unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Existing join link or group/member capacity reached */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Join link version changed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required for revocation */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected failure */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Dependency unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_CreateJoinLink: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Created */
            readonly 201: {
                headers: {
                    /** @description Strong join-link version. */
                    readonly ETag?: string;
                    /** @description Canonical resource path without credentials. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupJoinLinkResponse"];
                };
            };
            /** @description Invalid input or CSRF */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member without owner permission for revocation */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Group or active join code unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Existing join link or group/member capacity reached */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Join link version changed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required for revocation */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected failure */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Dependency unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_RevokeJoinLink: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Strong ETag of the current join link. */
                readonly "If-Match": string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Join link and code revoked; existing memberships preserved. */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid input or CSRF */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member without owner permission for revocation */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Group or active join code unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Existing join link or group/member capacity reached */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Join link version changed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required for revocation */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected failure */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Dependency unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_6: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGroupMemberResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_8: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_7: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_PreviewInvitation: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description HTML Open Graph preview; application/json when explicitly requested. Active invitations advertise only group identity, never member identities, lists, join codes or credentials. Revocation returns 404. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupJoinPreviewResponse"];
                    readonly "text/html": string;
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_PreviewInvitationImage: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Normalized current group photo or branded fallback, only while the invitation is active; no-store. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "image/png": string;
                    readonly "image/webp": string;
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_17: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGroupWishlistResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_18: {
        readonly parameters: {
            readonly query?: {
                readonly availableOnly?: boolean;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["SharedWishlistResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_19: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 201: {
                headers: {
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupWishlistResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_20: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly CreateGroupWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 201: {
                headers: {
                    /** @description The created subscription URL. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistSubscriptionResponse"];
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetCurrentGroupWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistSubscriptionResponse"];
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_21: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["SharedWishDetailResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly CopyGroupWish: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CopyOwnedWishRequest"];
            };
        };
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_25: {
        readonly parameters: {
            readonly query: {
                readonly token: string;
            };
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "image/webp": string;
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_22: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_23: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Required when updating an existing reservation; omitted for creation. */
                readonly "If-Match"?: string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpsertGiftReservationRequest"];
            };
        };
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description Reservation created */
            readonly 201: {
                headers: {
                    readonly ETag?: string;
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_24: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly groupId: string;
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    /** @description Strong PostgreSQL xmin version */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Invalid request or CSRF token */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member is not the owner */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Absent, expired or private foreign resource */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Membership, capacity or sharing conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_PreviewByCode: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Invitation code, sent only in this header; never in a server URL. */
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Advertised group identity only */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupJoinPreviewResponse"];
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Invalid or unavailable invitation */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Groups_JoinByCode: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
                /** @description Group code, case insensitive; optional hyphens accepted. Never place it in a server URL. */
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description OK; an existing membership is returned idempotently. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Created */
            readonly 201: {
                headers: {
                    /** @description Canonical resource path without credentials. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GroupResponse"];
                };
            };
            /** @description Invalid input or CSRF */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Accepted member without owner permission for revocation */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Group or active join code unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Existing join link or group/member capacity reached */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Join link version changed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required for revocation */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected failure */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Dependency unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_Search: {
        readonly parameters: {
            readonly query?: {
                readonly displayName?: string | null;
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfUserSearchResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetPublicMemberProfile: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PublicMemberProfileResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ProfileImages_Get: {
        readonly parameters: {
            readonly query: {
                readonly imageId: string;
            };
            readonly header?: never;
            readonly path: {
                readonly memberId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "image/webp": components["schemas"]["FileStreamResult"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PersonalDataExports_Request: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PersonalDataExports_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly exportId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PersonalDataExports_Download: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly exportId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/zip": components["schemas"]["FileStreamResult"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly PersonalDataExports_GetLatest: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PersonalDataExportResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_RequestAccountDeletion: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_ConfirmAccountDeletion: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ConfirmMemberAccountDeletionRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_UpdateEmail: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateMemberEmailRequest"];
            };
        };
        readonly responses: {
            /** @description 202Accepted */
            readonly 202: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 403Forbidden */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_UpdatePassword: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateMemberPasswordRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 403Forbidden */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_UpdateProfile: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateMemberProfileRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["MemberProfileResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ProfileImages_Upsert: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "multipart/form-data": {
                    /** Format: binary */
                    readonly image: string;
                };
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["MemberProfileResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly ProfileImages_Delete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Members_GetReservationHistory: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
                readonly status?: string | null;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["PaginatedResponseOfGiftReservationHistoryResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly MemberTwoFactor_GetStatus: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorStatusResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly MemberTwoFactor_Reauthenticate: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["TwoFactorReauthenticationRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["TwoFactorChallengeResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_Get: {
        readonly parameters: {
            readonly query?: {
                readonly availableOnly?: boolean;
            };
            readonly header: {
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["SharedWishlistResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_Join: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: {
            readonly content: {
                readonly "application/json": components["schemas"]["JoinSharedWishlistRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                };
            };
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_GetCurrent: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistParticipantResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_Report: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ReportSharedWishlistRequest"];
            };
        };
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly CreateWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
                /** @description Capability received from the frontend fragment, never a server URL. */
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 201: {
                headers: {
                    /** @description The created subscription URL. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistSubscriptionResponse"];
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetCurrentWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                /** @description Capability received from the frontend fragment, never a server URL. */
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistSubscriptionResponse"];
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_GetWish: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
                readonly wishId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["SharedWishDetailResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishImages_GetShared: {
        readonly parameters: {
            readonly query: {
                readonly token: string;
            };
            readonly header?: never;
            readonly path: {
                readonly shareLinkId: string;
                readonly wishId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["FileStreamResult), StatusCodes.Status200OK, WebpContentType)]\n    [ProducesResponseType(typeof(ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_GetCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
                readonly wishId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_UpsertCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
                readonly wishId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpsertGiftReservationRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SharedWishlists_CancelCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly shareLinkId: string;
                readonly wishId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetWishlistSubscriptions: {
        readonly parameters: {
            readonly query?: {
                readonly page?: number;
                readonly pageSize?: number;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": {
                        readonly currentPage?: number;
                        readonly hasNextPage?: boolean;
                        readonly hasPreviousPage?: boolean;
                        readonly items?: readonly components["schemas"]["WishlistSubscriptionResponse"][];
                        readonly pageSize?: number;
                        readonly totalCount?: number;
                        readonly totalPages?: number;
                    };
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly GetWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly id: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistSubscriptionResponse"];
                };
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly DeleteWishlistSubscription: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly id: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Success */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description Error */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Error */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_GetAll: {
        readonly parameters: {
            readonly query?: {
                /** @description Omission returns active lists; true returns archived lists. */
                readonly isArchived?: boolean;
            };
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": readonly components["schemas"]["WishlistResponse"][];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_Create: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CreateWishlistRequest"];
            };
        };
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_Update: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateWishlistRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_Delete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SetWishlistArchivedRequest: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["SetWishlistArchivedRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_ReadGroupVisibility: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Current group visibility */
            readonly 200: {
                headers: {
                    /** @description Strong xmin version of the visibility policy */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistGroupVisibilityResponse"];
                };
            };
            /** @description Invalid request */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Owned list or current membership unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Archived or suspended list */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale visibility version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishlists_SetGroupVisibility: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["SetWishlistGroupVisibilityRequest"];
            };
        };
        readonly responses: {
            /** @description Current group visibility */
            readonly 200: {
                headers: {
                    /** @description Strong xmin version of the visibility policy */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistGroupVisibilityResponse"];
                };
            };
            /** @description Invalid request */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Owned list or current membership unavailable */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Archived or suspended list */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Stale visibility version */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description If-Match required */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistShareLinks_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistShareLinks_Rotate: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistShareLinks_Create: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishlistShareLinkResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishlistShareLinks_Delete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishImages_ResolveSelected: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ResolveWishImageRequest"];
            };
        };
        readonly responses: {
            /** @description Normalized image selected by the member. */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishImportImage"];
                };
            };
            /** @description Invalid JSON or image URL. */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Authentication required. */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Origin or CSRF check failed. */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The private list is unavailable. */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The selected image could not be retrieved or decoded. */
            readonly 422: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Rate limit exceeded. */
            readonly 429: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Unexpected error. */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishImportPreviews_Create: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CreateWishImportPreviewRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishImportPreview"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_GetCollection: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishCollectionResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_Create: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CreateWishRequest"];
            };
        };
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_Reorder: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["ReorderWishesRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishOrderResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_Get: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_Update: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpdateWishRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_Delete: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly SetWishFavoriteRequest: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["SetWishFavoriteRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_CopyOwned: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CopyOwnedWishRequest"];
            };
        };
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly WishImages_GetOwned: {
        readonly parameters: {
            readonly query: {
                readonly token: string;
            };
            readonly header?: never;
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["FileStreamResult), StatusCodes.Status200OK, WebpContentType)]\n    [ProducesResponseType(typeof(ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_UpsertImage: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "multipart/form-data": {
                    /** Format: binary */
                    readonly image: string;
                };
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_DeleteImage: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly OwnedSharedWishlists_GetCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly OwnedSharedWishlists_UpsertCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["UpsertGiftReservationRequest"];
            };
        };
        readonly responses: {
            /** @description 200OK */
            readonly 200: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["GiftReservationResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly OwnedSharedWishlists_CancelCurrentReservation: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "If-Match": string;
                /** @description Signed double-submit token returned by /security/csrf-token; browser cookies must be included. */
                readonly "X-CSRF-TOKEN": string;
            };
            readonly path: {
                readonly wishId: string;
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description 204NoContent */
            readonly 204: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content?: never;
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 401Unauthorized */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 412PreconditionFailed */
            readonly 412: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 428PreconditionRequired */
            readonly 428: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Wishes_CopyShared: {
        readonly parameters: {
            readonly query?: never;
            readonly header: {
                readonly "X-MonKado-Share-Token": string;
            };
            readonly path: {
                readonly wishlistId: string;
            };
            readonly cookie?: never;
        };
        readonly requestBody: {
            readonly content: {
                readonly "application/json": components["schemas"]["CopyWishRequest"];
            };
        };
        readonly responses: {
            /** @description 201Created */
            readonly 201: {
                headers: {
                    /** @description Quoted lowercase hexadecimal PostgreSQL xmin version. */
                    readonly ETag?: string;
                    /** @description URL of the created resource. */
                    readonly Location?: string;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["WishResponse"];
                };
            };
            /** @description 400BadRequest */
            readonly 400: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 401: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 403: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 404NotFound */
            readonly 404: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 409Conflict */
            readonly 409: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 413PayloadTooLarge */
            readonly 413: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 415UnsupportedMediaType */
            readonly 415: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description Request failed */
            readonly 500: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description 503ServiceUnavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Liveness: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Healthy */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": string;
                };
            };
            /** @description Unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Readiness: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Healthy */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "text/plain": string;
                };
            };
            /** @description Unavailable */
            readonly 503: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
    readonly Security_GetCsrfToken: {
        readonly parameters: {
            readonly query?: never;
            readonly header?: never;
            readonly path?: never;
            readonly cookie?: never;
        };
        readonly requestBody?: never;
        readonly responses: {
            /** @description Browser CSRF token */
            readonly 200: {
                headers: {
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["CsrfTokenResponse"];
                };
            };
            /** @description The request quota was exceeded. Retry-After gives the remaining wait in seconds. */
            readonly 429: {
                headers: {
                    readonly "Retry-After"?: number;
                    readonly [name: string]: unknown;
                };
                content: {
                    readonly "application/json": components["schemas"]["ErrorResponse"];
                };
            };
        };
    };
}
