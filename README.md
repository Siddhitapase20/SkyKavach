# 🛡️ SkyKavach
### Intelligent Drone Threat Assessment for Critical Infrastructure

**Detect. Judge. Prove.**

SkyKavach is a site-aware drone threat assessment prototype designed for critical infrastructure such as water treatment plants, power facilities, and other sensitive installations.

It simulates drone movements, evaluates their behaviour around protected zones, identifies suspicious sensor conditions, and generates alerts with supporting evidence. Its goal is to help security personnel distinguish routine aerial activity from potentially suspicious behaviour.

**Challenge:** Seva First Innovation Challenge 2026 — Maharashtra Zone  
**Problem Statement:** PS4 — Secure Drones, Counter-Drone Systems and Critical-Infrastructure Surveillance  
**Project Stage:** Software prototype with simulated drone scenarios

---

## 🎯 The Problem

Critical infrastructure can be vulnerable to unauthorised or suspicious drone activity.

Security personnel may face challenges such as:

- Distinguishing harmless drone movements from suspicious activity.
- Identifying repeated surveillance patterns around sensitive locations.
- Recognising unusual hovering, circling, or descent near restricted zones.
- Detecting camera, microphone, and sensor disruptions.
- Coordinating responses while maintaining reliable evidence and accountability.

A useful monitoring system should consider the context of an event rather than treating every detected aerial object as an immediate threat.

## 💡 Our Solution

SkyKavach provides an interactive security command centre that evaluates simulated drone behaviour in relation to critical zones, sensor conditions, and site security settings.

The prototype combines behaviour-based threat scoring, scenario simulation, sensor anomaly checks, multilingual voice alerts, evidence management, and role-based access controls in a standalone web application.

### Core Features

**1. 🗺️ Site-Aware Threat Assessment**
- Visualise a simulated critical infrastructure site and its security zones.
- Monitor drone paths relative to critical and restricted areas.
- Evaluate behaviour such as circling, hovering, and descending near sensitive locations.
- Display changing threat levels as scenarios progress.

**2. 🚁 Interactive Drone Simulation**
- Draw custom drone paths directly on the site map.
- Configure simulated altitude and speed.
- Choose the behaviour at the end of a path.
- Run predefined scenarios to demonstrate different threat conditions.
- Adjust simulation speed to inspect events in detail.

**3. 🛡️ Sensor Anomaly and Tamper Simulation**
- Simulate camera obstruction and laser glare.
- Simulate camera direction changes.
- Simulate microphone interference and sensor-node power loss.
- Observe anomaly alerts and combined sensor-attack warnings.
- Restore simulated sensors to their normal state.

**4. 🔔 Multilingual Voice Alerts**
- English, Hindi, and Marathi interface support.
- Spoken alerts using available browser voices.
- Optional prerecorded voice clips for supported alerts.
- Sound controls and voice testing.
- Guided demonstrations for presenting the prototype.

**5. 📋 Evidence and Event Management**
- Inspect recorded events and their associated information.
- Review supporting evidence through the interface.
- Verify, report, and export evidence using the auditor interface.
- Maintain an audit log of relevant actions and evidence access.

**6. 👥 Role-Based Interface**
The prototype provides four demo roles:

| Role | Access |
|---|---|
| Guard | Live site view, alerts, acknowledgement, and alert labelling |
| Supervisor | Guard features plus simulation controls, zones, sensors, evidence, and insights |
| Admin | Full prototype interface, including planning tools, privacy settings, users, and audit logs |
| Police (Auditor) | Read-only live view and evidence verification, reporting, and export |

These roles demonstrate a proposed access-control workflow. Production deployment would require proper authentication, identity verification, and server-side authorization.

**7. 🧠 Behaviour and Pattern Analysis**
- Demonstrate repeated activity around sensitive areas.
- Identify simulated decoy and approach scenarios.
- Demonstrate repeated surveillance patterns across simulated days.
- Observe how site security settings affect threat assessment.

---

## 🧪 Demonstration Scenarios

SkyKavach includes predefined scenarios designed to demonstrate how the assessment engine responds to different behaviours.

| Scenario | Demonstration |
|---|---|
| Harmless Transit | A drone passes away from critical zones |
| Orbit Over Intake | A drone circles a sensitive area |
| Survey Grid | A drone follows repeated mapping-like paths |
| Approach + Drop | A drone stops and descends near a critical zone |
| Authorised Inspection | An inspection flight awaits authorisation confirmation |
| Kites and Birds | Demonstrates handling of non-drone objects and alert labelling |
| Decoy + Approach | Demonstrates a distracting object alongside a suspicious approach |
| Recon Week | Demonstrates repeated activity across simulated days |

These scenarios use simulated drone paths. They demonstrate the software's assessment logic rather than detection of actual airborne drones.

---

## 🏗️ System Architecture

```text
              SkyKavach Web Interface
                        |
             Interactive Site Map
                        |
              Drone Path Simulator
                        |
             Behaviour Assessment
                        |
              Threat Scoring Engine
                        |
          +-------------+-------------+
          |             |             |
      Zone Checks   Sensor Checks   Pattern Analysis
          |             |             |
          +-------------+-------------+
                        |
                Alert Generation
                        |
           +------------+------------+
           |            |            |
        Dashboard    Voice Alerts   Evidence
           |            |            |
           +------------+------------+
                        |
               Audit and Review
```

The current implementation uses simulated movements and sensor conditions. This architecture describes the prototype workflow, not a deployed multi-sensor detection network.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Application structure |
| CSS3 | Responsive interface and visual styling |
| JavaScript | Application logic and interactive behaviour |
| HTML Canvas | Site map and visualisation |
| Python | Build scripts and optional voice-generation workflow |
| Node.js | Running JavaScript-based unit tests |
| Edge TTS | Optional generation of prerecorded voice clips |
| Web Speech API | Browser-based spoken alerts |

The application is bundled into a standalone HTML file for convenient demonstration.

---

## 📂 Project Structure

```text
SkyKavach/
│
├── src/
│   ├── app.js                 # Application logic and interface behaviour
│   ├── body.html              # Interface structure
│   ├── styles.css             # Styling and layout
│   ├── engine.js              # Threat assessment and simulation logic
│   ├── data.js                # Site data, zones, scenarios and text
│   └── i18n.js                # Language switching and translations
│
├── dist/
│   ├── index.html             # Standalone runnable application
│   └── voices/
│       └── phrases.json       # Generated voice phrase data
│
├── test/
│   ├── engine.test.js         # Engine unit tests
│   ├── scenarios.check.js     # Scenario checks
│   └── e2e3.py                # Additional test script
│
├── build.py                   # Builds the standalone application
├── make_voices.py             # Optional voice-generation script
├── tools_phrases.js           # Voice phrase generation utility
└── README.md
```

---

## 🚀 Getting Started

### Option 1: Run the Existing Prototype

The quickest way to try SkyKavach is to open the prebuilt application.

1. Download or clone the repository.
2. Open the project folder.
3. Navigate to `dist/`.
4. Open `index.html` in Microsoft Edge or Google Chrome.
5. Sign in using a demo name and select a role.
6. Open the **Live** view and explore the site map.

No Python package installation or web server is required for the basic demonstration.

Some features, such as browser voices and external fonts, may depend on browser support or internet connectivity.

### Option 2: Clone the Repository

```bash
git clone https://github.com/Siddhitapase20/SkyKavach.git
cd SkyKavach
```

Open `dist/index.html` in your browser.

### Option 3: Rebuild the Application

If you modify files under `src/`, rebuild the standalone HTML application.

Requirements:
- Python 3
- Node.js for the voice phrase generation utility

From the project root, run:

```bash
python build.py
```

The build script generates the standalone HTML files in `dist/` and runs the voice phrase utility.

**Note:** Rebuild the application after changing source files so the generated HTML reflects your latest changes.

---

## 🧪 Running Tests

The project includes JavaScript unit tests for its assessment engine.

Install Node.js if it is not already installed, then run:

```bash
node test/engine.test.js
```

To check the predefined scenarios, run:

```bash
node test/scenarios.check.js
```

The repository also includes `test/e2e3.py` for additional testing. Check the script's dependencies and execution instructions before running it.

Tests against simulated scenarios do not establish real-world drone detection accuracy.

---

## 🔊 Marathi and Hindi Voice Alerts

SkyKavach supports multilingual interface text and spoken alerts.

For the best native voice experience, open the application in Microsoft Edge and check the voices available on your computer.

An optional prerecorded-voice workflow uses Edge TTS.

Install the dependency:

```bash
pip install edge-tts
```

Then run:

```bash
python make_voices.py
```

This workflow may require an internet connection to generate the clips. The generated files are stored under `dist/voices/`.

Actual voice availability depends on the operating system, browser, installed language voices, and generated audio files.

---

## 🔬 Future Scope

The following improvements are potential future development tasks, not completed capabilities.

- **Real-time object detection:** Integrate and evaluate a trained computer-vision model on actual camera footage.
- **Drone-versus-bird classification:** Evaluate performance on varied backgrounds, lighting conditions, and small aerial objects.
- **Multi-sensor fusion:** Combine camera observations with independent acoustic or other sensor measurements.
- **Uncertainty-aware assessment:** Account for low-confidence observations, missing sensors, conflicting evidence, and partial occlusion.
- **Real-world tracking:** Investigate tracking across camera views and estimate position using suitable calibrated sensors.
- **Sensor health monitoring:** Evaluate anomaly detection using real sensor telemetry and hardware tests.
- **Secure evidence storage:** Add authenticated event records, protected storage, and a validated audit workflow.
- **Production authentication:** Introduce verified user identities, secure sessions, and server-side permissions.
- **Field evaluation:** Measure detection performance, false alarms, missed detections, processing latency, and robustness under controlled conditions.

---

## ⚠️ Current Limitations

Transparency about the current development stage is important.

- Drone movement and flight paths are simulated.
- The current prototype is not connected to a real-time drone detection sensor network.
- Threat scores and behaviour labels demonstrate the implemented assessment logic; they are not validated operational threat probabilities.
- Sensor attacks and failures are simulated rather than performed against physical hardware.
- A single camera generally cannot determine an object's full three-dimensional position without additional assumptions or measurements.
- Demo role selection is not a substitute for production authentication.
- The prototype is intended for demonstration and experimentation, not as a standalone operational security system.

SkyKavach is detection- and assessment-focused. It does not jam, spoof, or disable drones.

---

## 🔐 Responsible Use

SkyKavach is intended to support responsible monitoring and human review.

- Alerts should be reviewed by authorised personnel.
- Suspicious behaviour should not automatically be treated as proof of malicious intent.
- Real deployments should follow applicable aviation, privacy, and security requirements.
- Testing should use authorised sites, controlled conditions, and appropriately licensed datasets.
- Security-sensitive evidence should be protected from unauthorised access.

---

## 👥 Team

**Team Name:** SkyKavach Team

**Challenge:** Seva First Innovation Challenge 2026 — Maharashtra Zone

**Problem Statement:** PS4 — Secure Drones, Counter-Drone Systems and Critical-Infrastructure Surveillance

---

## 📄 License

No license has been specified for this repository yet.

Before publishing or accepting external contributions, choose a license that reflects the team's intentions and ensure that third-party dependencies, datasets, and assets are used under their applicable licenses.

---

<p align="center">
  <b>SkyKavach — Detect. Judge. Prove.</b><br>
  Intelligent awareness for safer skies.
</p>
