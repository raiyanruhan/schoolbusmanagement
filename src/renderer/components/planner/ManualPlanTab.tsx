import { useEffect, useState } from 'react'
import { Bus as BusIcon, MapPin, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button, Text, Heading, Label, Spinner } from '@primer/react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { RunCard, busStatusBorderColor } from './RunCard'
import { CapacityBar } from './CapacityBar'
import { usePlannerStore } from '../../store/plannerStore'
import { useUiStore } from '../../store/uiStore'
import type { RouteWithStops, StopConfig, Conflict } from '../../../shared/types'

export function ManualPlanTab({
  session,
  conflicts,
  onRunChanged,
}: {
  session: { id: string; date: string }
  conflicts: Conflict[]
  onRunChanged: () => void
}) {
  const { showToast } = useUiStore()
  const {
    buses, routes, shifts, runs, loading,
    selectedShift, selectedBus, selectedRoute, selectedStopIds, plannerDirection, selectedGender,
    setSelectedShift, setSelectedBus, setSelectedRoute, toggleStop, clearStopSelection,
    setDirection, setGender, confirmRun, deleteRun,
  } = usePlannerStore()

  const [routeDetails, setRouteDetails] = useState<RouteWithStops | null>(null)
  const [stopConfigs, setStopConfigs] = useState<StopConfig[]>([])
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (selectedRoute) {
      window.api.route.getWithStops(selectedRoute.id).then((r) => {
        if (r.success) { setRouteDetails(r.data); setSelectedRoute(r.data) }
      })
    } else {
      setRouteDetails(null)
    }
  }, [selectedRoute?.id])

  useEffect(() => {
    if (!selectedShift) { setStopConfigs([]); return }
    window.api.shift.getStopConfigs(selectedShift.id).then((r) => {
      if (r.success) setStopConfigs(r.data)
    })
  }, [selectedShift?.id])

  const handleConfirmRun = async () => {
    setConfirming(true)
    const result = await confirmRun(session.id)
    setConfirming(false)
    if (result.success) { showToast('Run created successfully'); onRunChanged() }
    else showToast(result.error ?? 'Failed to create run', 'error')
  }

  const handleDeleteRun = async () => {
    if (!deleteRunId) return
    const result = await deleteRun(deleteRunId)
    setDeleteRunId(null)
    if (result.success) { showToast('Run deleted', 'info'); onRunChanged() }
    else showToast(result.error ?? 'Failed to delete run', 'error')
  }

  const selectedStudentCount = routeDetails?.stops
    .filter((s) => selectedStopIds.includes(s.id))
    .reduce((sum, stop) => {
      const cfg = stopConfigs.find((c) => c.stop_id === stop.id)
      return sum + (cfg ? cfg.planned_boys + cfg.planned_girls : 0)
    }, 0) ?? 0

  const activeBuses = buses.filter((b) => b.status === 'ACTIVE')
  const activeRoutes = routes.filter((r) => r.is_active)
  const activeShifts = shifts.filter((s) => s.is_active)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* LEFT PANEL: Config */}
      <div style={{ width: 320, borderRight: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Shift */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>1. Select Shift</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeShifts.map((shift) => (
                <button
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className="hov-bg-subtle"
                  style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 6, fontSize: 14, border: 'none', cursor: 'pointer', background: selectedShift?.id === shift.id ? 'var(--bgColor-accent-muted)' : 'transparent', color: selectedShift?.id === shift.id ? 'var(--fgColor-accent)' : 'var(--fgColor-default)', fontWeight: selectedShift?.id === shift.id ? 600 : 400 }}
                >
                  {shift.name}
                </button>
              ))}
              {activeShifts.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active shifts</Text>}
            </div>
          </div>

          {/* Direction */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>2. Direction</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" variant={plannerDirection === 'OUTBOUND' ? 'primary' : 'default'} leadingVisual={ArrowRight} onClick={() => setDirection('OUTBOUND')} style={{ flex: 1 }}>Outbound</Button>
              <Button size="small" variant={plannerDirection === 'INBOUND' ? 'primary' : 'default'} leadingVisual={ArrowLeft} onClick={() => setDirection('INBOUND')} style={{ flex: 1 }}>Inbound</Button>
            </div>
          </div>

          {/* Bus selector */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>3. Select Bus</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeBuses.map((bus) => {
                const isSelected = selectedBus?.id === bus.id
                const isUsed = runs.some((r) => r.bus_id === bus.id && r.shift_id === selectedShift?.id)
                return (
                  <button
                    key={bus.id}
                    onClick={() => setSelectedBus(isSelected ? null : bus)}
                    className="hov-bg-subtle"
                    style={{ textAlign: 'left', borderRadius: 6, border: `2px solid ${isSelected ? 'var(--borderColor-accent-emphasis)' : busStatusBorderColor(bus.status)}`, cursor: 'pointer', background: 'transparent', padding: '8px 12px', opacity: isUsed ? 0.6 : 1 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text sx={{ fontSize: 1, fontWeight: 'semibold' }}>
                        {bus.number} <Text sx={{ color: 'fg.muted', fontWeight: 'normal' }}>({bus.capacity} seats)</Text>
                      </Text>
                      {isSelected && <CheckCircle2 size={15} style={{ color: 'var(--fgColor-accent)' }} />}
                      {isUsed && !isSelected && <Label variant="attention">In use</Label>}
                    </div>
                  </button>
                )
              })}
              {activeBuses.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active buses</Text>}
            </div>
          </div>

          {/* Route selector */}
          <div style={{ padding: 16 }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>4. Select Route</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRoute(selectedRoute?.id === route.id ? null : (route as RouteWithStops))}
                  className="hov-bg-subtle"
                  style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 6, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: selectedRoute?.id === route.id ? 'var(--bgColor-accent-muted)' : 'transparent', color: selectedRoute?.id === route.id ? 'var(--fgColor-accent)' : 'var(--fgColor-default)', fontWeight: selectedRoute?.id === route.id ? 600 : 400 }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: route.color }} />
                  {route.name}
                </button>
              ))}
              {activeRoutes.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active routes</Text>}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER PANEL: Stop selection */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <Heading as="h3" sx={{ fontSize: 2 }}>{selectedRoute ? `Stops — ${selectedRoute.name}` : 'Select a route'}</Heading>
            {selectedStopIds.length > 0 && (
              <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>
                {selectedStopIds.length} stop{selectedStopIds.length !== 1 ? 's' : ''} selected
                {selectedStudentCount > 0 && ` · ${selectedStudentCount} students`}
              </Text>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {selectedShift && selectedShift.gender_mode !== 'COMBINED' && (
              <div style={{ display: 'flex', border: '1px solid var(--borderColor-default)', borderRadius: 6, overflow: 'hidden' }}>
                {(['BOYS', 'GIRLS', 'MIXED'] as const)
                  .filter((g) => selectedShift.gender_mode === 'AUTO' || g !== 'MIXED')
                  .map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      style={{ padding: '4px 8px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: selectedGender === g ? (g === 'BOYS' ? 'var(--bgColor-accent-emphasis)' : g === 'GIRLS' ? '#db2777' : 'var(--bgColor-done-emphasis)') : 'transparent', color: selectedGender === g ? 'white' : 'var(--fgColor-muted)' }}
                    >
                      {g === 'BOYS' ? 'B' : g === 'GIRLS' ? 'G' : 'M'}
                    </button>
                  ))}
              </div>
            )}
            {selectedStopIds.length > 0 && <Button size="small" variant="invisible" onClick={clearStopSelection}>Clear</Button>}
            <Button size="small" variant="primary" leadingVisual={CheckCircle2} disabled={!selectedBus || !selectedRoute || !selectedShift || selectedStopIds.length === 0 || confirming} onClick={handleConfirmRun}>
              {confirming ? 'Saving...' : 'Confirm Run'}
            </Button>
          </div>
        </div>

        {selectedBus && selectedRoute && (
          <div style={{ padding: '8px 16px', background: 'var(--bgColor-muted)', borderBottom: '1px solid var(--borderColor-default)' }}>
            <CapacityBar used={selectedStudentCount} capacity={selectedBus.capacity} overload={selectedShift?.default_overload ?? 0} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {!selectedRoute ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fgColor-muted)' }}>
              <MapPin size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1 }}>Select a route to see stops</Text>
            </div>
          ) : routeDetails ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {routeDetails.stops.filter((s) => s.is_active).map((stop, i) => {
                const isSelected = selectedStopIds.includes(stop.id)
                const cfg = stopConfigs.find((c) => c.stop_id === stop.id)
                const boys = cfg?.planned_boys ?? 0
                const girls = cfg?.planned_girls ?? 0
                const total = boys + girls
                return (
                  <button
                    key={stop.id}
                    onClick={() => toggleStop(stop.id)}
                    style={{ textAlign: 'left', padding: 16, borderRadius: 6, border: `2px solid ${isSelected ? 'var(--borderColor-accent-emphasis)' : 'var(--borderColor-default)'}`, cursor: 'pointer', background: isSelected ? 'var(--bgColor-accent-muted)' : 'var(--bgColor-default)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isSelected ? 'var(--bgColor-accent-emphasis)' : 'var(--bgColor-muted)', color: isSelected ? 'white' : 'var(--fgColor-muted)' }}>
                        <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text sx={{ fontSize: 1, fontWeight: 'medium', display: 'block' }}>{stop.name}</Text>
                        {stop.name_bn && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{stop.name_bn}</Text>}
                      </div>
                      {stopConfigs.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          {boys > 0 && <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'accent.fg' }}>B:{boys}</Text>}
                          {girls > 0 && <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'sponsors.fg' }}>G:{girls}</Text>}
                          {total === 0 && cfg && <Text sx={{ fontSize: 0, color: 'fg.subtle' }}>0</Text>}
                        </div>
                      )}
                      {isSelected && <CheckCircle2 size={20} style={{ color: 'var(--fgColor-accent)', flexShrink: 0 }} />}
                    </div>
                  </button>
                )
              })}
              {routeDetails.stops.filter((s) => s.is_active).length === 0 && (
                <Text sx={{ textAlign: 'center', color: 'fg.muted', fontSize: 1, py: 4, display: 'block' }}>No active stops on this route</Text>
              )}
            </div>
          ) : (
            <Text sx={{ textAlign: 'center', color: 'fg.muted', fontSize: 1, py: 4, display: 'block' }}>Loading stops...</Text>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Today's runs */}
      <div style={{ width: 288, borderLeft: '1px solid var(--borderColor-default)', background: 'var(--bgColor-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)', background: 'var(--bgColor-default)' }}>
          <Heading as="h3" sx={{ fontSize: 2 }}>Today's Runs</Heading>
          <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>{runs.length} run{runs.length !== 1 ? 's' : ''} planned</Text>
        </div>

        {conflicts.length > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid', background: conflicts.some((c) => c.severity === 'CRITICAL') ? 'var(--bgColor-danger-muted)' : 'var(--bgColor-attention-muted)', borderColor: conflicts.some((c) => c.severity === 'CRITICAL') ? 'var(--borderColor-danger-muted)' : 'var(--borderColor-attention-muted)' }}>
            <AlertTriangle size={14} />
            <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: conflicts.some((c) => c.severity === 'CRITICAL') ? 'danger.fg' : 'attention.fg' }}>
              {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
            </Text>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--fgColor-muted)', padding: '16px 0' }}><Spinner /></div>
          ) : runs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--fgColor-muted)', padding: '16px 0' }}>
              <BusIcon size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1, display: 'block' }}>No runs yet</Text>
              <Text sx={{ fontSize: 0, mt: 1 }}>Create a run using the planner</Text>
            </div>
          ) : (
            runs.map((run) => (
              <RunCard key={run.id} run={run} buses={buses} routes={routes} shifts={shifts} conflicts={conflicts} onDelete={setDeleteRunId} />
            ))
          )}
        </div>
      </div>

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
