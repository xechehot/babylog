// WHO Weight Velocity Standards: daily weight gain as % of body weight (0–24 months)
// Computed from WHO weight increment tables divided by WHO median weight at interval midpoint.
// Source: https://www.who.int/tools/child-growth-standards/standards/weight-velocity

export interface VelocityBand {
  fromMonth: number
  toMonth: number
  p3: number
  p15: number
  p50: number
  p85: number
  p97: number
}

// Boys: daily weight gain as % of body weight
export const VELOCITY_BOYS: VelocityBand[] = [
  { fromMonth: 0, toMonth: 1, p3: 0.34, p15: 0.62, p50: 0.94, p85: 1.22, p97: 1.44 },
  { fromMonth: 1, toMonth: 2, p3: 0.42, p15: 0.58, p50: 0.78, p85: 0.99, p97: 1.17 },
  { fromMonth: 2, toMonth: 3, p3: 0.22, p15: 0.32, p50: 0.45, p85: 0.59, p97: 0.71 },
  { fromMonth: 3, toMonth: 4, p3: 0.12, p15: 0.20, p50: 0.30, p85: 0.41, p97: 0.51 },
  { fromMonth: 4, toMonth: 5, p3: 0.07, p15: 0.14, p50: 0.24, p85: 0.34, p97: 0.42 },
  { fromMonth: 5, toMonth: 6, p3: 0.03, p15: 0.09, p50: 0.18, p85: 0.27, p97: 0.35 },
  { fromMonth: 6, toMonth: 7, p3: 0.0, p15: 0.06, p50: 0.14, p85: 0.23, p97: 0.31 },
  { fromMonth: 7, toMonth: 8, p3: -0.02, p15: 0.04, p50: 0.12, p85: 0.21, p97: 0.28 },
  { fromMonth: 8, toMonth: 9, p3: -0.03, p15: 0.03, p50: 0.11, p85: 0.19, p97: 0.26 },
  { fromMonth: 9, toMonth: 10, p3: -0.04, p15: 0.02, p50: 0.09, p85: 0.18, p97: 0.25 },
  { fromMonth: 10, toMonth: 11, p3: -0.05, p15: 0.01, p50: 0.09, p85: 0.17, p97: 0.24 },
  { fromMonth: 11, toMonth: 12, p3: -0.05, p15: 0.01, p50: 0.08, p85: 0.17, p97: 0.24 },
  { fromMonth: 12, toMonth: 14, p3: -0.02, p15: 0.02, p50: 0.07, p85: 0.13, p97: 0.18 },
  { fromMonth: 14, toMonth: 16, p3: -0.02, p15: 0.01, p50: 0.06, p85: 0.12, p97: 0.16 },
  { fromMonth: 16, toMonth: 18, p3: -0.02, p15: 0.01, p50: 0.06, p85: 0.11, p97: 0.16 },
  { fromMonth: 18, toMonth: 20, p3: -0.03, p15: 0.01, p50: 0.06, p85: 0.11, p97: 0.15 },
  { fromMonth: 20, toMonth: 22, p3: -0.03, p15: 0.01, p50: 0.05, p85: 0.10, p97: 0.14 },
  { fromMonth: 22, toMonth: 24, p3: -0.03, p15: 0.01, p50: 0.05, p85: 0.10, p97: 0.14 },
]

// Girls: daily weight gain as % of body weight
export const VELOCITY_GIRLS: VelocityBand[] = [
  { fromMonth: 0, toMonth: 1, p3: 0.37, p15: 0.58, p50: 0.85, p85: 1.13, p97: 1.37 },
  { fromMonth: 1, toMonth: 2, p3: 0.37, p15: 0.52, p50: 0.71, p85: 0.92, p97: 1.09 },
  { fromMonth: 2, toMonth: 3, p3: 0.19, p15: 0.30, p50: 0.43, p85: 0.57, p97: 0.69 },
  { fromMonth: 3, toMonth: 4, p3: 0.12, p15: 0.20, p50: 0.32, p85: 0.43, p97: 0.53 },
  { fromMonth: 4, toMonth: 5, p3: 0.06, p15: 0.14, p50: 0.24, p85: 0.35, p97: 0.44 },
  { fromMonth: 5, toMonth: 6, p3: 0.02, p15: 0.09, p50: 0.19, p85: 0.28, p97: 0.37 },
  { fromMonth: 6, toMonth: 7, p3: 0.0, p15: 0.06, p50: 0.15, p85: 0.24, p97: 0.32 },
  { fromMonth: 7, toMonth: 8, p3: -0.02, p15: 0.05, p50: 0.13, p85: 0.22, p97: 0.30 },
  { fromMonth: 8, toMonth: 9, p3: -0.03, p15: 0.03, p50: 0.11, p85: 0.20, p97: 0.28 },
  { fromMonth: 9, toMonth: 10, p3: -0.04, p15: 0.02, p50: 0.10, p85: 0.18, p97: 0.26 },
  { fromMonth: 10, toMonth: 11, p3: -0.05, p15: 0.01, p50: 0.09, p85: 0.18, p97: 0.25 },
  { fromMonth: 11, toMonth: 12, p3: -0.05, p15: 0.01, p50: 0.09, p85: 0.17, p97: 0.25 },
  { fromMonth: 12, toMonth: 14, p3: -0.01, p15: 0.03, p50: 0.08, p85: 0.13, p97: 0.18 },
  { fromMonth: 14, toMonth: 16, p3: -0.02, p15: 0.02, p50: 0.07, p85: 0.13, p97: 0.17 },
  { fromMonth: 16, toMonth: 18, p3: -0.02, p15: 0.02, p50: 0.07, p85: 0.12, p97: 0.17 },
  { fromMonth: 18, toMonth: 20, p3: -0.02, p15: 0.01, p50: 0.06, p85: 0.12, p97: 0.17 },
  { fromMonth: 20, toMonth: 22, p3: -0.03, p15: 0.01, p50: 0.06, p85: 0.11, p97: 0.16 },
  { fromMonth: 22, toMonth: 24, p3: -0.03, p15: 0.01, p50: 0.05, p85: 0.11, p97: 0.15 },
]

/** Get WHO velocity band for a given age in months */
export function getVelocityBand(
  bands: VelocityBand[],
  ageMonths: number,
): VelocityBand | null {
  for (const band of bands) {
    if (ageMonths >= band.fromMonth && ageMonths < band.toMonth) return band
  }
  // Edge case: exactly 24 months → use last band
  if (ageMonths >= 24) return bands[bands.length - 1]
  return null
}
