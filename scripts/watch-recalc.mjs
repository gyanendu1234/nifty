/**
 * Live progress monitor for /api/admin/recalculate-summaries.
 * Polls Supabase counts every 10s and emits a single progress line per tick.
 *
 * Outputs lines like:
 *   [HH:MM:SS] 1234 / 5372  (23.0%)  +178 since last tick  ETA ~3.4 min
 *
 * Stops automatically when count stabilises (no change for 3 ticks) or matches total.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path  from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function ts() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function bar(pct, width = 24) {
  const filled = Math.round((pct / 100) * width);
  return '[' + '█'.repeat(filled) + '░'.repeat(width - filled) + ']';
}

async function getCount(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return null;
  return count;
}

async function getPopulatedCount() {
  const { count, error } = await supabase
    .from('company_ladder_summary')
    .select('*', { count: 'exact', head: true })
    .not('trend_label', 'is', null);
  if (error) return null;
  return count;
}

const total = await getCount('companies');
if (total === null) {
  console.log(`[${ts()}] ERROR: cannot read companies count`);
  process.exit(1);
}

let prev = 0;
let started = Date.now();
let stableTicks = 0;

console.log(`[${ts()}] Watching recalc — total companies: ${total}`);

while (true) {
  const populated = await getPopulatedCount();
  if (populated === null) {
    console.log(`[${ts()}] ERROR: cannot read summary count`);
    break;
  }

  const delta = populated - prev;
  const pct   = total > 0 ? (populated / total) * 100 : 0;
  const elapsed = (Date.now() - started) / 1000;
  const rate    = populated / Math.max(elapsed, 1);
  const remain  = total - populated;
  const etaSec  = rate > 0 ? remain / rate : 0;
  const etaStr  = etaSec > 60 ? `${(etaSec / 60).toFixed(1)} min` : `${Math.round(etaSec)}s`;

  console.log(
    `[${ts()}] ${bar(pct)} ${populated.toString().padStart(5)} / ${total}  ` +
    `(${pct.toFixed(1).padStart(4)}%)  +${delta.toString().padStart(4)} this tick  ETA ~${etaStr}`,
  );

  if (populated >= total) {
    console.log(`[${ts()}] DONE — all ${total} companies have summaries`);
    break;
  }

  if (delta === 0) {
    stableTicks++;
    if (stableTicks >= 3) {
      console.log(`[${ts()}] STALLED — no change for 3 ticks. Final count: ${populated} / ${total}`);
      break;
    }
  } else {
    stableTicks = 0;
  }

  prev = populated;
  await new Promise(r => setTimeout(r, 10000));
}
