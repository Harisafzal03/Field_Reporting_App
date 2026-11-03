# Field Reports

A field reporting application consisting of a React Native mobile client and an Express backend, designed to collect and upload inspection photo reports over unstable and low-bandwidth network connections.

## Overview

The system allows a field worker to document site findings with a brief description and 1 to 5 photographs. The workflow is organized into four main capabilities:

- **Compose**: Capture photos using the device camera or select images from the gallery, attach a short description, and queue the report.
- **Deliver**: An unattended background queue uploads pending reports automatically as network conditions allow. When the app is swiped away from Recents without network, Android WorkManager wakes up once connectivity returns, transmits the report in the background, and records delivery status. Unique idempotency keys prevent duplicate records.
- **Review**: A dedicated review screen displays records fetched directly from the backend server (`GET /reports`) rather than reading from local cache.
- **Start over**: A reset control in the header allows selecting a blast radius: clearing only the local device queue, or executing a full wipe that purges server records and stored images.

## Prerequisites

- Node.js (v20 or v22 LTS)
- Yarn (v1.22+)
- Java Development Kit (JDK 17)
- Android Studio with Android SDK Platform-Tools (adb configured in PATH)
- A physical Android device with USB debugging enabled, or an Android emulator

## Run the server

1. Install dependencies from the repository root:
   ```bash
   cd server
   yarn install
   ```

2. Start the server on port 3000:
   ```bash
   yarn start
   ```
   For development with file-watching:
   ```bash
   yarn dev
   ```

3. Confirm the server is running:
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response: `{"ok":true}`

## Run the app (adb reverse default)

The default configuration connects the mobile app to the local backend through a USB connection via adb reverse.

1. Connect your Android phone to your computer via USB and enable USB debugging.

2. Verify that adb recognizes the connected device:
   ```bash
   adb devices
   ```

3. Reverse port 3000 (backend API) and port 8081 (Metro bundler):
   ```bash
   adb reverse tcp:3000 tcp:3000
   adb reverse tcp:8081 tcp:8081
   ```

4. Start the Metro bundler:
   ```bash
   cd app
   yarn start
   ```

5. In a separate terminal, install and launch the Android application:
   ```bash
   cd app
   yarn android
   ```

6. Run the test suite:
   ```bash
   yarn --cwd app verify
   yarn --cwd server typecheck
   ```

## How to make it fail (plain names)

The system includes mechanisms to simulate adverse network conditions and test recovery:

- **Airplane mode during upload**: Enable Airplane mode on the device while an upload is underway. The socket terminates, and the report remains in the queue in a waiting state. When Airplane mode is turned off, the app detects connectivity and resumes uploading automatically without user intervention.
- **Background delivery after swipe from Recents**: Turn on Airplane mode, compose and queue a report, and swipe the app away from Recents (without force-stopping). When Airplane mode is turned off, Android WorkManager wakes up under the connected network constraint, uploads the report to the server in the background, and saves delivery state to disk. Running `curl http://localhost:3000/reports` verifies the report arrived without reopening the application.
- **Dropped network connection**: Send `POST /chaos/config` with `{"dropConnection": true}` or sever the connection mid-transfer. The client catches the socket disconnect, keeps the report in the queue, and retries with backoff.
- **Server internal error (500)**: Send `POST /chaos/config` with `{"simulate500": true}`. The server responds with HTTP 500. The upload engine marks the error as transient and schedules a retry.
- **Severed reply after disk save (idempotency test)**: Send `POST /chaos/config` with `{"lostResponse": true}`. The server writes the uploaded report and files to disk, then closes the connection before transmitting the HTTP 201 response. When the client retries using the same report ID, the server recognizes the idempotency key, returns the existing record, and avoids storing duplicate files on disk.
- **Throttled 2G connection**: Send `POST /chaos/config` with `{"latencyMs": 3000}` or start the Android emulator with `-netspeed gsm -netdelay gprs`. Slow data transfers continue to completion because the stall timeout tracks ongoing byte progress rather than total elapsed duration.
- **Oversized photo payload**: Submit an attachment exceeding the 5 MB ceiling. The server rejects the submission with HTTP 413, and the client flags the report as a non-retryable failure requiring user correction.
- **Deliberate reset**: Tap the Reset button in the app header. Choose between clearing only the local device queue (`local_queue_only`) or performing a full system wipe (`full_system_wipe`) that also purges the server database and unlinks uploaded files on disk.

## Decisions and trade-offs

TODO (mine)

## Not done

- **No background delivery after force stop**: On Android, explicitly force-stopping an application (`am force-stop` or through Android Settings) places the package into a stopped state where the operating system cancels all scheduled WorkManager tasks and background alarms until the user manually relaunches the application. WorkManager delivers queued reports unattended when the app is swiped away from Recents, but cannot run after a manual force stop.
- **iOS untested**: Development, hardware testing, and verification were performed on Android devices and emulators. iOS compilation and runtime behavior have not been tested.
- **Byte-offset resume protocol**: Uploads stream as multipart requests per report rather than resuming mid-file byte offsets through Tus chunk patching.

## With another day

- **Draft editing**: Allow editing inspection descriptions and swapping photos directly from the outbox before upload starts.
- **Offline cached server review**: Display previously fetched server reports when offline, with indicators distinguishing cached records from live server state.
- **Client-side bandwidth throttling**: Provide user-selectable upload bandwidth limits to conserve battery and avoid congesting weak cellular links.
