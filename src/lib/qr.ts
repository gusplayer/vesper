/**
 * A QR code encoder: byte mode, error correction level M, versions 1 to 5 (up to 86
 * bytes), following ISO/IEC 18004. Enough for an invite link and nothing more; written
 * by hand so the bundle carries no QR library (ADR-0021).
 *
 * Pure: takes text, returns a square boolean matrix. No React, no imports.
 */

export type QrMatrix = ReadonlyArray<ReadonlyArray<boolean>>;

/** Per version, level M: total codewords, error-correction codewords per block, blocks. */
const VERSIONS: ReadonlyArray<{ total: number; ecPerBlock: number; blocks: number; alignment: number | null }> = [
  { total: 26, ecPerBlock: 10, blocks: 1, alignment: null },
  { total: 44, ecPerBlock: 16, blocks: 1, alignment: 18 },
  { total: 70, ecPerBlock: 26, blocks: 1, alignment: 22 },
  { total: 100, ecPerBlock: 18, blocks: 2, alignment: 26 },
  { total: 134, ecPerBlock: 24, blocks: 2, alignment: 30 },
];

/** Bytes of payload a version holds in byte mode: data codewords minus the 2-byte header. */
export const QR_MAX_BYTES = VERSIONS.map((v) => v.total - v.ecPerBlock * v.blocks - 2);

const BYTE_MODE = 0b0100;
const LEVEL_M_BITS = 0b00;
const FORMAT_MASK = 0x5412;
const FORMAT_GENERATOR = 0x537;
const PAD_BYTES = [0xec, 0x11];

// --- GF(256) for Reed–Solomon ---------------------------------------------------------

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i += 1) {
    EXP[i] = EXP[i - 255] ?? 0;
  }
})();

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return EXP[(LOG[a] ?? 0) + (LOG[b] ?? 0)] ?? 0;
}

/** The generator polynomial of `degree` roots: (x - α^0)(x - α^1)…, highest term first. */
function generator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      const coefficient = poly[j] ?? 0;
      next[j] = (next[j] ?? 0) ^ coefficient;
      next[j + 1] = (next[j + 1] ?? 0) ^ mul(coefficient, EXP[i] ?? 0);
    }
    poly = next;
  }
  return poly;
}

/** The `degree` error-correction codewords of `data`. */
export function reedSolomon(data: ReadonlyArray<number>, degree: number): number[] {
  const gen = generator(degree);
  const remainder = new Array<number>(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ (remainder.shift() ?? 0);
    remainder.push(0);
    for (let j = 0; j < degree; j += 1) {
      remainder[j] = (remainder[j] ?? 0) ^ mul(gen[j + 1] ?? 0, factor);
    }
  }
  return remainder;
}

// --- Bit stream -----------------------------------------------------------------------

class Bits {
  readonly bits: number[] = [];

  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
  }
}

function encodeBytes(bytes: ReadonlyArray<number>): number[] {
  const index = QR_MAX_BYTES.findIndex((max) => bytes.length <= max);
  if (index === -1) {
    throw new Error(`QR payload of ${bytes.length} bytes exceeds ${QR_MAX_BYTES[QR_MAX_BYTES.length - 1]}`);
  }
  const spec = VERSIONS[index];
  if (spec === undefined) {
    throw new Error('no QR version');
  }
  const dataCodewords = spec.total - spec.ecPerBlock * spec.blocks;
  const stream = new Bits();
  stream.append(BYTE_MODE, 4);
  stream.append(bytes.length, 8);
  for (const byte of bytes) {
    stream.append(byte, 8);
  }
  const capacity = dataCodewords * 8;
  stream.append(0, Math.min(4, capacity - stream.bits.length));
  while (stream.bits.length % 8 !== 0) {
    stream.bits.push(0);
  }
  for (let i = 0; stream.bits.length < capacity; i += 1) {
    stream.append(PAD_BYTES[i % 2] ?? 0, 8);
  }
  const data: number[] = [];
  for (let i = 0; i < stream.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) {
      byte = (byte << 1) | (stream.bits[i + j] ?? 0);
    }
    data.push(byte);
  }

  // Split into equal blocks, compute each block's EC, then interleave both.
  const blockLength = dataCodewords / spec.blocks;
  const blocks = Array.from({ length: spec.blocks }, (_, b) => data.slice(b * blockLength, (b + 1) * blockLength));
  const ecs = blocks.map((block) => reedSolomon(block, spec.ecPerBlock));
  const out: number[] = [];
  for (let i = 0; i < blockLength; i += 1) {
    for (const block of blocks) {
      out.push(block[i] ?? 0);
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i += 1) {
    for (const ec of ecs) {
      out.push(ec[i] ?? 0);
    }
  }
  return out;
}

// --- Matrix ---------------------------------------------------------------------------

type Grid = boolean[][];

function makeGrid(size: number): Grid {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
}

/** Function patterns: finders, separators, timing, alignment, format areas, dark module. */
function drawFunctionPatterns(version: number, modules: Grid, isFunction: Grid): void {
  const size = modules.length;
  const set = (x: number, y: number, dark: boolean): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) {
      return;
    }
    const row = modules[y];
    const flags = isFunction[y];
    if (row !== undefined && flags !== undefined) {
      row[x] = dark;
      flags[x] = true;
    }
  };

  for (let i = 0; i < size; i += 1) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  const finder = (cx: number, cy: number): void => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const alignment = VERSIONS[version - 1]?.alignment ?? null;
  if (alignment !== null) {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        set(alignment + dx, alignment + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  // Format areas are reserved now and written after the mask is chosen.
  for (let i = 0; i <= 8; i += 1) {
    if (i === 6) {
      // The timing pattern crosses here and keeps its module.
      continue;
    }
    set(8, i, false);
    set(i, 8, false);
  }
  // The second copies are eight modules each: the dark module sits at the end of one.
  for (let i = 0; i <= 7; i += 1) {
    set(size - 1 - i, 8, false);
    set(8, size - 1 - i, false);
  }
  set(8, size - 8, true);
}

/** The 15 format bits for level M and `mask`, placed twice. */
function drawFormat(mask: number, modules: Grid): void {
  const size = modules.length;
  const data = (LEVEL_M_BITS << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ ((remainder >>> 9) * FORMAT_GENERATOR);
  }
  const bits = ((data << 10) | remainder) ^ FORMAT_MASK;
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1;
  const set = (x: number, y: number, dark: boolean): void => {
    const row = modules[y];
    if (row !== undefined) {
      row[x] = dark;
    }
  };

  for (let i = 0; i <= 5; i += 1) {
    set(8, i, bit(i));
  }
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) {
    set(14 - i, 8, bit(i));
  }
  for (let i = 0; i < 8; i += 1) {
    set(size - 1 - i, 8, bit(i));
  }
  for (let i = 8; i < 15; i += 1) {
    set(8, size - 15 + i, bit(i));
  }
  set(8, size - 8, true);
}

/** Codewords zigzag upward and downward in two-module columns, skipping column 6. */
function drawCodewords(codewords: ReadonlyArray<number>, modules: Grid, isFunction: Grid): void {
  const size = modules.length;
  let i = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }
    for (let vert = 0; vert < size; vert += 1) {
      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        const row = modules[y];
        const flags = isFunction[y];
        if (row === undefined || flags === undefined || flags[x] === true || i >= total) {
          continue;
        }
        const byte = codewords[i >>> 3] ?? 0;
        row[x] = ((byte >>> (7 - (i & 7))) & 1) === 1;
        i += 1;
      }
    }
  }
}

const MASKS: ReadonlyArray<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(mask: number, modules: Grid, isFunction: Grid): void {
  const fn = MASKS[mask];
  if (fn === undefined) {
    return;
  }
  for (let y = 0; y < modules.length; y += 1) {
    const row = modules[y];
    const flags = isFunction[y];
    if (row === undefined || flags === undefined) {
      continue;
    }
    for (let x = 0; x < row.length; x += 1) {
      if (flags[x] !== true && fn(x, y)) {
        row[x] = !row[x];
      }
    }
  }
}

/** The four penalty rules of the standard; lower is better. */
function penalty(modules: Grid): number {
  const size = modules.length;
  const at = (x: number, y: number): boolean => modules[y]?.[x] === true;
  let score = 0;

  const runs = (get: (a: number, b: number) => boolean): void => {
    for (let a = 0; a < size; a += 1) {
      let run = 1;
      let last = get(a, 0);
      for (let b = 1; b <= size; b += 1) {
        const current = b < size ? get(a, b) : !last;
        if (current === last && b < size) {
          run += 1;
          continue;
        }
        if (run >= 5) {
          score += 3 + (run - 5);
        }
        run = 1;
        last = current;
      }
    }
  };
  runs((a, b) => at(b, a));
  runs((a, b) => at(a, b));

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const c = at(x, y);
      if (c === at(x + 1, y) && c === at(x, y + 1) && c === at(x + 1, y + 1)) {
        score += 3;
      }
    }
  }

  const pattern = [true, false, true, true, true, false, true];
  const light4 = (get: (i: number) => boolean | null, from: number): boolean => {
    for (let i = from; i < from + 4; i += 1) {
      const v = get(i);
      if (v === null || v) {
        return false;
      }
    }
    return true;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const horizontal = (i: number): boolean | null => (x + i < 0 || x + i >= size ? null : at(x + i, y));
      const vertical = (i: number): boolean | null => (y + i < 0 || y + i >= size ? null : at(x, y + i));
      for (const get of [horizontal, vertical]) {
        if (pattern.every((dark, i) => get(i) === dark)) {
          if (light4(get, -4) || light4(get, 7)) {
            score += 40;
          }
        }
      }
    }
  }

  let dark = 0;
  for (const row of modules) {
    for (const cell of row) {
      if (cell) {
        dark += 1;
      }
    }
  }
  const percent = (dark * 100) / (size * size);
  score += 10 * Math.floor(Math.abs(percent - 50) / 5);
  return score;
}

/** UTF-8 bytes of `text`, without TextEncoder so the domain stays runtime-neutral. */
export function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/** The QR version (1–5) `text` needs, or null when it does not fit. */
export function qrVersionFor(text: string): number | null {
  const length = utf8Bytes(text).length;
  const index = QR_MAX_BYTES.findIndex((max) => length <= max);
  return index === -1 ? null : index + 1;
}

/**
 * Encodes `text` as a QR matrix: `true` is a dark module. Throws when the text is
 * longer than version 5 holds; callers keep invite links short on purpose.
 */
export function encodeQr(text: string): QrMatrix {
  const bytes = utf8Bytes(text);
  const version = qrVersionFor(text);
  if (version === null) {
    throw new Error('QR payload too long');
  }
  const size = version * 4 + 17;
  const codewords = encodeBytes(bytes);

  let best: Grid | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < MASKS.length; mask += 1) {
    const modules = makeGrid(size);
    const isFunction = makeGrid(size);
    drawFunctionPatterns(version, modules, isFunction);
    drawCodewords(codewords, modules, isFunction);
    applyMask(mask, modules, isFunction);
    drawFormat(mask, modules);
    const score = penalty(modules);
    if (score < bestScore) {
      best = modules;
      bestScore = score;
    }
  }
  if (best === null) {
    throw new Error('no QR mask');
  }
  return best;
}

/**
 * One SVG path drawing every dark module as a unit square, so a component renders
 * the whole code with a single `<Path>`.
 */
export function qrPath(matrix: QrMatrix): string {
  const parts: string[] = [];
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        parts.push(`M${x} ${y}h1v1h-1z`);
      }
    });
  });
  return parts.join('');
}
