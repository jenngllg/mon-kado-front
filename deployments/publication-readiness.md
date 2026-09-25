# Reviewed beta publication — MK-828

## Scope and present defaults

The beta is open without an email allowlist or invitation gate. Existing email
confirmation, verified account ownership, MFA requirements, CSRF and quotas still
apply. This is not permission to bypass backend authentication or authorize every
Google account to use an OAuth application that is still in Google's testing mode.

Canonical origins remain `https://www.monkado.fr` and `https://api.monkado.fr`.
The apex redirects to `www`; do not add it to credentialed CORS as a shortcut.
The existing VPS serves the frontend through Caddy. No paid option, new public
port, Grafana account, Node server or production secret in CI is introduced.

`publication.json` is public, revision-bound configuration. A production build
ignores ambient `VITE_API_BASE_URL` and `VITE_GOOGLE_AUTH_ENABLED` overrides.
Google is currently **disabled** and legal approval is **false**. Builds and local
tests are possible; publication is intentionally refused. The separate `e2e` mode
pins the simulated API to localhost, has Google disabled, and writes `.e2e-dist`.
Never package that test directory. Browser routes abort unexpected destinations.

## Legal approval is a human decision

The three French documents are substantive **drafts**, not a compliance
certification or published terms. The public contact approved for this work is
`monkado.app@gmail.com`. Do not derive the operator's civil name or address from
Git, account profiles, chat history or other repositories.

Before opening to users, the operator must approve:

- The editor/controller identity, publication responsibility, contact details
  and any applicable nonprofessional-editor arrangements.
- Actual hosting entities and addresses, VPS region, Google account terms,
  processor relationships and any international-transfer safeguards. A French
  domain or encrypted backup does not prove EU-only processing.
- Purposes and legal bases, the proposed security/administration legitimate
  interests assessment, minors' information, support and complaint handling.
- Terms, moderation/appeal information, beta price commitments and availability
  wording. No acceptance checkbox or consent record is invented by this issue.
- The deployed retention settings versus the technical inventory below.

Then replace all draft markers, record an actual `YYYY-MM-DD` legal version in
all three pages and in `publication.json`, and set `legalApproved` to true in a
separately reviewed commit. The verifier checks explicit approval, exact fields,
date validity, required documents and draft markers. It is a publication guard,
**not** a semantic legal validator; never remove a marker simply to pass CI.

Primary reference material reviewed for this draft:
[CNIL — information of individuals](https://www.cnil.fr/fr/informer-les-personnes),
[CNIL — transparency](https://www.cnil.fr/fr/conformite-rgpd-information-des-personnes-et-transparence),
[CNIL — cookies](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi).
Reassess cookie purposes if analytics, advertising or any external widget is added.

### Technical retention inventory

Verify against the backend revision actually approved, not just local defaults.

| Data | Current source and technical rule |
| --- | --- |
| Unconfirmed accounts | Backend README: eligible for cleanup after 30 days |
| Confirmed profiles, lists, wishes, participation | Retained for the service until deletion; no general inactivity purge promised |
| Guest browser session | `GuestSessionOptions`: absolute default of 180 days; clearing a cookie is not erasure |
| Deletion confirmation | `MemberAccountDeletionOptions`: 30 minutes |
| Personal ZIP | `deployments/personal-data-exports.md`: 24-hour availability, asynchronous file cleanup, excluded from backups |
| Processed authentication/moderation outbox | 30-day default, pending processing distinct; Gmail copies require their own policy |
| Administrative export/erasure audit | Respective backend runbooks: six calendar months, restricted access |
| Application logs | `docs/operations-monitoring.md`: three 10-MB files/container, not a day-based promise |
| Monitoring measurements | Same runbook: at most seven days and 32 MiB |
| Restic snapshots | `docs/operations/offsite-backup.md`: 14 elapsed days; preserve the last valid snapshot even when older after failure |

Account erasure and inaccessible exports precede physical asynchronous cleanup.
Before disaster recovery, apply the deletion reconciliation procedure; do not
silently restore previously erased member data. An automatic ZIP is not the whole
answer to every access request: operational/moderation data and third-party rights
need a separate restricted review. Never ask for passwords or recovery codes.

## Dependency order and release compatibility

1. Review and merge both MK-828 MRs only with explicit authorization. The backend
   MR must be installed and **published** first: the frontend workflow checks out
   the revision named by `backend-production`, not an arbitrary newer branch.
2. Reinstall the approved Caddy/Compose/publication files through the existing
   backend release mechanism. The configuration fingerprint changes; never edit
   the active fingerprint or server files to force a match. Preserve MK-813
   timers, guarded deployment, locks and credentials and MK-815 monitoring.
3. Confirm the installed publisher supports manifest v2 and its exact
   `googleEnabled` boolean. Historical v1 releases stay readable and do not need
   to be rewritten. New v2 releases require all three legal HTML files and the
   matching release marker. The allowlist still rejects secrets, source maps,
   symlinks and arbitrary archive paths.
4. Inspect existing Hostinger A/AAAA/CNAME records before separately authorized
   DNS changes. Preserve `api`, mail and verification records. Check public DNS,
   certificates and HTTP/apex redirects; local browser fixtures do not prove them.
5. Complete legal approval and the Google decision below. Run the whole frontend
   gate and the live public OpenAPI compatibility check before approving the
   manual workflow on `develop` in its protected `production` environment.
6. The workflow packages only `dist` and publishes immutable archives before
   changing `frontend-production`. The server verifies revision, hash, approved
   backend and post-switch probes. Failed probes restore the previous frontend;
   they do not roll back the database. Follow the backend frontend runbook.

## Google activation requires a separate approved smoke test

Use the correct login OAuth project/client, not the Gmail sender or Drive backup
client. Keep client secrets exclusively on the backend. The public frontend flag
does not turn on backend Google by itself. Verify the exact existing backend
callback URI and its expected frontend return route from the approved backend
configuration before changing the console; never invent a new callback address.

Check branding/consent publication status, exact authorized domains, public home
and privacy URLs, requested identity scopes (`openid`, `email`, `profile`) and
whether Google's verification requirements apply. "In production" is not the
same as "verified by Google". Do not expand Gmail/Drive permissions or promise
that publishing branding restores a revoked OAuth grant.

After explicit operator approval, test with agreed synthetic accounts over the
real HTTPS origins: new and existing Google users, password-account linking,
cancellation/denial, expiration, MFA continuation (including enrollment and
recovery replacement), refresh and logout across tabs. If identity lookup fails
after accepted authentication, retry session verification, not the proof POST.
No production browser trace, screenshot or console dump may contain real cookies,
tokens, QR keys, recovery codes or member data. Record only bounded outcomes.

Changing `googleEnabled` requires a reviewed publication revision after the
approved activation procedure. Turning the frontend flag off does not revoke
existing backend sessions or Google grants. Follow the existing reviewed backend
procedure for any actual revocation; it is not automated here.

## Private frontend acceptance

- Password and Google sign-in can return a five-minute MFA continuation rather
  than a full session. QR generation is local; no external QR service is used.
  Proofs and keys are memory-only and removed on navigation, cancellation or expiry.
- MFA management binds a short-lived proof to its purpose and current member.
  Replacement and code regeneration close the old sessions; show new codes once
  before a fresh sign-in. A lost response is not automatically replayed.
- `/profile/data` uses authenticated metadata and streamed ZIP responses, never
  a server-supplied redirect or public archive URL. Downloads verify type and
  exact bounded byte count. No background polling or automatic export creation.
- `/confirm-account-deletion#token=...` consumes the fragment before session
  requests, retains it only in memory, requires sign-in and an explicit checkbox.
  Reopening the route without the email link cannot recover its proof. An uncertain
  response is not proof of failure and must not trigger an automatic deletion POST.
- Native legal links leave the SPA. Caddy maps the three extensionless routes to
  real static HTML, independent of API availability and JavaScript. Vite preview
  alone does not test Caddy's extensionless rewrite; use the backend HTTP suite.

Local validation commands (no provider credentials):

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:coverage
pnpm build
pnpm test:e2e
node tools/publication/checkPublication.js
```

The final command **must fail** while documents are drafts. Use the existing
isolated backend CI job for `pnpm api:types:check`; do not regenerate checked-in
types blindly to mask a mismatch. CI browser tests use synthetic responses and
the deployed CSP, not Google/Gmail/Drive or a production account. Record both
what was verified and what still needs real operator acceptance.
