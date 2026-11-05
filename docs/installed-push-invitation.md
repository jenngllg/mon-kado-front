# Installed application notification invitation

On the first authenticated opening in standalone mode (including iOS `navigator.standalone`), offer **Activer les notifications** and **Plus tard**. Record the displayed invitation in local storage for this installation. Ordinary browser visits, anonymous sessions and administrator impersonation do not consume it. Already authorized browsers, disabled server push and accounts with all push types disabled do not receive the invitation.

Load the existing push preferences before displaying the action. The activation click calls the browser permission API before any asynchronous work, then registers the subscription through the existing authenticated, CSRF-protected API. Copy disabled types into the subscription without rewriting account preferences. Never request permission on page load. An existing system denial receives an explanation and access to account settings; the application cannot override it. Dismissal, denial and successful activation do not reopen the invitation on navigation or reload.

If persistent storage is unavailable, suppression lasts for the current application lifetime. Clearing site data clears the invitation record. Initial configuration failures leave the page usable and do not consume the invitation. Identity loss aborts pending work and removes its content.

## Regression checks

- `pnpm test`: invitation eligibility, iOS detection, gesture ordering, permission outcomes, saved opt-outs, unavailable storage and identity cancellation.
- `pnpm test:e2e:native`: the mandatory CI native-browser gate runs `installedPushInvitation.spec.js` in the `push-mobile` and `push-desktop` projects. Sessions, preference reads/writes and subscription persistence use the real API, worker and disposable PostgreSQL database. Installation and the device push provider are simulated; this does not establish reception on a physical phone.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` and the unchanged coverage thresholds remain required.

For the native push journeys, provide the existing private loopback test database configuration and backend source, then run `python tools/native-e2e/run.py --project push-mobile` (or `push-desktop`). The runner creates and removes only its generated child database.
