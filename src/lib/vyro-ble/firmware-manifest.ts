// Firmware update manifest client.
//
// Fetches a small JSON descriptor from VITE_FIRMWARE_MANIFEST_URL, compares
// its `latestVersion` against whatever the watch reported over BLE DIS
// (characteristic 0x2a26), and — if newer — hands back a `downloadUrl` the
// UI can offer for install.
//
// This module DOES NOT flash the watch. Armand's current firmware does not
// expose the MCUmgr/SMP GATT service that `runOtaUpload` uses, so the actual
// install step is unavailable end-to-end. The banner surfaces the version
// mismatch honestly and disables the install button when SMP is missing.

export type FirmwareManifest = {
  latestVersion: string;
  downloadUrl: string;
  sha256?: string;
  notes?: string;
};

export type FirmwareCheckResult = {
  manifest: FirmwareManifest | null;
  currentVersion: string | null;
  updateAvailable: boolean;
  error: string | null;
};

const MANIFEST_URL = (import.meta.env.VITE_FIRMWARE_MANIFEST_URL as string | undefined) || "";

// Semver-ish compare that also tolerates "v1.2.3", "1.2.3-armand", "1.2".
// Returns positive if a > b, 0 if equal, negative if a < b.
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[.\-+]/)
      .map((p) => {
        const n = Number.parseInt(p, 10);
        return Number.isFinite(n) ? n : 0;
      });
  const av = parse(a);
  const bv = parse(b);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const diff = (av[i] ?? 0) - (bv[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function fetchFirmwareManifest(): Promise<FirmwareManifest | null> {
  if (!MANIFEST_URL) return null;
  try {
    const res = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    const json = (await res.json()) as Partial<FirmwareManifest>;
    if (!json.latestVersion || !json.downloadUrl) {
      throw new Error("manifest missing latestVersion or downloadUrl");
    }
    return {
      latestVersion: String(json.latestVersion),
      downloadUrl: String(json.downloadUrl),
      sha256: json.sha256 ? String(json.sha256) : undefined,
      notes: json.notes ? String(json.notes) : undefined,
    };
  } catch (err) {
    console.warn("[firmware-manifest] fetch failed", err);
    return null;
  }
}

export async function checkFirmwareUpdate(
  currentVersion: string | null,
): Promise<FirmwareCheckResult> {
  if (!MANIFEST_URL) {
    return {
      manifest: null,
      currentVersion,
      updateAvailable: false,
      error: "VITE_FIRMWARE_MANIFEST_URL not set",
    };
  }
  const manifest = await fetchFirmwareManifest();
  if (!manifest) {
    return { manifest: null, currentVersion, updateAvailable: false, error: "manifest unavailable" };
  }
  const updateAvailable =
    !!currentVersion && compareVersions(manifest.latestVersion, currentVersion) > 0;
  return { manifest, currentVersion, updateAvailable, error: null };
}

export function isManifestConfigured(): boolean {
  return !!MANIFEST_URL;
}
