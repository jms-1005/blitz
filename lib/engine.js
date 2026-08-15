/* ============================================================
   blitz color engine — pure functions, no DOM.
   sRGB <-> Oklab, statistical reference transfer, look recipes,
   3D LUT baking/applying, .cube serialization.
   ============================================================ */

export const LUT_N = 33;

/* ---------- color space: sRGB <-> Oklab ---------- */
export function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function linearToSrgb(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
export function rgbToOklab(r, g, b) {
  r = srgbToLinear(r); g = srgbToLinear(g); b = srgbToLinear(b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}
export function oklabToRgb(L, a, b2) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b2;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b2;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b2;
  const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  return [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)];
}
export const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

/* ---------- reference transfer ---------- */
export function makeReferenceLook(statsT, statsR) {
  const ratio = [0, 1, 2].map(k => Math.min(4, Math.max(0.25, statsR.std[k] / statsT.std[k])));
  return function (r, g, b) {
    const lab = rgbToOklab(r, g, b);
    return oklabToRgb(
      (lab[0] - statsT.mean[0]) * ratio[0] + statsR.mean[0],
      (lab[1] - statsT.mean[1]) * ratio[1] + statsR.mean[1],
      (lab[2] - statsT.mean[2]) * ratio[2] + statsR.mean[2],
    );
  };
}

/* ---------- look recipes (Oklab ops) ---------- */
const sstep = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
export function makeLook(o) {
  return function (r, g, b) {
    let [L, a, b2] = rgbToOklab(r, g, b);
    if (o.mono) { a *= (o.monoKeep || 0); b2 *= (o.monoKeep || 0); }
    if (o.contrast) L = 0.5 + (L - 0.5) * (1 + o.contrast);
    if (o.lift) L = L + o.lift * (1 - L);
    if (o.gainDown) L = L * (1 - o.gainDown);
    if (o.sat) { a *= o.sat; b2 *= o.sat; }
    const t = sstep((L - 0.25) / 0.5);
    if (o.splitA) a += o.splitA[0] * (1 - t) + o.splitA[1] * t;
    if (o.splitB) b2 += o.splitB[0] * (1 - t) + o.splitB[1] * t;
    if (o.warm) b2 += o.warm;
    if (o.tint) a += o.tint;
    const rgb = oklabToRgb(L, a, b2);
    return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
  };
}

/* ---------- recipes: the ~1 KB JSON that defines a published look ----------
   A look is stored as a recipe, not as a LUT file. The downloader's browser
   rebuilds the identical color function (and therefore the identical .cube)
   from these few hundred bytes.

   recipe = {
     v: 1,
     base: { type: "reference", meanT[3], stdT[3], meanR[3], stdR[3] }
         | { type: "look", ops: {...} }
         | { type: "recipe", recipe: <parent recipe> }   // a remix
     trims: { intensity, exposure, contrast, saturation, temperature, tint }
   }
------------------------------------------------------------------------- */
const IDENTITY = (r, g, b) => [r, g, b];
const NO_TRIMS = { intensity: 1, exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0 };

export function baseFromDescriptor(base) {
  if (!base) return IDENTITY;
  if (base.type === "reference") {
    return makeReferenceLook(
      { mean: base.meanT, std: base.stdT },
      { mean: base.meanR, std: base.stdR },
    );
  }
  if (base.type === "look") return makeLook(base.ops);
  if (base.type === "recipe") return recipeToFn(base.recipe);
  return IDENTITY;
}

export function recipeToFn(recipe) {
  if (!recipe || !recipe.base) return IDENTITY;
  return makePipeline(baseFromDescriptor(recipe.base), recipe.trims || NO_TRIMS);
}

/* ---------- pipeline: base look + intensity + trims ---------- */
export function makePipeline(baseFn, p) {
  return function (r, g, b) {
    const graded = baseFn(r, g, b);
    const lab0 = rgbToOklab(r, g, b);
    const lab1 = rgbToOklab(graded[0], graded[1], graded[2]);
    let L = lab0[0] + (lab1[0] - lab0[0]) * p.intensity;
    let a = lab0[1] + (lab1[1] - lab0[1]) * p.intensity;
    let b2 = lab0[2] + (lab1[2] - lab0[2]) * p.intensity;
    L += p.exposure * 0.25;
    L = 0.5 + (L - 0.5) * (1 + p.contrast * 0.8);
    const satMul = 1 + p.saturation;
    a *= satMul; b2 *= satMul;
    b2 += p.temperature * 0.06;
    a += p.tint * 0.06;
    const rgb = oklabToRgb(L, a, b2);
    return [clamp01(rgb[0]), clamp01(rgb[1]), clamp01(rgb[2])];
  };
}

/* ---------- LUT bake / apply / serialize ---------- */
export function bakeFnToLut(fn) {
  const N = LUT_N;
  const lut = new Float32Array(N * N * N * 3);
  let i = 0;
  for (let bi = 0; bi < N; bi++) {
    const b = bi / (N - 1);
    for (let gi = 0; gi < N; gi++) {
      const g = gi / (N - 1);
      for (let ri = 0; ri < N; ri++) {
        const out = fn(ri / (N - 1), g, b);
        lut[i++] = out[0]; lut[i++] = out[1]; lut[i++] = out[2];
      }
    }
  }
  return lut;
}

export function applyLut(lut, src, dst) {
  const N = LUT_N, N1 = N - 1;
  const s = src.data, d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const r = s[i] / 255 * N1, g = s[i + 1] / 255 * N1, b = s[i + 2] / 255 * N1;
    const r0 = r | 0, g0 = g | 0, b0 = b | 0;
    const r1 = r0 < N1 ? r0 + 1 : r0, g1 = g0 < N1 ? g0 + 1 : g0, b1 = b0 < N1 ? b0 + 1 : b0;
    const fr = r - r0, fg = g - g0, fb = b - b0;
    for (let ch = 0; ch < 3; ch++) {
      const c000 = lut[3 * (r0 + N * (g0 + N * b0)) + ch], c100 = lut[3 * (r1 + N * (g0 + N * b0)) + ch];
      const c010 = lut[3 * (r0 + N * (g1 + N * b0)) + ch], c110 = lut[3 * (r1 + N * (g1 + N * b0)) + ch];
      const c001 = lut[3 * (r0 + N * (g0 + N * b1)) + ch], c101 = lut[3 * (r1 + N * (g0 + N * b1)) + ch];
      const c011 = lut[3 * (r0 + N * (g1 + N * b1)) + ch], c111 = lut[3 * (r1 + N * (g1 + N * b1)) + ch];
      const c00 = c000 + (c100 - c000) * fr, c10 = c010 + (c110 - c010) * fr;
      const c01 = c001 + (c101 - c001) * fr, c11 = c011 + (c111 - c011) * fr;
      const c0 = c00 + (c10 - c00) * fg, c1 = c01 + (c11 - c01) * fg;
      d[i + ch] = (c0 + (c1 - c0) * fb) * 255 + 0.5;
    }
    d[i + 3] = s[i + 3];
  }
}

export function lutToCube(lut, name) {
  const N = LUT_N;
  let out = `# Created with blitz — blitzluts.com\nTITLE "${name}"\nLUT_3D_SIZE ${N}\nDOMAIN_MIN 0.0 0.0 0.0\nDOMAIN_MAX 1.0 1.0 1.0\n`;
  const lines = new Array(N * N * N);
  for (let i = 0, j = 0; i < lut.length; i += 3, j++) {
    lines[j] = lut[i].toFixed(6) + " " + lut[i + 1].toFixed(6) + " " + lut[i + 2].toFixed(6);
  }
  return out + lines.join("\n") + "\n";
}
