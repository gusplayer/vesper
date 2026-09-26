/**
 * Takes the metadata out of a JPEG before it is kept (ADR-0051 §15).
 *
 * Re-encoding through the image manipulator already drops most of it, and "most" is not
 * enough: a photo from the library can carry where it was taken. This walks the marker
 * segments that come before the image data and leaves out the ones that hold metadata:
 *
 * - APP1: Exif (with its GPS IFD) and XMP, the standard and the extended one.
 * - APP13: IPTC, inside Photoshop's "Photoshop 3.0" block.
 * - COM: free text a camera or an editor may leave.
 *
 * Everything else stays byte for byte: APP0 (JFIF), APP2 (the ICC profile, without which
 * colors shift), APP14 (Adobe's color transform), the tables and the frame header. From
 * the first SOS on, the rest is copied as it is: that is the image itself.
 *
 * Pure and total: no imports, never throws. A JPEG it cannot walk comes back as the very
 * same array (the same reference), so a caller that must not keep metadata can tell
 * "nothing to strip" (a new array) from "could not read it" (the input) and refuse.
 */

const MARKER = 0xff;
const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const TEM = 0x01;
const RST0 = 0xd0;
const RST7 = 0xd7;

/** The segments that carry metadata and never the image. */
const DROPPED = new Set([
  0xe1, // APP1: Exif, XMP
  0xed, // APP13: IPTC (Photoshop 3.0)
  0xfe, // COM
]);

/** Markers with no length after them. */
function isStandalone(marker: number): boolean {
  return marker === TEM || (marker >= RST0 && marker <= RST7);
}

export function stripJpegMetadata(bytes: Uint8Array): Uint8Array {
  try {
    return strip(bytes) ?? bytes;
  } catch {
    return bytes;
  }
}

/** The stripped copy, or null when the input is not a JPEG this can walk to its SOS. */
function strip(bytes: Uint8Array): Uint8Array | null {
  const length = bytes.length;
  // -1 past the end, which no comparison below mistakes for a marker byte.
  const at = (index: number): number => bytes[index] ?? -1;
  if (length < 4 || at(0) !== MARKER || at(1) !== SOI) {
    return null;
  }

  // [start, end) ranges of the input that the output keeps, in order.
  const kept: [number, number][] = [[0, 2]];
  let position = 2;

  while (position < length) {
    if (at(position) !== MARKER) {
      return null;
    }
    // A marker may be preceded by any number of 0xFF fill bytes.
    let markerAt = position;
    while (markerAt + 1 < length && at(markerAt + 1) === MARKER) {
      markerAt += 1;
    }
    if (markerAt + 1 >= length) {
      return null;
    }
    const marker = at(markerAt + 1);

    if (marker === SOS) {
      kept.push([markerAt, length]);
      return concat(bytes, kept);
    }
    if (marker === SOI || marker === EOI || marker === 0x00) {
      // A second start, an end before any image data, or a stuffed zero out here:
      // not a JPEG this can vouch for.
      return null;
    }
    if (isStandalone(marker)) {
      kept.push([markerAt, markerAt + 2]);
      position = markerAt + 2;
      continue;
    }

    if (markerAt + 4 > length) {
      return null;
    }
    // The length counts its own two bytes and not the marker's.
    const segmentLength = (at(markerAt + 2) << 8) | at(markerAt + 3);
    const end = markerAt + 2 + segmentLength;
    if (segmentLength < 2 || end > length) {
      return null;
    }
    if (!DROPPED.has(marker)) {
      kept.push([markerAt, end]);
    }
    position = end;
  }

  // Ran out of bytes before the image data started.
  return null;
}

function concat(bytes: Uint8Array, ranges: readonly [number, number][]): Uint8Array {
  let size = 0;
  for (const [start, end] of ranges) {
    size += end - start;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const [start, end] of ranges) {
    out.set(bytes.subarray(start, end), offset);
    offset += end - start;
  }
  return out;
}
