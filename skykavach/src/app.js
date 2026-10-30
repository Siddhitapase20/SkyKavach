/* SkyKavach command centre. Depends on window.SK (engine.js) and window.SKDATA (data.js). */
(function () {
  'use strict';
  const { SITE, ZONES, SENSORS, PERMITS, SOP, T, SCENARIOS, SKY_CALENDAR } = window.SKDATA;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fill = (s, m) => s.replace(/\{(\w+)\}/g, (_, k) => m[k] !== undefined ? m[k] : '');
  const L = o => (o && (o[S.lang] || o.en)) || '';
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COLORS = {};
  const setHTML = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
  const pad = n => String(n).padStart(2, '0');
  const clockStr = sec => { sec = ((sec % 86400) + 86400) % 86400; return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor(sec / 60) % 60)}:${pad(Math.floor(sec % 60))}`; };
  const hourOf = sec => ((sec / 3600) % 24 + 24) % 24;

  /* ---------------- state ---------------- */
  const S = {
    t: 0, speed: 1, running: true, day: 1, clockBase: SITE.startClock, dateBase: new Date(SITE.startDate + 'T00:00:00'),
    lang: 'en', role: 'Supervisor', userName: '', sessions: [], siteName: SITE.name, cf: { drawing: false, pts: [] }, whyOpen: false, voiceURI: '', sound: false, truth: false,
    zones: clone(ZONES), permits: clone(PERMITS), sensors: clone(SENSORS), sop: clone(SOP),
    manualPosture: 'NORMAL', reconUntilDay: null, nightSchedule: false, postureLog: [], lastPosture: 'NORMAL',
    tracks: [], trackSeq: 1, selectedId: null,
    alerts: [], alertSeq: 1, sms: [],
    attacks: { cover: false, laser: false, turn: false, micFlood: false, micMute: false, power: false },
    health: {}, anomalies: [], attackAlertActive: false, lastCheck: -99, mic: {}, hb: {},
    pow: { checks: {}, gaps: [] }, powLogs: [], drills: [],
    frameMeta: [], frames: [], retentionSec: 86400, purged: 0, lastFrameT: -1,
    capsules: [], pendingSeals: [], anchors: [], access: [], selectedCap: null,
    visits: [], reconFlags: new Set(), labels: [], skyCal: clone(SKY_CALENDAR), dateOffsetDays: 0,
    device: null, scenario: null, reconRun: 0, reconNextAt: null, decoyFlags: new Set(),
    camRef: null, camBase: { ent: new SK.Baseline(60, 3, 0.03), var: new SK.Baseline(60, 3, 0.05) }, horizon: 122
  };
  ['cam1', 'cam2', 'micA', 'micB'].forEach(id => { S.health[id] = { state: 'HEALTHY', w: 1, why: '', okRun: 0, since: 0, sees: true, metrics: {} }; S.pow.checks[id] = { n: 0, ok: 0 }; });
  ['micA', 'micB'].forEach(id => { S.mic[id] = { base: new SK.Baseline(60, 3, 0.02), recent: [], rms: 38 }; S.hb[id] = { last: 0, lat: 60, lastGasp: false }; });

  const nowClock = () => S.clockBase + S.t;
  const siteTime = () => clockStr(nowClock());
  const siteDate = () => { const d = new Date(S.dateBase); d.setDate(d.getDate() + S.day - 1 + S.dateOffsetDays + Math.floor(nowClock() / 86400)); return d; };
  const zoneById = id => S.zones.find(z => z.id === id);
  const sensorName = id => ({ cam1: 'Camera 1', cam2: 'Camera 2', micA: 'Acoustic Node A', micB: 'Acoustic Node B' })[id] || id;
  const sensorNameL = id => S.lang === 'en' ? sensorName(id) : ({ cam1: 'कॅमेरा १', cam2: 'कॅमेरा २', micA: 'ध्वनी नोड A', micB: 'ध्वनी नोड B' })[id];

  /* ---------------- RBAC ---------------- */
  const ROLES = ['Guard', 'Supervisor', 'Admin', 'Police'];
  const PERMS = {
    'alert.ack': [['Guard', 'Supervisor', 'Admin'], 'Acknowledge alerts'],
    'alert.label': [['Guard', 'Supervisor', 'Admin'], 'Label alerts (drone / bird / kite)'],
    'permit.confirm': [['Supervisor', 'Admin'], 'Confirm an authorised flight'],
    'posture.set': [['Supervisor', 'Admin'], 'Raise site posture, night schedule'],
    'zone.edit': [['Supervisor', 'Admin'], 'Paint and edit zones'],
    'permit.edit': [['Supervisor', 'Admin'], 'Add flight permit windows'],
    'sop.edit': [['Supervisor', 'Admin'], 'Edit SOP / Action Card'],
    'privacy.edit': [['Admin'], 'Privacy mask and retention policy'],
    'drill.run': [['Supervisor', 'Admin'], 'Run Kavach Drill'],
    'pow.seal': [['Supervisor', 'Admin'], 'Seal Proof-of-Watch log'],
    'evidence.view': [['Supervisor', 'Admin', 'Police'], 'Open evidence capsules and frames'],
    'evidence.verify': [['Guard', 'Supervisor', 'Admin', 'Police'], 'Verify capsule signatures'],
    'evidence.report': [['Supervisor', 'Admin', 'Police'], 'Open bilingual incident report'],
    'evidence.export': [['Supervisor', 'Admin', 'Police'], 'Export capsules'],
    'evidence.anchor': [['Supervisor', 'Admin'], 'Send daily Merkle anchor'],
    'evidence.tamper': [['Admin'], 'Tamper test (demo only)'],
    'redteam.run': [['Admin'], 'Run blind-spot test'],
    'demo.control': [['Supervisor', 'Admin'], 'Run demo scenarios, custom flights and sensor attacks'],
    'users.view': [['Admin'], 'See users and audit log']
  };
  const can = p => !PERMS[p] || PERMS[p][0].includes(S.role);
  function need(p) { if (can(p)) return true; toast(`Not allowed for ${S.role}: needs ${PERMS[p][0].join(' / ')}`); access('denied: ' + PERMS[p][1]); return false; }
  function applyRoleUI() {
    $$('[data-roles]').forEach(el => { el.hidden = !el.dataset.roles.split(',').includes(S.role); });
    $('#phoneSup').hidden = S.role === 'Guard';
    $('#userName').textContent = S.userName || '—'; $('#userRole').textContent = S.role === 'Police' ? 'Police (auditor)' : S.role;
    const tab = $(`#tabs [data-view="${curView}"]`);
    if (tab && tab.hidden) setView('live');
    applyRBAC();
  }
  function applyRBAC() {
    $$('[data-perm]').forEach(el => {
      const ok = can(el.dataset.perm);
      if ('disabled' in el) el.disabled = !ok;
      el.classList.toggle('locked', !ok);
      if (!ok) el.title = 'Needs ' + PERMS[el.dataset.perm][0].join(' / '); else if (el.title && el.title.startsWith('Needs ')) el.title = '';
    });
    const m = $('#rbacMatrix');
    if (m) setHTML(m, `<thead><tr><th>Permission</th>${ROLES.map(r => `<th class="num${r === S.role ? ' cur' : ''}">${r === 'Police' ? 'Police (auditor)' : r}</th>`).join('')}</tr></thead><tbody>${Object.values(PERMS).map(([roles, label]) => `<tr><td>${esc(label)}</td>${ROLES.map(r => `<td class="num${r === S.role ? ' cur' : ''}">${roles.includes(r) ? '<span class="ok">✓</span>' : '<span class="faint">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody>`);
  }

  /* ---------------- posture ---------------- */
  const POSTURE_ORDER = ['NORMAL', 'ELEVATED', 'HIGH_ALERT'];
  function effectivePosture() {
    let p = S.manualPosture, why = S.manualPosture === 'NORMAL' ? 'default' : 'set by supervisor';
    const raise = (lv, w) => { if (POSTURE_ORDER.indexOf(lv) > POSTURE_ORDER.indexOf(p)) { p = lv; why = w; } };
    if (S.reconUntilDay !== null && S.day <= S.reconUntilDay) raise('ELEVATED', 'Recon Memory (7 days)');
    const h = hourOf(nowClock());
    if (S.nightSchedule && (h >= 22 || h < 5)) raise('ELEVATED', 'night schedule');
    return { p, why };
  }
  function logPosture(by, why) {
    const e = effectivePosture();
    if (e.p !== S.lastPosture || by) {
      S.postureLog.unshift({ day: S.day, time: siteTime(), p: e.p, by: by || 'system', why: why || e.why });
      S.lastPosture = e.p; dirty.memory = true;
    }
  }

  /* ---------------- sensors & fusion ---------------- */
  function camCanSee(cam, p, alt) {
    const d = SK.dist(cam, p); if (d > cam.range) return 0;
    const off = Math.abs(SK.wrap180(SK.bearing(cam, p) - camHeading(cam))); if (off > cam.fov / 2) return 0;
    if (alt < SITE.treeHeight && SITE.trees.some(t => SK.segIntersectsRect(cam, p, t))) return 0;
    return Math.sqrt(1 - d / cam.range);
  }
  const camHeading = cam => cam.id === 'cam1' && S.attacks.turn ? cam.heading + 75 : cam.heading;
  function trackConfidence(tr) {
    const parts = [];
    S.sensors.cams.forEach(c => {
      const h = S.health[c.id];
      const geo = camCanSee(c, tr.pos, tr.alt);
      const sees = h.sees !== false;
      parts.push({ id: c.id, w: h.w, c: sees ? tr.conf * geo : 0, note: !sees ? 'not seeing' : geo ? '' : 'out of view' });
    });
    S.sensors.mics.forEach(m => {
      const h = S.health[m.id], d = SK.dist(m, tr.pos);
      const motor = (tr.trueCls || tr.cls) === 'drone';
      const alive = !(m.id === 'micA' && (S.attacks.power || S.attacks.micMute || S.attacks.micFlood));
      const c = motor && alive && d < m.range ? 0.6 * (1 - d / m.range) : 0;
      parts.push({ id: m.id, w: h.w, c, note: !alive ? 'not hearing' : !motor ? 'no motor sound' : d >= m.range ? 'out of range' : '' });
    });
    return { fused: SK.fuse(parts), parts };
  }

  /* ---------------- scenario & tracks ---------------- */
  function spawn(spec, test) {
    const path = SK.buildPath(spec.start, spec.segs, spec.seed || S.trackSeq, spec.jitter !== undefined ? spec.jitter : 0.25);
    const tr = {
      id: S.trackSeq++, label: (spec.cls === 'drone' ? 'D-' : spec.cls === 'bird' ? 'B-' : 'K-') + pad(S.trackSeq - 1),
      cls: spec.cls, trueCls: spec.trueCls, conf: spec.conf, size: spec.size || 'S', path, t0: S.t + (spec.t0 || 0),
      samples: [], pos: { x: path[0].x, y: path[0].y }, alt: path[0].alt, vel: { x: 0, y: 0 }, dwell: {},
      pat: { label: 'UNKNOWN', m: 1 }, score: null, history: [], detected: false, firstDetT: null, lastSeenT: null, done: false,
      alerted: {}, auth: null, permitId: null, held: false, fused: 0, parts: [], patCounts: {}, bestZoneId: null, maxTs: 0, test: !!test, firstPos: null
    };
    S.tracks.push(tr);
    return tr;
  }
  function runScenario(sc) {
    S.tracks = S.tracks.filter(t => false);
    S.selectedId = null; S.scenario = sc.id; S.decoyFlags.clear();
    if (sc.recon && S.reconRun === 0) { S.reconRun = 1; }
    sc.tracks().forEach(sp => spawn(sp));
    showScenInfo(sc.name, sc.explain, sc.watch);
    toast(`Scenario: ${sc.name}`);
    dirty.all = true;
  }
  function showScenInfo(title, what, watch) {
    const el = $('#scenInfo'); el.hidden = false;
    el.innerHTML = `<b>${esc(title)}</b><span>${esc(what)}</span>${watch ? `<span class="watch">Watch: ${esc(watch)}</span>` : ''}<button class="btn small" id="scenClose" aria-label="Hide">✕</button>`;
    $('#scenClose').onclick = () => { el.hidden = true; };
  }
  /* ---------------- Fly your own drone (user input) ---------------- */
  function cfUpdate() {
    const n = S.cf.pts.length;
    $('#cfInfo').textContent = S.cf.drawing ? (n ? `${n} point${n > 1 ? 's' : ''} · keep clicking, then Fly it` : 'Click the start point on the map') : n ? `${n} points ready` : '';
    $('#cfFly').disabled = n < 2;
    $('#cfDraw').textContent = S.cf.drawing ? '■ Stop drawing' : '✏ Draw path';
    $('#mapHint').textContent = S.cf.drawing ? 'Drawing: click to add points' : 'Tap a drone to inspect it';
    $('#map').style.cursor = S.cf.drawing ? 'crosshair' : '';
  }
  function cfFly() {
    if (!need('demo.control')) return;
    const pts = S.cf.pts; if (pts.length < 2) return;
    const alt = +$('#cfAlt').value, speed = +$('#cfSpd').value, end = $('#cfEnd').value;
    const segs = pts.slice(1).map(p => ({ to: p, speed }));
    const last = pts[pts.length - 1];
    const endText = { none: 'flies on', hover: 'hovers for 60 s', orbit: 'circles the last point 3 times', drop: 'descends to 12 m (possible drop)' }[end];
    if (end === 'hover') segs.push({ hover: 60 });
    if (end === 'orbit') segs.push({ orbit: last, r: 40, turns: 3, speed: Math.min(speed, 8) });
    if (end === 'drop') segs.push({ hover: 5 }, { descend: 12, rate: 1.5 }, { hover: 20 }, { climb: alt, rate: 3 });
    segs.push({ to: { x: last.x, y: -15 }, speed: speed + 2 });
    spawn({ cls: 'drone', conf: 0.9, size: 'S', t0: 0, start: { x: pts[0].x, y: pts[0].y, alt }, segs, seed: Math.floor(Math.random() * 1e6) });
    S.scenario = 'custom'; S.cf.drawing = false;
    showScenInfo('Your flight', `${pts.length} points at ${alt} m and ${speed} m/s; at the end it ${endText}.`, 'the label on the drone (behaviour + score) and the threat panel on the right. A drone outside camera or microphone range is not seen until it enters coverage.');
    access('flew custom drone path', `${pts.length} pts`);
    cfUpdate();
  }
  function reconStep() { // recon week: Day 1 → 3 → 5
    if (S.reconRun >= 3) { S.reconRun = 0; S.scenario = null; return; }
    S.reconRun++; S.day += 2; S.clockBase = SITE.startClock + 18 * 60 + (S.reconRun * 97) % 300 - S.t;
    toast(`Recon week: Day ${S.day}`);
    logPosture();
    SCENARIOS.find(s => s.id === 'recon').tracks().forEach(sp => spawn(Object.assign({}, sp, { seed: sp.seed + S.reconRun })));
  }

  function updateTrack(tr, dt) {
    const idx = Math.round((S.t - tr.t0) / 0.1);
    if (idx < 0) return;
    if (idx >= tr.path.length) { if (!tr.done) endTrack(tr); return; }
    const p = tr.path[idx], prev = tr.path[Math.max(0, idx - 5)];
    tr.vel = { x: (p.x - prev.x) / Math.max(0.1, (idx - Math.max(0, idx - 5)) * 0.1), y: (p.y - prev.y) / Math.max(0.1, (idx - Math.max(0, idx - 5)) * 0.1) };
    tr.pos = { x: p.x, y: p.y }; tr.alt = p.alt;
  }
  function endTrack(tr) {
    tr.done = true; tr.doneT = S.t;
    if (tr.cls === 'drone' && !tr.test && tr.detected && tr.auth !== 'PENDING' && tr.auth !== 'CONFIRMED' && (tr.lastSeenT - tr.firstDetT) >= 20) recordVisit(tr);
  }

  /* ---------------- per-tick scoring ---------------- */
  function scoreTick() {
    const posture = effectivePosture().p;
    const clock = nowClock();
    S.tracks.forEach(tr => {
      if (tr.done || S.t < tr.t0) return;
      const { fused, parts } = trackConfidence(tr);
      tr.fused = fused; tr.parts = parts;
      if (!tr.detected && fused >= 0.2) { tr.detected = true; tr.firstDetT = S.t; tr.firstPos = { ...tr.pos }; }
      if (tr.detected && fused >= 0.06) tr.lastSeenT = S.t;
      tr.samples.push({ t: S.t, x: tr.pos.x, y: tr.pos.y, alt: tr.alt });
      while (tr.samples.length && tr.samples[0].t < S.t - 60) tr.samples.shift();
      if (!tr.detected || tr.cls !== 'drone') return;
      // authorised flight check
      const h = hourOf(clock);
      const permit = S.permits.find(pm => SK.distToPoly(tr.pos, pm.area) <= 20 && (pm.from <= pm.to ? h >= pm.from && h < pm.to : h >= pm.from || h < pm.to));
      if (tr.auth === null && permit && S.t - tr.firstDetT < 3) { tr.auth = 'PENDING'; tr.permitId = permit.id; pushFeed('AUTH', `${tr.label} inside permit ${permit.id} (${permit.operator}). AUTHORISED-PENDING, operator to confirm.`, tr); }
      if ((tr.auth === 'PENDING' || tr.auth === 'CONFIRMED') && !permit) { tr.auth = 'VOID'; pushFeed('INFO', `${tr.label} left permit area / window. Now scored like any drone.`, tr); }
      tr.pat = SK.classifyPattern(tr.samples, S.zones);
      if (tr.pat.label !== 'UNKNOWN') tr.patCounts[tr.pat.label] = (tr.patCounts[tr.pat.label] || 0) + 1;
      tr.score = SK.scoreTrack(tr, { zones: S.zones, posture, pattern: tr.pat, clockSec: clock, dt: 0.5 });
      tr.history.push([S.t, tr.score.ts]);
      if (tr.score.best && tr.score.best.S > 0.05) tr.bestZoneId = tr.score.best.zone.id;
      tr.maxTs = Math.max(tr.maxTs, tr.score.ts);
      if (tr.auth === 'PENDING' || tr.auth === 'CONFIRMED') return;
      decideAlert(tr);
    });
    checkDecoy();
  }
  function skyPeriodActive() {
    const d = siteDate(), md = pad(d.getMonth() + 1) + '-' + pad(d.getDate()), h = hourOf(nowClock());
    return S.skyCal.filter(e => md >= e.from && md <= e.to && (!e.hours || (h >= e.hours[0] && h < e.hours[1])));
  }
  function decideAlert(tr) {
    const sc = tr.score, lv = sc.level, best = sc.best;
    if (lv === 'LOW') { if (tr.alerted.HIGH && S.t - tr.alerted.HIGH > 60) tr.alerted = {}; tr.held = false; return; }
    if (tr.alerted[lv]) return;
    // Sky Learning evidence rule: only MEDIUM in criticality <= 2 zones, never HIGH in C3, never sensor alerts
    const periods = skyPeriodActive().filter(e => e.kind !== 'bird' || true);
    if (lv === 'MEDIUM' && best && best.C <= 2 && periods.length) {
      const acoustic = tr.parts.some(p => p.id.startsWith('mic') && p.c > 0);
      if (tr.fused < 0.8 && !acoustic) { if (!tr.held) pushFeed('INFO', `${tr.label} held: ${periods[0].label} — needs acoustic confirmation or confidence ≥ 0.80 (now ${tr.fused.toFixed(2)}).`, tr); tr.held = true; return; }
    }
    tr.held = false;
    if (lv === 'MEDIUM' && tr.alerted.HIGH) return;
    tr.alerted[lv] = S.t;
    const zone = best.zone, zn = zone.name;
    const msg = {}; ['en', 'mr', 'hi'].forEach(l => { msg[l] = fill(lv === 'HIGH' ? T.voiceHigh[l] : T.voiceMed[l], { pattern: T.pattern[sc.pattern][l], zone: zn[l] || zn.en }); });
    dispatch({ type: lv, trackId: tr.id, zoneId: zone.id, msg, reason: reasonText(tr, 'en'), requiresAck: lv === 'HIGH', seal: lv === 'HIGH', voiceKey: `${lv}_${SKDATA.ZONES.some(z0 => z0.id === zone.id) ? zone.id : 'generic'}_${sc.pattern}` });
  }
  function reasonText(tr, lang) {
    const sc = tr.score; if (!sc || !sc.best) return '';
    const b = sc.best, z = b.zone, l = lang || S.lang;
    const pat = T.pattern[sc.pattern], post = T.posture[sc.posture];
    const eta = sc.eta === null ? '—' : sc.eta <= 0 ? (l === 'en' ? 'inside buffer' : 'आत') : Math.round(sc.eta) + ' s';
    if (l === 'en') return `${pat.en[0].toUpperCase() + pat.en.slice(1)} ${b.d < 1 ? 'over' : 'near'} ${z.name.en} (criticality ${b.C}), ${Math.round(b.d)} m from edge, ${Math.round(b.dwell)} s nearby. Posture ${post.en}. ${sc.level}. ETA ${eta}.`;
    if (l === 'mr') return `${z.name.mr} (महत्त्व ${b.C}) जवळ ड्रोन ${pat.mr}; कडेपासून ${Math.round(b.d)} मी., ${Math.round(b.dwell)} से. सतर्कता: ${post.mr}. ${T.level[sc.level].mr}. ETA ${eta}.`;
    return `${z.name.hi} (महत्व ${b.C}) के पास ड्रोन ${pat.hi}; किनारे से ${Math.round(b.d)} मी., ${Math.round(b.dwell)} से.। सतर्कता: ${post.hi}। ${T.level[sc.level].hi}। ETA ${eta}।`;
  }
  function checkDecoy() {
    const live = S.tracks.filter(t => !t.done && t.detected && t.cls === 'drone' && t.score && t.auth !== 'PENDING' && t.auth !== 'CONFIRMED');
    for (const a of live) for (const b of live) {
      if (a === b) continue;
      const key = a.id + '-' + b.id; if (S.decoyFlags.has(key)) continue;
      if (!['HOVER', 'ORBIT'].includes(a.pat.label) || !['APPROACH', 'TRANSIT'].includes(b.pat.label)) continue;
      const za = a.score.best && a.score.best.zone, zb = b.score.best && b.score.best.zone;
      if (!za || !zb || za.id === zb.id || b.score.best.cos < 0.8 || zb.c < 2) continue;
      const cen = { x: SITE.w / 2, y: SITE.h / 2 };
      if (Math.abs(SK.wrap180(SK.bearing(cen, a.pos) - SK.bearing(cen, b.pos))) < 60) continue;
      S.decoyFlags.add(key);
      const msg = {}; ['en', 'mr', 'hi'].forEach(l => { msg[l] = fill(T.decoy[l], { p1: T.pattern[a.pat.label][l], z1: za.name[l], p2: T.pattern[b.pat.label][l], z2: zb.name[l] }); });
      dispatch({ type: 'DECOY', voice: T.decoyVoice, voiceKey: 'decoy', trackId: b.id, zoneId: zb.id, msg, reason: msg.en + ' (multi-drone coordination, beta)', requiresAck: true });
    }
  }

  /* ---------------- alerts & guard loop ---------------- */
  function dispatch(a) {
    a.id = S.alertSeq++; a.t = S.t; a.time = siteTime(); a.day = S.day; a.acked = false; a.ladder = [{ to: 'Guard', t: S.t, time: siteTime() }];
    a.label = null; a.channels = ['dashboard', 'guard app'];
    S.alerts.unshift(a);
    const voice = ['HIGH', 'ATTACK', 'DRILL', 'RECON', 'DECOY'].includes(a.type);
    if (voice) { a.channels.push('SMS', 'voice'); smsOut('Guard on duty', a.msg); speakMsg(a.voice || a.msg, a.voiceKey); }
    if (a.type === 'HIGH' || a.type === 'ATTACK') { a.channels.push('siren'); siren(); }
    else if (a.type === 'MEDIUM' || a.type === 'ANOMALY') chime();
    if (a.seal) S.pendingSeals.push({ alertId: a.id, at: S.t + 15, from: S.t - 15 });
    ringPhone('guard');
    dirty.all = true;
    return a;
  }
  function ackAlert(a, by) {
    if (a.acked) return;
    a.acked = true; a.ackBy = by; a.ackT = S.t; a.ackTime = siteTime();
    a.ladder.push({ to: 'ACK by ' + by, t: S.t, time: siteTime() });
    if (a.capsuleId) addAddendum(a.capsuleId, { event: 'acknowledged', by, siteTime: siteTime(), afterSec: Math.round(S.t - a.t) });
    if (a.type === 'DRILL') finishDrill(a);
    if (a.type === 'ATTACK') S.attackAlertActive = false;
    dirty.all = true;
  }
  function ladderTick() {
    S.alerts.forEach(a => {
      if (!a.requiresAck || a.acked) return;
      const el = S.t - a.t;
      if (el >= 60 && !a.ladder.some(l => l.to === 'Supervisor')) { a.ladder.push({ to: 'Supervisor', t: S.t, time: siteTime() }); smsOut('Shift supervisor', prefixEsc(a.msg, 'supervisor')); ringPhone('sup'); chime(); if (a.capsuleId) addAddendum(a.capsuleId, { event: 'escalated to supervisor', siteTime: siteTime() }); dirty.all = true; }
      if (el >= 120 && !a.ladder.some(l => l.to === 'Control room / Police')) { a.ladder.push({ to: 'Control room / Police', t: S.t, time: siteTime() }); smsOut('Police control (112)', prefixEsc(a.msg, 'police')); if (a.capsuleId) addAddendum(a.capsuleId, { event: 'escalated to control room / police', siteTime: siteTime() }); dirty.all = true; }
    });
  }
  const prefixEsc = (msg, who) => ({ en: `[No guard response] ${msg.en}`, mr: `[गार्डकडून प्रतिसाद नाही] ${msg.mr}`, hi: `[गार्ड से जवाब नहीं] ${msg.hi}` });
  function smsOut(to, msg) { S.sms.unshift({ time: siteTime(), to, text: msg[S.lang] || msg.en }); dirty.memory = true; }
  function pushFeed(type, text, tr) { S.alerts.unshift({ id: S.alertSeq++, type, t: S.t, time: siteTime(), day: S.day, msg: { en: text, mr: text, hi: text }, info: true, trackId: tr && tr.id, acked: true, ladder: [] }); dirty.all = true; }

  /* ---------------- sound ---------------- */
  let AC = null;
  function audio() { if (!S.sound) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
  function siren() {
    const ac = audio(); if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sawtooth'; g.gain.value = 0.12;
    o.connect(g); g.connect(ac.destination); const t = ac.currentTime;
    for (let i = 0; i < 4; i++) { o.frequency.setValueAtTime(650, t + i * 0.5); o.frequency.linearRampToValueAtTime(1100, t + i * 0.5 + 0.25); o.frequency.linearRampToValueAtTime(650, t + i * 0.5 + 0.5); }
    o.start(t); o.stop(t + 2);
  }
  function chime() {
    const ac = audio(); if (!ac) return;
    [880, 1320].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.06, ac.currentTime + i * 0.15); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.15 + 0.4); o.connect(g); g.connect(ac.destination); o.start(ac.currentTime + i * 0.15); o.stop(ac.currentTime + i * 0.15 + 0.45); });
  }
  let voiceNote = '', voices = [];
  const LANG_NAME = { mr: 'Marathi', hi: 'Hindi', en: 'English' };
  const loadVoices = () => { try { voices = speechSynthesis.getVoices() || []; } catch (e) { voices = []; } };
  if ('speechSynthesis' in window) { loadVoices(); try { speechSynthesis.onvoiceschanged = () => { loadVoices(); populateVoices(); }; } catch (e) { /* older browsers */ } }
  // Native voices only: a Marathi alert is spoken by a Marathi voice, Hindi by Hindi. Natural / neural voices first
  // (Microsoft Edge: Aarohi, Manohar (mr-IN) · Swara, Madhur (hi-IN); Chrome: Google हिन्दी).
  const voiceScore = (v, code) => (/natural|neural|online/i.test(v.name) ? 20 : 0) + (/google/i.test(v.name) ? 10 : 0) + (v.lang.toLowerCase().replace('_', '-') === code + '-in' ? 3 : 0);
  function voicesFor(lang) { const code = lang; return voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(code)).sort((a, b) => voiceScore(b, code) - voiceScore(a, code)); }
  function populateVoices() {
    const sel = $('#voiceSel'); if (!sel) return;
    const list = voicesFor(S.lang);
    sel.innerHTML = `<option value="">Voice: auto (${list.length ? 'best ' + LANG_NAME[S.lang] : 'recorded clips'})</option>` + list.map(v => `<option value="${esc(v.voiceURI)}"${v.voiceURI === S.voiceURI ? ' selected' : ''}>${esc(v.name)}</option>`).join('');
    sel.title = list.length ? `${list.length} ${LANG_NAME[S.lang]} voice(s) on this browser` : `No ${LANG_NAME[S.lang]} voice in this browser. Open in Microsoft Edge for natural ${LANG_NAME[S.lang]} voices, or generate clips with make_voices.py`;
  }
  function sayWith(v, text) {
    try {
      const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 0.95;
      speechSynthesis.cancel();
      setTimeout(() => { try { speechSynthesis.resume(); speechSynthesis.speak(u); } catch (e) { /* ignore */ } }, 80);
      voiceNote = `Speaking with ${v.name}`;
    } catch (e) { voiceNote = 'Speech failed in this browser'; }
  }
  let clipAudio = null;
  /** Speak an alert in the chosen language with a native voice. Order: picked voice → natural native voice →
   *  recorded native clip (voices/<lang>/<key>.mp3, from make_voices.py) → any native voice → on-screen only. */
  function speakMsg(msg, key) {
    if (!S.sound) return;
    if (!voices.length) loadVoices();
    const text = msg[S.lang] || msg.en;
    const list = voicesFor(S.lang);
    const picked = S.voiceURI && voices.find(v => v.voiceURI === S.voiceURI);
    const best = picked || list[0];
    if (best && (picked || voiceScore(best, S.lang) >= 10 || S.lang === 'en')) return sayWith(best, text);
    const fallback = () => { if (best) sayWith(best, text); else { voiceNote = `No ${LANG_NAME[S.lang]} voice here. Open in Microsoft Edge, or run make_voices.py once for recorded clips.`; } };
    if (!key) return fallback();
    try {
      if (clipAudio) clipAudio.pause();
      clipAudio = new Audio(`voices/${S.lang}/${key}.mp3`);
      clipAudio.onerror = fallback;
      clipAudio.play().then(() => { voiceNote = `Recorded ${LANG_NAME[S.lang]} voice clip`; }).catch(fallback);
    } catch (e) { fallback(); }
  }
  function testSound() {
    if (!S.sound) { setSound(true); }
    siren();
    const z = S.zones.find(x => x.id === 'intake') || S.zones[0];
    const sample = {}; ['en', 'mr', 'hi'].forEach(l => { sample[l] = fill(T.voiceHigh[l], { pattern: T.pattern.ORBIT[l], zone: z.name[l] || z.name.en }); });
    setTimeout(() => { speakMsg(sample, `HIGH_${z.id === 'intake' ? 'intake' : 'generic'}_ORBIT`); setTimeout(() => toast(voiceNote || 'Speaking…'), 400); }, 2100);
  }
  function setSound(on) {
    S.sound = on;
    $('#soundBtn').setAttribute('aria-pressed', String(on)); $('#soundBtn').textContent = on ? '🔊 Sound on' : '🔈 Sound off';
    if (on) { const ac = audio(); if (ac && ac.state === 'suspended') ac.resume(); loadVoices(); populateVoices(); }
  }

  /* ---------------- camera rendering & KavachShield ---------------- */
  const camRaw = document.createElement('canvas'); camRaw.width = 320; camRaw.height = 180;
  const camStore = document.createElement('canvas'); camStore.width = 160; camStore.height = 90;
  const stars = []; { const R = SK.rng(5); for (let i = 0; i < 70; i++) stars.push({ b: R() * 360 - 180, e: R() * 40 + 2, s: R() * 1.3 + 0.4 }); }
  const skyline = []; { const R = SK.rng(9); let b = -180; while (b < 180) { const w = 4 + R() * 10; skyline.push({ b, w, h: 6 + R() * 22 }); b += w + R() * 6; } }
  const camNoise = SK.rng(77);
  function renderCam() {
    const cam = S.sensors.cams[0], ctx = camRaw.getContext('2d'), W = 320, H = 180, hz = S.horizon;
    const hd = camHeading(cam), fov = cam.fov, bx = b => (SK.wrap180(b - hd) / fov + 0.5) * W;
    const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#050b18'); g.addColorStop(1, '#1b2a44');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hz);
    ctx.fillStyle = '#d9e4f5';
    stars.forEach(s => { const x = bx(s.b); if (x < 0 || x > W) return; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(S.t * 2 + s.b); ctx.fillRect(x, hz - s.e / 45 * hz, s.s, s.s); });
    ctx.globalAlpha = 1;
    // ground and skyline (buildings), landmark pole, road traffic (privacy-relevant)
    ctx.fillStyle = '#0a0f17'; ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = '#121a26'; skyline.forEach(k => { const x = bx(k.b); if (x < -40 || x > W + 40) return; ctx.fillRect(x, hz - k.h, k.w / fov * W, k.h); });
    const poleX = bx(-80); if (poleX > 0 && poleX < W) { ctx.fillStyle = '#5b6d84'; ctx.fillRect(poleX, hz - 62, 3, 62 + 30); ctx.fillRect(poleX - 8, hz - 62, 19, 3); ctx.fillStyle = '#e8b33a'; ctx.fillRect(poleX, hz - 66, 3, 3); }
    ctx.fillStyle = '#1d2733'; ctx.fillRect(0, hz + 34, W, 12);
    for (let i = 0; i < 3; i++) { const x = ((S.t * 22 + i * 120) % (W + 60)) - 30; ctx.fillStyle = i % 2 ? '#c9d4e2' : '#e0c27a'; ctx.fillRect(x, hz + 35, 18, 8); }
    ctx.fillStyle = '#9fb0c4'; ctx.fillRect(((S.t * 5) % W), hz + 22, 3, 9); // pedestrian
    // drones / birds in view
    const boxes = [];
    S.tracks.forEach(tr => {
      if (tr.done || S.t < tr.t0) return;
      const d = SK.dist(cam, tr.pos); if (d > cam.range) return;
      const off = SK.wrap180(SK.bearing(cam, tr.pos) - hd); if (Math.abs(off) > fov / 2) return;
      if (tr.alt < SITE.treeHeight && SITE.trees.some(t => SK.segIntersectsRect(cam, tr.pos, t))) return;
      const el = Math.atan2(tr.alt, Math.max(1, d)) * 180 / Math.PI;
      const x = (off / fov + 0.5) * W, y = hz - el / 45 * hz, sz = Math.max(2, 260 / d);
      ctx.fillStyle = tr.cls === 'bird' ? '#8792a3' : '#dfe8f5';
      if (tr.cls === 'bird') { ctx.fillRect(x - sz, y, sz * 2, 1.2); }
      else { ctx.fillRect(x - sz, y - sz * 0.25, sz * 2, sz * 0.5); ctx.fillStyle = '#ef4e4e'; ctx.fillRect(x - sz, y - sz * 0.4, 1.4, 1.4); }
      boxes.push({ x, y, sz, tr });
    });
    // attacks act on the actual pixels
    if (S.attacks.laser) { const lg = ctx.createRadialGradient(W * 0.55, hz * 0.6, 4, W * 0.55, hz * 0.6, W * 0.75); lg.addColorStop(0, '#ffffff'); lg.addColorStop(0.55, '#fff6f0'); lg.addColorStop(1, 'rgba(255,240,230,0.6)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H); }
    if (S.attacks.cover) { ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H); }
    if (S.attacks.power) { /* camera is mains-powered; node A loses power */ }
    // sensor grain
    const id = ctx.getImageData(0, 0, W, H), dd = id.data;
    const amp = S.attacks.cover ? 1.5 : 7;
    for (let i = 0; i < dd.length; i += 4) { const n = (camNoise() - 0.5) * amp; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; }
    ctx.putImageData(id, 0, 0);
    // display copy: privacy mask below horizon + detection boxes
    const view = $('#camView'), vctx = view.getContext('2d');
    vctx.drawImage(camRaw, 0, 0);
    maskBelowHorizon(vctx, W, H, hz);
    vctx.lineWidth = 1;
    boxes.forEach(b => {
      if (!b.tr.detected || S.health.cam1.sees === false) return;
      const lv = b.tr.cls !== 'drone' ? null : b.tr.auth === 'PENDING' || b.tr.auth === 'CONFIRMED' ? 'AUTH' : b.tr.score ? b.tr.score.level : 'LOW';
      vctx.strokeStyle = lv ? COLORS[lv] : '#8792a3';
      const s = b.sz + 5; vctx.strokeRect(b.x - s, b.y - s, s * 2, s * 2);
      vctx.fillStyle = vctx.strokeStyle; vctx.font = '9px monospace';
      vctx.fillText(`${b.tr.cls === 'drone' ? 'drone' : b.tr.cls} ${b.tr.conf.toFixed(2)}`, b.x - s, b.y - s - 2);
    });
    vctx.strokeStyle = 'rgba(108,199,230,.6)'; vctx.setLineDash([4, 4]); vctx.beginPath(); vctx.moveTo(0, hz); vctx.lineTo(W, hz); vctx.stroke(); vctx.setLineDash([]);
    $('#camOsd').textContent = `CAM-1 · ${siteTime()} · ${S.health.cam1.state}`;
    $('#camOsd2').textContent = S.health.cam1.metrics.entropy !== undefined ? `H=${S.health.cam1.metrics.entropy.toFixed(2)} · drift ${S.health.cam1.metrics.drift.toFixed(2)}` : '';
  }
  // landmark / skyline band only (static structure: pole P-1 and rooftops), so moving traffic does not count as drift
  function structureThumb() { const y0 = Math.max(0, S.horizon - 70), h = 80; return SK.frameMetrics(camRaw.getContext('2d').getImageData(0, y0, 320, h).data, 320, h).thumb; }
  function maskBelowHorizon(ctx, W, H, hz) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, hz + 1, W, H - hz); ctx.clip();
    ctx.filter = 'blur(5px)'; ctx.drawImage(ctx.canvas, 0, 0); ctx.filter = 'none';
    ctx.fillStyle = 'rgba(10,15,23,.35)'; ctx.fillRect(0, hz + 1, W, H - hz);
    ctx.restore();
  }
  function captureFrame() {
    const c = camStore.getContext('2d');
    c.drawImage(camRaw, 0, 0, 160, 90);
    maskBelowHorizon(c, 160, 90, S.horizon / 2);
    let data = '';
    try { data = camStore.toDataURL('image/jpeg', 0.55); } catch (e) { data = ''; }
    S.frames.push({ t: S.t, day: S.day, time: siteTime(), data });
    while (S.frames.length && S.frames[0].t < S.t - 90) S.frames.shift();
    S.frameMeta.push(S.t);
    while (S.frameMeta.length && S.frameMeta[0] < S.t - S.retentionSec) { S.frameMeta.shift(); S.purged++; }
  }

  function healthCheck() {
    const anomaliesNow = [];
    // Camera 1: real pixel metrics
    const m = SK.frameMetrics(camRaw.getContext('2d').getImageData(0, 0, 320, 180).data, 320, 180);
    const st = structureThumb();
    if (!S.camRef) S.camRef = st;
    const drift = SK.driftScore(st, S.camRef);
    const eb = S.camBase.ent.stats();
    const blinded = (S.camBase.ent.v.length >= 5 && m.entropy < eb.mean * 0.5) || m.variance < 8 || m.satFrac > 0.35;
    const moved = drift > 0.15;
    m.drift = drift; S.health.cam1.metrics = m;
    if (!blinded && !moved) { S.camBase.ent.push(m.entropy); S.camBase.var.push(m.variance); }
    const camWhy = blinded ? (m.satFrac > 0.35 ? 'glare / laser: saturated' : 'covered: entropy collapse') : moved ? 'scene drift: camera moved' : '';
    setHealth('cam1', camWhy, !blinded && !moved);
    if (camWhy) anomaliesNow.push({ sensor: 'cam1', why: camWhy });
    // Camera 2: simulated healthy feed
    setHealth('cam2', '', true);
    // Mic A/B: RMS series + heartbeat
    ['micA', 'micB'].forEach(id => {
      const mic = S.mic[id], hb = S.hb[id];
      const powered = !(id === 'micA' && S.attacks.power);
      if (powered) { hb.last = S.t; hb.lat = 40 + Math.random() * 80; hb.lastGasp = false; }
      else if (!hb.lastGasp) { hb.lastGasp = true; S.anomalies.unshift({ sensor: id, t: S.t, time: siteTime(), why: 'last-gasp packet: power dropping' }); }
      const silent = S.t - hb.last > 10;
      const recent = mic.recent.slice(-5);
      const flat = recent.length >= 5 && Math.max(...recent) - Math.min(...recent) < 0.05;
      const st = mic.base.stats();
      const flood = mic.base.v.length >= 10 && mic.rms > st.mean + Math.max(3 * st.sd, 20);
      const why = silent ? 'heartbeat lost (power cut)' : flood ? 'microphone flooded' : flat ? 'microphone flat-lined' : '';
      setHealth(id, why, !why);
      S.health[id].metrics = { rms: mic.rms, lat: powered ? hb.lat : null, silentFor: powered ? 0 : S.t - hb.last };
      if (why) anomaliesNow.push({ sensor: id, why });
    });
    // co-occurrence => coordinated attack
    anomaliesNow.forEach(a => { const h = S.health[a.sensor]; if (h.newAnomaly) { S.anomalies.unshift({ sensor: a.sensor, t: S.t, time: siteTime(), why: a.why }); h.newAnomaly = false; } });
    const recent = S.anomalies.filter(a => !a.ok && S.health[a.sensor].state !== 'HEALTHY').map(a => ({ sensor: a.sensor, t: a.t }));
    const co = SK.coordinatedAttack(recent, S.t, 30);
    if (co.attack) {
      co.sensors.forEach(id => { S.health[id].state = 'ATTACK'; S.health[id].w = 0; });
      if (!S.attackAlertActive) {
        S.attackAlertActive = true;
        const names = co.sensors.map(sensorNameL).join(', '), msg = {};
        ['en', 'mr', 'hi'].forEach(l => { msg[l] = fill(T.attack[l], { sensors: l === 'en' ? co.sensors.map(sensorName).join(', ') : names }); });
        dispatch({ type: 'ATTACK', msg, voice: T.attackVoice, voiceKey: 'attack', reason: 'Co-occurring anomalies: ' + co.sensors.map(id => `${sensorName(id)} (${S.health[id].why})`).join('; '), requiresAck: true, seal: true });
      }
    } else if (S.attackAlertActive && !co.attack && Object.values(S.health).every(h => h.state !== 'ATTACK')) S.attackAlertActive = false;
    // Proof-of-Watch
    Object.keys(S.health).forEach(id => {
      const c = S.pow.checks[id], ok = S.health[id].state === 'HEALTHY'; c.n++; if (ok) c.ok++;
      const open = S.pow.gaps.find(g => g.sensor === id && g.end === null);
      if (!ok && !open) S.pow.gaps.push({ sensor: id, start: siteTime(), startT: S.t, end: null, cause: S.health[id].why });
      if (ok && open) { open.end = siteTime(); open.dur = Math.round(S.t - open.startT); }
    });
    dirty.shield = true;
  }
  function setHealth(id, why, ok) {
    const h = S.health[id];
    h.sees = id.startsWith('cam') ? ok : true;
    if (!ok) {
      if (h.state === 'HEALTHY') {
        h.state = 'ANOMALY'; h.w = 0.5; h.why = why; h.since = S.t; h.newAnomaly = true; h.okRun = 0;
        const msg = {}; ['en', 'mr', 'hi'].forEach(l => { msg[l] = fill(T.anomaly[l], { sensors: l === 'en' ? sensorName(id) : sensorNameL(id), why }); });
        dispatch({ type: 'ANOMALY', msg, reason: `${sensorName(id)}: ${why}`, requiresAck: false });
      } else h.why = why;
    } else {
      h.okRun++;
      if (h.state !== 'HEALTHY' && h.okRun >= 2) { h.state = 'HEALTHY'; h.w = 1; h.why = ''; S.anomalies.unshift({ sensor: id, t: S.t, time: siteTime(), why: 'recovered', ok: true }); }
    }
  }
  function micTick() {
    ['micA', 'micB'].forEach(id => {
      const m = S.sensors.mics.find(x => x.id === id), mic = S.mic[id];
      let rms = 38 + (Math.random() - 0.5) * 3;
      S.tracks.forEach(tr => { if (!tr.done && S.t >= tr.t0 && (tr.trueCls || tr.cls) === 'drone') { const d = SK.dist(m, tr.pos); if (d < m.range) rms += 14 * (1 - d / m.range); } });
      if (id === 'micA' && S.attacks.micFlood) rms += 38;
      if (id === 'micA' && (S.attacks.micMute || S.attacks.power)) rms = 0;
      mic.rms = rms; mic.recent.push(rms); if (mic.recent.length > 20) mic.recent.shift();
      if (S.health[id].state === 'HEALTHY' && rms > 0) mic.base.push(rms);
    });
  }

  /* ---------------- evidence ---------------- */
  async function sealPending() {
    const due = S.pendingSeals.filter(p => S.t >= p.at); if (!due.length || !S.device) return;
    S.pendingSeals = S.pendingSeals.filter(p => S.t < p.at);
    for (const p of due) {
      const a = S.alerts.find(x => x.id === p.alertId); if (!a) continue;
      const tr = S.tracks.find(x => x.id === a.trackId);
      const frames = S.frames.filter(f => f.t >= p.from && f.t <= p.at).map(f => f.data);
      const payload = {
        capsuleId: 'SKC-' + String(S.capsules.length + 1).padStart(4, '0'), siteId: SITE.id, deviceId: S.device.cert.deviceId,
        utc: new Date().toISOString(), siteDay: S.day, siteTime: a.time, trigger: a.type,
        reason: { en: a.reason || a.msg.en, mr: tr && tr.score ? reasonText(tr, 'mr') : a.msg.mr, hi: tr && tr.score ? reasonText(tr, 'hi') : a.msg.hi },
        track: tr ? { id: tr.label, cls: tr.cls, pattern: tr.pat.label, maxTs: +tr.maxTs.toFixed(3), points: tr.samples.filter((_, i) => i % 2 === 0).map(s => [+s.t.toFixed(1), +s.x.toFixed(1), +s.y.toFixed(1), +s.alt.toFixed(1)]), scores: tr.history.filter((_, i) => i % 2 === 0).map(h => [+h[0].toFixed(1), +h[1].toFixed(3)]) } : null,
        zone: a.zoneId || null, posture: effectivePosture().p,
        sensorHealth: Object.fromEntries(Object.entries(S.health).map(([k, v]) => [k, { state: v.state, w: v.w, why: v.why }])),
        fusedConfidence: tr ? +tr.fused.toFixed(3) : null,
        acknowledgements: a.ladder.map(l => ({ to: l.to, siteTime: l.time })),
        frames, frameWindow: [Math.round(p.from), Math.round(p.at)], privacy: 'ground below horizon blurred before storage'
      };
      const cap = await SK.sealCapsule(payload, S.device);
      cap.addenda = []; cap.status = 'sealed'; cap.alertId = a.id; cap.original = null;
      S.capsules.unshift(cap); a.capsuleId = payload.capsuleId;
      access('sealed', payload.capsuleId, 'device');
      if (!S.selectedCap) S.selectedCap = payload.capsuleId;
      toast(`Evidence capsule ${payload.capsuleId} sealed and signed`);
      dirty.evidence = true; dirty.all = true;
    }
  }
  async function addAddendum(capId, ev) {
    const cap = S.capsules.find(c => c.payload.capsuleId === capId); if (!cap || !S.device) return;
    const prev = cap.addenda.length ? cap.addenda[cap.addenda.length - 1].hash : cap.hash;
    const body = { prev, capsule: capId, ...ev };
    const hash = await SK.sha256Hex(SK.canonical(body));
    cap.addenda.push({ body, hash, signature: await SK.signHex(S.device.keyPair.privateKey, hash) });
    dirty.evidence = true;
  }
  function access(action, capId, who) { S.access.unshift({ time: siteTime(), day: S.day, who: who || S.role, action, cap: capId || '—' }); dirty.evidence = true; }

  /* ---------------- recon memory ---------------- */
  function recordVisit(tr) {
    const pat = Object.entries(tr.patCounts).filter(([k, n]) => k !== 'UNKNOWN' && k !== 'MANOEUVRE' && n >= 6).sort((a, b) => SK.PATTERNS[b[0]].m - SK.PATTERNS[a[0]].m || b[1] - a[1])[0];
    const v = { day: S.day, hour: +hourOf(S.clockBase + tr.firstDetT).toFixed(2), time: clockStr(S.clockBase + tr.firstDetT), bearing: Math.round(SK.compass({ x: SITE.w / 2, y: SITE.h / 2 }, tr.firstPos || tr.path[0])), pattern: pat ? pat[0] : 'MANOEUVRE', zoneId: tr.bestZoneId || '—', size: tr.size, track: tr.label };
    S.visits.unshift(v);
    const r = SK.checkRecon(S.visits, v);
    v.matches = r.matches.length;
    if (r.recon) {
      const key = v.zoneId + '|' + v.pattern + '|' + Math.round(v.bearing / 45);
      v.recon = true;
      if (!S.reconFlags.has(key)) {
        S.reconFlags.add(key);
        S.reconUntilDay = S.day + 7;
        const z = zoneById(v.zoneId), msg = {};
        ['en', 'mr', 'hi'].forEach(l => { msg[l] = fill(T.recon[l], { n: r.matches.length + 1, zone: z ? z.name[l] : v.zoneId }); });
        dispatch({ type: 'RECON', msg, voice: T.reconVoice, voiceKey: 'recon', reason: msg.en, requiresAck: true, zoneId: v.zoneId });
        logPosture('Recon Memory', `${r.matches.length + 1} similar visits in 7 days`);
      }
    }
    dirty.memory = true;
  }

  /* ---------------- Kavach Drill ---------------- */
  function runDrill() {
    // 1) engine check: replay a stored orbit track through classifier + TISE (fast-forward)
    const path = SK.buildPath({ x: 420, y: 60, alt: 45 }, [{ orbit: { x: 325, y: 59 }, r: 60, turns: 3, speed: 6.5 }], 999).filter((_, i) => i % 5 === 0).map((p, i) => ({ t: i * 0.5, ...p }));
    const st = { dwell: {} }; let hit = null;
    for (let i = 1; i < path.length && hit === null; i++) {
      st.pos = path[i]; st.vel = { x: (path[i].x - path[i - 1].x) / 0.5, y: (path[i].y - path[i - 1].y) / 0.5 };
      const pat = SK.classifyPattern(path.slice(Math.max(0, i - 120), i + 1), S.zones);
      if (SK.scoreTrack(st, { zones: S.zones, posture: 'NORMAL', pattern: pat, clockSec: nowClock(), dt: 0.5 }).level === 'HIGH') hit = path[i].t;
    }
    const d = { time: siteTime(), day: S.day, engine: hit !== null ? `HIGH at ${hit}s of replay` : 'did NOT reach HIGH', engineOk: hit !== null, channels: '', ack: null, result: 'waiting' };
    S.drills.unshift(d);
    const a = dispatch({ type: 'DRILL', voiceKey: 'drill', msg: { en: T.drill.en, mr: T.drill.mr, hi: T.drill.hi }, reason: 'Kavach Drill: scheduled pipeline self-test', requiresAck: true });
    d.alertId = a.id; d.channels = a.channels.join(', ');
    d.timer = S.t;
    dirty.shield = true;
  }
  function finishDrill(a) {
    const d = S.drills.find(x => x.alertId === a.id); if (!d) return;
    d.ack = Math.round(a.ackT - a.t) + ' s'; d.result = d.engineOk ? 'PASS' : 'FAIL'; dirty.shield = true;
  }
  function drillTick() { S.drills.forEach(d => { if (d.result === 'waiting' && S.t - d.timer > 120) { d.result = 'FAIL: no acknowledgement'; dirty.shield = true; } }); }

  /* ---------------- main loop ---------------- */
  const dirty = { all: true, shield: true, evidence: true, memory: true, setup: true };
  let acc = 0, lastReal = performance.now(), lastScore = 0, lastMic = 0, lastPanel = 0, lastCam = 0;
  function loop(now) {
    const realDt = Math.min(0.25, (now - lastReal) / 1000); lastReal = now;
    if (S.running) {
      acc += realDt * S.speed;
      while (acc >= 0.1) {
        acc -= 0.1; S.t = +(S.t + 0.1).toFixed(2);
        S.tracks.forEach(tr => updateTrack(tr, 0.1));
        if (S.t - lastScore >= 0.5 - 1e-6) { lastScore = S.t; scoreTick(); ladderTick(); drillTick(); }
        if (S.t - lastMic >= 1 - 1e-6) { lastMic = S.t; micTick(); if (S.t - S.lastFrameT >= 1) { S.lastFrameT = S.t; captureFrame(); } }
        if (S.t - S.lastCheck >= 5 - 1e-6) { S.lastCheck = S.t; healthCheck(); }
      }
      S.tracks = S.tracks.filter(tr => !tr.done || S.t - tr.doneT < 4);
      const sc = SCENARIOS.find(s => s.id === S.scenario);
      if (sc && sc.recon && S.tracks.every(t => t.done) && S.tracks.length === 0) {
        if (S.reconNextAt === null) S.reconNextAt = S.t + 2; else if (S.t >= S.reconNextAt) { S.reconNextAt = null; reconStep(); }
      }
      if (S.pendingSeals.length) sealPending();
      const p = effectivePosture().p; if (p !== S.lastPosture) logPosture();
    }
    if (now - lastCam > 90) { lastCam = now; renderCam(); }
    if (curView === 'live') { drawMap($('#map'), { live: true }); }
    if (curView === 'setup') drawSetup();
    if (now - lastPanel > 250) { lastPanel = now; renderPanels(); }
    requestAnimationFrame(loop);
  }

  /* ---------------- map drawing ---------------- */
  const critColor = c => c >= 3 ? COLORS.HIGH : c === 2 ? COLORS.MEDIUM : COLORS.LOW;
  function withAlpha(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function polyPath(ctx, poly) { ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); }
  function drawBase(ctx, opts = {}) {
    ctx.fillStyle = COLORS.land; ctx.fillRect(0, 0, SITE.w, SITE.h);
    ctx.strokeStyle = 'rgba(120,150,180,.06)'; ctx.lineWidth = 0.5;
    for (let x = 0; x <= SITE.w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, SITE.h); ctx.stroke(); }
    for (let y = 0; y <= SITE.h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(SITE.w, y); ctx.stroke(); }
    ctx.fillStyle = COLORS.water; ctx.fillRect(0, SITE.river.y0, SITE.w, SITE.river.y1 - SITE.river.y0);
    ctx.fillStyle = 'rgba(108,199,230,.5)'; ctx.font = '7px sans-serif'; ctx.fillText('RIVER · नदी', 6, 12);
    ctx.fillStyle = COLORS.road; ctx.fillRect(0, SITE.road.y0, SITE.w, SITE.road.y1 - SITE.road.y0);
    ctx.fillStyle = 'rgba(200,210,225,.35)'; ctx.fillText('ROAD', 6, SITE.road.y0 + 11);
    SITE.trees.forEach(t => { const R = SK.rng(3); ctx.fillStyle = COLORS.tree; for (let i = 0; i < 26; i++) { ctx.beginPath(); ctx.arc(t.x0 + R() * (t.x1 - t.x0), t.y0 + R() * (t.y1 - t.y0), 5 + R() * 5, 0, 7); ctx.fill(); } ctx.fillStyle = 'rgba(140,200,160,.55)'; ctx.fillText('trees', t.x0 + 4, t.y1 - 4); });
    // zones with buffers
    const clock = nowClock();
    S.zones.forEach(z => {
      const C = SK.zoneCriticality(z, clock), col = critColor(C);
      ctx.save(); polyPath(ctx, z.poly); ctx.lineJoin = 'round'; ctx.strokeStyle = withAlpha(col, 0.07); ctx.lineWidth = z.buffer * 2; ctx.stroke(); ctx.restore();
      polyPath(ctx, z.poly); ctx.fillStyle = withAlpha(col, 0.2); ctx.fill(); ctx.strokeStyle = withAlpha(col, 0.85); ctx.lineWidth = 1; ctx.stroke();
      const c = SK.centroid(z.poly); ctx.textAlign = 'center';
      ctx.fillStyle = '#e8eef6'; ctx.font = '600 7.5px sans-serif'; ctx.fillText(z.name.en, c.x, c.y - 1);
      ctx.fillStyle = 'rgba(232,238,246,.7)'; ctx.font = '7px sans-serif'; ctx.fillText(`${z.name.mr} · C${C}`, c.x, c.y + 8);
      ctx.textAlign = 'left';
    });
    if (opts.permits !== false) {
      const h = hourOf(clock);
      S.permits.forEach(pm => { const open = pm.from <= pm.to ? h >= pm.from && h < pm.to : h >= pm.from || h < pm.to; if (!open) return; polyPath(ctx, pm.area); ctx.setLineDash([3, 3]); ctx.strokeStyle = withAlpha(COLORS.AUTH, 0.8); ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = withAlpha(COLORS.AUTH, 0.9); ctx.font = '6.5px sans-serif'; ctx.fillText(`permit ${pm.id}`, pm.area[0].x + 3, pm.area[0].y + 8); });
    }
    // scale bar & north
    ctx.strokeStyle = '#9fb0c4'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(SITE.w - 70, SITE.h - 28); ctx.lineTo(SITE.w - 20, SITE.h - 28); ctx.stroke();
    ctx.fillStyle = '#9fb0c4'; ctx.font = '7px sans-serif'; ctx.fillText('50 m', SITE.w - 55, SITE.h - 31);
    ctx.beginPath(); ctx.moveTo(SITE.w - 12, 44); ctx.lineTo(SITE.w - 16, 54); ctx.lineTo(SITE.w - 8, 54); ctx.closePath(); ctx.fill(); ctx.fillText('N', SITE.w - 14.5, 41);
  }
  function drawSensors(ctx, sensors) {
    sensors.cams.forEach(c => {
      const h = S.health[c.id] || { state: 'HEALTHY' }, col = h.state === 'HEALTHY' ? COLORS.accent : COLORS.ATTACK;
      const hd = camHeading(c) * Math.PI / 180, f = c.fov / 2 * Math.PI / 180;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, c.range, hd - f, hd + f); ctx.closePath();
      ctx.fillStyle = withAlpha(col, h.state === 'HEALTHY' ? 0.045 : 0.08); ctx.fill(); ctx.strokeStyle = withAlpha(col, 0.25); ctx.lineWidth = 0.6; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(c.x - 3, c.y - 3, 6, 6); ctx.font = '6.5px sans-serif'; ctx.fillText(c.id.toUpperCase(), c.x + 5, c.y - 4);
    });
    sensors.mics.forEach(m => {
      const h = S.health[m.id] || { state: 'HEALTHY' }, col = h.state === 'HEALTHY' ? COLORS.accent : COLORS.ATTACK;
      ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(m.x, m.y, m.range, 0, 7); ctx.strokeStyle = withAlpha(col, 0.3); ctx.lineWidth = 0.6; ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.font = '6.5px sans-serif'; ctx.fillText(m.id === 'micA' ? 'NODE A' : m.id === 'micB' ? 'NODE B' : 'NEW', m.x + 5, m.y + 2);
    });
  }
  function trackColor(tr) {
    if (tr.cls !== 'drone') return '#8f9bab';
    if (tr.auth === 'PENDING' || tr.auth === 'CONFIRMED') return COLORS.AUTH;
    return tr.score ? COLORS[tr.score.level] : COLORS.LOW;
  }
  function prepCanvas(cv) { const ctx = cv.getContext('2d'); ctx.setTransform(cv.width / SITE.w, 0, 0, cv.height / SITE.h, 0, 0); return ctx; }
  function drawMap(cv) {
    const ctx = prepCanvas(cv);
    drawBase(ctx); drawSensors(ctx, S.sensors);
    S.tracks.forEach(tr => {
      if (S.t < tr.t0) return;
      if (!tr.detected && !S.truth) return;
      const col = tr.detected ? trackColor(tr) : 'rgba(160,170,185,.45)';
      ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.globalAlpha = tr.done ? 0.35 : 0.85;
      ctx.beginPath(); tr.samples.forEach((s, i) => i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)); ctx.stroke();
      ctx.globalAlpha = 1;
      const p = tr.pos;
      if (tr.pat && tr.pat.centre && tr.pat.label === 'ORBIT') { ctx.setLineDash([1.5, 2]); ctx.beginPath(); ctx.arc(tr.pat.centre.x, tr.pat.centre.y, 3, 0, 7); ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]); }
      if (tr.cls === 'drone') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.2;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + a * 4, p.y + b * 4); ctx.stroke(); ctx.beginPath(); ctx.arc(p.x + a * 4, p.y + b * 4, 1.8, 0, 7); ctx.stroke(); });
      } else if (tr.cls === 'bird') { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(p.x - 3, p.y - 1.5); ctx.lineTo(p.x, p.y + 1); ctx.lineTo(p.x + 3, p.y - 1.5); ctx.stroke(); }
      if (tr.id === S.selectedId) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, 7); ctx.stroke(); }
      if (tr.score && tr.score.eta !== null && tr.score.eta > 0 && tr.score.level !== 'LOW') {
        const c = SK.centroid(tr.score.best.zone.poly); ctx.setLineDash([2, 2]); ctx.strokeStyle = withAlpha(COLORS.HIGH, 0.6); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (tr.detected) {
        const txt = tr.cls === 'drone' ? `${tr.label} · ${tr.auth === 'PENDING' ? 'AUTH-PENDING' : tr.auth === 'CONFIRMED' ? 'AUTHORISED' : tr.pat.label} · ${tr.score ? tr.score.ts.toFixed(2) : '…'}${tr.held ? ' · HELD' : ''}` : `${tr.cls} ${tr.conf.toFixed(2)}`;
        ctx.font = '600 7px sans-serif'; const w = ctx.measureText(txt).width + 6;
        const lx = Math.min(SITE.w - w - 2, p.x + 8), ly = Math.max(10, p.y - 8);
        ctx.fillStyle = 'rgba(8,14,22,.82)'; ctx.fillRect(lx, ly - 7.5, w, 10); ctx.fillStyle = col; ctx.fillText(txt, lx + 3, ly);
      }
    });
    if (S.cf.pts.length) {
      ctx.setLineDash([4, 3]); ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.2; ctx.beginPath();
      S.cf.pts.forEach((q, i) => i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)); ctx.stroke(); ctx.setLineDash([]);
      S.cf.pts.forEach((q, i) => { ctx.fillStyle = COLORS.accent; ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 7); ctx.fill(); ctx.fillStyle = '#06202b'; ctx.font = '600 6px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), q.x, q.y + 2.2); ctx.textAlign = 'left'; });
    }
    // decoy links
    S.decoyFlags.forEach(k => { const [a, b] = k.split('-').map(Number); const ta = S.tracks.find(t => t.id === a), tb = S.tracks.find(t => t.id === b); if (ta && tb && !ta.done && !tb.done) { ctx.setLineDash([4, 3]); ctx.strokeStyle = withAlpha(COLORS.accent, 0.8); ctx.beginPath(); ctx.moveTo(ta.pos.x, ta.pos.y); ctx.lineTo(tb.pos.x, tb.pos.y); ctx.stroke(); ctx.setLineDash([]); } });
  }
  function canvasPoint(cv, e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * SITE.w, y: (e.clientY - r.top) / r.height * SITE.h }; }

  /* ---------------- panels ---------------- */
  let curView = 'live';
  function selectedTrack() {
    let tr = S.tracks.find(t => t.id === S.selectedId && t.detected);
    if (!tr) tr = S.tracks.filter(t => t.detected && t.cls === 'drone' && !t.done).sort((a, b) => (b.score ? b.score.ts : 0) - (a.score ? a.score.ts : 0))[0];
    if (!tr) tr = S.tracks.filter(t => t.detected && !t.done)[0];
    return tr;
  }
  function renderPanels() {
    $('#clock').textContent = `Day ${S.day} · ${siteTime()}`;
    const ep = effectivePosture();
    if ($('#postureSel').value !== S.manualPosture) $('#postureSel').value = S.manualPosture;
    $('#postureSel').title = `Effective posture ${ep.p} (${ep.why})`;
    $('#postureSel').className = 'compact lv-' + S.manualPosture;
    const pe = $('#postureEff'); pe.hidden = ep.p === S.manualPosture; pe.className = 'pill lv-' + ep.p; pe.textContent = `→ ${ep.p.replace('_', ' ')} · ${ep.why}`;
    const top = S.tracks.filter(t => t.detected && t.cls === 'drone' && !t.done && t.score && t.auth !== 'PENDING' && t.auth !== 'CONFIRMED').reduce((m, t) => Math.max(m, t.score.ts), 0);
    const attack = Object.values(S.health).some(h => h.state === 'ATTACK');
    const pill = $('#sitePill'), lv = attack ? 'ATTACK' : top >= 0.6 ? 'HIGH' : top >= 0.3 ? 'MEDIUM' : 'LOW';
    pill.className = 'pill lv-' + lv; pill.lastElementChild.textContent = attack ? 'SENSOR ATTACK' : lv === 'LOW' ? (S.tracks.some(t => t.detected && !t.done) ? 'LOW' : 'CLEAR') : lv;
    $('#attackBanner').hidden = !attack;
    if (attack) $('#attackText').textContent = Object.entries(S.health).filter(([, h]) => h.state === 'ATTACK').map(([k, h]) => `${sensorName(k)}: ${h.why}`).join(' · ') + ' · confidence reduced, using healthy sensors';
    if (curView === 'live' || dirty.all) renderLive();
    if (curView === 'shield' && dirty.shield) { renderShield(); dirty.shield = false; }
    if (curView === 'evidence' && dirty.evidence) { renderEvidence(); dirty.evidence = false; }
    if (curView === 'memory' && dirty.memory) { renderMemory(); dirty.memory = false; }
    if (curView === 'setup') { renderSetup(); dirty.setup = false; }
    applyRBAC();
    if (curView === 'users' && dirty.evidence) renderUsers();
    dirty.all = false;
  }
  function renderLive() {
    const tr = selectedTrack();
    const body = $('#threatBody');
    if (!tr) { setHTML(body, '<p class="muted">No drone tracked yet. Use the demo controls to fly one.</p>'); $('#trackId').textContent = '—'; drawChart($('#chart'), null); }
    else if (tr.cls !== 'drone') {
      $('#trackId').textContent = tr.label;
      setHTML(body, `<p>Detected <b>${tr.cls}</b> (confidence ${tr.conf.toFixed(2)}). Not scored: only drones are assessed.</p>`);
      drawChart($('#chart'), null);
    } else {
      $('#trackId').textContent = `${tr.label} · ${tr.size === 'M' ? 'medium' : 'small'} quadcopter`;
      const sc = tr.score, auth = tr.auth === 'PENDING' || tr.auth === 'CONFIRMED';
      const lv = auth ? 'AUTH' : sc ? sc.level : 'LOW';
      const ts = sc ? sc.ts : 0, b = sc && sc.best;
      const levelText = auth ? (tr.auth === 'PENDING' ? 'AUTHORISED-PENDING' : 'AUTHORISED') : sc ? (S.lang === 'en' ? sc.level : `${sc.level} · ${L(T.level[sc.level])}`) : 'SCORING…';
      setHTML(body, `
        <div class="threat-head"><div class="bigLevel" style="color:${COLORS[lv] || COLORS.LOW}">${esc(levelText)}</div>
          <div class="muted mono" style="font-size:12px;line-height:1.5">TS ${ts.toFixed(2)}<br>${esc(tr.pat.label)} · ETA ${sc && sc.eta !== null ? (sc.eta <= 0 ? 'inside' : Math.round(sc.eta) + ' s') : '—'}</div></div>
        <div class="tsbar"><div class="fill" style="width:${ts * 100}%;background:${COLORS[lv] || COLORS.LOW}"></div><div class="mark" style="left:30%"></div><div class="mark" style="left:60%"></div></div>
        ${auth ? `<div class="reason">Inside permit <b>${esc(tr.permitId)}</b> (${esc((S.permits.find(p => p.id === tr.permitId) || {}).operator || '')}). A camera cannot read identity, so the operator confirms. ${tr.auth === 'PENDING' ? '<button class="btn small primary" data-perm="permit.confirm" data-confirm="${tr.id}">Confirm authorised</button>' : 'Confirmed by ' + esc(tr.authBy) + '.'}</div>` : ''}
        ${tr.held ? `<div class="reason" style="border-color:var(--med)">Held by Sky Learning: active sky-calendar period. Needs acoustic confirmation or confidence ≥ 0.80.</div>` : ''}
        ${sc && !auth ? `<div class="reason">${esc(reasonText(tr))}${S.lang !== 'en' ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(reasonText(tr, 'en'))}</div>` : ''}</div>` : ''}
        <details class="why" ${S.whyOpen ? 'open' : ''}><summary>Why this score?</summary>
        ${b ? `<div class="terms">${[['C', b.C, 'zone'], ['P', b.P.toFixed(2), 'proximity'], ['D', b.D.toFixed(2), 'dwell'], ['H', b.H.toFixed(2), 'heading'], ['M', b.M.toFixed(2), 'pattern'], ['K', b.K.toFixed(2), 'posture'], ['S', b.S.toFixed(2), 'score']].map(([k, v, n]) => `<div><b>${v}</b><span>${k} · ${n}</span></div>`).join('')}</div>` : ''}
        <div class="eyebrow" style="margin-top:10px">Detection confidence ${tr.fused.toFixed(2)} (health-weighted fusion)</div>
        <div class="conf">${tr.parts.map(p => `<div class="bar"><span>${sensorName(p.id)} <span class="faint">w${p.w}</span></span><span class="t"><i style="width:${p.w * p.c * 100}%;background:${p.w < 1 ? COLORS.ATTACK : COLORS.accent}"></i></span><span class="mono" style="font-size:11px">${p.note || (p.w * p.c).toFixed(2)}</span></div>`).join('')}</div></details>`);
      drawChart($('#chart'), tr.history, tr.label);
    }
    renderChips(); renderPhones(); renderFeed();
  }
  function renderChips() {
    setHTML($('#healthChips'), Object.entries(S.health).map(([id, h]) => `<span class="pill lv-${h.state === 'HEALTHY' ? 'LOW' : h.state}" title="${esc(h.why)}"><span class="dot"></span>${sensorName(id)} · ${h.state === 'HEALTHY' ? 'OK' : h.state}</span>`).join(''));
    $$('#attackBtns [data-attack]').forEach(b => b.setAttribute('aria-pressed', S.attacks[b.dataset.attack] ? 'true' : 'false'));
  }
  const ringing = { guard: 0, sup: 0 };
  function ringPhone(which) { ringing[which] = performance.now(); }
  function renderPhones() {
    const actionable = S.alerts.filter(a => !a.info);
    const g = actionable.find(a => !a.acked && a.requiresAck) || actionable.find(a => !a.acked) || actionable[0];
    const sup = actionable.find(a => a.requiresAck && !a.acked && a.ladder.some(l => l.to === 'Supervisor'));
    setHTML($('#phoneGuard'), phoneHTML('Guard · गार्ड', g, 'guard'));
    setHTML($('#phoneSup'), phoneHTML('Supervisor · पर्यवेक्षक', sup, 'sup'));
    const sec = S.alerts.find(a => a.requiresAck && !a.acked && a.ladder.length);
    $('#ladderNote').textContent = sec ? `Unacknowledged ${sec.type} · ${Math.round(S.t - sec.t)} s · next: ${S.t - sec.t < 60 ? 'supervisor at 60 s' : S.t - sec.t < 120 ? 'police at 120 s' : 'all notified'}` : 'Escalation: supervisor at 60 s, police at 120 s';
  }
  function phoneHTML(who, a, which) {
    const head = `<div class="ph-top"><span class="ph-who">${who}</span><span class="mono">${siteTime().slice(0, 5)}</span></div>`;
    if (!a) return head + '<div class="idle">No alerts</div>';
    const ring = performance.now() - ringing[which] < 2000 ? ' ring' : '';
    const zone = a.zoneId ? zoneById(a.zoneId) : null;
    const steps = (a.type === 'HIGH' || a.type === 'ATTACK' || a.type === 'DECOY') ? (S.sop.steps[S.lang] || S.sop.steps.en).map(s => `<li>${esc(fill(s, { zone: zone ? (zone.name[S.lang] || zone.name.en) : ({ en: 'the sensor posts', mr: 'सेन्सर ठिकाणां', hi: 'सेंसर स्थानों' })[S.lang] }))}</li>`).join('') : '';
    const lvClass = { DRILL: 'DRILL', RECON: 'RECON', DECOY: 'DECOY', ANOMALY: 'ANOMALY', ATTACK: 'ATTACK' }[a.type] || a.type;
    let foot = '';
    if (!a.acked && a.requiresAck) foot = `<button class="btn primary small" data-perm="alert.ack" data-ack="${a.id}" data-who="${which === 'guard' ? 'Guard' : 'Supervisor'}">${L(T.ack)}</button>`;
    else if (a.acked && which === 'guard' && ['HIGH', 'MEDIUM'].includes(a.type) && !a.label) foot = `<div class="muted" style="font-size:11px">What was it?</div><div class="labels">${['Real drone', 'Bird', 'Kite', 'Other'].map(l => `<button class="btn small" data-perm="alert.label" data-label="${l}" data-alert="${a.id}">${l}</button>`).join('')}</div>`;
    else if (a.acked) foot = `<div class="ok" style="font-size:12px">✓ ${a.ackBy ? 'Acknowledged by ' + a.ackBy + ' after ' + Math.round(a.ackT - a.t) + ' s' : 'Seen'}${a.label ? ' · labelled ' + a.label : ''}</div>`;
    return head + `<div class="notif${ring}"><span class="pill lv-${lvClass}" style="justify-self:start"><span class="dot"></span>${a.type === 'DRILL' ? 'TEST · DRILL' : a.type}</span><div>${esc(a.msg[S.lang] || a.msg.en)}</div>${steps ? `<div class="muted" style="font-size:11px">${L(T.actionCard)}</div><ol class="steps">${steps}</ol>` : ''}${foot}</div>`;
  }
  function labelAlert(id, label) {
    const a = S.alerts.find(x => x.id === id); if (!a) return; a.label = label;
    const tr = S.tracks.find(t => t.id === a.trackId);
    const use = label === 'Real drone' ? 'kept as positive example' : 'added to site hard-negative set';
    S.labels.unshift({ time: siteTime(), day: S.day, track: tr ? tr.label : '—', label, use });
    if (label === 'Kite' || label === 'Bird') {
      const d = siteDate(), from = new Date(d), to = new Date(d); from.setDate(d.getDate() - 5); to.setDate(d.getDate() + 5);
      const md = x => pad(x.getMonth() + 1) + '-' + pad(x.getDate());
      const kind = label === 'Kite' ? 'kite' : 'bird';
      if (!S.skyCal.some(e => e.learned && e.kind === kind && md(d) >= e.from && md(d) <= e.to)) {
        S.skyCal.push({ id: 'learn-' + S.skyCal.length, kind, from: md(from), to: md(to), label: `${label} activity (learned from guard label)`, learned: true });
        toast(`Sky calendar learned: ${label.toLowerCase()} activity ${md(from)} to ${md(to)}`);
      }
    }
    if (a.capsuleId) addAddendum(a.capsuleId, { event: 'guard label', label, siteTime: siteTime() });
    dirty.all = true; dirty.memory = true;
  }
  function renderFeed() {
    const items = S.alerts.slice(0, 40);
    setHTML($('#feed'), items.length ? items.map(a => `<div class="item"><span class="pill lv-${a.type}" style="font-size:10.5px"><span class="dot"></span>${a.type === 'DRILL' ? 'TEST' : a.type}</span><span>${esc(a.msg[S.lang] || a.msg.en)}${a.capsuleId ? ` <span class="mono faint">· ${a.capsuleId}</span>` : ''}${a.requiresAck && !a.acked ? ` <button class="btn small" data-perm="alert.ack" data-feedack="${a.id}">Ack</button>` : ''}</span><span class="when">D${a.day} ${a.time.slice(0, 5)}</span></div>`).join('') : '<p class="muted">Quiet sky.</p>');
  }
  function drawChart(cv, hist, title) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, padL = 34, padB = 18;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.font = '11px ' + css('--f-mono'); ctx.fillStyle = COLORS.muted;
    const y = v => (H - padB) - v * (H - padB - 8);
    [0, 0.3, 0.6, 1].forEach(v => { ctx.strokeStyle = v === 0.3 ? withAlpha(COLORS.MEDIUM, 0.5) : v === 0.6 ? withAlpha(COLORS.HIGH, 0.5) : 'rgba(140,160,185,.15)'; ctx.setLineDash(v === 0.3 || v === 0.6 ? [4, 4] : []); ctx.beginPath(); ctx.moveTo(padL, y(v)); ctx.lineTo(W - 6, y(v)); ctx.stroke(); ctx.fillText(v.toFixed(1), 4, y(v) + 4); });
    ctx.setLineDash([]);
    if ($('#chartTitle') && cv.id === 'chart') $('#chartTitle').textContent = title ? '· ' + title : '';
    if (!hist || hist.length < 2) { ctx.fillText('No scored track', padL + 8, H / 2); return; }
    const t0 = hist[0][0], t1 = Math.max(hist[hist.length - 1][0], t0 + 30), x = t => padL + (t - t0) / (t1 - t0) * (W - padL - 8);
    ctx.beginPath(); hist.forEach(([t, v], i) => i ? ctx.lineTo(x(t), y(v)) : ctx.moveTo(x(t), y(v)));
    const last = hist[hist.length - 1][1], col = last >= 0.6 ? COLORS.HIGH : last >= 0.3 ? COLORS.MEDIUM : COLORS.LOW;
    ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    ctx.lineTo(x(hist[hist.length - 1][0]), y(0)); ctx.lineTo(x(t0), y(0)); ctx.closePath(); ctx.fillStyle = withAlpha(col, 0.12); ctx.fill();
    ctx.beginPath(); ctx.arc(x(hist[hist.length - 1][0]), y(last), 3.5, 0, 7); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = COLORS.muted; ctx.fillText(`${Math.round(t1 - t0)} s`, W - 40, H - 4); ctx.fillText('0 s', padL, H - 4);
  }

  /* ---------------- shield view ---------------- */
  function renderShield() {
    $('#healthTable').innerHTML = Object.entries(S.health).map(([id, h]) => {
      const c = S.pow.checks[id];
      return `<tr><td>${sensorName(id)}</td><td><span class="pill lv-${h.state === 'HEALTHY' ? 'LOW' : h.state}"><span class="dot"></span>${h.state === 'HEALTHY' ? 'OK' : h.state === 'ATTACK' ? 'UNDER ATTACK' : 'PROBLEM'}</span>${h.why ? `<div class="muted" style="font-size:11.5px">${esc(h.why)}</div>` : ''}</td><td class="num">${c.n ? (c.ok / c.n * 100).toFixed(1) + '%' : '—'}</td></tr>`;
    }).join('');
    $('#anomalyFeed').innerHTML = S.anomalies.length ? S.anomalies.slice(0, 30).map(a => `<div class="item"><span class="pill lv-${a.ok ? 'LOW' : 'ANOMALY'}" style="font-size:10.5px"><span class="dot"></span>${a.ok ? 'OK' : '!'}</span><span>${sensorName(a.sensor)}: ${esc(a.why)}</span><span class="when">D${S.day} ${a.time.slice(0, 8)}</span></div>`).join('') : '<p class="muted">No anomalies.</p>';
    $('#powSealed').innerHTML = S.powLogs.map(p => `<div class="small"><span class="ok">✓</span> Watch log for Day ${p.payload.day} signed at ${p.payload.siteTime.slice(0, 5)} by ${p.cert.deviceId}</div>`).join('');
    $('#drillTable').innerHTML = S.drills.length ? S.drills.map(d => `<tr><td class="mono">D${d.day} ${d.time.slice(0, 5)}</td><td>${d.ack || '—'}</td><td class="${d.result === 'PASS' ? 'ok' : d.result === 'waiting' ? 'warn' : 'bad'}">${d.result === 'waiting' ? 'waiting for guard' : esc(d.result)}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">No self-tests yet.</td></tr>';
    renderChips();
  }

  /* ---------------- evidence view ---------------- */
  function renderEvidence() {
    $('#deviceInfo').textContent = S.device ? `Device ${S.device.cert.deviceId} · key ${S.device.cert.fingerprint.slice(0, 12)}…` : 'creating device key…';
    $('#capList').innerHTML = S.capsules.length ? S.capsules.map(c => `<tr class="click${c.payload.capsuleId === S.selectedCap ? ' sel' : ''}" data-cap="${c.payload.capsuleId}"><td class="mono">${c.payload.capsuleId}</td><td><span class="pill lv-${c.payload.trigger}"><span class="dot"></span>${c.payload.trigger}</span></td><td class="mono">D${c.payload.siteDay} ${c.payload.siteTime}</td><td class="${c.lastVerify === false ? 'bad' : c.lastVerify ? 'ok' : 'muted'}">${c.lastVerify === undefined ? 'sealed' : c.lastVerify ? 'verified' : 'FAILED'}${c.original ? ' · tampered' : ''}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No evidence yet. A HIGH alert or a sensor attack seals a capsule within 30 s.</td></tr>';
    $$('#capList [data-cap]').forEach(r => r.onclick = () => { S.selectedCap = r.dataset.cap; access('viewed', r.dataset.cap); renderEvidence(); });
    const c = S.capsules.find(x => x.payload.capsuleId === S.selectedCap);
    if (c) {
      const p = c.payload;
      $('#capDetail').innerHTML = `<header><h3>${p.capsuleId} · ${p.trigger}</h3><div class="row">
        <button class="btn small primary" id="cVerify" data-perm="evidence.verify">Verify</button>
        <button class="btn small danger" id="cTamper" data-perm="evidence.tamper">${c.original ? 'Restore original' : 'Change one byte'}</button>
        <button class="btn small" id="cReport" data-perm="evidence.report">Incident report (MR + EN)</button>
        <button class="btn small" id="cExport" data-perm="evidence.export">Export capsule</button></div></header>
        ${can('evidence.view') ? '' : '<p class="note">Frames and details are hidden for the Guard role. Supervisor, Admin or Police (auditor) can open them. Verification still works.</p>'}
        <div class="reason">${esc(p.reason[S.lang] || p.reason.en)}</div>
        ${can('evidence.view') ? `<div class="filmstrip">${p.frames.map(f => f ? `<img src="${f}" alt="frame">` : '').join('') || '<span class="muted">no frames</span>'}</div>` : ''}
        <dl class="kv" style="margin-top:8px"><dt>SHA-256</dt><dd class="hash">${c.hash}</dd><dt>Signature</dt><dd class="hash">${c.signature.slice(0, 64)}…</dd>
        <dt>Device</dt><dd>${c.cert.deviceId} · ${c.cert.alg}</dd><dt>Key store</dt><dd>${esc(c.cert.keyStore)}</dd>
        <dt>Site time</dt><dd>Day ${p.siteDay} ${p.siteTime} · UTC ${p.utc}</dd><dt>Sensor health</dt><dd>${Object.entries(p.sensorHealth).map(([k, v]) => `${k}:${v.state}`).join(' · ')}</dd>
        <dt>Chain of events</dt><dd>${p.acknowledgements.map(a => `${a.siteTime} ${a.to}`).join(' → ')}${c.addenda.map(a => ` → ${a.body.siteTime} ${a.body.event}${a.body.by ? ' (' + a.body.by + ')' : ''}${a.body.label ? ': ' + a.body.label : ''}`).join('')}</dd></dl>
        <div id="cVerifyOut"></div>`;
      if (c.verifyView) showVerify($('#cVerifyOut'), c.verifyView.r, c.verifyView.ad);
      $('#cVerify').onclick = async () => { if (!need('evidence.verify')) return; access('verified', p.capsuleId); const r = await SK.verifyCapsule(c, S.device.cert.fingerprint); const ad = await verifyAddenda(c); c.lastVerify = r.ok && ad.ok; c.verifyView = { r, ad }; renderEvidence(); };
      $('#cTamper').onclick = () => { if (!need('evidence.tamper')) return; if (!c.original) { c.original = p.frames[0] || p.reason.en; if (p.frames[0]) { const s = p.frames[0]; const i = Math.floor(s.length * 0.6); p.frames[0] = s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1); } else p.reason.en = p.reason.en.replace(/\d/, d => String((+d + 1) % 10)); access('modified one byte (demo)', p.capsuleId); toast('One byte of frame 1 changed. Now verify.'); } else { if (p.frames[0]) p.frames[0] = c.original; else p.reason.en = c.original; c.original = null; access('restored original', p.capsuleId); } c.lastVerify = undefined; c.verifyView = null; renderEvidence(); };
      $('#cReport').onclick = () => { if (!need('evidence.report')) return; access('opened report', p.capsuleId); openReport(c); };
      $('#cExport').onclick = () => { if (!need('evidence.export')) return; access('exported', p.capsuleId); saveFile(`${p.capsuleId}.json`, JSON.stringify({ version: c.version, payload: p, hash: c.hash, signature: c.signature, cert: c.cert, addenda: c.addenda }, null, 1), 'application/json'); };
      $('#replayBtn').disabled = !can('evidence.view');
      drawReplay(c, 1);
    } else { $('#capDetail').innerHTML = '<p class="muted">Select a capsule.</p>'; $('#replayBtn').disabled = true; }
    $('#anchorList').innerHTML = S.anchors.map(a => `<div style="margin-bottom:8px"><div class="mono" style="font-size:12px">Day ${a.day} · ${a.time} → ${esc(a.to)}</div><div class="hash">root ${a.root}</div><div class="muted" style="font-size:12px">${a.leaves.length} leaves · ${a.caps.length} capsules · ${a.pow} PoW logs <button class="btn small" data-proof="${a.root}">Check inclusion</button></div><div class="proofout">${a.proofHTML || ''}</div></div>`).join('') || '<p class="muted">No anchors yet.</p>';
    $$('[data-proof]').forEach(b => b.onclick = async () => {
      const a = S.anchors.find(x => x.root === b.dataset.proof); const out = b.parentElement.nextElementSibling;
      const lines = [];
      for (let i = 0; i < a.caps.length; i++) {
        const cap = S.capsules.find(x => x.payload.capsuleId === a.caps[i]);
        const current = await SK.sha256Hex(SK.canonical(cap.payload));
        const ok = await SK.verifyProof(current, await SK.merkleProof(a.leaves, i), a.root);
        lines.push(`<div class="${ok ? 'ok' : 'bad'}" style="font-size:12px">${ok ? '✓' : '✗'} ${a.caps[i]} ${ok ? 'matches anchored root' : 'does NOT match: content changed after anchoring'}</div>`);
      }
      a.proofHTML = lines.join(''); out.innerHTML = a.proofHTML; access('checked anchor inclusion', a.caps.join(','));
    });
    renderUsers();
  }
  function renderUsers() {
    $('#accessLog').innerHTML = S.access.slice(0, 40).map(a => `<tr><td class="mono">D${a.day} ${a.time.slice(0, 5)}</td><td>${esc(a.who)}</td><td>${esc(a.action)}</td><td class="mono">${esc(a.cap)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">No activity yet.</td></tr>';
    $('#sessionList').innerHTML = S.sessions.map(x => `<tr><td class="mono">${x.time}</td><td>${esc(x.name)}</td><td>${esc(x.role)}</td></tr>`).join('');
  }
  async function verifyAddenda(c) {
    let prev = c.hash, ok = true;
    for (const a of c.addenda || []) {
      const h = await SK.sha256Hex(SK.canonical(a.body));
      if (h !== a.hash || a.body.prev !== prev || !(await SK.verifySig(c.cert.publicKey, a.hash, a.signature))) ok = false;
      prev = a.hash;
    }
    return { ok, n: (c.addenda || []).length };
  }
  function showVerify(out, r, ad) {
    out.innerHTML = `<ul class="steps-list">${r.steps.map(s => `<li><span class="${s.ok ? 'ok' : 'bad'}">${s.ok ? '✓' : '✗'}</span><span>${esc(s.step)} <span class="hash">${esc(s.detail)}</span></span></li>`).join('')}${ad ? `<li><span class="${ad.ok ? 'ok' : 'bad'}">${ad.ok ? '✓' : '✗'}</span><span>${ad.n} signed addenda chained to the capsule</span></li>` : ''}</ul>
      <div style="margin-top:6px;font-family:var(--f-display);font-size:20px;font-weight:700" class="${r.ok && (!ad || ad.ok) ? 'ok' : 'bad'}">${r.ok && (!ad || ad.ok) ? 'PASS · tamper-evident and independently verifiable' : 'FAIL · content does not match what the device signed'}</div>`;
  }
  let replayAnim = null;
  function drawReplay(c, frac) {
    const cv = $('#replayMap'), ctx = prepCanvas(cv), p = c.payload;
    drawBase(ctx, { permits: false }); drawSensors(ctx, S.sensors);
    const pts = p.track ? p.track.points : [];
    const n = Math.max(1, Math.floor(pts.length * frac));
    if (pts.length) {
      ctx.strokeStyle = COLORS.HIGH; ctx.lineWidth = 1.4; ctx.beginPath(); pts.slice(0, n).forEach((q, i) => i ? ctx.lineTo(q[1], q[2]) : ctx.moveTo(q[1], q[2])); ctx.stroke();
      const q = pts[n - 1]; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q[1], q[2], 3, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(8,14,22,.85)'; ctx.fillRect(6, SITE.h - 52, 190, 22); ctx.fillStyle = '#e8eef6'; ctx.font = '7px sans-serif';
      ctx.fillText(`${p.capsuleId} · ${p.track.id} · ${p.track.pattern} · t=${q[0]}s`, 10, SITE.h - 43); ctx.fillText(`max TS ${p.track.maxTs} · posture ${p.posture}`, 10, SITE.h - 34);
    }
    const sc = p.track ? p.track.scores : [];
    drawChart($('#replayChart'), sc.slice(0, Math.max(2, Math.floor(sc.length * frac))));
  }
  function openReport(c) {
    const p = c.payload, z = p.zone ? zoneById(p.zone) : null;
    const html = `<div class="report"><h2>SkyKavach घटना अहवाल · Incident Report</h2>
      <p><b>${esc(SITE.nameMr)}</b> · ${esc(SITE.name)} · ${p.siteId}<br>दिवस / Day ${p.siteDay} · ${p.siteTime} (site) · ${p.utc} (UTC)</p>
      <h3>सारांश (मराठी)</h3><p>${esc(p.reason.mr)}</p>
      <h3>Summary (English)</h3><p>${esc(p.reason.en)}</p>
      <table><tbody><tr><th>Capsule / पुरावा क्र.</th><td>${p.capsuleId}</td></tr><tr><th>Trigger</th><td>${p.trigger}</td></tr><tr><th>Zone / क्षेत्र</th><td>${z ? esc(z.name.en + ' / ' + z.name.mr) : '—'}</td></tr>
      <tr><th>Flight pattern</th><td>${p.track ? p.track.pattern : '—'}</td></tr><tr><th>Max threat score</th><td>${p.track ? p.track.maxTs : '—'}</td></tr><tr><th>Site posture</th><td>${p.posture}</td></tr>
      <tr><th>Sensor health at the time</th><td>${Object.entries(p.sensorHealth).map(([k, v]) => `${k}: ${v.state}`).join(', ')}</td></tr>
      <tr><th>Timeline / घटनाक्रम</th><td>${p.acknowledgements.map(a => `${a.siteTime} ${esc(a.to)}`).join('<br>')}${c.addenda.map(a => `<br>${a.body.siteTime} ${esc(a.body.event)}${a.body.by ? ' (' + esc(a.body.by) + ')' : ''}${a.body.label ? ': ' + esc(a.body.label) : ''}`).join('')}</td></tr>
      <tr><th>SHA-256</th><td style="font-family:monospace;font-size:11px;word-break:break-all">${c.hash}</td></tr><tr><th>Device / key</th><td>${c.cert.deviceId} · ${c.cert.fingerprint}</td></tr></tbody></table>
      <h3>Key frames (ground blurred for privacy)</h3><div style="display:flex;gap:4px;flex-wrap:wrap">${p.frames.filter((_, i) => i % 6 === 0).map(f => f ? `<img src="${f}" style="height:70px;border-radius:3px">` : '').join('')}</div>
      <h3>पडताळणी कशी करावी · How to verify</h3><ol><li>Capsule file (.json) मधील payload चे canonical JSON घेऊन SHA-256 काढा. / Compute SHA-256 of the canonical JSON of the payload.</li><li>तो hash वरील hash शी जुळला पाहिजे. / It must equal the hash above.</li><li>Device certificate मधील public key ने ECDSA P-256 सही तपासा. / Check the ECDSA P-256 signature with the certificate's public key.</li><li>दैनिक Merkle root पोलीस इनबॉक्समधील नोंदीशी जुळवा. / Match the daily Merkle root held by the police inbox.</li></ol>
      <p style="font-size:11px;color:#56687c">Tamper-evident and independently verifiable. This report does not by itself establish admissibility. SkyKavach detects, assesses and alerts only.</p></div>`;
    openModal(`Incident report · ${p.capsuleId}`, html, [{ label: 'Save report (.html)', fn: () => saveFile(`${p.capsuleId}-report.html`, `<!doctype html><meta charset="utf-8"><title>${p.capsuleId} report</title><body style="font-family:'Noto Sans Devanagari',sans-serif;max-width:860px;margin:24px auto">${html}</body>`, 'text/html') }]);
  }

  /* ---------------- memory & guard view ---------------- */
  const compassWord = b => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((b % 360) + 360) % 360 / 45) % 8];
  function renderMemory() {
    $('#visitTable').innerHTML = S.visits.length ? S.visits.map(v => `<tr${v.recon ? ' class="sel"' : ''}><td>Day ${v.day}</td><td class="mono">${v.time.slice(0, 5)}</td><td>${compassWord(v.bearing)}</td><td>${esc(T.pattern[v.pattern] ? T.pattern[v.pattern].en : v.pattern)}</td><td>${esc((zoneById(v.zoneId) || { name: { en: v.zoneId } }).name.en)}</td><td>${v.recon ? '<span class="pill lv-RECON"><span class="dot"></span>RECON</span>' : v.matches ? v.matches + ' similar' : '—'}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No unapproved visits yet. Try the "Recon week" scenario.</td></tr>';
    $('#postureLog').innerHTML = S.postureLog.map(p => `<tr><td class="mono">D${p.day} ${p.time.slice(0, 5)}</td><td><span class="pill lv-${p.p}">${p.p}</span></td><td>${esc(p.by)}</td><td>${esc(p.why)}</td></tr>`).join('');
    const d = siteDate(); $('#siteDate').textContent = d.toDateString();
    const active = skyPeriodActive();
    $('#skyCal').innerHTML = S.skyCal.map(e => `<tr><td>${esc(e.label)}</td><td class="mono">${e.from} → ${e.to}${e.hours ? ` · ${e.hours[0]}–${e.hours[1]}h` : ''}</td><td>${e.learned ? 'learned from guards' : 'preset'}</td><td>${active.includes(e) ? '<span class="warn">active</span>' : '—'}</td></tr>`).join('');
    $('#labelTable').innerHTML = S.labels.length ? S.labels.map(l => `<tr><td class="mono">D${l.day} ${l.time.slice(0, 5)}</td><td>${l.track}</td><td>${l.label}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Guards tap Real drone / Bird / Kite / Other after an alert.</td></tr>';
    $('#nightChk').checked = S.nightSchedule;
  }
  function openHandover() {
    const incidents = S.alerts.filter(a => !a.info && ['HIGH', 'ATTACK', 'RECON', 'DECOY'].includes(a.type));
    const unacked = S.alerts.filter(a => a.requiresAck && !a.acked);
    const pow = Object.entries(S.pow.checks).map(([k, c]) => `${sensorName(k)} ${c.n ? (c.ok / c.n * 100).toFixed(0) : '—'}%`).join(', ');
    const lastDrill = S.drills[0];
    const ep = effectivePosture();
    const recon = S.visits.filter(v => v.recon).length;
    const html = `<div class="report"><h2>शिफ्ट हस्तांतरण · Shift Handover Brief</h2><p>${esc(SITE.nameMr)} · Day ${S.day} · ${siteTime()}</p>
      <table><tbody>
      <tr><th>घटना / Incidents</th><td>${incidents.length} — ${incidents.slice(0, 5).map(a => `${a.time.slice(0, 5)} ${a.type}${a.capsuleId ? ' (' + a.capsuleId + ')' : ''}`).join(', ') || 'none / नाही'}</td></tr>
      <tr><th>पोच न दिलेले इशारे / Unacknowledged</th><td>${unacked.length ? unacked.map(a => `${a.time.slice(0, 5)} ${a.type}`).join(', ') : 'none / नाही'}</td></tr>
      <tr><th>सतर्कता / Posture</th><td>${T.posture[ep.p].mr} / ${ep.p} (${esc(ep.why)})</td></tr>
      <tr><th>टेहळणी / Recon</th><td>${recon ? `${recon} visit(s) flagged; posture raised until Day ${S.reconUntilDay}` : 'no pattern / नमुना नाही'}</td></tr>
      <tr><th>Proof-of-Watch</th><td>${pow}</td></tr>
      <tr><th>शेवटचा सराव / Last drill</th><td>${lastDrill ? `${lastDrill.time.slice(0, 5)} ${lastDrill.result}${lastDrill.ack ? ', ack ' + lastDrill.ack : ''}` : 'none today / आज नाही'}</td></tr>
      <tr><th>सेन्सर / Sensors now</th><td>${Object.entries(S.health).map(([k, h]) => `${sensorName(k)}: ${h.state}`).join(', ')}</td></tr>
      </tbody></table><p style="font-size:12px">पुढील गार्डने: पोच न दिलेले इशारे तपासा, सेन्सर पाहणी करा. · Next guard: clear unacknowledged alerts and walk the sensor posts.</p></div>`;
    openModal('Shift handover brief', html, [{ label: 'Save brief (.html)', fn: () => saveFile(`handover-day${S.day}.html`, `<!doctype html><meta charset="utf-8"><body style="font-family:'Noto Sans Devanagari',sans-serif;max-width:860px;margin:24px auto">${html}</body>`, 'text/html') }]);
  }

  /* ---------------- setup view (Paint-the-Zone) ---------------- */
  let brushC = 3, stroke = null, pendingPoly = null, editZoneId = null;
  function drawSetup() {
    const cv = $('#setupMap'), ctx = prepCanvas(cv);
    drawBase(ctx); drawSensors(ctx, S.sensors);
    if (editZoneId) { const z = zoneById(editZoneId); if (z) { polyPath(ctx, z.poly); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.stroke(); ctx.setLineDash([]); } }
    const poly = stroke || pendingPoly;
    if (poly && poly.length > 1) { const col = critColor(brushC); ctx.beginPath(); poly.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); if (!stroke) ctx.closePath(); ctx.fillStyle = withAlpha(col, 0.3); if (!stroke) ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); }
  }
  function simplify(pts, tol) { // radial distance + keep convex-ish outline
    const out = [pts[0]]; pts.forEach(p => { if (SK.dist(p, out[out.length - 1]) >= tol) out.push(p); });
    return out.length >= 3 ? out : null;
  }
  function renderSetup() {
    setHTML($('#zoneList'), S.zones.map(z => `<tr class="click${z.id === editZoneId ? ' sel' : ''}" data-zone="${z.id}"><td><span style="color:${critColor(z.c)}">■</span> ${esc(z.name.en)} <span class="muted">${esc(z.name.mr)}</span></td><td class="num">${z.c}${z.window ? ' *' : ''}</td><td class="num">${z.buffer} m</td></tr>`).join(''));
    setHTML($('#permitList'), S.permits.map(p => `<tr><td><b>${p.id}</b> ${esc(p.operator)}</td><td>${esc(p.zoneId ? (zoneById(p.zoneId) || { name: { en: 'custom' } }).name.en : 'custom')}</td><td class="mono">${fmtH(p.from)}–${fmtH(p.to)}</td></tr>`).join(''));
    setHTML($('#pZone'), S.zones.map(z => `<option value="${z.id}">${esc(z.name.en)}</option>`).join(''));
    setHTML($('#sopContacts'), S.sop.contacts.map((c, i) => `<label class="field">${esc(c.role)}<input data-contact="${i}" data-perm="sop.edit" value="${esc(c.phone)}"></label>`).join(''));
    if (document.activeElement !== $('#siteInput')) $('#siteInput').value = S.siteName;
    if (document.activeElement !== $('#sopMr')) $('#sopMr').value = S.sop.steps.mr.join('\n');
    if (document.activeElement !== $('#sopEn')) $('#sopEn').value = S.sop.steps.en.join('\n');
    $('#horizonV').textContent = S.horizon + ' px';
    setHTML($('#retentionStats'), `<dt>Non-incident frames held</dt><dd>${S.frameMeta.length}</dd><dt>Auto-deleted so far</dt><dd>${S.purged}</dd><dt>Kept as sealed evidence</dt><dd>${S.capsules.reduce((a, c) => a + c.payload.frames.length, 0)} frames in ${S.capsules.length} capsules</dd>`);
  }
  const fmtH = h => `${pad(Math.floor(h))}:${pad(Math.round((h % 1) * 60))}`;
  function editZone(id) {
    editZoneId = id; pendingPoly = null; const z = zoneById(id);
    showZoneForm(true, z);
  }
  function showZoneForm(show, z) {
    $('#zoneFields').hidden = !show; $('#zoneActions').hidden = !show; $('#zoneFormHint').hidden = show;
    $('#zDelete').hidden = !editZoneId;
    if (show) {
      $('#zNameEn').value = z ? z.name.en : ''; $('#zNameMr').value = z ? z.name.mr : '';
      $('#zC').value = String(z ? z.c : brushC); $('#zBuf').value = z ? z.buffer : (brushC === 3 ? 30 : brushC === 2 ? 20 : 10); $('#zBufV').textContent = $('#zBuf').value + ' m';
      $('#zWinFrom').value = z && z.window ? z.window.from : ''; $('#zWinTo').value = z && z.window ? z.window.to : '';
      if (!z) $('#zNameEn').focus();
    }
    dirty.setup = true;
  }
  function saveZone() {
    const c = +$('#zC').value, buffer = +$('#zBuf').value, en = $('#zNameEn').value.trim() || 'New zone', mr = $('#zNameMr').value.trim() || en;
    const wf = $('#zWinFrom').value, wt = $('#zWinTo').value;
    const win = wf !== '' && wt !== '' ? { from: +wf, to: +wt, c: 3 } : undefined;
    if (editZoneId) { const z = zoneById(editZoneId); Object.assign(z, { c, buffer, name: { en, mr, hi: z.name.hi || mr }, window: win }); toast(`Zone "${en}" updated`); }
    else if (pendingPoly) { S.zones.push({ id: 'z' + Date.now().toString(36), c, buffer, R0: 50, poly: pendingPoly, name: { en, mr, hi: mr }, window: win }); toast(`Zone "${en}" painted · criticality ${c}`); }
    pendingPoly = null; editZoneId = null; showZoneForm(false); dirty.setup = true;
  }

  /* ---------------- red team ---------------- */
  let rtExtra = [], rtResult = null;
  function rtSensors() { const s = clone(S.sensors); s.mics = s.mics.concat(rtExtra); s.cams.forEach(c => { c.heading = camHeading(c); c.health = S.health[c.id].sees === false ? 0 : 1; }); return s; }
  function runRedTeam() {
    const sun = $('#rtSun').value;
    const env = { trees: SITE.trees, treeHeight: SITE.treeHeight, sunBearing: sun === '' ? undefined : (sun === '0' ? 0 : 180) };
    const count = +$('#rtCount').value;
    $('#rtSummary').textContent = 'Running…';
    setTimeout(() => {
      const t0 = performance.now();
      rtResult = SK.redTeam(S.zones, rtSensors(), env, SITE, { count, cell: 16 });
      const ms = Math.round(performance.now() - t0);
      drawRedTeam();
      const zs = Object.values(rtResult.perZone).sort((a, b) => b.zone.c - a.zone.c);
      $('#rtTable').innerHTML = zs.map(z => `<tr><td>${esc(z.zone.name.en)}</td><td class="num ${z.undetected / Math.max(1, z.warn.length) > 0.2 ? 'bad' : ''}">${z.warn.length ? Math.round(z.undetected / z.warn.length * 100) : 0}%</td><td class="num">${z.medianWarn !== null ? Math.round(z.medianWarn) + ' s' : '—'}</td></tr>`).join('');
      const blind = rtResult.heat.filter(h => h < 0.2).length / rtResult.heat.length;
      $('#rtSummary').textContent = `${rtResult.paths} virtual drones · ${(blind * 100).toFixed(0)}% of site area weakly covered at 30 m · ${ms} ms`;
      $('#rtApply').disabled = false;
    }, 30);
  }
  function drawRedTeam() {
    const cv = $('#rtMap'), ctx = prepCanvas(cv);
    drawBase(ctx, { permits: false });
    if (rtResult) {
      const { cols, rows, cell, heat, miss } = rtResult; const maxMiss = Math.max(1, ...miss);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const h = heat[r * cols + c], m = miss[r * cols + c] / maxMiss;
        const col = h > 0.5 ? '47,158,116' : h > 0.2 ? '217,165,49' : '224,70,74';
        ctx.fillStyle = `rgba(${col},${0.18 + (h <= 0.2 ? 0.15 + m * 0.35 : 0)})`; ctx.fillRect(c * cell, r * cell, cell, cell);
      }
      const sgg = rtResult.suggestion;
      if (sgg) { ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(sgg.x, sgg.y, 150, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = COLORS.accent; ctx.beginPath(); ctx.arc(sgg.x, sgg.y, 5, 0, 7); ctx.fill(); ctx.font = '600 8px sans-serif'; const lbl = '+ suggested acoustic node'; const lw = ctx.measureText(lbl).width; ctx.fillText(lbl, sgg.x + 8 + lw > SITE.w - 4 ? sgg.x - 8 - lw : sgg.x + 8, sgg.y + 3); }
    }
    const s = rtSensors(); drawSensors(ctx, s);
  }

  /* ---------------- AEGL corridor ---------------- */
  const AEG = { nodes: [0, 150, 300, 450], playing: false };
  function drawAegl() {
    const cv = $('#aeglCanvas'), ctx = cv.getContext('2d'), W = cv.width, H = cv.height, sx = (W - 80) / 450, ox = 40, ly = 150;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = COLORS.land; ctx.fillRect(0, 0, W, H);
    const x = +$('#aegX').value, lat = +$('#aegL').value, noise = +$('#aegN').value / 100;
    $('#aegXV').textContent = x + ' m'; $('#aegLV').textContent = lat + ' m'; $('#aegNV').textContent = '±' + Math.round(noise * 100) + '%';
    ctx.strokeStyle = '#4b5d73'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, ly); ctx.lineTo(ox + 450 * sx, ly); ctx.stroke();
    ctx.font = '12px ' + css('--f-body');
    const R = SK.rng(Math.round(x * 7 + lat * 13 + noise * 1000));
    const alt = 30, powers = AEG.nodes.map(nx => { const d2 = (nx - x) ** 2 + lat * lat + alt * alt; return (1 / d2) * (1 + (R() - 0.5) * 2 * noise); });
    const maxP = Math.max(...powers);
    AEG.nodes.forEach((nx, i) => {
      const px = ox + nx * sx; ctx.fillStyle = COLORS.accent; ctx.beginPath(); ctx.moveTo(px, ly - 14); ctx.lineTo(px - 7, ly + 8); ctx.lineTo(px + 7, ly + 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = COLORS.muted; ctx.fillText(`Pylon ${i + 1}`, px - 20, ly + 26);
      const bh = powers[i] / maxP * 70; ctx.fillStyle = withAlpha(COLORS.accent, 0.35); ctx.fillRect(px - 8, ly + 40 + (70 - bh), 16, bh);
    });
    // strongest adjacent pair → closed form
    let k = 0; for (let i = 0; i < powers.length - 1; i++) if (powers[i] + powers[i + 1] > powers[k] + powers[k + 1]) k = i;
    const D = AEG.nodes[k + 1] - AEG.nodes[k], pairX = AEG.nodes[k] + SK.aeglPair(powers[k], powers[k + 1], D);
    const wls = SK.aeglWLS(AEG.nodes, powers, Math.sqrt(lat * lat + alt * alt), 0, 450, 0.5);
    const dx = ox + x * sx; ctx.fillStyle = COLORS.HIGH; ctx.beginPath(); ctx.arc(dx, ly - lat * 1.2 - 30, 5, 0, 7); ctx.fill(); ctx.fillText('drone (truth)', dx + 8, ly - lat * 1.2 - 26);
    ctx.strokeStyle = COLORS.MEDIUM; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox + pairX * sx, ly - 22); ctx.lineTo(ox + pairX * sx, ly + 4); ctx.stroke(); ctx.fillStyle = COLORS.MEDIUM; ctx.fillText('pair', ox + pairX * sx - 10, ly - 26);
    ctx.strokeStyle = COLORS.LOW; ctx.beginPath(); ctx.moveTo(ox + wls * sx, ly - 4); ctx.lineTo(ox + wls * sx, ly + 30); ctx.stroke(); ctx.fillStyle = COLORS.LOW; ctx.fillText('WLS', ox + wls * sx - 10, ly + 42 + 76);
    const seg = Math.min(AEG.nodes.length - 2, Math.max(0, Math.floor(wls / 150)));
    const trueSeg = Math.min(AEG.nodes.length - 2, Math.max(0, Math.floor(x / 150)));
    ctx.fillStyle = withAlpha(COLORS.LOW, 0.12); ctx.fillRect(ox + AEG.nodes[seg] * sx, 20, 150 * sx, ly - 30);
    $('#aegOut').innerHTML = `<dt>Segment</dt><dd class="${seg === trueSeg ? 'ok' : 'bad'}">Pylon ${seg + 1} – ${seg + 2} ${seg === trueSeg ? '(correct)' : '(wrong)'}</dd><dt>Pair estimate</dt><dd>${pairX.toFixed(1)} m · error ${Math.abs(pairX - x).toFixed(1)} m</dd><dt>WLS (4 nodes)</dt><dd>${wls.toFixed(1)} m · error ${Math.abs(wls - x).toFixed(1)} m</dd><dt>Strongest pair</dt><dd>nodes ${k + 1} & ${k + 2}</dd><dt>Note</dt><dd style="font-family:var(--f-body)">Pair formula assumes the source is on the line; WLS accounts for offset and altitude.</dd>`;
  }

  /* ---------------- modal, toast, files ---------------- */
  function openModal(title, html, actions) {
    $('#modalTitle').textContent = title; $('#modalBody').innerHTML = html;
    $('#modalActions').innerHTML = '';
    (actions || []).concat([{ label: 'Close', fn: closeModal }]).forEach(a => { const b = document.createElement('button'); b.className = 'btn small' + (a.label === 'Close' ? '' : ' primary'); b.textContent = a.label; b.onclick = a.fn; $('#modalActions').appendChild(b); });
    $('#modal').hidden = false;
  }
  function closeModal() { $('#modal').hidden = true; }
  function toast(msg) { const d = document.createElement('div'); d.textContent = msg; $('#toast').appendChild(d); setTimeout(() => d.remove(), 3800); }
  let downloadsNS;
  async function saveFile(name, text, mime) {
    try {
      if (downloadsNS === undefined) downloadsNS = window.claude && window.claude.use ? await window.claude.use('downloads') : null;
      if (downloadsNS) { await downloadsNS.save({ filename: name, data: new Blob([text], { type: mime }) }); toast('Saved ' + name); return; }
    } catch (e) { if (e && e.code) { toast('Save cancelled'); return; } }
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Saved ' + name); }
    catch (e) { toast('Saving files is not available here'); }
  }

  /* ---------------- guided demo (autopilot) ---------------- */
  let demo = null;
  async function guidedDemo() {
    if (demo) { demo.stop = true; return; }
    const ctl = demo = { stop: false };
    const btn = $('#demoBtn'); btn.textContent = '■ Stop demo';
    const cap = $('#demoCaption');
    const wait = ms => new Promise((res, rej) => { const t0 = performance.now(); const tick = () => { if (ctl.stop) return rej('stop'); if (performance.now() - t0 >= ms) return res(); setTimeout(tick, 100); }; tick(); });
    const until = async (cond, maxMs = 60000) => { const t0 = performance.now(); while (!cond()) { if (ctl.stop) throw 'stop'; if (performance.now() - t0 > maxMs) return false; await wait(150); } return true; };
    let n = 0; const total = 13;
    const say = (title, line) => { n++; cap.hidden = false; cap.innerHTML = `<b>${n}/${total} · ${esc(title)}</b><span>${esc(line)}</span>`; };
    const speedTo = v => { S.speed = v; $$('#speedSeg [data-speed]').forEach(x => x.setAttribute('aria-pressed', +x.dataset.speed === v ? 'true' : 'false')); };
    const prevRole = S.role;
    const asRole = r => { S.role = r; applyRoleUI(); };
    try {
      S.running = true; $('#playBtn').textContent = '❚❚';
      Object.keys(S.attacks).forEach(k => { S.attacks[k] = false; });
      S.manualPosture = 'NORMAL'; S.alerts.forEach(a => { if (a.requiresAck && !a.acked) ackAlert(a, 'system (demo reset)'); });
      asRole('Admin');
      setView('setup'); say('Paint-the-Zone', 'A supervisor paints critical zones on the site picture with a Marathi name and alert distance. No GIS skills needed.'); await wait(5000);
      setView('live'); speedTo(4); runScenario(SCENARIOS.find(x => x.id === 'transit'));
      say('Harmless transit', 'A drone crosses far from anything critical. TISE labels it TRANSIT and keeps it LOW. The guard is not disturbed.'); await wait(9000);
      runScenario(SCENARIOS.find(x => x.id === 'orbit')); speedTo(4);
      say('Orbit over the water intake', 'Same kind of drone, now circling a criticality-3 zone. Watch the score climb with the reason and ETA.');
      const d = () => S.tracks.find(t => t.cls === 'drone');
      await until(() => d() && d().score && d().score.level !== 'LOW', 60000);
      S.manualPosture = 'HIGH_ALERT'; logPosture('Supervisor', 'demo: VIP visit tonight');
      say('Posture raised to HIGH ALERT', 'Supervisor raises posture (VIP visit). Thresholds stay fixed; only K = 1.5 changes, so HIGH arrives sooner and the reason says why.');
      await until(() => d() && d().score && d().score.level === 'HIGH', 60000);
      say('HIGH alert', 'Siren, voice alert, SMS and the Guard Action Card. An evidence capsule is sealed 15 s later. Nobody acknowledges…'); await wait(2500);
      const hi = S.alerts.find(a => a.type === 'HIGH' && !a.acked);
      speedTo(8);
      await until(() => hi && hi.ladder.some(l => l.to === 'Supervisor'), 30000);
      say('Escalation Ladder', 'No acknowledgement in 60 s, so the supervisor phone rings. At 120 s the police contact from the SOP is alerted.'); await wait(4000);
      if (hi) ackAlert(hi, 'Supervisor');
      if (hi) labelAlert(hi.id, 'Real drone');
      speedTo(2); S.manualPosture = 'NORMAL'; logPosture('Supervisor', 'demo: VIP visit over');
      S.attacks.cover = true; renderChips();
      say('Attack: camera covered', 'The camera frame entropy collapses. KavachShield flags Camera 1 within one 5-second check and its vote drops.');
      await until(() => S.health.cam1.state !== 'HEALTHY', 20000); await wait(2000);
      S.attacks.micFlood = true; renderChips();
      say('Coordinated attack', 'Mic A is flooded too. Two sensors failing within 30 s = SENSOR UNDER ATTACK, which outranks a drone alert.');
      await until(() => Object.values(S.health).some(h => h.state === 'ATTACK'), 20000); await wait(4000);
      Object.keys(S.attacks).forEach(k => { S.attacks[k] = false; }); renderChips();
      S.alerts.filter(a => a.type === 'ATTACK' && !a.acked).forEach(a => ackAlert(a, 'Guard'));
      setView('shield'); runDrill();
      say('Kavach Drill + Proof-of-Watch', 'A TEST alert runs through the whole chain. The guard acknowledges, the drill passes, and today\'s watch log is signed.');
      await wait(3000); S.alerts.filter(a => a.type === 'DRILL' && !a.acked).forEach(a => ackAlert(a, 'Guard'));
      await until(() => Object.values(S.health).every(h => h.state === 'HEALTHY'), 20000);
      $('#powSeal').click(); await wait(4000);
      setView('live'); S.reconRun = 0; runScenario(SCENARIOS.find(x => x.id === 'recon')); speedTo(8);
      say('Recon Memory', 'The same drone scouts the intake on Day 1, Day 3 and Day 5. The third visit raises RECON PATTERN and posture goes ELEVATED for 7 days.');
      await until(() => S.alerts.some(a => a.type === 'RECON'), 120000);
      S.alerts.filter(a => a.type === 'RECON' && !a.acked).forEach(a => ackAlert(a, 'Supervisor'));
      speedTo(1); setView('memory'); await wait(5000);
      asRole('Admin'); setView('evidence');
      S.selectedCap = (S.capsules.find(c => c.payload.trigger === 'HIGH') || S.capsules[0] || {}).payload?.capsuleId || null; renderEvidence();
      say('Evidence capsule', 'Verify: hash, device key and signature all pass. Then one byte of a frame is changed and verification fails.');
      await wait(1500); if ($('#cVerify')) $('#cVerify').click(); await wait(3500);
      if ($('#cTamper')) $('#cTamper').click(); await wait(800); if ($('#cVerify')) $('#cVerify').click(); await wait(3500);
      if ($('#cTamper')) $('#cTamper').click(); await wait(500); $('#anchorBtn').click(); await wait(1500);
      if ($('#cReport')) $('#cReport').click();
      say('Bilingual incident report', 'A Marathi + English report with timeline, key frames and verification steps, ready to attach to a police complaint.'); await wait(6000); closeModal();
      setView('redteam');
      say('Red Team: test my site', '300 virtual drones fly the attack library through the same sensor model. Red = blind spots. Then one suggested node is added.');
      runRedTeam(); await wait(4000); $('#rtApply').click(); await wait(5000);
      cap.innerHTML = '<b>Demo complete</b><span>Detect. Judge. Prove. SkyKavach never jams or disables a drone; it alerts the authorised agencies.</span>';
      await wait(6000);
    } catch (e) { /* stopped */ }
    finally { cap.hidden = true; demo = null; btn.textContent = '▶ Guided demo'; speedTo(1); asRole(prevRole); }
  }

  /* ---------------- wiring ---------------- */
  function setView(v) {
    curView = v;
    $$('#tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
    $$('main > section.view').forEach(s => { s.hidden = s.id !== 'view-' + v; });
    Object.keys(dirty).forEach(k => { dirty[k] = true; });
    if (v === 'redteam') drawRedTeam();
    if (v === 'redteam') drawAegl();
    if (v === 'users') { applyRBAC(); renderUsers(); }
    try { history.replaceState(null, '', '#' + v); } catch (e) { location.hash = v; }
  }
  function wire() {
    COLORS.LOW = css('--low'); COLORS.MEDIUM = css('--med'); COLORS.HIGH = css('--high'); COLORS.ATTACK = css('--attack'); COLORS.ANOMALY = css('--attack');
    COLORS.AUTH = css('--auth'); COLORS.accent = css('--accent'); COLORS.muted = css('--muted'); COLORS.land = css('--land'); COLORS.water = css('--water'); COLORS.road = css('--road'); COLORS.tree = css('--tree');
    $$('#tabs [role=tab]').forEach(b => b.onclick = () => setView(b.dataset.view));
    $('#scenarios').innerHTML = SCENARIOS.map(s => `<button data-sc="${s.id}"><b>${esc(s.name)}</b><span>${esc(s.expect)}</span></button>`).join('');
    $$('#scenarios [data-sc]').forEach(b => b.onclick = () => { if (!need('demo.control')) return; $$('#scenarios [data-sc]').forEach(x => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true'); S.reconRun = 0; runScenario(SCENARIOS.find(s => s.id === b.dataset.sc)); });
    $('#postureSel').onchange = e => { if (!need('posture.set')) { e.target.value = S.manualPosture; return; } S.manualPosture = e.target.value; logPosture(S.role, 'set manually'); toast(`Posture set to ${e.target.value} by ${S.role}`); };
    $$('#speedSeg [data-speed]').forEach(b => b.onclick = () => { S.speed = +b.dataset.speed; $$('#speedSeg [data-speed]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); });
    $('#playBtn').onclick = () => { S.running = !S.running; $('#playBtn').textContent = S.running ? '❚❚' : '▶'; $('#playBtn').setAttribute('aria-label', S.running ? 'Pause' : 'Play'); };
    $$('#langSeg [data-lang]').forEach(b => b.onclick = () => { S.lang = b.dataset.lang; $$('#langSeg [data-lang]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); Object.keys(dirty).forEach(k => { dirty[k] = true; }); renderPanels(); window.SKI18N.set(S.lang); populateVoices(); });
    $('#loginForm').addEventListener('submit', e => {
      e.preventDefault();
      S.userName = $('#loginName').value.trim() || 'User';
      S.role = (document.querySelector('#roleCards input:checked') || {}).value || 'Guard';
      S.sessions.unshift({ time: new Date().toLocaleTimeString(), name: S.userName, role: S.role });
      access('signed in as ' + S.role, null, S.userName + ' (' + S.role + ')');
      $('#login').hidden = true;
      Object.keys(dirty).forEach(k => { dirty[k] = true; });
      applyRoleUI(); toast(`Welcome, ${S.userName} (${S.role})`);
    });
    $('#userChip').onclick = () => { $('#loginName').value = S.userName; $('#login').hidden = false; $('#loginName').focus(); };
    $('#siteInput').oninput = e => { if (!can('zone.edit')) return; S.siteName = e.target.value || SITE.name; $('#siteName').textContent = S.siteName; };
    $('#voiceSel').onchange = e => { S.voiceURI = e.target.value; testSound(); };
    $('#soundBtn').onclick = () => { setSound(!S.sound); if (S.sound) chime(); };
    $('#testSoundBtn').onclick = testSound;
    $('#demoBtn').onclick = () => { if (demo || need('demo.control')) guidedDemo(); };
    $$('[data-attack]').forEach(b => b.onclick = () => { if (!need('demo.control')) return; const k = b.dataset.attack; S.attacks[k] = !S.attacks[k]; toast(`${b.textContent}: ${S.attacks[k] ? 'ON' : 'off'}`); renderChips(); });
    const restore = () => { Object.keys(S.attacks).forEach(k => { S.attacks[k] = false; }); toast('All attacks stopped. Sensors recover after two clean checks.'); renderChips(); };
    $('#restoreBtn').onclick = restore;
    $('#cfDraw').onclick = () => { if (!need('demo.control')) return; S.cf.drawing = !S.cf.drawing; if (S.cf.drawing && S.cf.pts.length >= 2) S.cf.pts = []; cfUpdate(); };
    $('#cfFly').onclick = cfFly;
    $('#cfClear').onclick = () => { S.cf = { drawing: false, pts: [] }; cfUpdate(); };
    $('#cfAlt').oninput = () => { $('#cfAltV').textContent = $('#cfAlt').value + ' m'; };
    $('#cfSpd').oninput = () => { $('#cfSpdV').textContent = $('#cfSpd').value + ' m/s'; };
    document.addEventListener('toggle', e => { if (e.target.classList && e.target.classList.contains('why')) S.whyOpen = e.target.open; }, true);
    const map = $('#map');
    map.addEventListener('click', e => { if (S.cf.drawing) { const q = canvasPoint(map, e); S.cf.pts.push({ x: Math.round(q.x), y: Math.round(q.y) }); cfUpdate(); return; } const p = canvasPoint(map, e); let best = null, bd = 14; S.tracks.forEach(t => { if (!t.detected) return; const d = SK.dist(t.pos, p); if (d < bd) { bd = d; best = t; } }); S.selectedId = best ? best.id : null; dirty.all = true; });
    // setup painting
    const sm = $('#setupMap');
    sm.addEventListener('pointerdown', e => { if (!need('zone.edit')) return; sm.setPointerCapture(e.pointerId); stroke = [canvasPoint(sm, e)]; editZoneId = null; });
    sm.addEventListener('pointermove', e => { if (stroke) { const p = canvasPoint(sm, e); if (SK.dist(p, stroke[stroke.length - 1]) > 2) stroke.push(p); } });
    sm.addEventListener('pointerup', e => {
      if (!stroke) return;
      const s = stroke; stroke = null;
      if (s.length < 4) { const p = s[0]; const z = S.zones.slice().reverse().find(zz => SK.pointInPoly(p, zz.poly)); if (z) editZone(z.id); return; }
      pendingPoly = simplify(s, 6);
      if (pendingPoly) { editZoneId = null; showZoneForm(true, null); }
    });
    $$('#brushSeg [data-c]').forEach(b => b.onclick = () => { brushC = +b.dataset.c; $$('#brushSeg [data-c]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); if (pendingPoly) $('#zC').value = String(brushC); });
    $('#clearPaint').onclick = () => { pendingPoly = null; stroke = null; editZoneId = null; showZoneForm(false); };
    $('#zBuf').oninput = () => { $('#zBufV').textContent = $('#zBuf').value + ' m'; };
    $('#zSave').onclick = () => { if (need('zone.edit')) saveZone(); };
    $('#zCancel').onclick = () => { pendingPoly = null; editZoneId = null; showZoneForm(false); };
    $('#zDelete').onclick = () => { if (!editZoneId || !need('zone.edit')) return; const z = zoneById(editZoneId); S.zones = S.zones.filter(x => x.id !== editZoneId); toast(`Zone "${z.name.en}" deleted`); editZoneId = null; showZoneForm(false); };
    $('#pAdd').onclick = () => {
      if (!need('permit.edit')) return;
      const z = zoneById($('#pZone').value); const c = SK.centroid(z.poly);
      const area = [{ x: c.x - 70, y: c.y - 60 }, { x: c.x + 70, y: c.y - 60 }, { x: c.x + 70, y: c.y + 60 }, { x: c.x - 70, y: c.y + 60 }];
      S.permits.push({ id: 'PW-' + (115 + S.permits.length), operator: $('#pOp').value.trim() || 'Approved operator', zoneId: z.id, area, from: +$('#pFrom').value, to: +$('#pTo').value });
      toast('Permit window added'); dirty.setup = true;
    };
    $('#horizon').oninput = e => { if (!can('privacy.edit')) return; S.horizon = +e.target.value; S.camRef = null; dirty.setup = true; };
    $('#retention').onchange = e => { if (!need('privacy.edit')) return; S.retentionSec = +e.target.value; dirty.setup = true; };
    $('#sopSave').onclick = () => { if (!need('sop.edit')) return; $$('[data-contact]').forEach(inp => { S.sop.contacts[+inp.dataset.contact].phone = inp.value.trim(); }); S.sop.steps.mr = $('#sopMr').value.split('\n').filter(Boolean); S.sop.steps.en = $('#sopEn').value.split('\n').filter(Boolean); toast('Saved: alert contacts and guard steps updated'); };
    // shield
    $('#drillBtn').onclick = () => { if (need('drill.run')) runDrill(); };
    $('#powSeal').onclick = async () => {
      if (!S.device || !need('pow.seal')) return;
      const payload = { type: 'PROOF_OF_WATCH', siteId: SITE.id, day: S.day, siteTime: siteTime(), utc: new Date().toISOString(), interval: '5 s (demo); 10 min production', sensors: Object.fromEntries(Object.entries(S.pow.checks).map(([k, c]) => [k, { checks: c.n, watching: c.n ? +(c.ok / c.n * 100).toFixed(2) : null }])), gaps: S.pow.gaps.map(g => ({ sensor: g.sensor, from: g.start, to: g.end, cause: g.cause })), drills: S.drills.map(d => ({ time: d.time, result: d.result })) };
      S.powLogs.unshift(await SK.sealCapsule(payload, S.device)); toast('Proof-of-Watch log signed'); dirty.shield = true;
    };
    // evidence
    $('#anchorBtn').onclick = async () => {
      if (!need('evidence.anchor')) return;
      if (!S.capsules.length && !S.powLogs.length) { toast('Nothing to anchor yet'); return; }
      const caps = S.capsules.slice().reverse();
      const leaves = caps.map(c => c.hash).concat(S.powLogs.map(p => p.hash));
      const root = await SK.merkleRoot(leaves);
      S.anchors.unshift({ day: S.day, time: siteTime(), root, leaves, caps: caps.map(c => c.payload.capsuleId), pow: S.powLogs.length, to: 'Police control inbox (simulated)' });
      access('anchored daily root', caps.map(c => c.payload.capsuleId).join(','), 'device'); toast('Daily Merkle root sent outside the device');
    };
    $('#replayBtn').onclick = () => {
      const c = S.capsules.find(x => x.payload.capsuleId === S.selectedCap); if (!c) return; access('replayed', c.payload.capsuleId);
      cancelAnimationFrame(replayAnim); const t0 = performance.now();
      const step = n => { const f = Math.min(1, (n - t0) / 6000); drawReplay(c, f); if (f < 1) replayAnim = requestAnimationFrame(step); }; replayAnim = requestAnimationFrame(step);
    };
    $('#verifyFile').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { const cap = JSON.parse(await f.text()); const r = await SK.verifyCapsule(cap); const ad = await verifyAddenda(cap); showVerify($('#verifyFileOut'), r, ad); access('verified external file', cap.payload && cap.payload.capsuleId); }
      catch (err) { $('#verifyFileOut').innerHTML = '<p class="bad">That file is not a SkyKavach capsule.</p>'; }
      e.target.value = '';
    };
    // memory
    $('#handoverBtn').onclick = openHandover; $('#handoverBtn2').onclick = openHandover;
    $('#nightChk').onchange = e => { if (!need('posture.set')) { e.target.checked = S.nightSchedule; return; } S.nightSchedule = e.target.checked; logPosture(S.role, e.target.checked ? 'night schedule on' : 'night schedule off'); };
    $('#jumpKite').onclick = () => { const d = siteDate(); const target = new Date(d.getFullYear() + (d.getMonth() > 0 ? 1 : 0), 0, 14); S.dateOffsetDays += Math.round((target - d) / 864e5); toast('Site date set to ' + siteDate().toDateString()); dirty.memory = true; };
    // red team, corridor
    $('#rtRun').onclick = () => { if (need('redteam.run')) runRedTeam(); };
    $('#rtApply').onclick = () => { if (!need('redteam.run')) return; if (!rtResult || !rtResult.suggestion) return; rtExtra.push({ id: 'micX' + rtExtra.length, x: rtResult.suggestion.x, y: rtResult.suggestion.y, range: 150 }); toast('Suggested node added. Re-running…'); runRedTeam(); };
    $('#rtReset').onclick = () => { rtExtra = []; rtResult = null; drawRedTeam(); $('#rtTable').innerHTML = '<tr><td colspan="4" class="muted">Run the simulation.</td></tr>'; $('#rtSummary').textContent = ''; };
    ['#aegX', '#aegL', '#aegN'].forEach(s => { $(s).oninput = drawAegl; });
    $('#aegPlay').onclick = () => { AEG.playing = !AEG.playing; $('#aegPlay').textContent = AEG.playing ? '❚❚ Stop' : '▶ Fly along the line'; const tick = () => { if (!AEG.playing) return; const x = $('#aegX'); x.value = (+x.value + 2) % 451; drawAegl(); requestAnimationFrame(tick); }; tick(); };
    const act = e => {
      const t = e.target.closest('[data-ack],[data-label],[data-confirm],[data-feedack],[data-zone]'); if (!t) return;
      if (e.type === 'click' && e.detail !== 0) return;
      e.preventDefault();
      const permOf = t.dataset.ack || t.dataset.feedack ? 'alert.ack' : t.dataset.label ? 'alert.label' : t.dataset.confirm ? 'permit.confirm' : null;
      if (permOf && !need(permOf)) return;
      if (t.dataset.ack) ackAlert(S.alerts.find(x => x.id === +t.dataset.ack), t.dataset.who);
      else if (t.dataset.label) labelAlert(+t.dataset.alert, t.dataset.label);
      else if (t.dataset.feedack) ackAlert(S.alerts.find(x => x.id === +t.dataset.feedack), S.role);
      else if (t.dataset.confirm) { const tr = S.tracks.find(x => x.id === +t.dataset.confirm); if (tr && tr.auth === 'PENDING') { tr.auth = 'CONFIRMED'; tr.authBy = S.role; pushFeed('AUTH', `${tr.label} confirmed authorised (${tr.permitId}) by ${S.role}.`, tr); } }
      else if (t.dataset.zone) editZone(t.dataset.zone);
      dirty.all = true;
    };
    document.addEventListener('pointerdown', e => { if (e.button === 0) act(e); });
    document.addEventListener('click', act);
    $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (document.getElementById('view-' + v) && v !== curView) setView(v); });
  }

  async function boot() {
    wire();
    window.SKI18N.start();
    const v = location.hash.slice(1);
    setView(document.getElementById('view-' + v) ? v : 'live');
    S.postureLog.push({ day: 1, time: siteTime(), p: 'NORMAL', by: 'system', why: 'shift start' });
    $('#siteName').textContent = S.siteName; populateVoices(); cfUpdate();
    $('#login').hidden = false; setTimeout(() => { try { $('#loginName').select(); } catch (e) { /* ignore */ } }, 50);
    // warm up baselines with a few clean frames
    for (let i = 0; i < 8; i++) { renderCam(); const m = SK.frameMetrics(camRaw.getContext('2d').getImageData(0, 0, 320, 180).data, 320, 180); S.camBase.ent.push(m.entropy); S.camBase.var.push(m.variance); if (!S.camRef) S.camRef = structureThumb(); }
    for (let i = 0; i < 12; i++) micTick();
    try { S.device = await SK.createDevice('SK-EDGE-07A', SITE.id); } catch (e) { toast('Signing unavailable in this browser'); }
    dirty.evidence = true;
    requestAnimationFrame(loop);
    // expose for debugging / tests
    window.SKAPP = { S, runScenario: id => runScenario(SCENARIOS.find(s => s.id === id)), setView, runDrill, ackAlert, guidedDemo, can };
    applyRBAC();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
