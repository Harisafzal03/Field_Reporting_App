# Field Reports

A React Native field-reporting mobile application paired with a dedicated upload backend, engineered to deliver reports and photo attachments reliably over intermittent and 2G connectivity. This repository represents the foundation for a mobile engineering technical assessment built with bare React Native CLI and Express.

## Prerequisites

- **Node.js**: LTS (v20+ or v22+)
- **Yarn**: Classic (`v1.22+`) or Berry (`v3.6+`)
- **JDK 17**: Eclipse Temurin or OpenJDK 17 (`/usr/libexec/java_home -v 17`)
- **Android Studio**: Android SDK, platform-tools, build-tools, and an Android Virtual Device (AVD)
- **adb**: Configured in your system `PATH` (typically under `$HOME/Library/Android/sdk/platform-tools`)

## Repo Layout

```text
.
├── app/        React Native CLI (bare, TypeScript) mobile application
└── server/     Express TypeScript backend service for report ingestion
```

Inside `app/src/`:
- `domain/`: Core business models, validation rules, and domain entities
- `services/`: Network, compression, and file system service abstractions
- `queue/`: Persistent disk-backed offline delivery queue and state machine
- `screens/`: Primary application screen views
- `components/`: Modular UI widgets, status badges, and input controls

## Run the Server

From the repository root:

1. Install dependencies (if not already installed):
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

2. Set up reverse port forwarding so the Android device/emulator can reach the local Express server on port 3000:
   ```bash
   adb reverse tcp:3000 tcp:3000
   ```

3. To launch an Android emulator with throttled 2G network emulation (GSM speed, GPRS latency):
   ```bash
   emulator -avd <name> -netspeed gsm -netdelay gprs
   ```

4. Start the Metro bundler and compile/run the Android app:
   ```bash
   cd app
   yarn start
   ```
   In a separate terminal:
   ```bash
   cd app
   yarn android
   ```

## Scripts

### `app/` (Mobile Application)

| Script | Command | Purpose |
|---|---|---|
| `start` | `react-native start` | Starts Metro bundler |
| `android` | `react-native run-android` | Builds and launches the app on Android |
| `ios` | `react-native run-ios` | Builds and launches the app on iOS |
| `lint` | `eslint .` | Runs ESLint static analysis |
| `test` | `jest` | Runs unit tests using Jest |
| `typecheck` | `tsc --noEmit` | Runs TypeScript compiler type checking without emitting files |
| `format` | `prettier --write .` | Formats all project files using Prettier |
| `verify` | `yarn typecheck && yarn lint && yarn test` | Runs typecheck, lint, and unit test suites sequentially |

### `server/` (Backend Service)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `tsx watch src/index.ts` | Runs Express server with live reload on file modifications |
| `start` | `tsx src/index.ts` | Runs Express server with tsx |
| `typecheck` | `tsc --noEmit` | Validates TypeScript types across the server codebase |

## Make it fail
TODO

## Decisions and trade-offs
TODO

## Not done
TODO

## With another day
TODO
