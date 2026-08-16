/* ============================================================
   "LUTs served" counter — backed by a Supabase table + RPC.

   Setup SQL lives in supabase/community-schema.sql (counters table +
   increment_counter RPC). Run that file once in the Supabase SQL Editor.

   The only write path is the +1 RPC, so the total can't be forged.
   ============================================================ */
import { supabase } from "./supabase";

export async function fetchLutsServed() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("counters").select("value").eq("id", "luts_served").single();
  if (error) return null;          // table not created yet → hide counter
  return data.value;
}

export async function incrementLutsServed() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("increment_counter", { counter_id: "luts_served" });
  if (error) return null;
  return data;                      // the new value
}
