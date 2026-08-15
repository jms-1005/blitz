/* ============================================================
   Feedback → HubSpot Forms API.

   We do NOT embed HubSpot's form script — blitz's own UI collects the
   data and posts it to the Forms submission endpoint, so the widget
   keeps the site's design and adds no third-party JS.

   Form:   3bcf8dc6-afda-40df-b1a5-4523002fd715  (portal 343536533, na3)
   Fields: rating (number), message (text), firstname, email

   If the form doesn't contain firstname/email, HubSpot rejects unknown
   fields — so we retry automatically with just rating + message.
   Supabase is used only as a fallback store if HubSpot is unreachable.
   ============================================================ */
import { supabase } from "./supabase";

const PORTAL_ID = "343536533";
const FORM_ID = "3bcf8dc6-afda-40df-b1a5-4523002fd715";
const ENDPOINT = `https://api-na3.hsforms.com/submissions/v3/integration/submit/${PORTAL_ID}/${FORM_ID}`;

export const feedbackConfigured = () => Boolean(FORM_ID);

const F = (name, value) => ({ objectTypeId: "0-1", name, value: String(value) });

async function postToHubSpot(fields) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields,
      context: {
        pageUri: window.location.href,
        pageName: document.title,
      },
    }),
  });
  return res;
}

export async function submitFeedback({ rating, name, email, message }) {
  // rating always lands in analytics regardless of network outcome
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "feedback_rating", { rating });
  }

  const core = [F("rating", rating)];
  if (message) core.push(F("message", message));

  const withContact = [...core];
  if (name) withContact.push(F("firstname", name));
  if (email) withContact.push(F("email", email));

  try {
    let res = await postToHubSpot(withContact);
    // 400 = a submitted field isn't on the form; retry with the two known ones
    if (!res.ok && res.status === 400 && withContact.length > core.length) {
      res = await postToHubSpot(core);
    }
    if (res.ok) return { ok: true, via: "hubspot" };
  } catch { /* network blocked — fall through to backup */ }

  // fallback: keep the response rather than lose it
  if (supabase) {
    const { error } = await supabase.from("feedback").insert({
      rating,
      name: name || null,
      email: email || null,
      message: message || null,
      page: window.location.pathname,
    });
    if (!error) return { ok: true, via: "supabase" };
  }
  return { ok: false };
}
