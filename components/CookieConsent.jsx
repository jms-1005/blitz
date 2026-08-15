"use client";

import { useEffect, useState } from "react";

/* Cookie consent banner — gates Google Analytics via Consent Mode v2.
   GA loads with analytics_storage denied (no cookies set); accepting
   flips consent to granted. Choice persists in localStorage. */

const KEY = "blitz-cookie-consent"; // "granted" | "denied"

function applyConsent(granted) {
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {
      analytics_storage: granted ? "granted" : "denied",
    });
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let stored = null;
    try { stored = localStorage.getItem(KEY); } catch { /* private mode */ }
    if (stored === "granted") applyConsent(true);
    else if (stored !== "denied") setVisible(true);
  }, []);

  function choose(granted) {
    try { localStorage.setItem(KEY, granted ? "granted" : "denied"); } catch { /* ignore */ }
    applyConsent(granted);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="cookiebar" role="region" aria-label="Cookie consent">
      <p>
        blitz uses one optional analytics cookie (Google Analytics) to count visits
        and LUT exports. Your photos and videos are never uploaded either way.{" "}
        <a href="/privacy">Privacy policy</a>
      </p>
      <div className="cookiebar-actions">
        <button className="primary" onClick={() => choose(true)}>Accept</button>
        <button onClick={() => choose(false)}>Decline</button>
      </div>
    </div>
  );
}
