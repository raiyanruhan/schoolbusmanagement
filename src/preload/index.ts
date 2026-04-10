import { contextBridge, ipcRenderer } from 'electron'
import type { IpcResult } from '../shared/types'
import type {
  Bus, Route, Stop, Shift, StopConfig, Session, Run, RunWithDetails,
  RouteWithStops, DashboardStats,
  CreateBusInput, UpdateBusInput,
  CreateRouteInput, UpdateRouteInput,
  CreateStopInput, UpdateStopInput, ReorderStopsInput,
  CreateShiftInput, UpdateShiftInput, UpsertStopConfigInput,
  CreateRunInput,
  RunDirection, AssignmentStrategy,
  EngineOutput, ProposedRun
} from '../shared/types'

// The API exposed to the renderer — strictly typed
const api = {
  // ── Buses ──────────────────────────────────────────────────────────────
  bus: {
    getAll: (): Promise<IpcResult<Bus[]>> =>
      ipcRenderer.invoke('bus:getAll'),
    create: (input: CreateBusInput): Promise<IpcResult<Bus>> =>
      ipcRenderer.invoke('bus:create', input),
    update: (input: UpdateBusInput): Promise<IpcResult<Bus>> =>
      ipcRenderer.invoke('bus:update', input),
    delete: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke('bus:delete', id)
  },

  // ── Routes & Stops ─────────────────────────────────────────────────────
  route: {
    getAll: (): Promise<IpcResult<Route[]>> =>
      ipcRenderer.invoke('route:getAll'),
    getWithStops: (id: string): Promise<IpcResult<RouteWithStops>> =>
      ipcRenderer.invoke('route:getWithStops', id),
    create: (input: CreateRouteInput): Promise<IpcResult<Route>> =>
      ipcRenderer.invoke('route:create', input),
    update: (input: UpdateRouteInput): Promise<IpcResult<Route>> =>
      ipcRenderer.invoke('route:update', input),
    delete: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke('route:delete', id)
  },

  stop: {
    create: (input: CreateStopInput): Promise<IpcResult<Stop>> =>
      ipcRenderer.invoke('stop:create', input),
    update: (input: UpdateStopInput): Promise<IpcResult<Stop>> =>
      ipcRenderer.invoke('stop:update', input),
    reorder: (input: ReorderStopsInput): Promise<IpcResult<void>> =>
      ipcRenderer.invoke('stop:reorder', input),
    delete: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke('stop:delete', id)
  },

  // ── Shifts ─────────────────────────────────────────────────────────────
  shift: {
    getAll: (): Promise<IpcResult<Shift[]>> =>
      ipcRenderer.invoke('shift:getAll'),
    create: (input: CreateShiftInput): Promise<IpcResult<Shift>> =>
      ipcRenderer.invoke('shift:create', input),
    update: (input: UpdateShiftInput): Promise<IpcResult<Shift>> =>
      ipcRenderer.invoke('shift:update', input),
    getStopConfigs: (shift_id: string): Promise<IpcResult<StopConfig[]>> =>
      ipcRenderer.invoke('shift:getStopConfigs', shift_id),
    upsertStopConfig: (input: UpsertStopConfigInput): Promise<IpcResult<StopConfig>> =>
      ipcRenderer.invoke('shift:upsertStopConfig', input)
  },

  // ── Session ────────────────────────────────────────────────────────────
  session: {
    getOrCreateToday: (): Promise<IpcResult<Session>> =>
      ipcRenderer.invoke('session:getOrCreateToday'),
    getDashboardStats: (): Promise<IpcResult<DashboardStats>> =>
      ipcRenderer.invoke('session:getDashboardStats')
  },

  // ── Planner ────────────────────────────────────────────────────────────
  planner: {
    getRuns: (session_id: string): Promise<IpcResult<Run[]>> =>
      ipcRenderer.invoke('planner:getRuns', session_id),
    getRunDetail: (run_id: string): Promise<IpcResult<RunWithDetails>> =>
      ipcRenderer.invoke('planner:getRunDetail', run_id),
    createRun: (input: CreateRunInput): Promise<IpcResult<Run>> =>
      ipcRenderer.invoke('planner:createRun', input),
    deleteRun: (id: string): Promise<IpcResult<void>> =>
      ipcRenderer.invoke('planner:deleteRun', id)
  },

  // ── Auto-Planner ───────────────────────────────────────────────────────
  autoPlanner: {
    generate: (input: {
      session_id: string
      shift_id: string
      direction: RunDirection
      strategy: AssignmentStrategy
    }): Promise<IpcResult<EngineOutput>> =>
      ipcRenderer.invoke('autoPlanner:generate', input),
    approve: (input: {
      session_id: string
      shift_id: string
      proposedRuns: ProposedRun[]
    }): Promise<IpcResult<Run[]>> =>
      ipcRenderer.invoke('autoPlanner:approve', input)
  },

  // ── Window management ──────────────────────────────────────────────────
  window: {
    openDisplay: (): Promise<void> =>
      ipcRenderer.invoke('window:openDisplay')
  }
}

contextBridge.exposeInMainWorld('api', api)

export type AppApi = typeof api
