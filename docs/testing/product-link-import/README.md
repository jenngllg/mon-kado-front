# Product link import - local browser evidence

Observed on 31 October 2026 using Chromium 153, the running frontend and the real
local Go API with native PostgreSQL. Merchant providers were disabled, so these
screens demonstrate the default direct import path. No response interception or
merchant-page mock was used for the screenshots or `ui-evidence.json`.

| Scenario | Observed result | Evidence |
| --- | --- | --- |
| IKEA KALLAX | Name, EUR 34.99 price, photo, description, white colour and dimensions `L 76.5 cm × H 76.5 cm × P 39 cm` imported. | [Link](00-ikea-link-desktop.png), [product](01-ikea-product-desktop.png), [details](02-ikea-details-desktop.png) |
| Save and reread | The UI submitted a real POST returning 201, uploaded the normalized image, then retrieved the saved wish with GET 200. Description, colour, dimensions, price and image were retained. | [Saved wish](03-ikea-saved-desktop.png), [request and response evidence](ui-evidence.json) |
| Mobile at 390 px | The same imported fields remain usable without horizontal document overflow. | [Product](04-ikea-product-mobile.png), [details](05-ikea-details-mobile.png) |
| Amazon LEGO 72031 | Name, description and photo recovered. Price remained empty with an explicit warning because no reliable EUR amount was recovered. | [Product and warning](06-amazon-product-desktop.png), [description](07-amazon-description-desktop.png) |
| Cdiscount LEGO 60454 | Direct page retrieval was unavailable. The UI displayed the warning and allowed manual completion. A readable URL can supply a clearly labelled tentative title; this is not merchant extraction. | [Manual recovery](08-cdiscount-manual-recovery.png), [manual details](09-cdiscount-manual-details.png) |
| Rituals Sakura gift set | After the price-conflict correction, the real API retained the name, description and photo while leaving the price empty with a warning. | [Price warning](11-rituals-price-conflict-desktop.png), [description](12-rituals-description-desktop.png) |
| Surprise wish | The link input was hidden and no preview request was sent. The existing open-ended wish flow remained available. | [Surprise mode](10-surprise-no-import.png) |

The browser recorded four preview requests during the documented scenario run
(IKEA desktop, IKEA mobile, Amazon and Cdiscount), no JavaScript page errors, and
zero preview requests in surprise mode. The real IKEA price matched the discovery
candidate's EUR 34.99 price. Search-engine previews are not treated as current
merchant prices or as proof of import success.

The Rituals check was added after restarting the final API binary. It used the
same real local account and an additional live preview request, without saving a
new wish. Its timestamp is recorded separately in `ui-evidence.json`.
One further real IKEA preview against that final API still returned its name,
description, white colour, EUR 34.99 price and normalized photo without warnings.

After adding standard product dimensions, the IKEA screenshots 00 to 05 and its
preview, creation and persisted-response evidence were refreshed against the API
started at 11:47:30 UTC. Two additional live previews verified the dimensions on
desktop and mobile. A new real POST 201 and GET 200 confirmed that the full
dimensions string was saved with the description, colour, price and photo.
`dimensionRevalidation` records this later run's timestamp separately, and
`ikeaPreviousEvidenceAt` preserves the earlier observation date. The Amazon,
Cdiscount, Rituals and surprise evidence remains from its recorded earlier runs.

`ui-evidence.json` includes the actual product URLs, public preview fields,
normalized image byte counts and SHA-256 hashes, creation payload and persisted
response. Session credentials and signed image tokens are excluded. Product
availability and prices may change after this observation.

The controlled Playwright suite is separate: its API fixture is intentionally
mocked to check loading, late user edits, navigation and validation. Those tests
do not establish support for any live merchant.

Validation: `MONKADO_E2E_PORT=5187 pnpm exec playwright test --reporter=list`
passed all 279 browser tests in 1.8 minutes with no retries. The changed browser
fixtures/specifications passed ESLint, the E2E TypeScript configuration and
`git diff --check`.

After strengthening protection of existing text and manually selected images,
all 18 focused import, owner and extension browser tests passed again in 9.5
seconds, with no retries. The captures still represent the empty-draft import
path; no additional live merchant support is claimed by that focused rerun.

Local frontend validation also passed 4,929 unit tests, ESLint, all TypeScript checks, production build and served OpenAPI type generation. Coverage: 98.16% lines, 94.99% statements, 94.56% functions and 89.79% branches, above the existing thresholds.
