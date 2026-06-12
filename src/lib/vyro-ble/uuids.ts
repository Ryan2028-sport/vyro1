// VYRO band BLE identifiers.
// Source: Wearable nRF54 IMU firmware (app_ble.c) and VYRO BLE Packet Reference v1.

/** Custom Motion Service advertised by the band ("VYRO Motion"). */
export const VYRO_SERVICE_UUID = "f8a90001-9b6a-4c7e-9e1a-7c1f2d4e5f00";

/** NOTIFY — motion event packets (see packets.ts). */
export const VYRO_EVENT_CHAR_UUID = "f8a90002-9b6a-4c7e-9e1a-7c1f2d4e5f00";

/** WRITE — session control (start/pause/end + sport tag). */
export const VYRO_CONTROL_CHAR_UUID = "f8a90003-9b6a-4c7e-9e1a-7c1f2d4e5f00";

/** Nordic MCUmgr SMP service (used by MCUboot OTA via NCS sample). */
export const SMP_SERVICE_UUID = "8d53dc1d-1db7-4cd3-868b-8a527460aa84";
export const SMP_CHAR_UUID = "da2e7828-fbce-4e01-ae9e-261174997c48";

/** All services we ever care about — pass to scan filters. */
export const VYRO_ALL_SERVICES = [VYRO_SERVICE_UUID, SMP_SERVICE_UUID];

/** Advertised local name. */
export const VYRO_DEVICE_NAME = "VYRO Motion";
