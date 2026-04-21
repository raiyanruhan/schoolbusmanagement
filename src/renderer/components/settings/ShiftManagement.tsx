import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Clock, ChevronRight, Save, FileSpreadsheet, Upload, Trash2 } from 'lucide-react'
import { Button, Text, Heading, FormControl, TextInput, Select, Flash, IconButton, Spinner } from '@primer/react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useUiStore } from '../../store/uiStore'
import type { Shift, StopConfig, GenderMode, CreateShiftInput, UpdateShiftInput } from '../../../shared/types'

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

function ShiftForm({ initial, onSubmit, onCancel, loading, error }: {
  initial?: Shift
  onSubmit: (d: ShiftFormData) => void
  onCancel: () => void
  loading: boolean
  error: string | null
}) {
  const [form, setForm] = useState<ShiftFormData>(
    initial
      ? { name: initial.name, name_bn: initial.name_bn ?? '', sort_order: String(initial.sort_order), inbound_depart_school: initial.inbound_depart_school ?? '', outbound_depart_school: initial.outbound_depart_school ?? '', school_start_time: initial.school_start_time ?? '', school_end_time: initial.school_end_time ?? '', gender_mode: initial.gender_mode, default_overload: String(initial.default_overload) }
      : { name: '', name_bn: '', sort_order: '1', inbound_depart_school: '', outbound_depart_school: '', school_start_time: '', school_end_time: '', gender_mode: 'COMBINED', default_overload: '0' }
  )

  const set = (k: keyof ShiftFormData, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(form) }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormControl required>
          <FormControl.Label>Shift Name</FormControl.Label>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Morning" block />
        </FormControl>
        <FormControl>
          <FormControl.Label>Sort Order</FormControl.Label>
          <TextInput type="number" min={1} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} block />
        </FormControl>
      </div>
      <FormControl>
        <FormControl.Label>Bengali Name</FormControl.Label>
        <TextInput value={form.name_bn} onChange={(e) => set('name_bn', e.target.value)} block />
      </FormControl>

      <div style={{ borderTop: '1px solid var(--borderColor-muted)', paddingTop: 16 }}>
        <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 2 }}>Inbound (Pickup → School)</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormControl>
            <FormControl.Label>Buses Leave School</FormControl.Label>
            <TextInput type="time" value={form.inbound_depart_school} onChange={(e) => set('inbound_depart_school', e.target.value)} block />
          </FormControl>
          <FormControl>
            <FormControl.Label>Classes Start</FormControl.Label>
            <TextInput type="time" value={form.school_start_time} onChange={(e) => set('school_start_time', e.target.value)} block />
          </FormControl>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--borderColor-muted)', paddingTop: 16 }}>
        <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 2 }}>Outbound (School → Drops)</Text>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <FormControl>
            <FormControl.Label>Classes End</FormControl.Label>
            <TextInput type="time" value={form.school_end_time} onChange={(e) => set('school_end_time', e.target.value)} block />
          </FormControl>
          <FormControl>
            <FormControl.Label>Buses Depart School</FormControl.Label>
            <TextInput type="time" value={form.outbound_depart_school} onChange={(e) => set('outbound_depart_school', e.target.value)} block />
          </FormControl>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--borderColor-muted)', paddingTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <FormControl>
          <FormControl.Label>Gender Mode</FormControl.Label>
          <Select value={form.gender_mode} onChange={(e) => set('gender_mode', e.target.value as GenderMode)}>
            <Select.Option value="COMBINED">Combined</Select.Option>
            <Select.Option value="SEPARATED">Separated</Select.Option>
            <Select.Option value="AUTO">Auto</Select.Option>
          </Select>
        </FormControl>
        <FormControl>
          <FormControl.Label>Default Overload</FormControl.Label>
          <TextInput type="number" min={0} value={form.default_overload} onChange={(e) => set('default_overload', e.target.value)} block />
        </FormControl>
      </div>

      {error && <Flash variant="danger">{error}</Flash>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
        <Button type="button" variant="default" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>{loading ? 'Saving...' : initial ? 'Save Changes' : 'Create Shift'}</Button>
      </div>
    </form>
  )
}

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
        allRows.push({ stop_id: stop.id, stop_name: stop.name, route_name: route.name, config: cfg, is_active: cfg?.is_active ? true : false, planned_boys: cfg?.planned_boys ?? 0, planned_girls: cfg?.planned_girls ?? 0 })
      }
    }
    setRows(allRows)
  }, [shift.id])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const handleSave = async (row: StopConfigRow) => {
    setSaving(row.stop_id)
    const result = await window.api.shift.upsertStopConfig({ stop_id: row.stop_id, shift_id: shift.id, is_active: row.is_active, planned_boys: row.planned_boys, planned_girls: row.planned_girls })
    setSaving(null)
    if (result.success) { showToast(`Config saved for ${row.stop_name}`); loadConfigs() }
    else showToast(result.error, 'error')
  }

  const updateRow = (stop_id: string, changes: Partial<StopConfigRow>) => {
    setRows((prev) => prev.map((r) => r.stop_id === stop_id ? { ...r, ...changes } : r))
  }

  if (rows.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--fgColor-muted)', fontSize: 14 }}>No active stops found. Add routes and stops first.</div>
  }

  const activeRows = rows.filter((r) => r.is_active)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--bgColor-muted)', borderBottom: '1px solid var(--borderColor-default)' }}>
          <tr>
            {['Route', 'Stop', 'Active', 'Boys', 'Girls', 'Total', ''].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--fgColor-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stop_id} className="hov-bg-subtle" style={{ borderBottom: '1px solid var(--borderColor-muted)', opacity: row.is_active ? 1 : 0.6 }}>
              <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fgColor-muted)' }}>{row.route_name}</td>
              <td style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500 }}>{row.stop_name}</td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <input type="checkbox" checked={row.is_active} onChange={(e) => updateRow(row.stop_id, { is_active: e.target.checked })} />
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <TextInput type="number" min={0} value={String(row.planned_boys)} onChange={(e) => updateRow(row.stop_id, { planned_boys: parseInt(e.target.value) || 0 })} disabled={!row.is_active} sx={{ width: 64, textAlign: 'center' }} />
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                <TextInput type="number" min={0} value={String(row.planned_girls)} onChange={(e) => updateRow(row.stop_id, { planned_girls: parseInt(e.target.value) || 0 })} disabled={!row.is_active} sx={{ width: 64, textAlign: 'center' }} />
              </td>
              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>
                {row.is_active ? row.planned_boys + row.planned_girls : '—'}
              </td>
              <td style={{ padding: '8px 12px' }}>
                <Button size="small" variant="primary" leadingVisual={Save} disabled={saving === row.stop_id} onClick={() => handleSave(row)}>
                  {saving === row.stop_id ? '...' : 'Save'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot style={{ background: 'var(--bgColor-muted)', borderTop: '1px solid var(--borderColor-default)', position: 'sticky', bottom: 0 }}>
          <tr>
            <td colSpan={3} style={{ padding: '8px 12px', fontSize: 12, color: 'var(--fgColor-muted)', fontWeight: 500 }}>Totals (active stops)</td>
            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--fgColor-accent)' }}>{activeRows.reduce((s, r) => s + r.planned_boys, 0)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{activeRows.reduce((s, r) => s + r.planned_girls, 0)}</td>
            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600 }}>{activeRows.reduce((s, r) => s + r.planned_boys + r.planned_girls, 0)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function parseShiftForm(form: ShiftFormData): CreateShiftInput {
  return {
    name: form.name.trim(), name_bn: form.name_bn.trim() || undefined,
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
  const [deleteShift, setDeleteShift] = useState<Shift | null>(null)
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    const result = await window.api.shift.getAll()
    if (result.success) { setShifts(result.data); if (!selected && result.data.length > 0) setSelected(result.data[0]) }
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchShifts() }, [fetchShifts])

  const handleAdd = async (form: ShiftFormData) => {
    setFormLoading(true); setFormError(null)
    const result = await window.api.shift.create(parseShiftForm(form))
    setFormLoading(false)
    if (result.success) { setAddOpen(false); fetchShifts(); showToast(`Shift "${result.data.name}" created`) }
    else setFormError(result.error)
  }

  const handleEdit = async (form: ShiftFormData) => {
    if (!editShift) return
    setFormLoading(true); setFormError(null)
    const result = await window.api.shift.update({ id: editShift.id, ...parseShiftForm(form) } as UpdateShiftInput)
    setFormLoading(false)
    if (result.success) { setEditShift(null); fetchShifts(); setSelected(result.data); showToast('Shift updated') }
    else setFormError(result.error)
  }

  const handleDelete = async () => {
    if (!deleteShift) return
    const result = await window.api.shift.delete(deleteShift.id)
    if (result.success) { if (selected?.id === deleteShift.id) setSelected(null); fetchShifts(); showToast(`Shift "${deleteShift.name}" deleted`, 'info') }
    else showToast(result.error, 'error')
    setDeleteShift(null)
  }

  const handleImportConfigs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected) return
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = await window.api.excel.importShiftConfigs({ shift_id: selected.id, buffer })
      if (result.success) {
        const { updated, notFound } = result.data
        showToast(`${updated} stop config${updated !== 1 ? 's' : ''} imported` + (notFound.length > 0 ? ` · ${notFound.length} not found` : ''))
        setSelected({ ...selected })
      } else showToast(result.error, 'error')
    } catch { showToast('Failed to read file', 'error') }
    setImporting(false)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Shift list */}
      <div style={{ width: 256, borderRight: '1px solid var(--borderColor-default)', background: 'var(--bgColor-default)', display: 'flex', flexDirection: 'column', boxShadow: '3px 0 10px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--borderColor-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Heading as="h2" sx={{ fontSize: 2 }}>Shifts</Heading>
          <IconButton icon={Plus} aria-label="Add shift" variant="primary" size="small" onClick={() => { setFormError(null); setAddOpen(true) }} />
        </div>
        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--fgColor-muted)' }}><Spinner /></div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {shifts.map((shift) => (
              <div key={shift.id} style={{ borderBottom: '1px solid var(--borderColor-muted)', display: 'flex', alignItems: 'center', background: selected?.id === shift.id ? 'var(--bgColor-accent-muted)' : 'transparent'}}>
                <button onClick={() => setSelected(shift)} style={{ flex: 1, textAlign: 'left', padding: '12px', display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text sx={{ fontSize: 1,  fontWeight: 'medium', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shift.name}</Text>
                  </div>
                </button>
                <IconButton icon={Trash2} aria-label="Delete" variant="invisible" size="small" onClick={() => setDeleteShift(shift)} sx={{ mr: 1, color: 'danger.fg' }} />
              </div>
            ))}
            {shifts.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--fgColor-muted)', fontSize: 14 }}>No shifts yet</div>}
          </div>
        )}
      </div>

      {/* Right: Shift details + stop configs */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--fgColor-muted)' }}>
            <Clock size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
            <Text sx={{ fontSize: 2, fontWeight: 'semibold' }}>Select a shift</Text>
          </div>
        ) : (
          <>
            {/* Sticky header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--borderColor-default)', flexShrink: 0, background: 'var(--bgColor-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <Heading as="h2" sx={{ fontSize: 3 }}>{selected.name}</Heading>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  {selected.inbound_depart_school && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Inbound depart: <Text sx={{ fontWeight: 'semibold' }}>{selected.inbound_depart_school}</Text></Text>}
                  {selected.outbound_depart_school && <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Outbound depart: <Text sx={{ fontWeight: 'semibold' }}>{selected.outbound_depart_school}</Text></Text>}
                  <span style={{ fontSize: 12, background: 'var(--bgColor-muted)', border: '1px solid var(--borderColor-default)', borderRadius: 9999, padding: '2px 8px', color: 'var(--fgColor-muted)' }}>{selected.gender_mode}</span>
                  <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Overload: +{selected.default_overload}</Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input ref={importFileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleImportConfigs} />
                <Button size="small" variant="default" leadingVisual={importing ? Upload : FileSpreadsheet} disabled={importing} onClick={() => importFileRef.current?.click()}>
                  {importing ? 'Importing...' : 'Import'}
                </Button>
                <Button size="small" variant="default" leadingVisual={Pencil} onClick={() => { setFormError(null); setEditShift(selected) }}>Edit Shift</Button>
              </div>
            </div>

            {/* Scrollable content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
              <div style={{ border: '1px solid var(--borderColor-default)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--borderColor-muted)', background: 'var(--bgColor-muted)' }}>
                  <Text sx={{ fontSize: 1, fontWeight: 'semibold', display: 'block' }}>Student Counts per Stop</Text>
                  <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block', mt: 1 }}>Configure planned student counts for each stop in this shift</Text>
                </div>
                <StopConfigPanel key={selected.id} shift={selected} />
              </div>
            </div>
          </>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Shift" size="lg">
        <ShiftForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={formLoading} error={formError} />
      </Modal>
      <Modal open={!!editShift} onClose={() => setEditShift(null)} title="Edit Shift" size="lg">
        {editShift && <ShiftForm initial={editShift} onSubmit={handleEdit} onCancel={() => setEditShift(null)} loading={formLoading} error={formError} />}
      </Modal>
      <ConfirmDialog open={!!deleteShift} onClose={() => setDeleteShift(null)} onConfirm={handleDelete} title="Delete Shift" message={`Delete "${deleteShift?.name}"? All runs and stop configs for this shift will also be permanently deleted.`} confirmLabel="Delete" danger />
    </div>
  )
}
