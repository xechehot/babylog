export type EntryType = 'feeding' | 'diaper' | 'weight' | 'pills'
export type FeedingSubtype = 'breast' | 'formula'
export type DiaperSubtype = 'pee' | 'poo' | 'dry' | 'pee+poo'
export type PillsSubtype = 'vigantol'
export type UploadStatus = 'pending' | 'processing' | 'done' | 'failed'
export type Confidence = 'high' | 'medium' | 'low'

export interface Upload {
  id: number
  filename: string
  status: UploadStatus
  error_message: string | null
  entry_count?: number
  date_counts?: Record<string, number>
  created_at: string
  processed_at: string | null
  reviewed: boolean
  reviewed_at: string | null
}

export interface Entry {
  id: number
  upload_id: number | null
  entry_type: EntryType
  subtype: string | null
  occurred_at: string
  date: string
  value: number | null
  notes: string | null
  confidence: Confidence | null
  raw_text: string | null
  confirmed: boolean
  created_at: string
  updated_at: string
}

export interface UploadDetail {
  id: number
  filename: string
  status: UploadStatus
  error_message: string | null
  created_at: string
  processed_at: string | null
  reviewed: boolean
  reviewed_at: string | null
  entries: Entry[]
}

export interface DashboardDay {
  date: string
  feeding_total_ml: number
  feeding_count: number
  feeding_breast_ml: number
  feeding_formula_ml: number
  diaper_pee_count: number
  diaper_poo_count: number
  diaper_dry_count: number
  diaper_pee_poo_count: number
}

export interface AllTimeTotals {
  diaper_total: number
  diaper_pee: number
  diaper_poo: number
  feeding_breast: number
  feeding_formula: number
}

export type PredictionBasis =
  | 'regression'
  | 'median_measured'
  | 'median_unmeasured'
  | 'insufficient_data'

export interface NextFeedingPrediction {
  predicted_at: string | null
  earliest_at: string | null
  latest_at: string | null
  predicted_ml: number | null
  ml_low: number | null
  ml_high: number | null
  basis: PredictionBasis
  sample_size: number
  window_days: number | null
}

export interface DashboardResponse {
  from_date: string
  to_date: string
  days: DashboardDay[]
  latest_weight: { value: number; occurred_at: string; date: string } | null
  previous_weight: { value: number; occurred_at: string; date: string } | null
  all_time_totals: AllTimeTotals | null
}
