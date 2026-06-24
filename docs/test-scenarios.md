# Test Scenarios: Booking Management

Generated: 2026-06-23  
Feature area: `/bookings`, `/bookings/:id`, `DELETE /bookings/:id`, `DELETE /bookings`

---

## Happy Path (TC-001–TC-099)

### TC-001: View bookings list with existing bookings
**Category**: Happy Path  
**Priority**: P0  
**Preconditions**: Logged in as `rahulshetty1@gmail.com`; at least one confirmed booking exists  
**Steps**:
1. Navigate to `/bookings`
2. Observe the page content
**Expected Results**: Booking cards are visible; each card shows event title, booking ref, quantity, and total price; "Clear all bookings" link is present  
**Business Rule**: Flow 4 — Manage Bookings  
**Suggested Layer**: E2E

---

### TC-002: Navigate from booking list to booking detail
**Category**: Happy Path  
**Priority**: P0  
**Preconditions**: Logged in; at least one booking exists  
**Steps**:
1. Navigate to `/bookings`
2. Click "View Details" on any booking card
**Expected Results**: Browser navigates to `/bookings/:id`; booking ref appears in breadcrumb and header; event title, customer details, payment summary, and refund section are all visible  
**Business Rule**: Flow 4 — Manage Bookings  
**Suggested Layer**: E2E

---

### TC-003: Cancel a booking from the detail page
**Category**: Happy Path  
**Priority**: P0  
**Preconditions**: Logged in; booking with a known ID exists  
**Steps**:
1. Navigate to `/bookings/:id`
2. Click "Cancel Booking"
3. In the confirm dialog, click "Yes, cancel it"
**Expected Results**: Success toast "Booking cancelled successfully" appears; browser redirects to `/bookings`; cancelled booking no longer appears in the list  
**Business Rule**: Booking deletion frees seats; `bookingRepository.delete`  
**Suggested Layer**: E2E

---

### TC-004: Clear all bookings at once
**Category**: Happy Path  
**Priority**: P0  
**Preconditions**: Logged in; at least two bookings exist  
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings"
3. Confirm the browser `confirm()` dialog
**Expected Results**: All booking cards disappear; empty state "No bookings yet" is shown; "Browse Events" button is visible  
**Business Rule**: `clearAllBookings` → `bookingRepository.deleteAllForUser`  
**Suggested Layer**: E2E

---

### TC-005: Navigate back from detail page to bookings list
**Category**: Happy Path  
**Priority**: P1  
**Preconditions**: Logged in; on `/bookings/:id`  
**Steps**:
1. Click "← Back to My Bookings" button at bottom of detail page
**Expected Results**: Browser navigates to `/bookings`; list loads with remaining bookings  
**Business Rule**: Navigation flow  
**Suggested Layer**: E2E

---

### TC-006: Booking reference displayed correctly in list and detail
**Category**: Happy Path  
**Priority**: P1  
**Preconditions**: Logged in; booking for "Tech Conference Bangalore" (title starts with "T")  
**Steps**:
1. Navigate to `/bookings`
2. Locate the booking card for the tech conference event and note the booking ref
3. Click "View Details"
4. Check the booking ref in the breadcrumb and header badge
**Expected Results**: Booking ref starts with `T-` followed by exactly 6 uppercase alphanumeric characters; ref is identical in list card and detail page  
**Business Rule**: `bookingRef` pattern `[FIRST_LETTER]-[6_RANDOM_ALPHANUMERIC]`; first letter = event title first char  
**Suggested Layer**: E2E

---

### TC-007: Booking detail shows all customer and event fields
**Category**: Happy Path  
**Priority**: P1  
**Preconditions**: Logged in; booking exists with known customerName, customerEmail, customerPhone  
**Steps**:
1. Navigate to `/bookings/:id`
2. Inspect "Event Details", "Customer Details", and "Payment Summary" sections
**Expected Results**: Event title, category, date, venue, city match the booked event; customer name, email, phone match submitted values; total paid = price per ticket × quantity  
**Business Rule**: `totalPrice = event.price × quantity`  
**Suggested Layer**: E2E

---

### TC-008: Payment summary total price calculation
**Category**: Happy Path  
**Priority**: P1  
**Preconditions**: Logged in; booking for "Tech Conference Bangalore" ($1499/ticket) with quantity 3  
**Steps**:
1. Navigate to `/bookings/:id` for that booking
2. Check "Payment Summary" section
**Expected Results**: "Price per ticket" = $1,499; "Total Paid" = $4,497; Tickets shown = 3  
**Business Rule**: `totalPrice = event.price × quantity`  
**Suggested Layer**: E2E

---

## Business Rules (TC-100–TC-199)

### TC-100: Booking ref first letter matches event title first letter
**Category**: Business Rule  
**Priority**: P0  
**Preconditions**: Logged in; book "Bollywood Night Mumbai" (title starts with "B")  
**Steps**:
1. Book "Bollywood Night Mumbai" for 1 ticket
2. On the confirmation card, read the booking ref
3. Verify also in `/bookings` list and `/bookings/:id`
**Expected Results**: Booking ref starts with `B-`; the 6 characters after the dash are uppercase alphanumeric  
**Business Rule**: `randomRef()` uses `eventTitle[0].toUpperCase()` as prefix  
**Suggested Layer**: E2E

---

### TC-101: FIFO pruning — 10th booking removes oldest booking from a different event
**Category**: Business Rule  
**Priority**: P0  
**Preconditions**: Logged in; user has exactly 9 bookings across at least 2 different events; oldest booking noted (ID and ref)  
**Steps**:
1. Create a 10th booking for a different event than the oldest booking
2. Navigate to `/bookings`
**Expected Results**: Total booking count remains 9; the previously oldest booking is gone; new booking is present  
**Business Rule**: `MAX_USER_BOOKINGS = 9`; FIFO prunes oldest from a different event first via `findOldestUserBookingExcludingEvent`  
**Suggested Layer**: API

---

### TC-102: FIFO pruning — same-event fallback when all bookings are for one event
**Category**: Business Rule  
**Priority**: P1  
**Preconditions**: Logged in; user has 9 bookings all for the same event; oldest booking noted  
**Steps**:
1. Via API: `POST /bookings` for the same event
2. Via API: `GET /bookings`
**Expected Results**: Total booking count remains 9; oldest booking is removed (same-event fallback); `availableSeats` for the event decrements permanently by the new booking's quantity  
**Business Rule**: `findOldestUserBookingExcludingEvent` returns null → falls back to `findOldestUserBooking`; `sameEventFallback` flag triggers `eventRepository.decrementSeats`  
**Suggested Layer**: API

---

### TC-103: Refund eligibility — single ticket booking is eligible
**Category**: Business Rule  
**Priority**: P0  
**Preconditions**: Logged in; booking with `quantity = 1` exists  
**Steps**:
1. Navigate to `/bookings/:id` for the single-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for the spinner to resolve (~4 seconds)
**Expected Results**: Spinner appears and disappears after ~4 s; green success banner shows "Eligible for refund. Single-ticket bookings qualify for a full refund."  
**Business Rule**: `quantity === 1 → status = 'eligible'`; client-side logic only (no API call)  
**Suggested Layer**: E2E

---

### TC-104: Refund eligibility — multi-ticket booking is NOT eligible
**Category**: Business Rule  
**Priority**: P0  
**Preconditions**: Logged in; booking with `quantity = 3` exists  
**Steps**:
1. Navigate to `/bookings/:id` for the 3-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for the spinner to resolve (~4 seconds)
**Expected Results**: Red error banner shows "Not eligible for refund. Group bookings (3 tickets) are non-refundable."  
**Business Rule**: `quantity > 1 → status = 'ineligible'`; client-side logic only  
**Suggested Layer**: E2E

---

### TC-105: Refund eligibility spinner displays for ~4 seconds
**Category**: Business Rule  
**Priority**: P1  
**Preconditions**: Logged in; on any booking detail page  
**Steps**:
1. Click "Check eligibility for refund?"
2. Immediately observe the refund section
3. Observe when the result appears
**Expected Results**: `#refund-spinner` is visible for approximately 4 seconds; disappears and is replaced by `#refund-result`  
**Business Rule**: `setTimeout(..., 4000)` in `RefundEligibility.check()`  
**Suggested Layer**: E2E

---

### TC-106: Cancelling a booking restores seat count for a static event
**Category**: Business Rule  
**Priority**: P0  
**Preconditions**: Logged in; booking for "Tech Conference Bangalore" (static event) with quantity 2; `availableSeats` noted  
**Steps**:
1. Via API: `GET /events/:id` — record `availableSeats`
2. Cancel the booking via `DELETE /bookings/:id`
3. Via API: `GET /events/:id` again
**Expected Results**: `availableSeats` increases by 2 after cancellation  
**Business Rule**: Seat count for static events is stored in DB; `bookingRepository.delete` removes the booking, restoring the seat to availability in subsequent queries  
**Suggested Layer**: API

---

### TC-107: Clear all bookings returns correct deleted count
**Category**: Business Rule  
**Priority**: P1  
**Preconditions**: Logged in; user has exactly 4 bookings  
**Steps**:
1. Via API: `DELETE /bookings` (clear all) with valid token
2. Inspect JSON response
**Expected Results**: Response body includes `{ "deleted": 4 }` (or equivalent); subsequent `GET /bookings` returns empty list  
**Business Rule**: `clearAllBookings` returns `{ deleted: result.count }`  
**Suggested Layer**: API

---

### TC-108: Booking list is ordered newest-first
**Category**: Business Rule  
**Priority**: P2  
**Preconditions**: Logged in; at least 3 bookings created at different times  
**Steps**:
1. Via API: `GET /bookings`
2. Inspect `data` array ordering by `createdAt`
**Expected Results**: Most recently created booking appears first in the array  
**Business Rule**: `findAll` uses `orderBy: { createdAt: 'desc' }`  
**Suggested Layer**: API

---

## Security (TC-200–TC-299)

### TC-200: Cross-user booking detail access shows "Access Denied"
**Category**: Security  
**Priority**: P0  
**Preconditions**: User A (`rahulshetty1@gmail.com`) has a booking with a known ID; logged in as User B (`rahulshetty1@yahoo.com`)  
**Steps**:
1. As User B, navigate to `/bookings/:userA_booking_id`
**Expected Results**: Page shows "Access Denied" with message "You are not authorized to view this booking."; no booking data is revealed  
**Business Rule**: `bookingService.getBookingById` throws `ForbiddenError` when `booking.userId !== userId`  
**Suggested Layer**: E2E

---

### TC-201: Cross-user booking access via API returns 403
**Category**: Security  
**Priority**: P0  
**Preconditions**: User A booking ID known; User B JWT token available  
**Steps**:
1. Via API: `GET /bookings/:userA_booking_id` with User B's Bearer token
**Expected Results**: HTTP 403; response body contains a forbidden / access-denied error message  
**Business Rule**: `ForbiddenError('You are not authorized to view this booking')`  
**Suggested Layer**: API

---

### TC-202: Cancel another user's booking via API returns 403
**Category**: Security  
**Priority**: P0  
**Preconditions**: User A booking ID known; User B JWT token available  
**Steps**:
1. Via API: `DELETE /bookings/:userA_booking_id` with User B's Bearer token
**Expected Results**: HTTP 403; User A's booking is NOT deleted; booking still exists when fetched with User A's token  
**Business Rule**: `cancelBooking` throws `ForbiddenError('You do not own this booking')`  
**Suggested Layer**: API

---

### TC-203: Access booking endpoints without authentication returns 401
**Category**: Security  
**Priority**: P0  
**Preconditions**: A valid booking ID is known; no Authorization header  
**Steps**:
1. Via API: `GET /bookings/:id` with no Authorization header
**Expected Results**: HTTP 401; response body indicates authentication required  
**Business Rule**: Auth middleware applied to all `/bookings` routes  
**Suggested Layer**: API

---

### TC-204: Clear all bookings only deletes the authenticated user's bookings
**Category**: Security  
**Priority**: P0  
**Preconditions**: User A has 3 bookings; User B has 2 bookings  
**Steps**:
1. Via API: `DELETE /bookings` (clear all) with User A's token
2. Via API: `GET /bookings` with User B's token
**Expected Results**: User A's 3 bookings are deleted; User B's 2 bookings remain intact  
**Business Rule**: `deleteAllForUser` scoped to `{ userId }` — no cross-user blast radius  
**Suggested Layer**: API

---

### TC-205: Get booking by ref for another user's booking returns 403
**Category**: Security  
**Priority**: P1  
**Preconditions**: User A booking ref known; User B token available  
**Steps**:
1. Via API: `GET /bookings/ref/:userA_booking_ref` with User B's Bearer token
**Expected Results**: HTTP 403; message "You do not own this booking"  
**Business Rule**: `getBookingByRef` throws `ForbiddenError('You do not own this booking')`  
**Suggested Layer**: API

---

## Negative / Error (TC-300–TC-399)

### TC-300: Access non-existent booking ID via API returns 404
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in; booking ID 999999 does not exist  
**Steps**:
1. Via API: `GET /bookings/999999` with valid token
**Expected Results**: HTTP 404; body contains error message "Booking with id 999999 not found"  
**Business Rule**: `bookingService.getBookingById` throws `NotFoundError`  
**Suggested Layer**: API

---

### TC-301: Booking detail page for non-existent ID shows "Booking not found"
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in  
**Steps**:
1. Navigate to `/bookings/999999`
**Expected Results**: "Booking not found" empty state shown with message "This booking doesn't exist or may have been cancelled."; "View My Bookings" button is visible  
**Business Rule**: UI `isError` + non-403 status → "Booking not found" branch  
**Suggested Layer**: E2E

---

### TC-302: Cancel a booking that was already deleted returns 404
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in; booking has already been cancelled/deleted  
**Steps**:
1. Via API: `DELETE /bookings/:id` using the already-deleted ID
**Expected Results**: HTTP 404; body indicates booking not found  
**Business Rule**: `cancelBooking` calls `findById` first; not found → `NotFoundError`  
**Suggested Layer**: API

---

### TC-303: Access non-existent booking ref returns 404
**Category**: Negative  
**Priority**: P2  
**Preconditions**: Logged in; ref `Z-XXXXXX` does not exist in DB  
**Steps**:
1. Via API: `GET /bookings/ref/Z-XXXXXX` with valid token
**Expected Results**: HTTP 404; body contains error for the missing ref  
**Business Rule**: `getBookingByRef` throws `NotFoundError`  
**Suggested Layer**: API

---

### TC-304: Create booking with missing required fields returns 400
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in  
**Steps**:
1. Via API: `POST /bookings` with body `{ "eventId": 1, "quantity": 2 }` (missing name, email, phone)
**Expected Results**: HTTP 400; response lists validation errors for `customerName`, `customerEmail`, `customerPhone`  
**Business Rule**: `validateCreateBooking` — all customer fields required  
**Suggested Layer**: API

---

### TC-305: Create booking with invalid email format returns 400
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in  
**Steps**:
1. Via API: `POST /bookings` with `"customerEmail": "not-an-email"`
**Expected Results**: HTTP 400; validation error on `customerEmail`: "Customer email must be a valid email address"  
**Business Rule**: `isEmail()` validator  
**Suggested Layer**: API

---

### TC-306: Create booking with phone shorter than 10 digits returns 400
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in  
**Steps**:
1. Via API: `POST /bookings` with `"customerPhone": "123456"`
**Expected Results**: HTTP 400; validation error on `customerPhone`: "Customer phone must be at least 10 digits"  
**Business Rule**: `isLength({ min: 10 })`  
**Suggested Layer**: API

---

### TC-307: Create booking with quantity 0 or 11 returns 400
**Category**: Negative  
**Priority**: P1  
**Preconditions**: Logged in  
**Steps**:
1. Via API: `POST /bookings` with `"quantity": 0`
2. Repeat with `"quantity": 11`
**Expected Results**: Both return HTTP 400; validation error on `quantity`: "Quantity must be an integer between 1 and 10"  
**Business Rule**: `isInt({ min: 1, max: 10 })`  
**Suggested Layer**: API

---

### TC-308: Create booking with customerName shorter than 2 characters returns 400
**Category**: Negative  
**Priority**: P2  
**Preconditions**: Logged in  
**Steps**:
1. Via API: `POST /bookings` with `"customerName": "A"`
**Expected Results**: HTTP 400; validation error on `customerName`: "Customer name must be at least 2 characters"  
**Business Rule**: `isLength({ min: 2 })`  
**Suggested Layer**: API

---

### TC-309: Bookings list shows error state when server is unreachable
**Category**: Negative  
**Priority**: P2  
**Preconditions**: Logged in; backend is down or returns 500  
**Steps**:
1. Navigate to `/bookings` while backend is unavailable
**Expected Results**: "Couldn't load bookings" empty state with message "Failed to connect to the server. Please try again." and a "Retry" button  
**Business Rule**: `isError` branch in `BookingsContent`  
**Suggested Layer**: E2E

---

## Edge Cases (TC-400–TC-499)

### TC-400: Cancelling the last booking shows empty state
**Category**: Edge Case  
**Priority**: P1  
**Preconditions**: Logged in; exactly 1 booking exists  
**Steps**:
1. Navigate to `/bookings/:id` for the only booking
2. Cancel it via "Cancel Booking" → "Yes, cancel it"
3. Wait for redirect to `/bookings`
**Expected Results**: "No bookings yet" empty state shown; "Browse Events" button visible; no booking cards  
**Business Rule**: `bookings.length === 0` empty state branch  
**Suggested Layer**: E2E

---

### TC-401: Clearing all bookings on an already-empty account
**Category**: Edge Case  
**Priority**: P2  
**Preconditions**: Logged in; zero bookings exist  
**Steps**:
1. Via API: `DELETE /bookings` (clear all) with valid token
**Expected Results**: HTTP 200; response includes `{ "deleted": 0 }`; no error thrown  
**Business Rule**: `prisma.booking.deleteMany` with no matches returns `count: 0`  
**Suggested Layer**: API

---

### TC-402: FIFO pruning same-event fallback — seat count decrements permanently
**Category**: Edge Case  
**Priority**: P1  
**Preconditions**: Logged in; user has 9 bookings all for event ID 1; note oldest booking ref and current `availableSeats`  
**Steps**:
1. Via API: `POST /bookings` for event ID 1 with quantity 2
2. Via API: `GET /bookings` — confirm count
3. Via API: `GET /events/1` — check seat count
**Expected Results**: Total booking count is still 9; oldest booking from event 1 is removed; `availableSeats` for event 1 permanently decremented by 2  
**Business Rule**: `sameEventFallback = true` triggers `eventRepository.decrementSeats(eventId, quantity)`  
**Suggested Layer**: API

---

### TC-403: Booking for a deleted event is no longer accessible
**Category**: Edge Case  
**Priority**: P1  
**Preconditions**: Logged in; user has a booking for a user-created (non-static) event; note booking ID  
**Steps**:
1. Delete the parent event via `DELETE /events/:id`
2. Navigate to `/bookings/:bookingId`
**Expected Results**: "Booking not found" page is shown; booking no longer exists due to cascade delete (Event → Booking)  
**Business Rule**: Prisma cascade: `Event` delete cascades to `Booking`  
**Suggested Layer**: E2E

---

### TC-404: Booking references are unique across all bookings
**Category**: Edge Case  
**Priority**: P2  
**Preconditions**: Logged in; create 20 bookings for events starting with the same letter  
**Steps**:
1. Via API: create 20 bookings for events whose titles start with "T" (e.g., "Tech Conference Bangalore")
2. Collect all `bookingRef` values from responses
**Expected Results**: All 20 refs are unique strings; each starts with `T-`  
**Business Rule**: `generateUniqueRef` retries up to 10 times on collision; falls back to timestamp-based ref  
**Suggested Layer**: API

---

### TC-405: Maximum quantity booking (10 tickets) — correct total and refund status
**Category**: Edge Case  
**Priority**: P1  
**Preconditions**: Logged in; "Food Festival Bangalore" ($149/ticket) with ≥10 available seats  
**Steps**:
1. Book 10 tickets for "Food Festival Bangalore"
2. Navigate to `/bookings/:id`
3. Check "Payment Summary" and run refund check
**Expected Results**: Tickets = 10; Price per ticket = $149; Total Paid = $1,490; refund check shows "Not eligible for refund. Group bookings (10 tickets) are non-refundable."  
**Business Rule**: `totalPrice = 149 × 10`; `quantity > 1 → ineligible`  
**Suggested Layer**: E2E

---

### TC-406: Bookings list paginates at 10 items per page
**Category**: Edge Case  
**Priority**: P2  
**Preconditions**: Logged in; user has more than 10 bookings (requires API seeding or disabling FIFO limit temporarily)  
**Steps**:
1. Navigate to `/bookings`
2. Observe pagination controls
3. Click page 2
**Expected Results**: First page shows 10 items; second page shows remainder; URL updates to `?page=2`; pagination component reflects current page  
**Business Rule**: `limit: 10` default in `useBookings`; `totalPages` from `bookingService.getBookings`  
**Suggested Layer**: E2E

---

### TC-407: Create booking for a non-existent event returns 404
**Category**: Edge Case  
**Priority**: P1  
**Preconditions**: Logged in; event ID 999999 does not exist  
**Steps**:
1. Via API: `POST /bookings` with `{ "eventId": 999999, "quantity": 1, "customerName": "Test User", "customerEmail": "test@test.com", "customerPhone": "9876543210" }`
**Expected Results**: HTTP 404; error message "Event with id 999999 not found"  
**Business Rule**: `bookingService.createBooking` calls `eventRepository.findById`; not found → `NotFoundError`  
**Suggested Layer**: API

---

## UI State (TC-500–TC-599)

### TC-500: Booking list shows skeleton loading state while fetching
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; bookings exist; network throttled  
**Steps**:
1. Navigate to `/bookings` on a throttled connection
2. Observe the page before data loads
**Expected Results**: Five `BookingCardSkeleton` placeholder cards visible while `isLoading` is true; replaced by real cards once data arrives  
**Business Rule**: `isLoading` branch renders `Array.from({ length: 5 }).map(... <BookingCardSkeleton>)`  
**Suggested Layer**: E2E

---

### TC-501: Empty state displays when user has no bookings
**Category**: UI State  
**Priority**: P1  
**Preconditions**: Logged in; user has zero bookings  
**Steps**:
1. Navigate to `/bookings`
**Expected Results**: "No bookings yet" heading with description "You haven't booked any events yet…"; "Browse Events" button links to `/events`; no booking cards or pagination  
**Business Rule**: `bookings.length === 0` branch  
**Suggested Layer**: E2E

---

### TC-502: Booking detail shows full-page spinner while loading
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; navigating to `/bookings/:id` on throttled connection  
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe immediately after navigation
**Expected Results**: Centered full-page `Spinner size="lg"` is visible; no partial booking data rendered  
**Business Rule**: `isLoading` check in `BookingDetailPage`  
**Suggested Layer**: E2E

---

### TC-503: Booking detail shows "Access Denied" state for 403
**Category**: UI State  
**Priority**: P0  
**Preconditions**: User B logged in; User A booking ID known  
**Steps**:
1. As User B, navigate to `/bookings/:userA_id`
**Expected Results**: `EmptyState` with title "Access Denied" and description "You are not authorized to view this booking." rendered; "View My Bookings" button visible  
**Business Rule**: `isError && error.status === 403` → `is403` flag drives "Access Denied" state  
**Suggested Layer**: E2E

---

### TC-504: Refund section starts in idle state
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; on any booking detail page  
**Steps**:
1. Navigate to `/bookings/:id`
2. Scroll to "Refund" section
**Expected Results**: "Check eligibility for refund?" link-button is visible; no spinner; no result banner  
**Business Rule**: `status === 'idle'` is the initial state of `RefundEligibility`  
**Suggested Layer**: E2E

---

### TC-505: Refund result (eligible) shows green banner with correct text
**Category**: UI State  
**Priority**: P1  
**Preconditions**: Logged in; booking with `quantity = 1`  
**Steps**:
1. Navigate to `/bookings/:id`
2. Click "Check eligibility for refund?"
3. Wait for result
**Expected Results**: `[data-testid="refund-result"]` or `#refund-result` has green (emerald) styling; text reads "Eligible for refund. Single-ticket bookings qualify for a full refund."  
**Business Rule**: `status === 'eligible'` branch; `bg-emerald-50` styling  
**Suggested Layer**: E2E

---

### TC-506: Refund result (ineligible) shows red banner with quantity interpolated
**Category**: UI State  
**Priority**: P1  
**Preconditions**: Logged in; booking with `quantity = 5`  
**Steps**:
1. Navigate to `/bookings/:id` for the 5-ticket booking
2. Click "Check eligibility for refund?"
3. Wait for result
**Expected Results**: `#refund-result` has red styling; text reads "Not eligible for refund. Group bookings (5 tickets) are non-refundable."  
**Business Rule**: `status === 'ineligible'`; message interpolates `{quantity}`  
**Suggested Layer**: E2E

---

### TC-507: "Clear all bookings" button disabled and shows "Clearing…" while in-flight
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; bookings exist  
**Steps**:
1. Navigate to `/bookings`
2. Click "Clear all bookings" and confirm the dialog
3. Observe the button immediately after confirmation
**Expected Results**: Button text changes to "Clearing…" and has `disabled` attribute while the request is pending  
**Business Rule**: `clearing` state in `BookingsContent`: `disabled={clearing}`; label: `clearing ? 'Clearing…' : 'Clear all bookings'`  
**Suggested Layer**: E2E

---

### TC-508: Cancel booking — confirm dialog appears before executing
**Category**: UI State  
**Priority**: P1  
**Preconditions**: Logged in; on `/bookings/:id`  
**Steps**:
1. Click "Cancel Booking"
2. Observe the page without confirming
**Expected Results**: `ConfirmDialog` opens with title "Cancel this booking?"; description mentions booking ref and number of seats to release; "Yes, cancel it" and close buttons are present; booking is NOT yet cancelled  
**Business Rule**: `confirm` state gates the cancel mutation  
**Suggested Layer**: E2E

---

### TC-509: Cancel booking — dialog shows loading while delete is in-flight
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; on `/bookings/:id`; throttled network  
**Steps**:
1. Click "Cancel Booking" → confirm → click "Yes, cancel it"
2. Observe dialog state before response arrives
**Expected Results**: `ConfirmDialog` confirm button shows loading state (`isLoading={isPending}`); dialog remains open until request resolves  
**Business Rule**: `useCancelBooking` → `isPending` passed to `ConfirmDialog`  
**Suggested Layer**: E2E

---

### TC-510: Booking detail breadcrumb shows booking ref
**Category**: UI State  
**Priority**: P2  
**Preconditions**: Logged in; booking ref = `T-A3B2C1`  
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe breadcrumb navigation at the top of the page
**Expected Results**: Breadcrumb reads "My Bookings / T-A3B2C1"; "My Bookings" is a clickable link to `/bookings`; ref portion is plain text  
**Business Rule**: Breadcrumb uses `booking.bookingRef`  
**Suggested Layer**: E2E

---

### TC-511: Cancel button only visible for confirmed bookings
**Category**: UI State  
**Priority**: P1  
**Preconditions**: Logged in; booking detail page for a "confirmed" status booking  
**Steps**:
1. Navigate to `/bookings/:id`
2. Observe the header area
**Expected Results**: "Cancel Booking" danger button is visible; guarded by `booking.status === 'confirmed'`  
**Business Rule**: `{booking.status === 'confirmed' && <Button variant="danger">Cancel Booking</Button>}`  
**Suggested Layer**: E2E
