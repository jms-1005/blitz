# blitz — production app

Free in-browser color grading + LUT community. Live at [blitzluts.com](https://blitzluts.com).

## Stack

- **Next.js 15** (App Router, static export — `output: 'export'`) → deploys to Cloudflare Pages
- **Supabase** — auth (Google / Meta / X / LinkedIn OAuth), Postgres, storage (community milestone)
- **Zero-server color engine** — all grading runs client-side in `lib/engine.js` (Oklab color math, 33³ LUT bake/apply, .cube serialization)

Without Supabase env keys the app runs in **beta mode** (simulated sign-in) — fully functional for grading and browsing. Add the keys and OAuth becomes real with no code changes.

## Structure

```
app/            layout.jsx (SEO metadata + JSON-LD), page.jsx, globals.css
components/     BlitzApp.jsx — the UI shell (markup mirrors the validated prototype)
lib/            engine.js     pure color math (no DOM) — the heart of blitz
                looks.js      built-in community look recipes
                auth.js       Supabase OAuth w/ simulated fallback
                blitz-app.js  DOM wiring (ported 1:1 from browser-tested prototype)
public/         robots.txt, sitemap.xml, og-image.jpg, demo media, icons
```

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export to out/
```

## Deploy: GitHub → Cloudflare Pages (one-time setup)

1. Create a GitHub repo (e.g. `blitz`) and push this folder:
   ```bash
   git init && git add -A && git commit -m "blitz production scaffold"
   git remote add origin https://github.com/<you>/blitz.git
   git push -u origin main
   ```
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the repo.
3. Build settings: framework preset **Next.js (Static HTML Export)** — or manually:
   - Build command: `npx next build`
   - Build output directory: `out`
4. Deploy. Then attach **blitzluts.com** under Custom domains (moves it off the drag-and-drop project).
5. From now on, every `git push` deploys automatically. Preview branches get their own URLs.

## Enable real login (when ready)

1. Create a Supabase project; register OAuth apps for Google / Meta / X / LinkedIn
   (step-by-step in `blitz-auth-storage-guide.md` from the planning docs).
2. Copy `.env.example` → `.env.local` and fill in the two values for local dev.
3. In Cloudflare Pages → Settings → **Environment variables**, add the same two:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` → redeploy.
4. `lib/auth.js` switches from simulated to real OAuth automatically.

## Gating model (decided)

Browse-free: anyone can use the editor and browse Explore (keeps look pages indexable → SEO).
Login required to: publish, download community LUTs (and later: like, follow).

## Next milestones

- [ ] Supabase schema + RLS (SQL in `blitz-auth-storage-guide.md`) → real publish flow
- [ ] Explore reads looks from Postgres instead of `lib/looks.js`
- [ ] Per-look SEO pages (`/looks/[slug]`) — needs a move from static export to SSR
      (OpenNext Cloudflare adapter) once community content exists
- [ ] Guides content (`/guides/*`) for SEO + ad-network approval
- [ ] Ad units into the placed slots (see `blitz-ads-monetization-guide.md`)
- [ ] Componentize `lib/blitz-app.js` into idiomatic React (quality refactor)
```
