// ─── Enums ─────────────────────────────────────────────────────────────────

export type BusStatus = 'ACTIVE' | 'MAINTENANCE' | 'RETIRED'
export type GenderMode = 'COMBINED' | 'SEPARATED' | 'AUTO'
export type RunDirection = 'INBOUND' | 'OUTBOUND'
export type RunGender = 'BOYS' | 'GIRLS' | 'MIXED'
export type RunType = 'REGULAR' | 'SPECIAL'
export type RunStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
export type SessionStatus = 'OPEN' | 'LOCKED'
export type AssignedBy = 'MANUAL' | 'AUTO'

// ─── Domain Types ──────────────────────────────────────────────────────────

export interface Bus {
  id: string
  number: string
  capacity: number
  status: BusStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Route {
  id: string
  name: string
  name_bn: string | null
  color: string
  is_active: number // SQLite stores boolean as 0/1
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Stop {
  id: string
  route_id: string
  name: string
  name_bn: string | null
  sequence_order: number
  is_active: number
  created_at: string
  updated_at: string
}

export interface Shift {
  id: string
  name: string
  name_bn: string | null
  sort_order: number
  is_active: number
  inbound_depart_school: string | null
  inbound_arrive_stops: string | null
  inbound_arrive_school: string | null
  school_start_time: string | null
  school_end_time: string | null
  outbound_depart_school: string | null
  outbound_arrive_stops: string | null
  gender_mode: GenderMode
  default_overload: number
  created_at: string
  updated_at: string
}

export interface StopConfig {
  id: string
  stop_id: string
  shift_id: string
  is_active: number
  planned_boys: number
  planned_girls: number
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  date: string
  status: SessionStatus
  notes: string | null
  created_at: string
  locked_at: string | null
}

export interface Run {
  id: string
  session_id: string
  shift_id: string
  bus_id: string
  route_id: string
  direction: RunDirection
  gender: RunGender
  type: RunType
  status: RunStatus
  planned_depart: string | null
  planned_return: string | null
  actual_depart: string | null
  actual_return: string | null
  overload_limit: number
  assigned_by: AssignedBy
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RunStop {
  id: string
  run_id: string
  stop_id: string
  sequence_order: number
  student_count: number
  gender: RunGender
}

// ─── Extended / View Types ─────────────────────────────────────────────────

export interface StopWithConfig extends Stop {
  config: StopConfig | null
}

export interface RouteWithStops extends Route {
  stops: Stop[]
}

export interface RunWithDetails extends Run {
  bus: Bus
  route: Route
  stops: Array<RunStop & { stop: Stop }>
}

// ─── IPC Result Wrappers ───────────────────────────────────────────────────

export interface IpcSuccess<T> {
  success: true
  data: T
}

export interface IpcError {
  success: false
  error: string
}

export type IpcResult<T> = IpcSuccess<T> | IpcError

// ─── Input / DTO Types ────────────────────────────────────────────────────

export interface CreateBusInput {
  number: string
  capacity: number
  status: BusStatus
  notes?: string
}

export interface UpdateBusInput extends Partial<CreateBusInput> {
  id: string
}

export interface CreateRouteInput {
  name: string
  name_bn?: string
  color: string
  notes?: string
}

export interface UpdateRouteInput extends Partial<CreateRouteInput> {
  id: string
  is_active?: boolean
}

export interface CreateStopInput {
  route_id: string
  name: string
  name_bn?: string
  sequence_order: number
}

export interface UpdateStopInput extends Partial<CreateStopInput> {
  id: string
  is_active?: boolean
}

export interface ReorderStopsInput {
  route_id: string
  stop_ids: string[] // ordered array
}

export interface CreateShiftInput {
  name: string
  name_bn?: string
  sort_order: number
  inbound_depart_school?: string
  inbound_arrive_stops?: string
  inbound_arrive_school?: string
  school_start_time?: string
  school_end_time?: string
  outbound_depart_school?: string
  outbound_arrive_stops?: string
  gender_mode: GenderMode
  default_overload: number
}

export interface UpdateShiftInput extends Partial<CreateShiftInput> {
  id: string
  is_active?: boolean
}

export interface UpsertStopConfigInput {
  stop_id: string
  shift_id: string
  is_active: boolean
  planned_boys: number
  planned_girls: number
}

export interface CreateRunInput {
  session_id: string
  shift_id: string
  bus_id: string
  route_id: string
  direction: RunDirection
  gender: RunGender
  stop_ids: string[] // ordered list of stops for this run
  overload_limit?: number
  notes?: string
}

export interface DashboardStats {
  session: Session | null
  totalBuses: number
  activeBuses: number
  totalRoutes: number
  totalStudents: number
  runsToday: number
}

// ─── Engine / Auto-Planner Types ──────────────────────────────────────────────

export type AssignmentStrategy = 'LARGEST_ROUTE_FIRST' | 'SMALLEST_ROUTE_FIRST' | 'SEQUENCE_ORDER'
export type WarningType = 'OVERLOADED' | 'UNDERFILLED' | 'NO_AVAILABLE_BUS' | 'GENDER_MISMATCH'

export interface EngineWarning {
  type: WarningType
  severity: 'WARNING' | 'CRITICAL'
  message: string
  context?: string
}

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

export interface UnassignedStopInfo {
  stop_id: string
  stop_name: string
  route_id: string
  route_name: string
  reason: string
  planned_boys: number
  planned_girls: number
}

export interface EngineSummary {
  totalBusesUsed: number
  totalStudentsAssigned: number
  totalStudentsUnassigned: number
  overloadedRuns: number
  splitRoutes: number
}

export interface EngineOutput {
  proposedRuns: ProposedRun[]
  unassignedStops: UnassignedStopInfo[]
  warnings: EngineWarning[]
  summary: EngineSummary
}
