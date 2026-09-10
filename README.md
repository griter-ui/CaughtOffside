# CaughtOffside — college project demo

A MERN football platform with player profiles, turf listings, simulated bookings,
match hosting, join requests, teammate connections and Socket.IO live updates.
This portfolio demo uses sample venues and shared demo accounts. Payments and
refunds are not processed. Do not enter sensitive personal information.

## Run locally

Requires Node.js 24. Run commands from the folder containing this README.

```powershell
npm ci
npm ci --prefix client --include=dev
Copy-Item .env.example .env # Only if you do not already have a .env file.
```

Set `MONGO_URI` in `.env` to your local MongoDB or Atlas connection string and
set `SEED_DEMO_DATA=true`. For a temporary local database only, you can set
`ALLOW_MEMORY_DB=true`; temporary data disappears when its process is stopped.

```powershell
npm run build
npm start
```

Open http://localhost:5000. For frontend hot reload, run `npm run client` in a
second terminal and open http://localhost:5173. Vite proxies both API and Socket.IO
requests to the Node server. All venue times are in Asia/Kolkata.

## MongoDB Atlas setup

1. Create an account at https://www.mongodb.com/cloud/atlas/register and a project.
2. Create a **Free (M0)** cluster. Choose a region close to your hosting region.
   Skip Atlas's sample dataset: this app supplies its own football sample data.
3. Under **Database Access**, create a password-authenticated database user, such
   as `football_demo`. Give it the `readWrite` role on `football_db`. Save the
   password privately; this is different from your Atlas account login.
4. Under **Network Access**, add your current IP for local testing. For deployment,
   add the outbound IP ranges shown in your Render service's **Connect → Outbound**
   panel. If the initial deployment fails before you add these ranges, add them
   and redeploy; the application intentionally will not use temporary storage.
5. Open the cluster's **Connect → Drivers → Node.js** dialog. Copy the URI and
   insert your database username, password, and `football_db` before the `?`:

   ```text
   mongodb+srv://football_demo:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/football_db?retryWrites=true&w=majority
   ```

   Use your actual Atlas cluster hostname. URL-encode special characters in the
   password when inserting it into a URI. Save the completed URI in `.env` for
   local use and in Render's `MONGO_URI` field for deployment; never commit it.

You do not need to import the downloaded `data` folder or manually create
collections. The app creates collections and sample accounts on its first startup
when `SEED_DEMO_DATA=true` and the users collection is empty. Existing data is
preserved on restart. Demo matches use dates relative to that first startup;
later, use **Open Games → Host a New Match** to add fresh upcoming games.

## Deploy on Render

1. Push the contents of this inner `Football` folder to your GitHub repository.
   `package.json` and `render.yaml` should be at the repository root. Do not upload
   `.env`, `node_modules`, `data`, or the outer `__MACOSX` folder.
2. In https://dashboard.render.com select **New → Blueprint**, connect the repo,
   and use `render.yaml`. It selects one free Node web service, runs the frontend
   build, enables demo seeding, sets the health check, and generates a JWT secret.
3. When prompted for `MONGO_URI`, paste your completed Atlas URI. Add Render's
   outbound IP ranges in Atlas Network Access, as described above.
4. Deploy. Once healthy, open your assigned HTTPS `onrender.com` URL.

For manual **New → Web Service** setup instead, use:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build command | `npm ci && npm ci --prefix client --include=dev && npm run build` |
| Start command | `npm start` |
| Health check | `/api/health` |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `24` |
| `MONGO_URI` | Your Atlas connection string |
| `JWT_SECRET` | Random secret, at least 32 characters |
| `SEED_DEMO_DATA` | `true` |
| `ALLOW_MEMORY_DB` | `false` |
| `MONGOMS_DISABLE_POSTINSTALL` | `true` (skip the unused local MongoDB binary download on Render) |

Generate a manual JWT secret locally with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
Let Render set `PORT`. You do not need a separate frontend host or API URL.
Render's free service sleeps after 15 minutes without inbound traffic, so the
first visit can take longer to load.

## Demo walkthrough

1. Open **Sign In / Sign Up** and use the Rohan player demo button.
2. Choose a venue, an upcoming slot, and simulate checkout. No payment details are needed.
3. Open **My Profile & Hub → My Bookings** to inspect or cancel the reservation.
4. Sign in with the Rajesh turf owner demo button to view owned venues and bookings.
5. Use two browsers to demonstrate live slot availability. Two simultaneous
   bookings for the same venue/date/slot are protected by a unique database index.
6. Open Games supports match creation and player join requests; the host can
   approve requests from their profile hub.

Demo account password: `password123`. Player emails: `rohan@gmail.com`,
`arjun@gmail.com`, `vikram@gmail.com`. Owner email: `owner@turf.com`.
These are intentionally shared demo credentials, not database credentials.

## Verification

```powershell
npm run build
npm test
```

Tests use their own disposable MongoDB instance and never connect to your `.env`
database. The first test run may download a MongoDB binary. Tests cover date
validation, demo login, protected profile fields, venue ownership permissions,
server-controlled prices, concurrent bookings, Socket.IO events and cancellation.

This is a student demo, not a commercial booking service. Shared accounts can be
edited by other visitors. Production payments, account verification, moderation
and a full security audit are outside its scope.

References: [Atlas free cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/),
[Atlas connection setup](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/),
[Render Blueprints](https://render.com/docs/infrastructure-as-code),
[Render outbound IPs](https://render.com/docs/outbound-ip-addresses),
[Render free hosting](https://render.com/docs/free).
