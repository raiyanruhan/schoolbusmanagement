import { useEffect, useState, useCallback } from 'react'
import type { RunWithDetails, Shift } from '../../shared/types'
import { Bus as BusIcon, RefreshCw, AlertCircle } from 'lucide-react'

const REFRESH_INTERVAL = 30_000

type DisplayRow = {
  key: string
  stops: string[]       // stop names in order
  boysBus: string
  girlsBus: string
}

function buildRows(details: RunWithDetails[]): DisplayRow[] {
  // Map stopId → { stopName, boysBus, girlsBus, sequenceOrder }
  const stopMap = new Map<string, {
    name: string
    seq: number
    boysBus: string
    girlsBus: string
  }>()

  for (const run of details) {
    const busNum = run.bus?.number ?? '—'
    for (const rs of run.stops) {
      if (!stopMap.has(rs.stop_id)) {
        stopMap.set(rs.stop_id, {
          name: rs.stop?.name ?? rs.stop_id,
          seq: rs.sequence_order,
          boysBus: '',
          girlsBus: ''
        })
      }
      const entry = stopMap.get(rs.stop_id)!
      if (run.gender === 'BOYS') {
        entry.boysBus = busNum
      } else if (run.gender === 'GIRLS') {
        entry.girlsBus = busNum
      } else {
        entry.boysBus = busNum
        entry.girlsBus = busNum
      }
    }
  }

  // Group stops by (boysBus, girlsBus) pair, preserving insertion/sequence order
  const groupMap = new Map<string, { stops: Array<{ name: string; seq: number }>; boysBus: string; girlsBus: string }>()

  for (const [, entry] of stopMap) {
    const key = `${entry.boysBus}||${entry.girlsBus}`
    if (!groupMap.has(key)) {
      groupMap.set(key, { stops: [], boysBus: entry.boysBus, girlsBus: entry.girlsBus })
    }
    groupMap.get(key)!.stops.push({ name: entry.name, seq: entry.seq })
  }

  const rows: DisplayRow[] = []
  for (const [key, group] of groupMap) {
    group.stops.sort((a, b) => a.seq - b.seq)
    rows.push({
      key,
      stops: group.stops.map((s) => s.name),
      boysBus: group.boysBus,
      girlsBus: group.girlsBus
    })
  }

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

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  const rows = buildRows(details)

  return (
    <div className="bg-gray-900 text-white flex flex-col" style={{ height: '100vh' }}>

      {/* Header */}
      {/* <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
            <BusIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">Display Board</p>
            <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-xs text-gray-400"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {countdown}s
          </button>
          <span className="text-xl font-mono font-bold tabular-nums">{timeStr}</span>
        </div>
      </div> */}

      {/* Body */}
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
                <th style={{ padding: '8px 20px', textAlign: 'left', fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Stands
                </th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#93c5fd', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 120 }}>
                  Boys
                </th>
                <th style={{ padding: '8px 20px', textAlign: 'center', fontSize: 11, color: '#f9a8d4', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', width: 120 }}>
                  Girls
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key} style={{ background: i % 2 === 0 ? '#191f2c' : '#141b2c', borderTop: '1px solid #1f2937' }}>
                  <td style={{ padding: '11px 20px', fontSize: 14, color: '#d1d5db', lineHeight: 1.5 }}>
                    {row.stops.join(', ')}
                  </td>
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: row.boysBus ? '#93c5fd' : '#374151', whiteSpace: 'nowrap' }}>
                    {row.boysBus || '—'}
                  </td>
                  <td style={{ padding: '11px 20px', textAlign: 'center', fontSize: 14, fontWeight: 700, color: row.girlsBus ? '#f9a8d4' : '#374151', whiteSpace: 'nowrap' }}>
                    {row.girlsBus || '—'}
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
