import { useState, useEffect, useMemo } from 'react'
import { Bus as BusIcon, CheckCircle2, AlertTriangle, Zap, Users, AlertCircle, Info } from 'lucide-react'
import { Button, Text, Heading, Flash, Spinner } from '@primer/react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { ProposedRunCard } from './ProposedRunCard'
import { useUiStore } from '../../store/uiStore'
import { groupRunsByRoute, type GroupableRun } from '../../lib/runGrouping'
import type { Bus, Shift, Run, EngineOutput, AssignmentStrategy, RunDirection, ProposedRun, RunWithDetails, StrategyComparisonEntry } from '../../../shared/types'

const STRATEGY_LABELS: Record<AssignmentStrategy, string> = {
  LARGEST_ROUTE_FIRST: 'Largest Route First',
  SMALLEST_ROUTE_FIRST: 'Smallest Route First',
  SEQUENCE_ORDER: 'Sequence Order'
}

type TableRow = { key: string; stopNames: string; boysBus: string; girlsBus: string }

function buildProposedTableRows(proposedRuns: ProposedRun[]): TableRow[] {
  const groupable: GroupableRun[] = proposedRuns.map((run) => ({
    route_id: run.route_id,
    route_name: run.route_name,
    route_color: run.route_color,
    gender: run.gender,
    bus_number: run.bus_number ?? '—',
    stops: run.stops.map((rs, i) => ({ stop_id: rs.stop_id, stop_name: rs.stop_name, sequence_order: i }))
  }))
  const groups = groupRunsByRoute(groupable)
  const rows: TableRow[] = groups.map((g) => ({
    key: g.key,
    stopNames: g.stopNames.join(', '),
    boysBus: g.boysBus ?? '',
    girlsBus: g.girlsBus ?? ''
  }))
  return rows.sort((a, b) => a.stopNames.localeCompare(b.stopNames))
}

export function AutoPlanTab({
  session, shifts, buses, runs, onRunsCreated,
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
  const [generating, setGenerating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [plan, setPlan] = useState<EngineOutput | null>(null)
  const [strategyUsed, setStrategyUsed] = useState<AssignmentStrategy | null>(null)
  const [recommendedStrategy, setRecommendedStrategy] = useState<AssignmentStrategy | null>(null)
  const [comparison, setComparison] = useState<StrategyComparisonEntry[]>([])
  const [discardConfirm, setDiscardConfirm] = useState(false)

  const [runDetails, setRunDetails] = useState<RunWithDetails[]>([])
  
  const runIds = useMemo(() => runs.map((r) => r.id).join(','), [runs])
  useEffect(() => {
    window.api.planner.getAllRunsWithDetails(session.id).then((r) => {
      if (r.success) setRunDetails(r.data)
    })
  }, [session.id, runIds])

  function buildTableRows(details: RunWithDetails[], shiftId?: string | null): TableRow[] {
    const filtered = shiftId ? details.filter((r) => r.shift_id === shiftId) : details
    const groupable: GroupableRun[] = filtered.map((run) => ({
      route_id: run.route_id,
      route_name: run.route?.name ?? run.route_id,
      route_color: run.route?.color ?? '#6b7280',
      gender: run.gender,
      bus_number: run.bus?.number ?? '—',
      stops: run.stops.map((rs) => ({
        stop_id: rs.stop_id,
        stop_name: rs.stop?.name ?? rs.stop_id,
        sequence_order: rs.stop?.sequence_order ?? rs.sequence_order
      }))
    }))
    const groups = groupRunsByRoute(groupable)
    const rows: TableRow[] = groups.map((g) => ({
      key: g.key,
      stopNames: g.stopNames.join(', '),
      boysBus: g.boysBus ?? '',
      girlsBus: g.girlsBus ?? ''
    }))
    return rows.sort((a, b) => a.stopNames.localeCompare(b.stopNames))
  }

  const handleGenerate = async () => {
    if (!selectedShiftId) return
    setGenerating(true)
    setPlan(null)
    setStrategyUsed(null)
    setRecommendedStrategy(null)
    setComparison([])
    const res = await window.api.autoPlanner.generateBest({ session_id: session.id, shift_id: selectedShiftId, direction })
    setGenerating(false)
    if (res.success) {
      setPlan(res.data.output)
      setStrategyUsed(res.data.strategyUsed)
      setRecommendedStrategy(res.data.strategyUsed)
      setComparison(res.data.comparison)
    } else {
      showToast(res.error ?? 'Failed to generate plan', 'error')
    }
  }

  const handleSelectStrategy = (entry: StrategyComparisonEntry) => {
    setPlan(entry.output)
    setStrategyUsed(entry.strategy)
  }

  const handleApprove = async () => {
    if (!plan || !selectedShiftId) return
    setApproving(true)
    const res = await window.api.autoPlanner.approve({ session_id: session.id, shift_id: selectedShiftId, proposedRuns: plan.proposedRuns })
    setApproving(false)
    if (res.success) {
      showToast(`${res.data.length} run${res.data.length !== 1 ? 's' : ''} saved successfully`)
      setPlan(null)
      setStrategyUsed(null)
      setRecommendedStrategy(null)
      setComparison([])
      onRunsCreated()
    } else {
      showToast(res.error ?? 'Failed to approve plan', 'error')
    }
  }

  const criticalWarnings = plan?.warnings.filter((w) => w.severity === 'CRITICAL') ?? []
  const normalWarnings = plan?.warnings.filter((w) => w.severity === 'WARNING') ?? []

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* LEFT: Config */}
      <div style={{ width: 288, borderRight: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Shift */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text as="label" sx={{ fontSize: 1, fontWeight: 'semibold', color: 'fg.default', display: 'block', mb: 2 }}>Shift</Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {activeShifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedShiftId(s.id); setPlan(null); setStrategyUsed(null); setRecommendedStrategy(null); setComparison([]) }}
                  className="hov-bg-subtle"
                  style={{ textAlign: 'left', padding: '8px 12px', borderRadius: 6, fontSize: 14, border: 'none', cursor: 'pointer', background: selectedShiftId === s.id ? 'var(--bgColor-accent-muted)' : 'transparent', color: selectedShiftId === s.id ? 'var(--fgColor-accent)' : 'var(--fgColor-default)', fontWeight: selectedShiftId === s.id ? 600 : 400 }}
                >
                  {s.name}
                </button>
              ))}
              {activeShifts.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active shifts</Text>}
            </div>
          </div>

          {/* Direction */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text as="label" sx={{ fontSize: 1, fontWeight: 'semibold', color: 'fg.default', display: 'block', mb: 2 }}>Direction</Text>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button size="small" variant={direction === 'OUTBOUND' ? 'primary' : 'default'} onClick={() => { setDirection('OUTBOUND'); setPlan(null); setStrategyUsed(null); setRecommendedStrategy(null); setComparison([]) }} style={{ flex: 1 }}>Outbound</Button>
              <Button size="small" variant={direction === 'INBOUND' ? 'primary' : 'default'} onClick={() => { setDirection('INBOUND'); setPlan(null); setStrategyUsed(null); setRecommendedStrategy(null); setComparison([]) }} style={{ flex: 1 }}>Inbound</Button>
            </div>
          </div>

          {/* Strategy — auto-selected */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)' }}>
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', color: 'fg.default', display: 'block', mb: 2 }}>Assignment Strategy</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'var(--bgColor-accent-muted)', color: 'var(--fgColor-accent)', fontSize: 13, fontWeight: 600 }}>
              <Zap size={14} />
              {strategyUsed
                ? `${strategyUsed === recommendedStrategy ? 'Auto' : 'Manual'}: ${STRATEGY_LABELS[strategyUsed]}`
                : 'Auto (best of 3)'}
            </div>
            <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>
              Runs all 3 strategies and picks the one with fewest unassigned students, fewest buses, and fewest split routes. Pick a different one from Strategy Comparison on the right.
            </Text>
          </div>

          {/* Info */}
          <div style={{ padding: 16 }}>
            <Flash sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, fontSize: 0 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Gender separation is controlled by shift settings. Capacity limits and overload are applied automatically.</span>
            </Flash>
          </div>
        </div>

        <div style={{ padding: 16, borderTop: '1px solid var(--borderColor-default)' }}>
          <Button variant="primary" disabled={!selectedShiftId || generating} onClick={handleGenerate} sx={{ width: '100%' }}>
            {generating ? 'Generating...' : 'Generate Plan'}
          </Button>
        </div>
      </div>

      {/* CENTER: Proposed runs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!plan ? (
          generating ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fgColor-muted)' }}>
              <Spinner size="large" />
              <Text sx={{ mt: 3, fontSize: 1, color: 'fg.default' }}>Generating plan...</Text>
            </div>
          ) : runDetails.filter(r => r.shift_id === selectedShiftId).length > 0 ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--borderColor-muted)', marginBottom: 16 }}>
                <Heading as="h3" sx={{ fontSize: 2 }}>Current Shift Runs</Heading>
              </div>
              {(() => {
                const rows = buildTableRows(runDetails, selectedShiftId)
                const combined = rows.length > 0 && rows.every((r) => r.boysBus && r.boysBus === r.girlsBus)
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fgColor-muted)' }}>
              <Zap size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1 }}>Configure and generate a plan</Text>
              <Text sx={{ fontSize: 0, mt: 1 }}>Select a shift and direction, then click Generate</Text>
            </div>
          )
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ padding: '8px 24px', background: 'var(--bgColor-muted)', borderBottom: '1px solid var(--borderColor-default)', display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <BusIcon size={16} />
                <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{plan.summary.totalBusesUsed}</Text>
                <Text sx={{ fontSize: 1, color: 'fg.muted' }}>buses</Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Users size={16} />
                <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{plan.summary.totalStudentsAssigned}</Text>
                <Text sx={{ fontSize: 1, color: 'fg.muted' }}>assigned</Text>
              </div>
              {plan.summary.totalStudentsUnassigned > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fgColor-danger)' }}>
                  <AlertTriangle size={16} />
                  <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{plan.summary.totalStudentsUnassigned}</Text>
                  <Text sx={{ fontSize: 1 }}>unassigned</Text>
                </div>
              )}
              {plan.summary.overloadedRuns > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fgColor-attention)' }}>
                  <AlertCircle size={16} />
                  <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{plan.summary.overloadedRuns}</Text>
                  <Text sx={{ fontSize: 1 }}>overloaded</Text>
                </div>
              )}
            </div>

            {/* Proposed run cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {plan.proposedRuns.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--fgColor-muted)' }}>
                  <BusIcon size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <Text sx={{ fontSize: 1 }}>No runs could be generated</Text>
                </div>
              ) : (() => {
                const rows = buildProposedTableRows(plan.proposedRuns)
                const combined = rows.length > 0 && rows.every((r) => r.boysBus && r.boysBus === r.girlsBus)
                return (
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
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
              {plan.unassignedStops.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Text as="h4" sx={{ fontSize: 1, fontWeight: 'semibold', color: 'danger.fg', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AlertTriangle size={16} /> Unassigned Stops ({plan.unassignedStops.length})
                  </Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {plan.unassignedStops.map((us) => (
                      <div key={us.stop_id} style={{ background: 'var(--bgColor-danger-muted)', border: '1px solid var(--borderColor-danger-muted)', borderRadius: 6, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div>
                            <Text sx={{ fontWeight: 'semibold', fontSize: 0, color: 'danger.fg', display: 'block' }}>{us.stop_name}</Text>
                            <Text sx={{ fontSize: 0, color: 'danger.fg', opacity: 0.8 }}>{us.route_name}</Text>
                          </div>
                          <Text sx={{ fontSize: 0, color: 'danger.fg', flexShrink: 0 }}>{us.planned_boys + us.planned_girls} students</Text>
                        </div>
                        <Text sx={{ fontSize: 0, color: 'danger.fg', mt: 1, fontStyle: 'italic', display: 'block' }}>{us.reason}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Actions + Warnings */}
      <div style={{ width: 288, borderLeft: '1px solid var(--borderColor-default)', background: 'var(--bgColor-muted)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--borderColor-muted)', background: 'var(--bgColor-default)' }}>
          <Heading as="h3" sx={{ fontSize: 2 }}>Plan Actions</Heading>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {plan ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button variant="primary" leadingVisual={CheckCircle2} disabled={approving || plan.proposedRuns.length === 0} onClick={handleApprove} sx={{ width: '100%' }}>
                  {approving ? 'Saving...' : 'Approve & Save'}
                </Button>
                <Button variant="default" onClick={() => setDiscardConfirm(true)} sx={{ width: '100%' }}>Discard Plan</Button>
              </div>
              {comparison.length > 0 && (
                <div>
                  <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 2 }}>Strategy Comparison — click to switch</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {comparison.map((c) => {
                      const isSelected = c.strategy === strategyUsed
                      const isRecommended = c.strategy === recommendedStrategy
                      return (
                        <button
                          key={c.strategy}
                          onClick={() => handleSelectStrategy(c)}
                          className="hov-bg-subtle"
                          style={{
                            textAlign: 'left',
                            padding: '8px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: 'pointer',
                            width: '100%',
                            background: isSelected ? 'var(--bgColor-accent-muted)' : 'var(--bgColor-default)',
                            border: isSelected ? '1px solid var(--borderColor-accent-emphasis)' : '1px solid var(--borderColor-muted)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text sx={{ fontWeight: 'semibold', fontSize: 0, color: isSelected ? 'var(--fgColor-accent)' : 'fg.default' }}>
                              {STRATEGY_LABELS[c.strategy]}
                            </Text>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {isRecommended && <Text sx={{ fontSize: 0, color: 'var(--fgColor-success)', fontWeight: 700 }}>RECOMMENDED</Text>}
                              {isSelected && <Text sx={{ fontSize: 0, color: 'var(--fgColor-accent)', fontWeight: 700 }}>SELECTED</Text>}
                            </div>
                          </div>
                          <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mt: 1 }}>
                            {c.totalBusesUsed} buses · {c.totalStudentsUnassigned} unassigned · {c.splitRoutes} splits · {Math.round(c.utilization * 100)}% full
                          </Text>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {(criticalWarnings.length > 0 || normalWarnings.length > 0) && (
                <div>
                  <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 2 }}>Warnings</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {criticalWarnings.map((w, i) => (
                      <Flash key={i} variant="danger" sx={{ fontSize: 0 }}>
                        <Text sx={{ fontWeight: 'semibold', display: 'block' }}>{w.type.replace('_', ' ')}</Text>
                        <Text>{w.message}</Text>
                        {w.context && <Text sx={{ opacity: 0.8, fontStyle: 'italic', display: 'block' }}>{w.context}</Text>}
                      </Flash>
                    ))}
                    {normalWarnings.map((w, i) => (
                      <Flash key={i} variant="warning" sx={{ fontSize: 0 }}>
                        <Text sx={{ fontWeight: 'semibold', display: 'block' }}>{w.type.replace('_', ' ')}</Text>
                        <Text>{w.message}</Text>
                      </Flash>
                    ))}
                  </div>
                </div>
              )}
              {plan.warnings.length === 0 && <Flash variant="success" sx={{ fontSize: 0 }}>Plan looks good!</Flash>}
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--fgColor-muted)', padding: '16px 0' }}>
              <Zap size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1, display: 'block' }}>Generate a plan to see actions</Text>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={discardConfirm}
        onClose={() => setDiscardConfirm(false)}
        onConfirm={() => { setPlan(null); setStrategyUsed(null); setRecommendedStrategy(null); setComparison([]); setDiscardConfirm(false) }}
        title="Discard Plan"
        message="Are you sure you want to discard this plan? No runs will be saved."
        confirmLabel="Discard"
        danger
      />
    </div>
  )
}
