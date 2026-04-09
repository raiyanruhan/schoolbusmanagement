import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, CalendarDays, ArrowRight, Activity } from 'lucide-react'
import { useSessionStore } from '../store/sessionStore'

export default function Dashboard() {
  const { stats, loadStats } = useSessionStore()
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const statCards = [
    {
      label: 'Total Buses',
      value: stats?.totalBuses ?? '—',
      sub: `${stats?.activeBuses ?? 0} active`,
      icon: Bus,
      color: 'text-brand-600 bg-brand-50',
      onClick: () => navigate('/buses')
    },
    {
      label: 'Active Routes',
      value: stats?.totalRoutes ?? '—',
      sub: 'configured routes',
      icon: MapPin,
      color: 'text-emerald-600 bg-emerald-50',
      onClick: () => navigate('/routes')
    },
    {
      label: 'Total Students',
      value: stats?.totalStudents ?? '—',
      sub: 'planned today',
      icon: Users,
      color: 'text-purple-600 bg-purple-50',
      onClick: () => navigate('/shifts')
    },
    {
      label: "Today's Runs",
      value: stats?.runsToday ?? '—',
      sub: 'planned runs',
      icon: Activity,
      color: 'text-orange-600 bg-orange-50',
      onClick: () => navigate('/planner')
    }
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="text-gray-500 mt-1">{today}</p>
      </div>

      {/* Session status */}
      {stats?.session && (
        <div className="card p-4 mb-6 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <div>
            <span className="text-sm font-medium text-gray-800">Session Open</span>
            <span className="text-sm text-gray-500 ml-2">— {stats.session.date}</span>
          </div>
          <div className="ml-auto">
            <span className="badge badge-green">OPEN</span>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {statCards.map(({ label, value, sub, icon: Icon, color, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="card p-6 text-left hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-6 h-6" />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick action */}
      <div className="card p-6 bg-gradient-to-r from-brand-600 to-brand-700 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Ready to plan today?</h2>
            <p className="text-brand-100 text-sm mt-1">Assign buses to routes and create runs for this session.</p>
          </div>
          <button
            onClick={() => navigate('/planner')}
            className="flex items-center gap-2 bg-white text-brand-700 px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-brand-50 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Plan Today
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
