// WHO Weight Velocity Standards (g/day)
// 0–60 days: stratified by birth weight category (from WHO birth-to-60-day tables)
// 2–24 months: "All" category (from WHO 1-month / 2-month increment tables, converted to g/day)
// Source: https://www.who.int/tools/child-growth-standards/standards/weight-velocity

export interface VelocityInterval {
  fromDay: number
  toDay: number
  p5: number  // g/day
  p25: number // g/day
  p50: number // g/day
}

// Birth weight categories for 0-60 day norms
type BirthWeightKey = '2500-3000' | '3000-3500' | '3500-4000' | '4000+' | 'all'

function birthWeightKey(birthWeightGrams: number | null): BirthWeightKey {
  if (birthWeightGrams == null) return 'all'
  if (birthWeightGrams < 2500) return 'all' // insufficient WHO data for <2500g
  if (birthWeightGrams < 3000) return '2500-3000'
  if (birthWeightGrams < 3500) return '3000-3500'
  if (birthWeightGrams < 4000) return '3500-4000'
  return '4000+'
}

// ── Boys: 0–60 days, g/day, by birth weight ──

const BOYS_EARLY: Record<BirthWeightKey, VelocityInterval[]> = {
  '2500-3000': [
    { fromDay: 0, toDay: 7, p5: -29, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: -14, p25: 21, p50: 36 },
    { fromDay: 14, toDay: 28, p5: 32, p25: 39, p50: 50 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 36, p50: 42 },
    { fromDay: 42, toDay: 60, p5: 24, p25: 29, p50: 35 },
  ],
  '3000-3500': [
    { fromDay: 0, toDay: 7, p5: -36, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: -7, p25: 19, p50: 33 },
    { fromDay: 14, toDay: 28, p5: 25, p25: 39, p50: 46 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 31, p50: 40 },
    { fromDay: 42, toDay: 60, p5: 17, p25: 28, p50: 34 },
  ],
  '3500-4000': [
    { fromDay: 0, toDay: 7, p5: -43, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: -7, p25: 14, p50: 31 },
    { fromDay: 14, toDay: 28, p5: 23, p25: 36, p50: 50 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 33, p50: 41 },
    { fromDay: 42, toDay: 60, p5: 19, p25: 26, p50: 34 },
  ],
  '4000+': [
    { fromDay: 0, toDay: 7, p5: -36, p25: -7, p50: 7 },
    { fromDay: 7, toDay: 14, p5: -14, p25: 25, p50: 36 },
    { fromDay: 14, toDay: 28, p5: 29, p25: 37, p50: 50 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 31, p50: 40 },
    { fromDay: 42, toDay: 60, p5: 14, p25: 23, p50: 34 },
  ],
  all: [
    { fromDay: 0, toDay: 7, p5: -36, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: -7, p25: 19, p50: 36 },
    { fromDay: 14, toDay: 28, p5: 25, p25: 38, p50: 47 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 32, p50: 40 },
    { fromDay: 42, toDay: 60, p5: 18, p25: 28, p50: 34 },
  ],
}

// ── Girls: 0–60 days, g/day, by birth weight ──

const GIRLS_EARLY: Record<BirthWeightKey, VelocityInterval[]> = {
  '2500-3000': [
    { fromDay: 0, toDay: 7, p5: -21, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: -12, p25: 14, p50: 29 },
    { fromDay: 14, toDay: 28, p5: 21, p25: 33, p50: 43 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 27, p50: 36 },
    { fromDay: 42, toDay: 60, p5: 17, p25: 23, p50: 31 },
  ],
  '3000-3500': [
    { fromDay: 0, toDay: 7, p5: -29, p25: 0, p50: 14 },
    { fromDay: 7, toDay: 14, p5: -7, p25: 14, p50: 29 },
    { fromDay: 14, toDay: 28, p5: 21, p25: 32, p50: 39 },
    { fromDay: 28, toDay: 42, p5: 18, p25: 28, p50: 35 },
    { fromDay: 42, toDay: 60, p5: 15, p25: 21, p50: 27 },
  ],
  '3500-4000': [
    { fromDay: 0, toDay: 7, p5: -36, p25: 0, p50: 14 },
    { fromDay: 7, toDay: 14, p5: -14, p25: 14, p50: 29 },
    { fromDay: 14, toDay: 28, p5: 18, p25: 32, p50: 42 },
    { fromDay: 28, toDay: 42, p5: 15, p25: 25, p50: 32 },
    { fromDay: 42, toDay: 60, p5: 13, p25: 23, p50: 32 },
  ],
  '4000+': [
    { fromDay: 0, toDay: 7, p5: -29, p25: 0, p50: 21 },
    { fromDay: 7, toDay: 14, p5: 0, p25: 14, p50: 29 },
    { fromDay: 14, toDay: 28, p5: 17, p25: 31, p50: 44 },
    { fromDay: 28, toDay: 42, p5: 21, p25: 26, p50: 38 },
    { fromDay: 42, toDay: 60, p5: 9, p25: 20, p50: 29 },
  ],
  all: [
    { fromDay: 0, toDay: 7, p5: -29, p25: 0, p50: 14 },
    { fromDay: 7, toDay: 14, p5: -7, p25: 14, p50: 29 },
    { fromDay: 14, toDay: 28, p5: 21, p25: 32, p50: 39 },
    { fromDay: 28, toDay: 42, p5: 18, p25: 27, p50: 35 },
    { fromDay: 42, toDay: 60, p5: 15, p25: 22, p50: 29 },
  ],
}

// ── Boys: 2–24 months, g/day (from WHO monthly increment tables, "All" category) ──
// g/month ÷ 30.44 days

const BOYS_MONTHLY: VelocityInterval[] = [
  { fromDay: 60, toDay: 91, p5: 10, p25: 22, p50: 27 },   // 2-3mo
  { fromDay: 91, toDay: 122, p5: 5, p25: 16, p50: 20 },   // 3-4mo
  { fromDay: 122, toDay: 152, p5: 2, p25: 13, p50: 17 },   // 4-5mo
  { fromDay: 152, toDay: 183, p5: -1, p25: 9, p50: 14 },   // 5-6mo
  { fromDay: 183, toDay: 213, p5: -3, p25: 7, p50: 12 },   // 6-7mo
  { fromDay: 213, toDay: 244, p5: -4, p25: 6, p50: 10 },   // 7-8mo
  { fromDay: 244, toDay: 274, p5: -5, p25: 5, p50: 9 },    // 8-9mo
  { fromDay: 274, toDay: 305, p5: -6, p25: 4, p50: 9 },    // 9-10mo
  { fromDay: 305, toDay: 335, p5: -6, p25: 3, p50: 8 },    // 10-11mo
  { fromDay: 335, toDay: 365, p5: -7, p25: 3, p50: 8 },    // 11-12mo
  { fromDay: 365, toDay: 426, p5: -5, p25: 4, p50: 7 },    // 12-14mo
  { fromDay: 426, toDay: 487, p5: -5, p25: 3, p50: 7 },    // 14-16mo
  { fromDay: 487, toDay: 548, p5: -5, p25: 3, p50: 7 },    // 16-18mo
  { fromDay: 548, toDay: 609, p5: -5, p25: 3, p50: 6 },    // 18-20mo
  { fromDay: 609, toDay: 670, p5: -6, p25: 3, p50: 6 },    // 20-22mo
  { fromDay: 670, toDay: 730, p5: -6, p25: 3, p50: 6 },    // 22-24mo
]

// ── Girls: 2–24 months, g/day ──

const GIRLS_MONTHLY: VelocityInterval[] = [
  { fromDay: 60, toDay: 91, p5: 8, p25: 19, p50: 24 },    // 2-3mo
  { fromDay: 91, toDay: 122, p5: 4, p25: 15, p50: 19 },   // 3-4mo
  { fromDay: 122, toDay: 152, p5: 1, p25: 12, p50: 16 },   // 4-5mo
  { fromDay: 152, toDay: 183, p5: -1, p25: 9, p50: 13 },   // 5-6mo
  { fromDay: 183, toDay: 213, p5: -3, p25: 7, p50: 11 },   // 6-7mo
  { fromDay: 213, toDay: 244, p5: -4, p25: 6, p50: 10 },   // 7-8mo
  { fromDay: 244, toDay: 274, p5: -5, p25: 5, p50: 9 },    // 8-9mo
  { fromDay: 274, toDay: 305, p5: -6, p25: 4, p50: 8 },    // 9-10mo
  { fromDay: 305, toDay: 335, p5: -6, p25: 3, p50: 8 },    // 10-11mo
  { fromDay: 335, toDay: 365, p5: -6, p25: 3, p50: 8 },    // 11-12mo
  { fromDay: 365, toDay: 426, p5: -4, p25: 4, p50: 7 },    // 12-14mo
  { fromDay: 426, toDay: 487, p5: -4, p25: 4, p50: 7 },    // 14-16mo
  { fromDay: 487, toDay: 548, p5: -5, p25: 3, p50: 7 },    // 16-18mo
  { fromDay: 548, toDay: 609, p5: -5, p25: 3, p50: 7 },    // 18-20mo
  { fromDay: 609, toDay: 670, p5: -5, p25: 3, p50: 6 },    // 20-22mo
  { fromDay: 670, toDay: 730, p5: -6, p25: 2, p50: 6 },    // 22-24mo
]

/** Get velocity norms (g/day) for a given age, sex, and birth weight */
export function getVelocityNorms(
  sex: 'boy' | 'girl',
  birthWeightGrams: number | null,
  ageDays: number,
): VelocityInterval | null {
  if (ageDays < 0) return null

  if (ageDays < 60) {
    // Use birth-weight-stratified data for first 60 days
    const key = birthWeightKey(birthWeightGrams)
    const earlyData = sex === 'boy' ? BOYS_EARLY[key] : GIRLS_EARLY[key]
    for (const interval of earlyData) {
      if (ageDays >= interval.fromDay && ageDays < interval.toDay) return interval
    }
    return null
  }

  // After 60 days: use monthly data (not birth-weight-stratified)
  const monthlyData = sex === 'boy' ? BOYS_MONTHLY : GIRLS_MONTHLY
  for (const interval of monthlyData) {
    if (ageDays >= interval.fromDay && ageDays < interval.toDay) return interval
  }

  // Beyond 24 months
  return null
}

/** Get all velocity intervals for building WHO norm curves on chart */
export function getAllVelocityIntervals(
  sex: 'boy' | 'girl',
  birthWeightGrams: number | null,
): VelocityInterval[] {
  const key = birthWeightKey(birthWeightGrams)
  const early = sex === 'boy' ? BOYS_EARLY[key] : GIRLS_EARLY[key]
  const monthly = sex === 'boy' ? BOYS_MONTHLY : GIRLS_MONTHLY
  return [...early, ...monthly]
}
