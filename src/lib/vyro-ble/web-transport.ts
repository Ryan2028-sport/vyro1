// Web Bluetooth transport for SMP. Connects directly via navigator.bluetooth
// (independent of the scan UI), negotiates GATT to the SMP service, and
// exposes a writeWithoutResponse / notify pair to SmpClient.

import { SMP_CHAR_UUID, SMP_SERVICE_UUID, VYRO_SERVICE_UUID } from "./uuids";
import type { SmpTransport } from "./smp";

type BTRemoteGATTCharacteristic = {
  value?: DataView | null;
  writeValueWithoutResponse?: (buf: BufferSource) => Promise<void>;
  writeValue: (buf: BufferSource) => Promise<void>;
  startNotifications: () => Promise<BTRemoteGATTCharacteristic>;
  stopNotifications: () => Promise<BTRemoteGATTCharacteristic>;
  addEventListener: (
    type: "characteristicvaluechanged",
    cb: (e: Event) => void,
  ) => void;
  removeEventListener: (
    type: "characteristicvaluechanged",
    cb: (e: Event) => void,
  ) => void;
};

type BTRemoteGATTServer = {
  connected: boolean;
  device: BTDevice;
  connect: () => Promise<BTRemoteGATTServer>;
  disconnect: () => void;
  getPrimaryService: (uuid: string) => Promise<{
    getCharacteristic: (uuid: string) => Promise<BTRemoteGATTCharacteristic>;
  }>;
};

type BTDevice = {
  id: string;
  name?: string;
  gatt?: BTRemoteGATTServer;
};

type BTNavigator = Navigator & {
  bluetooth?: {
    requestDevice: (opts: {
      filters?: Array<{ services?: string[]; name?: string; namePrefix?: string }>;
      optionalServices?: string[];
      acceptAllDevices?: boolean;
    }) => Promise<BTDevice>;
  };
};

export async function requestVyroBand(): Promise<BTDevice> {
  const nav = navigator as BTNavigator;
  if (!nav.bluetooth?.requestDevice) {
    throw new Error(
      "Web Bluetooth is not available here. Use Chrome / Edge on desktop, or open inside the native VYRO app.",
    );
  }
  return nav.bluetooth.requestDevice({
    filters: [
      { services: [VYRO_SERVICE_UUID] },
      { services: [SMP_SERVICE_UUID] },
      { namePrefix: "VYRO" },
    ],
    optionalServices: [VYRO_SERVICE_UUID, SMP_SERVICE_UUID],
  });
}

export async function openSmpTransport(device: BTDevice): Promise<SmpTransport> {
  if (!device.gatt) throw new Error("This device has no GATT server.");
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
  const service = await server.getPrimaryService(SMP_SERVICE_UUID);
  const char = await service.getCharacteristic(SMP_CHAR_UUID);

  const listeners = new Set<(chunk: Uint8Array) => void>();
  const onValue = (e: Event) => {
    const c = e.target as unknown as BTRemoteGATTCharacteristic;
    const v = c.value;
    if (!v) return;
    const chunk = new Uint8Array(v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength));
    for (const fn of listeners) fn(chunk);
  };
  char.addEventListener("characteristicvaluechanged", onValue);
  await char.startNotifications();

  // Web Bluetooth doesn't expose the negotiated MTU. 244 is the practical
  // ceiling on Chrome (247 ATT MTU - 3 byte ATT header).
  const transport: SmpTransport = {
    mtu: 244,
    async write(bytes) {
      const view = new Uint8Array(bytes.byteLength);
      view.set(bytes);
      if (char.writeValueWithoutResponse) {
        await char.writeValueWithoutResponse(view.buffer);
      } else {
        await char.writeValue(view.buffer);
      }
    },
    onNotify(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    async close() {
      try {
        char.removeEventListener("characteristicvaluechanged", onValue);
        await char.stopNotifications();
      } catch {
        /* ignore */
      }
    },
  };
  return transport;
}
