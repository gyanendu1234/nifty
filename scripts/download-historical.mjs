/**
 * Download historical AMFI half-yearly average market capitalisation Excel files.
 *
 * AMFI publishes files going back to Jan-Jun 2020 on:
 *   https://www.amfiindia.com/otherdata/categorisation-of-stocks
 *
 * Files before 2020 are NOT publicly available on AMFI's website.
 *
 * Usage: node scripts/download-historical.mjs
 */

import fetch from 'node-fetch';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, '..', 'downloads');

// Map of local filename → actual AMFI URL
// The AMFI website uses inconsistent naming; we normalise to a consistent local filename.
const PERIODS = [
  {
    file: 'AverageMarketCapitalization30Jun2020.xlsx',
    url: 'https://www.amfiindia.com/Themes/Theme1/downloads/Average%20Market%20Capitalization%20of%20Listed%20Companies%20during%20Jan%20-%20Jun%202020_Final.xlsx',
    label: 'Jan-Jun 2020',
  },
  {
    file: 'AverageMarketCapitalization31Dec2020.xlsx',
    url: 'https://www.amfiindia.com/Themes/Theme1/downloads/Average%20Market%20Capitalization%20of%20Listed%20Companies%20during%20Jul%20-%20Dec%202020_Final.xlsx',
    label: 'Jul-Dec 2020',
  },
];

async function downloadFile({ file, url, label }) {
  const destPath = join(DOWNLOADS_DIR, file);

  if (existsSync(destPath)) {
    console.log(`  SKIPPED (already exists): ${file}`);
    return;
  }

  process.stdout.write(`  Downloading ${label} → ${file} ... `);

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.log(`FAILED (network error): ${err.message}`);
    return;
  }

  if (!res.ok) {
    console.log(`FAILED (HTTP ${res.status} ${res.statusText})`);
    console.log(`    URL tried: ${url}`);
    return;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buffer);
  console.log(`saved (${(buffer.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  mkdirSync(DOWNLOADS_DIR, { recursive: true });

  console.log('Downloading AMFI market cap files (2020)\n');
  console.log('Note: AMFI does not publicly publish files before Jan-Jun 2020.\n');

  for (const period of PERIODS) {
    await downloadFile(period);
  }

  console.log('\nDone. Run node scripts/bulk-upload.mjs next.');
}

main();
