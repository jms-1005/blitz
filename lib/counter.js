/* ============================================================
   "LUTs served" counter — backed by a Supabase table + RPC.

   One-time setup (Supabase dashboard → SQL Editor → run):

     create table if not exists counters (
       id text primary key,
       value bigint not null default 0
     );
     insert into counters (id, value) values ('luts_served', 0)
       on conflict (id) do nothing;

     alter table counters enable row level security;
     create policy "counters are public to read"
       on counters for select using (true);

     create or replace function increment_counter(counter_id text)
     returns bigint
     language sql
     security definer
     set search_path = public
     as $$
       update counters set value = value + 1
       where id = counter_id
       returning value;
     $$;

     grant execute on function increment_counter(text) to anon, authenticated;

   No update/insert policies on the table itself — the only write path
   is the +1 RPC, so nobody can set the counter to an arbitrary number.
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
