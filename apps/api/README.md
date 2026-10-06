# val-api

Express + TypeScript rebuild of the Valorant shop / wallet / match backend.
Port **10000**. TypeScript rewrite of the patterns in `~/workspace/val/api/lib/`
(`riot.js` cookie reauth, `val.js` storefront + image fallback chain, `crypto.js`
AES-256-GCM).

## setup

```bash
npm install
npm run build   # tsc -> dist/
npm run dev     # tsx watch src/index.ts
npm start       # node dist/index.js (after build)
```

Copy `.env.example` to `.env` and fill in:

| var | required | notes |
|---|---|---|
| `PORT` | no (default 10000) | listen port |
| `API_JWT_SECRET` | yes | HMAC secret for the API JWTs (HS256, ~15min expiry) |
| `ENCRYPTION_KEY` | yes | 64 hex chars; AES-256-GCM encrypts stored cookie jars |
| `MONGODB_URI` | no | when unset, in-memory repo is used (dev only, warns at startup) |
| `CORS_ORIGIN` | no | comma-separated origins; `http://localhost:3000` always added |
| `VAL_FIXTURE` | no | `true` + ssid `FIXTURE_SSID` => canned data, no Riot calls |

## routes (errors always `{error, code?}`)

| route | auth | notes |
|---|---|---|
| `GET /api/health` | none | `{ok:true, version}` |
| `GET /api/me` | JWT | user + accounts with `active` flag |
| `POST /api/riot/connect` | JWT | `{ssid?\|cookies?}` => reauth, geo, upsert account, persist rotated jar |
| `DELETE /api/riot/disconnect` | JWT | drops all user accounts + sessions |
| `POST /api/riot/switch` | JWT | `{accountId}` => set active account |
| `GET /api/status` | JWT or `x-ssid` | `{connected, gameName?, tagLine?, region?, shard?, accountId?}` |
| `GET /api/store` | JWT or `x-ssid` | daily offers + night market (or `null`), `fetchedAt` |
| `GET /api/wallet` | JWT or `x-ssid` | `{vp, radianite}` |
| `GET /api/match` | JWT or `x-ssid` | `{inGame:false}` or pregame/live detail with side estimate + `sideNote` |

`x-ssid` is the dev path (no Google): treated as a single dev user, but still
runs the full reauth + cookie-rotation flow.

## architecture notes

- **per-account isolation** (the old "only one user's ssid works" bug):
  the token cache is keyed by `userId:puuid`, cookie jars live per account,
  and `Set-Cookie` rotation is merged into *that* account's jar only.
  There is no global/single-user cache.
- **cookies**: encrypted with AES-256-GCM (12-byte IV, base64url `iv|tag|ct`)
  before persistence. Access tokens stay in the memory cache until `expiresAt`
  — never persisted in plaintext.
- **geo/shard**: discovered per account via the riot-geo PAS endpoint
  (`PUT /pas/product/valorant` with `{id_token}`); shard map
  latam|br|na->na, eu->eu, ap->ap, kr->kr. Nothing hardcoded.
- **caches**: store 5min, wallet 3min, match 15s (per account); valorant-api.com
  assets (skins/weapons/agents) 24h in memory.
- **skin images**: fallback chain level icon -> parent icon -> fullRender.
- **match sides**: Riot's API does not expose live attacking/defending sides;
  the API returns a first-half estimate (Red attacks, Blue defends) and always
  includes `sideNote` saying it's an estimate.
- **mongo indexes**: `users.googleId` unique, `riotAccounts.userId`,
  `(userId, puuid)` unique.

## fixture QA (no Riot creds needed)

```bash
npm run test:fixture
```

Boots the real server with `VAL_FIXTURE=true`, mints a JWT, and asserts the
contract for connect/status/store/wallet/match plus the `x-ssid` dev path and
error shapes. Fixture data is obviously fake (`FixturePlayer#FIX1`,
`https://example.com/fixture/...` icons, `FIXTURE_*` ids).
