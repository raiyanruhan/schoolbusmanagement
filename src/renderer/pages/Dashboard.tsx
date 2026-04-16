import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, Activity, ArrowRight, Settings, Monitor, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { Button, Heading, Text, Flash, IconButton } from '@primer/react'
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
    <div style={{ minHeight: '100vh', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 32px 8px' }}>
        <Text sx={{ fontWeight: 'semibold', color: 'fg.default', fontSize: 1 }}>School Bus Manager</Text>
        <IconButton icon={Settings} aria-label="Settings" variant="invisible"
          onClick={() => navigate('/settings')} sx={{ color: 'fg.muted' }} />
      </div>

      {/* System health alert */}
      {health && health.level !== 'GREEN' && (
        <div style={{ margin: '8px 32px 0' }}>
          <Flash variant={health.level === 'RED' ? 'danger' : 'warning'}
            sx={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
            onClick={() => navigate('/incidents')}>
            {health.level === 'RED'
              ? <AlertCircle size={16} style={{ flexShrink: 0 }} />
              : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block' }}>
                {health.level === 'RED' ? 'Critical issues require attention' : 'Active incidents'}
              </Text>
              <Text sx={{ fontSize: 0 }}>
                {health.openIncidents} open incident{health.openIncidents !== 1 ? 's' : ''}
                {health.activeConflicts > 0 && ` · ${health.activeConflicts} conflict${health.activeConflicts !== 1 ? 's' : ''}`}
              </Text>
            </div>
            <ArrowRight size={14} style={{ flexShrink: 0 }} />
          </Flash>
        </div>
      )}
      {health && health.level === 'GREEN' && (
        <div style={{ margin: '8px 32px 0' }}>
          <Flash variant="success" sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CheckCircle size={14} />
            <Text sx={{ fontSize: 0, fontWeight: 'medium' }}>All systems operational</Text>
          </Flash>
        </div>
      )}

      {/* Hero */}
      <div style={{ padding: '32px 32px 24px' }}>
        <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mb: 1 }}>{today}</Text>
        <Heading as="h1" sx={{ fontSize: 5, fontWeight: 'bold', color: 'fg.default', lineHeight: 1.2 }}>
          Good {getGreeting()}, {user}!
        </Heading>
      </div>

      {/* Stat cards */}
      <div style={{ padding: '0 32px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[
          { icon: Bus,      label: 'Buses',    value: stats?.totalBuses ?? '—',    sub: `${stats?.activeBuses ?? 0} active` },
          { icon: MapPin,   label: 'Routes',   value: stats?.totalRoutes ?? '—',   sub: 'active routes' },
          { icon: Users,    label: 'Students', value: stats?.totalStudents ?? '—', sub: 'planned today' },
          { icon: Activity, label: 'Runs',     value: stats?.runsToday ?? '—',     sub: "today's runs" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{
            background: 'var(--bgColor-muted)', borderRadius: 8,
            padding: 24, border: '1px solid var(--borderColor-default)',
          }}>
            <Text as="p" sx={{ fontSize: 5, fontWeight: 'bold', color: 'fg.default', m: 0 }}>{value}</Text>
            <Text as="p" sx={{ fontSize: 0, color: 'fg.muted', mt: 1, m: 0 }}>{sub}</Text>
          </div>
        ))}
      </div>

      {/* Primary actions */}
      <div style={{ padding: '0 32px 32px', marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Button variant="primary" size="large" onClick={() => navigate('/planner')}
          sx={{ width: '100%', justifyContent: 'space-between', py: 3, borderRadius: 3 }}>
          <div style={{ textAlign: 'left' }}>
            <Text sx={{ fontWeight: 'semibold', fontSize: 2, display: 'block' }}>Open Planner</Text>
          </div>
        </Button>

        <button
          onClick={() => window.api.window.openDisplay()}
          style={{
            width: '100%', background: 'var(--bgColor-emphasis)', color: 'var(--fgColor-onEmphasis)',
            border: 'none', borderRadius: 8, padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 14, display: 'block' }}>Open Display Board</span>
            <span style={{ fontSize: 12, display: 'block', opacity: 0.7, marginTop: 4 }}>Live run overview in a new window</span>
          </div>
          <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Monitor size={18} />
          </div>
        </button>

        <button
          onClick={() => navigate('/incidents')}
          className="hov-bg-subtle"
          style={{
            width: '100%', background: 'var(--bgColor-muted)', color: 'var(--fgColor-default)',
            border: '1px solid var(--borderColor-default)', borderRadius: 8,
            padding: '12px 16px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 14, display: 'block' }}>Incidents</span>
            <span style={{ fontSize: 12, color: 'var(--fgColor-muted)', display: 'block', marginTop: 4 }}>Report and manage operational issues</span>
          </div>
          <div style={{ width: 36, height: 36, background: 'var(--bgColor-inset)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={16} />
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
