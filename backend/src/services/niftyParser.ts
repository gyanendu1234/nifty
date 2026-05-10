import * as XLSX from 'xlsx';
import { ParsedNiftyRow } from '../types';
import { logger } from '../config/logger';

// ─────────────────────────────────────────────────────────────
// Column header detection patterns (case-insensitive)
// ─────────────────────────────────────────────────────────────
const COLUMN_PATTERNS: Record<string, RegExp> = {
  rank:        /sr\.?\s*no|^rank$|serial\s*no/i,
  companyName: /company\s*name|name\s*of\s*(the\s*)?company/i,
  isin:        /isin/i,
  nseSymbol:   /nse\s*(symbol|code)/i,
  bseSymbol:   /bse\s*(symbol|code)/i,
  marketCap:   /average\s*market|market\s*cap/i,
};

type ColMap = { [key in keyof typeof COLUMN_PATTERNS]?: number };

function detectColumns(headerRow: unknown[]): ColMap {
  const map: ColMap = {};
  headerRow.forEach((cell, idx) => {
    if (cell == null) return;
    const text = String(cell).trim();
    for (const [field, pattern] of Object.entries(COLUMN_PATTERNS)) {
      if (pattern.test(text)) {
        (map as Record<string, number>)[field] = idx;
      }
    }
  });
  return map;
}

function deriveCategory(rank: number): 'Large Cap' | 'Mid Cap' | 'Small Cap' {
  if (rank <= 100) return 'Large Cap';
  if (rank <= 250) return 'Mid Cap';
  return 'Small Cap';
}

function normaliseIsin(raw: string): string {
  return raw.trim().toUpperCase();
}

function parseNumericCell(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? undefined : n;
}

// ─────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────
export function parseNiftyExcel(fileBuffer: Buffer): ParsedNiftyRow[] {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('Excel file has no sheets');

  const sheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  }) as unknown[][];

  // ── Find the header row by looking for "ISIN" ──
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 20); i++) {
    const row = rawRows[i];
    if (row.some(cell => cell != null && /isin/i.test(String(cell)))) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    // Fallback: assume first row with more than 3 non-null cells is header
    for (let i = 0; i < rawRows.length; i++) {
      if (rawRows[i].filter(c => c != null).length >= 4) {
        headerRowIdx = i;
        break;
      }
    }
  }

  if (headerRowIdx === -1) throw new Error('Could not detect header row in Excel file');

  const colMap = detectColumns(rawRows[headerRowIdx] as unknown[]);
  logger.debug('Detected column map:', colMap);

  if (colMap.isin === undefined) {
    throw new Error('ISIN column not found in Excel file. Detected headers: ' +
      (rawRows[headerRowIdx] as unknown[]).filter(Boolean).join(', '));
  }

  const results: ParsedNiftyRow[] = [];
  let autoRank = 0;

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;

    const isinRaw = row[colMap.isin!];
    if (!isinRaw || String(isinRaw).trim() === '') continue;

    const isin = normaliseIsin(String(isinRaw));

    // ISIN format validation (Indian ISINs: IN + 10 alphanumeric chars)
    if (!/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)) continue;

    autoRank++;

    // Prefer explicit rank column; fall back to sequential autoRank
    let rank: number;
    if (colMap.rank !== undefined && row[colMap.rank] != null) {
      const r = parseNumericCell(row[colMap.rank]);
      rank = r ?? autoRank;
    } else {
      rank = autoRank;
    }

    const companyName =
      colMap.companyName !== undefined && row[colMap.companyName] != null
        ? String(row[colMap.companyName]).trim()
        : 'Unknown';

    const nseSymbol =
      colMap.nseSymbol !== undefined && row[colMap.nseSymbol] != null
        ? String(row[colMap.nseSymbol]).trim() || undefined
        : undefined;

    const bseSymbol =
      colMap.bseSymbol !== undefined && row[colMap.bseSymbol] != null
        ? String(row[colMap.bseSymbol]).trim() || undefined
        : undefined;

    const averageMarketCap =
      colMap.marketCap !== undefined ? parseNumericCell(row[colMap.marketCap]) : undefined;

    results.push({
      rank,
      companyName,
      isin,
      nseSymbol,
      bseSymbol,
      averageMarketCap,
      category: deriveCategory(rank),
    });
  }

  if (results.length === 0) {
    throw new Error('No valid rows parsed from Excel file. Check file format.');
  }

  logger.info(`Parsed ${results.length} rows from Excel`);
  return results;
}
