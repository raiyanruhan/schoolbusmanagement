import { useEffect, useState } from 'react'
import type {
  Bus, Route, Shift, RouteWithStops, Run,
  EngineOutput, ProposedRun, AssignmentStrategy, RunDirection
} from '../../shared/types'
import { useSessionStore } from '../store/sessionStore'
import { usePlannerStore } from '../store/plannerStore'
import { useUiStore } from '../store/uiStore'
import {
  Bus as BusIcon, MapPin, CheckCircle2, AlertTriangle, Trash2,
  ChevronRight, RefreshCw, ArrowRight, ArrowLeft,
  Zap, Users, AlertCircle, ChevronDown, ChevronUp, Info
} from 'lucide-react'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import TopBar from '../components/ui/TopBar'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function busStatusColor(status: string) {
  if (status === 'ACTIVE') return 'border-green-200 bg-green-50'
  if (status === 'MAINTENANCE') return 'border-yellow-200 bg-yellow-50'
  return 'border-gray-200 bg-gray-50'
}

// ─── Run Card (manual panel) ──────────────────────────────────────────────────

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
            {run.direction === 'OUTBOUND'
              ? <><ArrowRight className="w-3 h-3 inline" /> Outbound</>
              : <><ArrowLeft className="w-3 h-3 inline" /> Inbound</>}
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

// ─── Proposed Run Card (auto-plan) ────────────────────────────────────────────

function ProposedRunCard({ pr, buses }: { pr: ProposedRun; buses: Bus[] }) {
  const [expanded, setExpanded] = useState(false)
  const bus = buses.find((b) => b.id === pr.bus_id)
  const genderColors: Record<string, string> = {
    BOYS: 'bg-blue-100 text-blue-700',
    GIRLS: 'bg-pink-100 text-pink-700',
    MIXED: 'bg-purple-100 text-purple-700'
  }
  const pct = Math.min((pr.totalStudents / (pr.capacity + pr.overload_limit)) * 100, 100)
  const isOver = pr.totalStudents > pr.capacity

  return (
    <div className={`border-2 rounded-xl overflow-hidden transition-all ${pr.isOverloaded ? 'border-orange-300' : 'border-gray-200'}`}>
      {/* Color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: pr.route_color }} />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center shrink-0">
              <BusIcon className="w-5 h-5 text-brand-700" />
            </div>
            <div>
              <p className="font-bold text-gray-900">{bus?.number ?? pr.bus_number}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pr.route_color }} />
                <p className="text-xs text-gray-600">{pr.route_name}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${genderColors[pr.gender] ?? 'bg-gray-100 text-gray-600'}`}>
              {pr.gender}
            </span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pr.direction === 'OUTBOUND' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
              {pr.direction}
            </span>
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs mb-1">
            <span className={isOver ? 'text-orange-600 font-medium' : 'text-gray-600'}>
              {pr.totalStudents} / {pr.capacity} students
              {isOver && ` (+${pr.totalStudents - pr.capacity} over)`}
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pr.isOverloaded ? 'bg-red-500' : isOver ? 'bg-orange-400' : 'bg-green-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* Warnings */}
        {pr.warnings.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {pr.warnings.map((w, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                w.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {w.type.replace('_', ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Stops toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span>{pr.stops.length} stop{pr.stops.length !== 1 ? 's' : ''}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="mt-2 space-y-1">
            {pr.stops.map((s, i) => (
              <div key={s.stop_id} className="flex items-center justify-between text-xs py-1 border-t border-gray-100">
                <div className="flex items-center gap-2 text-gray-600">
                  <span className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center font-mono text-gray-500 shrink-0">{i + 1}</span>
                  <span>{s.stop_name}</span>
                </div>
                <span className="font-medium text-gray-800">{s.student_count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Auto-Plan Tab ────────────────────────────────────────────────────────────

function AutoPlanTab({
  session,
  shifts,
  buses,
  runs,
  onRunsCreated
}: {
  session: { id: string; date: string }
  shifts: Shift[]
  buses: Bus[]
  runs: Run[]
  onRunsCreated: () => void
}) {
  const { showToast } = useUiStore()
  const activeShifts = shifts.filter((s) => s.is_active)

  const [selectedShiftId, setSelectedShiftId] = useState<string>(activeShifts[0]?.id ?? '')
  const [direction, setDirection] = useState<RunDirection>('OUTBOUND')
  const [strategy, setStrategy] = useState<AssignmentStrategy>('LARGEST_ROUTE_FIRST')
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [plan, setPlan] = useState<EngineOutput | null>(null)
  const [discardConfirm, setDiscardConfirm] = useState(false)

  const handleGenerate = async () => {
    if (!selectedShiftId) return
    setGenerating(true)
    setPlan(null)
    const res = await window.api.autoPlanner.generate({
      session_id: session.id,
      shift_id: selectedShiftId,
      direction,
      strategy
    })
    setGenerating(false)
    if (res.success) {
      setPlan(res.data)
    } else {
      showToast(res.error ?? 'Failed to generate plan', 'error')
    }
  }

  const handleApprove = async () => {
    if (!plan || !selectedShiftId) return
    setApproving(true)
    const res = await window.api.autoPlanner.approve({
      session_id: session.id,
      shift_id: selectedShiftId,
      proposedRuns: plan.proposedRuns
    })
    setApproving(false)
    if (res.success) {
      showToast(`${res.data.length} run${res.data.length !== 1 ? 's' : ''} saved successfully`)
      setPlan(null)
      onRunsCreated()
    } else {
      showToast(res.error ?? 'Failed to approve plan', 'error')
    }
  }

  const criticalWarnings = plan?.warnings.filter((w) => w.severity === 'CRITICAL') ?? []
  const normalWarnings = plan?.warnings.filter((w) => w.severity === 'WARNING') ?? []

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── LEFT: Config ──────────────────────────────────────────────── */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="section-title">Auto Planner</h2>
          <p className="text-xs text-gray-400 mt-1">AI-assisted run generation</p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {/* Shift */}
          <div className="p-4">
            <label className="form-label">Shift</label>
            <div className="space-y-1 mt-2">
              {activeShifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedShiftId(s.id); setPlan(null) }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors
                    ${selectedShiftId === s.id ? 'bg-brand-100 text-brand-800 font-medium' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  {s.name}
                </button>
              ))}
              {activeShifts.length === 0 && <p className="text-xs text-gray-400">No active shifts</p>}
            </div>
          </div>

          {/* Direction */}
          <div className="p-4">
            <label className="form-label">Direction</label>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => { setDirection('OUTBOUND'); setPlan(null) }}
                className={`flex-1 btn btn-sm ${direction === 'OUTBOUND' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ArrowRight className="w-3.5 h-3.5" /> Out
              </button>
              <button
                onClick={() => { setDirection('INBOUND'); setPlan(null) }}
                className={`flex-1 btn btn-sm ${direction === 'INBOUND' ? 'btn-primary' : 'btn-secondary'}`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> In
              </button>
            </div>
          </div>

          {/* Strategy */}
          <div className="p-4">
            <label className="form-label">Assignment Strategy</label>
            <select
              value={strategy}
              onChange={(e) => { setStrategy(e.target.value as AssignmentStrategy); setPlan(null) }}
              className="form-input mt-2"
            >
              <option value="LARGEST_ROUTE_FIRST">Largest Route First</option>
              <option value="SMALLEST_ROUTE_FIRST">Smallest Route First</option>
              <option value="SEQUENCE_ORDER">Sequence Order</option>
            </select>
            <p className="text-xs text-gray-400 mt-1.5">
              {strategy === 'LARGEST_ROUTE_FIRST' && 'Fill buses with highest-student routes first'}
              {strategy === 'SMALLEST_ROUTE_FIRST' && 'Fill buses with lowest-student routes first'}
              {strategy === 'SEQUENCE_ORDER' && 'Assign buses in route order'}
            </p>
          </div>

          {/* Info */}
          <div className="p-4">
            <div className="flex gap-2 text-xs text-gray-500 bg-blue-50 rounded-lg p-3">
              <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
              <span>Gender separation is controlled by shift settings. Capacity limits and overload are applied automatically.</span>
            </div>
          </div>
        </div>

        {/* Generate button */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleGenerate}
            disabled={!selectedShiftId || generating}
            className="btn-primary w-full"
          >
            {generating ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Zap className="w-4 h-4" /> Generate Plan</>
            )}
          </button>
        </div>
      </div>

      {/* ── CENTER: Proposed runs ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!plan ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            {generating ? (
              <>
                <RefreshCw className="w-10 h-10 mb-3 animate-spin text-brand-400" />
                <p className="text-sm font-medium text-gray-600">Generating plan...</p>
              </>
            ) : (
              <>
                <Zap className="w-10 h-10 mb-3 text-gray-300" />
                <p className="text-sm font-medium">Configure and generate a plan</p>
                <p className="text-xs mt-1">Select a shift and direction, then click Generate</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center gap-6 text-sm shrink-0">
              <div className="flex items-center gap-1.5 text-gray-700">
                <BusIcon className="w-4 h-4 text-brand-500" />
                <span className="font-semibold">{plan.summary.totalBusesUsed}</span>
                <span className="text-gray-400">buses</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <Users className="w-4 h-4 text-green-500" />
                <span className="font-semibold">{plan.summary.totalStudentsAssigned}</span>
                <span className="text-gray-400">assigned</span>
              </div>
              {plan.summary.totalStudentsUnassigned > 0 && (
                <div className="flex items-center gap-1.5 text-red-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-semibold">{plan.summary.totalStudentsUnassigned}</span>
                  <span className="text-red-400">unassigned</span>
                </div>
              )}
              {plan.summary.overloadedRuns > 0 && (
                <div className="flex items-center gap-1.5 text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-semibold">{plan.summary.overloadedRuns}</span>
                  <span className="text-orange-400">overloaded</span>
                </div>
              )}
              {plan.summary.splitRoutes > 0 && (
                <div className="flex items-center gap-1.5 text-blue-600">
                  <MapPin className="w-4 h-4" />
                  <span className="font-semibold">{plan.summary.splitRoutes}</span>
                  <span className="text-blue-400">split</span>
                </div>
              )}
            </div>

            {/* Proposed run cards */}
            <div className="flex-1 overflow-y-auto p-4">
              {plan.proposedRuns.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <BusIcon className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">No runs could be generated</p>
                  <p className="text-xs mt-1">Check stop configs and bus availability</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {plan.proposedRuns.map((pr) => (
                    <ProposedRunCard key={pr.temp_id} pr={pr} buses={buses} />
                  ))}
                </div>
              )}

              {/* Unassigned stops */}
              {plan.unassignedStops.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Unassigned Stops ({plan.unassignedStops.length})
                  </h4>
                  <div className="space-y-2">
                    {plan.unassignedStops.map((us) => (
                      <div key={us.stop_id} className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-red-800">{us.stop_name}</p>
                            <p className="text-red-600 mt-0.5">{us.route_name}</p>
                          </div>
                          <span className="text-red-500 shrink-0">{us.planned_boys + us.planned_girls} students</span>
                        </div>
                        <p className="text-red-500 mt-1.5 italic">{us.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT: Actions + Warnings ─────────────────────────────────── */}
      <div className="w-72 border-l border-gray-200 bg-gray-50 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-white">
          <h3 className="font-semibold text-gray-800">Plan Actions</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {plan ? (
            <>
              {/* Action buttons */}
              <div className="space-y-2">
                <button
                  onClick={handleApprove}
                  disabled={approving || plan.proposedRuns.length === 0}
                  className="btn-primary w-full"
                >
                  {approving ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <><CheckCircle2 className="w-4 h-4" /> Approve & Save</>
                  )}
                </button>
                <button
                  onClick={() => setDiscardConfirm(true)}
                  className="btn-secondary w-full"
                >
                  Discard Plan
                </button>
              </div>

              {/* Warnings */}
              {(criticalWarnings.length > 0 || normalWarnings.length > 0) && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Warnings</p>
                  <div className="space-y-2">
                    {criticalWarnings.map((w, i) => (
                      <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-red-700 mb-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          {w.type.replace('_', ' ')}
                        </div>
                        <p className="text-red-600">{w.message}</p>
                        {w.context && <p className="text-red-400 mt-0.5 italic">{w.context}</p>}
                      </div>
                    ))}
                    {normalWarnings.map((w, i) => (
                      <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-yellow-700 mb-0.5">
                          <AlertCircle className="w-3 h-3" />
                          {w.type.replace('_', ' ')}
                        </div>
                        <p className="text-yellow-700">{w.message}</p>
                        {w.context && <p className="text-yellow-500 mt-0.5 italic">{w.context}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {plan.warnings.length === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  No warnings — plan looks good!
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-400 text-sm py-6">
              <Zap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p>Generate a plan to see actions</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={discardConfirm}
        onClose={() => setDiscardConfirm(false)}
        onConfirm={() => { setPlan(null); setDiscardConfirm(false) }}
        title="Discard Plan"
        message="Are you sure you want to discard this plan? No runs will be saved."
        confirmLabel="Discard"
        danger
      />
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
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')

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

  const selectedStopCount = routeDetails?.stops
    .filter((s) => selectedStopIds.includes(s.id))
    .length ?? 0

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE')
  const activeRoutes = routes.filter((r) => r.is_active)
  const activeShifts = shifts.filter((s) => s.is_active)

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <TopBar showBack backTo="/" backLabel="Home" title="Planner" />
        <div className="flex items-center justify-center flex-1 text-gray-400">
          <div className="text-center">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin" />
            <p>Loading session...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col overflow-hidden">
      <TopBar showBack backTo="/" backLabel="Home" title={`Planner — ${session.date}`} />

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-6 flex items-center gap-1 shrink-0">
        {(['manual', 'auto'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'manual' ? (
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Manual</span>
            ) : (
              <span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Auto-Plan</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'manual' ? (
        <div className="flex flex-1 overflow-hidden border-t border-gray-100">
          {/* ── LEFT PANEL: Buses + Route selection ─────────────────────── */}
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

          {/* ── CENTER PANEL: Stop selection ──────────────────────────── */}
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

          {/* ── RIGHT PANEL: Today's runs ────────────────────────────── */}
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
        </div>
      ) : (
        <AutoPlanTab
          session={session}
          shifts={shifts}
          buses={buses}
          runs={runs}
          onRunsCreated={() => loadData(session.id)}
        />
      )}

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
