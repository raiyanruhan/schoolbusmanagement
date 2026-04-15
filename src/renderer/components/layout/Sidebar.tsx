import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bus, MapPin, Clock, CalendarDays,
  ChevronLeft, ChevronRight, Sun, Moon
} from 'lucide-react'
import { Box, IconButton, Text } from '@primer/react'
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
    <Box
      as="aside"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bg: 'canvas.inset',
        borderRight: '1px solid',
        borderColor: 'border.default',
        transition: 'width 200ms ease',
        width: sidebarCollapsed ? 64 : 224,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: sidebarCollapsed ? 2 : 3,
          py: 3,
          borderBottom: '1px solid',
          borderColor: 'border.default',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          minHeight: 56,
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            bg: 'accent.emphasis',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'fg.onEmphasis',
          }}
        >
          <Bus size={18} />
        </Box>
        {!sidebarCollapsed && (
          <Box>
            <Text as="p" sx={{ fontSize: 1, fontWeight: 'semibold', lineHeight: 1.2, color: 'fg.default', m: 0 }}>
              School Bus
            </Text>
            <Text as="p" sx={{ fontSize: 0, color: 'fg.muted', m: 0 }}>
              Manager
            </Text>
          </Box>
        )}
      </Box>

      {/* Nav */}
      <Box as="nav" sx={{ flex: 1, px: 1, py: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)
          return (
            <NavLink
              key={to}
              to={to}
              title={sidebarCollapsed ? label : undefined}
              style={{ textDecoration: 'none' }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: sidebarCollapsed ? 0 : 2,
                  py: '6px',
                  borderRadius: 2,
                  cursor: 'pointer',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  bg: isActive ? 'accent.emphasis' : 'transparent',
                  color: isActive ? 'fg.onEmphasis' : 'fg.muted',
                  '&:hover': {
                    bg: isActive ? 'accent.emphasis' : 'actionListItem.default.hoverBg',
                    color: isActive ? 'fg.onEmphasis' : 'fg.default',
                  },
                }}
              >
                <Icon size={18} style={{ flexShrink: 0 }} />
                {!sidebarCollapsed && (
                  <Text sx={{ fontSize: 1, fontWeight: 'medium', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {label}
                  </Text>
                )}
              </Box>
            </NavLink>
          )
        })}
      </Box>

      {/* Theme toggle */}
      <Box
        sx={{
          px: 1,
          py: 1,
          borderTop: '1px solid',
          borderColor: 'border.default',
          display: 'flex',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          pl: sidebarCollapsed ? 1 : 2,
        }}
      >
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
      </Box>

      {/* Collapse toggle */}
      <Box
        as="button"
        onClick={toggleSidebar}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          borderTop: '1px solid',
          borderColor: 'border.default',
          bg: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'fg.muted',
          '&:hover': { bg: 'actionListItem.default.hoverBg', color: 'fg.default' },
        }}
      >
        {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!sidebarCollapsed && (
          <Text sx={{ ml: 1, fontSize: 0 }}>Collapse</Text>
        )}
      </Box>
    </Box>
  )
}
