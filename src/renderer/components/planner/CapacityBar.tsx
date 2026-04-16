import { AlertTriangle } from 'lucide-react'
import { Text } from '@primer/react'

export function CapacityBar({ used, capacity, overload }: { used: number; capacity: number; overload: number }) {
  const max = capacity + overload
  const pct = Math.min((used / Math.max(max, 1)) * 100, 100)
  const overPct = capacity > 0 ? Math.min((capacity / Math.max(max, 1)) * 100, 100) : 100
  const isOver = used > capacity
  const isWay = used > max

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text sx={{ fontSize: 0, color: isOver ? 'attention.fg' : 'fg.muted', fontWeight: isOver ? 'semibold' : 'normal' }}>
          {used} / {capacity} students {isOver && `(+${used - capacity} overload)`}
        </Text>
        {isWay && (
          <Text sx={{ fontSize: 0, color: 'danger.fg', fontWeight: 'semibold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={12} /> Exceeds limit
          </Text>
        )}
      </div>
      <div style={{ height: 8, background: 'rgba(0,0,0,0.1)', borderRadius: 9999, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', borderRadius: 9999,
          background: isWay ? 'var(--bgColor-danger-emphasis)' : isOver ? 'var(--bgColor-attention-emphasis)' : 'var(--bgColor-success-emphasis)',
          width: `${pct}%`, transition: 'width 0.2s',
        }} />
        {overload > 0 && (
          <div style={{ position: 'absolute', top: 0, height: '100%', borderRight: '2px dashed var(--fgColor-muted)', left: `${overPct}%` }} />
        )}
      </div>
    </div>
  )
}
