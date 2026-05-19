# Building the native iOS app (TestFlight) with Bluetooth

The IPA from Despia is a WebView with no native Bluetooth. To get the
iOS Settings Bluetooth toggle and real `CBCentralManager` access you must
build a Capacitor iOS app. Capacitor is already scaffolded in this repo.

You need: a Mac, Xcode 15+, an Apple Developer account ($99/yr), CocoaPods
(`sudo gem install cocoapods`).

## 1. Pull the repo

In Lovable click **GitHub → Connect**, then on your Mac:

```bash
git clone <your-repo-url> vyro
cd vyro
npm install        # or: bun install
```

## 2. Build the web bundle

```bash
npm run build      # outputs to dist/client (matches capacitor.config.ts webDir)
```

## 3. Add the iOS platform (only the first time)

```bash
npx cap add ios
npx cap sync ios
```

This creates an `ios/` folder — that is a real Xcode project.

## 4. Add the Bluetooth permission strings

Open `ios/App/App/Info.plist` and add:

```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Vyro needs Bluetooth to connect to your watch.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Vyro needs Bluetooth to connect to your watch.</string>
```

(Without these two keys the iOS Settings toggle never appears — this is the
exact problem you hit with Despia.)

## 5. Open in Xcode and run

```bash
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities** → pick your Team.
2. Set a unique **Bundle Identifier** (e.g. `app.vyro.watch`).
3. Plug in your iPhone, pick it as the run target, press ▶ to test.
4. The first BLE call triggers the iOS Bluetooth permission prompt and the
   toggle appears under **Settings → Vyro**.

## 6. Ship to TestFlight

In Xcode: **Product → Archive** → Organizer → **Distribute App** →
**App Store Connect** → **Upload**. App Store Connect processes it
(~10–20 min), then add testers in TestFlight.

## Re-deploying after web changes

Every time you change React code:

```bash
npm run build
npx cap sync ios
```

Then Archive + upload again in Xcode.

## Where the BLE code lives

- `src/lib/native-ble.ts` — Capacitor BLE helper (scan / connect / subscribe).
- `capacitor.config.ts` — app id, web dir, plugin config.

`isNativeBle` is `false` in the browser, so the existing web app keeps
working on `vyro1.lovable.app` and the Despia build.
