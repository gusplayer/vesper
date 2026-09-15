/**
 * Renders artworks to SVG and PNG so they can be looked at before they ship.
 *
 *   npx tsx scripts/artPreview.ts <outDir>                 every work in the gallery
 *   npx tsx scripts/artPreview.ts <outDir> <id>            one work of the gallery
 *   npx tsx scripts/artPreview.ts <outDir> --file <path>   every Artwork exported by a file
 *
 *   - <id>.svg: every dot, ink on the session's dark background
 *   - <id>.svg.png: rasterized with qlmanage (macOS)
 *   - <id>-25.svg / -50 / -75: the same drawing at a quarter, half, three quarters
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolve } from 'node:path';

import { GALLERY, dotBudget } from '../src/domain/art/gallery';
import { dotsPath, stipple } from '../src/domain/art/stipple';
import type { Artwork } from '../src/domain/art/types';

const SIZE = 800;
const outDir = process.argv[2] ?? 'scratch/art';
const only = process.argv[3] === '--file' ? undefined : process.argv[3];
const file = process.argv[3] === '--file' ? process.argv[4] : undefined;
mkdirSync(outDir, { recursive: true });

function isArtwork(value: unknown): value is Artwork {
  return typeof value === 'object' && value !== null && 'strokes' in value && 'id' in value;
}

async function works(): Promise<ReadonlyArray<Artwork>> {
  if (file === undefined) {
    return GALLERY;
  }
  const module = (await import(resolve(file))) as Record<string, unknown>;
  return Object.values(module).filter(isArtwork);
}

function svg(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}"><rect width="${SIZE}" height="${SIZE}" fill="#191919"/><path fill="#F2F1EE" d="${path}"/></svg>`;
}

for (const artwork of await works()) {
  if (only !== undefined && artwork.id !== only) {
    continue;
  }
  const dots = stipple(artwork, dotBudget(25 * 60_000), 1);
  const stages: Array<[string, number]> = [
    ['', dots.length],
    ['-25', Math.floor(dots.length * 0.25)],
    ['-50', Math.floor(dots.length * 0.5)],
    ['-75', Math.floor(dots.length * 0.75)],
  ];
  for (const [suffix, visible] of stages) {
    const file = join(outDir, `${artwork.id}${suffix}.svg`);
    writeFileSync(file, svg(dotsPath(dots, visible, SIZE)));
    try {
      execSync(`qlmanage -t -s ${SIZE} -o "${outDir}" "${file}"`, { stdio: 'ignore' });
    } catch {
      // Not macOS: the SVG is still there.
    }
  }
  console.log(`${artwork.id}: ${dots.length} dots → ${outDir}/${artwork.id}.svg.png`);
}
