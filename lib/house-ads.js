/* House ads - cross-promotion across John's own properties.

   Deliberately dependency-free and self-contained so this file can be dropped
   into any of the sites unchanged: no cookies, no third-party script, no
   network request, no build step. The only outside thing it touches is
   window.gtag, and only if it already exists (consent-gated upstream).

   To reuse elsewhere: copy this file, set SITE below to that site's key so it
   never advertises itself, and call mountHouseAds() once after the DOM exists.

   Creatives are plain text on purpose. No images means nothing to load, no
   layout shift, and no colour entering a black-and-white UI. */

const SITE = "blitz"; // this site's key - excluded from its own inventory

/* weight is a relative frequency, not a percentage. Raise it to show a
   creative more often; 0 retires it without deleting it. */
export const HOUSE_ADS = [
  {
    key: "johnmanoah",
    href: "https://johnmanoah.com/",
    label: "Also by the maker of blitz",
    title: "Original scores for your footage",
    body: "Film composition, background scores and documentary music from John Manoah.",
    cta: "Listen to the music",
    weight: 1,
  },
  {
    key: "lampstand",
    href: "https://lampstand.school/",
    label: "Also by the maker of blitz",
    title: "Build a career with AI in 12 weeks",
    body: "No coding background needed. Ship real applications by week eight.",
    cta: "See the program",
    weight: 1,
  },
  {
    key: "xchng",
    href: "https://xchng.ca/",
    label: "Also by the maker of blitz",
    title: "100% off. Everything. Always.",
    body: "A barter marketplace for Vancouver, Abbotsford and Chilliwack. Pay in stuff you already own.",
    cta: "List an item free",
    weight: 1,
  },
  {
    key: "boaz",
    href: "https://boaz.club/",
    label: "Also by the maker of blitz",
    title: "Your Airbnb in farming",
    body: "Rent a heated greenhouse plot in the Fraser Valley and grow food year round.",
    cta: "Reserve a spot",
    weight: 1,
  },
  {
    key: "bli",
    href: "https://biblicalleadershipinstitute.org/",
    label: "Also by the maker of blitz",
    title: "Leadership, taught with AI",
    body: "The Biblical Leadership Institute builds AI tools and teaches students to use them.",
    cta: "Visit the institute",
    weight: 1,
  },
];

/* Weighted pick. Returns null rather than throwing when the pool is empty,
   so a mis-set SITE degrades to an empty slot instead of a broken page. */
function pick(pool) {
  const total = pool.reduce((sum, ad) => sum + (ad.weight > 0 ? ad.weight : 0), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const ad of pool) {
    if (!(ad.weight > 0)) continue;
    r -= ad.weight;
    if (r <= 0) return ad;
  }
  return pool[pool.length - 1];
}

/* Weighted draw without replacement. A plain shuffle would silently ignore
   the weights whenever inventory outnumbers slots, which is the normal case
   here (five creatives, two slots), so weight has to be honoured during the
   draw and not just in the single-pick path. */
function drawDistinct(pool, count) {
  const remaining = pool.slice();
  const out = [];
  while (out.length < count && remaining.length) {
    const ad = pick(remaining);
    if (!ad) break;
    out.push(ad);
    remaining.splice(remaining.indexOf(ad), 1);
  }
  return out;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function render(slot, ad) {
  const a = document.createElement("a");
  a.className = "housead";
  a.href = ad.href;
  a.target = "_blank";
  a.rel = "noopener";
  /* The whole unit is one link, so the inner text is aria-hidden and the link
     carries a single composed label. Otherwise a screen reader reads the
     wordmark, the headline, the body and the CTA as four separate things. */
  a.setAttribute("aria-label", ad.title + ". " + ad.body + " " + ad.cta + ", opens in a new tab.");
  a.innerHTML =
    '<span class="housead-label" aria-hidden="true">' + escapeHtml(ad.label) + '</span>' +
    '<span class="housead-body" aria-hidden="true">' +
      '<span class="housead-title">' + escapeHtml(ad.title) + '</span>' +
      '<span class="housead-text">' + escapeHtml(ad.body) + '</span>' +
      '<span class="housead-cta">' + escapeHtml(ad.cta) + '</span>' +
    '</span>';
  a.addEventListener("click", () => {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "house_ad_click", {
        destination: ad.key,
        slot: slot.dataset.houseAd || "",
      });
    }
  });
  slot.textContent = "";
  slot.appendChild(a);
}

/* Fills every [data-house-ad] element on the page. Safe to call more than
   once; each call re-rolls the creatives. */
export function mountHouseAds(root) {
  if (typeof document === "undefined") return;
  const scope = root || document;
  const slots = Array.from(scope.querySelectorAll("[data-house-ad]"));
  if (!slots.length) return;

  const pool = HOUSE_ADS.filter(ad => ad.key !== SITE && ad.weight > 0);
  if (!pool.length) return;

  /* With enough inventory, show a different property in each slot. Two ads
     for the same site on one screen reads as a bug. Below that, repeats are
     unavoidable, so fall back to independent weighted picks. */
  if (pool.length >= slots.length) {
    drawDistinct(pool, slots.length).forEach((ad, i) => render(slots[i], ad));
  } else {
    slots.forEach(slot => {
      const ad = pick(pool);
      if (ad) render(slot, ad);
    });
  }
}
