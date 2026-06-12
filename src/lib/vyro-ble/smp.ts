// Nordic MCUmgr SMP (Simple Management Protocol) client over BLE.
//
// SMP packet = 8-byte header + CBOR payload:
//   off 0   op            uint8   (0=read, 1=read-rsp, 2=write, 3=write-rsp)
//   off 1   flags         uint8
//   off 2-3 length        uint16 BE   bytes of CBOR payload that follow
//   off 4-5 group         uint16 BE
//   off 6   sequence      uint8
//   off 7   command id    uint8
//   off 8+  CBOR map
//
// We only need:
//   group 0 (default mgmt):     id 5 = reset
//   group 1 (image mgmt):       id 0 = state, id 1 = upload
//
// Long packets are fragmented across BLE writes by the transport.

import { cborDecode, cborEncode } from "./cbor";

export const SMP_OP = {
  READ: 0,
  READ_RSP: 1,
  WRITE: 2,
  WRITE_RSP: 3,
} as const;

export const SMP_GROUP = {
  DEFAULT: 0,
  IMAGE: 1,
} as const;

export const SMP_DEFAULT_CMD = {
  RESET: 5,
};
export const SMP_IMAGE_CMD = {
  STATE: 0,
  UPLOAD: 1,
};

export interface SmpHeader {
  op: number;
  flags: number;
  length: number;
  group: number;
  seq: number;
  id: number;
}

export function encodeSmpFrame(
  header: SmpHeader,
  payload: Record<string, unknown>,
): Uint8Array {
  const body = cborEncode(payload as never);
  const buf = new Uint8Array(8 + body.length);
  buf[0] = header.op;
  buf[1] = header.flags & 0xff;
  buf[2] = (body.length >> 8) & 0xff;
  buf[3] = body.length & 0xff;
  buf[4] = (header.group >> 8) & 0xff;
  buf[5] = header.group & 0xff;
  buf[6] = header.seq & 0xff;
  buf[7] = header.id & 0xff;
  buf.set(body, 8);
  return buf;
}

export function decodeSmpFrame(bytes: Uint8Array): {
  header: SmpHeader;
  payload: Record<string, unknown>;
} {
  if (bytes.length < 8) throw new Error("SMP frame too short");
  const header: SmpHeader = {
    op: bytes[0],
    flags: bytes[1],
    length: (bytes[2] << 8) | bytes[3],
    group: (bytes[4] << 8) | bytes[5],
    seq: bytes[6],
    id: bytes[7],
  };
  const body = bytes.subarray(8, 8 + header.length);
  const decoded = body.length ? cborDecode(body) : {};
  return { header, payload: decoded as Record<string, unknown> };
}

/** Re-assembles SMP frames from raw BLE notifications, calling onFrame on each. */
export class SmpReassembler {
  private buf: Uint8Array = new Uint8Array();
  constructor(private onFrame: (bytes: Uint8Array) => void) {}

  feed(chunk: Uint8Array): void {
    if (this.buf.length === 0) {
      this.buf = chunk.slice();
    } else {
      const merged = new Uint8Array(this.buf.length + chunk.length);
      merged.set(this.buf);
      merged.set(chunk, this.buf.length);
      this.buf = merged;
    }
    // Try to drain whole frames.
    while (this.buf.length >= 8) {
      const len = 8 + ((this.buf[2] << 8) | this.buf[3]);
      if (this.buf.length < len) return;
      const frame = this.buf.subarray(0, len).slice();
      this.buf = this.buf.subarray(len).slice();
      try {
        this.onFrame(frame);
      } catch (err) {
        console.warn("[smp] frame handler error", err);
      }
    }
  }
}

/** Compute SHA-256 of a buffer using Web Crypto. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(digest);
}

/**
 * Pluggable transport — anything that can write a Uint8Array to the SMP
 * characteristic and route incoming notifications back into us. Implementations:
 *   - web-transport.ts: navigator.bluetooth GATT
 *   - (future) native-transport.ts: Despia BLE bridge (needs binary write support)
 */
export interface SmpTransport {
  /** Largest payload we should put in a single write (MTU - 3). */
  mtu: number;
  /** Write one chunk; resolves when the write completes. */
  write(bytes: Uint8Array): Promise<void>;
  /** Register a listener for incoming notification chunks. */
  onNotify(cb: (chunk: Uint8Array) => void): () => void;
  /** Tear down. */
  close(): Promise<void>;
}

export interface SmpResponseMap {
  rc?: number;
  off?: number;
  [k: string]: unknown;
}

/** Reliable request/response over the SMP transport, keyed by sequence number. */
export class SmpClient {
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (v: SmpResponseMap) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private reassembler = new SmpReassembler((frame) => this.handleFrame(frame));
  private offNotify: () => void;

  constructor(private transport: SmpTransport) {
    this.offNotify = transport.onNotify((chunk) =>
      this.reassembler.feed(chunk),
    );
  }

  close(): Promise<void> {
    this.offNotify();
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("SMP client closed"));
    }
    this.pending.clear();
    return this.transport.close();
  }

  private handleFrame(bytes: Uint8Array): void {
    let decoded;
    try {
      decoded = decodeSmpFrame(bytes);
    } catch (err) {
      console.warn("[smp] bad frame", err);
      return;
    }
    const waiter = this.pending.get(decoded.header.seq);
    if (!waiter) return;
    this.pending.delete(decoded.header.seq);
    clearTimeout(waiter.timer);
    waiter.resolve(decoded.payload as SmpResponseMap);
  }

  async request(
    op: number,
    group: number,
    id: number,
    payload: Record<string, unknown>,
    timeoutMs = 8000,
  ): Promise<SmpResponseMap> {
    const seq = this.seq++ & 0xff;
    const frame = encodeSmpFrame(
      { op, flags: 0, length: 0, group, seq, id },
      payload,
    );
    const promise = new Promise<SmpResponseMap>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(seq);
        reject(new Error(`SMP request seq=${seq} timed out`));
      }, timeoutMs);
      this.pending.set(seq, { resolve, reject, timer });
    });

    // Fragment across MTU-sized writes.
    const mtu = Math.max(20, this.transport.mtu);
    for (let off = 0; off < frame.length; off += mtu) {
      const chunk = frame.subarray(off, Math.min(off + mtu, frame.length));
      await this.transport.write(chunk);
    }
    const res = await promise;
    if (typeof res.rc === "number" && res.rc !== 0) {
      throw new Error(`SMP rc=${res.rc}`);
    }
    return res;
  }
}
