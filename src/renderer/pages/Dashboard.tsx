import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bus, MapPin, Users, Activity, ArrowRight, Settings, Monitor, AlertTriangle, CheckCircle, AlertCircle, Volume2 } from 'lucide-react'
import { Button, Heading, Text, Flash, IconButton, ActionMenu, ActionList } from '@primer/react'
import { useSessionStore } from '../store/sessionStore'
import AnnouncementPlayer from '../components/audio/AnnouncementPlayer'
import Modal from '../components/ui/Modal'
import type { SystemHealth, AnnouncementGroup, Shift, RunDirection } from '../../shared/types'

type PlayOption = {
  label: string
  groups: AnnouncementGroup[]
}

export default function Dashboard() {
  const { stats, loadStats } = useSessionStore()
  const navigate = useNavigate()
  const user = "Raiyan"
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [announcements, setAnnouncements] = useState<AnnouncementGroup[]>([])
  const [selectedOption, setSelectedOption] = useState<PlayOption | null>(null)
  const [shifts, setShifts] = useState<Shift[]>([])
  const [displayPickerOpen, setDisplayPickerOpen] = useState(false)
  const [displayShiftId, setDisplayShiftId] = useState<string | null>(null)
  const [displayDirection, setDisplayDirection] = useState<RunDirection>(
    () => (new Date().getHours() < 12 ? 'INBOUND' : 'OUTBOUND')
  )

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [menuWidth, setMenuWidth] = useState<number | undefined>(undefined)

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

  useEffect(() => {
    async function loadData() {
      const shiftRes = await window.api.shift.getAll()
      if (shiftRes.success) {
        const activeShifts = shiftRes.data.filter((s) => s.is_active)
        setShifts(activeShifts)
        setDisplayShiftId((prev) => prev ?? activeShifts[0]?.id ?? null)
      }

      const sessionRes = await window.api.session.getOrCreateToday()
      if (!sessionRes.success) return
      const res = await window.api.audio.resolveAnnouncements({ session_id: sessionRes.data.id })
      if (res.success) setAnnouncements(res.data)
    }
    loadData()
  }, [])

  const handleOpenDisplay = () => {
    if (!displayShiftId) return
    window.api.window.openDisplay({ shift_id: displayShiftId, direction: displayDirection })
    setDisplayPickerOpen(false)
  }

  useEffect(() => {
    if (wrapperRef.current) setMenuWidth(wrapperRef.current.offsetWidth)
    const handleResize = () => {
      if (wrapperRef.current) setMenuWidth(wrapperRef.current.offsetWidth)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [announcements.length])

  const playOptions = useMemo(() => {
    if (announcements.length === 0) return []
    const opts: PlayOption[] = []
    
    // Group announcements by shift + direction
    for (const shift of shifts) {
      for (const dir of ['INBOUND', 'OUTBOUND']) {
        const groups = announcements.filter(a => a.shift_id === shift.id && a.direction === dir)
        if (groups.length > 0) {
          opts.push({
            label: `Play ${shift.name} (${dir === 'INBOUND' ? 'School Bound' : 'Return'})`,
            groups
          })
        }
      }
    }
    
    // Fallback if no shifts matched but we have announcements
    if (opts.length === 0) {
      opts.push({ label: 'Play All Announcements', groups: announcements })
    }
    
    return opts
  }, [announcements, shifts])

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
            <Text sx={{ fontSize: 0, fontWeight: 'medium' }}>All systems operational</Text>
          </Flash>
        </div>
      )}

      {/* Announcement player */}
      {announcements.length > 0 && (
        <div style={{ margin: '8px 32px 0', display: 'flex', flexDirection: 'column', gap: 8 }} ref={wrapperRef}>
          <ActionMenu>
            <ActionMenu.Button leadingVisual={Volume2} size="small">
              {selectedOption
                ? selectedOption.label
                : `Play announcements`}
            </ActionMenu.Button>
            <ActionMenu.Overlay sx={{ width: menuWidth ? `${menuWidth}px` : 'auto', maxWidth: 'none' }}>
              <ActionList>
                {playOptions.map((opt, i) => {
                  const isComplete = opt.groups.length > 0 && opt.groups.every(g => g.isComplete)
                  return (
                    <ActionList.Item
                      key={i}
                      selected={selectedOption === opt}
                      onSelect={() => setSelectedOption(opt)}
                    >
                      {opt.label}
                      {!isComplete && (
                        <ActionList.TrailingVisual>
                          <AlertTriangle size={14} color="var(--fgColor-attention)" />
                        </ActionList.TrailingVisual>
                      )}
                    </ActionList.Item>
                  )
                })}
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
          {selectedOption && <AnnouncementPlayer groups={selectedOption.groups} label={selectedOption.label} />}
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
          onClick={() => setDisplayPickerOpen(true)}
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

      <Modal open={displayPickerOpen} onClose={() => setDisplayPickerOpen(false)} title="Open Display Board" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
            This opens a separate, read-only window meant for a public screen — pick what it should show. It won't have any controls of its own.
          </Text>

          <div>
            <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', display: 'block', mb: 2 }}>Shift</Text>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {shifts.map((shift) => (
                <Button
                  key={shift.id}
                  size="small"
                  variant={displayShiftId === shift.id ? 'primary' : 'default'}
                  onClick={() => setDisplayShiftId(shift.id)}
                >
                  {shift.name}
                </Button>
              ))}
              {shifts.length === 0 && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No active shifts configured</Text>}
            </div>
          </div>

          <div>
            <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', display: 'block', mb: 2 }}>Direction</Text>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="small" variant={displayDirection === 'INBOUND' ? 'primary' : 'default'} onClick={() => setDisplayDirection('INBOUND')} sx={{ flex: 1 }}>
                Inbound (to School)
              </Button>
              <Button size="small" variant={displayDirection === 'OUTBOUND' ? 'primary' : 'default'} onClick={() => setDisplayDirection('OUTBOUND')} sx={{ flex: 1 }}>
                Outbound (Home)
              </Button>
            </div>
          </div>

          <Button variant="primary" disabled={!displayShiftId} onClick={handleOpenDisplay} sx={{ width: '100%' }}>
            Open Display Board
          </Button>
        </div>
      </Modal>

    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
