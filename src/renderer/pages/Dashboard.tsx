import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, Activity, ArrowRight, Settings, Monitor, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { Box, Button, Heading, Text, Flash, IconButton } from '@primer/react'
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
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  return (
    <Box sx={{ minHeight: '100vh', bg: 'canvas.default', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 5, pt: 4, pb: 2 }}>
        <Text sx={{ fontWeight: 'semibold', color: 'fg.default', fontSize: 1 }}>School Bus Manager</Text>
        <IconButton
          icon={Settings}
          aria-label="Settings"
          variant="invisible"
          onClick={() => navigate('/settings')}
          sx={{ color: 'fg.muted' }}
        />
      </Box>

      {/* System health alert */}
      {health && health.level !== 'GREEN' && (
        <Box sx={{ mx: 5, mt: 2 }}>
          <Flash
            variant={health.level === 'RED' ? 'danger' : 'warning'}
            sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
            onClick={() => navigate('/incidents')}
          >
            {health.level === 'RED'
              ? <AlertCircle size={16} style={{ flexShrink: 0 }} />
              : <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            }
            <Box sx={{ flex: 1 }}>
              <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block' }}>
                {health.level === 'RED' ? 'Critical issues require attention' : 'Active incidents'}
              </Text>
              <Text sx={{ fontSize: 0 }}>
                {health.openIncidents} open incident{health.openIncidents !== 1 ? 's' : ''}
                {health.activeConflicts > 0 && ` · ${health.activeConflicts} conflict${health.activeConflicts !== 1 ? 's' : ''}`}
              </Text>
            </Box>
            <ArrowRight size={14} style={{ flexShrink: 0 }} />
          </Flash>
        </Box>
      )}
      {health && health.level === 'GREEN' && (
        <Box sx={{ mx: 5, mt: 2 }}>
          <Flash variant="success" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircle size={14} />
            <Text sx={{ fontSize: 0, fontWeight: 'medium' }}>All systems operational</Text>
          </Flash>
        </Box>
      )}

      {/* Hero */}
      <Box sx={{ px: 5, pt: 5, pb: 4 }}>
        <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mb: 1 }}>{today}</Text>
        <Heading as="h1" sx={{ fontSize: 5, fontWeight: 'bold', color: 'fg.default', lineHeight: 1.2 }}>
          Good {getGreeting()}, {user}!
        </Heading>
      </Box>

      {/* Stat cards */}
      <Box sx={{ px: 5, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 4 }}>
        {[
          { icon: Bus,      label: 'Buses',    value: stats?.totalBuses ?? '—',    sub: `${stats?.activeBuses ?? 0} active` },
          { icon: MapPin,   label: 'Routes',   value: stats?.totalRoutes ?? '—',   sub: 'active routes' },
          { icon: Users,    label: 'Students', value: stats?.totalStudents ?? '—', sub: 'planned today' },
          { icon: Activity, label: 'Runs',     value: stats?.runsToday ?? '—',     sub: "today's runs" },
        ].map(({ icon: Icon, label, value, sub }) => (
          <Box
            key={label}
            sx={{
              bg: 'canvas.subtle',
              borderRadius: 3,
              p: 4,
              border: '1px solid',
              borderColor: 'border.default',
            }}
          >
            <Box sx={{ color: 'accent.fg', mb: 2 }}>
            </Box>
            <Text as="p" sx={{ fontSize: 5, fontWeight: 'bold', color: 'fg.default', m: 0 }}>{value}</Text>
            <Text as="p" sx={{ fontSize: 0, color: 'fg.muted', mt: 1, m: 0 }}>{sub}</Text>
          </Box>
        ))}
      </Box>

      {/* Primary actions */}
      <Box sx={{ px: 5, mt: 'auto', pb: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Button
          variant="primary"
          size="large"
          onClick={() => navigate('/planner')}
          sx={{ width: '100%', justifyContent: 'space-between', py: 3, borderRadius: 3 }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Text sx={{ fontWeight: 'semibold', fontSize: 2, display: 'block' }}>Open Planner</Text>
          </Box>
        </Button>

        <Box
          as="button"
          onClick={() => window.api.window.openDisplay()}
          sx={{
            width: '100%',
            bg: 'neutral.emphasisPlus',
            color: 'fg.onEmphasis',
            border: 'none',
            borderRadius: 3,
            px: 4,
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            '&:hover': { opacity: 0.9 },
          }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Text sx={{ fontWeight: 'semibold', fontSize: 1, display: 'block', color: 'fg.onEmphasis' }}>Open Display Board</Text>
            <Text sx={{ fontSize: 0, display: 'block', color: 'fg.onEmphasis', opacity: 0.7, mt: 1 }}>Live run overview in a new window</Text>
          </Box>
          <Box sx={{ width: 36, height: 36, bg: 'rgba(255,255,255,0.1)', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={18} />
          </Box>
        </Box>

        <Box
          as="button"
          onClick={() => navigate('/incidents')}
          sx={{
            width: '100%',
            bg: 'canvas.subtle',
            color: 'fg.default',
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 3,
            px: 4,
            py: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            '&:hover': { bg: 'canvas.inset' },
          }}
        >
          <Box sx={{ textAlign: 'left' }}>
            <Text sx={{ fontWeight: 'semibold', fontSize: 1, display: 'block' }}>Incidents</Text>
            <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mt: 1 }}>Report and manage operational issues</Text>
          </Box>
          <Box sx={{ width: 36, height: 36, bg: 'canvas.inset', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={16} />
          </Box>
        </Box>
      </Box>

    </Box>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
