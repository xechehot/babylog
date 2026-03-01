export type EntryType = 'feeding' | 'pee' | 'poo' | 'weight' | 'diaper_dry'
export type UploadStatus = 'pending' | 'processing' | 'done' | 'failed'
export type Confidence = 'high' | 'medium' | 'low'

export interface Upload {
  id: number
  filename: string
  status: UploadStatus
  error_message: string | null
  entry_count?: number
  created_at: string
  processed_at: string | null
}

export interface Entry {
  id: number
  upload_id: number | null
  entry_type: EntryType
  occurred_at: string
  date: string
  value: number | null
  notes: string | null
  confidence: Confidence | null
  raw_text: string | null
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
  entries: Entry[]
}

export interface DashboardDay {
  date: string
  feeding_total_ml: number
  feeding_count: number
  pee_count: number
  poo_count: number
  diaper_dry_count: number
}

export interface DashboardResponse {
  from_date: string
  to_date: string
  days: DashboardDay[]
  latest_weight: { value: number; occurred_at: string; date: string } | null
}
