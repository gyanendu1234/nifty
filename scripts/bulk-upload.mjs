/**
 * Bulk upload all AMFI Excel files from the downloads folder.
 * Run: node scripts/bulk-upload.mjs
 * Requires: backend running on http://localhost:4000
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = join(__dirname, '..', 'downloads');
const API_URL = 'http://localhost:4000';
const ADMIN_TOKEN = '4bBhdcRvCpoJDyufBG6ZwwGLj5N4o8Pzw3avGBhy';

// All 12 periods oldest → newest (AMFI does not publish files before Jan-Jun 2020)
const PERIODS = [
  { file: 'AverageMarketCapitalization30Jun2020.xlsx', label: 'Jun 2020', end_date: '2020-06-30' },
  { file: 'AverageMarketCapitalization31Dec2020.xlsx', label: 'Dec 2020', end_date: '2020-12-31' },
  { file: 'AverageMarketCapitalization30Jun2021.xlsx', label: 'Jun 2021', end_date: '2021-06-30' },
  { file: 'AverageMarketCapitalization31Dec2021.xlsx', label: 'Dec 2021', end_date: '2021-12-31' },
  { file: 'AverageMarketCapitalization30Jun2022.xlsx', label: 'Jun 2022', end_date: '2022-06-30' },
  { file: 'AverageMarketCapitalization31Dec2022.xlsx', label: 'Dec 2022', end_date: '2022-12-31' },
  { file: 'AverageMarketCapitalization30Jun2023.xlsx', label: 'Jun 2023', end_date: '2023-06-30' },
  { file: 'AverageMarketCapitalization31Dec2023.xlsx', label: 'Dec 2023', end_date: '2023-12-31' },
  { file: 'AverageMarketCapitalization30Jun2024.xlsx', label: 'Jun 2024', end_date: '2024-06-30' },
  { file: 'AverageMarketCapitalization31Dec2024.xlsx', label: 'Dec 2024', end_date: '2024-12-31' },
  { file: 'AverageMarketCapitalization30Jun2025.xlsx', label: 'Jun 2025', end_date: '2025-06-30' },
  { file: 'AverageMarketCapitalization31Dec2025.xlsx', label: 'Dec 2025', end_date: '2025-12-31' },
];

async function uploadPeriod(period) {
  const filePath = join(DOWNLOADS_DIR, period.file);
  if (!existsSync(filePath)) {
    console.log(`  ⚠  SKIPPED (file not found): ${period.file}`);
    return false;
  }

  const fileBuffer = readFileSync(filePath);
  const form = new FormData();
  form.append('file', fileBuffer, { filename: period.file, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  form.append('period_label', period.label);
  form.append('period_end_date', period.end_date);

  const res = await fetch(`${API_URL}/api/admin/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    console.log(`  ✗  FAILED [${res.status}]: ${JSON.stringify(json)}`);
    return false;
  }

  const d = json.data;
  console.log(`  ✓  rows=${d.rows_parsed}  companies=${d.companies_upserted}  movements=${d.movements_inserted}  errors=${d.errors?.length ?? 0}`);
  return true;
}

async function getExistingPeriods() {
  const res = await fetch(`${API_URL}/api/admin/periods`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  const json = await res.json();
  // Map period_end_date → best status ('completed' > 'failed')
  const map = new Map();
  for (const p of (json.data ?? [])) {
    const existing = map.get(p.period_end_date);
    if (!existing || p.import_status === 'completed') {
      map.set(p.period_end_date, { id: p.id, status: p.import_status });
    }
  }
  return map;
}

async function deletePeriod(periodId) {
  await fetch(`${API_URL}/api/admin/periods/${periodId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
}

async function deleteFailedDuplicates() {
  const res = await fetch(`${API_URL}/api/admin/periods`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  });
  const json = await res.json();
  const failed = (json.data ?? []).filter(p => p.import_status === 'failed');
  if (failed.length > 0) {
    console.log(`Cleaning up ${failed.length} failed period records...`);
    for (const p of failed) {
      await deletePeriod(p.id);
      console.log(`  deleted ${p.period_label} (${p.id})`);
    }
    console.log('');
  }
}

async function main() {
  console.log('Nifty Bulk Upload — 12 periods (Jun 2020 → Dec 2025)\n');

  // Clean up failed periods so we can re-upload them
  await deleteFailedDuplicates();

  const existing = await getExistingPeriods();
  const completed = [...existing.entries()].filter(([, v]) => v.status === 'completed').map(([k]) => k);
  if (completed.length > 0) {
    console.log(`Already completed: ${completed.join(', ')}\n`);
  }

  for (const period of PERIODS) {
    const entry = existing.get(period.end_date);
    if (entry?.status === 'completed') {
      console.log(`[${period.label}] SKIPPED (already completed)`);
      continue;
    }
    process.stdout.write(`[${period.label}] uploading...`);
    try {
      const ok = await uploadPeriod(period);
      if (!ok) process.stdout.write('\n');
    } catch (err) {
      console.log(`\n  ✗  ERROR: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\nDone.');
}

main();
