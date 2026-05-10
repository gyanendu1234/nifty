/**
 * Recalculate movements for all completed periods in chronological order,
 * then recalculate all company summaries.
 *
 * Run this after uploading or re-uploading any Nifty periods to fix:
 *   - Dashboard "Exiting" counts stuck at 0
 *   - Movement flow counts (Small→Mid, Mid→Large, etc.) all 0
 *
 * Requires: backend running on http://localhost:4000
 * Usage:    node scripts/recalculate-movements.mjs
 */

import fetch from 'node-fetch';

const API_URL    = 'http://localhost:4000';
const ADMIN_TOKEN = '4bBhdcRvCpoJDyufBG6ZwwGLj5N4o8Pzw3avGBhy';

const headers = { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' };

async function getCompletedPeriods() {
  const res  = await fetch(`${API_URL}/api/admin/periods`, { headers });
  const json = await res.json();
  return (json.data ?? [])
    .filter(p => p.import_status === 'completed')
    .sort((a, b) => a.period_end_date.localeCompare(b.period_end_date));
}

async function recalcMovements(periodId, label) {
  const res  = await fetch(`${API_URL}/api/admin/recalculate-movements/${periodId}`, { method: 'POST', headers });
  const json = await res.json();
  if (!res.ok) {
    console.log(`  ✗  ${label}: FAILED [${res.status}] ${JSON.stringify(json)}`);
    return false;
  }
  const d = json.data;
  console.log(`  ✓  ${label}: inserted=${d.inserted}  errors=${d.errors?.length ?? 0}`);
  return true;
}

async function recalcSummaries() {
  console.log('\nRecalculating company summaries (all companies)...');
  const res  = await fetch(`${API_URL}/api/admin/recalculate-summaries`, { method: 'POST', headers });
  const json = await res.json();
  if (!res.ok) {
    console.log(`  ✗  FAILED [${res.status}] ${JSON.stringify(json)}`);
    return;
  }
  console.log(`  ✓  recalculated=${json.data?.recalculated ?? '?'} companies`);
}

async function main() {
  console.log('Recalculate Movements & Summaries\n');

  const periods = await getCompletedPeriods();
  if (periods.length === 0) {
    console.log('No completed periods found. Upload Nifty data first.');
    return;
  }

  console.log(`Found ${periods.length} completed periods (oldest → newest):`);
  for (const p of periods) console.log(`  ${p.period_label} (${p.period_end_date})`);
  console.log('');

  console.log('Recalculating movements...');
  // Skip the very first period — it has no predecessor; the endpoint handles it automatically.
  // We still call it so movements are consistent (all "entering" their first category).
  for (const period of periods) {
    await recalcMovements(period.id, period.period_label);
  }

  await recalcSummaries();

  console.log('\nDone. Dashboard exit/flow counts should now reflect real data.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
