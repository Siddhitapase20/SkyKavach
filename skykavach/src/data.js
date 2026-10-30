/* SkyKavach demo site, sensors, scenarios and language strings.
 * Demo layout is fictional: "Site 7 · Water Treatment Plant". Units: metres. Map 480 x 300 m.
 */
(function (root) {
  'use strict';
  const sq = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

  const SITE = {
    id: 'SITE-7', name: 'Site 7 · Water Treatment Plant', nameMr: 'साइट ७ · जलशुद्धीकरण केंद्र',
    w: 480, h: 300, river: { y0: 0, y1: 34 }, road: { y0: 278, y1: 296 },
    trees: [{ x0: 170, y0: 56, x1: 250, y1: 112 }], treeHeight: 15,
    landmark: 'Pole P-1', startClock: 22 * 3600 + 40 * 60, startDate: '2026-10-30'
  };

  // criticality 3 = red, 2 = orange, 1 = green. buffer = alert distance from the edge.
  const ZONES = [
    { id: 'intake', c: 3, buffer: 30, R0: 50, poly: sq(298, 36, 352, 82), name: { en: 'Water Intake', mr: 'पाणी इनटेक', hi: 'जल इनटेक' } },
    { id: 'transformer', c: 3, buffer: 30, R0: 50, poly: sq(56, 60, 132, 122), name: { en: 'Transformer Yard', mr: 'ट्रान्सफॉर्मर यार्ड', hi: 'ट्रांसफॉर्मर यार्ड' } },
    { id: 'chlorine', c: 2, window: { from: 8, to: 18, c: 3 }, buffer: 25, R0: 50, poly: sq(400, 118, 452, 170), name: { en: 'Chlorine Unloading Bay', mr: 'क्लोरीन उतराई जागा', hi: 'क्लोरीन अनलोडिंग बे' } },
    { id: 'filters', c: 2, buffer: 20, R0: 50, poly: sq(250, 150, 362, 228), name: { en: 'Filter Beds', mr: 'फिल्टर बेड', hi: 'फ़िल्टर बेड' } },
    { id: 'admin', c: 1, buffer: 10, R0: 50, poly: sq(160, 188, 230, 248), name: { en: 'Admin Block', mr: 'प्रशासकीय इमारत', hi: 'प्रशासनिक भवन' } },
    { id: 'carpark', c: 1, buffer: 10, R0: 50, poly: sq(28, 200, 130, 262), name: { en: 'Car Park', mr: 'वाहनतळ', hi: 'पार्किंग' } }
  ];

  const SENSORS = {
    cams: [
      { id: 'cam1', name: 'Camera 1 (north sky)', x: 240, y: 286, heading: -90, fov: 92, range: 270 },
      { id: 'cam2', name: 'Camera 2 (west sky)', x: 18, y: 24, heading: 35, fov: 74, range: 230 }
    ],
    mics: [
      { id: 'micA', name: 'Acoustic Node A', x: 332, y: 104, range: 150 },
      { id: 'micB', name: 'Acoustic Node B', x: 104, y: 164, range: 150 }
    ]
  };

  const PERMITS = [
    { id: 'PW-114', operator: 'MSEDCL line inspection', zoneId: 'transformer', area: sq(30, 40, 170, 150), from: 22.5, to: 23.75, note: 'Inspection drone, operator Shri. Patil' }
  ];

  const SOP = {
    contacts: [
      { role: 'Guard on duty', name: 'Gate post', phone: '+91 90000 00001' },
      { role: 'Shift supervisor', name: 'Supervisor', phone: '+91 90000 00002' },
      { role: 'Control room / Police', name: 'Police control (112)', phone: '112' }
    ],
    steps: {
      en: ['Inform the control room.', 'Call police control (112).', 'Keep people away from {zone}.', 'Do not try to shoot, jam or catch the drone.'],
      mr: ['नियंत्रण कक्षाला कळवा.', 'पोलीस नियंत्रण कक्षाला फोन करा (११२).', 'लोकांना {zone} पासून दूर ठेवा.', 'ड्रोन पाडण्याचा, जॅम करण्याचा किंवा पकडण्याचा प्रयत्न करू नका.'],
      hi: ['कंट्रोल रूम को सूचित करें।', 'पुलिस कंट्रोल (112) को फ़ोन करें।', 'लोगों को {zone} से दूर रखें।', 'ड्रोन को गिराने, जाम करने या पकड़ने की कोशिश न करें।']
    }
  };

  const T = {
    level: {
      LOW: { en: 'LOW', mr: 'कमी धोका', hi: 'कम ख़तरा' },
      MEDIUM: { en: 'MEDIUM', mr: 'मध्यम धोका', hi: 'मध्यम ख़तरा' },
      HIGH: { en: 'HIGH', mr: 'उच्च धोका', hi: 'उच्च ख़तरा' }
    },
    pattern: {
      TRANSIT: { en: 'passing through', mr: 'पार जात आहे', hi: 'गुज़र रहा है' },
      HOVER: { en: 'hovering', mr: 'एका जागी थांबला आहे', hi: 'एक जगह मंडरा रहा है' },
      ORBIT: { en: 'circling', mr: 'घिरट्या घालत आहे', hi: 'चक्कर लगा रहा है' },
      SURVEY: { en: 'surveying in a grid', mr: 'परिसराचे सर्वेक्षण करत आहे', hi: 'क्षेत्र का सर्वेक्षण कर रहा है' },
      APPROACH: { en: 'approaching', mr: 'जवळ येत आहे', hi: 'पास आ रहा है' },
      DESCENT: { en: 'descending', mr: 'खाली उतरत आहे', hi: 'नीचे उतर रहा है' },
      MANOEUVRE: { en: 'manoeuvring', mr: 'हालचाल करत आहे', hi: 'घूम रहा है' },
      UNKNOWN: { en: 'just detected', mr: 'नुकताच आढळला', hi: 'अभी दिखा' }
    },
    posture: {
      NORMAL: { en: 'NORMAL', mr: 'सामान्य', hi: 'सामान्य' },
      ELEVATED: { en: 'ELEVATED', mr: 'वाढीव सतर्कता', hi: 'बढ़ी सतर्कता' },
      HIGH_ALERT: { en: 'HIGH ALERT', mr: 'उच्च सतर्कता', hi: 'उच्च सतर्कता' }
    },
    voiceHigh: {
      en: 'Warning. A drone is {pattern} near {zone}. Threat level high. Inform the control room.',
      mr: 'सावधान! {zone} जवळ ड्रोन {pattern}. धोका पातळी उच्च. कृपया नियंत्रण कक्षाला कळवा.',
      hi: 'सावधान! {zone} के पास ड्रोन {pattern}। ख़तरे का स्तर उच्च। कृपया कंट्रोल रूम को सूचित करें।'
    },
    voiceMed: {
      en: 'Drone {pattern} near {zone}. Threat level medium.',
      mr: '{zone} जवळ ड्रोन {pattern}. धोका पातळी मध्यम.',
      hi: '{zone} के पास ड्रोन {pattern}। ख़तरे का स्तर मध्यम।'
    },
    attack: {
      en: 'Sensor under attack. {sensors} disabled. Check the site now.',
      mr: 'सेन्सरवर हल्ला! {sensors} निकामी केले आहेत. त्वरित तपासणी करा.',
      hi: 'सेंसर पर हमला! {sensors} निष्क्रिय किए गए। तुरंत जाँच करें।'
    },
    anomaly: {
      en: '{sensors} is not seeing normally ({why}).',
      mr: '{sensors} नीट दिसत नाही ({why}).',
      hi: '{sensors} ठीक से नहीं देख रहा ({why})।'
    },
    recon: {
      en: 'Recon pattern: {n} similar drone visits in 7 days near {zone}. Site posture raised to ELEVATED.',
      mr: 'टेहळणीचा नमुना: ७ दिवसांत {zone} जवळ {n} सारख्या ड्रोन भेटी. साइटची सतर्कता वाढवली.',
      hi: 'टोही पैटर्न: 7 दिनों में {zone} के पास {n} समान ड्रोन विज़िट। साइट सतर्कता बढ़ाई गई।'
    },
    decoy: {
      en: 'Possible decoy: one drone {p1} near {z1} while another is {p2} toward {z2}.',
      mr: 'संभाव्य फसवणूक: एक ड्रोन {z1} जवळ {p1}, तर दुसरा {z2} कडे {p2}.',
      hi: 'संभावित धोखा: एक ड्रोन {z1} के पास {p1}, दूसरा {z2} की ओर {p2}।'
    },
    attackVoice: {
      en: 'Warning. Our sensors are under attack. A camera or sound node has been disabled. Check the site now.',
      mr: 'सावधान! सेन्सरवर हल्ला झाला आहे. कॅमेरा किंवा ध्वनी नोड निकामी केले आहेत. त्वरित तपासणी करा.',
      hi: 'सावधान! सेंसर पर हमला हुआ है। कैमरा या ध्वनि नोड निष्क्रिय किए गए हैं। तुरंत जाँच करें।'
    },
    reconVoice: {
      en: 'Warning. The same drone keeps returning. This may be reconnaissance. Site alert level raised.',
      mr: 'सावधान! एकाच ड्रोनच्या वारंवार भेटी आढळल्या. ही टेहळणी असू शकते. साइटची सतर्कता वाढवली आहे.',
      hi: 'सावधान! एक ही ड्रोन बार-बार आ रहा है। यह टोही हो सकती है। साइट की सतर्कता बढ़ा दी गई है।'
    },
    decoyVoice: {
      en: 'Warning. One drone may be a decoy while another approaches.',
      mr: 'सावधान! एक ड्रोन लक्ष विचलित करत असताना दुसरा ड्रोन जवळ येत आहे.',
      hi: 'सावधान! एक ड्रोन ध्यान भटका रहा है, जबकि दूसरा ड्रोन पास आ रहा है।'
    },
    genericZone: { en: 'a sensitive area', mr: 'संवेदनशील क्षेत्रा', hi: 'संवेदनशील क्षेत्र' },
    drill: { en: 'TEST ALERT. Kavach Drill. Please acknowledge.', mr: 'चाचणी इशारा. कवच सराव. कृपया पोच द्या.', hi: 'परीक्षण अलर्ट। कवच अभ्यास। कृपया पुष्टि करें।' },
    ack: { en: 'Acknowledge', mr: 'पोच द्या', hi: 'पुष्टि करें' },
    actionCard: { en: 'What to do', mr: 'काय करावे', hi: 'क्या करें' }
  };

  /* Scenarios: each returns track specs. t0 = seconds after scenario start. */
  const SCENARIOS = [
    { id: 'transit', explain: 'A drone crosses the corner of the site in a straight line, far from anything critical.', watch: 'it stays LOW and the guard is not disturbed.', name: 'Harmless transit', expect: 'Stays LOW · TRANSIT', tracks: () => [
      { cls: 'drone', conf: 0.88, size: 'S', t0: 0, start: { x: -10, y: 262, alt: 70 }, segs: [{ to: { x: 490, y: 236 }, speed: 11 }], seed: 11 }] },
    { id: 'orbit', explain: 'A small drone flies in and keeps circling the water intake, a critical zone.', watch: 'the score climbs LOW → MEDIUM → HIGH. At HIGH the siren and voice alert play, the guard phone rings and evidence is sealed.', name: 'Orbit over intake', expect: 'LOW → MEDIUM → HIGH · ORBIT', tracks: () => [
      { cls: 'drone', conf: 0.91, size: 'S', t0: 0, start: { x: 490, y: 10, alt: 45 }, segs: [{ to: { x: 400, y: 52 }, speed: 9 }, { orbit: { x: 325, y: 59 }, r: 62, turns: 4, speed: 6.5 }, { to: { x: 490, y: -10 }, speed: 10 }], seed: 21 }] },
    { id: 'survey', explain: 'A drone flies back-and-forth lines over the filter beds, like someone mapping the site.', watch: 'the behaviour changes to SURVEY and the score rises.', name: 'Survey grid', expect: 'SURVEY over filter beds', tracks: () => [
      { cls: 'drone', conf: 0.86, size: 'M', t0: 0, start: { x: 490, y: 160, alt: 55 }, segs: [
        { to: { x: 370, y: 150 }, speed: 9 }, { to: { x: 245, y: 150 }, speed: 6 }, { to: { x: 245, y: 170 }, speed: 6 }, { to: { x: 370, y: 170 }, speed: 6 },
        { to: { x: 370, y: 190 }, speed: 6 }, { to: { x: 245, y: 190 }, speed: 6 }, { to: { x: 245, y: 210 }, speed: 6 }, { to: { x: 370, y: 210 }, speed: 6 },
        { to: { x: 370, y: 230 }, speed: 6 }, { to: { x: 245, y: 230 }, speed: 6 }, { to: { x: -10, y: 260 }, speed: 10 }], seed: 31 }] },
    { id: 'descent', explain: 'A drone flies to the transformer yard, stops above it and comes down low.', watch: 'the behaviour changes to DESCENT (possible drop) and it goes HIGH quickly.', name: 'Approach + drop', expect: 'APPROACH → DESCENT on transformer yard', tracks: () => [
      { cls: 'drone', conf: 0.9, size: 'M', t0: 0, start: { x: 250, y: 300, alt: 60 }, segs: [{ to: { x: 96, y: 92 }, speed: 8 }, { hover: 15 }, { descend: 12, rate: 1.5 }, { hover: 15 }, { climb: 50, rate: 3 }, { to: { x: -10, y: 20 }, speed: 10 }], seed: 41 }] },
    { id: 'authorised', explain: 'An approved inspection drone (permit PW-114) flies inside its permit area, then leaves it and circles the intake.', watch: 'it shows AUTHORISED-PENDING until a supervisor confirms. Once it leaves the permit area it is scored like any other drone.', name: 'Authorised inspection', expect: 'AUTHORISED-PENDING (permit PW-114)', tracks: () => [
      { cls: 'drone', conf: 0.9, size: 'M', t0: 0, start: { x: 60, y: 140, alt: 35 }, segs: [{ hover: 6 }, { to: { x: 140, y: 140 }, speed: 3 }, { to: { x: 140, y: 50 }, speed: 3 }, { to: { x: 50, y: 50 }, speed: 3 }, { hover: 10 }, { to: { x: 250, y: 120 }, speed: 5 }, { orbit: { x: 325, y: 59 }, r: 60, turns: 2, speed: 6 }], seed: 51, permitHint: true }] },
    { id: 'kite', explain: 'Three birds cross the site and a kite hangs near the filter beds; the camera mistakes the kite for a drone.', watch: 'birds are ignored. Label the kite alert as Kite on the guard phone; next time it is held back during kite season.', name: 'Kites and birds', expect: 'Birds ignored · kite held for confirmation', tracks: () => [
      { cls: 'drone', trueCls: 'kite', conf: 0.52, size: 'S', t0: 0, start: { x: 262, y: 240, alt: 35 }, segs: [{ to: { x: 268, y: 242 }, speed: 0.3 }, { to: { x: 258, y: 238 }, speed: 0.3 }, { to: { x: 267, y: 243 }, speed: 0.3 }, { to: { x: 259, y: 239 }, speed: 0.3 }, { to: { x: 266, y: 241 }, speed: 0.3 }, { to: { x: 260, y: 240 }, speed: 0.3 }], seed: 61, jitter: 0.3 },
      { cls: 'bird', conf: 0.8, size: 'S', t0: 2, start: { x: -10, y: 120, alt: 25 }, segs: [{ to: { x: 490, y: 90 }, speed: 12 }], seed: 62, jitter: 1.5 },
      { cls: 'bird', conf: 0.78, size: 'S', t0: 3, start: { x: -10, y: 130, alt: 27 }, segs: [{ to: { x: 490, y: 102 }, speed: 12 }], seed: 63, jitter: 1.5 },
      { cls: 'bird', conf: 0.75, size: 'S', t0: 2.5, start: { x: -10, y: 112, alt: 22 }, segs: [{ to: { x: 490, y: 82 }, speed: 12 }], seed: 64, jitter: 1.5 }] },
    { id: 'decoy', explain: 'One drone hovers over the car park as a decoy while a second drone comes in low toward the intake.', watch: 'SkyKavach flags POSSIBLE DECOY instead of only watching the first drone.', name: 'Decoy + approach', expect: 'POSSIBLE DECOY (beta)', tracks: () => [
      { cls: 'drone', conf: 0.88, size: 'S', t0: 0, start: { x: -10, y: 250, alt: 40 }, segs: [{ to: { x: 60, y: 238 }, speed: 8 }, { hover: 150 }], seed: 71 },
      { cls: 'drone', conf: 0.84, size: 'S', t0: 14, start: { x: 490, y: -10, alt: 18 }, segs: [{ to: { x: 352, y: 82 }, speed: 7 }, { hover: 70 }], seed: 72 }] },
    { id: 'recon', explain: 'The same drone scouts the intake on Day 1, Day 3 and Day 5 (the demo skips the days for you).', watch: 'the third visit raises RECON PATTERN and the site goes to ELEVATED alert for 7 days.', name: 'Recon week (Day 1/3/5)', expect: 'RECON PATTERN on 3rd visit', recon: true, tracks: () => [
      { cls: 'drone', conf: 0.9, size: 'S', t0: 0, start: { x: 490, y: 4, alt: 45 }, segs: [{ to: { x: 395, y: 40 }, speed: 10 }, { orbit: { x: 325, y: 59 }, r: 64, turns: 1.3, speed: 8 }, { to: { x: 490, y: 4 }, speed: 12 }], seed: 81 }] }
  ];

  const SKY_CALENDAR = [
    { id: 'kite', kind: 'kite', from: '01-08', to: '01-20', label: 'Kite season (Makar Sankranti)', learned: false },
    { id: 'roost', kind: 'bird', from: '01-01', to: '12-31', hours: [18, 19.5], label: 'Evening bird roosting, 18:00–19:30', learned: false }
  ];

  const D = { SITE, ZONES, SENSORS, PERMITS, SOP, T, SCENARIOS, SKY_CALENDAR };
  if (typeof module !== 'undefined' && module.exports) module.exports = D; else root.SKDATA = D;
})(typeof window !== 'undefined' ? window : globalThis);
