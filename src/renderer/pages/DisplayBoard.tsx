import { useEffect, useState, useCallback } from 'react'
import type { RunWithDetails, Shift } from '../../shared/types'
import { Bus as BusIcon, RefreshCw, AlertCircle } from 'lucide-react'

const REFRESH_INTERVAL = 30_000

type DisplayRow = {
  key: string        // route_id
  routeName: string
  routeColor: string
  stops: string[]    // all stop names for this route, sorted by sequence_order
  boysBuses: string  // comma-separated bus numbers (may be multiple if route was split)
  girlsBuses: string
}

/**
 * Build one row per route, regardless of how many buses the engine assigned.
 *
 * Previous logic grouped by (boysBus, girlsBus) pair — this fragmented routes when
 * the engine split them across 2+ buses (different boundaries for boys vs girls).
 *
 * New logic:
 *   - Group runs by route_id
 *   - Merge all stops from every run on that route
 *   - Collect all boys bus numbers and all girls bus numbers
 *   - Result: one row = one route, all stops, "23, 7" in boys column if 2 buses assigned
 */
function buildRows(details: RunWithDetails[]): DisplayRow[] {
  const routeMap = new Map<string, {
    routeName: string
    routeColor: string
    // stop_id → { name, seq } — deduplicates stops that appear in multiple runs
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
          // Prefer the stop's own global sequence_order for correct ordering across merged runs
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

  // Sort by route name for a stable, predictable order
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

  return (
    <div className="bg-gray-900 text-white flex flex-col" style={{ height: '100vh' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-red-400 gap-2">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm font-medium">Failed to load</p>
            <p className="text-xs text-red-500 max-w-sm text-center">{error}</p>
            <button onClick={load} className="mt-2 px-4 py-2 bg-gray-800 rounded-lg text-xs text-gray-300 hover:bg-gray-700">
              Retry
            </button>
          </div>
        ) : loading && details.length === 0 ? (
          <div className="flex items-center justify-center h-full gap-3 text-gray-500">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-3">
            <BusIcon className="w-12 h-12" />
            <p className="text-base font-medium serif-font">The ones that love us, never really leave us.</p>
            <p className="text-xs text-gray-700">— Serius Black</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#111827', position: 'sticky', top: 0, zIndex: 1 }}>
                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', width: 40 }}>
                  #
                </th>
                <th style={{ padding: '8px 20px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stands
                </th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 110 }}>
                  Boys
                </th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#f9a8d4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 110 }}>
                  Girls
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? '#191f2c' : '#141b2c', borderTop: '1px solid #1f2937' }}>
                  {/* Row number */}
                  <td style={{ padding: '11px 12px', textAlign: 'center', fontSize: 12, color: '#4b5563', fontWeight: 700 }}>
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  {/* Route name + stops */}
                  <td style={{ padding: '11px 20px', lineHeight: 1.5 }}>
                    <span style={{ fontSize: 14, color: '#d1d5db' }}>
                      {row.stops.join(', ')}
                    </span>
                  </td>
                  {/* Boys bus(es) */}
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.boysBuses ? (
                      <span style={{ color: '#93c5fd', fontSize: row.boysBuses.includes(',') ? 12 : 14 }}>
                        {row.boysBuses}
                      </span>
                    ) : (
                      <span style={{ color: '#374151', fontSize: 14 }}>—</span>
                    )}
                  </td>
                  {/* Girls bus(es) */}
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {row.girlsBuses ? (
                      <span style={{ color: '#f9a8d4', fontSize: row.girlsBuses.includes(',') ? 12 : 14 }}>
                        {row.girlsBuses}
                      </span>
                    ) : (
                      <span style={{ color: '#374151', fontSize: 14 }}>—</span>
                    )}
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
