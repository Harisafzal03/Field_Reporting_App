# Field Reports — Mobile Client (`app/`)

React Native CLI (bare, TypeScript) field reporting application engineered for inspectors on remote infrastructure sites under intermittent 2G or zero connectivity.

---

## 1. Design Aesthetic & Architecture

The application implements a high-contrast **Monochrome Minimalist Utility** aesthetic inspired by the Google Stitch specifications (`3422698632221427343`):
- **Color Palette**: Pitch black background (`#09090B`), elevated surface tiles (`#121214`), hairline slate borders (`#27272A`), crisp white primary typography (`#FAFAFA`), and amber/red indicators for connection/error states.
- **Micro-Typography**: Strict uppercase tracked labels (`letterSpacing: 0.8–1.5`), monospaced technical tags, and clear state machine badges.
- **Tactile Touch Targets**: Every interactive button and selector satisfies the minimum 48px touch boundary for outdoor fieldwork.

---

## 2. Real Native Hardware Integration (Zero Dummy Data)

The app operates exclusively with real device hardware with **zero preset mock reports**:

### A. Hardware Camera & Gallery (`react-native-image-picker`)
- **Native Gallery Picker**: Inspectors attach 1 to 5 real photos directly from their device photo library via `pickPhotosFromGallery`.
- **Hardware Camera**: Direct camera capture with back-lens default and automatic photo storage.
- **5.0 MB Destination Ceiling Enforcement**:
  - Automatically downscales raw 18 MB camera photographs (`maxWidth: 2048, maxHeight: 2048, quality: 0.8`) to ~1.2–2.5 MB.
  - Queries exact file byte counts directly from the hardware URI.
  - Immediately rejects any attachment exceeding `5 * 1024 * 1024` bytes with a clear warning before queuing.
  - Bounds check: Validates between 1 and 5 photos per report.

### B. Hardware Network & Speed Monitor (`@react-native-community/netinfo`)
- **Direct Hardware Telemetry (Android & iOS)**:
  - Subscribes to live OS network state events via `subscribeToHardwareNetwork`.
  - Reads hardware link speed directly on Android (`details.linkSpeed` in Mbps/Kbps) and cellular technology standards.
- **Real Bandwidth Formatting in KBPS & MBPS**:
  - `2G · 96 KBPS` (Cellular EDGE/GPRS telemetry)
  - `3G · 384 KBPS` (Cellular UMTS/HSPA telemetry)
  - `4G · 25 MBPS` (Cellular LTE broadband telemetry)
  - `5G · 150 MBPS` (Cellular 5G NR ultra-broadband telemetry)
  - `WIFI · 72 MBPS` (Real hardware WiFi chip link speed)
  - `OFFLINE · 0 KBPS` (Airplane mode or zero signal)

---

## 3. Unattended Delivery Queue & Ground Truth

### A. Unattended Delivery Engine
- When an inspector queues a report, it is saved locally to state and disk.
- When network signal is available, the background queue worker automatically starts the upload without requiring user interaction.
- Uses `XMLHttpRequest` multipart upload with `upload.onprogress` to stream real progress (byte counter, photo index, percent).
- Includes the `Idempotency-Key: <reportId>` header so duplicate transmissions never result in duplicate landings on the server.
- If signal drops mid-transmission, the job automatically pauses and resumes safely once signal returns.

### B. Ground Truth Server Review
- The **Server Review** tab executes a direct query (`GET /reports`) against the backend Express database.
- It never reads back from local optimistic cache. If the server has 0 reports, it honestly displays `SERVER DATABASE EMPTY`. Once a report lands, it displays the verified server report ID and committed timestamp.

### C. Blast Radius & Chaos Controls (⚡ Header Modal)
- **Blast Radius Control**:
  - `Clear Local Queue Only`: Removes local outbox jobs and temporary drafts without touching the server.
  - `Complete System Wipe`: Clears local device outbox AND executes backend `DELETE /reports` database purge to factory zero.
- **Evaluator Chaos Simulator**:
  - Injects live artificial 2G latency (e.g. 3000ms delay).
  - Drops TCP socket connections mid-stream.
  - Simulates HTTP 500 server rejection errors.

---

## 4. Directory Structure

```text
app/
├── android/            # Bare Android native project (permissions configured)
├── ios/                # Bare iOS native project
├── src/
│   ├── theme/          # Monochrome utility design tokens
│   │   ├── tokens.ts   # Hairline borders, pitch black colors, micro-typography
│   │   └── index.ts
│   ├── domain/         # Core TypeScript domain models
│   │   └── types.ts    # Report, Attachment, UploadProgress, ChaosConfig, BlastRadius
│   ├── components/     # High-contrast modular UI components
│   │   ├── Button.tsx       # Tactile 48px touch target button
│   │   ├── Card.tsx         # Hairline-bordered slate container
│   │   ├── Header.tsx       # Title, live bandwidth pill, and chaos button
│   │   ├── NetworkPill.tsx  # Dynamic hardware speed chip (Kbps / Mbps)
│   │   ├── ProgressBar.tsx  # Live byte and attachment counter
│   │   ├── StatusBadge.tsx  # State machine chip (In Queue, Uploading, Delivered, Failed)
│   │   └── index.ts
│   ├── screens/        # Screen implementations
│   │   ├── ComposeScreen.tsx    # Compose findings, pick 1–5 gallery/camera photos
│   │   ├── OutboxScreen.tsx     # In-flight queue, live byte progress, retry actions
│   │   ├── ReviewScreen.tsx     # Ground-truth server review (GET /reports)
│   │   ├── ChaosResetModal.tsx  # Blast radius selector and chaos toggles
│   │   └── index.ts
│   └── services/       # Native device & API client services
│       ├── api.ts          # Multipart upload client with Idempotency-Key
│       ├── imagePicker.ts  # Hardware gallery and camera selection with 5MB ceiling
│       └── network.ts      # NetInfo hardware speed listener in Kbps / Mbps
├── App.tsx             # Root application shell & unattended queue worker
└── package.json
```

---

## 5. Verification Commands

Run the test and verification suite from the `app/` folder:

```bash
# Typecheck TypeScript definitions
yarn typecheck

# Run ESLint linter
yarn lint

# Run Jest unit tests
yarn test

# Run complete verification suite
yarn verify
```

---

## 6. Running Locally

### Starting the Backend Server
```bash
yarn --cwd server start
```

### Running on Physical Android Device
If connected via USB:
```bash
# Reverse port 3000 to physical device
$HOME/Library/Android/sdk/platform-tools/adb reverse tcp:3000 tcp:3000

# Launch on connected device
yarn --cwd app android
```

### Starting Metro Bundler
```bash
yarn --cwd app start
```
