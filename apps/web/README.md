# val web

Next.js 15 (App Router) + TypeScript + Tailwind frontend for the val app.
The design DNA (themes, fonts, custom cursor) is ported from the original
`~/workspace/val/style.css` single-page app.

## run locally

```sh
cp .env.example .env   # then fill in values
npm install
npm run dev            # http://localhost:3000
```

build check: `npm run build` · prod: `npm run start`

## auth flow

1. google sign-in via auth.js (next-auth v5) on `/login`.
2. every backend call goes through a route handler in `app/api/*` which
   mints a short-lived HMAC JWT (`jose`, HS256, `API_JWT_SECRET`,
   `{userId, email, exp 15min}`) and sends it as `Authorization: Bearer`.
   the secret and the token never reach the client bundle.

## VAL_DEV_AUTH

`VAL_DEV_AUTH=true` (local only, default off) adds a fake "dev login"
button on `/login` so the dashboard is testable without google creds.
the server logs a warning when enabled. **never enable in production.**

## env vars

see `.env.example`: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
`AUTH_URL`, `NEXT_PUBLIC_API_URL`, `API_JWT_SECRET`, `VAL_DEV_AUTH`.
