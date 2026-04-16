import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bus, MapPin, Clock, CalendarDays,
  ChevronLeft, ChevronRight, Sun, Moon
} from 'lucide-react'
import { IconButton, Text } from '@primer/react'
import { useUiStore } from '../../store/uiStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/settings/buses', icon: Bus, label: 'Fleet' },
  { to: '/settings/routes', icon: MapPin, label: 'Routes' },
  { to: '/settings/shifts', icon: Clock, label: 'Shifts' },
  { to: '/planner', icon: CalendarDays, label: 'Planner' },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, colorMode, setColorMode } = useUiStore()
  const location = useLocation()

  return (
    <aside style={{
      display: 'flex', flexDirection: 'column',
      background: 'var(--bgColor-inset)', borderRight: '1px solid var(--borderColor-default)',
      transition: 'width 200ms ease', width: sidebarCollapsed ? 64 : 224,
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: sidebarCollapsed ? '16px 8px' : '16px',
        borderBottom: '1px solid var(--borderColor-default)',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        minHeight: 56,
      }}>
        <div style={{
          width: 32, height: 32, background: 'var(--bgColor-accent-emphasis)',
          borderRadius: 6, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0, color: 'var(--fgColor-onEmphasis)',
        }}>
          <Bus size={18} />
        </div>
        {!sidebarCollapsed && (
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2, color: 'var(--fgColor-default)', margin: 0 }}>
              School Bus
            </p>
            <p style={{ fontSize: 12, color: 'var(--fgColor-muted)', margin: 0 }}>
              Manager
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 4px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink key={to} to={to} title={sidebarCollapsed ? label : undefined} style={{ textDecoration: 'none' }}>
              <div
                className={isActive ? undefined : 'hov-bg-subtle hov-color-default'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: sidebarCollapsed ? '6px 0' : '6px 8px',
                  borderRadius: 6, cursor: 'pointer',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  background: isActive ? 'var(--bgColor-accent-emphasis)' : 'transparent',
                  color: isActive ? 'var(--fgColor-onEmphasis)' : 'var(--fgColor-muted)',
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && (
                  <Text sx={{ fontSize: 1, fontWeight: 'medium', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </Text>
                )}
              </div>
            </NavLink>
          )
        })}
      </nav>

      {/* Theme toggle */}
      <div style={{
        padding: sidebarCollapsed ? '4px' : '4px 8px',
        borderTop: '1px solid var(--borderColor-default)',
        display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        alignItems: 'center',
      }}>
        <IconButton
          icon={colorMode === 'day' ? Moon : Sun}
          aria-label={colorMode === 'day' ? 'Switch to dark mode' : 'Switch to light mode'}
          variant="invisible"
          size="small"
          onClick={() => setColorMode(colorMode === 'day' ? 'night' : 'day')}
          sx={{ color: 'fg.muted' }}
        />
        {!sidebarCollapsed && (
          <Text sx={{ fontSize: 0, color: 'fg.muted', alignSelf: 'center', ml: 1 }}>
            {colorMode === 'day' ? 'Dark mode' : 'Light mode'}
          </Text>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="hov-bg-subtle hov-color-default"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 8, borderTop: '1px solid var(--borderColor-default)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--fgColor-muted)', width: '100%',
        }}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!sidebarCollapsed && (
          <Text sx={{ ml: 1, fontSize: 0 }}>Collapse</Text>
        )}
      </button>
    </aside>
  )
}
