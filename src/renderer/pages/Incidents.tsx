import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Plus, X, RefreshCw } from 'lucide-react'
import type { Incident, CreateIncidentInput, IncidentType, IncidentSeverity, Bus } from '../../shared/types'
import { useSessionStore } from '../store/sessionStore'

const TYPE_LABELS: Record<IncidentType, string> = {
  BUS_BREAKDOWN: 'Bus Breakdown',
  BUS_DELAYED: 'Bus Delayed',
  DRIVER_ABSENT: 'Driver Absent',
  ROUTE_BLOCKED: 'Route Blocked',
  BUS_MAINTENANCE: 'Bus Maintenance'
}

const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  LOW: 'bg-gray-100 text-gray-600',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700'
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  OPEN: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />,
  ACKNOWLEDGED: <Clock className="w-3.5 h-3.5 text-yellow-500" />,
  RESOLVED: <CheckCircle className="w-3.5 h-3.5 text-green-500" />
}

// Incident types that require a bus to be specified
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

  // Auto-generate title when type + bus changes
  const busName = buses.find((b) => b.id === form.bus_id)?.number
  const busSuffix = busName ? ` — Bus ${busName}` : ''
  const autoTitle = `${TYPE_LABELS[form.type]}${busSuffix}`

  const handleCreate = async () => {
    if (!session) return
    const effectiveTitle = (form.title || autoTitle).trim()
    if (!effectiveTitle) return
    // Warn if bus-related incident has no bus selected
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

  const handleAcknowledge = async (id: string) => {
    await window.api.incident.acknowledge(id)
    load()
  }

  const handleResolve = async (id: string) => {
    await window.api.incident.resolve(id)
    load()
    loadStats()
  }

  const open = incidents.filter((i) => i.status !== 'RESOLVED')
  const resolved = incidents.filter((i) => i.status === 'RESOLVED')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 text-sm">Incidents</h1>
            <p className="text-xs text-gray-400">{open.length} open</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Report
          </button>
        </div>
      </div>

      {/* New incident form */}
      {showForm && (
        <div className="mx-6 mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-gray-900">Report Incident</h2>
            <button onClick={() => { setShowForm(false); setError(null) }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const type = e.target.value as IncidentType
                    setForm((f) => ({
                      ...f,
                      type,
                      // Clear bus selection if new type doesn't need it
                      bus_id: BUS_REQUIRED_TYPES.includes(type) ? f.bus_id : undefined,
                      // Auto-update title if it was auto-generated
                      title: f.title === autoTitle || f.title === '' ? '' : f.title
                    }))
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as IncidentSeverity }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            {/* Bus selector — required for bus-related incidents */}
            {BUS_REQUIRED_TYPES.includes(form.type) && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Affected Bus <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.bus_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, bus_id: e.target.value || undefined }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">— Select bus —</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      Bus {b.number} ({b.capacity} seats) — {b.status}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.title || autoTitle}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={autoTitle}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                placeholder="Additional details..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Reported by</label>
              <input
                type="text"
                value={form.reported_by}
                onChange={(e) => setForm((f) => ({ ...f, reported_by: e.target.value }))}
                placeholder="Name (optional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowForm(false); setError(null) }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !form.title.trim()}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {submitting ? 'Reporting…' : 'Report Incident'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incidents list */}
      <div className="flex-1 px-6 py-4 space-y-2 overflow-auto">
        {loading && incidents.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
            <CheckCircle className="w-10 h-10 text-green-400" />
            <p className="text-sm font-medium text-gray-500">No incidents today</p>
            <p className="text-xs text-gray-400">All systems operational</p>
          </div>
        ) : (
          <>
            {open.length > 0 && (
              <div className="space-y-2">
                {open.map((incident) => (
                  <IncidentCard
                    key={incident.id}
                    incident={incident}
                    onAcknowledge={handleAcknowledge}
                    onResolve={handleResolve}
                  />
                ))}
              </div>
            )}

            {resolved.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider px-1 mb-2">Resolved</p>
                <div className="space-y-2">
                  {resolved.map((incident) => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      onAcknowledge={handleAcknowledge}
                      onResolve={handleResolve}
                    />
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

function IncidentCard({
  incident,
  onAcknowledge,
  onResolve
}: {
  incident: Incident
  onAcknowledge: (id: string) => void
  onResolve: (id: string) => void
}) {
  const isResolved = incident.status === 'RESOLVED'
  const time = new Date(incident.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={`bg-white rounded-xl border p-4 ${isResolved ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{STATUS_ICON[incident.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-gray-900 truncate">{incident.title}</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${SEVERITY_COLORS[incident.severity]}`}>
              {incident.severity}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>{TYPE_LABELS[incident.type]}</span>
            <span>·</span>
            <span>{time}</span>
            {incident.reported_by && <><span>·</span><span>{incident.reported_by}</span></>}
          </div>
          {incident.description && (
            <p className="text-xs text-gray-500 mt-1.5">{incident.description}</p>
          )}
        </div>
      </div>

      {!isResolved && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
          {incident.status === 'OPEN' && (
            <button
              onClick={() => onAcknowledge(incident.id)}
              className="flex-1 py-1.5 rounded-lg border border-yellow-200 text-xs text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors font-medium"
            >
              Acknowledge
            </button>
          )}
          <button
            onClick={() => onResolve(incident.id)}
            className="flex-1 py-1.5 rounded-lg border border-green-200 text-xs text-green-700 bg-green-50 hover:bg-green-100 transition-colors font-medium"
          >
            Mark Resolved
          </button>
        </div>
      )}
    </div>
  )
}
