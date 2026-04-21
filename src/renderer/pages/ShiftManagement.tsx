import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Clock, ChevronRight, Save } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { useUiStore } from '../store/uiStore'
import type { Shift, StopConfig, GenderMode, CreateShiftInput, UpdateShiftInput } from '../../shared/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShiftFormData {
  name: string
  name_bn: string
  sort_order: string
  inbound_depart_school: string
  outbound_depart_school: string
  school_start_time: string
  school_end_time: string
  gender_mode: GenderMode
  default_overload: string
}

interface StopConfigRow {
  stop_id: string
  stop_name: string
  route_name: string
  config: StopConfig | null
  is_active: boolean
  planned_boys: number
  planned_girls: number
}

// ─── Shift Form ───────────────────────────────────────────────────────────────

function ShiftForm({ initial, onSubmit, onCancel, loading, error }: {
  initial?: Shift
  onSubmit: (d: ShiftFormData) => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  const [form, setForm] = useState<ShiftFormData>(
    initial
      ? {
          name: initial.name, name_bn: initial.name_bn ?? '',
          sort_order: String(initial.sort_order),
          inbound_depart_school: initial.inbound_depart_school ?? '',
          outbound_depart_school: initial.outbound_depart_school ?? '',
          school_start_time: initial.school_start_time ?? '',
          school_end_time: initial.school_end_time ?? '',
          gender_mode: initial.gender_mode,
          default_overload: String(initial.default_overload)
        }
      : {
          name: '', name_bn: '', sort_order: '1',
          inbound_depart_school: '', outbound_depart_school: '',
          school_start_time: '', school_end_time: '',
          gender_mode: 'COMBINED', default_overload: '0'
        }
  )

  const set = (k: keyof ShiftFormData, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Shift Name *</label>
          <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning" required />
        </div>
        <div>
          <label className="form-label">Sort Order</label>
          <input className="form-input" type="number" min={1} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="form-label">Bengali Name</label>
        <input className="form-input" value={form.name_bn} onChange={(e) => set('name_bn', e.target.value)} />
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Inbound (Pickup → School)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Buses Leave School</label>
            <input className="form-input" type="time" value={form.inbound_depart_school} onChange={(e) => set('inbound_depart_school', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Classes Start</label>
            <input className="form-input" type="time" value={form.school_start_time} onChange={(e) => set('school_start_time', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">Outbound (School → Drops)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Classes End</label>
            <input className="form-input" type="time" value={form.school_end_time} onChange={(e) => set('school_end_time', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Buses Depart School</label>
            <input className="form-input" type="time" value={form.outbound_depart_school} onChange={(e) => set('outbound_depart_school', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Gender Mode</label>
          <select className="form-select" value={form.gender_mode} onChange={(e) => set('gender_mode', e.target.value as GenderMode)}>
            <option value="COMBINED">Combined</option>
            <option value="SEPARATED">Separated</option>
            <option value="AUTO">Auto</option>
          </select>
        </div>
        <div>
          <label className="form-label">Default Overload</label>
          <input className="form-input" type="number" min={0} value={form.default_overload} onChange={(e) => set('default_overload', e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Create Shift'}
        </button>
      </div>
    </form>
  )
}

// ─── Stop Config Panel ────────────────────────────────────────────────────────

function StopConfigPanel({ shift }: { shift: Shift }) {
  const { showToast } = useUiStore()
  const [rows, setRows] = useState<StopConfigRow[]>([])
  const [saving, setSaving] = useState<string | null>(null)

  const loadConfigs = useCallback(async () => {
    const routesResult = await window.api.route.getAll()
    if (!routesResult.success) return

    const configResult = await window.api.shift.getStopConfigs(shift.id)
    const configs = configResult.success ? configResult.data : []
    const configMap = new Map(configs.map((c) => [c.stop_id, c]))

    const allRows: StopConfigRow[] = []
    for (const route of routesResult.data) {
      if (!route.is_active) continue
      const stopsResult = await window.api.route.getWithStops(route.id)
      if (!stopsResult.success) continue
      for (const stop of stopsResult.data.stops) {
        if (!stop.is_active) continue
        const cfg = configMap.get(stop.id) ?? null
        allRows.push({
          stop_id: stop.id,
          stop_name: stop.name,
          route_name: route.name,
          config: cfg,
          is_active: cfg?.is_active ? true : false,
          planned_boys: cfg?.planned_boys ?? 0,
          planned_girls: cfg?.planned_girls ?? 0
        })
      }
    }
    setRows(allRows)
  }, [shift.id])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const handleSave = async (row: StopConfigRow) => {
    setSaving(row.stop_id)
    const result = await window.api.shift.upsertStopConfig({
      stop_id: row.stop_id,
      shift_id: shift.id,
      is_active: row.is_active,
      planned_boys: row.planned_boys,
      planned_girls: row.planned_girls
    })
    setSaving(null)
    if (result.success) {
      showToast(`Config saved for ${row.stop_name}`)
      loadConfigs()
    } else {
      showToast(result.error, 'error')
    }
  }

  const updateRow = (stop_id: string, changes: Partial<StopConfigRow>) => {
    setRows((prev) => prev.map((r) => r.stop_id === stop_id ? { ...r, ...changes } : r))
  }

  if (rows.length === 0) {
    return <div className="p-6 text-center text-gray-400 text-sm">No active stops found. Add routes and stops first.</div>
  }

  return (
    <div className="overflow-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="table-header">Route</th>
            <th className="table-header">Stop</th>
            <th className="table-header text-center">Active</th>
            <th className="table-header text-center">Boys</th>
            <th className="table-header text-center">Girls</th>
            <th className="table-header text-center">Total</th>
            <th className="table-header w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stop_id} className={`table-row ${!row.is_active ? 'opacity-60' : ''}`}>
              <td className="table-cell text-xs text-gray-400">{row.route_name}</td>
              <td className="table-cell font-medium">{row.stop_name}</td>
              <td className="table-cell text-center">
                <input
                  type="checkbox"
                  checked={row.is_active}
                  onChange={(e) => updateRow(row.stop_id, { is_active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
              </td>
              <td className="table-cell text-center">
                <input
                  type="number" min={0} value={row.planned_boys}
                  onChange={(e) => updateRow(row.stop_id, { planned_boys: parseInt(e.target.value) || 0 })}
                  className="w-16 text-center form-input py-1 px-2 text-sm"
                  disabled={!row.is_active}
                />
              </td>
              <td className="table-cell text-center">
                <input
                  type="number" min={0} value={row.planned_girls}
                  onChange={(e) => updateRow(row.stop_id, { planned_girls: parseInt(e.target.value) || 0 })}
                  className="w-16 text-center form-input py-1 px-2 text-sm"
                  disabled={!row.is_active}
                />
              </td>
              <td className="table-cell text-center font-medium">
                {row.is_active ? row.planned_boys + row.planned_girls : '—'}
              </td>
              <td className="table-cell">
                <button
                  onClick={() => handleSave(row)}
                  disabled={saving === row.stop_id}
                  className="btn-primary btn-sm"
                >
                  <Save className="w-3 h-3" />
                  {saving === row.stop_id ? '...' : 'Save'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50 border-t border-gray-200">
          <tr>
            <td colSpan={3} className="table-cell text-xs text-gray-500 font-medium">Totals (active stops)</td>
            <td className="table-cell text-center text-brand-700">
              {rows.filter((r) => r.is_active).reduce((s, r) => s + r.planned_boys, 0)}
            </td>
            <td className="table-cell text-center text-purple-700">
              {rows.filter((r) => r.is_active).reduce((s, r) => s + r.planned_girls, 0)}
            </td>
            <td className="table-cell text-center">
              {rows.filter((r) => r.is_active).reduce((s, r) => s + r.planned_boys + r.planned_girls, 0)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function parseShiftForm(form: ShiftFormData): CreateShiftInput {
  return {
    name: form.name.trim(),
    name_bn: form.name_bn.trim() || undefined,
    sort_order: parseInt(form.sort_order) || 1,
    inbound_depart_school: form.inbound_depart_school || undefined,
    outbound_depart_school: form.outbound_depart_school || undefined,
    school_start_time: form.school_start_time || undefined,
    school_end_time: form.school_end_time || undefined,
    gender_mode: form.gender_mode,
    default_overload: parseInt(form.default_overload) || 0
  }
}

export default function ShiftManagement() {
  const { showToast } = useUiStore()
  const [shifts, setShifts] = useState<Shift[]>([])
  const [selected, setSelected] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editShift, setEditShift] = useState<Shift | null>(null)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    const result = await window.api.shift.getAll()
    if (result.success) {
      setShifts(result.data)
      if (!selected && result.data.length > 0) setSelected(result.data[0])
    }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const handleAdd = async (form: ShiftFormData) => {
    setFormLoading(true); setFormError(null)
    const result = await window.api.shift.create(parseShiftForm(form))
    setFormLoading(false)
    if (result.success) {
      setAddOpen(false); fetchShifts()
      showToast(`Shift "${result.data.name}" created`)
    } else setFormError(result.error)
  }

  const handleEdit = async (form: ShiftFormData) => {
    if (!editShift) return
    setFormLoading(true); setFormError(null)
    const update: UpdateShiftInput = { id: editShift.id, ...parseShiftForm(form) }
    const result = await window.api.shift.update(update)
    setFormLoading(false)
    if (result.success) {
      setEditShift(null); fetchShifts()
      setSelected(result.data)
      showToast(`Shift updated`)
    } else setFormError(result.error)
  }

  return (
    <div className="flex h-full">
      {/* Left: Shift list */}
      <div className="w-64 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="section-title">Shifts</h2>
          <button onClick={() => { setFormError(null); setAddOpen(true) }} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {shifts.map((shift) => (
              <button
                key={shift.id}
                onClick={() => setSelected(shift)}
                className={`w-full text-left px-4 py-4 border-b border-gray-50 flex items-center gap-3 transition-colors
                  ${selected?.id === shift.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-gray-50'}`}
              >
                <div className="w-9 h-9 bg-brand-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-brand-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{shift.name}</p>
                  <p className="text-xs text-gray-400">{shift.gender_mode}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            ))}
            {shifts.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">No shifts yet</div>}
          </div>
        )}
      </div>

      {/* Right: Shift details + stop configs */}
      <div className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Clock className="w-12 h-12 mb-3 text-gray-300" />
            <p className="font-medium">Select a shift</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Shift header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="section-title">{selected.name}</h2>
                <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                  {selected.inbound_depart_school && (
                    <span>Inbound depart: <strong>{selected.inbound_depart_school}</strong></span>
                  )}
                  {selected.outbound_depart_school && (
                    <span>Outbound depart: <strong>{selected.outbound_depart_school}</strong></span>
                  )}
                  <span className="badge-gray">{selected.gender_mode}</span>
                  <span className="text-xs text-gray-400">Overload: +{selected.default_overload}</span>
                </div>
              </div>
              <button onClick={() => { setFormError(null); setEditShift(selected) }} className="btn-secondary btn-sm">
                <Pencil className="w-3.5 h-3.5" /> Edit Shift
              </button>
            </div>

            {/* Stop Configs */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm text-gray-700">Student Counts per Stop</h3>
                <p className="text-xs text-gray-400 mt-0.5">Configure planned student counts for each stop in this shift</p>
              </div>
              <StopConfigPanel key={selected.id} shift={selected} />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Shift" size="lg">
        <ShiftForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={formLoading} error={formError} />
      </Modal>
      <Modal open={!!editShift} onClose={() => setEditShift(null)} title="Edit Shift" size="lg">
        {editShift && (
          <ShiftForm initial={editShift} onSubmit={handleEdit} onCancel={() => setEditShift(null)} loading={formLoading} error={formError} />
        )}
      </Modal>
    </div>
  )
}
