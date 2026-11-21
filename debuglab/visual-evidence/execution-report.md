# FlashCart Visual Evidence Report

- **Application:** FlashCart (`DL-APP-001`)
- **Stack:** Node.js, Express, static HTML/CSS/JavaScript frontend, in-memory seeded data store
- **Intentional incidents:** 8
- **Screenshots generated and validated:** 16
- **Multi-user scenarios:** 1 (concurrent last-unit checkout)
- **Payment workflows:** 2 (simulated only; no real charges)
- **Failed captures:** 0
- **Viewport:** 1440 × 900
- **Screenshot checks:** PNG signature, size, dimensions, Playwright state assertions, and visual inspection
- **Visual Bug Markings:** Every screenshot includes high-visibility bug demonstration cards, dashed bounding boxes, and contextual incident tags identifying the exact failure mechanism
- **Application source changed:** No. Existing challenge bugs remain active.

## Per-incident results

| Bug ID | Screenshots | Perspectives | Status |
|---|---:|---|---|
| DL-BUG-001 | 1 | Single perspective | Generated |
| DL-BUG-002 | 2 | Multiple customer/admin states | Generated |
| DL-BUG-003 | 5 | Multiple customer/admin states | Generated |
| DL-BUG-004 | 2 | Multiple customer/admin states | Generated |
| DL-BUG-005 | 1 | Single perspective | Generated |
| DL-BUG-006 | 2 | Multiple customer/admin states | Generated |
| DL-BUG-007 | 2 | Multiple customer/admin states | Generated |
| DL-BUG-008 | 1 | Single perspective | Generated |

## Reproduction

Run `npm run capture:evidence` from the FlashCart repository root. It starts an isolated in-process challenge server, resets the seeded data between scenarios, performs the browser journeys, saves the screenshots, validates them, and writes the evidence manifest.

## Special setup

- DL-BUG-003 uses two independent signed-in customer contexts and the seeded one-unit Nikon Z8 item.
- DL-BUG-007 returns an actual failed response from FlashCart's simulated payment service to the browser, exposing the UI's false success message. No payment is processed.
- DL-BUG-008 has no challenge-mode checkout/API path that invokes the warehouse allocator. The capture runner prepares an in-memory warehouse fixture, calls the existing allocator service, then captures the real Admin dashboard.
