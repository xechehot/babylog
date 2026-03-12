import { useState, useEffect, useCallback } from 'react'

export interface BabyProfile {
  name: string
  birthDate: string // YYYY-MM-DD
  birthWeight: number | null // grams
}

const STORAGE_KEY = 'babylog_profile'

const defaultProfile: BabyProfile = {
  name: '',
  birthDate: '',
  birthWeight: null,
}

export function useProfile() {
  const [profile, setProfileState] = useState<BabyProfile>(defaultProfile)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<BabyProfile>
        setProfileState({ ...defaultProfile, ...parsed })
      }
    } catch (e) {
      console.error('Failed to load profile:', e)
    }
    setIsLoaded(true)
  }, [])

  const setProfile = useCallback((updates: Partial<BabyProfile>) => {
    setProfileState((prev) => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch (e) {
        console.error('Failed to save profile:', e)
      }
      return next
    })
  }, [])

  const clearProfile = useCallback(() => {
    setProfileState(defaultProfile)
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  return { profile, setProfile, clearProfile, isLoaded }
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
    return `${days} ${pluralize(days, 'день', 'дня', 'дней')}`
  }

  const weeks = Math.floor(days / 7)
  const remainingDays = days % 7

  if (weeks < 12) {
    // Show weeks + days
    let result = `${weeks} ${pluralize(weeks, 'неделя', 'недели', 'недель')}`
    if (remainingDays > 0) {
      result += ` ${remainingDays} ${pluralize(remainingDays, 'день', 'дня', 'дней')}`
    }
    return result
  }

  // Show months + weeks for older babies
  const months = Math.floor(days / 30)
  const remainingWeeks = Math.floor((days % 30) / 7)
  let result = `${months} ${pluralize(months, 'месяц', 'месяца', 'месяцев')}`
  if (remainingWeeks > 0) {
    result += ` ${remainingWeeks} ${pluralize(remainingWeeks, 'неделя', 'недели', 'недель')}`
  }
  return result
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const lastDigit = abs % 10
  if (abs > 10 && abs < 20) return many
  if (lastDigit === 1) return one
  if (lastDigit >= 2 && lastDigit <= 4) return few
  return many
}
