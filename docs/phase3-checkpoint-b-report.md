# Phase 3 Checkpoint B

## Screen inventory and navigation

The GrabMerchant concept shell has Home, Orders, Menu, Performance, and AI tabs. Home combines sales, one One Click opportunity, an operations overview, and trends. AI contains the opportunity and mission history. The journey spans opportunity discovery, cost verification, scenario comparison, mission review, approval, tracking, and simulated outcome review. Orders provides an aggregate operations summary. Menu displays item availability, prices, contribution, and cost provenance. Performance shows period sales, contribution, trends, and menu ranking.

This is a proposed future direction, not an exact reproduction of Grab's production interface. Every view carries the unofficial and synthetic-data identity.

## User flow and component reuse

The merchant enters One Click from Home or AI, checks editable baseline and proposed costs, saves a new immutable scenario revision through the Phase 2 API, compares the returned financial estimates, explicitly confirms both material inputs and simulation-only scope, then approves. The tracking view uses persisted mission events. Generating the fictional outcome calls the backend simulation endpoint; the merchant can review and save the final state. There is no promotion publishing endpoint or UI action.

The existing shell, financial comparison hero, formatting, error state, and typed contracts remain in use. New screens consume the same server-side API client. Mission writes pass through a narrow local Next route to the existing FastAPI services with server-held session and CSRF credentials. This route only permits mission paths on loopback and same-origin writes.

## Implementation sequence completed

1. Reframed the shell and Home around merchant operations.
2. Added Orders, Menu, Performance, AI, and mission history using existing backend reads.
3. Added a local write bridge and editable, validated scenario form.
4. Connected explicit approval, tracking, simulation, and outcome review to backend state.
5. Built, exercised the journey in Playwright, and restored the seeded demo to its initial proposed mission.

## Verification and dependencies

The production Next build passed, and all 20 backend tests passed. Playwright completed the full path at 390 × 844: it saved an edited cost, read a revised backend comparison, approved with both acknowledgments, generated a simulated outcome, refreshed to verify persistence, marked the outcome reviewed, and refreshed again. Home, Orders, Menu, Performance, AI, and Missions loaded without browser errors or horizontal overflow at 320, 390, and 1280 pixels. The synthetic demo database was reseeded after this test so a merchant can start the journey.

The Phase 2 backend has no individual order listing/fulfillment API and no menu write API. Orders and Menu therefore remain truthful backend-driven overviews. Full order operations or editable menu management depend on those server-side capabilities. This does not block the required simulated mission journey.
