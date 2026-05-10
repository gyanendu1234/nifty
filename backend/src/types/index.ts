export interface Company {
  id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  bse_symbol: string | null;
  sector_primary: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySectorTag {
  id: string;
  company_id: string;
  sector_tag: string;
  created_at: string;
}

export interface NiftyPeriod {
  id: string;
  period_label: string;
  period_end_date: string;
  period_type: string;
  source_name: string;
  source_file_name: string | null;
  source_file_path: string | null;
  uploaded_at: string;
  import_status: 'uploaded' | 'processing' | 'completed' | 'failed';
  import_error: string | null;
  notes: string | null;
  created_at: string;
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
  category: 'Large Cap' | 'Mid Cap' | 'Small Cap' | null;
  created_at: string;
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
  movement_direction: 'up' | 'down' | 'stable' | 'volatile' | null;
  movement_type: string | null;
  is_category_entry: boolean;
  entered_category: string | null;
  is_category_exit: boolean;
  exited_category: string | null;
  created_at: string;
}

export interface CompanyLadderSummary {
  id: string;
  company_id: string | null;
  start_period_id: string | null;
  end_period_id: string | null;
  start_category: string | null;
  end_category: string | null;
  movement_path: string | null;
  first_midcap_period_id: string | null;
  first_largecap_period_id: string | null;
  first_smallcap_period_id: string | null;
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
  created_at: string;
  updated_at: string;
}

export interface ParsedNiftyRow {
  rank: number;
  companyName: string;
  isin: string;
  nseSymbol?: string;
  bseSymbol?: string;
  averageMarketCap?: number;
  category: 'Large Cap' | 'Mid Cap' | 'Small Cap';
}

export interface MovementResult {
  company_id: string;
  from_period_id: string;
  to_period_id: string;
  from_category: string | null;
  to_category: string;
  from_rank: number | null;
  to_rank: number;
  rank_change: number | null;
  movement_direction: 'up' | 'down' | 'stable';
  movement_type: string;
  is_category_entry: boolean;
  entered_category: string | null;
  is_category_exit: boolean;
  exited_category: string | null;
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

export interface LadderTableRow {
  company_id: string;
  company_name: string | null;
  isin: string;
  nse_symbol: string | null;
  bse_symbol: string | null;
  sector_primary: string | null;
  sector_tags: string[];
  current_category: string | null;
  current_rank: number | null;
  start_category: string | null;
  start_rank: number | null;
  rank_change: number | null;
  movement_path: string | null;
  movement_type: string | null;
  is_category_entry: boolean;
  entered_category: string | null;
  is_category_exit: boolean;
  exited_category: string | null;
  first_midcap_period: string | null;
  first_largecap_period: string | null;
  stability_status: string | null;
  trend_label: string | null;
  ladder_score: number | null;
}

export interface LadderQueryFilters {
  period_id?: string;
  from_period_id?: string;
  to_period_id?: string;
  category?: string;
  start_category?: string;
  movement_direction?: string;
  movement_type?: string;
  stability_status?: string;
  trend_label?: string;
  sector?: string;
  is_category_entry?: boolean;
  entered_category?: string;
  is_category_exit?: boolean;
  exited_category?: string;
  rank_min?: number;
  rank_max?: number;
  near_boundary?: string;
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

export interface UploadJobStatus {
  period_id: string;
  period_label: string;
  import_status: string;
  import_error: string | null;
  row_count?: number;
}
