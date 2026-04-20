import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export type BabySex = 'boy' | 'girl'

export interface BabyProfile {
  baby_name: string | null
  birth_date: string | null // YYYY-MM-DD
  birth_weight: number | null // grams
  sex: BabySex | null
}

const PROFILE_KEY = ['settings']

export function useProfile() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: PROFILE_KEY,
    queryFn: () => api.get<BabyProfile>('/api/settings'),
  })

  const mutation = useMutation({
    mutationFn: (updates: Partial<BabyProfile>) => api.put<BabyProfile>('/api/settings', updates),
    onSuccess: (data) => {
      queryClient.setQueryData(PROFILE_KEY, data)
    },
  })

  return {
    profile: profile ?? {
      baby_name: null,
      birth_date: null,
      birth_weight: null,
      sex: null,
    },
    isLoaded: !isLoading,
    saveProfile: mutation.mutateAsync,
    isSaving: mutation.isPending,
  }
}

// Calculate age in days from birth date
export function calculateAgeDays(birthDate: string): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  const now = new Date()
  const diffMs = now.getTime() - birth.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// Format age as weeks+days or months+weeks
export function formatAge(birthDate: string): string | null {
  const days = calculateAgeDays(birthDate)
  if (days === null || days < 0) return null

  if (days < 7) {
    return `${days} ${plural(days, 'day')}`
  }

  const weeks = Math.floor(days / 7)
  const remainingDays = days % 7

  if (weeks < 12) {
    // Show weeks + days
    let result = `${weeks} ${plural(weeks, 'week')}`
    if (remainingDays > 0) {
      result += ` ${remainingDays} ${plural(remainingDays, 'day')}`
    }
    return result
  }

  // Show months + weeks for older babies
  const birth = new Date(birthDate)
  const now = new Date()
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) {
    months--
  }
  const monthStart = new Date(birth)
  monthStart.setMonth(monthStart.getMonth() + months)
  const remainingDaysAfterMonths = Math.floor(
    (now.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const remainingWeeks = Math.floor(remainingDaysAfterMonths / 7)
  let result = `${months} ${plural(months, 'month')}`
  if (remainingWeeks > 0) {
    result += ` ${remainingWeeks} ${plural(remainingWeeks, 'week')}`
  }
  return result
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`
}
