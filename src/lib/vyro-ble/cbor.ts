// Minimal CBOR (RFC 8949) encoder/decoder, scoped to what Nordic MCUmgr SMP
// needs: maps with string keys, unsigned ints, negative ints, byte strings,
// text strings, arrays, booleans, null. No tags, no floats beyond what SMP
// might echo back (handled as numbers).

type Cbor =
  | number
  | bigint
  | string
  | boolean
  | null
  | Uint8Array
  | Cbor[]
  | { [k: string]: Cbor };

// --------------------------- ENCODE ---------------------------

function writeHeader(major: number, n: number, buf: number[]): void {
  const mt = major << 5;
  if (n < 24) buf.push(mt | n);
  else if (n < 0x100) buf.push(mt | 24, n);
  else if (n < 0x10000) buf.push(mt | 25, (n >> 8) & 0xff, n & 0xff);
  else if (n < 0x100000000)
    buf.push(
      mt | 26,
      (n >>> 24) & 0xff,
      (n >>> 16) & 0xff,
      (n >>> 8) & 0xff,
      n & 0xff,
    );
  else {
    // 64-bit length — used for very large byte strings. Encode via BigInt.
    const big = BigInt(n);
    buf.push(mt | 27);
    for (let i = 7; i >= 0; i--)
      buf.push(Number((big >> BigInt(8 * i)) & 0xffn));
  }
}

function encodeValue(v: Cbor, out: number[]): void {
  if (v === null) {
    out.push(0xf6);
    return;
  }
  if (typeof v === "boolean") {
    out.push(v ? 0xf5 : 0xf4);
    return;
  }
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error("CBOR: only integers supported");
    if (v >= 0) writeHeader(0, v, out);
    else writeHeader(1, -1 - v, out);
    return;
  }
  if (typeof v === "bigint") {
    if (v >= 0n) writeHeader(0, Number(v), out);
    else writeHeader(1, Number(-1n - v), out);
    return;
  }
  if (typeof v === "string") {
    const bytes = new TextEncoder().encode(v);
    writeHeader(3, bytes.length, out);
    for (const b of bytes) out.push(b);
    return;
  }
  if (v instanceof Uint8Array) {
    writeHeader(2, v.length, out);
    for (const b of v) out.push(b);
    return;
  }
  if (Array.isArray(v)) {
    writeHeader(4, v.length, out);
    for (const it of v) encodeValue(it, out);
    return;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    writeHeader(5, keys.length, out);
    for (const k of keys) {
      encodeValue(k, out);
      encodeValue(v[k], out);
    }
    return;
  }
  throw new Error("CBOR: unsupported value");
}

export function cborEncode(value: Cbor): Uint8Array {
  const out: number[] = [];
  encodeValue(value, out);
  return new Uint8Array(out);
}

// --------------------------- DECODE ---------------------------

function readHeader(
  bytes: Uint8Array,
  off: number,
): { major: number; info: number; n: number; next: number } {
  if (off >= bytes.length) throw new Error("CBOR: short read");
  const ib = bytes[off];
  const major = ib >> 5;
  const info = ib & 0x1f;
  let n: number;
  let next = off + 1;
  if (info < 24) n = info;
  else if (info === 24) {
    n = bytes[next];
    next += 1;
  } else if (info === 25) {
    n = (bytes[next] << 8) | bytes[next + 1];
    next += 2;
  } else if (info === 26) {
    n =
      bytes[next] * 0x1000000 +
      ((bytes[next + 1] << 16) | (bytes[next + 2] << 8) | bytes[next + 3]);
    next += 4;
  } else if (info === 27) {
    // 64-bit — collapse to Number; SMP lengths are well below 2^53.
    let big = 0n;
    for (let i = 0; i < 8; i++) big = (big << 8n) | BigInt(bytes[next + i]);
    n = Number(big);
    next += 8;
  } else {
    throw new Error(`CBOR: reserved info ${info}`);
  }
  return { major, info, n, next };
}

function decodeValue(
  bytes: Uint8Array,
  off: number,
): { value: Cbor; next: number } {
  const h = readHeader(bytes, off);
  switch (h.major) {
    case 0:
      return { value: h.n, next: h.next };
    case 1:
      return { value: -1 - h.n, next: h.next };
    case 2: {
      const slice = bytes.slice(h.next, h.next + h.n);
      return { value: slice, next: h.next + h.n };
    }
    case 3: {
      const slice = bytes.slice(h.next, h.next + h.n);
      return { value: new TextDecoder().decode(slice), next: h.next + h.n };
    }
    case 4: {
      const arr: Cbor[] = [];
      let p = h.next;
      for (let i = 0; i < h.n; i++) {
        const r = decodeValue(bytes, p);
        arr.push(r.value);
        p = r.next;
      }
      return { value: arr, next: p };
    }
    case 5: {
      const obj: { [k: string]: Cbor } = {};
      let p = h.next;
      for (let i = 0; i < h.n; i++) {
        const k = decodeValue(bytes, p);
        if (typeof k.value !== "string")
          throw new Error("CBOR: non-string map key");
        const val = decodeValue(bytes, k.next);
        obj[k.value] = val.value;
        p = val.next;
      }
      return { value: obj, next: p };
    }
    case 7: {
      if (h.info === 20) return { value: false, next: h.next };
      if (h.info === 21) return { value: true, next: h.next };
      if (h.info === 22 || h.info === 23) return { value: null, next: h.next };
      throw new Error(`CBOR: float/simple not supported (info=${h.info})`);
    }
    default:
      throw new Error(`CBOR: unsupported major ${h.major}`);
  }
}

export function cborDecode(bytes: Uint8Array): Cbor {
  return decodeValue(bytes, 0).value;
}
