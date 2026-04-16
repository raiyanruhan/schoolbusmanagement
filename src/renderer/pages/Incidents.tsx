import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Plus, X, RefreshCw } from 'lucide-react'
import { Button, Text, Heading, FormControl, TextInput, Select, Textarea, Label, Flash, Spinner, IconButton } from '@primer/react'
import type { Incident, CreateIncidentInput, IncidentType, IncidentSeverity, Bus } from '../../shared/types'
import { useSessionStore } from '../store/sessionStore'

const TYPE_LABELS: Record<IncidentType, string> = {
  BUS_BREAKDOWN: 'Bus Breakdown',
  BUS_DELAYED: 'Bus Delayed',
  DRIVER_ABSENT: 'Driver Absent',
  ROUTE_BLOCKED: 'Route Blocked',
  BUS_MAINTENANCE: 'Bus Maintenance'
}

type SeverityVariant = 'secondary' | 'attention' | 'danger'
const SEVERITY_VARIANT: Record<IncidentSeverity, SeverityVariant> = {
  LOW: 'secondary',
  MEDIUM: 'attention',
  HIGH: 'attention',
  CRITICAL: 'danger',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN: <AlertTriangle size={14} style={{ color: 'var(--fgColor-danger)' }} />,
  ACKNOWLEDGED: <Clock size={14} style={{ color: 'var(--fgColor-attention)' }} />,
  RESOLVED: <CheckCircle size={14} style={{ color: 'var(--fgColor-success)' }} />,
}

const BUS_REQUIRED_TYPES: IncidentType[] = ['BUS_BREAKDOWN', 'BUS_DELAYED', 'DRIVER_ABSENT', 'BUS_MAINTENANCE']

const BLANK_FORM: Omit<CreateIncidentInput, 'session_id'> = {
  type: 'BUS_BREAKDOWN',
  severity: 'HIGH',
  title: '',
  description: '',
  reported_by: '',
  bus_id: undefined
}

export default function Incidents() {
  const navigate = useNavigate()
  const { session, loadStats } = useSessionStore()

  const [incidents, setIncidents] = useState<Incident[]>([])
  const [buses, setBuses] = useState<Bus[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    const [incRes, busRes] = await Promise.all([
      window.api.incident.getBySession(session.id),
      window.api.bus.getAll()
    ])
    if (incRes.success) setIncidents(incRes.data)
    if (busRes.success) setBuses(busRes.data)
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  const busName = buses.find((b) => b.id === form.bus_id)?.number
  const busSuffix = busName ? ` — Bus ${busName}` : ''
  const autoTitle = `${TYPE_LABELS[form.type]}${busSuffix}`

  const handleCreate = async () => {
    if (!session) return
    const effectiveTitle = (form.title || autoTitle).trim()
    if (!effectiveTitle) return
    if (BUS_REQUIRED_TYPES.includes(form.type) && !form.bus_id) {
      setError('Please select the affected bus for this incident type')
      return
    }
    setSubmitting(true)
    setError(null)
    const res = await window.api.incident.create({
      ...form,
      session_id: session.id,
      title: effectiveTitle,
      description: form.description?.trim() || undefined,
      reported_by: form.reported_by?.trim() || undefined,
      bus_id: form.bus_id || undefined
    })
    if (res.success) {
      setShowForm(false)
      setForm(BLANK_FORM)
      await load()
      loadStats()
    } else {
      setError(res.error)
    }
    setSubmitting(false)
  }

  const handleAcknowledge = async (id: string) => { await window.api.incident.acknowledge(id); load() }
  const handleResolve = async (id: string) => { await window.api.incident.resolve(id); load(); loadStats() }

  const open = incidents.filter((i) => i.status !== 'RESOLVED')
  const resolved = incidents.filter((i) => i.status === 'RESOLVED')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <IconButton icon={ArrowLeft} aria-label="Back" variant="invisible" onClick={() => navigate('/')} sx={{ color: 'fg.muted' }} />
          <div>
            <Heading as="h1" sx={{ fontSize: 2 }}>Incidents</Heading>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{open.length} open</Text>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconButton icon={RefreshCw} aria-label="Refresh" variant="invisible" onClick={load} sx={{ color: 'fg.muted' }} />
          <Button variant="danger" size="small" leadingVisual={Plus} onClick={() => setShowForm(true)}>Report</Button>
        </div>
      </div>

      {/* New incident form */}
      {showForm && (
        <div style={{ margin: '16px 24px 0', background: 'var(--bgColor-muted)', border: '1px solid var(--borderColor-default)', borderRadius: 6, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <Heading as="h2" sx={{ fontSize: 2 }}>Report Incident</Heading>
            <IconButton icon={X} aria-label="Close" variant="invisible" size="small" onClick={() => { setShowForm(false); setError(null) }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <FormControl>
                <FormControl.Label>Type</FormControl.Label>
                <Select value={form.type} onChange={(e) => {
                  const type = e.target.value as IncidentType
                  setForm((f) => ({ ...f, type, bus_id: BUS_REQUIRED_TYPES.includes(type) ? f.bus_id : undefined, title: f.title === autoTitle || f.title === '' ? '' : f.title }))
                }}>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <Select.Option key={v} value={v}>{l}</Select.Option>)}
                </Select>
              </FormControl>
              <FormControl>
                <FormControl.Label>Severity</FormControl.Label>
                <Select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as IncidentSeverity }))}>
                  <Select.Option value="LOW">Low</Select.Option>
                  <Select.Option value="MEDIUM">Medium</Select.Option>
                  <Select.Option value="HIGH">High</Select.Option>
                  <Select.Option value="CRITICAL">Critical</Select.Option>
                </Select>
              </FormControl>
            </div>

            {BUS_REQUIRED_TYPES.includes(form.type) && (
              <FormControl required>
                <FormControl.Label>Affected Bus</FormControl.Label>
                <Select value={form.bus_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, bus_id: e.target.value || undefined }))}>
                  <Select.Option value="">— Select bus —</Select.Option>
                  {buses.map((b) => <Select.Option key={b.id} value={b.id}>Bus {b.number} ({b.capacity} seats) — {b.status}</Select.Option>)}
                </Select>
              </FormControl>
            )}

            <FormControl required>
              <FormControl.Label>Title</FormControl.Label>
              <TextInput
                value={form.title || autoTitle}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={autoTitle}
                block
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Description</FormControl.Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Additional details..."
                resize="vertical"
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Reported by</FormControl.Label>
              <TextInput
                value={form.reported_by}
                onChange={(e) => setForm((f) => ({ ...f, reported_by: e.target.value }))}
                placeholder="Name (optional)"
                block
              />
            </FormControl>

            {error && <Flash variant="danger">{error}</Flash>}

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="default" onClick={() => { setShowForm(false); setError(null) }} style={{ flex: 1 }}>Cancel</Button>
              <Button variant="danger" disabled={submitting || !form.title.trim()} onClick={handleCreate} style={{ flex: 1 }}>
                {submitting ? 'Reporting…' : 'Report Incident'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Incidents list */}
      <div style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {loading && incidents.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 128, gap: 8, color: 'var(--fgColor-muted)' }}>
            <Spinner size="small" /><Text sx={{ fontSize: 1 }}>Loading…</Text>
          </div>
        ) : incidents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 192, gap: 8, color: 'var(--fgColor-muted)' }}>
            <CheckCircle size={40} style={{ color: 'var(--fgColor-success)', opacity: 0.6 }} />
            <Text sx={{ fontSize: 1, fontWeight: 'semibold', color: 'fg.default' }}>No incidents today</Text>
            <Text sx={{ fontSize: 0 }}>All systems operational</Text>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {open.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
                ))}
              </div>
            )}
            {resolved.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <Text sx={{ fontSize: 0, color: 'fg.muted', fontWeight: 'semibold', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Resolved</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {resolved.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function IncidentCard({ incident, onAcknowledge, onResolve }: {
  incident: Incident
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
}) {
  const isResolved = incident.status === 'RESOLVED'
  const time = new Date(incident.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{
      background: 'var(--bgColor-default)',
      borderRadius: 6,
      border: '1px solid var(--borderColor-default)',
      padding: 16,
      opacity: isResolved ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ marginTop: 2, flexShrink: 0 }}>{STATUS_ICON[incident.status]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <Text sx={{ fontSize: 1, fontWeight: 'medium', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{incident.title}</Text>
            <Label variant={SEVERITY_VARIANT[incident.severity]}>{incident.severity}</Label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--fgColor-muted)' }}>
            <Text sx={{ fontSize: 0 }}>{TYPE_LABELS[incident.type]}</Text>
            <Text sx={{ fontSize: 0 }}>·</Text>
            <Text sx={{ fontSize: 0 }}>{time}</Text>
            {incident.reported_by && <><Text sx={{ fontSize: 0 }}>·</Text><Text sx={{ fontSize: 0 }}>{incident.reported_by}</Text></>}
          </div>
          {incident.description && (
            <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>{incident.description}</Text>
          )}
        </div>
      </div>

      {!isResolved && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--borderColor-muted)' }}>
          {incident.status === 'OPEN' && (
            <Button size="small" variant="default" onClick={() => onAcknowledge(incident.id)} style={{ flex: 1 }}>Acknowledge</Button>
          )}
          <Button size="small" variant="primary" onClick={() => onResolve(incident.id)} style={{ flex: 1 }}>Mark Resolved</Button>
        </div>
      )}
    </div>
  )
}
