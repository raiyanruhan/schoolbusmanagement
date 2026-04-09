import { useEffect, useState } from 'react'
import { Bus, Route, Shift, Stop, RouteWithStops } from '../../shared/types'
import { useSessionStore } from '../store/sessionStore'
import { usePlannerStore } from '../store/plannerStore'
import { useUiStore } from '../store/uiStore'
import {
  Bus as BusIcon, MapPin, CheckCircle2, AlertTriangle, Trash2,
  ChevronRight, RefreshCw, ArrowRight, ArrowLeft
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import type { Run } from '../../shared/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function busStatusColor(status: string) {
  if (status === 'ACTIVE') return 'border-green-200 bg-green-50'
  if (status === 'MAINTENANCE') return 'border-yellow-200 bg-yellow-50'
  return 'border-gray-200 bg-gray-50'
}

// ─── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({ run, buses, routes, shifts, onDelete }: {
  run: Run
  buses: Bus[]
  routes: Route[]
  shifts: Shift[]
  onDelete: (id: string) => void
}) {
  const bus = buses.find((b) => b.id === run.bus_id)
  const route = routes.find((r) => r.id === run.route_id)
  const shift = shifts.find((s) => s.id === run.shift_id)

  return (
    <div className="card p-4 flex items-center gap-4">
      <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
        <BusIcon className="w-5 h-5 text-brand-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">{bus?.number ?? '—'}</span>
          <ChevronRight className="w-3 h-3 text-gray-300" />
          <span className="text-sm text-gray-600 truncate">{route?.name ?? '—'}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span>{shift?.name ?? '—'}</span>
          <span>•</span>
          <span className={`font-medium ${run.direction === 'OUTBOUND' ? 'text-orange-600' : 'text-blue-600'}`}>
            {run.direction === 'OUTBOUND' ? <><ArrowRight className="w-3 h-3 inline" /> Outbound</> : <><ArrowLeft className="w-3 h-3 inline" /> Inbound</>}
          </span>
          <span>•</span>
          <span className="badge-gray">{run.status}</span>
        </div>
      </div>
      <button
        onClick={() => onDelete(run.id)}
        className="btn-ghost btn-sm p-2 text-red-400 hover:bg-red-50 hover:text-red-600 shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Capacity Bar ─────────────────────────────────────────────────────────────

function CapacityBar({ used, capacity, overload }: { used: number; capacity: number; overload: number }) {
  const max = capacity + overload
  const pct = Math.min((used / max) * 100, 100)
  const overPct = capacity > 0 ? Math.min((capacity / max) * 100, 100) : 100
  const isOver = used > capacity
  const isWay = used > max

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={isOver ? 'text-orange-600 font-medium' : 'text-gray-600'}>
          {used} / {capacity} seats {isOver && `(+${used - capacity} overload)`}
        </span>
        {isWay && <span className="text-red-600 font-medium flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Exceeds limit</span>}
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all ${isWay ? 'bg-red-500' : isOver ? 'bg-orange-400' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }}
        />
        {overload > 0 && (
          <div className="absolute top-0 h-full border-r-2 border-dashed border-gray-400" style={{ left: `${overPct}%` }} />
        )}
      </div>
    </div>
  )
}

// ─── Main Planner ─────────────────────────────────────────────────────────────

export default function Planner() {
  const { session } = useSessionStore()
  const { showToast } = useUiStore()
  const {
    buses, routes, shifts, runs, loading,
    selectedShift, selectedBus, selectedRoute, selectedStopIds, plannerDirection,
    loadData, setSelectedShift, setSelectedBus, setSelectedRoute,
    toggleStop, clearStopSelection, setDirection, confirmRun, deleteRun
  } = usePlannerStore()

  const [routeDetails, setRouteDetails] = useState<RouteWithStops | null>(null)
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (session) loadData(session.id)
  }, [session, loadData])

  useEffect(() => {
    if (selectedRoute) {
      window.api.route.getWithStops(selectedRoute.id).then((r) => {
        if (r.success) {
          setRouteDetails(r.data)
          setSelectedRoute(r.data)
        }
      })
    } else {
      setRouteDetails(null)
    }
  }, [selectedRoute?.id])

  const handleConfirmRun = async () => {
    if (!session) return
    setConfirming(true)
    const result = await confirmRun(session.id)
    setConfirming(false)
    if (result.success) {
      showToast('Run created successfully')
    } else {
      showToast(result.error ?? 'Failed to create run', 'error')
    }
  }

  const handleDeleteRun = async () => {
    if (!deleteRunId) return
    const result = await deleteRun(deleteRunId)
    setDeleteRunId(null)
    if (result.success) {
      showToast('Run deleted', 'info')
    } else {
      showToast(result.error ?? 'Failed to delete run', 'error')
    }
  }

  // Calculate student count for selected stops
  const selectedStopCount = routeDetails?.stops
    .filter((s) => selectedStopIds.includes(s.id))
    .length ?? 0

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE')
  const activeRoutes = routes.filter((r) => r.is_active)
  const activeShifts = shifts.filter((s) => s.is_active)

  if (!session) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin" />
          <p>Loading session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT PANEL: Buses + Route selection ─────────────────────────── */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="section-title">Manual Planner</h2>
          <p className="text-xs text-gray-400 mt-1">Session: {session.date}</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* Shift selector */}
          <div className="p-4">
            <label className="form-label">1. Select Shift</label>
            <div className="space-y-1 mt-2">
              {activeShifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedShift?.id === shift.id ? 'bg-brand-100 text-brand-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {shift.name}
                </button>
              ))}
              {activeShifts.length === 0 && <p className="text-xs text-gray-400">No active shifts</p>}
            </div>
          </div>

          {/* Direction selector */}
          <div className="p-4">
            <label className="form-label">2. Direction</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setDirection('OUTBOUND')}
                className={`flex-1 btn btn-sm ${plannerDirection === 'OUTBOUND' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ArrowRight className="w-3.5 h-3.5" /> Outbound
              </button>
              <button
                onClick={() => setDirection('INBOUND')}
                className={`flex-1 btn btn-sm ${plannerDirection === 'INBOUND' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Inbound
              </button>
            </div>
          </div>

          {/* Bus selector */}
          <div className="p-4">
            <label className="form-label">3. Select Bus</label>
            <div className="space-y-2 mt-2">
              {activeBuses.map((bus) => {
                const isSelected = selectedBus?.id === bus.id
                const isUsed = runs.some((r) => r.bus_id === bus.id && r.shift_id === selectedShift?.id)
                return (
                  <button
                    key={bus.id}
                    onClick={() => setSelectedBus(isSelected ? null : bus)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all
                      ${isSelected ? 'border-brand-500 bg-brand-50' : busStatusColor(bus.status)}
                      ${isUsed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{bus.number}</p>
                        <p className="text-xs text-gray-400">{bus.capacity} seats</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-brand-600 shrink-0" />}
                      {isUsed && <span className="text-xs text-orange-500">In use</span>}
                    </div>
                  </button>
                )
              })}
              {activeBuses.length === 0 && <p className="text-xs text-gray-400">No active buses</p>}
            </div>
          </div>

          {/* Route selector */}
          <div className="p-4">
            <label className="form-label">4. Select Route</label>
            <div className="space-y-1 mt-2">
              {activeRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRoute(selectedRoute?.id === route.id ? null : route as RouteWithStops)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors
                    ${selectedRoute?.id === route.id ? 'bg-brand-100 text-brand-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: route.color }} />
                  {route.name}
                </button>
              ))}
              {activeRoutes.length === 0 && <p className="text-xs text-gray-400">No active routes</p>}
            </div>
          </div>
        </div>
      </div>

      {/* ── CENTER PANEL: Stop selection ────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">
              {selectedRoute ? `Stops — ${selectedRoute.name}` : 'Select a route'}
            </h3>
            {selectedStopIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedStopIds.length} stop{selectedStopIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedStopIds.length > 0 && (
              <button onClick={clearStopSelection} className="btn-ghost btn-sm">Clear</button>
            )}
            <button
              onClick={handleConfirmRun}
              disabled={!selectedBus || !selectedRoute || !selectedShift || selectedStopIds.length === 0 || confirming}
              className="btn-primary btn-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              {confirming ? 'Saving...' : 'Confirm Run'}
            </button>
          </div>
        </div>

        {/* Capacity preview */}
        {selectedBus && (
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <CapacityBar
              used={selectedStopCount}
              capacity={selectedBus.capacity}
              overload={selectedShift?.default_overload ?? 0}
            />
          </div>
        )}

        {/* Stop list */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedRoute ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MapPin className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm">Select a route to see stops</p>
            </div>
          ) : routeDetails ? (
            <div className="space-y-2">
              {routeDetails.stops.filter((s) => s.is_active).map((stop, i) => {
                const isSelected = selectedStopIds.includes(stop.id)
                const isAssigned = runs.some((r) =>
                  r.shift_id === selectedShift?.id
                  // RunStop check would need to load stop details — simplified here
                )

                return (
                  <button
                    key={stop.id}
                    onClick={() => toggleStop(stop.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all
                      ${isSelected
                        ? 'border-brand-500 bg-brand-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0
                        ${isSelected ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{stop.name}</p>
                        {stop.name_bn && <p className="text-xs text-gray-400">{stop.name_bn}</p>}
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-brand-500 shrink-0" />}
                    </div>
                  </button>
                )
              })}
              {routeDetails.stops.filter((s) => s.is_active).length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">No active stops on this route</div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 text-sm py-8">Loading stops...</div>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Today's runs ───────────────────────────────────── */}
      <div className="w-80 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-white">
          <h3 className="font-semibold text-gray-800">Today's Runs</h3>
          <p className="text-xs text-gray-400 mt-0.5">{runs.length} run{runs.length !== 1 ? 's' : ''} planned</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="text-center text-gray-400 text-sm py-8">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              <BusIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>No runs yet</p>
              <p className="text-xs mt-1">Create a run using the planner</p>
            </div>
          ) : (
            runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                buses={buses}
                routes={routes}
                shifts={shifts}
                onDelete={setDeleteRunId}
              />
            ))
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteRunId}
        onClose={() => setDeleteRunId(null)}
        onConfirm={handleDeleteRun}
        title="Delete Run"
        message="Are you sure you want to delete this run? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
