# CaughtOffside

A football booking and matchmaking college project built with React, Express, MongoDB and Socket.IO.

For a beginner-friendly file order, request walkthroughs and five 90-minute backend study sessions, read [BACKEND_STUDY_GUIDE.md](BACKEND_STUDY_GUIDE.md). Source comments explain each major section and distinguish implemented rules from known limitations.

## Getting started

Create an account using **Sign in → Sign Up Now**. Choose **Venue owner** to list grounds from **My profile → Manage My Turfs**. Players can browse venues, reserve slots, host matches and connect with teammates.

Reservations do not collect online payments. The venue fee is payable directly to the venue.
New accounts start with zero match statistics. No starter accounts or venues are automatically created.

## Local development

Requires Node.js 24 and MongoDB Atlas or a local MongoDB replica set. Hosting and cancellation use multi-document transactions; standalone MongoDB does not support these operations.

```powershell
npm ci
npm ci --prefix client --include=dev
# Create .env from .env.example only if you do not have one yet.
npm run build
npm start
```

Open http://localhost:5000. For frontend hot reload, run `npm run client` in another terminal and open http://localhost:5173. Vite proxies API and Socket.IO requests.

Set `MONGO_URI` and `JWT_SECRET` in your local .env. Never commit credentials. Temporary MongoDB is opt-in with `ALLOW_MEMORY_DB=true` locally and is disabled in production. The fallback starts a single-node in-memory replica set when the configured database cannot be reached. A running standalone database is not automatically replaced; configure a replica set or use Atlas.

## Deployment

Connect this GitHub repository through **Render → New → Blueprint**, using the root `render.yaml`. Provide your Atlas URI as `MONGO_URI`. The Blueprint generates a JWT secret, builds the frontend and starts the server.

Use an Atlas database user with read/write access to your database. Add the Render service's outbound IP ranges in Atlas Network Access. The app creates its own collections; no import is needed.

Health endpoint: `/api/health`. All venue times use Asia/Kolkata. One Render service hosts both the React app and backend. The existing service name and URL are retained so saved links continue to work.

## Hosting with a real turf reservation

**Find & Host Matches → Host a New Match** offers two choices:

- **Reserve a new slot:** choose a venue, date and available one-hour slot. Publishing creates the reservation and match together. The host is the first player; the venue fee comes from the venue listing, independent of the optional per-player contribution.
- **Use my existing reservation:** choose your own upcoming booking that has not already been used for a match. The server derives the venue and schedule from that booking; it creates no duplicate booking.

The confirmation and receipt appear in **My Bookings & Games** and the reservation appears in the venue owner's dashboard. Payment remains **pay at venue**; there is no payment gateway or online collection. Any player contribution is arranged directly with the host.

A unique database slot index prevents competing hosts and ordinary bookings from claiming the same slot. Transactions prevent an orphan booking or unreserved match after a failed write. Client retry IDs avoid duplicate creation after a lost response. Cancelling through either the host's bookings or the venue-owner dashboard withdraws the linked match, clears pending requests, and releases the slot in the same transaction. The cancelled match remains in history.

Older match listings without a booking remain in history but are excluded from discovery and reject new joins/approvals. They are not automatically converted into reservations, because their slots may already belong to someone else.

The new booking service is in `server/services/matchBookings.js`; the host form is `client/src/components/HostMatchModal.jsx`. The API retains `POST /api/matches`: send either `{ venueId, date, timeSlot }` or `{ bookingId }`, plus optional `format`, `totalSpots`, `pricePerSpot`, `notes`, and `hostingRequestId`. A retry ID identifies one submission and must change if its details change.

## Existing starter data

A startup migration archives the original sample accounts that still match their seeded name, email and password, along with their starter venues, related matches and simulated reservations. These are excluded from app queries; documents are not deleted. New accounts and their listings remain available. Archived accounts cannot authenticate, including with older tokens.

For recovery, archived documents retain `archivedSample: true` in Atlas. Export those records before any manual changes. The migration must be disabled before restoring sample accounts, otherwise they will be archived again on startup.

## Verification

```powershell
npm run build
npm test
```

The integration tests run against a disposable MongoDB replica set. They verify starter-data archival, signup as player and owner, listing creation, protected profile fields, server-controlled prices, duplicate slot prevention, live booking events and cancellation. The historical seed file is used only as a test fixture.

Hosting tests also verify actual turf reservations, free player spots, retry safety, booking ownership, invalid schedules, concurrent hosting versus normal booking, linked cancellation, cancellation versus linking races, and transaction rollback after an injected match-write failure.
