import { useEffect, useState, useCallback } from 'react'
import { MapPin, Zap, Trash2 } from 'lucide-react'
import { Button, Text, Spinner } from '@primer/react'
import { useSessionStore } from '../store/sessionStore'
import { usePlannerStore } from '../store/plannerStore'
import TopBar from '../components/ui/TopBar'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { ManualPlanTab } from '../components/planner/ManualPlanTab'
import { AutoPlanTab } from '../components/planner/AutoPlanTab'
import type { Conflict } from '../../shared/types'

export default function Planner() {
  const { session } = useSessionStore()
  const { buses, routes, shifts, runs, loadData, selectedShift, deleteRun } = usePlannerStore()

  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual')
  const [clearConfirm, setClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const loadConflicts = useCallback(async () => {
    if (!session) return
    const res = await window.api.incident.getConflicts(session.id)
    if (res.success) setConflicts(res.data)
  }, [session])

  useEffect(() => {
    if (session) { loadData(session.id); loadConflicts() }
  }, [session, loadData, loadConflicts])

  const handleClearShiftPlan = async () => {
    if (!selectedShift) return
    setClearing(true)
    const shiftRuns = runs.filter((r) => r.shift_id === selectedShift.id)
    for (const run of shiftRuns) await deleteRun(run.id)
    setClearing(false)
    setClearConfirm(false)
  }

  const shiftRuns = selectedShift ? runs.filter((r) => r.shift_id === selectedShift.id) : []

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column' }}>
        <TopBar showBack backTo="/" backLabel="Home" title="Planner" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ textAlign: 'center', color: 'var(--fgColor-muted)' }}>
            <Spinner size="large" />
            <Text sx={{ display: 'block', mt: 2 }}>Loading session...</Text>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ height: '100vh', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TopBar
        showBack
        backTo="/"
        backLabel="Home"
        title={`Planner (${session.date})`}
        right={
          activeTab === 'manual' && shiftRuns.length > 0 ? (
            <Button variant="danger" size="small" leadingVisual={Trash2} onClick={() => setClearConfirm(true)}>
              Clear Shift Plan
            </Button>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div style={{ background: 'var(--bgColor-default)', borderBottom: '1px solid var(--borderColor-default)', padding: '0 24px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {(['manual', 'auto'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500, border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: `2px solid ${activeTab === tab ? 'var(--borderColor-accent-emphasis)' : 'transparent'}`, color: activeTab === tab ? 'var(--fgColor-accent)' : 'var(--fgColor-muted)', marginBottom: -1 }}
          >
            {tab === 'manual' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Manual</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}> Automatic</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'manual' ? (
        <ManualPlanTab session={session} conflicts={conflicts} onRunChanged={loadConflicts} />
      ) : (
        <AutoPlanTab session={session} shifts={shifts} buses={buses} runs={runs} onRunsCreated={() => loadData(session.id)} />
      )}

      <ConfirmDialog
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClearShiftPlan}
        title="Clear Shift Plan"
        message={`Remove all ${shiftRuns.length} run${shiftRuns.length !== 1 ? 's' : ''} for ${selectedShift?.name ?? 'this shift'}? This cannot be undone.`}
        confirmLabel={clearing ? 'Clearing...' : 'Clear All'}
        danger
      />
    </div>
  )
}
