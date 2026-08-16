# CLAUDE.md — working notes for blitz

Guidance for Claude (and any collaborator) working in this repo.
Product/strategy context lives in the project kit docs; this file covers *how the code works
and how it ships*.

## What this is

**blitz** (blitzluts.com) — free in-browser color grading + LUT creator community. Drop in a
photo/video plus a reference image; blitz matches the colors and exports a standard `.cube`
LUT for Resolve, Premiere, Final Cut, Photoshop, Lightroom.

Solo founder: John. The site is live.

## Commands

```bash
npm install
npm run dev      # local dev server on http://localhost:3004
npm run build    # static export → out/
```

There is no test suite and no linter configured. `npm run build` is the gate — it type-checks
and fully prerenders every route, so a clean build is a real signal.

## Non-negotiable constraints

Break any of these and you break the product, not just a file.

1. **All color processing is client-side.** User media never uploads. This is a privacy
   guarantee *and* a marketing message. Never propose server-side image processing.
2. **Looks are recipes, not LUT files.** A published look is ~250 bytes of JSON (reference
   statistics, look parameters, or a nested parent recipe for remixes); the downloader's
   browser rebuilds a byte-identical `.cube` locally. A 241-byte recipe reproduces a 970 KB
   `.cube` — ~4,000× smaller. This is why the community costs nearly nothing to run.
   Preserve this property in any engine change.
3. **One engine, one truth.** The preview renders *through the same baked 3D LUT* that gets
   exported — what you see is exactly what Resolve gets. Don't add a preview-only code path.
4. **Static export.** `next.config.mjs` sets `output: 'export'`, so there is no server at
   runtime: no API routes, no `getServerSideProps`, no middleware, no dynamic `[slug]` routes
   without `generateStaticParams`, no `next/image` optimization (`images.unoptimized` is on).
   Anything needing a server requires migrating to the OpenNext Cloudflare adapter first —
   that's a deliberate, separate decision, not a drive-by change.
5. **Browse-free gating.** Anyone can grade and browse Explore (keeps look pages indexable for
   SEO). Sign-in is required only to publish, like, and download community LUTs. Don't gate
   browsing.
6. **Brand is strictly black-and-white**, VSCO-minimal, letterspaced uppercase wordmark. The
   UI stays neutral so the user's image is the only color on screen.
7. **Accessibility is shipped, not aspirational.** Keyboard operable everywhere, ARIA
   semantics, WCAG AA contrast, zero axe-core violations. Keep it that way.

## Layout

```
app/          layout.jsx   SEO metadata + JSON-LD + GA4
              page.jsx, globals.css, privacy/page.jsx
components/   BlitzApp.jsx (UI shell), CookieConsent.jsx
lib/          engine.js      pure color math + recipe serialization — the crown jewel
              looks.js       12 house look recipes (offline fallback)
              auth.js        Supabase OAuth with simulated fallback
              community.js   published looks, likes, downloads (all reads time-boxed)
              counter.js     "LUTs served" counter
              feedback.js    HubSpot submission
              blitz-app.js   DOM wiring
              supabase.js    shared client
public/       robots.txt, sitemap.xml, og-image.jpg, demo media, icons
supabase/     community-schema.sql — run once in the Supabase SQL editor
```

### `lib/blitz-app.js` is vanilla DOM on purpose

It is not idiomatic React and that is deliberate: the interactions were fully browser-tested
as plain DOM in the prototype, so React renders the markup and this module brings it to life.
Componentizing it is a known future refactor, **not a bug** — don't "fix" it incidentally
while doing something else.

## Environment

`.env.local` (gitignored, local dev only):

```
NEXT_PUBLIC_SUPABASE_URL=https://mbqadyuhewgvyndggdzx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Both are `NEXT_PUBLIC_*`, so they are baked into the client bundle and are **public by
design** — the anon key is safe to expose; security comes from Supabase Row Level Security,
not key secrecy. Never put a service-role key in this repo.

**Without these vars the app runs in beta mode** — simulated sign-in, everything else fully
functional. `lib/auth.js` switches to real OAuth automatically once they're set. That means a
missing `.env.local` looks like working software, so if you're debugging auth, check the env
first.

Production sets the same two vars in Cloudflare Pages → Settings → Environment variables.

Other live services (already wired, no local setup needed): GA4 `G-FRW4FJCGK5` (consent-gated,
events `lut_export`, `community_lut_download`, `feedback_rating`, `look_published`); HubSpot
Forms portal `343536533`, form `3bcf8dc6-afda-40df-b1a5-4523002fd715`.

## Deploying

Cloudflare Pages is Git-connected to this repo:

| Setting | Value |
|---|---|
| Branch | `main` |
| Build command | `npx next build` |
| Output directory | `out` |

**Push to `main` → Cloudflare builds and deploys automatically.** Branches get preview URLs.
Run `npm run build` locally before pushing; a build that fails on Cloudflare fails after the
commit is already public.

## House style

- Verify things actually work rather than assuming. If you write code, reason about how it
  fails, and say plainly what you did and did not test.
- Flag trade-offs explicitly instead of quietly picking — especially anything touching SEO,
  privacy, or the minimal design.
- Every network call gets a fallback so the app degrades honestly and never breaks.
- Be concise. Step-by-step when John is working in a dashboard or terminal.

## Known state

Not yet built: Meta/X/LinkedIn OAuth (buttons exist, apps unregistered), ads (slots placed,
AdSense not applied for), `/guides/*` content, about/contact pages, per-look SEO pages
(`/looks/[slug]` — needs server rendering), moderation tools, recipe dedupe on publish.

**Riskiest untested assumption:** grade quality on real, mismatched photos. The math is
verified and the demos are synthetic; nobody has confirmed the reference transfer looks *good*
on real-world pairs (portraits vs landscapes, low light, mismatched scenes). If it
disappoints, the fix is a stronger algorithm — per-luminance-zone matching, hue-clustered
transfer — not more features.
