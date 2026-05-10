import {
  ApiResponse,
  DashboardSummary,
  LadderTableRow,
  LadderFilters,
  LadderMovement,
  NiftyPeriod,
  SectorSummary,
  CompanyDetail,
  CompareResponse,
  StarRow,
  TrendResponse,
} from '@/types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

// ── Dashboard ──

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const res = await apiFetch<ApiResponse<DashboardSummary>>('/api/dashboard/summary');
  return res.data;
}

export async function getBoundaryAlerts(periodId?: string) {
  const qs = periodId ? `?period_id=${periodId}` : '';
  const res = await apiFetch<ApiResponse<unknown>>(`/api/dashboard/boundary-alerts${qs}`);
  return res.data;
}

// ── Ladder ──

export async function getLadder(filters: LadderFilters = {}) {
  const qs = buildQuery(filters as Record<string, unknown>);
  return apiFetch<ApiResponse<LadderTableRow[]>>(`/api/ladder${qs}`);
}

export async function getEntryExit(params: {
  period_id?: string;
  category?: string;
  type?: 'entry' | 'exit';
  limit?: number;
  offset?: number;
}) {
  const qs = buildQuery(params as Record<string, unknown>);
  return apiFetch<ApiResponse<LadderMovement[]>>(`/api/ladder/entry-exit${qs}`);
}

// ── Companies ──

export async function getCompanies(params: {
  search?: string;
  sector?: string;
  limit?: number;
  offset?: number;
}) {
  const qs = buildQuery(params as Record<string, unknown>);
  return apiFetch<ApiResponse<CompanyDetail[]>>(`/api/companies${qs}`);
}

export async function getCompany(isin: string): Promise<CompanyDetail> {
  const res = await apiFetch<ApiResponse<CompanyDetail>>(`/api/companies/${isin}`);
  return res.data;
}

// ── Periods ──

export async function getPeriods(): Promise<NiftyPeriod[]> {
  const res = await apiFetch<ApiResponse<NiftyPeriod[]>>('/api/periods');
  return res.data;
}

export async function getPeriod(id: string): Promise<NiftyPeriod> {
  const res = await apiFetch<ApiResponse<NiftyPeriod>>(`/api/periods/${id}`);
  return res.data;
}

// ── Sectors ──

export async function getSectors(): Promise<SectorSummary[]> {
  const res = await apiFetch<ApiResponse<SectorSummary[]>>('/api/sectors');
  return res.data;
}

export async function getSector(sector: string, periodId?: string) {
  const qs = periodId ? `?period_id=${periodId}` : '';
  return apiFetch<ApiResponse<unknown>>(`/api/sectors/${encodeURIComponent(sector)}${qs}`);
}

// ── Multi-period Compare ──

export async function getCompare(params: {
  period_ids: string;   // comma-separated
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<CompareResponse> {
  const qs = buildQuery(params as Record<string, unknown>);
  return apiFetch<CompareResponse>(`/api/compare${qs}`);
}

// ── Rising / Falling Stars ──

export async function getStars(params: {
  type: 'rising' | 'falling';
  limit?: number;
  offset?: number;
  category?: string;
  min_periods?: number;
  trend_label?: string;
}): Promise<ApiResponse<StarRow[]>> {
  const qs = buildQuery(params as Record<string, unknown>);
  return apiFetch<ApiResponse<StarRow[]>>(`/api/stars${qs}`);
}

// ── Rank Trends ──

export async function getTrends(params: {
  periods?:    number;
  category?:   string;
  direction?:  'improving' | 'declining' | 'all';
  min_change?: number;
  limit?:      number;
  offset?:     number;
}): Promise<TrendResponse> {
  const qs = buildQuery(params as Record<string, unknown>);
  return apiFetch<TrendResponse>(`/api/trends${qs}`);
}

// ── Admin (requires Bearer token) ──

export async function uploadNiftyFile(
  formData: FormData,
  token: string
): Promise<ApiResponse<{ period_id: string; rows_parsed: number }>> {
  const res = await fetch(`${BASE_URL}/api/admin/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function reprocessPeriod(periodId: string, token: string) {
  return apiFetch<ApiResponse<unknown>>(`/api/admin/reprocess/${periodId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deletePeriod(periodId: string, token: string) {
  return apiFetch<ApiResponse<unknown>>(`/api/admin/periods/${periodId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAdminPeriods(token: string) {
  return apiFetch<ApiResponse<NiftyPeriod[]>>('/api/admin/periods', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function saveCompanyTags(companyId: string, tags: string[], token: string) {
  return apiFetch<ApiResponse<unknown>>(`/api/admin/companies/${companyId}/tags`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ tags }),
  });
}

export async function recalculateSummaries(token: string) {
  return apiFetch<ApiResponse<unknown>>('/api/admin/recalculate-summaries', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function recalculateMovements(periodId: string, token: string) {
  return apiFetch<ApiResponse<unknown>>(`/api/admin/recalculate-movements/${periodId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function setCompanySector(companyId: string, sector: string, token: string) {
  return apiFetch<ApiResponse<unknown>>(`/api/admin/companies/${companyId}/sector`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ sector_primary: sector }),
  });
}
