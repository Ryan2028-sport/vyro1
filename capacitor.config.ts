import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.vyro.watch',
  appName: 'Vyro',
  webDir: 'dist/client',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    BluetoothLe: {
      displayStrings: {
        scanning: 'Scanning for watches…',
        cancel: 'Cancel',
        availableDevices: 'Available watches',
        noDeviceFound: 'No watch found',
      },
    },
  },
};

export default config;
