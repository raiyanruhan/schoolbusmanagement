import type { Bus, Run, RunDirection, RunGender, GenderMode } from '../../shared/types'

// ─── Engine-specific enums ────────────────────────────────────────────────────

export type AssignmentStrategy = 'LARGEST_ROUTE_FIRST' | 'SMALLEST_ROUTE_FIRST' | 'SEQUENCE_ORDER'
export type WarningType = 'OVERLOADED' | 'UNDERFILLED' | 'NO_AVAILABLE_BUS' | 'GENDER_MISMATCH'

// ─── Warning ──────────────────────────────────────────────────────────────────

export interface EngineWarning {
  type: WarningType
  severity: 'WARNING' | 'CRITICAL'
  message: string
  context?: string
}

// ─── Stop-level data used inside engine ───────────────────────────────────────

export interface StopWithCount {
  stop_id: string
  stop_name: string
  sequence_order: number
  planned_boys: number
  planned_girls: number
  total: number
}

// ─── A run proposed by the engine (not yet saved) ─────────────────────────────

export interface ProposedRun {
  temp_id: string
  bus_id: string
  bus_number: string
  route_id: string
  route_name: string
  route_color: string
  direction: RunDirection
  gender: RunGender
  stops: Array<{ stop_id: string; stop_name: string; student_count: number }>
  totalStudents: number
  capacity: number
  overload_limit: number
  isOverloaded: boolean
  warnings: EngineWarning[]
}

// ─── A stop that could not be assigned ───────────────────────────────────────

export interface UnassignedStopInfo {
  stop_id: string
  stop_name: string
  route_id: string
  route_name: string
  reason: string
  planned_boys: number
  planned_girls: number
}

// ─── Summary ─────────────────────────────────────────────────────────────────

export interface EngineSummary {
  totalBusesUsed: number
  totalStudentsAssigned: number
  totalStudentsUnassigned: number
  overloadedRuns: number
  splitRoutes: number
}

// ─── Engine output ────────────────────────────────────────────────────────────

export interface EngineOutput {
  proposedRuns: ProposedRun[]
  unassignedStops: UnassignedStopInfo[]
  warnings: EngineWarning[]
  summary: EngineSummary
}

// ─── Engine configuration (caller-supplied parameters) ───────────────────────

export interface EngineConfig {
  shift_id: string
  session_id: string
  direction: RunDirection
  gender_mode: GenderMode
  strategy: AssignmentStrategy
  overload_limit: number
  underfill_threshold: number
}

// ─── Full engine input ────────────────────────────────────────────────────────

export interface EngineInput {
  buses: Bus[]
  routes: Array<{
    id: string
    name: string
    name_bn: string | null
    color: string
    stops: StopWithCount[]
  }>
  existingRuns: Run[]
  config: EngineConfig
}

// Re-export shared types used in engine so callers only import from here
export type { Bus, Run, RunDirection, RunGender, GenderMode }
