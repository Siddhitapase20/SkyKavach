// Writes dist/voices/phrases.json: every spoken alert sentence, keyed exactly as the app looks them up.
const D = require('./src/data.js');
const fill = (s, m) => s.replace(/\{(\w+)\}/g, (_, k) => m[k] !== undefined ? m[k] : '');
const out = [];
for (const lang of ['mr', 'hi']) {
  const zones = D.ZONES.map(z => ({ id: z.id, name: z.name[lang] })).concat([{ id: 'generic', name: D.T.genericZone[lang] }]);
  for (const lv of ['HIGH', 'MEDIUM']) for (const z of zones) for (const pat of Object.keys(D.T.pattern)) {
    out.push({ lang, key: `${lv}_${z.id}_${pat}`, text: fill(lv === 'HIGH' ? D.T.voiceHigh[lang] : D.T.voiceMed[lang], { zone: z.name, pattern: D.T.pattern[pat][lang] }) });
  }
  out.push({ lang, key: 'attack', text: D.T.attackVoice[lang] }, { lang, key: 'recon', text: D.T.reconVoice[lang] }, { lang, key: 'decoy', text: D.T.decoyVoice[lang] }, { lang, key: 'drill', text: D.T.drill[lang] });
}
require('fs').mkdirSync('dist/voices', { recursive: true });
require('fs').writeFileSync('dist/voices/phrases.json', JSON.stringify(out, null, 1));
console.log(out.length, 'phrases');
