import { useParams, useNavigate } from 'react-router-dom'
import { Bus, MapPin, Clock } from 'lucide-react'
import TopBar from '../components/ui/TopBar'
import BusManagement from '../components/settings/BusManagement'
import RouteManagement from '../components/settings/RouteManagement'
import ShiftManagement from '../components/settings/ShiftManagement'

const TABS = [
  { id: 'buses',  label: 'Fleet',   icon: Bus,   component: BusManagement  },
  { id: 'routes', label: 'Routes',  icon: MapPin, component: RouteManagement },
  { id: 'shifts', label: 'Shifts',  icon: Clock,  component: ShiftManagement },
]

export default function Settings() {
  const { tab = 'buses' } = useParams<{ tab: string }>()
  const navigate = useNavigate()

  const active = TABS.find((t) => t.id === tab) ?? TABS[0]
  const ActiveComponent = active.component

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TopBar showBack backTo="/" backLabel="Home" title="Settings" />

      <div className="flex flex-1 overflow-hidden px-6 pb-6 gap-5">

        {/* Sidebar nav */}
        <aside className="w-44 shrink-0 pt-2">
          <nav className="space-y-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => navigate(`/settings/${id}`)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${active.id === id
                    ? 'bg-white text-brand-700 shadow-sm border border-gray-100'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <ActiveComponent />
        </main>

      </div>
    </div>
  )
}
