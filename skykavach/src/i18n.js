/* SkyKavach UI language layer. Translates every visible text node whose English text is in the
 * dictionary, including text the app renders later (a MutationObserver catches new nodes).
 * English is the key; switching back restores the original. */
(function (root) {
  'use strict';
  // English: [Marathi, Hindi]
  const D = {
    'Live': ['थेट', 'लाइव'], 'Paint-the-Zone': ['क्षेत्र रंगवा', 'ज़ोन पेंट करें'], 'KavachShield': ['कवचशील्ड', 'कवचशील्ड'],
    'Evidence': ['पुरावा', 'सबूत'], 'Memory & Guards': ['स्मृती व गार्ड', 'स्मृति व गार्ड'], 'Red Team': ['रेड टीम', 'रेड टीम'],
    'Corridor': ['कॉरिडॉर', 'कॉरिडोर'], 'How it works': ['हे कसे चालते', 'यह कैसे काम करता है'],
    'Site picture': ['साइटचे चित्र', 'साइट का चित्र'], 'Run a scenario': ['प्रसंग चालवा', 'परिदृश्य चलाएँ'],
    'Threat score timeline': ['धोका गुण कालरेषा', 'ख़तरा स्कोर समयरेखा'], 'Threat assessment': ['धोका मूल्यांकन', 'ख़तरा आकलन'],
    'Camera 1 · north sky': ['कॅमेरा १ · उत्तर आकाश', 'कैमरा 1 · उत्तर आकाश'], 'Attack the sensors': ['सेन्सरवर हल्ला करा', 'सेंसर पर हमला करें'],
    'Guard loop': ['गार्ड साखळी', 'गार्ड चक्र'], 'Alert feed': ['इशारे', 'अलर्ट सूची'], 'Shift brief': ['शिफ्ट माहिती', 'शिफ्ट सार'],
    'Quiet sky.': ['आकाश शांत आहे.', 'आसमान शांत है।'], 'No alerts': ['इशारे नाहीत', 'कोई अलर्ट नहीं'],
    'Show undetected (simulation truth)': ['न आढळलेले दाखवा (सिम्युलेशन)', 'न पकड़े गए दिखाएँ (सिमुलेशन)'],
    'Criticality 3': ['महत्त्व ३', 'महत्व 3'], 'Criticality 2': ['महत्त्व २', 'महत्व 2'], 'Criticality 1': ['महत्त्व १', 'महत्व 1'],
    'Permit area': ['परवानगी क्षेत्र', 'अनुमति क्षेत्र'], 'Sensor coverage': ['सेन्सर व्याप्ती', 'सेंसर कवरेज'],
    'Harmless transit': ['निरुपद्रवी उड्डाण', 'हानिरहित उड़ान'], 'Orbit over intake': ['इनटेकवर घिरट्या', 'इनटेक पर चक्कर'],
    'Survey grid': ['सर्वेक्षण जाळे', 'सर्वेक्षण ग्रिड'], 'Approach + drop': ['जवळ येऊन खाली उतरणे', 'पास आकर नीचे उतरना'],
    'Authorised inspection': ['अधिकृत तपासणी', 'अधिकृत निरीक्षण'], 'Kites and birds': ['पतंग आणि पक्षी', 'पतंग और पक्षी'],
    'Decoy + approach': ['फसवा ड्रोन + हल्ला', 'छलावा + हमला'], 'Recon week (Day 1/3/5)': ['टेहळणी आठवडा (दिवस १/३/५)', 'टोही सप्ताह (दिन 1/3/5)'],
    'Cover camera': ['कॅमेरा झाका', 'कैमरा ढकें'], 'Laser glare': ['लेझर चमक', 'लेज़र चमक'], 'Turn camera': ['कॅमेरा फिरवा', 'कैमरा घुमाएँ'],
    'Flood mic A': ['माइक A बधिर करा', 'माइक A पर शोर'], 'Cut power node A': ['नोड A ची वीज तोडा', 'नोड A की बिजली काटें'], 'Restore all': ['सर्व पूर्ववत', 'सब बहाल करें'],
    'Zone details': ['क्षेत्र तपशील', 'ज़ोन विवरण'], 'Zones': ['क्षेत्रे', 'ज़ोन'], 'Flight Permit Windows': ['उड्डाण परवानगी वेळा', 'उड़ान अनुमति समय'],
    'Privacy sky-mask & retention': ['गोपनीयता मास्क व साठवण कालावधी', 'गोपनीयता मास्क और संग्रह अवधि'],
    'Site SOP · Guard Action Card': ['साइट SOP · गार्ड कृती कार्ड', 'साइट SOP · गार्ड कार्य कार्ड'],
    'Save zone': ['क्षेत्र जतन करा', 'ज़ोन सहेजें'], 'Delete': ['हटवा', 'हटाएँ'], 'Cancel': ['रद्द करा', 'रद्द करें'],
    'Add permit': ['परवानगी जोडा', 'अनुमति जोड़ें'], 'Save SOP': ['SOP जतन करा', 'SOP सहेजें'], 'Clear stroke': ['रेषा पुसा', 'रेखा मिटाएँ'],
    'Paint an area, or pick a zone below to edit it.': ['एखादे क्षेत्र रंगवा, किंवा बदलण्यासाठी खालील क्षेत्र निवडा.', 'कोई क्षेत्र पेंट करें, या बदलने के लिए नीचे ज़ोन चुनें।'],
    'Sensor health fingerprint': ['सेन्सर आरोग्य ठसा', 'सेंसर स्वास्थ्य फ़िंगरप्रिंट'], 'Anomaly log': ['विसंगती नोंद', 'विसंगति लॉग'],
    'Proof-of-Watch': ['पहाऱ्याचा पुरावा', 'निगरानी का सबूत'], "Seal today's log": ['आजची नोंद मोहोरबंद करा', 'आज का लॉग सील करें'],
    'Kavach Drill': ['कवच सराव', 'कवच अभ्यास'], 'Run drill now': ['आता सराव करा', 'अभी अभ्यास करें'], 'No anomalies.': ['विसंगती नाही.', 'कोई विसंगति नहीं।'],
    'Evidence capsules': ['पुरावा कॅप्सूल', 'सबूत कैप्सूल'], 'Incident replay': ['घटनेची पुनरावृत्ती', 'घटना रीप्ले'], 'Verify independently': ['स्वतंत्रपणे पडताळा', 'स्वतंत्र रूप से जाँचें'],
    'Daily anchor': ['दैनिक अँकर', 'दैनिक एंकर'], 'Anchor now': ['आता अँकर करा', 'अभी एंकर करें'], 'Access log': ['प्रवेश नोंद', 'एक्सेस लॉग'],
    'Verify': ['पडताळा', 'जाँचें'], 'Change one byte': ['एक बाइट बदला', 'एक बाइट बदलें'], 'Restore original': ['मूळ पूर्ववत करा', 'मूल बहाल करें'],
    'Export capsule': ['कॅप्सूल निर्यात', 'कैप्सूल निर्यात'], 'Incident report (MR + EN)': ['घटना अहवाल (मराठी + EN)', 'घटना रिपोर्ट (मराठी + EN)'],
    'Select a capsule.': ['कॅप्सूल निवडा.', 'कैप्सूल चुनें।'], 'No anchors yet.': ['अद्याप अँकर नाही.', 'अभी कोई एंकर नहीं।'],
    'Choose capsule file (.json)': ['कॅप्सूल फाइल निवडा (.json)', 'कैप्सूल फ़ाइल चुनें (.json)'],
    'Recon Memory': ['टेहळणी स्मृती', 'टोही स्मृति'], 'Site posture log': ['साइट सतर्कता नोंद', 'साइट सतर्कता लॉग'], 'Sky Learning': ['आकाश शिक्षण', 'आकाश सीख'],
    'Guard labels': ['गार्डचे लेबल', 'गार्ड लेबल'], 'Shift handover brief': ['शिफ्ट हस्तांतरण माहिती', 'शिफ्ट हैंडओवर सार'], 'Generate brief': ['माहिती तयार करा', 'सार बनाएँ'],
    'Jump to 14 Jan': ['१४ जानेवारीला जा', '14 जनवरी पर जाएँ'], 'Nothing sent yet.': ['अद्याप काही पाठवले नाही.', 'अभी कुछ नहीं भेजा।'],
    'Test my site': ['माझी साइट तपासा', 'मेरी साइट जाँचें'], 'Attack library': ['हल्ला संग्रह', 'हमला संग्रह'], 'Run simulation': ['सिम्युलेशन चालवा', 'सिमुलेशन चलाएँ'],
    'Add suggested node': ['सुचवलेला नोड जोडा', 'सुझाया नोड जोड़ें'], 'Reset sensors': ['सेन्सर रीसेट', 'सेंसर रीसेट'], 'Expected warning per zone': ['प्रत्येक क्षेत्राला अपेक्षित पूर्वसूचना', 'हर ज़ोन की अपेक्षित चेतावनी'],
    'Run the simulation.': ['सिम्युलेशन चालवा.', 'सिमुलेशन चलाएँ।'], 'Likely detected': ['बहुधा आढळेल', 'संभवतः पकड़ा जाएगा'], 'Weak': ['कमकुवत', 'कमज़ोर'], 'Blind spot': ['अंध क्षेत्र', 'अंधा क्षेत्र'], 'Suggested new node': ['सुचवलेला नवा नोड', 'सुझाया नया नोड'],
    'Corridor Acoustic Mesh (AEGL)': ['कॉरिडॉर ध्वनी जाळे (AEGL)', 'कॉरिडोर ध्वनि जाल (AEGL)'], 'Estimate': ['अंदाज', 'अनुमान'], 'Method': ['पद्धत', 'विधि'],
    'Detect. Judge. Prove.': ['ओळखा. ठरवा. सिद्ध करा.', 'पहचानें. परखें. साबित करें.'],
    'Sensor': ['सेन्सर', 'सेंसर'], 'State': ['स्थिती', 'स्थिति'], 'Weight': ['वजन', 'भार'], 'Signals': ['संकेत', 'संकेत'], 'Checks': ['तपासण्या', 'जाँचें'],
    'Watching': ['पाहत आहे', 'निगरानी'], 'Gaps': ['खंड', 'अंतराल'], 'Time': ['वेळ', 'समय'], 'Engine': ['इंजिन', 'इंजन'], 'Channels': ['माध्यमे', 'माध्यम'],
    'Guard ack': ['गार्ड पोच', 'गार्ड पुष्टि'], 'Result': ['निकाल', 'परिणाम'], 'Capsule': ['कॅप्सूल', 'कैप्सूल'], 'Trigger': ['कारण', 'कारण'], 'Site time': ['साइट वेळ', 'साइट समय'],
    'Hash': ['हॅश', 'हैश'], 'Status': ['स्थिती', 'स्थिति'], 'Who': ['कोण', 'कौन'], 'Action': ['कृती', 'कार्य'], 'Day': ['दिवस', 'दिन'], 'Bearing': ['दिशा', 'दिशा'],
    'Pattern': ['नमुना', 'पैटर्न'], 'Zone': ['क्षेत्र', 'ज़ोन'], 'Size': ['आकार', 'आकार'], 'Match': ['जुळणी', 'मिलान'], 'Posture': ['सतर्कता', 'सतर्कता'], 'By': ['कोणी', 'किसने'],
    'Why': ['का', 'क्यों'], 'Sky calendar': ['आकाश दिनदर्शिका', 'आकाश कैलेंडर'], 'Dates': ['तारखा', 'तारीख़ें'], 'Source': ['स्रोत', 'स्रोत'], 'Active': ['सक्रिय', 'सक्रिय'],
    'Track': ['ट्रॅक', 'ट्रैक'], 'Label': ['लेबल', 'लेबल'], 'Use': ['वापर', 'उपयोग'], 'Paths': ['मार्ग', 'मार्ग'], 'Unseen at arrival': ['पोहोचताना न दिसलेले', 'पहुँचने पर अनदेखे'],
    'Median warning': ['मध्यम पूर्वसूचना वेळ', 'माध्य चेतावनी'], 'Permit': ['परवानगी', 'अनुमति'], 'Area': ['क्षेत्र', 'क्षेत्र'], 'Window': ['वेळ', 'समय'], 'Buffer': ['अंतर', 'दूरी'],
    'Role': ['भूमिका', 'भूमिका'], 'Permission': ['परवानगी', 'अनुमति'],
    'Real drone': ['खरा ड्रोन', 'असली ड्रोन'], 'Bird': ['पक्षी', 'पक्षी'], 'Kite': ['पतंग', 'पतंग'], 'Other': ['इतर', 'अन्य'], 'What was it?': ['ते काय होते?', 'वह क्या था?'],
    'Ack': ['पोच', 'पुष्टि'], 'Close': ['बंद करा', 'बंद करें'], 'Confirm authorised': ['अधिकृत असल्याची खात्री करा', 'अधिकृत पुष्टि करें'],
    'Guard': ['गार्ड', 'गार्ड'], 'Supervisor': ['पर्यवेक्षक', 'पर्यवेक्षक'], 'Admin': ['प्रशासक', 'प्रशासक'], 'Police (auditor)': ['पोलीस (लेखापरीक्षक)', 'पुलिस (लेखा परीक्षक)'],
    'Users & roles': ['वापरकर्ते व भूमिका', 'उपयोगकर्ता और भूमिकाएँ'], 'Test sound': ['आवाज तपासा', 'आवाज़ जाँचें'], '▶ Guided demo': ['▶ मार्गदर्शित डेमो', '▶ निर्देशित डेमो'], '■ Stop demo': ['■ डेमो थांबवा', '■ डेमो रोकें'],
    'Detection confidence': ['ओळख विश्वास', 'पहचान विश्वास'], 'No object tracked. Run a scenario to start.': ['काहीही ट्रॅक होत नाही. सुरू करण्यासाठी प्रसंग चालवा.', 'कुछ ट्रैक नहीं हो रहा। शुरू करने के लिए परिदृश्य चलाएँ।'],
    'Sensors': ['सेन्सर', 'सेंसर'], 'Expected': ['अपेक्षित', 'अपेक्षित'], 'Night schedule: ELEVATED 22:00–05:00': ['रात्रीचे वेळापत्रक: वाढीव सतर्कता 22:00–05:00', 'रात्रि अनुसूची: बढ़ी सतर्कता 22:00–05:00']
  };
  Object.assign(D, {
    'Zones & Setup': ['क्षेत्र व सेटअप', 'ज़ोन व सेटअप'],
    'Sensors': ['सेन्सर', 'सेंसर'],
    'Insights': ['निरीक्षणे', 'विश्लेषण'],
    'Planning': ['नियोजन', 'योजना'],
    'Users': ['वापरकर्ते', 'उपयोगकर्ता'],
    'Demo controls': ['डेमो नियंत्रण', 'डेमो नियंत्रण'],
    'Alerts': ['इशारे', 'अलर्ट'],
    'Guard phones': ['गार्डचे फोन', 'गार्ड के फ़ोन'],
    'Site picture': ['साइटचे चित्र', 'साइट का चित्र'],
    'Threat assessment': ['धोका मूल्यांकन', 'ख़तरा आकलन'],
    'Camera 1 · north sky': ['कॅमेरा १ · उत्तर आकाश', 'कैमरा 1 · उत्तर आकाश'],
    'Why this score?': ['हा गुण का?', 'यह स्कोर क्यों?'],
    '1 · Fly your own drone': ['१ · स्वतःचा ड्रोन उडवा', '1 · अपना ड्रोन उड़ाएँ'],
    '2 · Or run a ready scenario': ['२ · किंवा तयार प्रसंग चालवा', '2 · या तैयार परिदृश्य चलाएँ'],
    '3 · Attack the sensors': ['३ · सेन्सरवर हल्ला करा', '3 · सेंसर पर हमला करें'],
    '✏ Draw path': ['✏ मार्ग काढा', '✏ रास्ता बनाएँ'],
    'Fly it': ['उडवा', 'उड़ाएँ'],
    'Clear': ['पुसा', 'मिटाएँ'],
    'Height': ['उंची', 'ऊँचाई'],
    'Speed': ['वेग', 'गति'],
    'At the last point': ['शेवटच्या बिंदूवर', 'आख़िरी बिंदु पर'],
    'Critical': ['अतिमहत्त्वाचे', 'अति महत्वपूर्ण'],
    'Important': ['महत्त्वाचे', 'महत्वपूर्ण'],
    'Low': ['कमी', 'कम'],
    'Sign in': ['साइन इन', 'साइन इन'],
    'Your name': ['तुमचे नाव', 'आपका नाम'],
    'Sign in as': ['या भूमिकेत साइन इन', 'इस भूमिका में साइन इन'],
    'Test voice': ['आवाज तपासा', 'आवाज़ जाँचें'],
    'Site': ['साइट', 'साइट'],
    'Site name': ['साइटचे नाव', 'साइट का नाम'],
    'Approved flights': ['मंजूर उड्डाणे', 'स्वीकृत उड़ानें'],
    'Who gets alerted': ['इशारा कोणाला जातो', 'अलर्ट किसे जाता है'],
    'Save': ['जतन करा', 'सहेजें'],
    'Privacy': ['गोपनीयता', 'गोपनीयता'],
    'Sensor health': ['सेन्सर आरोग्य', 'सेंसर स्वास्थ्य'],
    'Alarm self-test': ['अलार्म स्व-चाचणी', 'अलार्म स्व-परीक्षण'],
    'Run test now': ['आता चाचणी करा', 'अभी परीक्षण करें'],
    'Sensor events': ['सेन्सर घटना', 'सेंसर घटनाएँ'],
    "Sign today's watch log": ['आजच्या पहाऱ्यावर सही करा', 'आज के निगरानी लॉग पर हस्ताक्षर'],
    'Check a capsule file': ['कॅप्सूल फाइल तपासा', 'कैप्सूल फ़ाइल जाँचें'],
    'Daily seal': ['दैनिक मोहोर', 'दैनिक मुहर'],
    'Seal today': ['आज मोहोरबंद करा', 'आज सील करें'],
    'Repeat visits (recon memory)': ['वारंवार भेटी (टेहळणी स्मृती)', 'बार-बार आना (टोही स्मृति)'],
    'Site alert level': ['साइट सतर्कता पातळी', 'साइट सतर्कता स्तर'],
    'Kites and birds': ['पतंग आणि पक्षी', 'पतंग और पक्षी'],
    'Shift handover': ['शिफ्ट हस्तांतरण', 'शिफ्ट हैंडओवर'],
    'Make brief': ['माहिती तयार करा', 'सार बनाएँ'],
    'Where are the blind spots?': ['अंध क्षेत्रे कुठे आहेत?', 'अंधे क्षेत्र कहाँ हैं?'],
    'Run test': ['चाचणी करा', 'परीक्षण करें'],
    'Add suggested sensor': ['सुचवलेला सेन्सर जोडा', 'सुझाया सेंसर जोड़ें'],
    'Reset': ['रीसेट', 'रीसेट'],
    'Warning time per zone': ['प्रत्येक क्षेत्राला पूर्वसूचना वेळ', 'हर ज़ोन की चेतावनी समय'],
    'Power-line / canal mesh': ['वीजवाहिनी / कालवा जाळे', 'बिजली लाइन / नहर जाल'],
    'Who can do what': ['कोण काय करू शकतो', 'कौन क्या कर सकता है'],
    'Sign-ins': ['साइन-इन', 'साइन-इन'],
    'Audit log': ['लेखापरीक्षण नोंद', 'ऑडिट लॉग'],
    'Evidence': ['पुरावा', 'सबूत'],
    'Status': ['स्थिती', 'स्थिति'],
    'Alert': ['इशारा', 'अलर्ट'],
    'Name': ['नाव', 'नाम'],
    'From': ['दिशा', 'दिशा'],
    'Behaviour': ['वर्तन', 'व्यवहार'],
    'Season': ['हंगाम', 'मौसम'],
    'Now': ['आता', 'अभी'],
    'Guard said': ['गार्ड म्हणाला', 'गार्ड ने कहा'],
    'Drone': ['ड्रोन', 'ड्रोन'],
    'Missed': ['चुकलेले', 'छूटे'],
    'Warning': ['पूर्वसूचना', 'चेतावनी'],
    'Importance': ['महत्त्व', 'महत्व'],
    'Alert distance': ['इशारा अंतर', 'अलर्ट दूरी'],
    'Near': ['जवळ', 'पास'],
    'Watching today': ['आज पाहिले', 'आज निगरानी'],
    'Run the test.': ['चाचणी करा.', 'परीक्षण करें।'],
    'Add approved flight': ['मंजूर उड्डाण जोडा', 'स्वीकृत उड़ान जोड़ें'],
    'Quiet sky.': ['आकाश शांत आहे.', 'आसमान शांत है।'],
    'No drone tracked yet.': ['अद्याप कोणताही ड्रोन नाही.', 'अभी कोई ड्रोन नहीं।'],
    'Tap a drone to inspect it': ['तपासण्यासाठी ड्रोनवर टॅप करा', 'जाँचने के लिए ड्रोन पर टैप करें'],
    'Sound off': ['आवाज बंद', 'आवाज़ बंद'],
    'Sound on': ['आवाज सुरू', 'आवाज़ चालू'],
  });
  const REV = { mr: new Map(), hi: new Map() };
  Object.entries(D).forEach(([en, [mr, hi]]) => { REV.mr.set(mr, en); REV.hi.set(hi, en); });
  let lang = 'en';
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS']);
  function keyOf(txt) { if (D[txt]) return txt; return REV.mr.get(txt) || REV.hi.get(txt) || null; }
  const ORIG = new WeakMap(); // text node -> its English source, so shared translations restore correctly
  function tNode(n) {
    const raw = n.nodeValue; if (!raw) return;
    const trimmed = raw.trim(); if (!trimmed) return;
    const key = ORIG.get(n) || keyOf(trimmed); if (!key) return;
    ORIG.set(n, key);
    const target = lang === 'en' ? key : D[key][lang === 'mr' ? 0 : 1];
    if (trimmed === target) return;
    n.nodeValue = raw.replace(trimmed, target);
  }
  function walk(rootEl) {
    if (rootEl.nodeType === 3) { tNode(rootEl); return; }
    if (rootEl.nodeType !== 1 || SKIP.has(rootEl.tagName) || (rootEl.closest && rootEl.closest('[data-noi18n]'))) return;
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement && (SKIP.has(n.parentElement.tagName) || n.parentElement.closest('[data-noi18n]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n; while ((n = w.nextNode())) tNode(n);
  }
  const obs = new MutationObserver(ms => { if (lang === 'en') return; ms.forEach(m => { if (m.type === 'characterData') tNode(m.target); else m.addedNodes.forEach(walk); }); });
  root.SKI18N = {
    set(l) { lang = l; document.documentElement.lang = l === 'en' ? 'en' : l; walk(document.body); },
    get: () => lang,
    t(en) { return lang === 'en' || !D[en] ? en : D[en][lang === 'mr' ? 0 : 1]; },
    start() { obs.observe(document.body, { childList: true, subtree: true, characterData: true }); }
  };
})(window);
