import { Bus as BusIcon, ChevronRight, ArrowRight, ArrowLeft, Trash2 } from 'lucide-react'
import { Text, Label, IconButton } from '@primer/react'
import type { Bus, Route, Shift, Run, Conflict } from '../../../shared/types'

export function busStatusBorderColor(status: string): string {
  if (status === 'ACTIVE') return 'var(--borderColor-success-emphasis)'
  if (status === 'MAINTENANCE') return 'var(--borderColor-attention-emphasis)'
  return 'var(--borderColor-default)'
}

export function RunCard({
  run, buses, routes, shifts, conflicts, onDelete,
}: {
  run: Run
  buses: Bus[]
  routes: Route[]
  shifts: Shift[]
  conflicts: Conflict[]
  onDelete: (id: string) => void
}) {
  const bus = buses.find((b) => b.id === run.bus_id)
  const route = routes.find((r) => r.id === run.route_id)
  const shift = shifts.find((s) => s.id === run.shift_id)
  const runConflicts = conflicts.filter((c) => c.run_id === run.id || (c.bus_id === run.bus_id && !c.run_id))
  const hasCritical = runConflicts.some((c) => c.severity === 'CRITICAL')

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: 16,
        border: `1px solid ${hasCritical ? 'var(--borderColor-danger-emphasis)' : runConflicts.length > 0 ? 'var(--borderColor-attention-emphasis)' : 'var(--borderColor-default)'}`,
        borderRadius: 6,
        background: hasCritical ? 'var(--bgColor-danger-muted)' : runConflicts.length > 0 ? 'var(--bgColor-attention-muted)' : 'var(--bgColor-muted)',
      }}
    >
      <div style={{ width: 40, height: 40, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: hasCritical ? 'var(--bgColor-danger-muted)' : 'var(--bgColor-accent-muted)', color: hasCritical ? 'var(--fgColor-danger)' : 'var(--fgColor-accent)' }}>
        <BusIcon size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text sx={{ fontWeight: 'semibold', fontSize: 1 }}>{bus?.number ?? '—'}</Text>
          <ChevronRight size={12} />
          <Text sx={{ fontSize: 1, color: 'fg.muted', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {route?.name ?? '—'}
          </Text>
          {runConflicts.length > 0 && (
            <Label variant={hasCritical ? 'danger' : 'attention'} sx={{ ml: 'auto', flexShrink: 0 }}>
              ⚠ {hasCritical ? 'Conflict' : 'Warning'}
            </Label>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{shift?.name ?? '—'}</Text>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>•</Text>
          <Text sx={{ fontSize: 0, fontWeight: 'medium', color: run.direction === 'OUTBOUND' ? 'attention.fg' : 'accent.fg' }}>
            {run.direction === 'OUTBOUND'
              ? <><ArrowRight size={10} style={{ display: 'inline' }} /> Outbound</>
              : <><ArrowLeft size={10} style={{ display: 'inline' }} /> Inbound</>}
          </Text>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>•</Text>
          <Label variant="secondary">{run.status}</Label>
        </div>
        {runConflicts.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {runConflicts.map((c, i) => (
              <Text key={i} as="p" sx={{ fontSize: 0, color: hasCritical ? 'danger.fg' : 'attention.fg', m: 0 }}>
                {c.message}
              </Text>
            ))}
          </div>
        )}
      </div>

      <IconButton
        icon={Trash2}
        aria-label="Delete run"
        variant="invisible"
        size="small"
        onClick={() => onDelete(run.id)}
        sx={{ color: 'danger.fg', flexShrink: 0 }}
      />
    </div>
  )
}
