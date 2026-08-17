import { useEffect, useState, useMemo } from 'react'
import { Bus as BusIcon, MapPin, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from 'lucide-react'
import { Button, Text, Heading, Spinner, SelectPanel, ActionMenu, ActionList, type SelectPanelItemInput } from '@primer/react'
import { TriangleDownIcon } from '@primer/octicons-react'
import { CapacityBar } from './CapacityBar'
import { usePlannerStore } from '../../store/plannerStore'
import { useUiStore } from '../../store/uiStore'
import type { RouteWithStops, StopConfig, Conflict, RunWithDetails } from '../../../shared/types'

type TableRow = { key: string; stopNames: string; boysBus: string; girlsBus: string }

function buildTableRows(details: RunWithDetails[], shiftId?: string | null): TableRow[] {
  const filtered = shiftId ? details.filter((r) => r.shift_id === shiftId) : details
  // group stops by (boysBus, girlsBus) combo key
  const groupMap = new Map<string, { stops: Map<string, { name: string; seq: number }>; boysBus: string; girlsBus: string }>()
  for (const run of filtered) {
    const busNum = run.bus?.number ?? '—'
    // determine combo key after merging with existing entry for this run's stops
    for (const rs of run.stops) {
      // find or create a group that matches this stop's current assignment
      // We key groups by route+gender so stops in same route share a group
      const groupKey = run.route_id + '|' + (run.gender === 'BOYS' ? 'B' : run.gender === 'GIRLS' ? 'G' : 'M')
      if (!groupMap.has(groupKey)) groupMap.set(groupKey, { stops: new Map(), boysBus: '', girlsBus: '' })
      const g = groupMap.get(groupKey)!
      if (run.gender === 'BOYS' || run.gender === 'MIXED') g.boysBus = busNum
      if (run.gender === 'GIRLS' || run.gender === 'MIXED') g.girlsBus = busNum
      if (!g.stops.has(rs.stop_id)) g.stops.set(rs.stop_id, { name: rs.stop?.name ?? rs.stop_id, seq: rs.stop?.sequence_order ?? rs.sequence_order })
    }
  }
  // merge groups with same route (combine boys+girls into one row per route)
  const routeMerge = new Map<string, { stops: Map<string, { name: string; seq: number }>; boysBus: string; girlsBus: string }>()
  for (const [groupKey, g] of groupMap) {
    const routeId = groupKey.split('|')[0]
    if (!routeMerge.has(routeId)) routeMerge.set(routeId, { stops: new Map(), boysBus: '', girlsBus: '' })
    const m = routeMerge.get(routeId)!
    if (g.boysBus) m.boysBus = g.boysBus
    if (g.girlsBus) m.girlsBus = g.girlsBus
    for (const [id, s] of g.stops) if (!m.stops.has(id)) m.stops.set(id, s)
  }
  const rows: TableRow[] = []
  for (const [routeId, m] of routeMerge) {
    const names = [...m.stops.values()].sort((a, b) => a.seq - b.seq).map((s) => s.name).join(', ')
    rows.push({ key: routeId, stopNames: names, boysBus: m.boysBus, girlsBus: m.girlsBus })
  }
  return rows.sort((a, b) => a.stopNames.localeCompare(b.stopNames))
}

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
    setDirection, setGender, confirmRun,
  } = usePlannerStore()

  const [routeDetails, setRouteDetails] = useState<RouteWithStops | null>(null)
  const [stopConfigs, setStopConfigs] = useState<StopConfig[]>([])
  const [runDetails, setRunDetails] = useState<RunWithDetails[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busPickerOpen, setBusPickerOpen] = useState(false)
  const [busFilter, setBusFilter] = useState('')

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

  const runIds = useMemo(() => runs.map((r) => r.id).join(','), [runs])
  useEffect(() => {
    window.api.planner.getAllRunsWithDetails(session.id).then((r) => {
      if (r.success) setRunDetails(r.data)
    })
  }, [session.id, runIds])

  const handleConfirmRun = async () => {
    setConfirming(true)
    const result = await confirmRun(session.id)
    setConfirming(false)
    if (result.success) { showToast('Run created successfully'); onRunChanged() }
    else showToast(result.error ?? 'Failed to create run', 'error')
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

  const busItems = useMemo<SelectPanelItemInput[]>(() =>
    activeBuses.map((bus) => {
      const inUse = runs.some((r) => r.bus_id === bus.id && r.shift_id === selectedShift?.id)
      return {
        id: bus.id,
        text: `Bus ${bus.number}`,
        description: `${bus.capacity} seats${inUse ? ' · In use' : ''}`,
        sx: inUse ? { opacity: 0.5 } : {},
      }
    }),
    [activeBuses, runs, selectedShift?.id]
  )

  const filteredBusItems = busFilter
    ? busItems.filter((item) => item.text?.toLowerCase().includes(busFilter.toLowerCase()))
    : busItems

  const selectedBusItem = busItems.find((item) => (item as SelectPanelItemInput & { id: string }).id === selectedBus?.id)
  const isSelectedBusInUse = selectedBus && runs.some(r => r.bus_id === selectedBus.id && r.shift_id === selectedShift?.id)

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* LEFT PANEL: Config */}
      <div style={{ width: 320, borderRight: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Shift */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>1. Select Shift</Text>
            {activeShifts.length === 0 ? (
              <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active shifts</Text>
            ) : (
              <ActionMenu>
                <ActionMenu.Button sx={{ width: '100%' }}>
                  {selectedShift?.name ?? 'Select a shift…'}
                </ActionMenu.Button>
                <ActionMenu.Overlay width="auto" sx={{ minWidth: '287px' }}>
                  <ActionList>
                    {activeShifts.map((shift) => (
                      <ActionList.Item
                        key={shift.id}
                        selected={selectedShift?.id === shift.id}
                        onSelect={() => setSelectedShift(shift)}
                      >
                        {shift.name}
                      </ActionList.Item>
                    ))}
                  </ActionList>
                </ActionMenu.Overlay>
              </ActionMenu>
            )}
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
            <SelectPanel
              title="Select Bus"
              placeholder="Search buses..."
                sx={{ width: '100%' }} // Ensures the component container fills the parent
  overlayProps={{ 
    sx: { 
      zIndex: 9999, 
      width: '20.6%',     // Forces the dropdown to match the anchor width
      minWidth: 'auto'   // Removes default minimum width constraints
    } 
  }}
              open={busPickerOpen}
              onOpenChange={(isOpen) => { setBusPickerOpen(isOpen); if (!isOpen) setBusFilter('') }}
              items={filteredBusItems}
              selected={selectedBusItem}
              onSelectedChange={(item: SelectPanelItemInput | undefined) => {
                if (!item) { setSelectedBus(null); return }
                const bus = activeBuses.find((b) => b.id === (item as SelectPanelItemInput & { id: string }).id)
                setSelectedBus(bus ?? null)
              }}
              onFilterChange={setBusFilter}
              renderAnchor={({ children: _children, ...anchorProps }) => (
                <Button
                  {...anchorProps}
                  trailingAction={TriangleDownIcon}
                  sx={{ 
                    width: '100%', 
                    justifyContent: 'space-between',
                    opacity: isSelectedBusInUse ? 0.6 : 1,
                    bg: isSelectedBusInUse ? 'var(--bgColor-muted)' : undefined,
                  }}
                >
                  {selectedBus ? `Bus ${selectedBus.number} (${selectedBus.capacity} seats)${isSelectedBusInUse ? ' - In Use' : ''}` : 'Pick a bus'}
                </Button>
              )}
              height="medium"
            />
            {activeBuses.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>No active buses</Text>}
          </div>

          {/* Route selector */}
          <div style={{ padding: 16 }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block', mb: 2 }}>4. Select Route</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeRoutes.map((route) => {
                const isRouteInUse = runs.some((r) => r.route_id === route.id && r.shift_id === selectedShift?.id)
                return (
                  <button
                    key={route.id}
                    onClick={() => setSelectedRoute(selectedRoute?.id === route.id ? null : (route as RouteWithStops))}
                    className="hov-bg-subtle"
                    style={{ 
                      textAlign: 'left', 
                      padding: '8px 12px', 
                      borderRadius: 6, 
                      fontSize: 14, 
                      border: 'none', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      background: selectedRoute?.id === route.id ? 'var(--bgColor-accent-muted)' : 'transparent', 
                      color: selectedRoute?.id === route.id ? 'var(--fgColor-accent)' : 'var(--fgColor-default)', 
                      fontWeight: selectedRoute?.id === route.id ? 600 : 400,
                      opacity: isRouteInUse && selectedRoute?.id !== route.id ? 0.5 : 1
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: route.color }} />
                    <span style={{ flex: 1, textDecoration: isRouteInUse ? 'line-through' : 'none' }}>{route.name}</span>
                    {isRouteInUse && <CheckCircle2 size={14} style={{ color: 'var(--fgColor-success)' }} />}
                  </button>
                )
              })}
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
      <div style={{ width: 488, borderLeft: '1px solid var(--borderColor-default)', background: 'var(--bgColor-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
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

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--fgColor-muted)', padding: '32px 0' }}><Spinner /></div>
          ) : runs.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fgColor-muted)', padding: 32 }}>
              <BusIcon size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1, display: 'block' }}>No runs yet</Text>
              <Text sx={{ fontSize: 0, mt: 1 }}>Create a run using the planner</Text>
            </div>
          ) : (() => {
            const rows = buildTableRows(runDetails, selectedShift?.id)
            const combined = rows.length > 0 && rows.every((r) => r.boysBus && r.boysBus === r.girlsBus)
            return (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bgColor-default)', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--borderColor-muted)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--fgColor-muted)', fontWeight: 600,  letterSpacing: '0.05em' }}>Stop Names</th>
                    {combined ? (
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--fgColor-muted)', fontWeight: 600,  letterSpacing: '0.05em', width: 100 }}>Bus No.</th>
                    ) : (
                      <>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: 'var(--fgColor-accent)', fontWeight: 600,  letterSpacing: '0.05em', width: 80 }}>Boys</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: '#db2777', fontWeight: 600,  letterSpacing: '0.05em', width: 80 }}>Girls</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.key} style={{ background: i % 2 === 0 ? 'var(--bgColor-default)' : 'var(--bgColor-muted)', borderTop: '1px solid var(--borderColor-muted)' }}>
                      <td style={{ padding: '8px 12px', fontSize: 13, color: 'var(--fgColor-default)', lineHeight: 1.5 }}>{row.stopNames}</td>
                      {combined ? (
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: 'var(--fgColor-default)' }}>{row.boysBus}</td>
                      ) : (
                        <>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: row.boysBus ? 'var(--fgColor-accent)' : 'var(--fgColor-subtle)' }}>{row.boysBus || '—'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, fontSize: 13, color: row.girlsBus ? '#db2777' : 'var(--fgColor-subtle)' }}>{row.girlsBus || '—'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
