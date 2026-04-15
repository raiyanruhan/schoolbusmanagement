import { useEffect, useState, useRef } from 'react'
import { Plus, Pencil, Trash2, Bus, FileSpreadsheet, Upload } from 'lucide-react'
import { Box, Button, Text, Heading, FormControl, TextInput, Select, Textarea, Label, Flash, IconButton, Spinner } from '@primer/react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useUiStore } from '../../store/uiStore'
import type { Bus as BusType, BusStatus, CreateBusInput, UpdateBusInput } from '../../../shared/types'

type StatusVariant = 'success' | 'attention' | 'secondary'
const STATUS_VARIANT: Record<BusStatus, StatusVariant> = {
  ACTIVE: 'success',
  MAINTENANCE: 'attention',
  RETIRED: 'secondary',
}

interface BusFormData {
  number: string
  capacity: string
  status: BusStatus
  notes: string
}

const defaultForm: BusFormData = { number: '', capacity: '40', status: 'ACTIVE', notes: '' }

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
    <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(form) }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FormControl required>
        <FormControl.Label>Bus Number</FormControl.Label>
        <TextInput value={form.number} onChange={(e) => set('number', e.target.value)} placeholder="e.g. Bus 07, BCPSC-12" block />
      </FormControl>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
        <FormControl required>
          <FormControl.Label>Capacity</FormControl.Label>
          <TextInput type="number" min={1} max={200} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} block />
        </FormControl>
        <FormControl>
          <FormControl.Label>Status</FormControl.Label>
          <Select value={form.status} onChange={(e) => set('status', e.target.value as BusStatus)}>
            <Select.Option value="ACTIVE">Active</Select.Option>
            <Select.Option value="MAINTENANCE">Maintenance</Select.Option>
            <Select.Option value="RETIRED">Retired</Select.Option>
          </Select>
        </FormControl>
      </Box>

      <FormControl>
        <FormControl.Label>Notes</FormControl.Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" resize="vertical" />
      </FormControl>

      {error && <Flash variant="danger" sx={{ fontSize: 0 }}>{error}</Flash>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
        <Button type="button" variant="default" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Add Bus'}
        </Button>
      </Box>
    </Box>
  )
}

export default function BusManagement() {
  const { showToast } = useUiStore()
  const [buses, setBuses] = useState<BusType[]>([])
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editBus, setEditBus] = useState<BusType | null>(null)
  const [deleteBus, setDeleteBus] = useState<BusType | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBuses = async () => {
    setLoading(true)
    const result = await window.api.bus.getAll()
    if (result.success) setBuses(result.data)
    setLoading(false)
  }

  useEffect(() => { fetchBuses() }, [])

  const handleAdd = async (form: BusFormData) => {
    setFormLoading(true); setFormError(null)
    const input: CreateBusInput = { number: form.number.trim(), capacity: parseInt(form.capacity), status: form.status, notes: form.notes.trim() || undefined }
    const result = await window.api.bus.create(input)
    setFormLoading(false)
    if (result.success) { setAddOpen(false); fetchBuses(); showToast(`Bus "${result.data.number}" added`) }
    else setFormError(result.error)
  }

  const handleEdit = async (form: BusFormData) => {
    if (!editBus) return
    setFormLoading(true); setFormError(null)
    const input: UpdateBusInput = { id: editBus.id, number: form.number.trim(), capacity: parseInt(form.capacity), status: form.status, notes: form.notes.trim() || undefined }
    const result = await window.api.bus.update(input)
    setFormLoading(false)
    if (result.success) { setEditBus(null); fetchBuses(); showToast(`Bus "${result.data.number}" updated`) }
    else setFormError(result.error)
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = await window.api.excel.importBuses(buffer)
      if (result.success) {
        const { created, skipped } = result.data
        showToast(`${created} bus${created !== 1 ? 'es' : ''} imported` + (skipped > 0 ? ` · ${skipped} already existed` : ''))
        fetchBuses()
      } else {
        showToast(result.error, 'error')
      }
    } catch { showToast('Failed to read file', 'error') }
    setImporting(false)
  }

  const handleDelete = async () => {
    if (!deleteBus) return
    const result = await window.api.bus.delete(deleteBus.id)
    if (result.success) { fetchBuses(); showToast(`Bus "${deleteBus.number}" deleted`, 'info') }
    else showToast(result.error, 'error')
    setDeleteBus(null)
  }

  return (
    <Box sx={{ p: 5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Heading as="h1" sx={{ fontSize: 4 }}>Fleet Management</Heading>
          <Text sx={{ color: 'fg.muted', fontSize: 1, mt: 1, display: 'block' }}>{buses.length} bus{buses.length !== 1 ? 'es' : ''} registered</Text>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelImport} />
          <Button variant="default" leadingVisual={importing ? Upload : FileSpreadsheet} disabled={importing} onClick={() => fileInputRef.current?.click()}>
            {importing ? 'Importing...' : 'Import Excel'}
          </Button>
          <Button variant="primary" leadingVisual={Plus} onClick={() => { setFormError(null); setAddOpen(true) }}>Add Bus</Button>
        </Box>
      </Box>

      {/* Table */}
      <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ p: 5, textAlign: 'center', color: 'fg.muted' }}><Spinner /></Box>
        ) : buses.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Box sx={{ color: 'fg.subtle', mb: 2 }}><Bus size={48} /></Box>
            <Text sx={{ fontWeight: 'semibold', color: 'fg.muted', display: 'block' }}>No buses yet</Text>
            <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1, display: 'block' }}>Add your first bus to get started.</Text>
          </Box>
        ) : (
          <Box as="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <Box as="thead" sx={{ bg: 'canvas.subtle', borderBottom: '1px solid', borderColor: 'border.default' }}>
              <tr>
                {['Number', 'Capacity', 'Status', 'Notes', 'Actions'].map((h) => (
                  <Box key={h} as="th" sx={{ px: 4, py: 2, textAlign: 'left', fontSize: 0, fontWeight: 'semibold', color: 'fg.muted', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</Box>
                ))}
              </tr>
            </Box>
            <tbody>
              {buses.map((bus) => (
                <Box key={bus.id} as="tr" sx={{ borderBottom: '1px solid', borderColor: 'border.muted', '&:hover': { bg: 'canvas.subtle' }, '&:last-child': { borderBottom: 'none' } }}>
                  <Box as="td" sx={{ px: 4, py: 3, fontSize: 1, fontWeight: 'semibold' }}>{bus.number}</Box>
                  <Box as="td" sx={{ px: 4, py: 3, fontSize: 1, color: 'fg.muted' }}>{bus.capacity} seats</Box>
                  <Box as="td" sx={{ px: 4, py: 3 }}>
                    <Label variant={STATUS_VARIANT[bus.status]}>{bus.status}</Label>
                  </Box>
                  <Box as="td" sx={{ px: 4, py: 3, fontSize: 0, color: 'fg.muted' }}>{bus.notes ?? '—'}</Box>
                  <Box as="td" sx={{ px: 4, py: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <IconButton icon={Pencil} aria-label="Edit" variant="invisible" size="small" onClick={() => { setFormError(null); setEditBus(bus) }} />
                      <IconButton icon={Trash2} aria-label="Delete" variant="invisible" size="small" onClick={() => setDeleteBus(bus)} sx={{ color: 'danger.fg' }} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </tbody>
          </Box>
        )}
      </Box>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Bus">
        <BusForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} loading={formLoading} error={formError} />
      </Modal>
      <Modal open={!!editBus} onClose={() => setEditBus(null)} title="Edit Bus">
        {editBus && <BusForm initial={editBus} onSubmit={handleEdit} onCancel={() => setEditBus(null)} loading={formLoading} error={formError} />}
      </Modal>
      <ConfirmDialog open={!!deleteBus} onClose={() => setDeleteBus(null)} onConfirm={handleDelete} title="Delete Bus" message={`Are you sure you want to delete "${deleteBus?.number}"? This cannot be undone.`} confirmLabel="Delete" danger />
    </Box>
  )
}
