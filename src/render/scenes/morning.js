// Ochtend: a misty field at sunrise, from Thomas' own photo (assets/ochtend.jpg, 4032 × 3024).
//
// The photo is the scene; everything that moves is added on top of it, in the photo itself:
//  - WebGL: mist drifting through the field, the sun's glow breathing with you, light shafts through
//    the mist, and the high clouds drifting. (Swaying grass was tried and removed: warping a photo
//    looks unreal.)
//  - Canvas 2D: distant birds, skeins of geese, a pair of crows and now and then a buzzard circling
//    on a thermal (their calls come from where they fly), and specks of dust in the low sunlight.
// Calm brings warmth and light: the mist thins, the sun breaks through. Each progress step sends a
// skein of geese over.
//
// Coordinates in the photo are normalised (0..1, y down). Measured on the photo:
//  sun (0.607, 0.486) · treeline 0.52–0.56 · mist line 0.585 · ground from 0.59

import { audio } from '../../audio/engine.js';
import { clamp, rnd, TAU } from '../../core/math.js';
import { breath } from '../../state.js';
import { REE } from './ree-sprite.js';
import { additive, ctx, glow, reducedMotion, view } from '../context.js';

const IMG_W = 4032, IMG_H = 3024, IMG_ASPECT = IMG_W / IMG_H;
const SUN = { x: 0.607, y: 0.486 };
const HORIZON = 0.535; // top of the treeline: birds stay above it
const FOCUS = { landscape: { x: 0.56, y: 0.55 }, portrait: { x: 0.56, y: 0.5 } };

const photo = new Image();
let photoReady = false;
photo.decoding = 'async';
photo.onload = () => { photoReady = true; };
// (the deer's occlusion mask is built from the photo on first use, see buildOccluder)
photo.src = new URL('../../../assets/ochtend.jpg?v=1', import.meta.url).href;

// ---------- the visible part of the photo (cover fit + a slow zoom) ----------

let win = [0, 0, 1, 1];
function updateWindow(time, pg) {
  const { W, H } = view, a = W / H;
  let w = 1, h = 1;
  if (a > IMG_ASPECT) h = IMG_ASPECT / a; else w = a / IMG_ASPECT;
  const zoom = reducedMotion ? 1.01 : 1.012 + 0.018 * (0.5 - 0.5 * Math.cos((time * TAU) / 120)) + 0.025 * pg;
  w /= zoom; h /= zoom;
  const f = a > 1 ? FOCUS.landscape : FOCUS.portrait;
  const x = clamp(f.x, w / 2, 1 - w / 2), y = clamp(f.y, h / 2, 1 - h / 2);
  win = [x - w / 2, y - h / 2, w, h];
}
const toScreen = (u, v) => [((u - win[0]) / win[2]) * view.W, ((v - win[1]) / win[3]) * view.H];

// ---------- WebGL ----------

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = vec2(aPos.x*0.5+0.5, 0.5-aPos.y*0.5); gl_Position = vec4(aPos,0.,1.); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImg;
uniform vec4 uWin;
uniform vec2 uSun;
uniform float uT, uCalm, uBreath, uProg, uMotion;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
vec3 screen(vec3 a, vec3 b){ return 1. - (1.-a)*(1.-b); }

void main(){
  vec2 uv = uWin.xy + vUv*uWin.zw;

  vec2 disp = vec2(0.);

  // High clouds drift very slowly; the shift fades out before the warm band above the treeline.
  float sky = 1. - smoothstep(0.36, 0.47, uv.y);
  disp.x += sky * 0.006 * sin(uT*0.009) * uMotion;

  vec3 col = texture2D(uImg, uv + disp).rgb;

  // Sun glow, round in the photo (correct for its 4:3 aspect).
  vec2 d = (uv - uSun) * vec2(${IMG_ASPECT.toFixed(4)}, 1.);
  float r = length(d);
  float lift = clamp(uCalm*0.6 + uProg*0.4, 0., 1.);
  float sunK = 0.55 + 0.25*uBreath + 0.35*lift;
  vec3 sunCol = vec3(1.0, 0.78, 0.48);
  col = screen(col, sunCol * (exp(-r*r/0.0016)*0.45 + exp(-r/0.11)*0.22) * sunK);

  // Light shafts: march towards the sun and gather bright light; mist breaks them up.
  if (r < 0.6) {
    vec2 stp = (uSun - uv) / 14. * 0.85;
    vec2 p = uv; float acc = 0., decay = 1.;
    for (int i = 0; i < 14; i++){
      p += stp;
      float l = dot(texture2D(uImg, p).rgb, vec3(0.3, 0.59, 0.11));
      acc += smoothstep(0.78, 1.0, l) * decay;
      decay *= 0.91;
    }
    acc /= 14.;
    float ang = atan(d.y, d.x);
    float beams = 0.55 + 0.45*fbm(vec2(ang*7., uT*0.03));
    col = screen(col, sunCol * acc * beams * (1.-smoothstep(0.25, 0.6, r)) * (0.35 + 0.5*lift));
  }

  // Drifting mist: a dense band on the field just below the treeline and thinner veils in front.
  float band = exp(-pow((uv.y-0.592)/0.02, 2.)) + 0.6*exp(-pow((uv.y-0.635)/0.045, 2.)) + 0.25*smoothstep(0.62, 0.95, uv.y);
  vec2 mp = vec2(uv.x*2.6 + uT*0.010, uv.y*13.);
  float m = fbm(mp) * fbm(mp*0.55 + vec2(-uT*0.006, 3.1));
  float mist = band * smoothstep(0.12, 0.5, m) * (1. - 0.5*lift) * uMotion;
  float near = exp(-pow(length(d*vec2(1., 1.8))/0.33, 2.));
  vec3 mistCol = mix(vec3(0.86, 0.72, 0.58), vec3(1.0, 0.82, 0.55), near);
  col = screen(col, mistCol * mist * (0.16 + 0.3*near) * (0.85 + 0.3*uBreath));

  // Grade: a little cooler and dimmer when restless, warmer and brighter when calm.
  col = mix(col*vec3(0.9, 0.94, 1.03)*0.9, col, 0.55 + 0.45*lift);
  col *= 1. + 0.07*lift*vec3(1.0, 0.65, 0.3);
  col *= 0.975 + 0.04*uBreath;

  gl_FragColor = vec4(col, 1.);
}`;

let glc, gl, prog, tex, U, glFailed = false, texReady = false;
// Adaptive render scale: if frames get slow (a weak laptop GPU at full resolution), render the
// effects at a lower resolution. Only ever goes down, so it never oscillates.
let quality = 1, avgDt = 1 / 60, checkIn = 3;

function initGL() {
  glc = document.createElement('canvas');
  const opts = { premultipliedAlpha: false, antialias: false, alpha: false };
  gl = glc.getContext('webgl2', opts) || glc.getContext('webgl', opts);
  if (!gl) { glFailed = true; return; }
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) {
    console.warn('Ochtend: WebGL niet beschikbaar, val terug op 2D', e);
    glFailed = true;
    return;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  U = Object.fromEntries(['uImg', 'uWin', 'uSun', 'uT', 'uCalm', 'uBreath', 'uProg', 'uMotion'].map((n) => [n, gl.getUniformLocation(prog, n)]));
  glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); texReady = false; glFailed = true; });
}

function uploadTexture() {
  let src = photo;
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  if (IMG_W > max) {
    // Older devices: scale the photo down to what the GPU can hold.
    const c = document.createElement('canvas'), s = max / IMG_W;
    c.width = max; c.height = Math.round(IMG_H * s);
    c.getContext('2d').drawImage(photo, 0, 0, c.width, c.height);
    src = c;
  }
  tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src);
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
  if (webgl2) {
    gl.generateMipmap(gl.TEXTURE_2D); // sharp but not grainy when the photo is shown smaller than its size
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  texReady = true;
}

function renderGL(time, calm, pg, level) {
  const { W, H, DPR } = view;
  // Never render more pixels than the photo can fill; the 2D canvas scales the result up smoothly.
  const s = Math.min(DPR, 2880 / W, 1800 / H, 2) * quality;
  const w = Math.max(1, Math.round(W * s)), h = Math.max(1, Math.round(H * s));
  if (glc.width !== w || glc.height !== h) { glc.width = w; glc.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform1i(U.uImg, 0);
  gl.uniform4f(U.uWin, ...win);
  gl.uniform2f(U.uSun, SUN.x, SUN.y);
  gl.uniform1f(U.uT, time);
  gl.uniform1f(U.uCalm, calm);
  gl.uniform1f(U.uBreath, level);
  gl.uniform1f(U.uProg, pg);
  gl.uniform1f(U.uMotion, reducedMotion ? 0.4 : 1);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  ctx.drawImage(glc, 0, 0, W, H);
}

/** Without WebGL: the photo itself, with a soft glow on the sun. */
function render2D(calm, level) {
  const { W, H } = view;
  ctx.drawImage(photo, win[0] * IMG_W, win[1] * IMG_H, win[2] * IMG_W, win[3] * IMG_H, 0, 0, W, H);
  const [sx, sy] = toScreen(SUN.x, SUN.y);
  additive(() => glow(sx, sy, Math.min(W, H) * 0.35, '255,200,130', 0.12 + 0.08 * level + 0.1 * calm));
}

// ---------- birds ----------

const flights = [];
const timers = { single: 8, crows: 40, geese: 25, buzzard: 35 };
const buzzards = [];

/**
 * A buzzard circling on a thermal, modelled in 3D and seen from below at an angle, so its silhouette
 * foreshortens naturally as it turns (a flat sprite rotating in the screen plane looks fake). It banks
 * into the turn, holds its wings in a shallow V, climbs slowly and drifts across the sky; now and then
 * a few slow wingbeats. Edges are slightly soft, as a bird a few hundred metres up would be.
 */
const VIEW_Z = 0.7, VIEW_Y = 0.71; // how depth and height project onto the screen (looking up ~45°)
function spawnBuzzard() {
  const { W, H } = view;
  const dir = Math.random() < 0.5 ? 1 : -1, R = W * rnd(0.035, 0.055);
  buzzards.push({
    dir, R, ang: rnd(0, TAU), w: (Math.random() < 0.5 ? 1 : -1) * TAU / rnd(16, 22),
    cx: dir > 0 ? -R * 1.6 : W + R * 1.6, cy: H * rnd(0.14, 0.28), vx: dir * W * rnd(0.005, 0.008),
    s: clamp(W * 0.0075, 6, 13), t: 0, calls: rnd(3, 8), flap: rnd(8, 16), flapT: 0, wob: rnd(0, TAU),
  });
}

function drawBuzzard(b, x, y, color) {
  const { ang, s } = b, sg = Math.sign(b.w);
  // Bank into the turn, with a little turbulence.
  const bank = 0.32 + 0.07 * Math.sin(b.t * 1.1 + b.wob) + 0.04 * Math.sin(b.t * 2.3);
  const cb = Math.cos(bank), sb = Math.sin(bank);
  // Wing axis: radial (outwards) in the horizontal plane, tilted up on the outer side by the bank.
  const wx = Math.cos(ang) * cb, wy = Math.sin(ang) * cb * VIEW_Z - sb * VIEW_Y;
  // Heading: along the circle; the bank tilts it only slightly, ignore that.
  const hx = -Math.sin(ang) * sg, hy = Math.cos(ang) * sg * VIEW_Z;
  // Shallow V of the wings (dihedral), plus the beat of an occasional wingflap.
  const flap = b.flapT > 0 ? Math.sin((1.5 - b.flapT) * 1.9 * TAU) * 0.35 : 0;
  const P = (u, v) => {
    const lift = (0.14 + flap) * Math.abs(u);
    return [x + s * (u * wx + v * hx), y + s * (u * wy + v * hy) - s * lift * VIEW_Y];
  };
  // Planform of a common buzzard: broad wings with a rounded tip, short fanned tail, small head.
  const shape = [
    [0, 0.26], [0.12, 0.13], [0.55, 0.12], [0.88, 0.06], [0.97, -0.03], [0.93, -0.12], [0.6, -0.2], [0.18, -0.2],
    [0.1, -0.24], [0.14, -0.46], [0, -0.5],
  ];
  const pts = [...shape.map(([u, v]) => P(u, v)), ...shape.slice(0, -1).reverse().map(([u, v]) => P(-u, v))];
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(1, s * 0.12);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function updateBuzzards(dt, calm) {
  const { W } = view;
  if ((timers.buzzard -= dt) <= 0) { spawnBuzzard(); timers.buzzard = rnd(120, 240); }
  for (let i = buzzards.length - 1; i >= 0; i--) {
    const b = buzzards[i];
    b.t += dt;
    b.ang += b.w * dt;
    b.cx += b.vx * dt;
    b.cy -= dt * 0.6; // climbing on the thermal…
    b.s *= 1 - dt * 0.001; // …and so slowly getting smaller
    if ((b.dir > 0 && b.cx - b.R * 2 > W) || (b.dir < 0 && b.cx + b.R * 2 < 0)) { buzzards.splice(i, 1); continue; }
    const x = b.cx + Math.cos(b.ang) * b.R, y = b.cy + Math.sin(b.ang) * b.R * VIEW_Z;
    if ((b.flap -= dt) <= 0) { b.flapT = 1.5; b.flap = rnd(12, 26); }
    if (b.flapT > 0) b.flapT -= dt;
    drawBuzzard(b, x, y, `rgba(${42 + 22 * calm},${36 + 12 * calm},40,0.8)`);
    if (audio.on && (b.calls -= dt) <= 0 && x > 0 && x < W) {
      audio.call('buzzard', clamp((x / W) * 2 - 1, -0.95, 0.95));
      b.calls = rnd(7, 20);
    }
  }
}

/** A flight crossing the sky. `members` are offsets in px from the leader, in flight direction. */
function spawn(kind) {
  const { W, H } = view;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const [, hy] = toScreen(0, HORIZON);
  const top = H * 0.06, low = Math.max(top + 20, hy - H * 0.06);
  const f = { kind, dir, t: 0, calls: rnd(0.5, 2) };
  if (kind === 'geese') {
    const n = 7 + ((Math.random() * 9) | 0), s = clamp(W * 0.0055, 5, 10);
    f.span = s; f.speed = W * rnd(0.03, 0.04); f.flap = 2.6; f.y = rnd(top, top + (low - top) * 0.55);
    // A V (sometimes lopsided): the leader in front, the others staggered back along two arms.
    const right = Math.ceil((n - 1) * rnd(0.3, 0.7));
    f.members = [{ dx: 0, dy: 0, ph: 0 }];
    for (let i = 1; i < n; i++) {
      const arm = i <= right ? 1 : -1, k = arm > 0 ? i : i - right;
      f.members.push({ dx: -k * s * rnd(2.6, 3.2), dy: arm * k * s * rnd(1.4, 1.9), ph: rnd(0, TAU) });
    }
  } else if (kind === 'crows') {
    const s = clamp(W * 0.006, 5, 11);
    f.span = s; f.speed = W * rnd(0.045, 0.06); f.flap = 3.2; f.y = rnd(top + (low - top) * 0.4, low);
    f.members = [{ dx: 0, dy: 0, ph: 0 }, { dx: -s * rnd(4, 9), dy: s * rnd(-2, 2), ph: 1.7 }];
  } else {
    const n = 1 + ((Math.random() * 3) | 0), s = clamp(W * 0.0036, 3.5, 6);
    f.span = s; f.speed = W * rnd(0.05, 0.08); f.flap = rnd(3.6, 4.4); f.y = rnd(top, low); f.glide = true;
    f.members = Array.from({ length: n }, (_, i) => ({ dx: -i * s * rnd(3, 6), dy: s * rnd(-3, 3), ph: rnd(0, TAU) }));
  }
  const extent = Math.max(...f.members.map((m) => -m.dx)) + f.span * 2;
  f.x = dir > 0 ? -f.span * 2 : W + f.span * 2;
  f.end = W + extent + f.span * 4;
  f.dist = 0;
  flights.push(f);
}

function drawBird(x, y, s, wing, dir, neck, color) {
  // Silhouette: two curved wings (wing −1..1: down..up) and a slim body, seen from the side and below.
  const tipY = -wing * s * 0.55, mid = -wing * s * 0.2;
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = Math.max(0.8, s * 0.12); // slightly soft: distant birds are never razor-sharp
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - s, y + tipY);
  ctx.quadraticCurveTo(x - s * 0.45, y + mid - s * 0.12, x, y - s * 0.04);
  ctx.quadraticCurveTo(x + s * 0.45, y + mid - s * 0.12, x + s, y + tipY);
  ctx.quadraticCurveTo(x + s * 0.4, y + mid + s * 0.1, x, y + s * 0.12);
  ctx.quadraticCurveTo(x - s * 0.4, y + mid + s * 0.1, x - s, y + tipY);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - dir * s * 0.05, y + s * 0.05, s * 0.36, s * 0.08, 0, 0, TAU);
  ctx.fill();
  if (neck) {
    ctx.lineWidth = Math.max(1, s * 0.09);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + dir * s * 0.25, y + s * 0.04);
    ctx.lineTo(x + dir * s * 0.75, y + s * 0.02);
    ctx.stroke();
  }
  ctx.restore();
}

function updateBirds(dt, calm) {
  const { W } = view;
  for (const k of ['single', 'crows', 'geese']) timers[k] -= dt;
  if (timers.single <= 0) { spawn('single'); timers.single = rnd(14, 38); }
  if (timers.crows <= 0) { spawn('crows'); timers.crows = rnd(70, 150); }
  if (timers.geese <= 0) { spawn('geese'); timers.geese = rnd(90, 180); }

  for (let i = flights.length - 1; i >= 0; i--) {
    const f = flights[i];
    f.t += dt;
    f.x += f.dir * f.speed * dt;
    f.dist += f.speed * dt;
    if (f.dist > f.end) { flights.splice(i, 1); continue; }
    f.y += Math.sin(f.t * 0.4) * dt * 2; // a gentle rise and fall
    // Calls come from where the birds are.
    if (f.kind !== 'single' && audio.on && (f.calls -= dt) <= 0 && f.x > -W * 0.05 && f.x < W * 1.05) {
      const pan = clamp((f.x / W) * 2 - 1, -0.95, 0.95);
      if (f.kind === 'geese') { audio.call('goose', pan); f.calls = rnd(0.35, 1.6); }
      else { audio.call('crow', pan); f.calls = rnd(1.8, 4.5); }
    }
    const haze = f.kind === 'single' ? 0.62 : 0.78;
    const color = `rgba(${36 + 20 * calm},${30 + 12 * calm},${34},${haze})`;
    for (const m of f.members) {
      let wing;
      let bob = 0;
      if (f.glide) {
        // Small birds: bounding flight. Flapping fades smoothly into a short glide and back
        // (no hard switch, which would read as flicker), and the bird rises and dips with it.
        const env = 0.5 - 0.5 * Math.cos((f.t / 2.2) * TAU + m.ph);
        wing = Math.sin((f.t + m.ph) * f.flap * TAU) * env * 0.85 - 0.12 * (1 - env);
        bob = Math.sin((f.t / 2.2) * TAU + m.ph) * f.span * 0.8;
      } else wing = Math.sin((f.t + m.ph / TAU) * f.flap * TAU + m.ph);
      drawBird(f.x + f.dir * m.dx, f.y + m.dy + bob, f.span, wing, f.dir, f.kind === 'geese', color);
    }
  }
}

// ---------- a roe deer bounding through the far field ----------
//
// A real roe deer: one bound cut out of video footage (see ree-sprite.js), played as a loop while the
// deer runs across the field. Far away, backlit, veiled by mist, legs fading into the grass, and hidden
// behind anything in the foreground. That last part comes from the photo itself: an occlusion mask of everything that is
// clearly darker than the misty field behind it (the bush on the right, weed tops), built once when
// the photo has loaded. The deer crosses the open field right of the path and at the far end
// disappears into the mist.

const FIELD = { x0: 0.6, x1: 1.04, y0: 0.6, y1: 0.625, eye: 0.577 };
const MASK = { x: 0.55, y: 0.53, w: 0.45, h: 0.15 }; // part of the photo the mask covers (normalised)
let occluder = null; // canvas whose alpha = how much the photo hides what is behind it
const deer = [];
let deerTimer = rnd(60, 120);
let deerBuf = null;

function buildOccluder() {
  const sx = Math.round(MASK.x * IMG_W), sy = Math.round(MASK.y * IMG_H), sw = Math.round(MASK.w * IMG_W), sh = Math.round(MASK.h * IMG_H);
  const c = document.createElement('canvas');
  c.width = sw; c.height = sh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(photo, sx, sy, sw, sh, 0, 0, sw, sh);
  const img = g.getImageData(0, 0, sw, sh), d = img.data;
  // Per row, the brightness of the misty field; anything well below that is foreground.
  for (let y = 0; y < sh; y++) {
    const row = [];
    for (let x = 0; x < sw; x += 7) { const i = (y * sw + x) * 4; row.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]); }
    row.sort((a, b) => a - b);
    const field = row[Math.floor(row.length * 0.7)];
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4, l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const a = clamp((field * 0.72 - l) / (field * 0.2), 0, 1);
      d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  occluder = c;
}

function spawnDeer() {
  const fromRight = Math.random() < 0.6;
  const gy = rnd(FIELD.y0, FIELD.y1);
  deer.push({
    dir: fromRight ? -1 : 1, gy, u: fromRight ? FIELD.x1 : FIELD.x0 + 0.02,
    phase: Math.random(), fade: fromRight ? 1 : 0, leaving: false, t: 0,
  });
}

const reeSheet = new Image();
let reeReady = false;
reeSheet.onload = () => { reeReady = true; };
reeSheet.src = new URL('../../../assets/ree.png?v=1', import.meta.url).href;

function updateDeer(dt) {
  if ((deerTimer -= dt) <= 0) { spawnDeer(); deerTimer = rnd(150, 300); }
  if (!deer.length || !occluder || !reeReady) return;
  const { W, H } = view, N = REE.frames.length, cycle = N / REE.fps; // one bound ≈ 0.53 s
  for (let i = deer.length - 1; i >= 0; i--) {
    const d = deer[i];
    d.t += dt;
    // Size from perspective: further away (closer to eye level) is smaller. A roe deer stretched out
    // is about 1.3 m; the path (≈3 m) is 0.05 photo widths wide at y 0.6.
    const depth = (d.gy - FIELD.eye) / (0.61 - FIELD.eye);
    const lenImg = 0.021 * depth;
    d.phase = (d.phase || 0) + dt / cycle;
    d.u += d.dir * (dt / cycle) * (REE.advance / REE.bodyLen) * lenImg;
    // Leaving: running away from us into the mist, so smaller and fainter; or out of the picture.
    if (d.dir < 0 && d.u < FIELD.x0 + 0.03) d.leaving = true;
    if (d.leaving) { d.fade -= dt / 2; d.gy -= dt * 0.004; }
    else if (d.fade < 1) d.fade = Math.min(1, d.fade + dt / 1.5);
    if (d.fade <= 0 || d.u > FIELD.x1 + 0.02) { deer.splice(i, 1); continue; }

    const f = REE.frames[Math.floor(d.phase * N) % N];
    const [gx, gy] = toScreen(d.u, d.gy);
    const k = ((lenImg / win[2]) * W) / REE.bodyLen; // sprite px → screen px
    if (REE.bodyLen * k < 4) continue;
    // Torso centre on screen: on the path, plus this frame's bounce and surge; hooves meet the ground.
    const tx = gx + d.dir * f.dx * k, ty = gy - (REE.ground - f.dy) * k;
    const left = d.dir > 0 ? tx - f.cx * k : tx - (f.w - f.cx) * k, top = ty - f.cy * k;
    const bw = Math.ceil(f.w * k) + 2, bh = Math.ceil(f.h * k) + 2;
    if (!deerBuf) deerBuf = document.createElement('canvas');
    const pr = Math.min(view.DPR, 2);
    deerBuf.width = Math.ceil(bw * pr); deerBuf.height = Math.ceil(bh * pr);
    const g2 = deerBuf.getContext('2d');
    g2.imageSmoothingQuality = 'high';
    g2.setTransform(pr, 0, 0, pr, 0, 0);
    g2.save();
    if (d.dir < 0) { g2.translate(f.w * k, 0); g2.scale(-1, 1); }
    g2.drawImage(reeSheet, f.x, f.y, f.w, f.h, 0, 0, f.w * k, f.h * k);
    g2.restore();
    // Seen through mist: veil the colours towards the mist, more when further away.
    const haze = clamp(0.38 - 0.1 * (depth - 1), 0.25, 0.55);
    g2.globalCompositeOperation = 'source-atop';
    g2.fillStyle = `rgba(214,146,80,${haze})`;
    g2.fillRect(0, 0, bw, bh);
    // Legs disappear into grass and mist near the ground line.
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.globalCompositeOperation = 'destination-out';
    const groundY = (gy - top) * pr, legLen = 0.32 * REE.bodyLen * k * pr;
    const gr = g2.createLinearGradient(0, groundY - legLen, 0, groundY);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)');
    g2.fillStyle = gr; g2.fillRect(0, 0, deerBuf.width, deerBuf.height);
    // Hidden behind whatever the photo has in front of the field.
    const ix = win[0] + (left / W) * win[2], iy = win[1] + (top / H) * win[3];
    const iw = (bw / W) * win[2], ih = (bh / H) * win[3];
    g2.drawImage(occluder, ((ix - MASK.x) / MASK.w) * occluder.width, ((iy - MASK.y) / MASK.h) * occluder.height,
      (iw / MASK.w) * occluder.width, (ih / MASK.h) * occluder.height, 0, 0, deerBuf.width, deerBuf.height);
    g2.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.globalAlpha = 0.92 * clamp(d.fade, 0, 1);
    ctx.drawImage(deerBuf, left, top, bw, bh);
    ctx.restore();
  }
}

// ---------- dust in the sunlight ----------

const MOTES = Array.from({ length: 46 }, () => ({ a: rnd(0, TAU), r: Math.sqrt(Math.random()), ph: rnd(0, TAU), s: rnd(0.6, 1.8), v: rnd(0.6, 1.4) }));
function drawMotes(time, calm) {
  const { W, H } = view;
  const [sx, sy] = toScreen(SUN.x, SUN.y), R = Math.min(W, H) * 0.42;
  additive(() => {
    for (const m of MOTES) {
      const t = time * 0.02 * m.v;
      const x = sx + Math.cos(m.a + t) * m.r * R * 1.3 + Math.sin(time * 0.13 * m.v + m.ph) * 12;
      const y = sy + H * 0.12 + Math.sin(m.a + t) * m.r * R * 0.5 - ((time * 4 * m.v + m.ph * 30) % 80);
      const a = (0.06 + 0.12 * calm) * (0.5 + 0.5 * Math.sin(time * 0.5 * m.v + m.ph)); // slow shimmer, no flicker
      glow(x, y, m.s * 2.2, '255,220,160', a);
    }
  });
}

// ---------- scene interface ----------

export function reset() {
  flights.length = 0;
  buzzards.length = 0;
  deer.length = 0;
  deerTimer = rnd(60, 120);
  Object.assign(timers, { single: rnd(4, 10), crows: rnd(30, 60), geese: rnd(20, 40), buzzard: rnd(25, 50) });
}

/** Each progress step: a skein of geese flies over. */
export function progress() {
  spawn('geese');
}

export function anchor() {
  const m = Math.min(view.W, view.H);
  return [view.W / 2, view.H * 0.34, clamp(m * 0.14, 56, 120)];
}

export function focus() {
  const [x, y] = toScreen(SUN.x, SUN.y), [, sky] = toScreen(0, HORIZON);
  return { x, y, flat: 1, water: 0, sky };
}

/** A lighter vignette than the painted scenes: the photo already has its own light. */
export const vignette = 0.35;

export function draw({ dt, time, calm: c, progress: pg }) {
  const { W, H } = view;
  updateWindow(time, pg);
  const level = breath.on && breath.key ? breath.level : 0.5 + 0.5 * Math.sin((time * TAU) / 10);
  if (!photoReady) {
    // While the photo loads: the colours of that morning.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#5d6b7c'); g.addColorStop(0.5, '#e0a35a'); g.addColorStop(0.62, '#3a3127'); g.addColorStop(1, '#101412');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (!gl && !glFailed) initGL();
  if (!glFailed && !texReady) uploadTexture();
  if (!glFailed) {
    avgDt = avgDt * 0.95 + Math.min(dt, 0.1) * 0.05;
    if ((checkIn -= dt) <= 0) {
      checkIn = 2;
      if (avgDt > 0.024 && quality > 0.5) quality *= 0.85;
    }
    renderGL(time, c, pg, level);
  }
  else render2D(c, level);
  if (!occluder) buildOccluder();
  updateDeer(dt);
  drawMotes(time, c);
  updateBuzzards(dt, c);
  updateBirds(dt, c);
}

/** For trying things out in the browser console: stilWater.morning.buzzard() etc. */
export const visitors = { buzzard: spawnBuzzard, geese: () => spawn('geese'), crows: () => spawn('crows'), deer: spawnDeer, toScreen, buzzards, flights, deers: deer };
