import * as THREE from "three";
/** three's AgX tone mapper (agxDefaultContrastApprox + AgXToneMapping + the rec2020 matrices), cut from its own chunk */
const AGX_GLSL = (() => {
  const c = THREE.ShaderChunk.tonemapping_pars_fragment;
  const a = c.indexOf("// Matrices for rec 2020");
  const b = c.indexOf("// https://modelviewer.dev/examples/tone-mapping");
  const body = c.slice(a >= 0 ? a : c.indexOf("const mat3 LINEAR_REC2020_TO_LINEAR_SRGB"), b > 0 ? b : undefined);
  // Blender's "AgX - Punchy" look (Filament agxLook: power 1.35, saturation 1.4), scaled by uAgXPunch (0 = AgX Base)
  const look = "{ float lw = dot(color, vec3(0.2126, 0.7152, 0.0722)); vec3 pv = pow(max(color, vec3(0.0)), vec3(1.35)); vec3 pl = lw + 1.4 * (pv - lw); color = mix(color, pl, uAgXPunch); }";
  return "uniform float toneMappingExposure;" + String.fromCharCode(10) + "uniform float uAgXPunch;" + String.fromCharCode(10) + body.replace("color = AgXOutsetMatrix * color;", look + " color = AgXOutsetMatrix * color;");
})();
// GLSL for the PostFX pipeline. All passes are fullscreen triangles drawn with
// THREE.ShaderMaterial (WebGL2 / GLSL ES 3.00 via three's prefix, so texture2D/gl_FragColor work).

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Shared helpers: depth buffer value -> positive view distance.
const DEPTH_HELPERS = /* glsl */ `
uniform float uNear;
uniform float uFar;
uniform float uPersp;
float viewDist(float d) {
  if (uPersp > 0.5) {
    // perspectiveDepthToViewZ, negated (positive distance)
    return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
  }
  return uNear + d * (uFar - uNear);
}
`;

// ---------------------------------------------------------------------------
// 1. Edge detection on the normal+depth buffer.
//    Output: r = edge strength (1px line, drawn on the NEAR side of a silhouette),
//            g = distance fade 0 (near) .. 1 (far), b = unused, a = 1.
// Depth test: second derivative of 1/z (which is affine in screen space for planes, so slanted
// floors and walls produce no false lines), relative to 1/z at the center (scale-invariant).
export const EDGE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uDepthThr;
uniform float uNormalThr;
uniform float uJump;
uniform float uIdEdge;
uniform float uFadeNear;
uniform float uFadeFar;
${DEPTH_HELPERS}

float invZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (d >= 0.999999) return 0.0;   // background (cleared depth): treat as infinitely far
  return 1.0 / max(viewDist(d), 1e-4);
}
vec4 nrm(vec2 uv) {
  vec4 n = texture2D(tNormal, uv);
  return vec4(n.xyz * 2.0 - 1.0, n.a);
}

void main() {
  float wc = invZ(vUv);
  vec4 nc = nrm(vUv);
  float edge = 0.0;
  if (nc.a > 0.5 && wc > 0.0) {
    // --- depth: near side of silhouettes
    vec2 dirs[4];
    dirs[0] = vec2(1.0, 0.0); dirs[1] = vec2(0.0, 1.0); dirs[2] = vec2(1.0, 1.0); dirs[3] = vec2(1.0, -1.0);
    float dEdge = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 o = dirs[i] * uTexel;
      float wa = invZ(vUv + o);
      float wb = invZ(vUv - o);
      // center nearer than the average of its neighbors -> negative second derivative
      float lap = (2.0 * wc - wa - wb) / wc;
      // also a hard one-sided jump (thin objects in front of far background)
      float jump = max(wc - wa, wc - wb) / wc * uJump;
      float k = (i >= 2) ? 0.85 : 1.0;
      dEdge = max(dEdge, k * max(lap * 0.5, jump));
    }
    float depthEdge = smoothstep(uDepthThr, uDepthThr * 1.8, dEdge);

    // --- normals: creases. Compare with the right and down neighbors (1px, one-sided),
    // and only against geometry that is not clearly farther (that case is a silhouette).
    float nEdge = 0.0;
    vec2 offs[2];
    offs[0] = vec2(1.0, 0.0); offs[1] = vec2(0.0, 1.0);
    for (int i = 0; i < 2; i++) {
      vec2 uv2 = vUv + offs[i] * uTexel;
      vec4 nb = nrm(uv2);
      if (nb.a < 0.5) continue;
      float wb = invZ(uv2);
      float diff = 1.0 - dot(normalize(nc.xyz), normalize(nb.xyz));
      float sameDepth = 1.0 - smoothstep(0.03, 0.12, abs(wb - wc) / wc);
      nEdge = max(nEdge, diff * sameDepth);
    }
    float normalEdge = smoothstep(uNormalThr, uNormalThr * 1.6 + 0.02, nEdge);
    edge = max(depthEdge, normalEdge);
    // --- object boundaries: the neighbor belongs to another object (id in the normal pass alpha) and is not
    // nearer -> ink on this side. Solid along the whole boundary, no threshold to hover around.
    if (uIdEdge > 0.0) {
      vec2 io[4];
      io[0] = vec2(1.0, 0.0); io[1] = vec2(-1.0, 0.0); io[2] = vec2(0.0, 1.0); io[3] = vec2(0.0, -1.0);
      float idE = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 uv2 = vUv + io[i] * uTexel;
        vec4 nb = nrm(uv2);
        if (nb.a < 0.5 || abs(nb.a - nc.a) < 0.002) continue;
        if (invZ(uv2) <= wc * 1.0005) idE = 1.0;
      }
      edge = max(edge, idE * uIdEdge);
    }
  }
  float dist = wc > 0.0 ? 1.0 / wc : uFar;
  float fade = smoothstep(uFadeNear, uFadeFar, dist);
  gl_FragColor = vec4(edge, fade, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// 2. Grade + ink: bloom add, exposure, highlight shoulder, sRGB encode, contrast, lift/gamma/gain,
//    saturation, split toning (all in display space), then the ink lines are drawn ON TOP of the
//    graded image (so they keep their exact color), and the signed circle of confusion (px,
//    negative = in front of the focus) is written to alpha for the DOF pass.
export const INK_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tEdge;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform vec2 uTexel;
uniform float uOutline;      // 0/1
uniform vec3 uInk;           // display (sRGB) color
uniform float uWidth;        // px, already scaled to the render size
uniform float uStrength;
uniform float uFarWidth;
uniform float uFarOpacity;
uniform float uDof;          // 0/1
uniform float uFocus;
uniform float uFocusRange;
uniform float uMaxBlur;      // px, scaled
uniform float uBloom;        // strength (0 = off)
uniform vec3 uBloomTint;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform vec3 uShadowTint;
uniform vec3 uHighTint;
uniform float uSplit;
uniform float uWobble;
uniform float uSharpen;
uniform vec2 uRes;
uniform sampler2D tAO;
uniform float uAO;          // 0/1
uniform sampler2D tShaft;
uniform vec3 uShaft;        // shaft colour x strength (0 = off)
${DEPTH_HELPERS}

const int MAXI = 9;
uniform float uSS;      // edge-mask supersampling (1 or 2)
uniform float uSSOff;   // 0 for 1x, 0.5 for 2x (texel-center offset)

// Hash without Sine (c) 2014 David Hoskins, MIT; see THIRD_PARTY_NOTICES.md
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 toSRGB(vec3 c) {
  c = max(c, vec3(0.0));
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
// AgX (three.js tonemapping_pars_fragment, MIT; _t_upgrade 2026-11-20): Blender's default view transform since 4.0.
// Used instead of the shoulder below when uAgX > 0.5; uAgXGain = extra linear gain before it (AgX sits darker).
uniform float uAgX;
uniform float uAgXGain;
uniform float uAgXWhite;
${AGX_GLSL}
// soft shoulder: linear up to 0.8, then rolls off toward 1
vec3 shoulder(vec3 x) {
  vec3 t = max(x - 0.8, 0.0);
  vec3 r = 0.8 + 0.2 * (1.0 - exp(-t / 0.2));
  return mix(x, r, step(0.8, x));
}

// uLiq: 0..1, how much of this pixel is "thick dark liquid" (core/liquid.tsx marks it with scene alpha 0.4). Liquids
// keep their own dark floor: the mood lift (which turns a near-black into a mid plum-brown) mostly skips them.
float uLiq = 0.0;
vec3 grade(vec3 c) {
  c *= exp2(uExposure);
  if (uAgX > 0.5) {
    // white point: the unlit figures' white (uAgXWhite, linear after exposure) lands at 0.96, like the old grade
    // (plain AgX keeps a 2x-exposed white at ~0.8: grey heads, RULES: heads never under ~90 % white)
    float wn = max(AgXToneMapping(vec3(uAgXWhite * uAgXGain)).g, 1e-3);
    c = clamp(AgXToneMapping(c * uAgXGain) * (0.96 / wn), 0.0, 1.0);
  } else {
  // highlight shoulder on the max channel (keeps hue), then per channel
  float M = max(c.r, max(c.g, c.b));
  float Ms = shoulder(vec3(M)).x;
  vec3 hue = c * ((M > 1e-5) ? Ms / M : 1.0);
  // over-exposed practicals burn toward a cream-white core
  float burn = clamp((M - 1.0) / 3.0, 0.0, 0.75);
  c = mix(hue, vec3(Ms) * vec3(1.0, 0.97, 0.9), burn);
  }
  c = toSRGB(c);
  // contrast on luminance (does not over-saturate): stretch around 0.46 blended with a smooth S,
  // applied half as a ratio and half additively so dark saturated colors stay rich
  float Lc = clamp(luma(c), 0.0, 1.0);
  float Ll = (Lc - 0.46) * uContrast + 0.46;
  float Ls2 = Lc * Lc * (3.0 - 2.0 * Lc);
  float Lt = clamp(mix(Ll, Ls2, clamp((uContrast - 1.0) * 0.8, 0.0, 0.6)), 0.0, 1.0);
  vec3 cr = c * (Lt / max(Lc, 1e-4));
  vec3 ca = c + (Lt - Lc);
  c = clamp(mix(cr, ca, 0.5), 0.0, 1.0);
  // lift / gamma / gain. lift neutral #000, gamma neutral #808080 (maps 0.5 -> value), gain neutral #fff
  c = c * uGain + uLift * (1.0 - 0.88 * uLiq) * (1.0 - c);
  c = clamp(c, 0.0, 1.0);
  vec3 gExp = log(vec3(0.5)) / log(clamp(uGamma, vec3(0.02), vec3(0.98)));
  c = pow(c, gExp);
  // saturation (luma preserving)
  float l2 = luma(c);
  c = mix(vec3(l2), c, uSaturation);
  // split toning: chroma of the tint colors added by luminance band
  float l3 = clamp(luma(c), 0.0, 1.0);
  float wS = 1.0 - smoothstep(0.05, 0.5, l3);
  float wH = smoothstep(0.55, 1.0, l3);
  c += (uShadowTint - luma(uShadowTint)) * uSplit * wS;
  c += (uHighTint - luma(uHighTint)) * uSplit * wH;
  return clamp(c, 0.0, 1.0);
}

void main() {
  vec4 scene0 = texture2D(tScene, vUv);
  vec3 col = scene0.rgb;
  // liquid marker (alpha 0.4; MSAA edges against alpha 1 resolve in between; the clear color has alpha 0)
  uLiq = clamp((1.0 - scene0.a) / 0.6, 0.0, 1.0) * step(0.2, scene0.a);
  // ambient occlusion (linear light, before bloom and grade) and light shafts (added light)
  if (uAO > 0.5) col *= texture2D(tAO, vUv).r;
  if (dot(uShaft, uShaft) > 0.0) col += texture2D(tShaft, vUv).rgb * uShaft;
  if (uSharpen > 0.0) {
    // local contrast ("clarity"): luminance unsharp mask, radius ~2.5 px
    vec3 b = vec3(0.0);
    b += texture2D(tScene, vUv + vec2( 2.5,  0.0) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2(-2.5,  0.0) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2( 0.0,  2.5) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2( 0.0, -2.5) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2( 1.8,  1.8) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2(-1.8,  1.8) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2( 1.8, -1.8) * uTexel).rgb;
    b += texture2D(tScene, vUv + vec2(-1.8, -1.8) * uTexel).rgb;
    b /= 8.0;
    float l0 = luma(col), lb = luma(b);
    float k = clamp(1.0 + uSharpen * (l0 - lb) / max(lb + 0.05, 1e-3), 0.6, 1.6);
    col *= k;
  }
  if (uBloom > 0.0) col += texture2D(tBloom, vUv).rgb * uBloom * uBloomTint;
  col = grade(col);
  if (uOutline > 0.5) {
    float ink = 0.0;
    // hand-inked variation: slow noise along the frame modulates width and density
    vec2 px = vUv * vec2(1080.0, 1080.0 * uRes.y / uRes.x);
    float nz = vnoise(px / 46.0) * 0.65 + vnoise(px / 13.0 + 7.3) * 0.35;
    float wMul = 1.0 + uWobble * (nz - 0.5) * 1.3;
    // the edge mask may be supersampled (uSS = 2): march its texel centers in 1x-pixel units,
    // so the ink is a distance field to a half-pixel-accurate line (anti-aliased)
    float wMax = uWidth * wMul;
    float dMax = wMax * 0.5 + 0.75;
    for (int y = -MAXI; y <= MAXI; y++) {
      for (int x = -MAXI; x <= MAXI; x++) {
        vec2 o = (vec2(float(x), float(y)) + uSSOff) / uSS;
        float d = length(o);
        if (d > dMax) continue;
        vec4 e = texture2D(tEdge, vUv + o * uTexel);
        if (e.r <= 0.001) continue;
        float w = wMax * mix(1.0, uFarWidth, e.g);
        float cov = clamp(w * 0.5 - d + 0.5, 0.0, 1.0);
        ink = max(ink, cov * e.r * mix(1.0, uFarOpacity, e.g));
      }
    }
    col = mix(col, uInk, clamp(ink * uStrength, 0.0, 1.0));
  }
  float coc = 0.0;
  if (uDof > 0.5) {
    float d = texture2D(tDepth, vUv).x;
    float z = d >= 0.999999 ? 1e6 : viewDist(d);
    // thin-lens CoC |1 - f/z|, normalized so that z = focus + focusRange gives the full blur
    float f = max(uFocus, 0.01);
    float norm = 1.0 - f / (f + max(uFocusRange, 0.01));
    float c = (1.0 - f / max(z, 0.001)) / max(norm, 1e-3);
    // small sharp zone around the focus
    float s = sign(c) * max(abs(c) - 0.06, 0.0) / 0.94;
    coc = clamp(s, -0.3, 1.0) * uMaxBlur;   // 2026-11-21: soft near blur so camera-near sound-off tags stay readable
  }
  gl_FragColor = vec4(col, coc);
}`;

// ---------------------------------------------------------------------------
// 3. Depth of field: a scatter-as-gather over a fixed disk of taps.
//    Each tap is a neighbor pixel whose own blur disk (|signed CoC| in alpha) may or may not reach this
//    pixel. A neighbor that lies BEHIND this pixel may only spread as far as this pixel's own blur, so a
//    sharp foreground keeps its edge against a blurred background; a neighbor IN FRONT spreads by its full
//    blur, so an out-of-focus foreground softly covers what is behind it. Each tap's weight is divided by its
//    blur area, so a wide, soft disk does not outweigh a small, sharp one. The tap table (DOF_TAP_COUNT
//    points on a golden-angle spiral, unit radius, radius in z) is built once in TypeScript: dofTaps().
export const DOF_TAP_COUNT = 64;
export const dofTaps = (n = DOF_TAP_COUNT) =>
  Array.from({ length: n }, (_, i) => {
    const rad = Math.sqrt((i + 0.5) / n);
    const ang = i * 2.399963229728653; // the golden angle
    return new THREE.Vector3(rad * Math.cos(ang), rad * Math.sin(ang), rad);
  });
export const DOF_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;            // rgb + signed CoC in px (alpha); negative = in front of the focus
uniform vec2 uTexel;
uniform float uMaxBlur;              // px: the gather disk radius
uniform vec3 uTaps[${DOF_TAP_COUNT}];       // unit disk offsets (xy) and their radius (z)

// how much of a neighbor's blur disk (radius px) covers a point at distance dist px; soft over 1 px
float reach(float radius, float dist) {
  return clamp(radius - dist + 1.0, 0.0, 1.0);
}

void main() {
  vec4 here = texture2D(tColor, vUv);
  float hereBlur = abs(here.a);
  // the pixel itself, weighted by the inverse of its blur area like every tap
  float hereW = 1.0 / max(hereBlur * hereBlur, 1.0);
  vec3 sum = here.rgb * hereW;
  float wsum = hereW;
  for (int k = 0; k < ${DOF_TAP_COUNT}; k++) {
    vec3 tap = uTaps[k];
    float dist = tap.z * uMaxBlur;
    vec4 nb = texture2D(tColor, vUv + tap.xy * uMaxBlur * uTexel);
    float nbBlur = abs(nb.a);
    // nb.a > here.a: the neighbor is farther away than this pixel -> clamp its spread to this pixel's blur
    float spread = nb.a > here.a ? min(nbBlur, hereBlur) : nbBlur;
    float w = reach(spread, dist) / max(nbBlur * nbBlur, 1.0);
    sum += nb.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(sum / wsum, here.a);
}`;

// ---------------------------------------------------------------------------
// 4. Bloom: prefilter (soft-knee threshold) + 13-tap downsample, then tent upsample.
export const BLOOM_PREFILTER_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;          // texel of the SOURCE
uniform float uThreshold;
uniform float uKnee;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  // 13-tap (Jimenez 2014) downsample
  vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
  vec3 d = tap(vec2(-1.0, -1.0)), e = tap(vec2(1.0, -1.0));
  vec3 f = tap(vec2(-2.0, 0.0)), g = tap(vec2(0.0, 0.0)), h = tap(vec2(2.0, 0.0));
  vec3 i = tap(vec2(-1.0, 1.0)), j = tap(vec2(1.0, 1.0));
  vec3 k = tap(vec2(-2.0, 2.0)), l = tap(vec2(0.0, 2.0)), m = tap(vec2(2.0, 2.0));
  vec3 col = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125
           + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  col *= contrib;
  col = min(col, vec3(40.0));
  gl_FragColor = vec4(col, 1.0);
}`;

export const DOWN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uTexel;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
  vec3 d = tap(vec2(-1.0, -1.0)), e = tap(vec2(1.0, -1.0));
  vec3 f = tap(vec2(-2.0, 0.0)), g = tap(vec2(0.0, 0.0)), h = tap(vec2(2.0, 0.0));
  vec3 i = tap(vec2(-1.0, 1.0)), j = tap(vec2(1.0, 1.0));
  vec3 k = tap(vec2(-2.0, 2.0)), l = tap(vec2(0.0, 2.0)), m = tap(vec2(2.0, 2.0));
  vec3 col = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125
           + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;
  gl_FragColor = vec4(col, 1.0);
}`;

export const UP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tLow;      // smaller level (already accumulated)
uniform sampler2D tHigh;     // this level's downsample
uniform vec2 uTexel;         // texel of tLow
uniform float uScatter;
vec3 tap(vec2 o) { return texture2D(tLow, vUv + o * uTexel).rgb; }
void main() {
  vec3 s = tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0))
         + 2.0 * (tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0)) + tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)))
         + 4.0 * tap(vec2(0.0));
  s /= 16.0;
  vec3 hi = texture2D(tHigh, vUv).rgb;
  gl_FragColor = vec4(mix(hi, s, uScatter), 1.0);
}`;

// ---------------------------------------------------------------------------
// 5. Final: vignette, paper grain, dither. Output alpha = 1.
export const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform float uVigAmount;
uniform float uVigSoft;
uniform vec3 uVigColor;
uniform float uGrain;
uniform float uFrame;
uniform vec2 uRes;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// Hash without Sine (c) 2014 David Hoskins, MIT; see THIRD_PARTY_NOTICES.md
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  // vignette: radial in frame space, 0 at the center, 1 at the corners
  float rr = length((vUv - 0.5) * 2.0) / 1.41421;
  float v = smoothstep(1.0 - clamp(uVigSoft, 0.05, 1.0), 1.0, rr);
  c = mix(c, c * uVigColor, v * uVigAmount);
  // paper texture (static fibers, scaled to the frame) + fine grain (per frame)
  if (uGrain > 0.0) {
    vec2 px = vUv * vec2(1080.0, 1080.0 * uRes.y / uRes.x);
    float paper = fbm(px / 7.0) - 0.5 + 0.6 * (fbm(px / 38.0 + 3.7) - 0.5);
    float g = hash12(floor(vUv * uRes) + fract(uFrame * 0.6180339) * 913.0) - 0.5;
    float mid = 1.0 - abs(luma(c) - 0.5) * 1.3;
    c += (paper * 0.07 + g * 0.03) * uGrain * mid;
  }
  // dither against banding
  c += (hash12(gl_FragCoord.xy + uFrame * 7.0) - 0.5) / 255.0;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ---------------------------------------------------------------------------
// Normal-pass replacement for custom ShaderMaterials: keeps their vertex shader (so vertex
// displacement such as sea waves stays in place) and writes a camera-facing normal, so only
// depth silhouettes are drawn on them.
export const FLAT_NORMAL_FRAG = /* glsl */ `
void main() { gl_FragColor = vec4(0.5, 0.5, 1.0, 1.0); }`;

// ---------------------------------------------------------------------------
// 6. Screen-space ambient occlusion (SAO / Alchemy-style, after McGuire et al. 2011 "The Alchemy Screen-Space
//    Ambient Obscurance Algorithm"; own implementation). Reads the normal + depth pass. Spiral of uSamples taps in a disk
//    of uRadius metres (projected), rotated per pixel by interleaved gradient noise (a FIXED screen pattern: no
//    per-frame noise, so nothing shimmers between frames; the bilateral blur removes the pattern). Output r = AO factor
//    (1 = open), g = view distance / 100 (for the depth-aware blur). Pixels of drawn figures (normal-pass alpha ~0.3:
//    the 3D stickman's layers and limbs) receive no AO themselves, but still occlude the floor and walls around them.
export const SSAO_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tNormal;
uniform sampler2D tDepth;
uniform vec2 uRes;            // AO target size (px)
uniform float uRadius;        // metres
uniform float uIntensity;
uniform float uBias;          // metres along the normal
uniform float uProjScale;     // px per metre at 1 m distance (target px)
uniform float uMaxPx;         // cap of the projected radius (px)
uniform mat4 uProjInv;
${DEPTH_HELPERS}
const int NS = 16;
vec3 viewPos(vec2 uv, float d) {
  vec4 c = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = uProjInv * c;
  return v.xyz / v.w;
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  float d = texture2D(tDepth, vUv).x;
  vec4 nn = texture2D(tNormal, vUv);
  if (d >= 0.999999) { gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0); return; }
  vec3 P = viewPos(vUv, d);
  float dist = -P.z;
  // drawn figures (alpha 0.3 band) and empty pixels get no AO
  if (nn.a < 0.35) { gl_FragColor = vec4(1.0, dist / 100.0, 0.0, 1.0); return; }
  // geometric normal from the depth buffer (the smallest step each way, so silhouettes do not bend it): the normal pass
  // carries SMOOTHED vertex normals, and a smooth-shaded cylinder cap (a rug) or bevelled box tilts them up to 45 deg,
  // which made flat surfaces occlude themselves; it also cannot be flipped
  vec2 px = 1.0 / uRes;
  vec3 Pl = viewPos(vUv - vec2(px.x, 0.0), texture2D(tDepth, vUv - vec2(px.x, 0.0)).x);
  vec3 Pr = viewPos(vUv + vec2(px.x, 0.0), texture2D(tDepth, vUv + vec2(px.x, 0.0)).x);
  vec3 Pd = viewPos(vUv - vec2(0.0, px.y), texture2D(tDepth, vUv - vec2(0.0, px.y)).x);
  vec3 Pu = viewPos(vUv + vec2(0.0, px.y), texture2D(tDepth, vUv + vec2(0.0, px.y)).x);
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));
  if (dot(N, -P) < 0.0) N = -N;
  float rPx = min(uRadius * uProjScale / max(dist, 0.05), uMaxPx);
  if (rPx < 1.0) { gl_FragColor = vec4(1.0, dist / 100.0, 0.0, 1.0); return; }
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float r2 = uRadius * uRadius;
  float sum = 0.0;
  for (int i = 0; i < NS; i++) {
    float a = (float(i) + 0.5) / float(NS);
    float ang = a * 43.982297 + rot;   // 7 turns of the spiral over the samples
    float rr = a * rPx;
    vec2 suv = vUv + vec2(cos(ang), sin(ang)) * rr / uRes;
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
    float sd = texture2D(tDepth, suv).x;
    if (sd >= 0.999999) continue;
    vec3 Q = viewPos(suv, sd);
    vec3 v = Q - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float f = max(r2 - vv, 0.0);
    sum += f * f * f * max((vn - uBias) / (vv + 0.0025), 0.0);
  }
  // soft response, never black (a contact shadow, not a hole)
  float ao = max(0.35, 1.0 - sum * uIntensity * 2.5 / (r2 * r2 * r2 * float(NS)));
  gl_FragColor = vec4(ao, dist / 100.0, 0.0, 1.0);
}`;

// depth-aware separable blur of the AO (uDir = (1,0) or (0,1) in texels); weights fall off with relative depth difference
export const AO_BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tAO;
uniform vec2 uDir;
void main() {
  vec4 c = texture2D(tAO, vUv);
  float z = c.g;
  float s = c.r * 1.0, w = 1.0;
  for (int i = 1; i <= 4; i++) {
    for (int sg = -1; sg <= 1; sg += 2) {
      vec4 t = texture2D(tAO, vUv + uDir * float(i * sg));
      float k = exp(-float(i * i) / 10.0) * max(0.0, 1.0 - abs(t.g - z) / max(z * 0.06, 0.0004));
      s += t.r * k; w += k;
    }
  }
  gl_FragColor = vec4(s / w, z, 0.0, 1.0);
}`;

// ---------------------------------------------------------------------------
// 7. Light shafts (screen-space radial blur toward the sun, after Mitchell 2007 "Volumetric light scattering as a
//    post-process", GPU Gems 3 ch. 13; own implementation). Mask: bright pixels (sky, a sunlit window) above uThreshold
//    luminance; then uTaps samples marched toward the sun's screen position with exponential decay. Pure function of
//    the frame (no history).
export const SHAFT_MASK_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform float uThreshold;
uniform float uSkyBoost;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float sky = texture2D(tDepth, vUv).x >= 0.999999 ? uSkyBoost : 1.0;
  float m = smoothstep(uThreshold, uThreshold * 1.6 + 0.05, l) * sky;
  gl_FragColor = vec4(c / max(l, 1e-3) * m, 1.0);
}`;
export const SHAFT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMask;
uniform vec2 uSun;        // sun position in uv (may be off screen)
uniform float uLength;    // fraction of the way to the sun covered by the march
uniform float uDecay;
const int TAPS = 40;
void main() {
  vec2 dlt = (uSun - vUv) * uLength / float(TAPS);
  vec2 uv = vUv;
  vec3 acc = vec3(0.0);
  float wgt = 1.0, wsum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    uv += dlt;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) break;
    acc += texture2D(tMask, uv).rgb * wgt;
    wsum += wgt;
    wgt *= uDecay;
  }
  gl_FragColor = vec4(acc / float(TAPS), 1.0);
}`;
