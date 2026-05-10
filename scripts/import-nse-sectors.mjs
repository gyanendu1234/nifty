/**
 * Import sector/industry classification from NSE's public equity master CSV.
 *
 * NSE publishes EQUITY_L.csv at:
 *   https://archives.nseindia.com/content/equities/EQUITY_L.csv
 *
 * Download it manually and save it as downloads/EQUITY_L.csv, then run:
 *   node scripts/import-nse-sectors.mjs
 *
 * The file has columns (no header quoting issues):
 *   SYMBOL, NAME OF COMPANY, SERIES, DATE OF LISTING,
 *   PAID UP VALUE, MARKET LOT, ISIN NUMBER, FACE VALUE, INDUSTRY
 *
 * We match by ISIN NUMBER → update companies.sector_primary with INDUSTRY.
 *
 * Requires: backend running on http://localhost:4000
 */

import { createReadStream, existsSync } from 'fs';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH   = join(__dirname, '..', 'downloads', 'EQUITY_L.csv');
const API_URL    = 'http://localhost:4000';
const ADMIN_TOKEN = '4bBhdcRvCpoJDyufBG6ZwwGLj5N4o8Pzw3avGBhy';

const headers = { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' };

// ── Parse the NSE CSV ──
async function parseNseEquityList(csvPath) {
  const isinToSector = new Map();

  const rl = createInterface({
    input: createReadStream(csvPath, 'utf8'),
    crlfDelay: Infinity,
  });

  let isFirst = true;
  let isinIdx = -1;
  let industryIdx = -1;
  let symbolIdx = -1;

  for await (const line of rl) {
    const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));

    if (isFirst) {
      isFirst = false;
      // Locate columns by header name (case-insensitive)
      const upper = cols.map(c => c.toUpperCase());
      isinIdx     = upper.findIndex(c => c.includes('ISIN'));
      industryIdx = upper.findIndex(c => c.includes('INDUSTRY'));
      symbolIdx   = upper.findIndex(c => c === 'SYMBOL');

      if (isinIdx === -1 || industryIdx === -1) {
        throw new Error(`Could not find ISIN or INDUSTRY columns. Headers: ${cols.join(' | ')}`);
      }
      console.log(`CSV columns: SYMBOL[${symbolIdx}], ISIN[${isinIdx}], INDUSTRY[${industryIdx}]`);
      continue;
    }

    const isin     = cols[isinIdx]?.trim();
    const industry = cols[industryIdx]?.trim();

    if (isin && industry && industry !== '-' && industry !== '') {
      isinToSector.set(isin, industry);
    }
  }

  return isinToSector;
}

// ── Fetch all companies from backend ──
async function fetchCompanies() {
  const res  = await fetch(`${API_URL}/api/admin/companies?limit=10000`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch companies: ${res.status}`);
  const json = await res.json();
  return json.data ?? [];
}

// ── Update a single company's sector via PATCH ──
async function patchSector(companyId, sector) {
  const res = await fetch(`${API_URL}/api/admin/companies/${companyId}/sector`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sector_primary: sector }),
  });
  return res.ok;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`\nFile not found: ${CSV_PATH}`);
    console.error('Download it from:');
    console.error('  https://archives.nseindia.com/content/equities/EQUITY_L.csv');
    console.error('Save it to: downloads/EQUITY_L.csv\n');
    process.exit(1);
  }

  console.log('NSE Sector Importer\n');
  console.log(`Parsing ${CSV_PATH}...`);
  const isinToSector = await parseNseEquityList(CSV_PATH);
  console.log(`  Found ${isinToSector.size} ISIN → sector mappings\n`);

  console.log('Fetching companies from backend...');
  const companies = await fetchCompanies();
  console.log(`  Found ${companies.length} companies\n`);

  let matched = 0;
  let updated = 0;
  let skipped = 0;
  let failed  = 0;

  for (const company of companies) {
    const sector = isinToSector.get(company.isin);
    if (!sector) { skipped++; continue; }

    matched++;
    const ok = await patchSector(company.id, sector);
    if (ok) updated++;
    else { failed++; console.log(`  ✗ Failed: ${company.isin} (${company.company_name})`); }
  }

  console.log('─'.repeat(50));
  console.log(`Matched : ${matched}`);
  console.log(`Updated : ${updated}`);
  console.log(`No match: ${skipped} (companies not in NSE list)`);
  console.log(`Failed  : ${failed}`);
  console.log('\nDone. Restart backend for sector trends to populate.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
