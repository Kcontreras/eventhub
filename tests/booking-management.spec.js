import { test, expect } from '@playwright/test';

const BASE_URL      = 'https://eventhub.rahulshettyacademy.com';
const USER_EMAIL    = 'rahulshetty1@gmail.com';
const USER_PASSWORD = 'Magiclife1!';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByPlaceholder('you@email.com').fill(USER_EMAIL);
  await page.getByLabel('Password').fill(USER_PASSWORD);
  await page.locator('#login-btn').click();
  await expect(page.getByRole('link', { name: /Browse Events/i }).first()).toBeVisible();
}

// Books the first available (non-sold-out) event. Returns { bookingRef, eventTitle }.
// Precondition: user must already be logged in.
async function bookEvent(page) {
  await page.goto(`${BASE_URL}/events`);

  // Fix #7: getByRole('heading') over raw locator('h3')
  const firstCard = page.getByTestId('event-card').filter({
    has: page.getByTestId('book-now-btn'),
  }).first();
  await expect(firstCard).toBeVisible();

  const eventTitle = (await firstCard.getByRole('heading', { level: 3 }).textContent())?.trim() ?? '';
  console.log(`Booking event: "${eventTitle}"`);

  await firstCard.getByTestId('book-now-btn').click();
  await expect(page).toHaveURL(/\/events\/\d+/);

  // Fill booking form
  // Fix #4: getByTestId('customer-email') over locator('#customer-email')
  await page.getByLabel('Full Name').fill('Test User');
  await page.getByTestId('customer-email').fill('testuser@example.com');
  await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
  // Fix #6: locator('#confirm-booking') over locator('.confirm-booking-btn')
  await page.locator('#confirm-booking').click();

  // .booking-ref is the only available selector on the hosted app (no data-testid there yet)
  const refEl = page.locator('.booking-ref').first();
  await expect(refEl).toBeVisible();
  const bookingRef = (await refEl.textContent())?.trim() ?? '';
  console.log(`Booking confirmed. Ref: ${bookingRef}`);
  return { bookingRef, eventTitle };
}

// Clears all bookings for the current user. Safe to call when already empty.
async function clearBookings(page) {
  await page.goto(`${BASE_URL}/bookings`);
  const alreadyEmpty = await page.getByText('No bookings yet').isVisible().catch(() => false);
  if (alreadyEmpty) return;

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /clear all bookings/i }).click();
  await expect(page.getByText('No bookings yet')).toBeVisible();
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

test.describe('Booking Management — Critical Happy Paths', () => {

  // TC-001 ───────────────────────────────────────────────────────────────────
  test('TC-001: displays booking card on bookings list page', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings --
    await page.goto(`${BASE_URL}/bookings`);

    // -- Step 3: Assert booking card appears with correct data --
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(eventTitle);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(bookingRef);
  });

  // TC-002 ───────────────────────────────────────────────────────────────────
  test('TC-002: shows all sections on booking detail page', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to /bookings and click View Details --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Verify breadcrumb shows booking ref --
    // span.font-mono.font-bold is the only selector available on the hosted app (no data-testid there yet)
    await expect(page.locator('span.font-mono.font-bold').first()).toContainText(bookingRef);

    // -- Step 4: Verify event details section --
    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    // -- Step 5: Verify customer details section --
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();

    // -- Step 6: Verify payment summary section --
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // -- Step 7: Verify refund eligibility check button is present --
    await expect(page.locator('#check-refund-btn')).toBeVisible();
  });

  // TC-006b — post-booking navigation (renamed from TC-006 to resolve duplicate) ─
  test('TC-006b: navigates to /bookings via "View My Bookings" link after confirming booking', async ({ page }) => {
    // -- Step 1: Login and clear state --
    await login(page);
    await clearBookings(page);

    // -- Step 2: Book the first available event --
    await page.goto(`${BASE_URL}/events`);
    const firstCard = page.getByTestId('event-card').filter({
      has: page.getByTestId('book-now-btn'),
    }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.getByTestId('book-now-btn').click();
    await expect(page).toHaveURL(/\/events\/\d+/);

    // Fix #4: getByTestId('customer-email') over locator('#customer-email')
    await page.getByLabel('Full Name').fill('Test User');
    await page.getByTestId('customer-email').fill('testuser@example.com');
    await page.getByPlaceholder('+91 98765 43210').fill('9876543210');
    // Fix #6: locator('#confirm-booking') over locator('.confirm-booking-btn')
    await page.locator('#confirm-booking').click();

    // -- Step 3: Confirm booking ref appears on confirmation card --
    const refEl = page.locator('.booking-ref').first();
    await expect(refEl).toBeVisible();
    const bookingRef = (await refEl.textContent())?.trim() ?? '';
    console.log(`Booking confirmed. Ref: ${bookingRef}`);

    // -- Step 4: Click "View My Bookings" link on confirmation card --
    await page.getByRole('link', { name: 'View My Bookings' }).click();
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);

    // -- Step 5: Assert the new booking appears in the list --
    const bookingCard = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await expect(bookingCard).toBeVisible();
  });

  // TC-100 — booking ref format (renamed from TC-102 to match scenario doc) ──
  test('TC-100: booking reference starts with first letter of event title (uppercase)', async ({ page }) => {
    // -- Step 1: Login and clear state --
    await login(page);
    await clearBookings(page);

    // -- Step 2: Book first available event and capture title --
    const { bookingRef, eventTitle } = await bookEvent(page);

    // -- Step 3: Assert ref starts with the event title's first char --
    const expectedPrefix = eventTitle[0].toUpperCase();
    expect(bookingRef).toMatch(new RegExp(`^${expectedPrefix}-[A-Z0-9]{6}$`));
    console.log(`Ref "${bookingRef}" correctly starts with "${expectedPrefix}-" (event: "${eventTitle}")`);
  });

  // TC-003 ──────────────────────────────────────────────────────────────────
  test('TC-003: cancels booking from detail page — shows toast and redirects', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to booking detail via View Details --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click Cancel Booking button on detail page --
    await page.getByRole('button', { name: 'Cancel Booking' }).click();

    // -- Step 4: Assert React confirmation dialog appears --
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    // Fix #5: getByTestId('confirm-dialog-yes') over locator('#confirm-dialog-yes')
    await expect(page.getByTestId('confirm-dialog-yes')).toBeVisible();

    // -- Step 5: Confirm cancellation --
    await page.getByTestId('confirm-dialog-yes').click();

    // -- Step 6: Assert redirect to /bookings and success toast --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();

    // -- Step 7: Assert booking is no longer in the list --
    await expect(page.getByText('No bookings yet')).toBeVisible();
  });

  // TC-004 ───────────────────────────────────────────────────────────────────
  test('TC-004: clears all bookings and shows empty state', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    await bookEvent(page);

    // -- Step 2: Navigate to /bookings and verify booking exists --
    await page.goto(`${BASE_URL}/bookings`);
    await expect(page.getByTestId('booking-card').first()).toBeVisible();

    // -- Step 3: Click "Clear all bookings" and accept browser confirm dialog --
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /clear all bookings/i }).click();

    // -- Step 4: Assert empty state --
    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByRole('main').getByRole('link', { name: 'Browse Events' })).toBeVisible();
  });

  // TC-005 ───────────────────────────────────────────────────────────────────
  test('TC-005: back button navigates from detail page to bookings list', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    const { bookingRef } = await bookEvent(page);

    // -- Step 2: Navigate to the booking detail page --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').filter({ hasText: bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Click "← Back to My Bookings" --
    await page.getByRole('link', { name: /back to my bookings/i }).click();

    // -- Step 4: Assert navigated back to the bookings list --
    await expect(page).toHaveURL(`${BASE_URL}/bookings`);
    await expect(page.getByTestId('booking-card').filter({ hasText: bookingRef })).toBeVisible();
  });

  // TC-006 ───────────────────────────────────────────────────────────────────
  test('TC-006: booking reference is identical in list card and detail page', async ({ page }) => {
    // -- Step 1: Login, clear state, create one booking --
    await login(page);
    await clearBookings(page);
    await bookEvent(page);

    // -- Step 2: Navigate to /bookings and extract the booking ref from the card --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').first();
    await expect(card).toBeVisible();
    // .booking-ref is the only selector available on the hosted app (data-testid added to local source)
    const refFromCard = (await card.locator('.booking-ref').textContent())?.trim() ?? '';
    console.log(`Ref from list card: "${refFromCard}"`);

    // -- Step 3: Verify ref format: single uppercase letter, dash, 6 alphanumeric chars --
    expect(refFromCard).toMatch(/^[A-Z]-[A-Z0-9]{6}$/);

    // -- Step 4: Click View Details and read the ref from the detail page header --
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
    // span.font-mono.font-bold is the only selector on hosted app (data-testid added to local source)
    const refInHeader = (await page.locator('span.font-mono.font-bold').first().textContent())?.trim() ?? '';
    console.log(`Ref in detail header: "${refInHeader}"`);

    // -- Step 5: Assert both refs are identical --
    expect(refInHeader).toBe(refFromCard);
  });

  // TC-007 ───────────────────────────────────────────────────────────────────
  test('TC-007: booking detail shows all five sections with correct customer field values', async ({ page }) => {
    // -- Step 1: Login, clear state, create a booking with known customer data --
    await login(page);
    await clearBookings(page);
    const { eventTitle } = await bookEvent(page);

    // -- Step 2: Navigate to the booking detail page via View Details --
    await page.goto(`${BASE_URL}/bookings`);
    const card = page.getByTestId('booking-card').first();
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    // -- Step 3: Verify "Event Details" section heading and event title --
    await expect(page.getByText('Event Details')).toBeVisible();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    // -- Step 4: Verify "Customer Details" section with exact submitted values --
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText('Test User')).toBeVisible();
    await expect(page.getByText('testuser@example.com')).toBeVisible();
    await expect(page.getByText('9876543210')).toBeVisible();

    // -- Step 5: Verify "Payment Summary" section heading and Total Paid label --
    await expect(page.getByText('Payment Summary')).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();

    // -- Step 6: Verify "Refund" section heading and check-eligibility button are present --
    await expect(page.getByRole('heading', { name: 'Refund' })).toBeVisible();
    await expect(page.locator('#check-refund-btn')).toBeVisible();

    // -- Step 7: Verify "Booking Information" section is present --
    await expect(page.getByText('Booking Information')).toBeVisible();
  });

});
