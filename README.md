# CaughtOffside

A football booking and matchmaking college project built with React, Express, MongoDB and Socket.IO.

## Getting started

Create an account using **Sign in → Sign Up Now**. Choose **Venue owner** to list grounds from **My profile → Manage My Turfs**. Players can browse venues, reserve slots, host matches and connect with teammates.

Reservations do not collect online payments. The venue fee is payable directly to the venue.
New accounts start with zero match statistics. No starter accounts or venues are automatically created.

## Local development

Requires Node.js 24 and MongoDB (local or Atlas).

```powershell
npm ci
npm ci --prefix client --include=dev
# Create .env from .env.example only if you do not have one yet.
npm run build
npm start
```

Open http://localhost:5000. For frontend hot reload, run `npm run client` in another terminal and open http://localhost:5173. Vite proxies API and Socket.IO requests.

Set `MONGO_URI` and `JWT_SECRET` in your local .env. Never commit credentials. Temporary MongoDB is opt-in with `ALLOW_MEMORY_DB=true` locally and is disabled in production.

## Deployment

Connect this GitHub repository through **Render → New → Blueprint**, using the root `render.yaml`. Provide your Atlas URI as `MONGO_URI`. The Blueprint generates a JWT secret, builds the frontend and starts the server.

Use an Atlas database user with read/write access to your database. Add the Render service's outbound IP ranges in Atlas Network Access. The app creates its own collections; no import is needed.

Health endpoint: `/api/health`. All venue times use Asia/Kolkata. One Render service hosts both the React app and backend. The existing service name and URL are retained so saved links continue to work.

## Existing starter data

A startup migration archives the original sample accounts that still match their seeded name, email and password, along with their starter venues, related matches and simulated reservations. These are excluded from app queries; documents are not deleted. New accounts and their listings remain available. Archived accounts cannot authenticate, including with older tokens.

For recovery, archived documents retain `archivedSample: true` in Atlas. Export those records before any manual changes. The migration must be disabled before restoring sample accounts, otherwise they will be archived again on startup.

## Verification

```powershell
npm run build
npm test
```

The integration tests run against a disposable MongoDB database. They verify starter-data archival, signup as player and owner, listing creation, protected profile fields, server-controlled prices, duplicate slot prevention, live booking events and cancellation. The historical seed file is used only as a test fixture.
