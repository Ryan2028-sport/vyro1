// High-level OTA flow: upload firmware image to MCUboot slot 1, then test+swap.
//
// Sequence:
//   1. compute SHA-256 of image
//   2. upload in chunks (IMAGE/UPLOAD, group=1 id=1)
//   3. mark for test  (IMAGE/STATE, group=1 id=0, { hash, confirm: false })
//   4. reset device   (DEFAULT/RESET, group=0 id=5)
//   5. (caller reconnects) confirm (IMAGE/STATE, { confirm: true })
//
// Recovery: if confirm never happens, MCUboot reverts on next reboot. That
// matches the testing log behaviour the firmware team validated.

import {
  SMP_DEFAULT_CMD,
  SMP_GROUP,
  SMP_IMAGE_CMD,
  SMP_OP,
  SmpClient,
  SmpTransport,
  sha256,
} from "./smp";

export interface OtaProgress {
  /** 0..1 */
  fraction: number;
  bytesSent: number;
  bytesTotal: number;
  phase:
    | "hashing"
    | "uploading"
    | "marking_test"
    | "resetting"
    | "waiting_reconnect"
    | "confirming"
    | "done";
  message?: string;
}

export interface OtaOptions {
  image: Uint8Array;
  onProgress?: (p: OtaProgress) => void;
  /** Set to false if you only want to upload+test without auto-reset. */
  reset?: boolean;
}

export async function runOtaUpload(
  transport: SmpTransport,
  opts: OtaOptions,
): Promise<{ hash: Uint8Array }> {
  const { image, onProgress } = opts;
  const reset = opts.reset !== false;
  const client = new SmpClient(transport);
  try {
    onProgress?.({
      fraction: 0,
      bytesSent: 0,
      bytesTotal: image.length,
      phase: "hashing",
    });
    const hash = await sha256(image);

    // SMP UPLOAD chunk size budget: total frame must fit MTU. The first
    // request carries { image, len, off, data, sha } — quite a bit of CBOR
    // overhead. We choose a conservative data slice of ~ MTU - 64.
    const dataChunk = Math.max(16, transport.mtu - 64);
    let off = 0;
    while (off < image.length) {
      const slice = image.subarray(off, Math.min(off + dataChunk, image.length));
      const payload: Record<string, unknown> = {
        image: 0,
        data: slice,
        off,
      };
      if (off === 0) {
        payload.len = image.length;
        payload.sha = hash;
        payload.upgrade = true;
      }
      const res = await client.request(
        SMP_OP.WRITE,
        SMP_GROUP.IMAGE,
        SMP_IMAGE_CMD.UPLOAD,
        payload,
        30000,
      );
      // Device echoes the next expected offset; trust it.
      if (typeof res.off === "number" && res.off > off) {
        off = res.off;
      } else {
        off += slice.length;
      }
      onProgress?.({
        fraction: off / image.length,
        bytesSent: off,
        bytesTotal: image.length,
        phase: "uploading",
      });
    }

    onProgress?.({
      fraction: 1,
      bytesSent: image.length,
      bytesTotal: image.length,
      phase: "marking_test",
    });
    await client.request(
      SMP_OP.WRITE,
      SMP_GROUP.IMAGE,
      SMP_IMAGE_CMD.STATE,
      { hash, confirm: false },
      15000,
    );

    if (reset) {
      onProgress?.({
        fraction: 1,
        bytesSent: image.length,
        bytesTotal: image.length,
        phase: "resetting",
      });
      try {
        await client.request(
          SMP_OP.WRITE,
          SMP_GROUP.DEFAULT,
          SMP_DEFAULT_CMD.RESET,
          {},
          5000,
        );
      } catch {
        // Reset commonly drops the link before responding — ignore.
      }
    }

    return { hash };
  } finally {
    await client.close().catch(() => {});
  }
}

/** Mark the freshly-booted image as permanent. Run after reconnecting. */
export async function confirmOta(
  transport: SmpTransport,
  hash: Uint8Array,
): Promise<void> {
  const client = new SmpClient(transport);
  try {
    await client.request(
      SMP_OP.WRITE,
      SMP_GROUP.IMAGE,
      SMP_IMAGE_CMD.STATE,
      { hash, confirm: true },
      15000,
    );
  } finally {
    await client.close().catch(() => {});
  }
}
