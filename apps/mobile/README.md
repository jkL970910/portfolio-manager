# Loo国的财富宝库 Mobile App

This directory is the Flutter-first mobile client for Loo国的财富宝库.

Current status:

- repository skeleton created
- app structure defined
- Web and Android platform entrypoints generated
- local WSL one-click stack starts Flutter Web as the primary mobile preview

Local commands:

```bash
cd ~/projects/portfolio-manager
npm run mobile:pub:get
npm run mobile:dev:web
```

The remote desktop launcher now starts the Flutter Web preview on port `3001`.
The existing Next.js app remains the temporary backend/API host on port `3000`.

Android toolchain:

```bash
export JAVA_HOME="$HOME/.local/jdk/temurin-17"
export ANDROID_HOME="$HOME/.local/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

cd ~/projects/portfolio-manager/apps/mobile
flutter doctor -v
flutter build apk --debug
```

Android device run:

```bash
cd ~/projects/portfolio-manager/apps/mobile
adb devices
flutter run -d <device-id> --dart-define=LOO_API_BASE_URL=http://<wsl-host-lan-ip>:3000
```

For Android emulator, use `http://10.0.2.2:3000` as the API base URL. For a physical Samsung device, use the Windows/WSL host LAN IP that the phone can reach.

Web preview without Chrome:

```bash
cd ~/projects/portfolio-manager/apps/mobile
flutter run -d web-server --web-hostname 0.0.0.0 --web-port 3001 --dart-define=LOO_API_BASE_URL=http://127.0.0.1:3000
```
