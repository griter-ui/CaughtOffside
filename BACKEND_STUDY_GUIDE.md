# How to study the CaughtOffside backend

Start with one request, then follow its dependencies. Your first goal is to explain **browser → Express route → middleware → model → MongoDB → response**. The comments in the code describe sections and the reasons behind important decisions. They also distinguish implemented behavior from missing checks.

The paths below refer to this local repository. Use function names and route strings to find sections; the new comments shift the line numbers shown in the previously recorded videos.

## How to read every route

Write these six answers beside each endpoint before moving on:

1. **Trigger:** which screen/action calls it, using which HTTP method and URL?
2. **Input:** what comes from `req.params` (path), `req.query` (URL filters), `req.body` (JSON), and `req.user` (verified identity)?
3. **Permission:** is login required? Is there a role, owner, host or recipient check?
4. **Rules:** what values are validated? Which rules are missing?
5. **Storage:** which model is queried or changed, and what does the database enforce?
6. **Output:** which status, JSON body and socket event result? How does the browser update?

Do not memorize every line. Trace a successful request, an unauthorized request, and a conflict or invalid-input request.

## Open files in this order

### 1. package.json — how the backend starts

Open [package.json](package.json).

- Find `scripts.start`, `scripts.server`, `scripts.dev`, `scripts.build`, and `scripts.test`.
- Understand that `npm start` runs `node server/server.js`; the root `dev` script also starts only the backend. `npm run client` starts Vite separately.
- Recognize the job of Express, Mongoose, Socket.IO, bcrypt, jsonwebtoken, dotenv and cors. Save their detailed API usage for the relevant files.
- **Explain aloud:** “Node runs the JavaScript process; Express is the HTTP framework inside it.”

### 2. server/server.js — draw the application map

Open [server.js](server/server.js). On this first pass, focus on setup, route registration and `startServer()`; revisit sockets and archival later.

- Follow `dotenv.config()` → production configuration checks → archive plugin registration → Express/HTTP/Socket.IO construction.
- Find `express.json()`, `/api/health`, `app.set('io', io)` and the six `app.use('/api/...')` route prefixes.
- Follow MongoDB connection → archival → `Booking.init()` → `server.listen()`.
- Distinguish startup-time code from handlers that run once per request.
- **Checkpoint:** locate the full endpoint `POST /api/bookings` even though its route file only says `router.post('/')`.

### 3. server/models/User.js — learn schemas through one account

Open [User.js](server/models/User.js).

- Learn `Schema`, `model`, field types, `required`, `default`, `enum`, `min`/`max` and `unique`.
- Separate identity fields, access role, football preferences, skills and statistics.
- Understand that `password` stores a bcrypt hash. New statistics start at zero and remain self-reported.
- `unique` requests a database index; it is not just a JavaScript validation check.
- **Checkpoint:** explain which fields are needed to log in and which only describe a football profile.

### 4. server/routes/auth.js — create and sign into an account

Open [routes/auth.js](server/routes/auth.js). Read `/signup`, then `/login`; defer `/me` and `/profile` until step 6.

- Signup: extract JSON → check required fields → normalize/check email → generate salt/hash → create/save User → sign token → omit password from response.
- Login: find normalized email → `bcrypt.compare()` → sign token → return account without password.
- Learn why a fresh random hash is not compared directly with the stored hash.
- A JWT is signed, not encrypted. Its payload is readable; verification detects tampering and checks expiry.
- **Checkpoint:** describe what goes into MongoDB and what goes back to the browser during signup.

### 5. server/middleware/auth.js — identify the caller

Open [middleware/auth.js](server/middleware/auth.js).

- Follow `Authorization: Bearer <token>` → token extraction → `jwt.verify()` → active account lookup → `req.user` → `next()`.
- Understand why the role is read from the current account, rather than trusting a role submitted in JSON or an old token claim.
- Learn this implementation's responses: missing token `401`, invalid/expired token `403`, missing account `401`, account lookup failure `503`.
- Authentication identifies a caller. Authorization decides whether they may perform an action on a record.
- **Checkpoint:** explain why a valid player token does not grant permission to create an owner-only venue listing.

### 6. Return to auth routes — restore and edit the profile

Reopen [routes/auth.js](server/routes/auth.js), now at `/me` and `/profile`.

- `/me` loads the authenticated account after the browser restores its session.
- `/profile` builds an editable-field allowlist, then updates only `req.user.userId`.
- Learn `$set`, `new: true`, `runValidators: true` and `.select('-password')`.
- Submitted `role`, `email` and `password` are not editable through this endpoint. Updating skills/stats does not verify their truth.
- **Checkpoint:** explain why copying all of `req.body` into the account would be dangerous.

### 7. Venue model + venue routes — follow an easy read

Open [Venue.js](server/models/Venue.js), then [routes/venues.js](server/routes/venues.js).

- Identify the listing fields and the `ownerId` reference to User.
- Read `GET /` and `GET /:id`: filters, `$lte`, `$or`, regex search, `find`, `findById`, sorting and `404`.
- Then read `POST /`: authentication, owner role, required fields/price, server-derived `ownerId`, save and `venue_created`.
- **Checkpoint:** trace a “maximum price” filter from a query string into a MongoDB condition.

### 8. Slot utility + availability route — understand derived data

Open [utils/slots.js](server/utils/slots.js), then return to `GET /:id/slots` in [routes/venues.js](server/routes/venues.js).

- `DEFAULT_SLOTS` is the shared list of valid booking times.
- `isValidDate()` checks both string shape and the actual calendar date using a round-trip.
- `isSlotExpired()` converts AM/PM and uses `+05:30`; new booking closes at the **start** of a slot.
- Availability combines predefined slots with stored Bookings and expiry. There is no separate Slot model.
- **Checkpoint:** explain how the API can show twelve slot choices without storing twelve slot documents.

### 9. Booking model + booking creation — the most important write

Open [Booking.js](server/models/Booking.js), then `POST /` in [routes/bookings.js](server/routes/bookings.js).

- Learn user/venue references, the saved price, receipt identifier and payment status.
- Read the compound unique index on `(venueId, date, timeSlot)`.
- Trace input validation → current venue lookup → early conflict check → server-controlled identity/price → save → populate → socket event → `201`.
- Two requests can both pass an early lookup. The database index rejects the losing insert; duplicate-key error `11000` becomes `409`.
- This is a pay-at-venue reservation. No money is charged and no payment gateway runs.
- **Checkpoint:** draw two overlapping requests and explain exactly where double booking is prevented.

### 10. Booking history and cancellation — finish the lifecycle

Continue in [routes/bookings.js](server/routes/bookings.js).

- `/my-bookings` scopes records by caller; `/owner` first finds the caller's venues, then uses `$in` to get their reservations.
- `populate()` returns selected linked fields; it does not copy all venue/user data into the stored booking.
- Compare player cancellation (`booking.userId`) with owner cancellation (`booking.venueId.ownerId`).
- Cancellation uses `services/matchBookings.js` to cancel the linked match and delete the reservation in one transaction. Deletion frees the unique slot key; `slot_cancelled` and `match_updated` are emitted after commit. The cancelled match remains in history.
- **Checkpoint:** explain why being an owner does not let you cancel a reservation at somebody else's ground.

### 11. Match model + match routes — learn a different workflow

Open [Match.js](server/models/Match.js), then [routes/matches.js](server/routes/matches.js), stopping before comments initially.

- Read in this order: create → browse → request join → host response → my-matches.
- Keep `pendingRequests` separate from `acceptedPlayers`. The host starts accepted and consumes one spot.
- Compare hosted and joined queries; joined excludes self-hosted games.
- Hosting creates a Booking and Match in one transaction, or links the host's existing upcoming reservation. Read `services/matchBookings.js`: the unique slot index prevents double booking, and `bookingId` uniquely links the game to its reservation. Atlas or a local replica set is required.
- Follow schedule, capacity, contribution, ownership and action validation. Conditional writes check pending applicants and enforce squad capacity even during concurrent approvals. Legacy unreserved listings cannot receive new joins.
- **Checkpoint:** explain why a failed Match write rolls back the Booking, and why cancelling a turf reservation also withdraws its game.

### 12. Comment model + comment routes + sockets — persistence versus delivery

Open [MatchComment.js](server/models/MatchComment.js), the last two routes in [routes/matches.js](server/routes/matches.js), then revisit Socket.IO in [server.js](server/server.js).

- Comments store references plus author-name/position snapshots. GET returns oldest first.
- POST derives the author from authentication, trims/saves text, emits a match-named event and returns `201`.
- Current gap: the POST route requires login but does not check accepted membership or match existence. GET history is public.
- `app.set('io', io)` makes the socket server available to route handlers through `req.app.get('io')`.
- `io.emit` broadcasts to everyone; `socket.broadcast.emit` excludes the sending socket. Neither is a durable database hold.
- **Checkpoint:** distinguish a saved comment, a live event, a private room and an authorization rule.

### 13. Player discovery — reuse your query knowledge

Open [routes/players.js](server/routes/players.js).

- The list restricts `role: 'player'`; filters use equality, nested skill paths, `$gte` and regex search.
- Compare filtering, sorting and field projection (`select('-password -email')`).
- Notice the lack of pagination, raw regex input, lexical experience sorting, and the detail route's lack of a player-role filter.
- **Checkpoint:** predict whether a pace-90 player appears for `minPace=95` and explain why the response omits email/password.

### 14. Connection model + connection routes — sender and recipient

Open [Connection.js](server/models/Connection.js), then [routes/connections.js](server/routes/connections.js).

- Read request creation → response → the three-list read API.
- The caller becomes requester; only the stored recipient can respond.
- Accepted friendships query both directions and map to the other user. Pending incoming/outgoing queries keep direction.
- The unique ordered pair protects A→B separately from B→A; it does not fully enforce one undirected friendship under concurrency.
- Declined records block a new request; responses lack a pending-only condition and strict action allowlist.
- **Checkpoint:** explain why a guest cannot accept their own invitation and why two-way pre-checks are not a full race guarantee.

### 15. Archival + fixtures — read these after normal features

Open [archivePlugin.js](server/middleware/archivePlugin.js), [archiveSamples.js](server/archiveSamples.js), then [seed.js](server/seed.js).

- Plugin: add `archivedSample`, hook Mongoose find operations, exclude marked samples. Raw collection calls/counts/aggregates and unique indexes have different behavior.
- Migration: recognize known sample identities/passwords, follow related records, mark them, mark accounts last. Separate writes allow partial completion.
- Fixtures: seed is explicitly used by tests; server startup archives and does not call seed. The retained `SEED_DEMO_DATA` setting does not invoke it.
- Read fixture relationships rather than memorizing sample names, biographies or photos.
- **Checkpoint:** explain why archiving can hide a document without removing its unique index key.

### 16. Tests + deployment — prove and operate the system

Open [demo.test.js](server/test/demo.test.js), revisit [server.js](server/server.js), then read [render.yaml](render.yaml) and [vite.config.js](client/vite.config.js).

- Test setup: disposable MongoDB → seed fixtures → child server on a chosen port → readiness polling. Test cleanup stops all owned resources.
- Assertions cover selected date, auth, archive, role, booking conflict, socket and cancellation behavior. They do not comprehensively test social features.
- Deployment: install dependencies → build React → start Express; configure persistent MongoDB and token secret; check `/api/health`.
- Vite development proxy and Express serving `client/dist` are different arrangements. A build is needed after frontend source changes when using the Express-served site.
- **Checkpoint:** explain what a passing health check proves and what still needs feature-level testing.

## One complete request to rehearse

```text
VenuesPage: user confirms a selected date/time
  -> POST /api/bookings with JSON + Authorization header
  -> server.js mounts the bookings router
  -> authenticateToken verifies JWT and looks up the active account
  -> route validates the schedule and loads the venue
  -> route checks for an existing reservation
  -> Booking.save() attempts the insert
  -> MongoDB's compound unique index allows one reservation for the tuple
  -> route populates venue details and emits slot_booked
  -> HTTP 201 returns the saved booking
  -> VenuesPage displays the receipt; SlotGrid listeners update matching slots
```

Then rehearse the failure path: two requests pass the lookup → one insert wins → the other gets duplicate-key error → the route sends `409` → the browser shows the error rather than a success receipt.

## Concepts to recognize in the code

| Syntax/concept | Meaning in this project |
|---|---|
| `require` / `module.exports` | Load/export CommonJS backend modules. Frontend files use ES module `import`/`export`. |
| `req`, `res`, `next` | Incoming request, outgoing response, and continuation to the next handler. |
| `async` / `await` | Pause this function around a promise; asynchronous JavaScript does not automatically run on a separate JS thread. Other work can proceed while I/O is pending. |
| `find` vs `findOne` vs `findById` | Many records, one matching record, or one record by identifier. |
| Schema vs model vs document | Declared shape/rules, query/creation interface, and one stored entity. |
| `ObjectId` + `ref` + `populate` | Store an identifier, declare its model, then retrieve selected linked data for a response. Not a SQL foreign-key guarantee. |
| `$or`, `$in`, `$ne`, `$gte`, `$lte` | Any condition, membership in a set, not equal, at least, at most. |
| `map` / `filter` / `reduce` | Transform items, keep selected items, or accumulate a result. |
| Hash vs signed token | Password hash verifies a secret; a JWT carries signed, readable claims. |
| Validation vs authorization | Is the input acceptable? Is this caller allowed to do it? Both matter. |
| Unique index vs pre-check | Database-enforced stored-key uniqueness versus an earlier lookup that can race. |
| HTTP vs socket event | Request/response versus live delivery; persisted documents remain the durable source. |

## Five backend study sessions, at most 90 minutes each

Use these as a fresh backend-focused sequence, or combine sessions you already understand.

| Session | Reading and tracing (70 minutes) | Recall (20 minutes) |
|---|---|---|
| 1 | Steps 1–6: startup map, User, signup/login, middleware, profile | Draw the login flow; explain hashing, JWT, `req.user`, roles and the profile allowlist. |
| 2 | Steps 7–10: venues, slot rules, bookings, history/cancellation | Draw two simultaneous bookings; explain the index, price authority and cancellation ownership. |
| 3 | Steps 11–12: matches, approvals, comments and sockets | Trace pending→accepted; distinguish match from booking and saved history from event delivery. |
| 4 | Steps 13–15: player filters, connections, archival and fixtures | Explain the directed-pair limitation, three connection lists, archive-hook scope and seed/startup difference. |
| 5 | Step 16 and revisit the full request flow | Give a two-minute architecture explanation, identify two real limitations, propose a fix and its test. |

For each 70-minute reading block: spend about 10 minutes reading section comments, 40 tracing code, and 20 following one example across files. Recall means close the code and explain aloud; reopen only when you get stuck.

## Connect backend understanding to the website

| Feature | Frontend file to open after the backend |
|---|---|
| Signup/login | [AuthModal.jsx](client/src/components/AuthModal.jsx) |
| Session restoration/shared socket | [App.jsx](client/src/App.jsx) |
| Availability and booking | [VenuesPage.jsx](client/src/pages/VenuesPage.jsx), [SlotGrid.jsx](client/src/components/SlotGrid.jsx) |
| Owner listing and reservations | [OwnerDashboardPage.jsx](client/src/pages/OwnerDashboardPage.jsx) |
| Hosted/joined games and cancellation | [MyBookingsPage.jsx](client/src/pages/MyBookingsPage.jsx) |
| Match discovery/hosting | [OpenMatchesPage.jsx](client/src/pages/OpenMatchesPage.jsx) |
| Discussion history/live updates | [MatchNoticeBoard.jsx](client/src/components/MatchNoticeBoard.jsx) |
| Player search/connections | [PlayerDirectoryPage.jsx](client/src/pages/PlayerDirectoryPage.jsx) |
| Profile edits/invitations | [ProfilePage.jsx](client/src/pages/ProfilePage.jsx), [FootballPassportCard.jsx](client/src/components/FootballPassportCard.jsx) |

You are ready to explain a feature when you can name its endpoint, input, identity source, permission rule, database operation, response, UI update and one limitation without reading the answer.
