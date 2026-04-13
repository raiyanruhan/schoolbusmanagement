import { create } from 'zustand'
import type { Bus, Route, Shift, Run, RouteWithStops, RunGender } from '../../shared/types'

interface PlannerState {
  // Data
  buses: Bus[]
  routes: Route[]
  shifts: Shift[]
  runs: Run[]

  // Selection state
  selectedShift: Shift | null
  selectedBus: Bus | null
  selectedRoute: RouteWithStops | null
  selectedStopIds: string[]
  plannerDirection: 'INBOUND' | 'OUTBOUND'
  selectedGender: RunGender

  // Loading
  loading: boolean
  error: string | null

  // Actions
  loadData: (sessionId: string) => Promise<void>
  setSelectedShift: (shift: Shift | null) => void
  setSelectedBus: (bus: Bus | null) => void
  setSelectedRoute: (route: RouteWithStops | null) => void
  toggleStop: (stopId: string) => void
  clearStopSelection: () => void
  setDirection: (dir: 'INBOUND' | 'OUTBOUND') => void
  setGender: (gender: RunGender) => void
  confirmRun: (sessionId: string) => Promise<{ success: boolean; error?: string }>
  deleteRun: (runId: string) => Promise<{ success: boolean; error?: string }>
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  buses: [],
  routes: [],
  shifts: [],
  runs: [],
  selectedShift: null,
  selectedBus: null,
  selectedRoute: null,
  selectedStopIds: [],
  plannerDirection: 'OUTBOUND',
  selectedGender: 'MIXED',
  loading: false,
  error: null,

  loadData: async (sessionId: string) => {
    set({ loading: true, error: null })
    const [busResult, routeResult, shiftResult, runResult] = await Promise.all([
      window.api.bus.getAll(),
      window.api.route.getAll(),
      window.api.shift.getAll(),
      window.api.planner.getRuns(sessionId)
    ])

    set({
      buses: busResult.success ? busResult.data : [],
      routes: routeResult.success ? routeResult.data : [],
      shifts: shiftResult.success ? shiftResult.data : [],
      runs: runResult.success ? runResult.data : [],
      loading: false
    })
  },

  setSelectedShift: (shift) => {
    // When shift changes, reset gender to the appropriate default
    const defaultGender: RunGender =
      shift?.gender_mode === 'SEPARATED' ? 'BOYS' : 'MIXED'
    set({ selectedShift: shift, selectedGender: defaultGender, selectedStopIds: [] })
  },
  setSelectedBus: (bus) => set({ selectedBus: bus, selectedStopIds: [] }),
  setSelectedRoute: (route) => set({ selectedRoute: route, selectedStopIds: [] }),

  toggleStop: (stopId: string) => {
    const { selectedStopIds, selectedRoute } = get()
    if (!selectedRoute) return

    const stops = selectedRoute.stops.filter((s) => s.is_active)
    const stopIndex = stops.findIndex((s) => s.id === stopId)

    if (selectedStopIds.includes(stopId)) {
      // Deselect — remove and trim to maintain contiguity
      const newIds = selectedStopIds.filter((id) => id !== stopId)
      // If this was start or end, keep inner ones; if middle, split — just clear
      const indices = newIds.map((id) => stops.findIndex((s) => s.id === id)).sort((a, b) => a - b)
      let contiguous = true
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) { contiguous = false; break }
      }
      set({ selectedStopIds: contiguous ? newIds : [] })
    } else {
      if (selectedStopIds.length === 0) {
        set({ selectedStopIds: [stopId] })
      } else {
        // Extend selection only if adjacent
        const currentIndices = selectedStopIds
          .map((id) => stops.findIndex((s) => s.id === id))
          .sort((a, b) => a - b)
        const min = currentIndices[0]
        const max = currentIndices[currentIndices.length - 1]

        if (stopIndex === min - 1 || stopIndex === max + 1) {
          const newIds = [...selectedStopIds, stopId]
          set({ selectedStopIds: newIds })
        } else {
          // Non-adjacent: start fresh from this stop
          set({ selectedStopIds: [stopId] })
        }
      }
    }
  },

  clearStopSelection: () => set({ selectedStopIds: [] }),
  setDirection: (dir) => set({ plannerDirection: dir }),
  setGender: (gender) => set({ selectedGender: gender }),

  confirmRun: async (sessionId: string) => {
    const { selectedBus, selectedRoute, selectedShift, selectedStopIds, plannerDirection, selectedGender } = get()
    if (!selectedBus || !selectedRoute || !selectedShift || selectedStopIds.length === 0) {
      return { success: false, error: 'Please select a bus, route, shift, and at least one stop' }
    }

    // Sort stop IDs by sequence order
    const stops = selectedRoute.stops
    const orderedStopIds = selectedStopIds.sort((a, b) => {
      const ai = stops.findIndex((s) => s.id === a)
      const bi = stops.findIndex((s) => s.id === b)
      return ai - bi
    })

    // Derive gender from shift mode if not explicitly overridden
    const gender: RunGender =
      selectedShift.gender_mode === 'COMBINED' ? 'MIXED' : selectedGender

    const result = await window.api.planner.createRun({
      session_id: sessionId,
      shift_id: selectedShift.id,
      bus_id: selectedBus.id,
      route_id: selectedRoute.id,
      direction: plannerDirection,
      gender,
      stop_ids: orderedStopIds
    })

    if (result.success) {
      const runs = get().runs
      set({ runs: [...runs, result.data], selectedStopIds: [], selectedBus: null })
      return { success: true }
    }
    return { success: false, error: result.error }
  },

  deleteRun: async (runId: string) => {
    const result = await window.api.planner.deleteRun(runId)
    if (result.success) {
      set((state) => ({ runs: state.runs.filter((r) => r.id !== runId) }))
      return { success: true }
    }
    return { success: false, error: result.error }
  }
}))
