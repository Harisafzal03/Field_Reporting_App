# Field Reports

A React Native field-reporting mobile application paired with a dedicated Express upload backend, engineered to deliver reports and photo attachments reliably under intermittent connectivity and 2G signal conditions. Built with bare React Native CLI and Express.

## Prerequisites

- **Node.js**: LTS (v20+ or v22+)
- **Yarn**: Classic (`v1.22+`) or Berry (`v3.6+`)
- **JDK 17**: Eclipse Temurin or OpenJDK 17 (`/usr/libexec/java_home -v 17`)
- **Android Studio**: Android SDK, platform-tools, build-tools, and an Android Virtual Device (AVD) or physical device
- **adb**: Configured in your system `PATH` (typically under `$HOME/Library/Android/sdk/platform-tools`)

## Repo Layout

```text
.
├── app/        React Native CLI (bare, TypeScript) mobile application
└── server/     Express TypeScript backend service for report ingestion
```

Inside `app/src/`:
- `domain/`: Core business types, validation contracts, and domain models
- `queue/`: `queueStore.ts` persistent disk-backed storage using `@react-native-async-storage/async-storage`
- `services/`: `uploadEngine.ts` (isolated headless worker), `api.ts` (API client & `ApiError`), `imagePicker.ts`, `network.ts`
- `screens/`: Primary application screens (`ComposeScreen`, `OutboxScreen`, `ReviewScreen`, `ChaosResetModal`, `ReportDetailModal`)
- `components/`: Modular UI components, status badges, progress bars, and header controls
- `theme/`: High-contrast outdoor design tokens and typography

## Run the Server

From the repository root:

1. Install dependencies:
   ```bash
   cd server
   yarn install
   ```

2. Start the development server:
   ```bash
   yarn dev
   ```

3. Verify the service is up using the `/health` endpoint:
   ```bash
   curl http://localhost:3000/health
   # Expected output: {"ok":true}
   ```

## Run the App on Android

1. Ensure an Android emulator is running or a physical device is connected with USB debugging enabled:
   ```bash
   adb devices
   ```

2. Forward port 3000 so the mobile client connects directly to the local backend:
   ```bash
   adb reverse tcp:3000 tcp:3000
   ```

3. (Optional) Launch an Android emulator with throttled 2G network emulation:
   ```bash
   emulator -avd <name> -netspeed gsm -netdelay gprs
   ```

4. Start the Metro bundler:
   ```bash
   cd app
   yarn start
   ```

5. In a separate terminal, compile and install the Android app:
   ```bash
   cd app
   yarn android
   ```

## Verification Scripts

### `app/` (Mobile Application)

```bash
# Run all unit tests (8 test suites, 43 tests)
yarn --cwd app test

# Run TypeScript typecheck
yarn --cwd app typecheck

# Run ESLint
yarn --cwd app lint

# Run full sequential verification (typecheck + lint + test)
yarn --cwd app verify
```

### `server/` (Backend Service)

```bash
# Validate TypeScript types across backend
yarn --cwd server typecheck
```

---

## Device Verification Matrix (Checks A through H)

| Check | Scenario | Steps to Execute | Expected Pass Result |
| :---: | :--- | :--- | :--- |
| **A** | **Airplane Mode & Restart Survival** | 1. Enable Airplane Mode.<br>2. Compose 3 reports with photos.<br>3. Force-kill: `adb shell am force-stop com.fieldreports`<br>4. Reopen app. | All 3 reports listed in Outbox, notes intact, photos open from disk. |
| **B** | **Lost Response (Save Report, Kill Reply)** | 1. Tap **Tools** $\to$ **Test B: Lost Response**.<br>2. Queue a report with photos.<br>3. Server saves report & files, then cuts connection.<br>4. Watch app auto-retry unattended. | `ls server/uploads \| wc -l` strictly equals photo count; `/reports` shows 1 report; server unlinked duplicate retry files. |
| **C** | **Slow 2G Emulator (Stall vs Total Timeout)** | 1. Launch emulator: `emulator -avd <name> -netspeed gsm -netdelay gprs`<br>2. Queue report with 5 photos. | Finishes slowly over 1–2 minutes without being killed by timeout because stall timer resets on active progress chunks. |
| **D** | **Server Hang / Frozen Gateway** | 1. Tap **Tools** $\to$ **Test 4: Hang Request**.<br>2. Queue report. | App aborts after 15s of zero progress, schedules backoff retry, and stops spinner. |
| **E** | **Largest Camera & Gallery Photos** | 1. Select largest high-res camera photos (12–48 MP). | Every file arriving in `server/uploads` is strictly under 5 MB and visually sharp (client downscales to 2048px @ 80% quality). |
| **F** | **Permission Denied $\to$ Granted in Settings** | 1. Deny Camera permission.<br>2. Open Android Settings $\to$ Apps $\to$ Field Reports $\to$ Grant Camera.<br>3. Return to app and tap Camera. | Camera opens immediately without requiring an app restart. |
| **G** | **Press Home Mid-Upload for 1 Minute** | 1. Queue large report.<br>2. Press Home button mid-upload for 1 minute.<br>3. Return to app. | Upload resumes unattended without tapping. |
| **H** | **Airplane Mode Restored** | 1. Enable Airplane Mode with items in Outbox.<br>2. Turn off Airplane Mode. | Upload resumes automatically within seconds without user intervention. |

---

## Make it fail

To verify resilience against real-world failure modes, use the following procedures:

### 1. In-Progress Compose Draft Survival Across App Kills
1. Open the app on the **Compose** screen.
2. Type inspection notes into the text field (e.g., *"Found cracked valve bracket"*).
3. Select 1 or more photos from the gallery or camera (notice the *"Draft saved on phone"* indicator appears).
4. **Do not tap Submit / Queue**. Force kill the app while composing:
   ```bash
   adb shell am force-stop com.fieldreports
   ```
5. Re-launch the app:
   ```bash
   adb shell am start -n com.fieldreports/.MainActivity
   ```
6. Verify that the typed notes and attached photos are **automatically restored from disk** (`draftStore.ts`), with the submit button immediately ready.

### 2. Check B: Lost Response & Duplicate File Cleanup
1. Tap the **Tools** button in the app header to open the Chaos modal.
2. Under **Preset Fault Conditions**, tap **Test B: Lost Response (Save report, kill reply)**.
3. Queue a new report with photos.
4. The server receives the report, saves photos to disk, records it in the database, and severs the TCP socket before sending HTTP 201.
5. In the Outbox, the report status updates to retrying (`Safe on this phone. Automatic retry #1 in progress.`).
6. The app automatically retries sending the report using the identical `Idempotency-Key`.
7. The server recognizes the idempotency key, unlinks the temporary duplicate files written by Multer, and returns the existing record with HTTP 200.
8. Verify on the server:
   ```bash
   ls server/uploads | wc -l
   # Equals the exact number of photos in the single report!
   curl http://localhost:3000/reports
   # Contains exactly 1 report!
   ```

### 3. Check C & D: Progress Stall Timeout (Slow is Fine, Stopped is Not)
1. In `api.ts`, a 15-second stall timer resets on every `xhr.upload.onprogress` chunk.
2. When testing over throttled 2G (`-netspeed gsm -netdelay gprs`), an upload taking 90 seconds succeeds because data is continuously transferring.
3. When testing with **Test 4: Hang Request** (zero bytes transferred), the stall timer aborts the request after 15 seconds, marks the report for retry, and prevents endless spinners.

### 4. Check E: 5 MB Ceiling Pre-Upload Enforcement
1. `imagePicker.ts` natively resizes and compresses picked and captured images to max 2048px at 80% quality.
2. Even raw 18–48 MP photos from device cameras are compressed down to ~1.2–2.5 MB JPEGs.
3. The app never sends an image over 5 MB.
4. The server's 413 check serves as defense-in-depth and is never triggered during standard operations.

### 5. Server Flapping (HTTP 500)
1. In Diagnostics, tap **Test 3: HTTP 500 Error**.
2. Queue a report. The server responds with HTTP 500.
3. The upload engine classifies HTTP 500 as a transient failure: the report remains in the queue, increments the retry count, and auto-retries unattended.

---

## Decisions and trade-offs

- **Storage Layer (`AsyncStorage` + Local File Cache)**:
  - *Decision*: Stored queue state and report metadata in `@react-native-async-storage/async-storage` with cold-start hydration, referencing photo files on local device storage.
  - *Trade-off*: SQLite / Realm offers relational querying and paging for thousands of items. However, for a dedicated outbox queue (typically 1–50 pending inspection reports), `AsyncStorage` delivers fast, zero-native-compilation overhead, lightweight persistence that reliably survives Linux process termination (`am force-stop`).
- **Headless Upload Engine Architecture**:
  - *Decision*: Extracted upload logic into a pure TypeScript class (`uploadEngine.ts`) with zero JSX or React component bindings.
  - *Trade-off*: Decoupling requires explicit subscription listeners between the engine and UI state, but ensures queue processing can run headlessly and be tested deterministically in pure Node/Jest unit tests without mocking a React renderer.
- **Zero-Bandwidth Network Telemetry**:
  - *Decision*: Removed periodic background downloads (e.g. Cloudflare speed test chunks). Telemetry relies strictly on hardware NetInfo connection status (`cellularGeneration: '2g' | '3g' | '4g' | '5g'` and connection type).
  - *Trade-off*: Does not show a live micro-speedometer in KBPS, but avoids consuming the inspector's metered data and saturating weak 2G channels with test payloads.
- **Strict State Honesty**:
  - *Decision*: Explicitly distinguished between "Saved on this phone" (local disk storage) and "Delivered · Confirmed by server" (HTTP 201 receipt from server). The Review screen strictly displays data fetched via `GET /reports` directly from the server.
  - *Trade-off*: The Review tab cannot show reports while completely offline, but it guarantees that inspectors never mistake local drafts for confirmed server deliveries.
- **Pre-Upload Image Downscaling**:
  - *Decision*: Camera photos are resized to max 2048px at 80% quality prior to queuing.
  - *Trade-off*: Sacrifices extreme 100-megapixel raw resolution, but compresses raw 18 MB files down to ~1.2–2.2 MB. This guarantees uploads never exceed the server's 5.0 MB ceiling while preserving legible crack, weld, and serial-number details for industrial inspections.

---

## Not done

- **Resumable Byte-Offset Uploads (Tus Protocol)**: Reports are currently uploaded as sequential multipart requests per report. If a socket drops at 80% of photo 3, the report re-attempts the upload on the next retry rather than resuming from byte offset 80%.
- **Background Headless Service on Process Termination**: While the app queue survives process termination (`am force-stop`), automatic unattended upload starts when the app is foregrounded or launched. Running uploads while the app is completely terminated would require a native Android Foreground Service with WorkManager.

---

## With another day

1. **Android WorkManager Integration**: Register an Android `CoroutineWorker` / `WorkManager` task to process the `queueStore` in the background even if the user swipes away the application from Android Recents.
2. **Chunked Resumable Uploads**: Implement chunked streaming with content-range headers or Tus protocol so large photos interrupted at 95% resume from that byte offset rather than restarting from 0%.
3. **Draft Editing**: Allow inspectors to edit inspection notes or swap photos while a report is waiting in Outbox before transmission.
4. **Offline Cached Review**: Provide an offline view of previously downloaded server reports with explicit "Cached from previous sync" indicators.
