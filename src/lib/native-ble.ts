// Capacitor BLE wrapper. Works only inside the native iOS shell built with
// `npx cap sync ios` + Xcode. In the browser / Despia WebView it falls back
// to a no-op so the web app keeps rendering.
import { Capacitor } from '@capacitor/core';
import { BleClient, type BleDevice } from '@capacitor-community/bluetooth-le';

export const isNativeBle = Capacitor.isNativePlatform();

export async function initBle() {
  if (!isNativeBle) return false;
  await BleClient.initialize({ androidNeverForLocation: true });
  return true;
}

export async function scanForWatch(
  services: string[] = [],
  timeoutMs = 10000,
): Promise<BleDevice[]> {
  if (!isNativeBle) throw new Error('Native BLE only available in the iOS build');
  const found: BleDevice[] = [];
  await BleClient.requestLEScan({ services, allowDuplicates: false }, (r) => {
    if (!found.find((d) => d.deviceId === r.device.deviceId)) found.push(r.device);
  });
  await new Promise((res) => setTimeout(res, timeoutMs));
  await BleClient.stopLEScan();
  return found;
}

export async function connectWatch(deviceId: string) {
  await BleClient.connect(deviceId);
}

export async function subscribeCharacteristic(
  deviceId: string,
  service: string,
  characteristic: string,
  onValue: (value: DataView) => void,
) {
  await BleClient.startNotifications(deviceId, service, characteristic, onValue);
}

export { BleClient };
