export type CapCategory = 'Large Cap' | 'Mid Cap' | 'Small Cap';

export type MovementDirection = 'up' | 'down' | 'stable' | 'volatile';

export interface Company {
  id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  bse_symbol: string | null;
  sector_primary: string | null;
  industry: string | null;
  company_sector_tags?: { sector_tag: string }[];
  company_ladder_summary?: CompanyLadderSummary[];
  created_at: string;
  updated_at: string;
}

export interface NiftyPeriod {
  id: string;
  period_label: string;
  period_end_date: string;
  period_type: string;
  source_name: string;
  source_file_name: string | null;
  import_status: 'uploaded' | 'processing' | 'completed' | 'failed';
  import_error?: string | null;
  uploaded_at: string;
  snapshot_count?: number;
}

export interface NiftySnapshot {
  id: string;
  company_id: string | null;
  period_id: string;
  isin: string;
  company_name_raw: string | null;
  nse_symbol: string | null;
  bse_symbol: string | null;
  market_cap_rank: number | null;
  average_market_cap: number | null;
  category: CapCategory | null;
}

export interface LadderMovement {
  id: string;
  company_id: string | null;
  from_period_id: string | null;
  to_period_id: string | null;
  from_category: string | null;
  to_category: string | null;
  from_rank: number | null;
  to_rank: number | null;
  rank_change: number | null;
  movement_direction: MovementDirection | null;
  movement_type: string | null;
  is_category_entry: boolean;
  entered_category: string | null;
  is_category_exit: boolean;
  exited_category: string | null;
  companies?: {
    company_name: string | null;
    isin: string;
    nse_symbol: string | null;
    bse_symbol: string | null;
    sector_primary: string | null;
  };
  from_period?: { period_label: string };
  to_period?: { period_label: string };
  company_ladder_summary?: { trend_label: string | null; stability_status: string | null }[];
}

export interface CompanyLadderSummary {
  id: string;
  company_id: string | null;
  start_period_id: string | null;
  end_period_id: string | null;
  start_category: string | null;
  end_category: string | null;
  movement_path: string | null;
  small_to_mid_months: number | null;
  mid_to_large_months: number | null;
  large_to_mid_months: number | null;
  mid_to_small_months: number | null;
  total_rank_improvement: number;
  total_rank_decline: number;
  periods_improved: number;
  periods_declined: number;
  periods_stable: number;
  stability_status: string | null;
  trend_label: string | null;
  ladder_score: number | null;
}

export interface LadderTableRow {
  company_id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  bse_symbol: string | null;
  sector_primary: string | null;
  sector_tags: string[];
  current_category: CapCategory | null;
  current_rank: number | null;
  average_market_cap?: number | null;
  start_category: string | null;
  movement_path: string | null;
  movement_type: string | null;
  rank_change: number | null;
  is_category_entry: boolean;
  entered_category: string | null;
  is_category_exit: boolean;
  exited_category: string | null;
  stability_status: string | null;
  trend_label: string | null;
  ladder_score: number | null;
}

export interface DashboardSummary {
  total_companies: number;
  large_cap_count: number;
  mid_cap_count: number;
  small_cap_count: number;
  entering_large_cap: number;
  exiting_large_cap: number;
  entering_mid_cap: number;
  exiting_mid_cap: number;
  entering_small_cap: number;
  exiting_small_cap: number;
  small_to_mid: number;
  mid_to_large: number;
  large_to_mid: number;
  mid_to_small: number;
  near_large_cap_upgrade: number;
  near_large_cap_downgrade: number;
  near_mid_cap_upgrade: number;
  near_mid_cap_downgrade: number;
  latest_period_label: string;
  latest_period_date: string;
}

export interface TimelineRow {
  period_label: string;
  period_end_date: string;
  category: CapCategory;
  market_cap_rank: number;
  average_market_cap: number | null;
}

export interface SectorSummary {
  sector_primary: string;
  large_cap_count: number;
  mid_cap_count: number;
  small_cap_count: number;
  total_companies: number;
  entering_large: number;
  entering_mid: number;
  exiting_large: number;
  exiting_mid: number;
  moving_up: number;
  moving_down: number;
}

export interface LadderFilters {
  period_id?: string;
  from_period_id?: string;
  to_period_id?: string;
  category?: string;
  movement_type?: string;
  stability_status?: string;
  trend_label?: string;
  sector?: string;
  is_category_entry?: boolean;
  entered_category?: string;
  is_category_exit?: boolean;
  exited_category?: string;
  near_boundary?: string;
  rank_min?: number;
  rank_max?: number;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    limit?: number;
    offset?: number;
    period?: string;
  };
  error?: string;
}

export interface CompanyDetail extends Company {
  timeline: TimelineRow[];
  movements: LadderMovement[];
  similar_companies: {
    company_id: string;
    company_name: string | null;
    isin: string;
    nse_symbol: string | null;
    market_cap_rank: number | null;
    category: CapCategory | null;
  }[];
}

// ── Multi-period comparison types ──

export interface ComparePeriod {
  id: string;
  label: string;
  date: string;
}

export interface CompareRankEntry {
  rank: number | null;
  category: string | null;
}

export interface CompareRow {
  company_id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  sector_primary: string | null;
  trend_label: string | null;
  ladder_score: number | null;
  movement_path: string | null;
  periods_improved: number;
  periods_declined: number;
  ranks: Record<string, CompareRankEntry>;   // keyed by period_id
  rank_start: number | null;
  rank_end: number | null;
  rank_delta: number | null;                 // positive = improved
}

export interface CompareResponse {
  data: CompareRow[];
  periods: ComparePeriod[];
  meta: { total: number; limit: number; offset: number };
}

// ── Rank Trends (unified rank-progression view) ──

export interface TrendPeriod {
  id:    string;
  label: string;
  date:  string;
}

export interface TrendRow {
  company_id:       string;
  company_name:     string | null;
  isin:             string;
  nse_symbol:       string | null;
  sector_primary:   string | null;
  current_category: string | null;
  start_rank:       number | null;
  latest_rank:      number | null;
  net_rank_change:  number | null;
  periods_improved: number;
  periods_declined: number;
  periods_stable:   number;
  ranks:            Record<string, { rank: number | null; category: string | null }>;
}

export interface TrendResponse {
  data:    TrendRow[];
  periods: TrendPeriod[];
  meta: {
    total:    number;
    improved: number;
    declined: number;
    stable:   number;
    limit:    number;
    offset:   number;
  };
}

// ── Rising/Falling stars types ──

// ── NSE Live Data ──

export interface NseStockMeta {
  symbol:      string;
  companyName: string;
  industry:    string;
  isin:        string;
  isFNOSec?:   boolean;
  isETFSec?:   boolean;
  isDelisted?: boolean;
}

export interface NseStock {
  priority:           number;
  symbol:             string;
  identifier:         string;
  series:             string;
  open:               number;
  dayHigh:            number;
  dayLow:             number;
  lastPrice:          number;
  previousClose:      number;
  change:             number;
  pChange:            number;
  totalTradedVolume:  number;
  totalTradedValue?:  number;
  yearHigh:           number;
  yearLow:            number;
  nearWKH:            number;
  nearWKL:            number;
  perChange365d:      number;
  date365dAgo:        string;
  perChange30d:       number;
  date30dAgo:         string;
  chartTodayPath?:    string;
  chart30dPath?:      string;
  chart365dPath?:     string;
  meta:               NseStockMeta;
}

export interface NseIndexMetadata {
  indexName:     string;
  open:          number;
  high:          number;
  low:           number;
  previousClose: number;
  last:          number;
  percChange:    number;
  change:        number;
  breadth: {
    declines:  string;
    advances:  string;
    unchanged: string;
  };
}

export interface NseMarketStatus {
  market:              string;
  marketStatus:        string;
  tradeDate:           string;
  index:               string;
  last:                number;
  variation:           number;
  percentChange:       number;
  marketStatusMessage: string;
}

export interface NseIndexData {
  name:      string;
  timestamp: string;
  advance: { declines: string; advances: string; unchanged: string };
  data:      NseStock[];
  metadata:  NseIndexMetadata;
  marketStatus: NseMarketStatus;
}

export interface NseLiveResponse {
  data:          NseIndexData;
  cached_at:     string;
  stale?:        boolean;
  stale_reason?: string;
}

export interface StarRow {
  company_id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  sector_primary: string | null;
  trend_label: string | null;
  ladder_score: number | null;
  movement_path: string | null;
  periods_improved: number;
  periods_declined: number;
  periods_stable: number;
  start_category: string | null;
  end_category: string | null;
  total_rank_improvement: number;
  total_rank_decline: number;
  current_rank: number | null;
  current_category: string | null;
}
