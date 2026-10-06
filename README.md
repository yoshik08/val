# val — Valorant daily store + night market + live match

Personal Valorant companion: daily store, Night Market (when live), VP/Radianite
wallet, and agent-select side + teammates. Google sign-in, per-user encrypted
Riot cookie jars in MongoDB.

```
apps/web  → Next.js 15 + TypeScript + Tailwind + Auth.js (Vercel)
apps/api  → Express + TypeScript (Render, free web service)
            MongoDB Atlas M0 (users + encrypted cookie jars)
```

## How auth works

1. Sign in with Google (Auth.js) on the web app.
2. Paste your Riot `ssid` cookie on `/connect` (guide in the UI — your
   password never touches this site).
3. The API reauthenticates with the cookie jar (`GET
   auth.riotgames.com/authorize`, `redirect: manual`), captures **rotated**
   cookies from every `Set-Cookie`, and stores the jar AES-256-GCM encrypted
   per `(user, puuid)`. Token cache is keyed per account — no shared/global
   state, so one user's session can never leak into another's.
4. Riot shard is resolved per account via the geo endpoint
   (`riot-geo.pas.si.riotgames.com`), never hardcoded.

Short-lived HS256 JWTs (`API_JWT_SECRET`, 15 min) bridge web → API.
A local `x-ssid` dev path exists for testing without Google.

## Local dev

```bash
# api (http://localhost:10000)
cd apps/api && npm install
# create .env (see .env.example): API_JWT_SECRET, ENCRYPTION_KEY (openssl rand -hex 32)
# VAL_FIXTURE=true enables fixture mode (ssid = FIXTURE_SSID) — no Riot needed
npm run dev

# web (http://localhost:3000)
cd apps/web && npm install
# create .env (see .env.example). VAL_DEV_AUTH=true gives a fake dev login
# for testing without Google credentials. NEVER enable in production.
npm run dev
```

## Deploy (all free tiers)

1. **Atlas M0** — create cluster, db user, allow `0.0.0.0/0` (needed for
   Vercel/Render). `MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/val`.
2. **Google OAuth** — Cloud Console → Credentials → Web client. Authorized
   JavaScript origins: `http://localhost:3000`, `https://<web>.vercel.app`.
   Authorized redirect URIs: `<origin>/api/auth/callback/google`.
3. **Render** — Web Service from `apps/api` (root dir `apps/api`,
   build `npm install && npm run build`, start `npm start`). Env:
   `PORT=10000`, `MONGODB_URI`, `MONGO_DB=val`, `ENCRYPTION_KEY` (64 hex),
   `API_JWT_SECRET` (same as web), `CORS_ORIGIN=https://<web>.vercel.app`.
4. **Vercel** — import repo, root directory `apps/web`. Env: `AUTH_SECRET`,
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL=https://<web>.vercel.app`,
   `NEXT_PUBLIC_API_URL=https://<api>.onrender.com`, `API_JWT_SECRET`.

## SSID guide (also in /connect)

Riot blocks password logins from websites, so: log into
`auth.riotgames.com` in your own browser → DevTools → Application →
Cookies → copy the `ssid` value → paste it on `/connect`. It stays in
your encrypted server-side jar; the browser never holds it after connect.
If it expires you'll see a clear banner with a re-connect button.

## Caveats

- **ATK/DEF is an estimate.** Riot's remote API exposes no attacking side —
  the pill uses the AllyTeam color heuristic (Red→attack, Blue→defend,
  first-half estimate) and the UI always labels it as such.
- **Night Market** only renders when Riot's `BonusStore` is present.
- Riot may rotate/expire cookies (~7 days for ssid-only); rotation is
  captured automatically, but a fully dead jar needs a fresh paste.
- Unofficial endpoints can change without notice; the API surfaces clear
  error codes (`SSID_EXPIRED`, `TOKEN_EXPIRED`, …) when they do.
