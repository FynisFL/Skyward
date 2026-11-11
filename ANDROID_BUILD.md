# Skyward Salvage — Android APK

This repository includes a native Android WebView wrapper for the existing offline HTML/JavaScript game.

## Build

The GitHub Actions workflow `.github/workflows/build-android-apk.yml` builds a debug APK on pushes that change the game or Android project, or when manually dispatched.

1. Open the repository's **Actions** tab.
2. Select **Build Android APK**.
3. Open the latest successful run.
4. Under **Artifacts**, download `Skyward-Salvage-Android-APK`.
5. Extract the ZIP and install `Skyward-Salvage-debug.apk` on Android.

The APK is a debug-signed sideload build, not a Play Store release.

## Wrapper details

- Android WebView loads `file:///android_asset/game/index.html`.
- The complete game is bundled under `app/src/main/assets/game/`; no game CDN or network access is required.
- Landscape orientation, immersive full-screen mode, JavaScript, DOM storage, and hardware acceleration are enabled.
- The app keeps the screen awake while playing.

## Device testing

The WebView wrapper is a packaging layer, not proof that all gameplay has been validated on every Android device. Test startup, touch look, joystick, simultaneous touch actions, audio, local save data, pause/resume, and performance on the target phone. If WebGL is unavailable or the device runs out of graphics memory, lower the in-game quality setting.
