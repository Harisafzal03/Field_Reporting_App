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

## Run the app

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

4. Install mobile dependencies:
   ```bash
   cd app
   yarn install
   ```

5. Start the Metro bundler:
   ```bash
   yarn start
   ```

6. In a separate terminal, install and launch the Android application:
   ```bash
   cd app
   yarn android
   ```

## Tests

Run the test suite and static checks:

```bash
yarn --cwd app verify
yarn --cwd server typecheck
```

## How to make it fail

The system includes mechanisms to simulate adverse network conditions and test recovery:

- **Airplane mode during upload**: Enable Airplane mode on the device while an upload is underway. The socket terminates, and the report remains in the queue in a waiting state. When Airplane mode is turned off, the app detects connectivity and resumes uploading automatically without user intervention.
- **Background delivery after swipe from Recents**: Turn on Airplane mode, compose and queue a report, and swipe the app away from Recents (without force-stopping). When Airplane mode is turned off, Android WorkManager wakes up under the connected network constraint, uploads the report to the server in the background, and saves delivery state to disk. Running `curl http://localhost:3000/reports` verifies the report arrived without reopening the application.
  Tested on: <PHONE MODEL>, Android <VERSION>
- **Dropped network connection**: Send `POST /chaos/config` with `dropConnection` enabled:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"dropConnection": true}'
  ```
  The client catches the socket disconnect, keeps the report in the queue, and retries with backoff.
- **Server internal error (500)**: Configure the server to return HTTP 500 on upload requests:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"simulate500": true}'
  ```
  The upload engine marks the error as transient and schedules a retry.
- **Severed reply after disk save (idempotency test)**: Configure the server to save the report and photos to disk, then sever the socket before returning the HTTP 201 response:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"lostResponse": true}'
  ```
  When the client retries using the same report ID, the server recognizes the idempotency key, returns the existing record, and avoids storing duplicate files on disk.
- **Hanged upload request**: Configure the server to accept the request but never send a response:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"hangRequest": true}'
  ```
  The client aborts the connection once the stall timeout expires and schedules a retry.
- **Throttled 2G connection**: Inject artificial latency on upload requests:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"latencyMs": 3000}'
  ```
  Alternatively, start the Android emulator with `-netspeed gsm -netdelay gprs`. Slow data transfers continue to completion because the stall timeout tracks ongoing byte progress rather than total elapsed duration.
- **Turn all chaos modes off**: Reset all chaos parameters back to standard operation:
  ```bash
  curl -X POST http://localhost:3000/chaos/config -H "Content-Type: application/json" -d '{"dropConnection": false, "simulate500": false, "hangRequest": false, "lostResponse": false, "latencyMs": 0}'
  ```
- **Oversized photo payload**: The mobile application downsizes photos before queueing. To test server-side rejection of oversized files, send a 6 MB file directly to the upload endpoint:
  ```bash
  head -c 6000000 /dev/zero > big.jpg
  curl -i -X POST http://localhost:3000/reports \
    -F "reportId=test-oversized" \
    -F "description=Oversized photo test" \
    -F "images=@big.jpg"
  rm big.jpg
  ```
  The server rejects files exceeding the 5 MB ceiling with HTTP 413 Payload Too Large.
- **Deliberate reset**: Tap the Reset button in the app header, or issue a DELETE request directly to the server:
  ```bash
  curl -X DELETE http://localhost:3000/reports
  ```
  Choose between clearing only the local device queue (`local_queue_only`) or performing a full system wipe (`full_system_wipe`) that also purges the server database and unlinks uploaded files on disk.

## Decisions and trade-offs



## Not done

- **iOS untested**: Development, hardware testing, and verification were performed on Android devices and emulators. iOS compilation and runtime behavior have not been tested.

## With another day

- **Draft editing**: Allow editing inspection descriptions and swapping photos directly from the outbox before upload starts.
- **Offline cached server review**: Display previously fetched server reports when offline, with indicators distinguishing cached records from live server state.
- **Client-side bandwidth throttling**: Provide user-selectable upload bandwidth limits to conserve battery and avoid congesting weak cellular links.
