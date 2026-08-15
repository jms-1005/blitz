/* ============================================================
   Community data layer — published looks, likes, downloads.
   Requires supabase/community-schema.sql to have been run once.
   Every function degrades to null/false if the DB isn't reachable,
   so the app keeps working offline with the house looks.
   ============================================================ */
import { supabase } from "./supabase";
import { slugify } from "./looks";

/* Never let a slow or unreachable database freeze the UI — every read
   races a timeout and falls back to the bundled house looks. */
const READ_TIMEOUT_MS = 5000;
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms)),
  ]);
}

/** Newest + most-liked published looks. Returns null if unavailable. */
export async function fetchCommunityLooks(limit = 60) {
  if (!supabase) return null;
  const query = supabase
    .from("looks")
    .select("id, name, slug, description, tags, recipe, likes, downloads, house, author_handle, forked_from, created_at")
    .order("likes", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .then(({ data, error }) => (error ? null : data));
  return withTimeout(query, READ_TIMEOUT_MS, null);
}

/** Look ids the signed-in user has liked. */
export async function fetchMyLikes() {
  if (!supabase) return new Set();
  const query = supabase.from("likes").select("look_id")
    .then(({ data, error }) => (error || !data ? new Set() : new Set(data.map(r => r.look_id))));
  return withTimeout(query, READ_TIMEOUT_MS, new Set());
}

export async function publishLook({ name, description, tags, recipe, forkedFrom, ownerId, handle }) {
  if (!supabase) return { ok: false, error: "Not connected" };
  const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
  const { data, error } = await supabase
    .from("looks")
    .insert({
      owner: ownerId,
      author_handle: handle || "creator",
      name,
      slug,
      description,
      tags,
      recipe,
      forked_from: forkedFrom || null,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, look: data };
}

export async function setLike(lookId, liked) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(liked ? "like_look" : "unlike_look", { target: lookId });
  if (error) return null;
  return data;                       // new like count
}

export async function noteLookDownload(lookId) {
  if (!supabase) return;
  await supabase.rpc("increment_look_downloads", { target: lookId }).catch(() => {});
}

/** The signed-in user's profile row (handle used as author byline). */
export async function fetchProfile(userId) {
  if (!supabase || !userId) return null;
  const query = supabase
    .from("profiles").select("handle, display_name").eq("id", userId).single()
    .then(({ data, error }) => (error ? null : data));
  return withTimeout(query, READ_TIMEOUT_MS, null);
}
