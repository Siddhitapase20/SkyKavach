const SK = require('../src/engine.js'); const D = require('../src/data.js');
for (const sc of D.SCENARIOS) {
  for (const tr of sc.tracks()) {
    if (tr.cls !== 'drone') continue;
    const path = SK.buildPath(tr.start, tr.segs, tr.seed, tr.jitter ?? 0.25);
    const s = path.filter((_, i) => i % 5 === 0).map((p, i) => ({ t: i * 0.5, ...p }));
    const st = { dwell: {} }; let firstMed = null, firstHigh = null, maxTs = 0; const labels = {};
    for (let i = 1; i < s.length; i++) {
      st.pos = s[i]; st.vel = { x: (s[i].x - s[i-1].x)/0.5, y: (s[i].y - s[i-1].y)/0.5 };
      const pat = SK.classifyPattern(s.slice(Math.max(0, i - 120), i + 1).filter(p=>p.t>=s[i].t-60), D.ZONES);
      labels[pat.label] = (labels[pat.label]||0)+1;
      const r = SK.scoreTrack(st, { zones: D.ZONES, posture: 'NORMAL', pattern: pat, clockSec: D.SITE.startClock + s[i].t, dt: 0.5 });
      maxTs = Math.max(maxTs, r.ts);
      if (firstMed === null && r.ts >= 0.3) firstMed = s[i].t;
      if (firstHigh === null && r.ts >= 0.6) firstHigh = s[i].t;
    }
    console.log(sc.id.padEnd(11), 'dur', (s.length/2).toFixed(0).padStart(4), 'max', maxTs.toFixed(2), 'MED@', firstMed, 'HIGH@', firstHigh, JSON.stringify(labels));
  }
}
