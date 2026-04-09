import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Bus, MapPin, Clock, CalendarDays, ChevronLeft, ChevronRight
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { cn } from '../../utils/cn'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/buses', icon: Bus, label: 'Fleet' },
  { to: '/routes', icon: MapPin, label: 'Routes' },
  { to: '/shifts', icon: Clock, label: 'Shifts' },
  { to: '/planner', icon: CalendarDays, label: 'Planner' }
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore()

  return (
    <aside
      className={cn(
        'flex flex-col bg-gray-900 text-white transition-all duration-200 shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 py-5 border-b border-gray-700', sidebarCollapsed && 'justify-center px-2')}>
        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center shrink-0">
          <Bus className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p className="text-sm font-semibold leading-tight">School Bus</p>
            <p className="text-xs text-gray-400">Manager</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white',
                sidebarCollapsed && 'justify-center px-2'
              )
            }
            title={sidebarCollapsed ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center p-3 border-t border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        {!sidebarCollapsed && <span className="ml-2 text-xs">Collapse</span>}
      </button>
    </aside>
  )
}
