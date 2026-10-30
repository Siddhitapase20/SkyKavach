// Run: node test/engine.test.js
const SK = require('../src/engine.js');
let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log('FAIL:', msg); } };
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b}±${tol}`);

// v3 worked example: C=3, d-b = 10 m, R0 = 50 => P = 0.833
near(SK.proximity(40, 30, 50), 0.8333, 1e-3, 'proximity');
near(SK.dwellWeight(300), 1, 1e-9, 'dwell saturates at 300 s');
near(SK.dwellWeight(0), 0, 1e-9, 'dwell zero');
const ts = t => Math.min(1, 3 * SK.proximity(40, 30, 50) * SK.dwellWeight(t) * 1 * 1 * 1 / 3);
near(ts(20), 0.18, 0.01, 'TS hover 20 s'); near(ts(90), 0.48, 0.01, 'TS hover 90 s'); near(ts(180), 0.68, 0.01, 'TS hover 180 s');
// Flying directly away scores zero heading
ok(SK.headingTerm(Math.cos(Math.PI), false) === 0, 'away heading = 0');
ok(SK.headingTerm(0, true) === 1, 'circling counts fully');
ok(SK.levelOf(0.29) === 'LOW' && SK.levelOf(0.3) === 'MEDIUM' && SK.levelOf(0.6) === 'HIGH', 'thresholds');

// Zones
const sq = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const intake = { id: 'intake', c: 3, buffer: 30, R0: 50, poly: sq(300, 40, 350, 80) };
const carpark = { id: 'car', c: 1, buffer: 10, R0: 50, poly: sq(30, 200, 130, 260) };
const zones = [intake, carpark];
ok(SK.distToPoly({ x: 325, y: 60 }, intake.poly) === 0, 'inside polygon = 0');
near(SK.distToPoly({ x: 325, y: 100 }, intake.poly), 20, 1e-9, 'distance to edge');

// Pattern classification helper: sample at 0.5 s
const sample = path => path.filter((_, i) => i % 5 === 0).map((p, i) => ({ t: i * 0.5, ...p }));
const lastWin = (s, sec = 60) => s.filter(p => p.t >= s[s.length - 1].t - sec);
const transit = sample(SK.buildPath({ x: 0, y: 150, alt: 60 }, [{ to: { x: 480, y: 160 }, speed: 10 }], 2));
ok(SK.classifyPattern(lastWin(transit), []).label === 'TRANSIT', 'transit: ' + SK.classifyPattern(lastWin(transit), []).label);
const orbit = sample(SK.buildPath({ x: 400, y: 60, alt: 45 }, [{ orbit: { x: 325, y: 60 }, r: 55, turns: 2, speed: 6 }], 3));
const oc = SK.classifyPattern(lastWin(orbit), zones);
ok(oc.label === 'ORBIT', 'orbit: ' + oc.label + JSON.stringify(oc.f));
const hover = sample(SK.buildPath({ x: 325, y: 120, alt: 40 }, [{ hover: 40 }], 4));
ok(SK.classifyPattern(lastWin(hover), zones).label === 'HOVER', 'hover');
const grid = sample(SK.buildPath({ x: 200, y: 100, alt: 50 }, [{ to: { x: 300, y: 100 }, speed: 7 }, { to: { x: 300, y: 120 }, speed: 7 }, { to: { x: 200, y: 120 }, speed: 7 }, { to: { x: 200, y: 140 }, speed: 7 }, { to: { x: 300, y: 140 }, speed: 7 }, { to: { x: 300, y: 160 }, speed: 7 }, { to: { x: 200, y: 160 }, speed: 7 }], 5));
const gc = SK.classifyPattern(lastWin(grid, 60), zones);
ok(gc.label === 'SURVEY', 'survey: ' + gc.label + JSON.stringify(gc.f));
const descent = sample(SK.buildPath({ x: 325, y: 100, alt: 50 }, [{ hover: 5 }, { descend: 15, rate: 3 }], 6));
ok(SK.classifyPattern(lastWin(descent), zones).label === 'DESCENT', 'descent');
const appr = sample(SK.buildPath({ x: 325, y: 290, alt: 50 }, [{ to: { x: 325, y: 120 }, speed: 8 }], 7));
const ac = SK.classifyPattern(lastWin(appr, 15), zones);
ok(ac.label === 'APPROACH', 'approach: ' + ac.label);

// End-to-end scoring: orbit over intake climbs to HIGH; same orbit at night posture is faster
function runScore(path, posture) {
  const s = sample(path); const tr = { dwell: {} }; let firstHigh = null, maxTs = 0;
  for (let i = 1; i < s.length; i++) {
    tr.pos = s[i]; tr.vel = { x: (s[i].x - s[i - 1].x) / 0.5, y: (s[i].y - s[i - 1].y) / 0.5 };
    const pat = SK.classifyPattern(s.slice(Math.max(0, i - 90), i + 1), zones);
    const r = SK.scoreTrack(tr, { zones, posture, pattern: pat, clockSec: 0, dt: 0.5 });
    maxTs = Math.max(maxTs, r.ts);
    if (firstHigh === null && r.level === 'HIGH') firstHigh = s[i].t;
  }
  return { firstHigh, maxTs };
}
const longOrbit = SK.buildPath({ x: 420, y: 60, alt: 45 }, [{ orbit: { x: 325, y: 60 }, r: 60, turns: 6, speed: 6 }], 9);
const n = runScore(longOrbit, 'NORMAL'), h = runScore(longOrbit, 'HIGH_ALERT');
ok(n.firstHigh !== null, 'orbit reaches HIGH (normal) at ' + n.firstHigh);
ok(h.firstHigh !== null && h.firstHigh < n.firstHigh, `posture speeds HIGH: ${h.firstHigh} < ${n.firstHigh}`);
const far = runScore(SK.buildPath({ x: 0, y: 290, alt: 60 }, [{ to: { x: 160, y: 300 }, speed: 9 }], 10), 'NORMAL');
ok(far.maxTs < 0.3, 'distant transit stays LOW: ' + far.maxTs.toFixed(3));
// flying away from intake right next to it but outside buffer
const away = { pos: { x: 325, y: 130 }, vel: { x: 0, y: 8 }, dwell: {} };
const ra = SK.scoreTrack(away, { zones, posture: 'NORMAL', pattern: { label: 'TRANSIT', m: 0.6 }, dt: 0.5 });
ok(ra.perZone[0].H === 0, 'flying away H = 0');
// criticality window
const bay = { id: 'bay', c: 2, window: { from: 8, to: 18, c: 3 }, buffer: 20, R0: 50, poly: sq(0, 0, 10, 10) };
ok(SK.zoneCriticality(bay, 10 * 3600) === 3 && SK.zoneCriticality(bay, 22 * 3600) === 2, 'time-window criticality');

// Fusion
near(SK.fuse([{ w: 1, c: 0.8 }, { w: 1, c: 0.5 }]), 0.9, 1e-9, 'fusion');
near(SK.fuse([{ w: 0, c: 0.8 }, { w: 1, c: 0.5 }]), 0.5, 1e-9, 'attacked sensor drops out');
ok(SK.coordinatedAttack([{ sensor: 'cam1', t: 100 }, { sensor: 'mic', t: 120 }], 125).attack, 'co-occurrence');
ok(!SK.coordinatedAttack([{ sensor: 'cam1', t: 50 }, { sensor: 'mic', t: 120 }], 125).attack, 'outside 30 s');
// Frame metrics
const W = 64, H = 36, noisy = new Uint8ClampedArray(W * H * 4), flat = new Uint8ClampedArray(W * H * 4);
const R = SK.rng(1); for (let i = 0; i < noisy.length; i += 4) { const g = R() * 255; noisy[i] = noisy[i + 1] = noisy[i + 2] = g; noisy[i + 3] = 255; flat[i + 3] = 255; }
const mN = SK.frameMetrics(noisy, W, H), mF = SK.frameMetrics(flat, W, H);
ok(mN.entropy > 4 && mF.entropy < 0.01, 'entropy collapse when covered');
ok(SK.driftScore(mN.thumb, mN.thumb) < 1e-6, 'drift zero for same frame');
// Recon
const v = (day, b) => ({ day, hour: 23, bearing: b, pattern: 'ORBIT', zoneId: 'intake', size: 'S' });
const vs = [v(1, 40), v(3, 50), v(5, 45)];
ok(!SK.checkRecon(vs.slice(0, 2), vs[1]).recon, 'two visits not recon');
ok(SK.checkRecon(vs, vs[2]).recon, 'three similar visits = recon');
const vb = [v(1, 40), v(3, 200), v(5, 45)];
ok(!SK.checkRecon(vb, vb[2]).recon, 'different bearing breaks pattern');
// AEGL pair formula: source at 30 m between nodes 100 m apart
const PA = 1 / 30 ** 2, PB = 1 / 70 ** 2;
near(SK.aeglPair(PA, PB, 100), 30, 1e-9, 'AEGL exact');
near(SK.aeglWLS([0, 100, 200], [1 / (30 ** 2 + 1), 1 / (70 ** 2 + 1), 1 / (170 ** 2 + 1)], 0), 30, 1, 'AEGL WLS');

// Crypto + Merkle (async)
(async () => {
  const dev = await SK.createDevice('SK-EDGE-01', 'SITE-7');
  const cap = await SK.sealCapsule({ reason: 'ORBIT intake', frames: ['abc'], t: 1 }, dev);
  ok((await SK.verifyCapsule(cap, dev.cert.fingerprint)).ok, 'capsule verifies');
  const bad = JSON.parse(JSON.stringify(cap)); bad.payload.frames[0] = 'abd';
  ok(!(await SK.verifyCapsule(bad, dev.cert.fingerprint)).ok, 'tampered capsule fails');
  const forged = JSON.parse(JSON.stringify(bad)); forged.hash = await SK.sha256Hex(SK.canonical(forged.payload));
  ok(!(await SK.verifyCapsule(forged, dev.cert.fingerprint)).ok, 're-hashed forgery fails signature');
  const leaves = await Promise.all(['a', 'b', 'c', 'd', 'e'].map(x => SK.sha256Hex(x)));
  const root = await SK.merkleRoot(leaves);
  for (let i = 0; i < leaves.length; i++) ok(await SK.verifyProof(leaves[i], await SK.merkleProof(leaves, i), root), 'merkle proof ' + i);
  ok(!(await SK.verifyProof(await SK.sha256Hex('x'), await SK.merkleProof(leaves, 0), root)), 'merkle rejects outsider');
  // Red team
  const site = { w: 480, h: 300 };
  const sensors = { cams: [{ x: 240, y: 285, heading: -90, fov: 90, range: 260 }], mics: [{ x: 330, y: 100, range: 150 }] };
  const rt = SK.redTeam(zones, sensors, { trees: [{ x0: 180, y0: 60, x1: 250, y1: 110 }], treeHeight: 15 }, site, { count: 60 });
  ok(rt.heat.length === rt.cols * rt.rows && rt.suggestion && rt.perZone.intake, 'red team runs');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
