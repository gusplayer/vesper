import { describe, expect, it } from 'vitest';

import { stripJpegMetadata } from './jpegMetadata';

// JPEGs built by hand, segment by segment, so each test knows exactly which bytes are
// metadata and which are the image. None of them decodes to a picture; the walk only
// reads markers and lengths, which is all these have to get right.

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

/** A marker segment: FF, marker, length (counting itself), payload. */
function segment(marker: number, payload: readonly number[]): number[] {
  return [0xff, marker, ...u16(payload.length + 2), ...payload];
}

function bytesOf(...parts: readonly (readonly number[])[]): Uint8Array {
  return new Uint8Array(parts.flat());
}

function contains(haystack: Uint8Array, needle: readonly number[]): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

// Bogotá, 4° 36' N 74° 4' W, as the GPS IFD writes it: three RATIONALs per coordinate.
const LATITUDE = [...u32(4), ...u32(1), ...u32(36), ...u32(1), ...u32(0), ...u32(1)];
const LONGITUDE = [...u32(74), ...u32(1), ...u32(4), ...u32(1), ...u32(0), ...u32(1)];

/**
 * APP1 "Exif": a big-endian TIFF with IFD0 holding one entry, GPSInfo (0x8825), that
 * points to a GPS IFD with the latitude and longitude above.
 */
function exifWithGps(): number[] {
  const ifd0Offset = 8;
  const ifd0Size = 2 + 12 + 4;
  const gpsOffset = ifd0Offset + ifd0Size;
  const gpsEntries = 4;
  const gpsSize = 2 + gpsEntries * 12 + 4;
  const latitudeOffset = gpsOffset + gpsSize;
  const longitudeOffset = latitudeOffset + LATITUDE.length;
  const tiff = [
    ...ascii('MM'),
    ...u16(42),
    ...u32(ifd0Offset),
    // IFD0: one entry, GPSInfo → LONG pointing at the GPS IFD.
    ...u16(1),
    ...u16(0x8825),
    ...u16(4),
    ...u32(1),
    ...u32(gpsOffset),
    ...u32(0),
    // GPS IFD.
    ...u16(gpsEntries),
    ...u16(0x0001), // GPSLatitudeRef, ASCII "N"
    ...u16(2),
    ...u32(2),
    ...ascii('N'),
    0,
    0,
    0,
    ...u16(0x0002), // GPSLatitude, 3 RATIONAL
    ...u16(5),
    ...u32(3),
    ...u32(latitudeOffset),
    ...u16(0x0003), // GPSLongitudeRef, ASCII "W"
    ...u16(2),
    ...u32(2),
    ...ascii('W'),
    0,
    0,
    0,
    ...u16(0x0004), // GPSLongitude, 3 RATIONAL
    ...u16(5),
    ...u32(3),
    ...u32(longitudeOffset),
    ...u32(0),
    ...LATITUDE,
    ...LONGITUDE,
  ];
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

const XMP_NAMESPACE = 'http://ns.adobe.com/xap/1.0/';

function xmp(): number[] {
  const packet = '<x:xmpmeta><rdf:Description exif:GPSLatitude="4,36.0N" exif:GPSLongitude="74,4.0W"/></x:xmpmeta>';
  return segment(0xe1, [...ascii(XMP_NAMESPACE), 0, ...ascii(packet)]);
}

function iptc(): number[] {
  // Photoshop 3.0 → 8BIM resource 0x0404 (IPTC-NAA) → record 2, dataset 90 (City).
  const record = [0x1c, 0x02, 0x5a, ...u16(6), ...ascii('Bogota')];
  return segment(0xed, [...ascii('Photoshop 3.0'), 0, ...ascii('8BIM'), ...u16(0x0404), 0, 0, ...u32(record.length), ...record]);
}

function comment(): number[] {
  return segment(0xfe, ascii('taken at home'));
}

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];
const APP0 = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, ...u16(1), ...u16(1), 0, 0]);
const APP2 = segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1, ...ascii('not a real profile')]);
const APP14 = segment(0xee, [...ascii('Adobe'), ...u16(100), ...u16(0), ...u16(0), 1]);
const DQT = segment(0xdb, [0x00, ...Array.from({ length: 64 }, (_, i) => (i % 32) + 1)]);
const SOF0 = segment(0xc0, [8, ...u16(2), ...u16(3), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const DHT = segment(0xc4, [0x00, 0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
/**
 * The scan header and entropy-coded data, with a stuffed FF 00, a restart marker and
 * bytes that would read as APP1 and COM if the walk did not stop at SOS.
 */
const SCAN = [
  ...segment(0xda, [3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0]),
  0x12,
  0xff,
  0x00,
  0x34,
  0xff,
  0xd0,
  0xe1,
  0x56,
  0xfe,
  0x78,
];

/** SOI, APP0, APP2, APP14, DQT, SOF0, DHT, then the scan and EOI: what must survive. */
function clean(): Uint8Array {
  return bytesOf(SOI, APP0, APP2, APP14, DQT, SOF0, DHT, SCAN, EOI);
}

/** The same image with every kind of metadata the stripper removes, in between. */
function withMetadata(): Uint8Array {
  return bytesOf(SOI, APP0, exifWithGps(), xmp(), APP2, iptc(), APP14, comment(), DQT, SOF0, DHT, SCAN, EOI);
}

describe('stripJpegMetadata', () => {
  it('leaves the image exactly as it was: SOI, APP0, ICC, APP14, tables, frame, scan and EOI', () => {
    expect(Array.from(stripJpegMetadata(withMetadata()))).toEqual(Array.from(clean()));
  });

  it('takes out Exif and its GPS, byte for byte', () => {
    const input = withMetadata();
    expect(contains(input, ascii('Exif'))).toBe(true);
    expect(contains(input, LATITUDE)).toBe(true);

    const output = stripJpegMetadata(input);

    expect(contains(output, ascii('Exif'))).toBe(false);
    expect(contains(output, LATITUDE)).toBe(false);
    expect(contains(output, LONGITUDE)).toBe(false);
    expect(contains(output, [...u16(0x8825), ...u16(4)])).toBe(false);
  });

  it('takes out XMP, IPTC and comments', () => {
    const output = stripJpegMetadata(withMetadata());

    expect(contains(output, ascii(XMP_NAMESPACE))).toBe(false);
    expect(contains(output, ascii('GPSLatitude'))).toBe(false);
    expect(contains(output, ascii('Photoshop 3.0'))).toBe(false);
    expect(contains(output, ascii('Bogota'))).toBe(false);
    expect(contains(output, ascii('taken at home'))).toBe(false);
  });

  it('keeps the ICC profile, so colors do not shift', () => {
    expect(contains(stripJpegMetadata(withMetadata()), ascii('ICC_PROFILE'))).toBe(true);
  });

  it('is idempotent', () => {
    const once = stripJpegMetadata(withMetadata());

    expect(Array.from(stripJpegMetadata(once))).toEqual(Array.from(once));
  });

  it('returns a new array with the same bytes when there is nothing to strip', () => {
    const input = clean();
    const output = stripJpegMetadata(input);

    expect(output).not.toBe(input);
    expect(Array.from(output)).toEqual(Array.from(input));
  });

  it('copies everything from SOS on, even bytes that look like markers', () => {
    const output = stripJpegMetadata(withMetadata());
    const scanAt = output.length - SCAN.length - EOI.length;

    expect(Array.from(output.subarray(scanAt))).toEqual([...SCAN, ...EOI]);
  });

  it('skips fill bytes before a marker', () => {
    const input = bytesOf(SOI, [0xff, 0xff], exifWithGps(), [0xff], APP0, DQT, SOF0, DHT, SCAN, EOI);

    expect(Array.from(stripJpegMetadata(input))).toEqual(Array.from(bytesOf(SOI, APP0, DQT, SOF0, DHT, SCAN, EOI)));
  });

  describe('gives the input back, untouched and by reference, when it cannot walk it', () => {
    const cases: [string, Uint8Array][] = [
      ['empty', new Uint8Array(0)],
      ['a PNG', bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], [0, 0, 0, 0])],
      ['only SOI', bytesOf(SOI)],
      ['a segment longer than the file', bytesOf(SOI, APP0.slice(0, 8))],
      ['a length under 2', bytesOf(SOI, [0xff, 0xe1, 0x00, 0x01], SCAN, EOI)],
      ['a length cut in half', bytesOf(SOI, [0xff, 0xe1, 0x00])],
      ['garbage between segments', bytesOf(SOI, APP0, [0x12, 0x34], SCAN, EOI)],
      ['no scan at all', bytesOf(SOI, APP0, exifWithGps(), DQT, SOF0)],
      ['an EOI before the scan', bytesOf(SOI, exifWithGps(), EOI, SCAN, EOI)],
      ['a second SOI', bytesOf(SOI, SOI, exifWithGps(), SCAN, EOI)],
      ['a file that ends in fill bytes', bytesOf(SOI, APP0, [0xff, 0xff])],
    ];

    it.each(cases)('%s', (_, input) => {
      expect(stripJpegMetadata(input)).toBe(input);
    });
  });

  it('never throws on noise', () => {
    // A small deterministic generator, so a failure is reproducible.
    let seed = 0x2545f491;
    const next = (): number => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    };
    for (let round = 0; round < 500; round += 1) {
      const size = next() % 200;
      const noise = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) {
        noise[i] = next() & 0xff;
      }
      // Half of them start like a JPEG, so the walk goes past the first check.
      if (round % 2 === 0 && size >= 2) {
        noise[0] = 0xff;
        noise[1] = 0xd8;
      }
      expect(() => stripJpegMetadata(noise)).not.toThrow();
    }
  });
});
