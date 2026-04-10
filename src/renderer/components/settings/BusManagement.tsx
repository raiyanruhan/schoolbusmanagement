import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Bus } from 'lucide-react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useUiStore } from '../../store/uiStore'
import type { Bus as BusType, BusStatus, CreateBusInput, UpdateBusInput } from '../../../shared/types'

// ── Status badge ─────────────────────────────────────────────────────────────

function statusBadge(status: BusStatus) {
  const map: Record<BusStatus, string> = {
    ACTIVE: 'badge-green',
    MAINTENANCE: 'badge-yellow',
    RETIRED: 'badge-gray'
  }
  return <span className={map[status]}>{status}</span>
}

// ── Bus Form ─────────────────────────────────────────────────────────────────

interface BusFormData {
  number: string
  capacity: string
  status: BusStatus
  notes: string
}

const defaultForm: BusFormData = {
  number: '', capacity: '40', status: 'ACTIVE', notes: ''
}

interface BusFormProps {
  initial?: BusType
  onSubmit: (data: BusFormData) => Promise<void>
  onCancel: () => void
  loading: boolean
  error: string | null
}

function BusForm({ initial, onSubmit, onCancel, loading, error }: BusFormProps) {
  const [form, setForm] = useState<BusFormData>(
    initial
      ? { number: initial.number, capacity: String(initial.capacity), status: initial.status, notes: initial.notes ?? '' }
      : defaultForm
  )

  const set = (k: keyof BusFormData, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="form-label">Bus Number *</label>
        <input className="form-input" value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="e.g. Bus 07, BCPSC-12" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Capacity *</label>
          <input className="form-input" type="number" min={1} max={200} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={(e) => set('status', e.target.value as BusStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="RETIRED">Retired</option>
          </select>
        </div>
      </div>

      <div>
        <label className="form-label">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Add Bus'}
        </button>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BusManagement() {
  const { showToast } = useUiStore()
  const [buses, setBuses] = useState<BusType[]>([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editBus, setEditBus] = useState<BusType | null>(null)
  const [deleteBus, setDeleteBus] = useState<BusType | null>(null)

  const fetchBuses = async () => {
    setLoading(true)
    const result = await window.api.bus.getAll()
    if (result.success) setBuses(result.data)
    setLoading(false)
  }

  useEffect(() => { fetchBuses() }, [])

  const handleAdd = async (form: BusFormData) => {
    setFormLoading(true)
    setFormError(null)
    const input: CreateBusInput = {
      number: form.number.trim(),
      capacity: parseInt(form.capacity),
      status: form.status,
      notes: form.notes.trim() || undefined
    }
    const result = await window.api.bus.create(input)
    setFormLoading(false)
    if (result.success) {
      setAddOpen(false)
      fetchBuses()
      showToast(`Bus "${result.data.number}" added`)
    } else {
      setFormError(result.error)
    }
  }

  const handleEdit = async (form: BusFormData) => {
    if (!editBus) return
    setFormLoading(true)
    setFormError(null)
    const input: UpdateBusInput = {
      id: editBus.id,
      number: form.number.trim(),
      capacity: parseInt(form.capacity),
      status: form.status,
      notes: form.notes.trim() || undefined
    }
    const result = await window.api.bus.update(input)
    setFormLoading(false)
    if (result.success) {
      setEditBus(null)
      fetchBuses()
      showToast(`Bus "${result.data.number}" updated`)
    } else {
      setFormError(result.error)
    }
  }

  const handleDelete = async () => {
    if (!deleteBus) return
    const result = await window.api.bus.delete(deleteBus.id)
    if (result.success) {
      fetchBuses()
      showToast(`Bus "${deleteBus.number}" deleted`, 'info')
    } else {
      showToast(result.error, 'error')
    }
    setDeleteBus(null)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Fleet Management</h1>
          <p className="text-gray-500 text-sm mt-1">{buses.length} bus{buses.length !== 1 ? 'es' : ''} registered</p>
        </div>
        <button onClick={() => { setFormError(null); setAddOpen(true) }} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Bus
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading...</div>
        ) : buses.length === 0 ? (
          <div className="p-12 text-center">
            <Bus className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No buses yet</p>
            <p className="text-gray-400 text-sm mt-1">Add your first bus to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Number</th>
                <th className="table-header">Capacity</th>
                <th className="table-header">Status</th>
                <th className="table-header">Notes</th>
                <th className="table-header w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr key={bus.id} className="table-row">
                  <td className="table-cell font-semibold text-gray-900">{bus.number}</td>
                  <td className="table-cell">{bus.capacity} seats</td>
                  <td className="table-cell">{statusBadge(bus.status)}</td>
                  <td className="table-cell text-gray-400 text-xs">{bus.notes ?? '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setFormError(null); setEditBus(bus) }}
                        className="btn-ghost btn-sm p-1.5 rounded"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteBus(bus)}
                        className="btn-ghost btn-sm p-1.5 rounded text-red-500 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Bus">
        <BusForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={formLoading} error={formError} />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editBus} onClose={() => setEditBus(null)} title="Edit Bus">
        {editBus && (
          <BusForm initial={editBus} onSubmit={handleEdit} onCancel={() => setEditBus(null)} loading={formLoading} error={formError} />
        )}
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteBus}
        onClose={() => setDeleteBus(null)}
        onConfirm={handleDelete}
        title="Delete Bus"
        message={`Are you sure you want to delete "${deleteBus?.number}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
