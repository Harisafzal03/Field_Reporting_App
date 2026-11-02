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
# Run all unit tests (7 test suites, 36 tests)
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

### 2. Airplane Mode & Outbox Restart Survival (Check 2 & Check 3)
1. On the Android device/emulator, enable **Airplane Mode**.
2. Open the app and navigate to **Compose**.
3. Create 3 separate reports (e.g. one with 1 photo, one with 2 photos, and one with 5 camera photos).
4. Tap **Save Report to Outbox** for each. Navigate to the **Outbox** tab.
5. Verify all 3 reports are listed with status `Waiting for signal · Safe on phone`.
6. Force kill the app process:
   ```bash
   adb shell am force-stop com.fieldreports
   ```
7. Re-launch the app:
   ```bash
   adb shell am start -n com.fieldreports/.MainActivity
   ```
8. **Check 2 Verification**: Open Outbox. Verify all 3 reports, notes, and photos are still listed. None were lost because the queue is backed by disk persistence (`queueStore.ts`).
9. Disable Airplane Mode.
10. **Check 3 Verification**: Without touching any button, watch the unattended upload engine automatically transmit each report sequentially. When finished, all 3 reports appear in **Server Review** with their exact photo counts matching server disk files in `server/uploads/`.

### 2. Severed Connection Mid-Flight
1. Tap the **Tools** button in the app header to open the Diagnostics modal.
2. Under **Preset Test Conditions**, tap **Test 2: Drop Connection (Sever TCP stream)**.
3. Queue a new report with photos.
4. The server forcefully closes the socket mid-stream.
5. In the Outbox, the report remains safe in queue (`Waiting for signal · Retry #1`), displays `Connection dropped mid-flight · Safe on this phone — auto-retrying...`, and schedules an automatic backoff retry.
6. In the Diagnostics modal, tap **Restore Healthy Network**.
7. The queue engine automatically resumes and completes delivery without user intervention.

### 3. Server Flapping (HTTP 500)
1. In Diagnostics, tap **Test 3: HTTP 500 Error**.
2. Queue a report. The server responds with HTTP 500.
3. The upload engine classifies HTTP 500 as a transient failure: the report remains in the queue, increments the retry count, and auto-retries unattended.

### 4. Non-Retryable Fatal Errors (HTTP 413 & HTTP 400)
1. If a file exceeds the 5.0 MB hard ceiling at the destination, the server responds with HTTP 413.
2. The upload engine classifies HTTP 4xx as non-transient fatal errors: it **stops retrying immediately**, marks the report as `Stopped · Action required`, and displays an actionable reason: `"Photo exceeds the 5.0 MB destination ceiling. Remove or replace the photo."`

### 5. Idempotent Deduplication ("Nothing lands twice")
1. When a report is uploaded, the client sends an immutable UUID `Idempotency-Key`.
2. If network cuts off after the server saves the report but before the client receives the 201 response, the client retries with the identical key.
3. The server detects the key in its processed ledger, returns the existing record with HTTP 200, and prevents duplicate rows or duplicate photo writes to disk.

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
