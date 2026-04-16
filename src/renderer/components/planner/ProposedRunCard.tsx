import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Text, Label } from '@primer/react'
import type { ProposedRun, Bus } from '../../../shared/types'

export function ProposedRunCard({ pr, buses }: { pr: ProposedRun; buses: Bus[] }) {
  const [expanded, setExpanded] = useState(false)
  const bus = buses.find((b) => b.id === pr.bus_id)
  const genderVariant: Record<string, 'accent' | 'done' | 'sponsors'> = { BOYS: 'accent', GIRLS: 'sponsors', MIXED: 'done' }
  const pct = Math.min((pr.totalStudents / (pr.capacity + pr.overload_limit)) * 100, 100)
  const isOver = pr.totalStudents > pr.capacity

  return (
    <div style={{ border: `2px solid ${pr.isOverloaded ? 'var(--borderColor-attention-emphasis)' : 'var(--borderColor-default)'}`, borderRadius: 6, overflow: 'hidden' }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 16 }}>
          <div>
            <Text sx={{ fontWeight: 'bold', fontSize: 2 }}>{bus?.number ?? pr.bus_number}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: pr.route_color }} />
              <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{pr.route_name}</Text>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            <Label variant={genderVariant[pr.gender] ?? 'secondary'}>{pr.gender}</Label>
            <Label variant={pr.direction === 'OUTBOUND' ? 'attention' : 'accent'}>{pr.direction}</Label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text sx={{ fontSize: 0, color: isOver ? 'attention.fg' : 'fg.muted', fontWeight: isOver ? 'semibold' : 'normal' }}>
              {pr.totalStudents} / {pr.capacity} students{isOver && ` (+${pr.totalStudents - pr.capacity} over)`}
            </Text>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 9999,
              background: pr.isOverloaded ? 'var(--bgColor-danger-emphasis)' : isOver ? 'var(--bgColor-attention-emphasis)' : 'var(--bgColor-success-emphasis)',
              width: `${pct}%`,
            }} />
          </div>
        </div>

        {pr.warnings.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
            {pr.warnings.map((w, i) => (
              <Label key={i} variant={w.severity === 'CRITICAL' ? 'danger' : 'attention'}>{w.type.replace('_', ' ')}</Label>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded((e) => !e)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fgColor-muted)', fontSize: 12, padding: 0 }}
        >
          <Text sx={{ fontSize: 0 }}>{pr.stops.length} stop{pr.stops.length !== 1 ? 's' : ''}</Text>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <div style={{ marginTop: 8 }}>
            {pr.stops.map((s, i) => (
              <div key={s.stop_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--borderColor-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fgColor-muted)' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--bgColor-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                  </div>
                  <Text sx={{ fontSize: 0 }}>{s.stop_name}</Text>
                </div>
                <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.default' }}>{s.student_count}</Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
