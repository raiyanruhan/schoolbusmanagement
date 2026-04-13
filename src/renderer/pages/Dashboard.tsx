import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, Activity, ArrowRight, Settings, Monitor, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'
import type { SystemHealth } from '../../shared/types'

export default function Dashboard() {
  const { stats, loadStats } = useSessionStore()
  const navigate = useNavigate()
  const user = "Raiyan"
  const [health, setHealth] = useState<SystemHealth | null>(null)

  useEffect(() => { loadStats() }, [loadStats])

  useEffect(() => {
    async function loadHealth() {
      const sessionRes = await window.api.session.getOrCreateToday()
      if (!sessionRes.success) return
      const res = await window.api.incident.getSystemHealth(sessionRes.data.id)
      if (res.success) setHealth(res.data)
    }
    loadHealth()
    const interval = setInterval(loadHealth, 30_000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: `numeric`
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-gray-800 text-sm tracking-tight">School Bus Manager</span>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* System health alert bar */}
      {health && health.level !== 'GREEN' && (
        <div
          onClick={() => navigate('/incidents')}
          className={`mx-8 mt-2 rounded-xl px-4 py-2.5 flex items-center gap-2.5 cursor-pointer transition-colors ${
            health.level === 'RED'
              ? 'bg-red-50 border border-red-200 hover:bg-red-100'
              : 'bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
          }`}
        >
          {health.level === 'RED'
            ? <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            : <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />
          }
          <div className="flex-1">
            <p className={`text-xs font-semibold ${health.level === 'RED' ? 'text-red-700' : 'text-yellow-700'}`}>
              {health.level === 'RED' ? 'Critical issues require attention' : 'Active incidents'}
            </p>
            <p className={`text-xs ${health.level === 'RED' ? 'text-red-500' : 'text-yellow-600'}`}>
              {health.openIncidents} open incident{health.openIncidents !== 1 ? 's' : ''}
              {health.activeConflicts > 0 && ` · ${health.activeConflicts} conflict${health.activeConflicts !== 1 ? 's' : ''}`}
            </p>
          </div>
          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${health.level === 'RED' ? 'text-red-400' : 'text-yellow-400'}`} />
        </div>
      )}
      {health && health.level === 'GREEN' && (
        <div className="mx-8 mt-2 rounded-xl px-4 py-2 flex items-center gap-2 bg-green-50 border border-green-100">
          <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <p className="text-xs text-green-600 font-medium">All systems operational</p>
        </div>
      )}

      {/* Hero */}
      <div className="px-8 pt-10 pb-6">
        <p className="text-sm text-gray-400 mb-1">{today}</p>
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">
          Good {getGreeting()}, {user}!<br />
        </h1>
      </div>

      {/* Stat cards */}
      <div className="px-8 grid grid-cols-2 gap-3 mb-6">
        {[
          { icon: Bus,      label: 'Buses',    value: stats?.totalBuses ?? '—',    sub: `${stats?.activeBuses ?? 0} active` },
          { icon: MapPin,   label: 'Routes',   value: stats?.totalRoutes ?? '—',   sub: 'active routes' },
          { icon: Users,    label: 'Students', value: stats?.totalStudents ?? '—', sub: 'planned today' },
          { icon: Activity, label: 'Runs',     value: stats?.runsToday ?? '—',     sub: "today's runs" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <Icon className="w-5 h-5 text-brand-500 mb-3" />
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Primary actions */}
      <div className="px-8 mt-auto pb-10 flex flex-col gap-3">
        <button
          onClick={() => navigate('/planner')}
          className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-2xl px-6 py-4 flex items-center justify-between transition-colors shadow-md shadow-brand-200"
        >
          <div className="text-left">
            <p className="font-semibold text-base">Open Planner</p>
            <p className="text-brand-200 text-sm mt-0.5">Assign buses to routes</p>
          </div>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <ArrowRight className="w-5 h-5" />
          </div>
        </button>

        <button
          onClick={() => window.api.window.openDisplay()}
          className="w-full bg-gray-800 hover:bg-gray-700 active:bg-gray-900 text-white rounded-2xl px-6 py-3.5 flex items-center justify-between transition-colors"
        >
          <div className="text-left">
            <p className="font-semibold text-sm">Open Display Board</p>
            <p className="text-gray-400 text-xs mt-0.5">Live run overview in a new window</p>
          </div>
          <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
            <Monitor className="w-4.5 h-4.5" />
          </div>
        </button>

        <button
          onClick={() => navigate('/incidents')}
          className="w-full bg-white hover:bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-2xl px-6 py-3.5 flex items-center justify-between transition-colors"
        >
          <div className="text-left">
            <p className="font-semibold text-sm text-gray-800">Incidents</p>
            <p className="text-gray-400 text-xs mt-0.5">Report and manage operational issues</p>
          </div>
          <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-gray-500" />
          </div>
        </button>
      </div>

    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
