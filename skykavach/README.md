# SkyKavach

Site-aware drone threat detection for critical infrastructure. **Detect. Judge. Prove.**
SkyKavach detects, assesses and alerts only. It never jams, spoofs or disables a drone.
Seva First Innovation Challenge 2026 · Maharashtra Zone · Problem Statement 4.

## Run it

Open `dist/index.html` in **Microsoft Edge** (best: natural Marathi and Hindi voices) or Chrome. No install, no server.

1. Sign in with your name and a role (Guard, Supervisor, Admin, Police). Each role sees different tabs.
2. **Live → Demo controls**: draw your own drone path on the map and fly it, or run a ready scenario, or attack the sensors.
3. Turn **Sound on**, pick मराठी / हिंदी / EN, press **Test voice**.
4. **▶ Guided demo** runs every feature in about 2 minutes.

## Proper Marathi and Hindi voice

- **Microsoft Edge** has natural native voices built in: Marathi *Aarohi* / *Manohar*, Hindi *Swara* / *Madhur*. SkyKavach picks them automatically. You can also choose a voice from the Voice menu.
- **Offline / Chrome:** record every alert once with the same native voices (needs internet once):
  ```
  pip install edge-tts
  python make_voices.py
  ```
  This saves about 230 MP3 clips in `dist/voices/`. The app plays them when the browser has no native voice.
- The app never reads Marathi with an English or Hindi voice.

## Roles

| Role | Sees |
| --- | --- |
| Guard | Live picture, camera, own phone, alerts. Acknowledge and label alerts. |
| Supervisor | + Demo controls, Zones & Setup, Sensors, Evidence, Insights, shift brief |
| Admin | Everything + privacy settings, Planning (blind spots, power-line mesh), Users & audit log, tamper test |
| Police (auditor) | Live picture (read-only) and Evidence: verify, report, export |

Every sign-in, denied action and evidence access is in the audit log (Admin → Users).

## What "Run a scenario" does

Each scenario flies one or more simulated drones on a preset path so you can show one behaviour on demand. A strip above the map explains what is happening and what to watch.

| Scenario | What it shows |
| --- | --- |
| Harmless transit | Straight pass far from critical zones: stays LOW |
| Orbit over intake | Circling a critical zone: LOW → MEDIUM → HIGH, siren, voice, evidence |
| Survey grid | Back-and-forth mapping lines: SURVEY |
| Approach + drop | Stops and descends over the transformer yard: DESCENT, HIGH fast |
| Authorised inspection | Approved flight: AUTHORISED-PENDING until confirmed; scored once it leaves its area |
| Kites and birds | Birds ignored; kite alert can be labelled so it is held in kite season |
| Decoy + approach | One drone distracts while another approaches: POSSIBLE DECOY |
| Recon week | Same drone on Day 1, 3, 5: RECON PATTERN, site alert level raised |

## Datasets to train the real detector

| Dataset | What it has | Use |
| --- | --- | --- |
| Anti-UAV (github.com/ZhaoJ9014/Anti-UAV) | RGB + infrared videos of drones, tracking boxes | Detection + tracking, night (IR) |
| Drone-vs-Bird (WOSDETC challenge) | Videos with small drones and birds | Teach drone vs bird; data on request from organisers |
| Drone detection dataset (github.com/DroneDetectionThesis/Drone-detection-dataset) | IR + visible video and audio: drones, birds, aircraft, helicopters | Detector classes + acoustic node training |
| Roboflow Universe drone sets | Ready YOLO-format labelled images | Quick start for YOLOv8 fine-tuning |
| Your own campus clips | 30–60 clips: drone, birds, kites at different heights | Most important: matches your cameras |

Check each dataset's licence before use. Ultralytics YOLO is AGPL-3.0.

## Honest scope

Drone flights are simulated paths; scoring, behaviour labels, tamper checks, signing and recon matching are the real algorithms (43 unit tests: `node test/engine.test.js`). One camera gives direction, not range: positions assume two cameras or camera + acoustic nodes.

## Files

```
src/engine.js   scoring engine, tamper checks, crypto, simulator maths
src/data.js     site, zones, scenarios, Marathi / Hindi / English text
src/i18n.js     interface language switch
src/app.js      the app
build.py        builds dist/index.html (and the voice phrase list)
make_voices.py  records native Marathi / Hindi alert clips
```
