/* ============================================================
   blitz app wiring — vanilla-DOM logic ported from the validated
   prototype, driven by the React shell in components/BlitzApp.jsx.
   (Deliberate architecture: the engine + interactions were fully
   browser-tested as plain DOM code; React renders the markup and
   this module brings it to life. Componentizing further is a
   later refactor, not a launch blocker.)
   ============================================================ */
import {
  rgbToOklab, makeReferenceLook, makePipeline, recipeToFn,
  bakeFnToLut, applyLut, lutToCube,
} from "./engine";
import { LOOKS, slugify } from "./looks";
import { createAuth } from "./auth";
import { fetchLutsServed, incrementLutsServed } from "./counter";
import { submitFeedback } from "./feedback";
import {
  fetchCommunityLooks, fetchMyLikes, publishLook, setLike,
  noteLookDownload, fetchProfile,
} from "./community";

const DEMO_TARGET = "/demo-target.jpg";
const DEMO_REF = "/demo-reference.jpg";
const IMG_PREVIEW_MAX = 1280;
const VID_PREVIEW_MAX = 960;
const STATS_MAX = 256;

export function initBlitz() {
  const $ = id => document.getElementById(id);
  if (!$("dropTarget") || $("dropTarget")._wired) return; // hot-reload guard
  $("dropTarget")._wired = true;

  const auth = createAuth();
  const state = {
    target: null, ref: null,
    baseFn: null, baseLabel: "reference",
    lut: null, lutDirty: true,
    playing: false,
    previewW: 0, previewH: 0,
    exploreDirty: true, exploreBase: null,
    user: null, profile: null,
    baseDescriptor: null, forkedFrom: null,
    gallery: null, galleryLoaded: false, myLikes: new Set(),
  };

  /* ---------- helpers ---------- */
  function mediaSize(el) {
    return el.videoWidth ? { w: el.videoWidth, h: el.videoHeight } : { w: el.naturalWidth, h: el.naturalHeight };
  }
  function fmtTime(t) {
    t = Math.max(0, t || 0);
    return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0");
  }
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  function download(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  /* ---------- stats ---------- */
  function computeStats(el) {
    const { w, h } = mediaSize(el);
    const c = document.createElement("canvas");
    const scale = Math.min(1, STATS_MAX / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(el, 0, 0, c.width, c.height);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const n = c.width * c.height;
    const sum = [0, 0, 0], sum2 = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      const lab = rgbToOklab(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      for (let k = 0; k < 3; k++) { sum[k] += lab[k]; sum2[k] += lab[k] * lab[k]; }
    }
    const mean = sum.map(s => s / n);
    const std = sum2.map((s, k) => Math.sqrt(Math.max(1e-8, s / n - mean[k] * mean[k])));
    return { mean, std };
  }

  /* ---------- pipeline / preview ---------- */
  function getParams() {
    return {
      intensity: +$("sIntensity").value / 100,
      exposure: +$("sExposure").value / 100,
      contrast: +$("sContrast").value / 100,
      saturation: +$("sSaturation").value / 100,
      temperature: +$("sTemperature").value / 100,
      tint: +$("sTint").value / 100,
    };
  }
  function bakeIfDirty() {
    if (state.lutDirty || !state.lut) {
      state.lut = bakeFnToLut(makePipeline(state.baseFn, getParams()));
      state.lutDirty = false;
    }
  }
  function setupPreview() {
    const { el, kind } = state.target;
    const { w, h } = mediaSize(el);
    const maxSide = kind === "video" ? VID_PREVIEW_MAX : IMG_PREVIEW_MAX;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    state.previewW = Math.max(1, Math.round(w * scale));
    state.previewH = Math.max(1, Math.round(h * scale));
    $("canvasBefore").width = $("canvasAfter").width = state.previewW;
    $("canvasBefore").height = $("canvasAfter").height = state.previewH;
    $("transport").classList.toggle("active", kind === "video");
    $("btnImage").textContent = kind === "video" ? "Download graded frame" : "Download graded image";
    $("exportHint").innerHTML = kind === "video"
      ? "For video: export the .cube and drop it on your clip in Resolve, Premiere (Lumetri), or Final Cut — full-res video render happens in your editor."
      : "Works in DaVinci Resolve, Premiere Pro (Lumetri), Final Cut, Photoshop &amp; Lightroom Classic.";
  }
  function renderFrame() {
    if (!state.baseFn || !state.target) return;
    bakeIfDirty();
    const w = state.previewW, h = state.previewH;
    const bctx = $("canvasBefore").getContext("2d", { willReadFrequently: true });
    bctx.drawImage(state.target.el, 0, 0, w, h);
    const src = bctx.getImageData(0, 0, w, h);
    const actx = $("canvasAfter").getContext("2d");
    const out = actx.createImageData(w, h);
    applyLut(state.lut, src, out);
    actx.putImageData(out, 0, 0);
  }
  let rafPending = false;
  function render() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; renderFrame(); });
  }

  /* ---------- video transport ---------- */
  function playbackLoop() {
    if (!state.playing) return;
    const vid = state.target.el;
    renderFrame();
    $("sSeek").value = vid.duration ? Math.round(vid.currentTime / vid.duration * 1000) : 0;
    $("timeLabel").textContent = fmtTime(vid.currentTime) + " / " + fmtTime(vid.duration);
    if (vid.ended) { setPlaying(false); return; }
    if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(() => playbackLoop());
    else requestAnimationFrame(playbackLoop);
  }
  function setPlaying(on) {
    if (!state.target || state.target.kind !== "video") return;
    const vid = state.target.el;
    state.playing = on;
    $("btnPlay").textContent = on ? "Pause" : "Play";
    if (on) { vid.play().catch(() => setPlaying(false)); playbackLoop(); }
    else vid.pause();
  }
  $("btnPlay").addEventListener("click", () => setPlaying(!state.playing));
  $("sSeek").addEventListener("input", () => {
    if (!state.target || state.target.kind !== "video") return;
    const vid = state.target.el;
    if (state.playing) setPlaying(false);
    if (vid.duration) vid.currentTime = (+$("sSeek").value / 1000) * vid.duration;
  });

  /* ---------- exports ---------- */
  function exportCube() {
    bakeIfDirty();
    const name = ($("lutName").value.trim() || "blitz-look").replace(/[^\w\-]+/g, "-");
    download(name + ".cube", new Blob([lutToCube(state.lut, name)], { type: "text/plain" }));
    toast("LUT exported");
    if (window.gtag) window.gtag("event", "lut_export", { look: state.baseLabel });
    bumpLutCounter();
    noteExportForFeedback();
  }
  function exportImage() {
    bakeIfDirty();
    const el = state.target.el;
    const { w, h } = mediaSize(el);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(el, 0, 0);
    const src = ctx.getImageData(0, 0, w, h);
    const dst = ctx.createImageData(w, h);
    applyLut(state.lut, src, dst);
    ctx.putImageData(dst, 0, 0);
    c.toBlob(blob => {
      const name = ($("lutName").value.trim() || "blitz-look").replace(/[^\w\-]+/g, "-");
      download(name + ".png", blob);
      toast(state.target.kind === "video" ? "Frame exported at full resolution" : "Image exported at full resolution");
    }, "image/png");
  }

  /* ---------- media loading ---------- */
  function loadImageFromUrl(u) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res({ kind: "image", el: img });
      img.onerror = rej;
      img.src = u;
    });
  }
  function loadVideoFromUrl(u) {
    return new Promise((res, rej) => {
      const vid = document.createElement("video");
      vid.muted = true; vid.playsInline = true; vid.preload = "auto"; vid.loop = false;
      vid.onerror = () => rej(new Error("Could not decode this video — try an mp4 (H.264) or webm."));
      vid.onloadeddata = () => {
        const t = Math.min(0.5, (vid.duration || 0) * 0.1);
        const done = () => res({ kind: "video", el: vid });
        if (t > 0.01) { vid.onseeked = done; vid.currentTime = t; }
        else done();
      };
      vid.src = u;
    });
  }
  function frameThumb(el) {
    const { w, h } = mediaSize(el);
    const c = document.createElement("canvas");
    const scale = Math.min(1, 480 / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    c.getContext("2d").drawImage(el, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  }
  function wireDrop(el, kind) {
    const input = el.querySelector("input");
    el.addEventListener("click", () => input.click());
    el.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
    });
    input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0], kind); });
    el.addEventListener("dragover", e => { e.preventDefault(); el.classList.add("dragover"); });
    el.addEventListener("dragleave", () => el.classList.remove("dragover"));
    el.addEventListener("drop", e => {
      e.preventDefault(); el.classList.remove("dragover");
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0], kind);
    });
  }
  function handleFile(file, slot) {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) { toast("Please drop an image or video file"); return; }
    const u = URL.createObjectURL(file);
    const loader = isVideo ? loadVideoFromUrl(u) : loadImageFromUrl(u);
    if (isVideo) toast("Loading video…");
    loader.then(media => setMedia(media, slot)).catch(err => toast(err.message || "Could not load file"));
  }
  function setMedia(media, slot) {
    const dropEl = slot === "target" ? $("dropTarget") : $("dropRef");
    let thumb = dropEl.querySelector("img.thumb");
    if (!thumb) {
      thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.alt = slot === "target" ? "Your uploaded media" : "Reference look image";
      dropEl.prepend(thumb);
    }
    thumb.src = media.kind === "video" ? frameThumb(media.el) : media.el.src;
    dropEl.classList.add("hasimg");
    const labelB = dropEl.querySelector(".label b");
    if (media.kind === "video") {
      labelB.textContent = (slot === "target" ? "Your video" : "Reference video") + " · " + fmtTime(media.el.duration);
      toast("Video loaded");
    }
    if (slot === "target") { setPlaying(false); state.target = media; state.exploreDirty = true; }
    else state.ref = media;
    if (state.target && state.ref) {
      const st = computeStats(state.target.el), sr = computeStats(state.ref.el);
      state.baseFn = makeReferenceLook(st, sr);
      state.baseDescriptor = {
        type: "reference",
        meanT: st.mean, stdT: st.std, meanR: sr.mean, stdR: sr.std,
      };
      state.forkedFrom = null;
      setBaseLabel("reference");
    }
    startEditor();
  }
  function setBaseLabel(label) {
    state.baseLabel = label;
    $("gradeLabel").innerHTML = "Grade <span>· " + label + "</span>";
  }
  function startEditor() {
    if (!state.target || !state.baseFn) return;
    state.lutDirty = true;
    setupPreview();
    if (state.target.kind === "video") {
      const vid = state.target.el;
      $("timeLabel").textContent = fmtTime(vid.currentTime) + " / " + fmtTime(vid.duration);
      $("sSeek").value = vid.duration ? Math.round(vid.currentTime / vid.duration * 1000) : 0;
      if (!vid._blitzSeekWired) {
        vid._blitzSeekWired = true;
        vid.addEventListener("seeked", () => {
          if (!state.playing) {
            render();
            $("timeLabel").textContent = fmtTime(vid.currentTime) + " / " + fmtTime(vid.duration);
          }
        });
      }
    }
    $("workspace").classList.add("active");
    render();
  }

  /* ---------- auth (browse-free; login to publish/download community looks) ---------- */
  let authPendingAction = null;
  function updateUserChip() {
    const chip = $("userChip");
    if (state.user) {
      chip.innerHTML = `<span>via ${state.user.provider}</span><b>${state.user.name}</b><u id="signOut">Sign out</u>`;
      chip.querySelector("#signOut").addEventListener("click", async () => {
        await auth.signOut();
        toast("Signed out");
      });
    } else {
      chip.innerHTML = `<span class="tag" style="position:static">${auth.real ? "" : "beta"}</span><u id="signIn">Sign in</u>`;
      chip.querySelector("#signIn").addEventListener("click", () => openAuth(null,
        "Sign in to publish looks, follow creators, and download community LUTs."));
    }
  }
  auth.onChange(user => {
    state.user = user;
    updateUserChip();
    if (!user) {
      state.profile = null;
      state.myLikes = new Set();
      return;
    }
    // unblock the user's pending action first; profile/likes load behind it
    const act = authPendingAction; authPendingAction = null;
    if (act) act();
    (async () => {
      state.profile = await fetchProfile(user.id);
      state.myLikes = await fetchMyLikes();
      if ($("viewExplore").classList.contains("active")) buildExplore(true);
    })();
  });
  let authPrevFocus = null;
  function openAuth(pendingAction, reason) {
    authPendingAction = pendingAction;
    if (reason) $("authReason").textContent = reason;
    authPrevFocus = document.activeElement;
    $("authModal").classList.add("show");
    $("authModal").querySelector("[data-provider]").focus();
  }
  function closeAuth() {
    $("authModal").classList.remove("show");
    if (authPrevFocus && authPrevFocus.focus) authPrevFocus.focus();
  }
  $("authClose").addEventListener("click", closeAuth);
  $("authModal").addEventListener("click", e => { if (e.target === $("authModal")) closeAuth(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("authModal").classList.contains("show")) closeAuth();
  });
  document.querySelectorAll("#authModal [data-provider]").forEach(btn => {
    btn.addEventListener("click", async () => {
      closeAuth();
      await auth.signIn(btn.dataset.provider);
      if (!auth.real) toast("Signed in with " + btn.dataset.provider + " (simulated)");
    });
  });
  function requireAuth(reason, act) {
    if (state.user) { act(); return; }
    openAuth(act, reason);
  }

  /* ---------- explore (open to everyone — SEO-friendly) ----------
     Looks come from Supabase when reachable; the bundled house looks are
     the offline fallback so the gallery is never empty. */
  async function ensureExploreBase() {
    if (!state.target) {
      const demo = await loadImageFromUrl(DEMO_TARGET);
      state.exploreBase = demo.el;
      $("exploreSub").firstChild.textContent = "No image loaded yet — showing the demo shot. Upload yours in Edit, or ";
      return;
    }
    state.exploreBase = state.target.el;
    $("exploreSub").firstChild.textContent = "Every thumbnail below is your shot, graded live in your browser. ";
  }
  function lookFn(look) {
    if (look.fn) return look.fn;                       // house fallback
    return (look.fn = recipeToFn(look.recipe));        // published recipe
  }
  async function loadGallery() {
    const rows = await fetchCommunityLooks();
    if (rows && rows.length) {
      state.gallery = rows;
      state.myLikes = state.user ? await fetchMyLikes() : new Set();
      return true;
    }
    return false;
  }
  async function buildExplore(force) {
    if (!force && !state.exploreDirty && $("lookGrid").children.length) return;
    await ensureExploreBase();
    // paint immediately with whatever we have — the gallery is never blank
    renderGallery(state.gallery || LOOKS);
    state.exploreDirty = false;
    if (!state.galleryLoaded || force) {
      state.galleryLoaded = true;
      loadGallery().then(got => { if (got) renderGallery(state.gallery); });
    }
  }
  function renderGallery(looks) {
    state.gallery = looks;
    const el = state.exploreBase;
    if (!el) return;
    const { w, h } = mediaSize(el);
    const scale = Math.min(1, 420 / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale)), th = Math.max(1, Math.round(h * scale));
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = tw; srcCanvas.height = th;
    const sctx = srcCanvas.getContext("2d", { willReadFrequently: true });
    sctx.drawImage(el, 0, 0, tw, th);
    const src = sctx.getImageData(0, 0, tw, th);

    const grid = $("lookGrid");
    grid.innerHTML = "";
    looks.forEach((look, idx) => {
      const card = document.createElement("div");
      card.className = "card";
      const cv = document.createElement("canvas");
      cv.width = tw; cv.height = th;
      cv.setAttribute("role", "img");
      cv.setAttribute("aria-label", `Your image with the ${look.name} look applied`);
      card.appendChild(cv);
      const meta = document.createElement("div");
      meta.className = "meta";
      const liked = state.myLikes && state.myLikes.has(look.id);
      meta.innerHTML =
        `<div class="name">${escapeHtml(look.name)}<small>@${escapeHtml(look.author_handle || "blitz")}</small></div>` +
        (look.description ? `<div class="desc">${escapeHtml(look.description)}</div>` : "") +
        `<div class="stats">` +
          `<button class="likebtn${liked ? " liked" : ""}" data-act="like" aria-pressed="${liked}" ` +
          `aria-label="Like ${escapeHtml(look.name)}">${liked ? "♥" : "♡"} <span data-likes>${look.likes ?? 0}</span></button>` +
          `<span>↓ ${look.downloads ?? 0}</span>` +
        `</div>` +
        `<div class="actions"><button data-act="apply">Apply</button><button data-act="cube">.cube</button></div>`;
      card.appendChild(meta);
      grid.appendChild(card);

      meta.querySelector('[data-act="apply"]').addEventListener("click", () => applyLook(idx));
      meta.querySelector('[data-act="like"]').addEventListener("click", e => {
        const btn = e.currentTarget;
        requireAuth("Sign in to like looks — it helps creators get discovered.", async () => {
          if (look.house && String(look.id).startsWith("house-")) { toast("Likes need the community database"); return; }
          const nowLiked = !state.myLikes.has(look.id);
          const count = await setLike(look.id, nowLiked);
          if (count == null) { toast("Couldn't save that like"); return; }
          if (nowLiked) state.myLikes.add(look.id); else state.myLikes.delete(look.id);
          look.likes = count;
          btn.classList.toggle("liked", nowLiked);
          btn.setAttribute("aria-pressed", String(nowLiked));
          btn.firstChild.textContent = nowLiked ? "♥ " : "♡ ";
          btn.querySelector("[data-likes]").textContent = count;
        });
      });
      meta.querySelector('[data-act="cube"]').addEventListener("click", () => {
        requireAuth("Sign in to download community LUTs — it's free.", () => {
          const fileName = (look.slug || slugify(look.name));
          const lut = look._lut || (look._lut = bakeFnToLut(lookFn(look)));
          download("blitz-" + fileName + ".cube", new Blob([lutToCube(lut, look.name)], { type: "text/plain" }));
          toast("“" + look.name + "” by @" + (look.author_handle || "blitz") + " downloaded");
          if (window.gtag) window.gtag("event", "community_lut_download", { look: look.name });
          bumpLutCounter();
          if (!String(look.id).startsWith("house-")) noteLookDownload(look.id);
        });
      });
      setTimeout(() => {
        const lut = look._lut || (look._lut = bakeFnToLut(lookFn(look)));
        const ctx = cv.getContext("2d");
        const out = ctx.createImageData(tw, th);
        applyLut(lut, src, out);
        ctx.putImageData(out, 0, 0);
      }, idx * 30);
      if (idx === 5) {
        const ad = document.createElement("div");
        ad.className = "card adcard adslot";
        ad.innerHTML = `<div class="adlabel">Ad space</div><div class="adbody"><a href="mailto:abel.manoah@gmail.com?subject=Advertising%20on%20blitzluts.com%20-%20Native%20card">Contact us for advertising opportunities</a><span>Native card</span></div>`;
        grid.appendChild(ad);
      }
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  async function applyLook(idx) {
    const look = state.gallery[idx];
    if (!state.target) {
      const demo = await loadImageFromUrl(DEMO_TARGET);
      setMediaSilently(demo);
    }
    state.baseFn = lookFn(look);
    // remixing: the parent recipe becomes this grade's base, lineage recorded
    state.baseDescriptor = look.recipe
      ? { type: "recipe", recipe: look.recipe }
      : { type: "look", ops: look.ops };
    state.forkedFrom = String(look.id).startsWith("house-") ? null : look.id;
    setBaseLabel(look.name + " @" + (look.author_handle || "blitz"));
    $("sIntensity").value = 100; $("oIntensity").textContent = "100%";
    $("lutName").value = "blitz-" + (look.slug || slugify(look.name)) + "-remix";
    switchTab("edit");
    startEditor();
    $("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
    toast("“" + look.name + "” applied — tweak it and make it yours");
  }
  function setMediaSilently(media) {
    state.target = media;
    state.exploreDirty = true;
    const dropEl = $("dropTarget");
    let thumb = dropEl.querySelector("img.thumb");
    if (!thumb) {
      thumb = document.createElement("img");
      thumb.className = "thumb";
      thumb.alt = "Your uploaded media";
      dropEl.prepend(thumb);
    }
    thumb.src = media.el.src;
    dropEl.classList.add("hasimg");
  }
  $("exploreUpload").addEventListener("click", () => {
    switchTab("edit");
    $("dropTarget").querySelector("input").click();
  });

  /* ---------- tabs ---------- */
  function switchTab(which) {
    const edit = which === "edit";
    $("tabEdit").classList.toggle("active", edit);
    $("tabExplore").classList.toggle("active", !edit);
    $("tabEdit").setAttribute("aria-selected", String(edit));
    $("tabExplore").setAttribute("aria-selected", String(!edit));
    $("viewEdit").classList.toggle("active", edit);
    $("viewExplore").classList.toggle("active", !edit);
    if (!edit) { if (state.playing) setPlaying(false); buildExplore(); }
  }
  $("tabEdit").addEventListener("click", () => switchTab("edit"));
  $("tabExplore").addEventListener("click", () => switchTab("explore"));

  /* ---------- A/B compare ---------- */
  (function () {
    const wrap = $("compareWrap");
    const divider = $("divider");
    let splitPct = 50;
    function applySplit(pct) {
      splitPct = Math.max(0, Math.min(100, pct));
      wrap.style.setProperty("--split", splitPct + "%");
      divider.setAttribute("aria-valuenow", Math.round(splitPct));
    }
    function setSplit(clientX) {
      const rect = wrap.getBoundingClientRect();
      applySplit((clientX - rect.left) / rect.width * 100);
    }
    let dragging = false;
    wrap.addEventListener("pointerdown", e => { dragging = true; setSplit(e.clientX); wrap.setPointerCapture(e.pointerId); });
    wrap.addEventListener("pointermove", e => { if (dragging) setSplit(e.clientX); });
    wrap.addEventListener("pointerup", () => dragging = false);
    // keyboard: arrow keys move the divider; Home/End jump
    divider.addEventListener("keydown", e => {
      if (e.key === "ArrowLeft") { e.preventDefault(); applySplit(splitPct - 5); }
      else if (e.key === "ArrowRight") { e.preventDefault(); applySplit(splitPct + 5); }
      else if (e.key === "Home") { e.preventDefault(); applySplit(0); }
      else if (e.key === "End") { e.preventDefault(); applySplit(100); }
    });
  })();

  /* ---------- controls ---------- */
  ["Intensity", "Exposure", "Contrast", "Saturation", "Temperature", "Tint"].forEach(name => {
    const s = $("s" + name), o = $("o" + name);
    s.addEventListener("input", () => {
      o.textContent = name === "Intensity" ? s.value + "%" : s.value;
      state.lutDirty = true;
      if (!state.playing) render();
    });
  });
  $("btnReset").addEventListener("click", () => {
    $("sIntensity").value = 80; $("oIntensity").textContent = "80%";
    ["Exposure", "Contrast", "Saturation", "Temperature", "Tint"].forEach(n => {
      $("s" + n).value = 0; $("o" + n).textContent = "0";
    });
    state.lutDirty = true;
    if (!state.playing) render();
  });
  $("btnLut").addEventListener("click", exportCube);
  $("btnImage").addEventListener("click", exportImage);
  /* ---------- publish ---------- */
  let pubPrevFocus = null;
  function openPublish() {
    if (!state.baseFn || !state.baseDescriptor) {
      toast("Make a grade first — then publish it");
      return;
    }
    pubPrevFocus = document.activeElement;
    const suggested = ($("lutName").value || "").replace(/^blitz-/, "").replace(/-remix$/, "").replace(/[-_]+/g, " ").trim();
    $("pubName").value = suggested.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 60);
    $("publishModal").classList.add("show");
    $("pubName").focus();
  }
  function closePublish() {
    $("publishModal").classList.remove("show");
    if (pubPrevFocus && pubPrevFocus.focus) pubPrevFocus.focus();
  }
  $("btnPublish").addEventListener("click", () => {
    requireAuth("Publishing is for members. Sign in to share your look with the community.", openPublish);
  });
  $("pubCancel").addEventListener("click", closePublish);
  $("publishModal").addEventListener("click", e => { if (e.target === $("publishModal")) closePublish(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && $("publishModal").classList.contains("show")) closePublish();
  });
  $("pubSubmit").addEventListener("click", async () => {
    const name = $("pubName").value.trim();
    const description = $("pubDesc").value.trim();
    const tags = $("pubTags").value.split(",").map(t => slugify(t.trim())).filter(Boolean).slice(0, 6);
    if (name.length < 3) { toast("Give your look a name"); $("pubName").focus(); return; }
    if (description.length < 20) { toast("Add a short description — it's the look's page copy"); $("pubDesc").focus(); return; }
    $("pubSubmit").disabled = true;
    const recipe = { v: 1, base: state.baseDescriptor, trims: getParams() };
    const res = await publishLook({
      name, description, tags, recipe,
      forkedFrom: state.forkedFrom,
      ownerId: state.user.id,
      handle: state.profile?.handle || "creator",
    });
    $("pubSubmit").disabled = false;
    if (!res.ok) {
      toast(res.error?.includes("relation") ? "Community tables not set up yet" : "Couldn't publish — " + (res.error || "try again"));
      return;
    }
    closePublish();
    $("pubDesc").value = ""; $("pubTags").value = "";
    toast("Published — it's live in Explore");
    if (window.gtag) window.gtag("event", "look_published", { look: name });
    state.exploreDirty = true;
    await buildExplore(true);
    switchTab("explore");
  });
  $("btnDemo").addEventListener("click", async () => {
    const [t, r] = await Promise.all([loadImageFromUrl(DEMO_TARGET), loadImageFromUrl(DEMO_REF)]);
    setMedia(t, "target");
    setMedia(r, "ref");
    toast("Demo loaded — drag the divider, tweak, export");
  });

  wireDrop($("dropTarget"), "target");
  wireDrop($("dropRef"), "ref");
  updateUserChip();

  /* ---------- feedback widget ----------
     Shows ONCE per browser, triggered by whichever happens first:
       (a) the user's 2nd LUT export (they're clearly getting value), or
       (b) 3 minutes after their first slider interaction (deep fiddling).
     Dismissing or submitting stores the choice; it never nags again. */
  const FB_KEY = "blitz-feedback";
  let fbExports = 0;
  let fbTimer = null;
  let fbRating = 0;
  function fbSeen() {
    try { return Boolean(localStorage.getItem(FB_KEY)); } catch { return true; }
  }
  function fbMark(v) { try { localStorage.setItem(FB_KEY, v); } catch { /* ignore */ } }
  function resetFeedbackForm() {
    fbRating = 0;
    document.querySelectorAll("#starRow .star").forEach(s => {
      s.classList.remove("lit");
      s.setAttribute("aria-checked", "false");
    });
    $("feedbackMore").hidden = true;
    $("fbName").value = ""; $("fbEmail").value = ""; $("fbMessage").value = "";
    $("fbSubmit").disabled = false;
  }
  /* manual = opened from the footer link: always allowed, even if the
     automatic prompt was already shown or dismissed earlier. */
  function showFeedback(manual) {
    if (!manual && fbSeen()) return;
    if (!$("feedbackCard").hidden) return;
    if (manual) resetFeedbackForm();
    $("feedbackCard").hidden = false;
    $("feedbackCard").querySelector(".star").focus();
  }
  $("feedbackLink")?.addEventListener("click", () => {
    showFeedback(true);
    $("feedbackCard").scrollIntoView({ block: "nearest" });
  });
  function noteExportForFeedback() {
    fbExports++;
    if (fbExports >= 2 && !fbSeen()) setTimeout(showFeedback, 1200);
  }
  function noteFiddlingForFeedback() {
    if (fbTimer || fbSeen()) return;
    fbTimer = setTimeout(showFeedback, 3 * 60 * 1000);
  }
  $("feedbackClose").addEventListener("click", () => {
    $("feedbackCard").hidden = true;
    fbMark("dismissed");
  });
  document.querySelectorAll("#starRow .star").forEach(btn => {
    btn.addEventListener("click", () => {
      fbRating = +btn.dataset.star;
      document.querySelectorAll("#starRow .star").forEach(s => {
        s.classList.toggle("lit", +s.dataset.star <= fbRating);
        s.setAttribute("aria-checked", String(+s.dataset.star === fbRating));
      });
      $("feedbackMore").hidden = false;
    });
  });
  $("fbSubmit").addEventListener("click", () => {
    if (!fbRating) { toast("Pick a star rating first"); return; }
    const payload = {
      rating: fbRating,
      name: $("fbName").value.trim(),
      email: $("fbEmail").value.trim(),
      message: $("fbMessage").value.trim(),
    };
    // optimistic: thank immediately, submit in the background
    $("feedbackCard").hidden = true;
    fbMark("done");
    toast("Thanks — that genuinely helps");
    submitFeedback(payload).catch(() => { /* rating already captured in GA */ });
  });
  ["Intensity", "Exposure", "Contrast", "Saturation", "Temperature", "Tint"].forEach(n => {
    $("s" + n).addEventListener("input", noteFiddlingForFeedback, { once: false });
  });

  /* ---------- "LUTs served" counter ---------- */
  /* Social proof only reads as social proof above a certain number —
     "3 LUTs served" is worse than showing nothing. Counting still happens
     from zero; this only gates the display. Change to 0 to always show. */
  const LUT_COUNTER_MIN_DISPLAY = 50;
  function showLutCount(n) {
    if (n == null) return;                       // table missing / offline
    if (Number(n) < LUT_COUNTER_MIN_DISPLAY) return;
    $("lutCounterNum").textContent = Number(n).toLocaleString();
    $("lutCounter").hidden = false;
  }
  function bumpLutCounter() {
    incrementLutsServed().then(showLutCount);   // optimistic-ish: shows server's new total
  }
  fetchLutsServed().then(showLutCount);          // hidden until the table exists
}
