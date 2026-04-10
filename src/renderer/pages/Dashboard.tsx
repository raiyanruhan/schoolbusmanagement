import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, Activity, ArrowRight, Settings, Monitor } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

export default function Dashboard() {
  const { stats, loadStats } = useSessionStore()
  const navigate = useNavigate()
  const user = "Raiyan"

  useEffect(() => { loadStats() }, [loadStats])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: `numeric`
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Bus className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-semibold text-gray-800 text-sm tracking-tight">School Bus Manager</span>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 hover:bg-white hover:shadow-sm transition-all"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

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
