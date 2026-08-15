# blitz — Community Milestone: setup & how it works

## 1. Run the schema (once, ~30 seconds)

Supabase dashboard → **SQL Editor → New query** → paste the entire contents of
`supabase/community-schema.sql` → **Run**.

It is idempotent (safe to re-run) and creates:

| Object | Purpose |
|---|---|
| `profiles` | one row per signed-in user; auto-created by a trigger on first sign-in, handle derived from email (`john.manoah@gmail.com` → `@johnmanoah`) |
| `looks` | published looks — stored as **recipes**, not LUT files |
| `likes` | who liked what, with atomic like/unlike RPCs |
| `like_look` / `unlike_look` / `increment_look_downloads` | the only write paths for counts, so they can't be forged |
| 12 house looks | the seed gallery, inserted as real rows owned by `@blitz` |

Then deploy the new build. That's the whole setup.

## 2. What a user can now do

1. Grade something (reference match or by remixing an existing look)
2. **Publish to community** → name, description, tags → it's live in Explore
3. Everyone browsing Explore sees it **rendered on their own image**
4. Signed-in users can like it; downloads and likes are counted per look
5. Anyone can Apply it, tweak it, and republish — lineage is recorded in `forked_from`

## 3. The architecture that makes this cheap

A published look is stored as a **recipe**: a few hundred bytes of JSON describing
either the reference-transfer statistics, a look's parameters, or a nested parent
recipe (a remix). The downloader's browser rebuilds the identical color function
and bakes the .cube locally.

Verified in testing: a **241-byte recipe reproduces a byte-identical 970 KB .cube**
— roughly 4,000× smaller than storing LUT files, with zero storage or egress cost
for the LUT itself. Nested remixes round-trip identically too.

```
recipe = {
  v: 1,
  base: { type: "reference", meanT[3], stdT[3], meanR[3], stdR[3] }
      | { type: "look", ops: {...} }
      | { type: "recipe", recipe: <parent> },     // a remix
  trims: { intensity, exposure, contrast, saturation, temperature, tint }
}
```

## 4. Security model (why the public anon key is safe)

- `looks` / `profiles` are world-readable (good for SEO), but insert/update/delete
  require `auth.uid() = owner` — you can only touch your own rows.
- Like counts and download counts are **only** mutable through `SECURITY DEFINER`
  functions that do `+1`/`-1`, so nobody can set a look to 10,000 likes.
- `likes` rows are readable only by their owner.
- House looks have `owner = null`, so no user account can edit or delete them.

## 5. Resilience

- Every database read races a 5-second timeout.
- Explore paints the bundled house looks **instantly**, then swaps in community
  looks when they arrive — the gallery is never blank, even offline.
- If the schema hasn't been run, publishing shows a friendly message and
  everything else keeps working.

## 6. Feedback → HubSpot

The star-rating widget posts to the HubSpot Forms API (portal `343536533`,
form `3bcf8dc6-afda-40df-b1a5-4523002fd715`) using blitz's own UI — no HubSpot
script is embedded. It sends `rating` and `message`, plus `firstname`/`email`
when provided; if those two aren't on the form, it retries automatically with
just `rating` + `message`. Ratings are also recorded in Google Analytics as
`feedback_rating`, and Supabase acts as a fallback store if HubSpot is unreachable.

## 7. Worth doing soon

- **Moderation**: add a report button and a `hidden boolean` column you can flip
  from the dashboard before the gallery gets big.
- **Dedupe**: compare recipes on publish to reject near-identical republishes.
- **Per-look SEO pages** (`/looks/[slug]`): the biggest remaining growth lever —
  needs a move from static export to server rendering.
