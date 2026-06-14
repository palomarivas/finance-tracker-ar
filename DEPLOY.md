# Deploy

Stack: **Neon** (Postgres) · **Render** (API) · **Vercel** (Angular frontend).
Do the steps in order — each one produces a value the next one needs.

## 1. Database — Neon

1. Create a free account at https://neon.tech and a new project (region: AWS `us-east`).
2. Copy the **connection string** (looks like
   `postgresql://USER:PASS@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require`).
   Keep it for the next step.

## 2. API — Render

1. Create a free account at https://render.com and connect your GitHub.
2. **New → Blueprint** → pick the `finance-tracker-ar` repo. Render reads `render.yaml`.
3. When prompted for the environment variables marked `sync: false`, set:
   - `DATABASE_URL` → the Neon connection string from step 1.
   - `JWT_SECRET` → 48+ random hex chars
     (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
   - `CORS_ORIGINS` → leave as `https://finance-tracker-ar-web.vercel.app` for now
     (adjust in step 3 if Vercel gives a different URL).
4. Deploy. First boot runs migrations, seeds the 16 system categories, and syncs FX.
   Note the service URL, e.g. `https://finance-tracker-ar-api.onrender.com`.
5. Sanity check: open `<API_URL>/` → should say "Hello World!".
   - If Render appended a suffix to the service name, update
     `src/environments/environment.production.ts` in the **web** repo to match.

> Free tier note: the API sleeps after ~15 min idle; the first request then takes
> ~30s to wake. Fine for a portfolio demo.

## 3. Frontend — Vercel

1. Create a free account at https://vercel.com and connect GitHub.
2. **Add New → Project** → import `finance-tracker-ar-web`. Vercel reads `vercel.json`
   (build command, output dir, SPA rewrite) — no extra config needed.
3. Deploy. Note the URL, e.g. `https://finance-tracker-ar-web.vercel.app`.
4. Back on Render, set `CORS_ORIGINS` to that exact Vercel URL and redeploy the API
   (a fast env-only redeploy).

## 4. Verify

Open the Vercel URL → register → import a statement → the dashboard fills in.
Pin both repos on your GitHub profile.
