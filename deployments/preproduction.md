# Private HTTPS preproduction — MK-935

## Status and boundaries

The dedicated frontend build exists; the private environment is **not deployed**.
The existing backend publisher only accepts `frontend-production`, production
state directories and production manifests. Do not feed it a private build,
rename its pointer or loosen its validator. No private publication workflow can
be enabled until the infrastructure contract below is implemented and reviewed.

Production remains `www.monkado.fr` / `api.monkado.fr`. Its legal approval remains
false and its publication guard unchanged. Draft legal pages are retained in this
private, synthetic-only build; this is not approval to open a public beta.

## Required companion infrastructure ticket — MK-945

Title: **Isolate private HTTPS preproduction and its release channel (prerequisite MK-935)**.

Acceptance criteria:

- A separate Compose project on the existing DigitalOcean VPS, after a capacity
  check. Separate API/database, credentials, JWT issuer/audience and signing keys,
  Data Protection, images and export volumes. No production database copy.
- Exact frontend/API origins `https://preprod.monkado.fr` and
  `https://api.preprod.monkado.fr`; explicit credentialed CORS, host-only secure
  cookies, no widening to `.monkado.fr`. Verify mutual session rejection.
- Confirmed synthetic Identity accounts, no real personal data, no Google,
  external mail or telemetry; no email Worker. Do not bypass production startup
  validation by silently running the real production stack in a local mode.
- A dedicated Caddy with internal CA, published only at VPS `127.0.0.1:8443`.
  PostgreSQL/API ports are not published. Preserve the existing public Caddy,
  firewall, backup locks and production timers.
- Private release contract explicitly binds environment, frontend/API origins,
  frontend/backend revisions and configuration fingerprint. Reject production
  manifests/builds and vice versa. Keep immutable preproduction archives and
  `frontend-preproduction` pointer separate from production releases.
- Independent state, locks and approved backend revision for the private
  publisher. Validate checksum/archive allowlist and compatibility before atomic
  switching; failed probes restore the previous static version, never the DB.
- No SSH key or backend secret in frontend CI. Manual protected `preproduction`
  workflow, green exact revision, isolated contract check against the approved
  backend revision; the runner never needs to enter the SSH tunnel.
- Safe install/uninstall and rollback procedures, with evidence that production
  services, certificates and release pointers were not changed.

The backend repository has GitHub Issues disabled. Jenn recorded this dependency
as **#945** in the project's ticket system. MK-935 remains dependent on its delivery.

## Operator access once the prerequisite is installed

1. Verify the VPS identity through the existing trusted SSH procedure. Confirm
   port 443 is free locally and 8443 is assigned to the private listener on the
   server. Never kill another service or silently substitute a different port.
2. Add only the two test hostnames to the device's local hosts resolution:
   `127.0.0.1 preprod.monkado.fr api.preprod.monkado.fr`. Preserve existing entries.
3. Open `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:443:127.0.0.1:8443 <existing-vps-alias>`.
   The alias is an operator prerequisite, not a new credential or public endpoint.
4. Retrieve only the public certificate of the dedicated Caddy root through the
   trusted channel, verify its fingerprint and explicitly install trust on the
   test device/browser. Never copy the CA private key or ignore TLS errors.
5. Visit the two exact HTTPS names. Without the tunnel, application access must
   fail. Keep DNS changes local; do not expose a public staging virtual host.

On retirement, stop the owned tunnel and remove only these hosts entries and this
dedicated certificate trust. Stop/remove only resources proven to belong to the
private Compose project; do not remove shared production paths or Docker volumes.

## Frontend validation and release gate

Run frozen install, lint, typecheck, coverage, production build, private build,
Chromium tests and OpenAPI compatibility. `.preproduction-dist` is ignored and
must never be packaged by `publish-frontend.yml`; `dist` remains production only.
The future private workflow must use the reviewed private publisher contract,
not production scripts with substituted names.

Real acceptance requires trusted HTTPS, no mixed content, direct SPA routes and
refresh, static legal documents, security headers, cache and true missing-asset
404s. Use synthetic accounts to check authentication/CSRF, cross-tab logout,
lists/gifts/images, sharing and guest participation. Check isolation from
production and private release rollback. Retain only bounded outcomes and
revisions, never cookies, keys, QR proofs or personal browser traces.

No successful local build or simulated browser run proves these real checks.
Until they succeed, MK-935 remains incomplete. External-provider/email flows are
not verified by this private deployment and must not be reported as passed.
