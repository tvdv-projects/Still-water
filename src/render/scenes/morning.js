// Ochtend: a misty field at sunrise, from Thomas' own photo (assets/ochtend.jpg, 4032 × 3024).
//
// The photo is the scene; everything that moves is added on top of it, in the photo itself:
//  - WebGL: grass and bushes swaying in the wind (a small displacement, only on vegetation, more in
//    the foreground than far away, never on the path), mist drifting through the field, the sun's
//    glow breathing with you, light shafts through the mist, and the high clouds drifting.
//  - Canvas 2D: distant birds, skeins of geese and a pair of crows flying over (their calls come from
//    where they fly), and specks of dust drifting in the low sunlight.
// Calm brings warmth and light: the mist thins, the sun breaks through. Each progress step sends a
// skein of geese over.
//
// Coordinates in the photo are normalised (0..1, y down). Measured on the photo:
//  sun (0.607, 0.486) · treeline 0.52–0.56 · mist line 0.585 · ground from 0.59
//  the path: centre 0.47 + (y − 0.6)·0.15, half width 0.025 + (y − 0.6)·0.54

import { audio } from '../../audio/engine.js';
import { clamp, rnd, TAU } from '../../core/math.js';
import { gust } from '../../core/wind.js';
import { breath } from '../../state.js';
import { additive, ctx, glow, reducedMotion, view } from '../context.js';

const IMG_W = 4032, IMG_H = 3024, IMG_ASPECT = IMG_W / IMG_H;
const SUN = { x: 0.607, y: 0.486 };
const HORIZON = 0.535; // top of the treeline: birds stay above it
const FOCUS = { landscape: { x: 0.56, y: 0.55 }, portrait: { x: 0.56, y: 0.5 } };

const photo = new Image();
let photoReady = false;
photo.decoding = 'async';
photo.onload = () => { photoReady = true; };
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
uniform float uT, uCalm, uBreath, uProg, uGust, uMotion;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= .5; } return v; }
vec3 screen(vec3 a, vec3 b){ return 1. - (1.-a)*(1.-b); }

void main(){
  vec2 uv = uWin.xy + vUv*uWin.zw;

  // Wind: only on vegetation, stronger close by, never on the path.
  float pc = 0.47 + (uv.y-0.6)*0.15;
  float pw = 0.025 + max(uv.y-0.6, 0.)*0.54;
  float offPath = smoothstep(pw*0.8, pw*1.3, abs(uv.x-pc));
  float ground = smoothstep(0.575, 0.62, uv.y);
  float bush = smoothstep(0.765, 0.79, uv.x) * (1.-smoothstep(0.95, 0.975, uv.x)) * smoothstep(0.53, 0.56, uv.y);
  float veg = max(ground*offPath, bush*(1.-smoothstep(0.7, 0.75, uv.y)));
  float depth = mix(0.2, 1.0, smoothstep(0.58, 1.0, uv.y));
  float sway = fbm(vec2(uv.x*5. - uT*0.32*(0.6+uGust), uv.y*2.5)) - 0.5;
  float flutter = noise(vec2(uv.x*38. - uT*1.3, uv.y*22. + uT*0.2)) - 0.5;
  vec2 disp = vec2(sway*0.0035 + flutter*0.0011*uGust, abs(flutter)*0.0005) * depth * (0.35 + uGust) * veg * uMotion;

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
  U = Object.fromEntries(['uImg', 'uWin', 'uSun', 'uT', 'uCalm', 'uBreath', 'uProg', 'uGust', 'uMotion'].map((n) => [n, gl.getUniformLocation(prog, n)]));
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
  gl.uniform1f(U.uGust, gust(time));
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
const timers = { single: 8, crows: 40, geese: 25 };

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
    const n = 1 + ((Math.random() * 3) | 0), s = clamp(W * 0.0028, 2.5, 5);
    f.span = s; f.speed = W * rnd(0.06, 0.1); f.flap = rnd(7, 9); f.y = rnd(top, low); f.glide = true;
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
}

function updateBirds(dt, calm) {
  const { W } = view;
  for (const k of Object.keys(timers)) timers[k] -= dt;
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
      if (f.glide) {
        // Small birds: bursts of quick flaps, then a short glide with folded wings.
        const cyc = (f.t + m.ph) % 1.6;
        wing = cyc < 0.9 ? Math.sin((f.t + m.ph) * f.flap * TAU) : -0.15;
      } else wing = Math.sin((f.t + m.ph / TAU) * f.flap * TAU + m.ph);
      drawBird(f.x + f.dir * m.dx, f.y + m.dy, f.span, wing, f.dir, f.kind === 'geese', color);
    }
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
  Object.assign(timers, { single: rnd(4, 10), crows: rnd(30, 60), geese: rnd(20, 40) });
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
  drawMotes(time, c);
  updateBirds(dt, c);
}
