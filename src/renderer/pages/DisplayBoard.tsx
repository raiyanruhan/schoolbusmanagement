import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RunWithDetails, RunDirection } from '../../shared/types'
import { Bus as BusIcon, AlertCircle } from 'lucide-react'
import { Text, Button, Spinner } from '@primer/react'
import { groupRunsByRoute, type GroupableRun } from '../lib/runGrouping'

const REFRESH_INTERVAL = 30_000

type DisplayRow = {
  key: string
  routeName: string
  routeColor: string
  stops: string[]
  boysBuses: string
  girlsBuses: string
}

function toGroupable(details: RunWithDetails[]): GroupableRun[] {
  return details.map((run) => ({
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
}

function buildRows(details: RunWithDetails[]): DisplayRow[] {
  const groups = groupRunsByRoute(toGroupable(details))
  const rows: DisplayRow[] = groups.map((g) => ({
    key: g.key,
    routeName: g.route_name,
    routeColor: g.route_color,
    stops: g.stopNames,
    boysBuses: g.boysBus ?? '',
    girlsBuses: g.girlsBus ?? ''
  }))
  rows.sort((a, b) => a.routeName.localeCompare(b.routeName) || a.stops[0]?.localeCompare(b.stops[0] ?? '') || 0)
  return rows
}

/**
 * Public kiosk screen — no controls, no navigation, nothing an onlooker
 * could tap. Which shift/direction to show is decided in the main app and
 * passed in as launch params (?shift=<id>&direction=<INBOUND|OUTBOUND>)
 * when this window is opened; this page only ever renders what it's told.
 */
export default function DisplayBoard() {
  const [searchParams] = useSearchParams()
  const shiftId = searchParams.get('shift')
  const direction = (searchParams.get('direction') as RunDirection | null) ?? 'OUTBOUND'

  const [details, setDetails] = useState<RunWithDetails[]>([])
  const [shiftName, setShiftName] = useState<string | null>(null)
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
      if (shiftRes.success) {
        setShiftName(shiftRes.data.find((s) => s.id === shiftId)?.name ?? null)
      }

      const runsRes = await window.api.planner.getAllRunsWithDetails(sessionRes.data.id)
      if (runsRes.success) setDetails(runsRes.data)
      else setError(`Runs error: ${runsRes.error}`)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }, [shiftId])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  const filteredDetails = useMemo(
    () => details.filter((r) => r.shift_id === shiftId && r.direction === direction),
    [details, shiftId, direction]
  )
  const rows = buildRows(filteredDetails)

  // DisplayBoard is always dark — use hardcoded dark colors since this is a kiosk view
  return (
    <div style={{ height: '100vh', background: '#0d1117', color: '#e6edf3', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!shiftId ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
            <AlertCircle size={40} style={{ color: '#f85149' }} />
            <Text style={{ fontSize: 14, fontWeight: 600, color: '#f85149' }}>No board selected</Text>
            <Text style={{ fontSize: 12, color: '#8b949e', maxWidth: 384, textAlign: 'center' }}>
              Open this from the app's dashboard — pick a shift and direction there first.
            </Text>
          </div>
        ) : error ? (
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
        ) : rows.length === 0 && details.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: '#8b949e' }}>
            <BusIcon size={48} />
            <Text style={{ fontSize: 16, fontWeight: 500, color: '#c9d1d9' }}>
              No {direction === 'INBOUND' ? 'inbound' : 'outbound'} runs planned for {shiftName ?? 'this shift'} yet.
            </Text>
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
                      ? <span style={{ color: '#93c5fd', fontSize: 14 }}>{row.boysBuses}</span>
                      : <span style={{ color: '#374151', fontSize: 14 }}>—</span>
                    }
                  </td>
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.girlsBuses
                      ? <span style={{ color: '#f9a8d4', fontSize: 14 }}>{row.girlsBuses}</span>
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
