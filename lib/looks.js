/* House looks — the seed gallery.
   Each carries its `ops` so it can be serialized into a recipe when a user
   remixes and republishes it. These same 12 are seeded into the Supabase
   `looks` table by the setup SQL; this array is the offline fallback. */
import { makeLook } from "./engine";

const defs = [
  { name: "Teal & Orange",   ops: { contrast: 0.18, sat: 1.12, splitA: [-0.012, 0.012], splitB: [-0.045, 0.045] } },
  { name: "Golden Hour",     ops: { lift: 0.03, contrast: 0.06, sat: 1.08, warm: 0.045, splitB: [0.01, 0.035], splitA: [0.006, 0.01] } },
  { name: "Print Film 2383", ops: { contrast: 0.22, sat: 1.05, gainDown: 0.04, splitA: [-0.006, 0.004], splitB: [-0.02, 0.018], warm: 0.008 } },
  { name: "Noir",            ops: { mono: true, contrast: 0.32, lift: -0.01 } },
  { name: "Bleach Bypass",   ops: { mono: true, monoKeep: 0.45, contrast: 0.3, gainDown: 0.03 } },
  { name: "Pastel Air",      ops: { lift: 0.09, contrast: -0.12, sat: 0.82, warm: 0.012, tint: 0.008 } },
  { name: "Cyber Neon",      ops: { contrast: 0.2, sat: 1.3, splitA: [0.02, -0.008], splitB: [-0.05, -0.012], gainDown: 0.02 } },
  { name: "Moody Forest",    ops: { contrast: 0.1, sat: 0.9, gainDown: 0.05, splitA: [-0.022, -0.006], splitB: [0.004, 0.014] } },
  { name: "Vintage Fade",    ops: { lift: 0.11, contrast: -0.06, sat: 0.88, warm: 0.02, splitB: [0.016, 0.008] } },
  { name: "Cream Portrait",  ops: { lift: 0.05, contrast: 0.04, sat: 0.95, warm: 0.018, tint: 0.012 } },
  { name: "Arctic Blue",     ops: { contrast: 0.12, sat: 0.96, warm: -0.035, splitA: [-0.008, 0], splitB: [-0.03, -0.01] } },
  { name: "Sepia Dust",      ops: { mono: true, monoKeep: 0.15, lift: 0.07, contrast: 0.02, warm: 0.035, tint: 0.01 } },
];

export const slugify = s => s.toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

/* Shaped like rows from the database so Explore renders either identically. */
export const LOOKS = defs.map(d => ({
  id: "house-" + slugify(d.name),
  house: true,
  name: d.name,
  slug: slugify(d.name),
  author_handle: "blitz",
  likes: 0,
  downloads: 0,
  recipe: { v: 1, base: { type: "look", ops: d.ops }, trims: null },
  fn: makeLook(d.ops),
  ops: d.ops,
}));
