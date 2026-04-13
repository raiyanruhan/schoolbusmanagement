import type { Bus, Run, RunDirection, RunGender, GenderMode } from '../../shared/types'

// ─── Engine-specific enums ────────────────────────────────────────────────────

export type AssignmentStrategy = 'LARGEST_ROUTE_FIRST' | 'SMALLEST_ROUTE_FIRST' | 'SEQUENCE_ORDER'
export type WarningType = 'OVERLOADED' | 'UNDERFILLED' | 'NO_AVAILABLE_BUS' | 'GENDER_MISMATCH' | 'TIME_EXCEEDED'

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
  /** ISO string — only present when time_config was provided */
  arrival_time?: string
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

// ─── Time configuration (optional — enables time-constraint enforcement) ──────

export interface TimeConfig {
  /** How long a bus stops at each stop baseline (seconds) */
  base_stop_time_sec: number
  /** Additional time per student boarding/alighting (seconds) */
  per_student_time_sec: number
  /** When the bus departs the origin (school or first stop) */
  departure_time: Date
  /** Latest allowed arrival at the destination */
  arrival_deadline: Date
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
  /** Optional time constraint enforcement */
  time_config?: TimeConfig
}

// ─── Full engine input ────────────────────────────────────────────────────────

export interface EngineInput {
  buses: Bus[]
  routes: Array<{
    id: string
    name: string
    name_bn: string | null
    color: string
    /** Estimated full-route travel time in minutes (proportional per segment). Default 0. */
    travel_time_minutes?: number
    stops: StopWithCount[]
  }>
  existingRuns: Run[]
  config: EngineConfig
}

// Re-export shared types used in engine so callers only import from here
export type { Bus, Run, RunDirection, RunGender, GenderMode }
