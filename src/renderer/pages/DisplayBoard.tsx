import { useEffect, useState, useCallback } from 'react'
import type { RunWithDetails, Shift } from '../../shared/types'
import { Bus as BusIcon, RefreshCw, AlertCircle } from 'lucide-react'
import { Text, Button, Spinner } from '@primer/react'

const REFRESH_INTERVAL = 30_000

type DisplayRow = {
  key: string
  routeName: string
  routeColor: string
  stops: string[]
  boysBuses: string
  girlsBuses: string
}

function buildRows(details: RunWithDetails[]): DisplayRow[] {
  const routeMap = new Map<string, {
    routeName: string
    routeColor: string
    stops: Map<string, { name: string; seq: number }>
    boysBuses: Set<string>
    girlsBuses: Set<string>
  }>()

  for (const run of details) {
    const busNum = run.bus?.number ?? '—'
    const routeId = run.route_id

    if (!routeMap.has(routeId)) {
      routeMap.set(routeId, {
        routeName: run.route?.name ?? routeId,
        routeColor: run.route?.color ?? '#6b7280',
        stops: new Map(),
        boysBuses: new Set(),
        girlsBuses: new Set()
      })
    }

    const entry = routeMap.get(routeId)!

    if (run.gender === 'BOYS' || run.gender === 'MIXED') entry.boysBuses.add(busNum)
    if (run.gender === 'GIRLS' || run.gender === 'MIXED') entry.girlsBuses.add(busNum)

    for (const rs of run.stops) {
      if (!entry.stops.has(rs.stop_id)) {
        entry.stops.set(rs.stop_id, {
          name: rs.stop?.name ?? rs.stop_id,
          seq: rs.stop?.sequence_order ?? rs.sequence_order
        })
      }
    }
  }

  const rows: DisplayRow[] = []
  for (const [routeId, entry] of routeMap) {
    const sortedStops = [...entry.stops.values()]
      .sort((a, b) => a.seq - b.seq)
      .map((s) => s.name)

    rows.push({
      key: routeId,
      routeName: entry.routeName,
      routeColor: entry.routeColor,
      stops: sortedStops,
      boysBuses: [...entry.boysBuses].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', '),
      girlsBuses: [...entry.girlsBuses].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ')
    })
  }

  rows.sort((a, b) => a.routeName.localeCompare(b.routeName))
  return rows
}

export default function DisplayBoard() {
  const [details, setDetails] = useState<RunWithDetails[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sessionRes, shiftRes] = await Promise.all([
        window.api.session.getOrCreateToday(),
        window.api.shift.getAll()
      ])
      if (!sessionRes.success) {
        setError(`Session error: ${sessionRes.error}`)
        setLoading(false)
        return
      }
      if (shiftRes.success) setShifts(shiftRes.data)

      const runsRes = await window.api.planner.getAllRunsWithDetails(sessionRes.data.id)
      if (runsRes.success) setDetails(runsRes.data)
      else setError(`Runs error: ${runsRes.error}`)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
    setCountdown(REFRESH_INTERVAL / 1000)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [])

  const rows = buildRows(details)

  // DisplayBoard is always dark — use hardcoded dark colors since this is a kiosk view
  return (
    <div style={{ height: '100vh', background: '#0d1117', color: '#e6edf3', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <AlertCircle size={40} style={{ color: '#f85149' }} />
            <Text style={{ fontSize: 14, fontWeight: 600, color: '#f85149' }}>Failed to load</Text>
            <Text style={{ fontSize: 12, color: '#8b949e', maxWidth: 384, textAlign: 'center' }}>{error}</Text>
            <Button onClick={load} style={{ marginTop: 8, background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 12 }}>
              Retry
            </Button>
          </div>
        ) : loading && details.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#8b949e' }}>
            <Spinner size="medium" />
            <Text style={{ fontSize: 14 }}>Loading...</Text>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#8b949e' }}>
            <BusIcon size={48} />
            <Text style={{ fontSize: 16, fontWeight: 500, color: '#c9d1d9' }}>The ones that love us, never really leave us.</Text>
            <Text style={{ fontSize: 12, color: '#6e7681' }}>— Sirius Black</Text>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111827', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 40 }}>#</th>
                <th style={{ padding: '8px 20px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stands</th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 110 }}>Boys</th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#f9a8d4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 110 }}>Girls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? '#191f2c' : '#141b2c', borderTop: '1px solid #1f2937' }}>
                  <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: 12, color: '#4b5563', fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td style={{ padding: '11px 20px', lineHeight: 1.5 }}>
                    <span style={{ fontSize: 14, color: '#d1d5db' }}>{row.stops.join(', ')}</span>
                  </td>
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.boysBuses
                      ? <span style={{ color: '#93c5fd', fontSize: row.boysBuses.includes(',') ? 12 : 14 }}>{row.boysBuses}</span>
                      : <span style={{ color: '#374151', fontSize: 14 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.girlsBuses
                      ? <span style={{ color: '#f9a8d4', fontSize: row.girlsBuses.includes(',') ? 12 : 14 }}>{row.girlsBuses}</span>
                      : <span style={{ color: '#374151', fontSize: 14 }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
