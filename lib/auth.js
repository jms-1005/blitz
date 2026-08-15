/* ============================================================
   blitz auth — real Supabase OAuth when env keys are present,
   simulated sign-in otherwise (so the app works before setup).

   To go live:
   1. Create a Supabase project, enable Google/Facebook/Twitter/
      LinkedIn (OIDC) providers (see blitz-auth-storage-guide.md).
   2. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
      in .env.local (dev) and Cloudflare Pages env vars (prod).
   That's it — this module switches to real OAuth automatically.
   ============================================================ */
import { supabase } from "./supabase";

export const PROVIDER_MAP = {
  Google: "google",
  Meta: "facebook",
  X: "twitter",
  LinkedIn: "linkedin_oidc",
};

export function createAuth() {
  if (supabase) {
    return {
      real: true,
      async signIn(providerLabel) {
        await supabase.auth.signInWithOAuth({
          provider: PROVIDER_MAP[providerLabel],
          options: { redirectTo: window.location.origin },
        });
      },
      async signOut() { await supabase.auth.signOut(); },
      onChange(cb) {
        supabase.auth.onAuthStateChange((_event, session) => {
          cb(session ? {
            id: session.user.id,
            name: session.user.user_metadata?.full_name
              ?? session.user.user_metadata?.name
              ?? session.user.email ?? "Member",
            provider: session.user.app_metadata?.provider ?? "",
          } : null);
        });
      },
    };
  }
  // ---- simulated fallback (beta mode, no keys configured) ----
  let user = null, listener = null;
  return {
    real: false,
    async signIn(providerLabel) {
      user = { id: "demo", name: "John", provider: providerLabel };
      listener?.(user);
    },
    async signOut() { user = null; listener?.(null); },
    onChange(cb) { listener = cb; cb(user); },
  };
}
