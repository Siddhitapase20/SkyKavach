/* SkyKavach core engine.
 * Pure functions: geometry, TISE 2.0 scoring, flight-pattern signatures, site posture,
 * health-weighted fusion, tamper metrics, recon memory, evidence crypto (SHA-256, ECDSA P-256,
 * Merkle anchor), red-team coverage simulation and the AEGL corridor estimator.
 * Runs in the browser (window.SK) and in Node (module.exports) so it can be unit-tested.
 * Units: metres, seconds, degrees unless stated. Coordinates: x east, y south (screen-style).
 */
(function (root) {
  'use strict';
  const SK = {};

  /* ---------------- geometry ---------------- */
  const hyp = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  function pointInPoly(p, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }
  function distToSeg(p, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y;
    const len2 = vx * vx + vy * vy;
    let t = len2 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return hyp(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
  }
  function distToPoly(p, poly) {
    if (pointInPoly(p, poly)) return 0;
    let m = Infinity;
    for (let i = 0; i < poly.length; i++) m = Math.min(m, distToSeg(p, poly[i], poly[(i + 1) % poly.length]));
    return m;
  }
  function centroid(poly) {
    let x = 0, y = 0;
    poly.forEach(p => { x += p.x; y += p.y; });
    return { x: x / poly.length, y: y / poly.length };
  }
  const wrap180 = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
  const bearing = (from, to) => Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI; // 0 = east, 90 = south
  // compass bearing (0 = north, clockwise) for human-readable output
  const compass = (from, to) => ((Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI) + 360) % 360;
  function segIntersectsRect(a, b, r) { // r: {x0,y0,x1,y1}; Liang-Barsky
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy], q = [a.x - r.x0, r.x1 - a.x, a.y - r.y0, r.y1 - a.y];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t); if (t0 > t1) return false; }
    }
    return true;
  }
  Object.assign(SK, { dist, pointInPoly, distToPoly, centroid, wrap180, bearing, compass, segIntersectsRect });

  /* ---------------- TISE 2.0 constants ---------------- */
  SK.PATTERNS = {
    TRANSIT: { m: 0.6 }, HOVER: { m: 1.0 }, ORBIT: { m: 1.3 }, SURVEY: { m: 1.3 },
    APPROACH: { m: 1.2 }, DESCENT: { m: 1.5 }, MANOEUVRE: { m: 1.0 }, UNKNOWN: { m: 1.0 }
  };
  SK.POSTURE = { NORMAL: 1.0, ELEVATED: 1.25, HIGH_ALERT: 1.5 };
  SK.THRESH = { MEDIUM: 0.30, HIGH: 0.60 };
  SK.C_MAX = 3;

  const proximity = (d, b, R0) => 1 / (1 + Math.max(0, d - b) / R0);
  const dwellWeight = t => Math.min(1, Math.log(1 + Math.max(0, t) / 30) / Math.log(11));
  function headingTerm(cosTheta, forceFull) { if (forceFull) return 1; const c = Math.max(0, cosTheta); return c * c; }
  const levelOf = ts => ts >= SK.THRESH.HIGH ? 'HIGH' : ts >= SK.THRESH.MEDIUM ? 'MEDIUM' : 'LOW';
  Object.assign(SK, { proximity, dwellWeight, headingTerm, levelOf });

  /** Criticality of a zone at a given clock time (seconds since midnight). Zones may carry
   *  a time window during which they are raised to a higher criticality. */
  function zoneCriticality(zone, clockSec) {
    if (!zone.window) return zone.c;
    const h = (clockSec / 3600) % 24, w = zone.window;
    const inWin = w.from <= w.to ? (h >= w.from && h < w.to) : (h >= w.from || h < w.to);
    return inWin ? w.c : zone.c;
  }
  SK.zoneCriticality = zoneCriticality;

  /* ---------------- Flight Pattern Signatures ---------------- */
  /** samples: [{t,x,y,alt}] spaced ~0.5 s, newest last (30-60 s window).
   *  Returns {label, m, f (features), centre}. Plain, auditable geometry rules. */
  function classifyPattern(samples, zones) {
    const n = samples.length;
    if (n < 8) return { label: 'UNKNOWN', m: 1, f: {}, centre: null };
    let L = 0, slow = 0, turn = 0, prevH = null;
    const segH = [], segLen = [];
    for (let i = 1; i < n; i++) {
      const a = samples[i - 1], b = samples[i];
      const d = dist(a, b), dt = Math.max(1e-3, b.t - a.t);
      L += d;
      if (d / dt < 0.5) slow++;
      if (d > 0.15) {
        const h = bearing(a, b);
        if (prevH !== null) turn += wrap180(h - prevH);
        prevH = h; segH.push(h); segLen.push(d);
      }
    }
    const span = samples[n - 1].t - samples[0].t;
    const N = dist(samples[0], samples[n - 1]);
    const straight = L > 1 ? N / L : 1;
    const hoverFrac = slow / (n - 1);
    const centre = { x: 0, y: 0 };
    samples.forEach(s => { centre.x += s.x; centre.y += s.y; });
    centre.x /= n; centre.y /= n;
    const radii = samples.map(s => dist(s, centre));
    const rMean = radii.reduce((a, b) => a + b, 0) / n;
    const rStd = Math.sqrt(radii.reduce((a, r) => a + (r - rMean) ** 2, 0) / n);
    const radialCV = rMean > 0 ? rStd / rMean : 1;
    // straight legs and reversals (lawn-mower survey)
    const legs = []; let cur = null;
    for (let i = 0; i < segH.length; i++) {
      if (cur && Math.abs(wrap180(segH[i] - cur.h)) < 25) { cur.len += segLen[i]; }
      else { if (cur) legs.push(cur); cur = { h: segH[i], len: segLen[i] }; }
    }
    if (cur) legs.push(cur);
    const longLegs = legs.filter(l => l.len >= 25);
    let reversals = 0;
    for (let i = 1; i < longLegs.length; i++) if (Math.abs(wrap180(longLegs[i].h - longLegs[i - 1].h)) > 150) reversals++;
    // descent over the last ~10 s
    const tail = samples.filter(s => s.t >= samples[n - 1].t - 10);
    const dAlt = tail.length > 1 ? tail[tail.length - 1].alt - tail[0].alt : 0;
    const dT = tail.length > 1 ? tail[tail.length - 1].t - tail[0].t : 1;
    const descentRate = dAlt / Math.max(1, dT);
    // approach: heading convergence to some zone over the last 10 s
    let approach = false;
    if (zones && zones.length && tail.length > 4 && dT >= 9) {
      const a = tail[0], b = tail[tail.length - 1];
      const sp = dist(a, b) / dT;
      if (sp > 1) {
        const h = bearing(a, b);
        approach = zones.some(z => {
          const c = centroid(z.poly);
          if (distToPoly(b, z.poly) < 1) return false;
          const cos = Math.cos(wrap180(bearing(b, c) - h) * Math.PI / 180);
          return cos > 0.894; // H = cos^2 > 0.8
        });
      }
    }
    const f = { straight: +straight.toFixed(2), hoverFrac: +hoverFrac.toFixed(2), turnDeg: Math.round(Math.abs(turn)), radialCV: +radialCV.toFixed(2), reversals, descentRate: +descentRate.toFixed(2), span: +span.toFixed(1) };
    let label = 'MANOEUVRE';
    if (descentRate < -1.0 && dAlt < -8) label = 'DESCENT';
    else if (hoverFrac > 0.6) label = 'HOVER';
    else if (Math.abs(turn) >= 300 && radialCV < 0.35) label = 'ORBIT';
    else if (reversals >= 2) label = 'SURVEY';
    else if (approach) label = 'APPROACH';
    else if (straight > 0.9) label = 'TRANSIT';
    return { label, m: SK.PATTERNS[label].m, f, centre: label === 'ORBIT' ? centre : null };
  }
  SK.classifyPattern = classifyPattern;

  /* ---------------- TISE 2.0 scoring ---------------- */
  /** Score one track against every zone.
   *  track: {pos:{x,y}, vel:{x,y}, dwell:{zoneId:sec}}  (dwell is mutated: +dt when inside alert radius,
   *  decays at 2x when outside)
   *  ctx: {zones, posture('NORMAL'|...), pattern(result of classifyPattern), clockSec, dt}
   *  Returns {ts, level, best:{zone,...}, perZone[], eta}. */
  function scoreTrack(track, ctx) {
    const K = SK.POSTURE[ctx.posture] || 1;
    const pat = ctx.pattern || { label: 'UNKNOWN', m: 1 };
    const speed = hyp(track.vel.x, track.vel.y);
    const hovering = speed < 0.5;
    const h = bearing({ x: 0, y: 0 }, track.vel);
    track.dwell = track.dwell || {};
    const perZone = ctx.zones.map(z => {
      const C = zoneCriticality(z, ctx.clockSec || 0);
      const d = distToPoly(track.pos, z.poly);
      const cen = centroid(z.poly);
      const alertRadius = z.buffer + z.R0;
      const prev = track.dwell[z.id] || 0;
      track.dwell[z.id] = d <= alertRadius ? prev + (ctx.dt || 0) : Math.max(0, prev - 2 * (ctx.dt || 0));
      const t = track.dwell[z.id];
      const cos = hovering ? 1 : Math.cos(wrap180(bearing(track.pos, cen) - h) * Math.PI / 180);
      const insideBuffer = d <= z.buffer;
      const orbiting = pat.label === 'ORBIT' && pat.centre && distToPoly(pat.centre, z.poly) <= z.buffer + z.R0;
      const P = proximity(d, z.buffer, z.R0);
      const D = dwellWeight(t);
      const H = headingTerm(cos, hovering || orbiting || insideBuffer);
      const S = C * P * D * H * pat.m * K;
      let eta = null;
      if (!insideBuffer && !hovering && cos > 0.3) eta = (d - z.buffer) / (speed * cos);
      if (insideBuffer) eta = 0;
      return { zone: z, C, d, dwell: t, P, D, H, M: pat.m, K, S, cos, eta };
    });
    let best = null;
    perZone.forEach(r => { if (!best || r.S > best.S) best = r; });
    const ts = best ? Math.min(1, best.S / SK.C_MAX) : 0;
    return { ts, level: levelOf(ts), best, perZone, eta: best ? best.eta : null, pattern: pat.label, posture: ctx.posture };
  }
  SK.scoreTrack = scoreTrack;

  /* ---------------- KavachShield ---------------- */
  /** Health-weighted noisy-OR fusion. sensors: [{w (1|0.5|0), c (0..1)}] */
  SK.fuse = sensors => 1 - sensors.reduce((p, s) => p * (1 - s.w * s.c), 1);
  SK.HEALTH_W = { HEALTHY: 1, ANOMALY: 0.5, ATTACK: 0 };

  /** Frame metrics from RGBA pixel data. Returns grey-histogram entropy (bits, 0..5 with 32 bins),
   *  variance, mean, and a 32x18 grey thumbnail for drift checks. */
  function frameMetrics(data, w, h) {
    const bins = new Array(32).fill(0);
    let sum = 0, sum2 = 0, cnt = 0, sat = 0;
    const TW = 32, TH = 18, thumb = new Float32Array(TW * TH), tc = new Float32Array(TW * TH);
    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        bins[Math.min(31, g >> 3)]++; sum += g; sum2 += g * g; cnt++; if (g > 245) sat++;
        const ti = Math.min(TH - 1, Math.floor(y / h * TH)) * TW + Math.min(TW - 1, Math.floor(x / w * TW));
        thumb[ti] += g; tc[ti]++;
      }
    }
    for (let i = 0; i < thumb.length; i++) thumb[i] = tc[i] ? thumb[i] / tc[i] : 0;
    let ent = 0;
    bins.forEach(b => { if (b) { const p = b / cnt; ent -= p * Math.log2(p); } });
    const mean = sum / cnt;
    return { entropy: ent, variance: sum2 / cnt - mean * mean, mean, thumb, satFrac: sat / cnt };
  }
  /** 1 - normalised cross-correlation between two thumbnails (0 = same scene, ~1 = different). */
  function driftScore(a, b) {
    const n = a.length; let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
    if (da < 1e-6 || db < 1e-6) return 1;
    return 1 - num / Math.sqrt(da * db);
  }
  /** Rolling baseline: keeps the last `size` values, flags |x-mean| > k*sigma (with a floor). */
  class Baseline {
    constructor(size = 120, k = 3, floor = 0.05) { this.v = []; this.size = size; this.k = k; this.floor = floor; }
    push(x) { this.v.push(x); if (this.v.length > this.size) this.v.shift(); }
    stats() { const n = this.v.length; if (!n) return { mean: 0, sd: 0, n }; const m = this.v.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(this.v.reduce((a, b) => a + (b - m) ** 2, 0) / n); return { mean: m, sd, n }; }
    z(x) { const s = this.stats(); return (x - s.mean) / Math.max(s.sd, this.floor * Math.abs(s.mean) + 1e-6); }
    anomalous(x, minN = 10) { return this.v.length >= minN && Math.abs(this.z(x)) > this.k; }
  }
  /** Co-occurrence rule: anomalies on >=2 distinct sensors within `windowSec` => coordinated attack. */
  function coordinatedAttack(anomalies, now, windowSec = 30) {
    const recent = anomalies.filter(a => now - a.t <= windowSec);
    const ids = [...new Set(recent.map(a => a.sensor))];
    return { attack: ids.length >= 2, sensors: ids };
  }
  Object.assign(SK, { frameMetrics, driftScore, Baseline, coordinatedAttack });

  /* ---------------- Recon Memory ---------------- */
  /** visit: {day, hour, bearing (compass deg of arrival), pattern, zoneId, size} */
  function visitSimilarity(a, b) {
    const db = Math.abs(wrap180(a.bearing - b.bearing));
    let dh = Math.abs(a.hour - b.hour); dh = Math.min(dh, 24 - dh);
    return (db <= 30 ? 0.3 : db <= 60 ? 0.15 : 0) + (dh <= 1 ? 0.2 : dh <= 2 ? 0.1 : 0) +
      (a.pattern === b.pattern ? 0.2 : 0) + (a.zoneId === b.zoneId ? 0.2 : 0) + (a.size === b.size ? 0.1 : 0);
  }
  /** Returns {recon, matches[]}: recon if this visit plus >=2 earlier similar visits fall in the last 7 days. */
  function checkRecon(visits, v, threshold = 0.75) {
    const matches = visits.filter(o => o !== v && v.day - o.day <= 7 && v.day - o.day >= 0 && visitSimilarity(o, v) >= threshold);
    return { recon: matches.length + 1 >= 3, matches };
  }
  Object.assign(SK, { visitSimilarity, checkRecon });

  /* ---------------- Evidence: canonical JSON, SHA-256, ECDSA, Merkle ---------------- */
  function canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  const subtle = () => (root.crypto || globalThis.crypto).subtle;
  const enc = s => new TextEncoder().encode(s);
  const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = h => new Uint8Array(h.match(/.{2}/g).map(x => parseInt(x, 16)));
  const toB64 = buf => { let s = ''; new Uint8Array(buf).forEach(b => { s += String.fromCharCode(b); }); return btoa(s); };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function sha256Hex(data) { return toHex(await subtle().digest('SHA-256', typeof data === 'string' ? enc(data) : data)); }
  async function createDevice(deviceId, siteId) {
    const kp = await subtle().generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await subtle().exportKey('jwk', kp.publicKey);
    const pub = { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
    const fingerprint = (await sha256Hex(canonical(pub))).slice(0, 32);
    return { keyPair: kp, cert: { deviceId, siteId, alg: 'ECDSA-P256-SHA256', publicKey: pub, fingerprint, keyStore: 'browser soft key (ATECC608A in hardware build)' } };
  }
  async function signHex(privateKey, hex) {
    return toB64(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, fromHex(hex)));
  }
  async function verifySig(pubJwk, hex, sigB64) {
    try {
      const key = await subtle().importKey('jwk', Object.assign({ ext: true, key_ops: ['verify'] }, pubJwk), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      return await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, fromB64(sigB64), fromHex(hex));
    } catch (e) { return false; }
  }
  /** Seal: hash = SHA-256(canonical(payload)); signature = ECDSA(hash). */
  async function sealCapsule(payload, device) {
    const hash = await sha256Hex(canonical(payload));
    const signature = await signHex(device.keyPair.privateKey, hash);
    return { version: 'SKC-1', payload, hash, signature, cert: device.cert };
  }
  /** Independent verification: needs only the capsule and (optionally) the registered fingerprint. */
  async function verifyCapsule(capsule, registeredFingerprint) {
    const steps = [];
    const hash = await sha256Hex(canonical(capsule.payload));
    steps.push({ step: 'Content hash matches', ok: hash === capsule.hash, detail: hash.slice(0, 16) + '…' });
    const fp = (await sha256Hex(canonical(capsule.cert.publicKey))).slice(0, 32);
    steps.push({ step: 'Device key matches certificate fingerprint', ok: fp === capsule.cert.fingerprint && (!registeredFingerprint || fp === registeredFingerprint), detail: fp.slice(0, 16) + '…' });
    const sigOk = await verifySig(capsule.cert.publicKey, capsule.hash, capsule.signature);
    steps.push({ step: 'Device signature valid', ok: sigOk, detail: capsule.cert.deviceId });
    return { ok: steps.every(s => s.ok), steps, recomputed: hash };
  }
  async function merkleRoot(leaves) {
    if (!leaves.length) return null;
    let level = leaves.slice();
    while (level.length > 1) {
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(await sha256Hex(level[i] + (level[i + 1] || level[i])));
      level = next;
    }
    return level[0];
  }
  async function merkleProof(leaves, idx) {
    const proof = []; let level = leaves.slice(), i = idx;
    while (level.length > 1) {
      const sib = i % 2 ? i - 1 : i + 1;
      proof.push({ hash: level[sib] !== undefined ? level[sib] : level[i], left: i % 2 === 1 });
      const next = [];
      for (let k = 0; k < level.length; k += 2) next.push(await sha256Hex(level[k] + (level[k + 1] || level[k])));
      level = next; i = Math.floor(i / 2);
    }
    return proof;
  }
  async function verifyProof(leaf, proof, root) {
    let h = leaf;
    for (const p of proof) h = await sha256Hex(p.left ? p.hash + h : h + p.hash);
    return h === root;
  }
  Object.assign(SK, { canonical, sha256Hex, createDevice, sealCapsule, verifyCapsule, merkleRoot, merkleProof, verifyProof, signHex, verifySig });

  /* ---------------- AEGL corridor acoustic mesh ---------------- */
  /** Source between nodes A and B (spacing D), received powers PA, PB, inverse-square law. */
  SK.aeglPair = (PA, PB, D) => D * Math.sqrt(PB) / (Math.sqrt(PA) + Math.sqrt(PB));
  /** Weighted least squares along the corridor line: for each candidate x the unknown source
   *  strength S has a closed-form log-domain fit; weights = received power (stronger = more trusted). */
  SK.aeglWLS = function (nodeX, powers, lateral = 0, xmin, xmax, step = 0.5) {
    let best = { x: null, err: Infinity };
    const lo = xmin !== undefined ? xmin : Math.min(...nodeX), hi = xmax !== undefined ? xmax : Math.max(...nodeX);
    const w = powers.map(p => Math.max(p, 1e-12)); const W = w.reduce((a, b) => a + b, 0);
    for (let x = lo; x <= hi; x += step) {
      const pred = nodeX.map(nx => -Math.log((nx - x) ** 2 + lateral * lateral + 1));
      const logs = powers.map(p => Math.log(Math.max(p, 1e-12)));
      const s = logs.reduce((a, l, i) => a + w[i] * (l - pred[i]), 0) / W;
      const err = logs.reduce((a, l, i) => a + w[i] * (l - pred[i] - s) ** 2, 0);
      if (err < best.err) best = { x, err };
    }
    return best.x;
  };

  /* ---------------- seeded random + path builder ---------------- */
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  SK.rng = rng;
  /** Build a sampled path (dt = 0.1 s) from segments:
   *  {to:{x,y}, speed, alt?} line · {orbit:{x,y}, r, turns, speed} · {hover:sec} · {descend:toAlt, rate}
   *  · {climb:toAlt, rate}. Adds small seeded jitter so tracks look real. */
  function buildPath(start, segs, seed = 1, jitter = 0.25) {
    const R = rng(seed), dt = 0.1, out = [];
    let p = { x: start.x, y: start.y, alt: start.alt || 40 };
    const push = () => out.push({ x: p.x + (R() - 0.5) * jitter, y: p.y + (R() - 0.5) * jitter, alt: p.alt });
    push();
    segs.forEach(s => {
      if (s.to) {
        const d = dist(p, s.to), n = Math.max(1, Math.round(d / (s.speed * dt)));
        const a0 = p.alt, a1 = s.alt !== undefined ? s.alt : p.alt, x0 = p.x, y0 = p.y;
        for (let i = 1; i <= n; i++) { p = { x: x0 + (s.to.x - x0) * i / n, y: y0 + (s.to.y - y0) * i / n, alt: a0 + (a1 - a0) * i / n }; push(); }
      } else if (s.orbit) {
        const c = s.orbit, a0 = Math.atan2(p.y - c.y, p.x - c.x), r = s.r;
        const total = 2 * Math.PI * s.turns * (s.dir || 1), n = Math.round(Math.abs(total) * r / (s.speed * dt));
        // glide onto the circle first
        const entry = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
        const de = dist(p, entry), ne = Math.round(de / (s.speed * dt)), x0 = p.x, y0 = p.y;
        for (let i = 1; i <= ne; i++) { p = { x: x0 + (entry.x - x0) * i / ne, y: y0 + (entry.y - y0) * i / ne, alt: p.alt }; push(); }
        for (let i = 1; i <= n; i++) { const a = a0 + total * i / n; p = { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a), alt: p.alt }; push(); }
      } else if (s.hover) {
        const n = Math.round(s.hover / dt); for (let i = 0; i < n; i++) push();
      } else if (s.descend !== undefined || s.climb !== undefined) {
        const target = s.descend !== undefined ? s.descend : s.climb, n = Math.max(1, Math.round(Math.abs(p.alt - target) / (s.rate * dt))), a0 = p.alt;
        for (let i = 1; i <= n; i++) { p = { x: p.x, y: p.y, alt: a0 + (target - a0) * i / n }; push(); }
      }
    });
    return out;
  }
  SK.buildPath = buildPath;

  /* ---------------- Red-team coverage simulation ---------------- */
  /** Per-step (0.5 s) detection probability of a point at altitude alt by the sensor set. */
  function detectProb(pt, alt, sensors, env) {
    const probs = [];
    (sensors.cams || []).forEach(c => {
      if (c.health === 0) return;
      const d = dist(c, pt); if (d > c.range) return;
      const off = Math.abs(wrap180(bearing(c, pt) - c.heading)); if (off > c.fov / 2) return;
      if (alt < (env.treeHeight || 15) && (env.trees || []).some(t => segIntersectsRect(c, pt, t))) return;
      let p = 0.9 * Math.sqrt(1 - d / c.range);
      if (env.sunBearing !== undefined && Math.abs(wrap180(c.heading - env.sunBearing)) < 30) p *= 0.3;
      probs.push(p * (c.health === undefined ? 1 : c.health));
    });
    (sensors.mics || []).forEach(m => {
      if (m.health === 0) return;
      const d = dist(m, pt); if (d > m.range) return;
      probs.push(0.5 * (1 - d / m.range) * (m.health === undefined ? 1 : m.health));
    });
    return 1 - probs.reduce((a, p) => a * (1 - p), 1);
  }
  SK.detectProb = detectProb;
  /** Attack library paths toward a target zone from a bearing (deg, screen frame) at range. */
  function attackPaths(zones, site, count, seed) {
    const R = rng(seed), out = [];
    const crit = zones.filter(z => z.c >= 2);
    const kinds = ['straight', 'low', 'orbit', 'survey', 'flank'];
    for (let i = 0; i < count; i++) {
      const z = crit[i % crit.length], c = centroid(z.poly), kind = kinds[Math.floor(R() * kinds.length)];
      const ang = R() * Math.PI * 2, r0 = Math.max(site.w, site.h) * 0.75;
      const start = { x: c.x + r0 * Math.cos(ang), y: c.y + r0 * Math.sin(ang), alt: kind === 'low' ? 10 : 30 + R() * 30 };
      let segs;
      if (kind === 'orbit') segs = [{ orbit: c, r: z.buffer + 15, turns: 1, speed: 6 }];
      else if (kind === 'survey') segs = [{ to: { x: c.x - 60, y: c.y - 40 }, speed: 7 }, { to: { x: c.x + 60, y: c.y - 40 }, speed: 6 }, { to: { x: c.x + 60, y: c.y }, speed: 6 }, { to: { x: c.x - 60, y: c.y }, speed: 6 }, { to: { x: c.x - 60, y: c.y + 40 }, speed: 6 }, { to: { x: c.x + 60, y: c.y + 40 }, speed: 6 }];
      else if (kind === 'flank') { const side = { x: c.x + r0 * 0.5 * Math.cos(ang + 1.2), y: c.y + r0 * 0.5 * Math.sin(ang + 1.2) }; segs = [{ to: side, speed: 9 }, { to: c, speed: 8 }]; }
      else segs = [{ to: c, speed: kind === 'low' ? 7 : 10 }];
      const pts = buildPath(start, segs, 1000 + i, 0).filter((_, k) => k % 5 === 0); // 0.5 s steps
      out.push({ kind, zone: z, pts });
    }
    return out;
  }
  /** Runs the attack library through the sensor model. Returns per-cell coverage heat,
   *  per-zone warning time, undetected share, and a greedy suggestion for one more acoustic node. */
  function redTeam(zones, sensors, env, site, opts = {}) {
    const cell = opts.cell || 20, count = opts.count || 300;
    const cols = Math.ceil(site.w / cell), rows = Math.ceil(site.h / cell);
    const heat = new Float32Array(cols * rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) heat[r * cols + c] = detectProb({ x: (c + 0.5) * cell, y: (r + 0.5) * cell }, 30, sensors, env);
    const paths = attackPaths(zones, site, count, opts.seed || 7);
    const perZone = {}; const miss = new Float32Array(cols * rows);
    const evalPath = (pts, sens) => {
      let pMiss = 1, firstDet = null, arrive = null;
      for (let k = 0; k < pts.length; k++) {
        const pt = pts[k];
        pMiss *= 1 - detectProb(pt, pt.alt, sens, env);
        if (firstDet === null && pMiss <= 0.1) firstDet = k * 0.5;
        if (arrive === null && distToPoly(pt, paths.zoneRef.poly) <= paths.zoneRef.buffer) arrive = k * 0.5;
      }
      return { firstDet, arrive };
    };
    paths.forEach(p => {
      paths.zoneRef = p.zone;
      const r = evalPath(p.pts, sensors);
      const zr = perZone[p.zone.id] || (perZone[p.zone.id] = { zone: p.zone, n: 0, undetected: 0, warn: [] });
      zr.n++;
      if (r.arrive !== null) {
        if (r.firstDet === null || r.firstDet > r.arrive) { zr.undetected++; zr.warn.push(0); }
        else zr.warn.push(r.arrive - r.firstDet);
      }
      // mark the cells where the drone was still unseen
      let pMiss = 1;
      for (const pt of p.pts) {
        pMiss *= 1 - detectProb(pt, pt.alt, sensors, env);
        if (pMiss > 0.5) { const cc = Math.floor(pt.x / cell), rr = Math.floor(pt.y / cell); if (cc >= 0 && rr >= 0 && cc < cols && rr < rows) miss[rr * cols + cc]++; }
      }
    });
    Object.values(perZone).forEach(z => { z.medianWarn = z.warn.length ? z.warn.slice().sort((a, b) => a - b)[Math.floor(z.warn.length / 2)] : null; });
    // greedy placement of one acoustic node: maximise covered "unseen" weight
    let bestSpot = null;
    for (let r = 0; r < rows; r += 1) for (let c = 0; c < cols; c += 1) {
      const spot = { x: (c + 0.5) * cell, y: (r + 0.5) * cell };
      let gain = 0;
      for (let i = 0; i < miss.length; i++) {
        if (!miss[i]) continue;
        const pt = { x: (i % cols + 0.5) * cell, y: (Math.floor(i / cols) + 0.5) * cell };
        const d = dist(spot, pt); if (d < 150) gain += miss[i] * 0.5 * (1 - d / 150);
      }
      if (!bestSpot || gain > bestSpot.gain) bestSpot = { ...spot, gain };
    }
    return { cols, rows, cell, heat, miss, perZone, suggestion: bestSpot, paths: paths.length };
  }
  SK.redTeam = redTeam;

  if (typeof module !== 'undefined' && module.exports) module.exports = SK;
  else root.SK = SK;
})(typeof window !== 'undefined' ? window : globalThis);
