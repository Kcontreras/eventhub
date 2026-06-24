# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
EventHub is a full-stack event ticket booking platform built for QA training. Users can browse events, book tickets, manage bookings, and create events. Each user operates in an isolated sandbox.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, React Query v5
- **Backend**: Express.js, Prisma ORM, MySQL 8+
- **Auth**: JWT (7-day expiry), bcryptjs
- **Testing**: Playwright E2E (Chromium only)

## Project Structure
```
eventhub/
├── frontend/          # Next.js 14 app (port 3000)
│   ├── app/           # Pages (App Router)
│   ├── components/    # React components
│   ├── lib/           # API clients, hooks, providers
│   └── types/         # TypeScript interfaces
├── backend/           # Express API (port 3001)
│   ├── src/
│   │   ├── routes/        # HTTP endpoints
│   │   ├── controllers/   # Request handlers
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access (Prisma)
│   │   ├── validators/    # Input validation
│   │   └── middleware/    # Auth, error handling
│   └── prisma/            # Schema + seed
├── tests/             # Playwright E2E tests
├── .claude/
│   ├── commands/      # Custom slash commands (agents)
│   └── docs/          # Skill documents (reference guides)
└── playwright.config.ts
```

## Architecture Pattern
Backend follows layered architecture: Routes → Controllers → Services → Repositories → Database

## Commands

```bash
# Initial setup
npm run setup        # Install deps in both /backend and /frontend

# Development
npm run dev          # Start frontend (3000) + backend (3001) concurrently
npm run seed         # Seed 10 static events

# Database
npm run db:push      # Push schema to DB (non-interactive, no migration files)
npm run migrate      # Run prisma migrate dev (interactive, creates migration files)

# Testing
npm run test                                                      # Run all Playwright tests
npm run test:ui                                                   # Playwright with UI mode
npm run test:report                                               # Open last HTML test report
npx playwright test tests/<file>.spec.js --reporter=line         # Run single test file
```

## Environment Setup
**`backend/.env`** (required):
```
DATABASE_URL="mysql://root:your_password@localhost:3306/eventhub"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

**`frontend/.env.local`** (required):
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## Testing Conventions
- Tests run against `https://eventhub.rahulshettyacademy.com` (the hosted app), not localhost — see `playwright.config.ts`
- Test files go in `tests/` as `<feature-name>.spec.js`
- Follow guidelines in `.claude/docs/playwright-best-practices.md`
- Locator priority: data-testid > role > label/placeholder > ID > CSS class
- No `page.waitForTimeout()` — use `expect().toBeVisible()`
- Tests must be self-contained (login → action → assert)
- Use test accounts: `rahulshetty1@gmail.com` / `Magiclife1!`

## Key Business Rules
- Max 6 user-created events (FIFO pruning on overflow)
- Max 9 bookings per user (FIFO pruning on overflow)
- Booking ref format: `<EventTitle[0].toUpperCase()>-XXXXXX` (e.g. event "React Conf" → ref starts with `R-`)
- Seat count reduces on booking, restores on cancellation (atomic transactions)
- Refund eligibility: 1 ticket = eligible, >1 tickets = not eligible (client-side only)
- Cross-user booking access returns "Access Denied"
- Static events (`isStatic: true` in DB) are immutable — seeded events only

## API Endpoints
Base URL: `http://localhost:3001/api` | Swagger UI: `http://localhost:3001/api/docs`

All booking and event-mutation endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Register user, returns JWT |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | ✓ | Verify token, return user |
| GET | `/events` | — | List events (paginated: `page`, `limit`, `category`, `city`, `search`) |
| GET | `/events/:id` | — | Get single event |
| POST | `/events` | ✓ | Create event |
| PUT | `/events/:id` | ✓ | Update event |
| DELETE | `/events/:id` | ✓ | Delete event (cascades bookings) |
| GET | `/bookings` | ✓ | List user's bookings (filterable by `status`) |
| GET | `/bookings/:id` | ✓ | Get booking by ID |
| GET | `/bookings/ref/:ref` | ✓ | Get booking by reference code |
| POST | `/bookings` | ✓ | Create booking |
| DELETE | `/bookings/:id` | ✓ | Cancel booking |

## `data-testid` Reference

| Attribute | Element |
|-----------|---------|
| `event-card` | Event card in listings |
| `book-now-btn` | "Book Now" on event card |
| `booking-card` | Booking card in list |
| `cancel-booking-btn` | Cancel button on booking card |
| `confirm-dialog-yes` | Confirm button in any dialog |
| `admin-event-form` | Admin create/edit form |
| `event-title-input` | Title field in admin form |
| `add-event-btn` | Submit button in admin form |
| `event-table-row` | Row in admin events table |
| `edit-event-btn` / `delete-event-btn` | Action buttons in admin table row |
| `nav-events` / `nav-bookings` | Navbar links |

Note: Some UI elements use IDs (`#login-btn`, `#customer-email`, `#confirm-dialog-yes`) and CSS classes (`.confirm-booking-btn`, `.booking-ref`) — check the actual rendered HTML when writing locators.

## Custom Slash Commands (Agents)
- `/generate-tests <feature>` — AI Test Automation Engineer: generates Playwright tests
- `/review-tests <file>` — AI Code Reviewer: reviews test code quality
- `/create-scenarios <area>` — AI Functional Tester: creates test scenario documents
- `/test-strategy <scenarios>` — AI Test Architect: assigns tests to optimal pyramid layers

## Skill Documents
- `.claude/docs/playwright-best-practices.md` — Playwright testing standards
- `.claude/docs/eventhub-domain.md` — Domain knowledge and business rules

## Code Style
- Backend: JavaScript with JSDoc, Express patterns
- Frontend: TypeScript, React hooks, Tailwind utility classes
- Tests: JavaScript with Playwright test runner
- Use meaningful variable names, add step comments in tests
