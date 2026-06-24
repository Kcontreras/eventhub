# EventHub — Booking Management Test Strategy

Generated: 2026-06-23  
Input: `docs/test-scenarios.md` (53 scenarios, TC-001 to TC-511)  
Backend source: `backend/src/services/bookingService.js`, `backend/src/validators/bookingValidator.js`, `backend/src/routes/bookingRoutes.js`  
Frontend source: `frontend/app/bookings/page.tsx`, `frontend/app/bookings/[id]/page.tsx`  
Existing tests: `tests/booking-management.spec.js` (6 E2E tests, all happy path)

---

## Distribution Summary

| Layer | Count | Focus | Avg Run Time | File |
|-------|-------|-------|-------------|------|
| Unit | 2 | Pure functions (`randomRef`, `totalPrice`) | <1 ms | No runner configured — **future work** |
| API / Integration | 22 | Contract, auth, validation, FIFO, ordering | ~200 ms | `tests/booking-api.spec.js` (new) |
| Component | 0 | React state rendering | — | No component test runner — use E2E mocks instead |
| E2E | 29 | Multi-page journeys, UI state, client-side logic | ~10 s | `tests/booking-management.spec.js` (existing + extend) |
| **Total** | **53** | | | |

**Pyramid shape**: Wide at the API layer (22), narrower at E2E (29 — acceptable because ~half are fast single-page UI-state checks). No classic unit layer because this project has no Jest / Vitest setup; the two pure-function candidates are noted for a future unit test phase.

---

## Layer Assignments

### Unit Layer (future) — 2 scenarios

These are pure functions with no I/O; they belong at unit level but have no runner in this repo yet.

| TC | Title | Function | Rationale |
|----|-------|----------|-----------|
| — | Booking ref generation logic | `bookingService.js → randomRef()` | Pure: prefix + 6-char random string — no DB, no network. Verify format invariant `^[A-Z]-[A-Z0-9]{6}$` and that prefix = `eventTitle[0].toUpperCase()`. Covered indirectly by TC-100/TC-404 at API layer. |
| — | Total price calculation | `bookingService.js:99 → totalPrice = parseFloat(event.price) * data.quantity` | Pure multiply. Covered indirectly by TC-008 at E2E. Worth an explicit unit test to guard against float precision bugs at extreme prices. |

**Recommendation**: Add Jest to the backend (`npm i -D jest`) and extract `randomRef` and `totalPrice` into a `utils/bookingUtils.js` file for easy unit testing.

---

### API / Integration Layer — 22 scenarios

Use Playwright's `request` fixture in a dedicated `tests/booking-api.spec.js` file. Each test authenticates via `POST /api/auth/login` to get a JWT, then calls booking endpoints directly.

```javascript
// Pattern for API tests
const { request } = require('@playwright/test');
const context = await request.newContext({ baseURL: 'http://localhost:3001/api' });
const { token } = (await context.post('/auth/login', { data: { email, password } })).json();
```

#### Business Rules

| TC | Title | Endpoint | Rationale |
|----|-------|----------|-----------|
| TC-101 | FIFO pruning — oldest from different event deleted | `POST /bookings` → `GET /bookings` | Requires exact state (9 bookings, 2 events). Impossible to set up reliably through UI. `bookingService.createBooking:70-79` — verify `findOldestUserBookingExcludingEvent` path. |
| TC-102 | FIFO pruning — same-event fallback | `POST /bookings` → `GET /events/:id` | Requires 9 bookings all on same event. Validates `sameEventFallback = true` triggers `eventRepository.decrementSeats`. |
| TC-106 | Seat restoration after cancellation | `GET /events/:id` → `DELETE /bookings/:id` → `GET /events/:id` | State verification across two API calls. `cancelBooking` at `bookingService.js:126`. |
| TC-107 | Clear all returns correct `deleted` count | `DELETE /bookings` | Verifies `clearAllBookings` response body `{ deleted: N }`. No UI equivalent. |
| TC-108 | Booking list ordered newest-first | `GET /bookings` | Inspect raw JSON ordering. `findAll` uses `orderBy: { createdAt: 'desc' }` at `bookingRepository.js:19`. |

#### Security

| TC | Title | Endpoint | Rationale |
|----|-------|----------|-----------|
| TC-201 | Cross-user GET returns 403 | `GET /bookings/:id` (User B token) | API contract for `ForbiddenError` in `getBookingById`. Defense-in-depth alongside TC-200 E2E. |
| TC-202 | Cross-user DELETE returns 403 | `DELETE /bookings/:id` (User B token) | Verify booking NOT deleted after the 403. `cancelBooking:127-129`. |
| TC-203 | No auth token returns 401 | `GET /bookings/:id` (no header) | Auth middleware at `bookingRoutes.js:8` (`router.use(authMiddleware)`). |
| TC-204 | Clear-all is user-scoped | `DELETE /bookings` (User A) → `GET /bookings` (User B) | `deleteAllForUser` where clause is `{ userId }`. Cross-contamination check. |
| TC-205 | Cross-user GET /ref returns 403 | `GET /bookings/ref/:ref` (User B) | `getBookingByRef:62-64`. |

#### Negative / Error

| TC | Title | Endpoint | Rationale |
|----|-------|----------|-----------|
| TC-300 | Non-existent booking ID → 404 | `GET /bookings/999999` | `NotFoundError` in `getBookingById`. API contract, no browser needed. |
| TC-302 | Cancel already-deleted booking → 404 | `DELETE /bookings/:id` (deleted) | `cancelBooking` calls `findById` first; not found → 404. |
| TC-303 | Non-existent booking ref → 404 | `GET /bookings/ref/Z-XXXXXX` | `getBookingByRef` → `NotFoundError`. |
| TC-304 | Missing required fields → 400 | `POST /bookings` (partial body) | `validateCreateBooking` middleware at route layer. Pure API contract — E2E would add a full booking flow just to reach this check. |
| TC-305 | Invalid email → 400 | `POST /bookings` | `isEmail()` validator. |
| TC-306 | Phone < 10 digits → 400 | `POST /bookings` | `isLength({ min: 10 })`. |
| TC-307 | Quantity 0 or 11 → 400 | `POST /bookings` | `isInt({ min: 1, max: 10 })`. Two sub-cases (0 and 11). |
| TC-308 | Name < 2 chars → 400 | `POST /bookings` | `isLength({ min: 2 })`. |

#### Edge Cases

| TC | Title | Endpoint | Rationale |
|----|-------|----------|-----------|
| TC-401 | Clear all on empty account → `{ deleted: 0 }` | `DELETE /bookings` | `deleteMany` with zero matches. API response only, no UI change. |
| TC-402 | FIFO same-event: seats permanently decremented | `POST /bookings` → `GET /events/:id` | `sameEventFallback` branch at `bookingService.js:95-97`. Seat change only visible in raw event data. |
| TC-404 | Booking refs are unique | `POST /bookings` ×20 | Compare ref values in responses. No UI equivalent for 20 calls. |
| TC-407 | Book non-existent event → 404 | `POST /bookings` `eventId: 999999` | `eventRepository.findById` at `createBooking:82-83`. |

---

### E2E Layer — 29 scenarios

Run via `npx playwright test tests/booking-management.spec.js`. Use the existing `login()` and `bookEvent()` helpers. New helpers needed: `loginAs(page, email, password)` for cross-user tests.

#### Already Covered by Existing Tests

| TC | Title | Status |
|----|-------|--------|
| TC-001 | View bookings list | ✅ `booking-management.spec.js` line 71 |
| TC-002 | Navigate list → detail | ✅ `booking-management.spec.js` line 89 |
| TC-003 | Cancel from detail page | ✅ `booking-management.spec.js` line 171 |
| TC-004 | Clear all bookings | ✅ `booking-management.spec.js` line 202 |
| TC-100 | Booking ref format (first letter) | ✅ `booking-management.spec.js` line 156 (labeled TC-102 in file — see anti-patterns) |

#### Needs Implementation (E2E)

**Happy Path — extend existing file**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-005 | Back button navigates to list | `expect(page).toHaveURL(/\/bookings$/)` after clicking "← Back to My Bookings" | P1 |
| TC-006 | Booking ref consistent list ↔ detail | Read ref from `#booking-card`, compare to `span.font-mono.font-bold` on detail page | P1 |
| TC-007 | All detail sections present | Assert "Event Details", "Customer Details", "Payment Summary" headings + field values | P1 |
| TC-008 | Price = event price × quantity | Book 3 tickets, assert "Total Paid" = 3× price | P1 |

**Business Rules**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-103 | Refund eligible (qty=1) | `#refund-spinner` visible → not visible (timeout 6000 ms) → `#refund-result` contains "Eligible" | P0 |
| TC-104 | Refund ineligible (qty=3) | `#refund-result` contains "Not eligible" + quantity | P0 |
| TC-105 | Refund spinner duration ~4 s | Spinner visible immediately after click; gone after 4 s | P1 |

**Security (UI rendering)**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-200 | Cross-user → "Access Denied" page | Login as User B, navigate to User A's booking URL, assert `EmptyState` title "Access Denied" | P0 |

**Negative (UI error states)**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-301 | Non-existent ID → "Booking not found" | Navigate to `/bookings/999999`, assert "Booking not found" heading | P1 |
| TC-309 | Server error → retry state | Mock `GET /api/bookings` to 500 via `page.route()`, assert "Couldn't load bookings" + Retry button | P2 |

**Edge Cases**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-400 | Cancel last booking → empty state | Assert `getByText('No bookings yet')` after cancel | P1 |
| TC-403 | Delete parent event → booking gone | Delete event via API, navigate to booking URL, assert "Booking not found" | P1 |
| TC-405 | Max quantity (10) — correct total + refund | Book 10 tickets ($149 event), assert total = $1,490, refund = ineligible | P1 |

**UI State**

| TC | Title | Key Assertions | Priority |
|----|-------|---------------|----------|
| TC-501 | Empty state when no bookings | After `clearBookings()`, assert "No bookings yet" + "Browse Events" link | P1 |
| TC-503 | "Access Denied" state (403) | Same as TC-200 (combined test covers both TC-200 and TC-503) | P0 |
| TC-504 | Refund section starts idle | `#check-refund-btn` visible; no `#refund-spinner`; no `#refund-result` | P2 |
| TC-505 | Eligible refund — green banner | Assert `#refund-result` contains "Eligible for refund" | P1 |
| TC-506 | Ineligible refund — red banner + quantity | Assert `#refund-result` contains `"Group bookings (N tickets)"` | P1 |
| TC-507 | "Clearing…" button state | Accept confirm dialog, immediately assert button text "Clearing…" + `disabled` | P2 |
| TC-508 | Confirm dialog appears before cancel | Click "Cancel Booking", assert dialog opens, assert booking NOT yet gone | P1 |
| TC-511 | Cancel button visible for confirmed bookings | Navigate to confirmed booking detail, assert "Cancel Booking" button visible | P1 |

**Deferred / Hard to Test Reliably**

| TC | Title | Why Deferred | Alternative |
|----|-------|-------------|-------------|
| TC-406 | Pagination | FIFO cap of 9 bookings makes >10 impossible via normal flow — re-assign to API layer with direct seeding | `GET /bookings?page=2` via API after direct DB seed |
| TC-500 | Skeleton loading | Requires controlled slow network; Playwright's `--slow-mo` is process-wide, not request-specific | Use `page.route()` to delay `GET /api/bookings` response artificially |
| TC-502 | Detail spinner | Same issue as TC-500 | Use `page.route()` delay on `GET /api/bookings/:id` |
| TC-509 | In-flight cancel loading | `isPending` state lasts milliseconds on localhost — very flaky | Skip or mock network via `page.route()` |
| TC-510 | Breadcrumb shows ref | Low-risk, already implicitly covered by TC-002 (breadcrumb checked there) | Covered |

---

## Decision Rationale — Contested Assignments

### TC-101, TC-102 (FIFO Pruning) → API not E2E
The FIFO cap is 9 bookings (`MAX_USER_BOOKINGS = 9` in `bookingService.js:9`). Reaching exactly 9 bookings across specific event combinations through the UI would require ~9 full booking flows per test run, making the suite prohibitively slow and fragile. The FIFO logic lives entirely in `bookingService.createBooking:70-79` and is testable via direct API calls that set up state in seconds.

### TC-103, TC-104, TC-105 (Refund) → Must stay E2E
Refund eligibility is **pure client-side React state** — the `RefundEligibility` component in `frontend/app/bookings/[id]/page.tsx:21-71` uses `useState` and `setTimeout`. There is no API call. It cannot be tested at API layer. Without a React component test runner (no Vitest/RTL setup), E2E is the only option.

### TC-200 (Cross-user) → E2E + TC-201 also at API (defense-in-depth)
Security-critical rules warrant coverage at multiple layers. TC-201 verifies the HTTP 403 contract in `bookingService.getBookingById`; TC-200 verifies the UI correctly renders "Access Denied" and leaks no data. Both are required — the API test guards the backend; the E2E test guards the frontend error handling.

### TC-304–TC-308 (Validation) → API, NOT E2E
All validation runs in `bookingValidator.js` before the controller is even invoked (`router.post('/', validateCreateBooking, bookingController.createBooking)` at `bookingRoutes.js:318`). Testing these at E2E means driving a full browser session just to hit express-validator logic. This is the classic ice-cream-cone anti-pattern: slow, fragile, and the failure mode is identical to testing it at the API layer.

### TC-406 (Pagination) → Reassign from E2E to API
The scenarios doc marked this E2E. **Overriding to API.** The FIFO cap hard-limits any account to 9 bookings max. The bookings list paginates at 10 (`limit: 10`). There is no legitimate UI path to page 2. This scenario requires direct database seeding or an admin endpoint to bypass FIFO. Test the pagination contract via `GET /bookings?page=2&limit=5` after seeding via API.

---

## Anti-Patterns Found in Existing Tests (`tests/booking-management.spec.js`)

### 1. TC Numbering Mismatch
**Location**: `booking-management.spec.js:156` — labeled `TC-102` in the test file  
**Problem**: Tests "booking reference starts with first letter of event title" which corresponds to **TC-100** in `docs/test-scenarios.md`. TC-102 in the scenarios doc is FIFO pruning same-event fallback — a completely different test.  
**Fix**: Rename the test description to `TC-100` and add a new test for FIFO pruning at the API layer as TC-101/TC-102.

### 2. TC-006 Tests Wrong Thing
**Location**: `booking-management.spec.js:121` — labeled `TC-006`  
**Problem**: Tests "navigate to bookings list after booking via View My Bookings link" (post-booking navigation). TC-006 in the scenarios doc is about "booking reference displayed correctly in both list and detail pages." These are different behaviors.  
**Fix**: Rename the existing test to reflect what it actually does (post-booking navigation flow). Write a new TC-006 that reads the ref from the booking card and verifies it matches the ref on the detail page.

### 3. No API Tests Exist
**Scope**: Entire `tests/` directory  
**Problem**: All 22 API-layer scenarios (security, validation, FIFO, 404/403/400 contracts) have no test coverage. The suite is currently a pure E2E ice cream cone.  
**Fix**: Create `tests/booking-api.spec.js` using Playwright's `APIRequestContext` (`request` fixture). This file will cover all 22 API-layer scenarios above.

### 4. No Cross-User Security Coverage
**Scope**: No existing test for TC-200/TC-201  
**Problem**: Cross-user booking access (`ForbiddenError` in `bookingService.js:57`) is a P0 security rule with zero test coverage in the current suite.  
**Fix**: Add TC-200 to `booking-management.spec.js` using a `loginAs(page, YAHOO_EMAIL, PASSWORD)` helper, and add TC-201 to the new `booking-api.spec.js`.

---

## Recommended Test File Structure

```
tests/
├── booking-management.spec.js   # E2E — existing + extend with TC-005 to TC-511
└── booking-api.spec.js          # NEW — API layer, TC-101 to TC-407 (API-assigned)
```

### Suggested test ordering within `booking-management.spec.js`

```
test.describe('Booking Management — Happy Path', () => { ... })       // TC-001 to TC-008
test.describe('Booking Management — Business Rules', () => { ... })   // TC-100, TC-103–105
test.describe('Booking Management — Security', () => { ... })         // TC-200
test.describe('Booking Management — Negative', () => { ... })         // TC-301, TC-309
test.describe('Booking Management — Edge Cases', () => { ... })       // TC-400, TC-403, TC-405
test.describe('Booking Management — UI State', () => { ... })         // TC-501–TC-511
```

### Helpers needed

```javascript
// Existing (keep)
async function login(page) { ... }
async function bookEvent(page) { ... }
async function clearBookings(page) { ... }

// New helpers to add
async function loginAs(page, email, password) { ... }  // for cross-user TC-200

// For booking-api.spec.js
async function getAuthToken(request, email, password) { ... }
async function createBookingViaApi(request, token, eventId, qty) { ... }
async function clearBookingsViaApi(request, token) { ... }
```

---

## P0 / Must-Have Coverage Checklist

These are the minimum tests that must exist before the feature is considered adequately tested:

- [ ] TC-001 — Bookings list renders (✅ exists)
- [ ] TC-003 — Cancel from detail (✅ exists)
- [ ] TC-004 — Clear all (✅ exists)
- [ ] TC-100 — Booking ref format (✅ exists, fix label)
- [ ] TC-103 — Refund eligible (single ticket) — **missing**
- [ ] TC-104 — Refund ineligible (multi-ticket) — **missing**
- [ ] TC-200 — Cross-user "Access Denied" E2E — **missing**
- [ ] TC-201 — Cross-user 403 API — **missing**
- [ ] TC-202 — Cross-cancel 403 API — **missing**
- [ ] TC-203 — No-auth 401 API — **missing**
- [ ] TC-204 — Clear-all is user-scoped API — **missing**
- [ ] TC-503 — "Access Denied" UI state (covered by TC-200)
