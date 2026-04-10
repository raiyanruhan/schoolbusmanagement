import { useEffect, useState, useCallback } from 'react'
import type { Run, Bus, Route, Shift } from '../../shared/types'
import { Bus as BusIcon, ArrowRight, ArrowLeft, RefreshCw, Clock } from 'lucide-react'

const REFRESH_INTERVAL = 30_000

interface RunCard {
  run: Run
  bus: Bus | undefined
  route: Route | undefined
  shift: Shift | undefined
}

function genderLabel(g: string) {
  if (g === 'BOYS') return { label: 'Boys', cls: 'bg-blue-600' }
  if (g === 'GIRLS') return { label: 'Girls', cls: 'bg-pink-500' }
  return { label: 'Mixed', cls: 'bg-purple-600' }
}

function statusColor(s: string) {
  if (s === 'IN_PROGRESS') return 'bg-green-500'
  if (s === 'COMPLETED') return 'bg-gray-500'
  if (s === 'CANCELLED') return 'bg-red-500'
  return 'bg-yellow-400'
}

function DisplayRunCard({ run, bus, route, shift }: RunCard) {
  const gender = genderLabel(run.gender)
  const routeColor = route?.color ?? '#6366f1'

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700 flex flex-col">
      {/* Color bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: routeColor }} />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Bus number + direction */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-0.5">Bus</p>
            <p className="text-4xl font-black text-white leading-none">{bus?.number ?? '—'}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${gender.cls}`}>
              {gender.label}
            </span>
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full text-gray-900 ${statusColor(run.status)}`}>
              {run.direction === 'OUTBOUND'
                ? <><ArrowRight className="w-3 h-3" /> Out</>
                : <><ArrowLeft className="w-3 h-3" /> In</>}
            </span>
          </div>
        </div>

        {/* Route */}
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-0.5">Route</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: routeColor }} />
            <p className="text-base font-semibold text-gray-100 truncate">{route?.name ?? '—'}</p>
          </div>
        </div>

        {/* Shift + depart */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="truncate">{shift?.name ?? '—'}</span>
          {run.planned_depart && (
            <span className="flex items-center gap-1 shrink-0 text-yellow-400 font-medium">
              <Clock className="w-3 h-3" />
              {run.planned_depart}
            </span>
          )}
        </div>
      </div>

      {/* Status strip */}
      <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider text-center ${
        run.status === 'IN_PROGRESS' ? 'bg-green-500/20 text-green-400' :
        run.status === 'COMPLETED'   ? 'bg-gray-700 text-gray-400' :
        run.status === 'CANCELLED'   ? 'bg-red-500/20 text-red-400' :
                                       'bg-yellow-400/10 text-yellow-400'
      }`}>
        {run.status.replace('_', ' ')}
      </div>
    </div>
  )
}

export default function DisplayBoard() {
  const [runs, setRuns] = useState<Run[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000)

  const load = useCallback(async () => {
    const [sessionRes, busRes, routeRes, shiftRes] = await Promise.all([
      window.api.session.getOrCreateToday(),
      window.api.bus.getAll(),
      window.api.route.getAll(),
      window.api.shift.getAll()
    ])

    if (busRes.success) setBuses(busRes.data)
    if (routeRes.success) setRoutes(routeRes.data)
    if (shiftRes.success) setShifts(shiftRes.data)

    if (sessionRes.success) {
      const runsRes = await window.api.planner.getRuns(sessionRes.data.id)
      if (runsRes.success) {
        setRuns(runsRes.data.filter((r) => r.status !== 'CANCELLED'))
      }
    }

    setLastRefresh(new Date())
    setCountdown(REFRESH_INTERVAL / 1000)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [load])

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <div className="px-8 py-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center">
            <BusIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-lg leading-none text-white">School Bus — Display Board</p>
            <p className="text-xs text-gray-500 mt-0.5">{dateStr}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh ({countdown}s)
          </button>
          <span className="text-2xl font-mono font-bold text-white">{timeStr}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-600">
            <BusIcon className="w-16 h-16 mb-4" />
            <p className="text-xl font-semibold">No runs scheduled today</p>
            <p className="text-sm mt-1">Refreshing every 30 seconds</p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-gray-500 text-sm">
                {runs.length} run{runs.length !== 1 ? 's' : ''} scheduled
                {' · '}
                <span className="text-gray-600 text-xs">Last updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {runs.map((run) => (
                <DisplayRunCard
                  key={run.id}
                  run={run}
                  bus={buses.find((b) => b.id === run.bus_id)}
                  route={routes.find((r) => r.id === run.route_id)}
                  shift={shifts.find((s) => s.id === run.shift_id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
