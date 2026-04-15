import { useParams, useNavigate } from 'react-router-dom'
import { Bus, MapPin, Clock } from 'lucide-react'
import { Box, Text } from '@primer/react'
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
    <Box sx={{ minHeight: '100vh', bg: 'canvas.default', display: 'flex', flexDirection: 'column' }}>
      <TopBar showBack backTo="/" backLabel="Home" title="Settings" />

      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', px: 4, pb: 4, gap: 4 }}>
        {/* Sidebar nav */}
        <Box as="aside" sx={{ width: 160, flexShrink: 0, pt: 2 }}>
          <Box as="nav" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <Box
                key={id}
                as="button"
                onClick={() => navigate(`/settings/${id}`)}
                sx={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 3,
                  py: 2,
                  fontSize: 1,
                  fontWeight: 'medium',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  bg: active.id === id ? 'canvas.subtle' : 'transparent',
                  color: active.id === id ? '' : 'fg.muted',
                  borderLeft: '2px solid',
                  borderColor: active.id === id ? 'accent.emphasis' : 'transparent',
                  '&:hover': {
                    bg: 'canvas.subtle',
                  },
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                <Text sx={{ fontSize: 1 }}>{label}</Text>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Content */}
        <Box
          as="main"
          sx={{
            flex: 1,
            bg: 'canvas.default',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'border.default',
            overflow: 'hidden',
          }}
        >
          <ActiveComponent />
        </Box>
      </Box>
    </Box>
  )
}
