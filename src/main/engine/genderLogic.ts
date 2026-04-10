import type { RunGender, GenderMode, StopWithCount, EngineWarning } from './types'

export interface RunGroupDef {
  gender: RunGender
  getCount: (stop: StopWithCount) => number
}

/**
 * Resolve which gender groups to create for a set of stops based on gender_mode.
 *
 * COMBINED  → one group (MIXED), count = boys + girls
 * SEPARATED → two groups (BOYS, GIRLS), each with their own counts
 * AUTO      → if both genders exceed underfill_threshold total → SEPARATED,
 *             otherwise COMBINED with a warning
 */
export function resolveGenderGroups(
  stops: StopWithCount[],
  gender_mode: GenderMode,
  underfill_threshold: number
): { groups: RunGroupDef[]; warnings: EngineWarning[] } {
  const warnings: EngineWarning[] = []

  const totalBoys = stops.reduce((sum, s) => sum + s.planned_boys, 0)
  const totalGirls = stops.reduce((sum, s) => sum + s.planned_girls, 0)

  const boysGroup: RunGroupDef = {
    gender: 'BOYS',
    getCount: (s) => s.planned_boys
  }

  const girlsGroup: RunGroupDef = {
    gender: 'GIRLS',
    getCount: (s) => s.planned_girls
  }

  const mixedGroup: RunGroupDef = {
    gender: 'MIXED',
    getCount: (s) => s.planned_boys + s.planned_girls
  }

  if (gender_mode === 'COMBINED') {
    return { groups: [mixedGroup], warnings }
  }

  if (gender_mode === 'SEPARATED') {
    const groups: RunGroupDef[] = []
    if (totalBoys > 0) groups.push(boysGroup)
    if (totalGirls > 0) groups.push(girlsGroup)
    if (groups.length === 0) groups.push(mixedGroup) // fallback if no students
    return { groups, warnings }
  }

  // AUTO mode
  if (totalBoys > underfill_threshold && totalGirls > underfill_threshold) {
    const groups: RunGroupDef[] = []
    if (totalBoys > 0) groups.push(boysGroup)
    if (totalGirls > 0) groups.push(girlsGroup)
    return { groups, warnings }
  }

  // At least one gender falls below threshold — use COMBINED with warning
  if (totalBoys > 0 && totalBoys <= underfill_threshold) {
    warnings.push({
      type: 'UNDERFILLED',
      severity: 'WARNING',
      message: `Boys count (${totalBoys}) is below the underfill threshold (${underfill_threshold}). Combining genders.`
    })
  }
  if (totalGirls > 0 && totalGirls <= underfill_threshold) {
    warnings.push({
      type: 'UNDERFILLED',
      severity: 'WARNING',
      message: `Girls count (${totalGirls}) is below the underfill threshold (${underfill_threshold}). Combining genders.`
    })
  }

  return { groups: [mixedGroup], warnings }
}
