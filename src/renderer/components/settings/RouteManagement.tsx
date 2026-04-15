import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, MapPin, GripVertical, ChevronRight, ToggleLeft, ToggleRight, Upload, FileSpreadsheet, X } from 'lucide-react'
import { Box, Button, Text, Heading, FormControl, TextInput, Textarea, Label, Flash, IconButton, Spinner } from '@primer/react'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { useUiStore } from '../../store/uiStore'
import type { Route, Stop, RouteWithStops } from '../../../shared/types'

// ─── Route Form ───────────────────────────────────────────────────────────────

interface RouteFormData { name: string; name_bn: string; color: string; notes: string }

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16']

function RouteForm({ initial, onSubmit, onCancel, loading, error }: {
  initial?: Route; onSubmit: (d: RouteFormData) => void
  onCancel: () => void; loading: boolean; error: string | null
}) {
  const [form, setForm] = useState<RouteFormData>(
    initial
      ? { name: initial.name, name_bn: initial.name_bn ?? '', color: initial.color, notes: initial.notes ?? '' }
      : { name: '', name_bn: '', color: '#3b82f6', notes: '' }
  )
  const set = (k: keyof RouteFormData, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(form) }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FormControl required>
        <FormControl.Label>Route Name</FormControl.Label>
        <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Route North" block />
      </FormControl>

      <FormControl>
        <FormControl.Label>Bengali Name</FormControl.Label>
        <TextInput value={form.name_bn} onChange={(e) => set('name_bn', e.target.value)} placeholder="বাংলা নাম" block />
      </FormControl>

      <FormControl>
        <FormControl.Label>Color</FormControl.Label>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          {COLORS.map((c) => (
            <Box
              key={c}
              as="button"
              type="button"
              onClick={() => set('color', c)}
              style={{ backgroundColor: c }}
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: '2px solid',
                borderColor: form.color === c ? 'fg.default' : 'transparent',
                cursor: 'pointer',
                padding: 0,
                transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                transition: 'transform 0.1s',
              }}
            />
          ))}
        </Box>
      </FormControl>

      <FormControl>
        <FormControl.Label>Notes</FormControl.Label>
        <Textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} resize="vertical" />
      </FormControl>

      {error && <Flash variant="danger" sx={{ fontSize: 0 }}>{error}</Flash>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
        <Button type="button" variant="default" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Create Route'}
        </Button>
      </Box>
    </Box>
  )
}

// ─── Stop Form ────────────────────────────────────────────────────────────────

function StopForm({ routeId, initial, onSubmit, onCancel, loading, error, nextOrder }: {
  routeId: string; initial?: Stop; onSubmit: (name: string, name_bn: string) => void
  onCancel: () => void; loading: boolean; error: string | null; nextOrder: number
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [name_bn, setNameBn] = useState(initial?.name_bn ?? '')

  return (
    <Box as="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); onSubmit(name, name_bn) }} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <FormControl required>
        <FormControl.Label>Stop Name</FormControl.Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Railway Crossing" block />
      </FormControl>

      <FormControl>
        <FormControl.Label>Bengali Name</FormControl.Label>
        <TextInput value={name_bn} onChange={(e) => setNameBn(e.target.value)} placeholder="বাংলা নাম" block />
      </FormControl>

      {!initial && (
        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Will be added as stop #{nextOrder}</Text>
      )}

      {error && <Flash variant="danger" sx={{ fontSize: 0 }}>{error}</Flash>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 1 }}>
        <Button type="button" variant="default" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : initial ? 'Save' : 'Add Stop'}
        </Button>
      </Box>
    </Box>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RouteManagement() {
  const { showToast } = useUiStore()
  const [routes, setRoutes] = useState<Route[]>([])
  const [selected, setSelected] = useState<RouteWithStops | null>(null)
  const [loading, setLoading] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Modals
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [editRoute, setEditRoute] = useState<Route | null>(null)
  const [deleteRoute, setDeleteRoute] = useState<Route | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [addStopOpen, setAddStopOpen] = useState(false)
  const [editStop, setEditStop] = useState<Stop | null>(null)
  const [deleteStop, setDeleteStop] = useState<Stop | null>(null)

  // Drag state for reordering
  const [dragging, setDragging] = useState<string | null>(null)

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    const result = await window.api.route.getAll()
    if (result.success) setRoutes(result.data)
    setLoading(false)
  }, [])

  const loadSelected = useCallback(async (id: string) => {
    const result = await window.api.route.getWithStops(id)
    if (result.success) setSelected(result.data)
  }, [])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = await window.api.excel.importRoutes(buffer)
      if (result.success) {
        const { routesCreated, routesExisting, stopsCreated, stopsSkipped } = result.data
        showToast(
          `Imported: ${routesCreated} new route${routesCreated !== 1 ? 's' : ''}, ` +
          `${stopsCreated} new stop${stopsCreated !== 1 ? 's' : ''}` +
          (routesExisting > 0 ? ` (${routesExisting} existing routes updated)` : '') +
          (stopsSkipped > 0 ? `, ${stopsSkipped} skipped` : '')
        )
        fetchRoutes()
      } else {
        showToast(result.error, 'error')
      }
    } catch {
      showToast('Failed to read file', 'error')
    }
    setImporting(false)
  }

  const handleClearAll = async () => {
    const result = await window.api.route.deleteAll()
    if (result.success) {
      setSelected(null)
      fetchRoutes()
      showToast('All routes cleared', 'info')
    } else {
      showToast(result.error, 'error')
    }
    setClearAllOpen(false)
  }

  const handleSelectRoute = (route: Route) => {
    loadSelected(route.id)
  }

  // Route CRUD
  const handleAddRoute = async (form: { name: string; name_bn: string; color: string; notes: string }) => {
    setFormLoading(true); setFormError(null)
    const result = await window.api.route.create({
      name: form.name.trim(), name_bn: form.name_bn.trim() || undefined,
      color: form.color, notes: form.notes.trim() || undefined
    })
    setFormLoading(false)
    if (result.success) {
      setAddRouteOpen(false); fetchRoutes()
      showToast(`Route "${result.data.name}" created`)
    } else setFormError(result.error)
  }

  const handleEditRoute = async (form: { name: string; name_bn: string; color: string; notes: string }) => {
    if (!editRoute) return
    setFormLoading(true); setFormError(null)
    const result = await window.api.route.update({
      id: editRoute.id, name: form.name.trim(), name_bn: form.name_bn.trim() || undefined,
      color: form.color, notes: form.notes.trim() || undefined
    })
    setFormLoading(false)
    if (result.success) {
      setEditRoute(null); fetchRoutes()
      if (selected?.id === editRoute.id) loadSelected(editRoute.id)
      showToast(`Route updated`)
    } else setFormError(result.error)
  }

  const handleDeleteRoute = async () => {
    if (!deleteRoute) return
    const result = await window.api.route.delete(deleteRoute.id)
    if (result.success) {
      if (selected?.id === deleteRoute.id) setSelected(null)
      fetchRoutes(); showToast(`Route deleted`, 'info')
    } else showToast(result.error, 'error')
    setDeleteRoute(null)
  }

  const handleToggleRoute = async (route: Route) => {
    await window.api.route.update({ id: route.id, is_active: !route.is_active })
    fetchRoutes()
    if (selected?.id === route.id) loadSelected(route.id)
  }

  // Stop CRUD
  const handleAddStop = async (name: string, name_bn: string) => {
    if (!selected) return
    setFormLoading(true); setFormError(null)
    const nextOrder = (selected.stops.length > 0 ? Math.max(...selected.stops.map((s) => s.sequence_order)) : 0) + 1
    const result = await window.api.stop.create({
      route_id: selected.id, name: name.trim(),
      name_bn: name_bn.trim() || undefined, sequence_order: nextOrder
    })
    setFormLoading(false)
    if (result.success) {
      setAddStopOpen(false); loadSelected(selected.id)
      showToast(`Stop "${result.data.name}" added`)
    } else setFormError(result.error)
  }

  const handleEditStop = async (name: string, name_bn: string) => {
    if (!editStop || !selected) return
    setFormLoading(true); setFormError(null)
    const result = await window.api.stop.update({ id: editStop.id, name: name.trim(), name_bn: name_bn.trim() || undefined })
    setFormLoading(false)
    if (result.success) {
      setEditStop(null); loadSelected(selected.id)
      showToast(`Stop updated`)
    } else setFormError(result.error)
  }

  const handleToggleStop = async (stop: Stop) => {
    if (!selected) return
    await window.api.stop.update({ id: stop.id, is_active: !stop.is_active })
    loadSelected(selected.id)
  }

  const handleDeleteStop = async () => {
    if (!deleteStop || !selected) return
    const result = await window.api.stop.delete(deleteStop.id)
    if (result.success) {
      loadSelected(selected.id); showToast(`Stop deleted`, 'info')
    } else showToast(result.error, 'error')
    setDeleteStop(null)
  }

  // Drag-drop reorder (simple, no library needed for small lists)
  const handleDragStart = (stopId: string) => setDragging(stopId)
  const handleDrop = async (targetId: string) => {
    if (!dragging || !selected || dragging === targetId) return
    const stops = [...selected.stops]
    const fromIdx = stops.findIndex((s) => s.id === dragging)
    const toIdx = stops.findIndex((s) => s.id === targetId)
    const [moved] = stops.splice(fromIdx, 1)
    stops.splice(toIdx, 0, moved)
    const newIds = stops.map((s) => s.id)
    setDragging(null)
    await window.api.stop.reorder({ route_id: selected.id, stop_ids: newIds })
    loadSelected(selected.id)
  }

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      {/* Left: Route list */}
      <Box sx={{ width: 280, flexShrink: 0, borderRight: '1px solid', borderColor: 'border.default', display: 'flex', flexDirection: 'column', bg: 'canvas.default' }}>
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'border.default', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Heading as="h2" sx={{ fontSize: 1, fontWeight: 'semibold', color: 'fg.default' }}>Routes</Heading>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelImport} />
            <Button
              size="small"
              variant="default"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? 'Importing...' : 'Import'}
            </Button>
            {routes.length > 0 && (
              <IconButton
                icon={X}
                aria-label="Clear all routes"
              variant="primary"
              size="small"
                onClick={() => setClearAllOpen(true)}
                sx={{ color: '', backgroundColor: 'danger.fg' }}
              />
            )}
            <IconButton
              icon={Plus}
              aria-label="Add route"
              variant="primary"
              size="small"
              onClick={() => { setFormError(null); setAddRouteOpen(true) }}
            />
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', color: 'fg.muted' }}><Spinner size="small" /></Box>
        ) : routes.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No routes yet</Text>
          </Box>
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto' }}>
            {routes.map((route) => (
              <Box
                key={route.id}
                as="button"
                onClick={() => handleSelectRoute(route)}
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  px: 3,
                  py: '10px',
                  borderBottom: '1px solid',
                  borderColor: 'border.muted',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: '2px solid',
                  borderLeftColor: selected?.id === route.id ? 'accent.emphasis' : 'transparent',
                  bg: selected?.id === route.id ? 'canvas.subtle' : 'transparent',
                  '&:hover': { bg: 'canvas.subtle' },
                }}
              >
                <Box sx={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0 }} style={{ backgroundColor: route.color }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Text sx={{
                    fontSize: 1,
                    fontWeight: 'medium',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: route.is_active ? 'fg.default' : 'fg.muted',
                    textDecoration: route.is_active ? 'none' : 'line-through',
                  }}>
                    {route.name}
                  </Text>
                </Box>
                <ChevronRight size={14} style={{ color: 'var(--fgColor-muted)', flexShrink: 0 }} />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Right: Stops */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 5 }}>
        {!selected ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2, color: 'fg.muted' }}>
            <MapPin size={48} style={{ color: 'var(--fgColor-muted)', opacity: 0.4 }} />
            <Text sx={{ fontWeight: 'semibold', color: 'fg.default', fontSize: 1 }}>Select a route</Text>
            <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Choose a route on the left to manage its stops</Text>
          </Box>
        ) : (
          <>
            {/* Route header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <Box sx={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0 }} style={{ backgroundColor: selected.color }} />
                <Box>
                  <Heading as="h2" sx={{ fontSize: 2 }}>{selected.name}</Heading>
                  {selected.name_bn && <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block' }}>{selected.name_bn}</Text>}
                </Box>
                <Label variant={selected.is_active ? 'success' : 'secondary'}>
                  {selected.is_active ? 'Active' : 'Inactive'}
                </Label>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  size="small"
                  variant="default"
                  leadingVisual={selected.is_active ? ToggleRight : ToggleLeft}
                  onClick={() => handleToggleRoute(selected)}
                >
                  {selected.is_active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="small" variant="default" leadingVisual={Pencil} onClick={() => { setFormError(null); setEditRoute(selected) }}>
                  Edit
                </Button>
                <IconButton icon={Trash2} aria-label="Delete route" variant="invisible" size="small" onClick={() => setDeleteRoute(selected)} sx={{ color: 'danger.fg' }} />
              </Box>
            </Box>

            {/* Stops card */}
            <Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2, borderBottom: '1px solid', borderColor: 'border.default', bg: 'canvas.subtle' }}>
                <Text sx={{ fontSize: 0, fontWeight: 'semibold', color: 'fg.muted' }}>
                  Stops ({selected.stops.length})
                </Text>
                <Button size="small" variant="primary" leadingVisual={Plus} onClick={() => { setFormError(null); setAddStopOpen(true) }}>
                  Add Stop
                </Button>
              </Box>

              {selected.stops.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                  <Text sx={{ fontSize: 0, color: 'fg.muted' }}>No stops yet. Add the first stop.</Text>
                </Box>
              ) : (
                <Box as="ul" sx={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {selected.stops.map((stop, i) => (
                    <Box
                      key={stop.id}
                      as="li"
                      draggable
                      onDragStart={() => handleDragStart(stop.id)}
                      onDragOver={(e: React.DragEvent) => e.preventDefault()}
                      onDrop={() => handleDrop(stop.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        px: 3,
                        py: '10px',
                        borderBottom: '1px solid',
                        borderColor: 'border.muted',
                        opacity: dragging === stop.id || !stop.is_active ? 0.5 : 1,
                        '&:last-child': { borderBottom: 'none' },
                        '&:hover .stop-actions': { opacity: 1 },
                      }}
                    >
                      <Box sx={{ color: 'fg.subtle', cursor: 'grab', flexShrink: 0 }}>
                        <GripVertical size={16} />
                      </Box>
                      <Box sx={{
                        width: 24, height: 24, borderRadius: '50%',
                        bg: 'canvas.subtle', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Text sx={{ fontSize: 0, color: 'fg.muted', fontFamily: 'mono' }}>{i + 1}</Text>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Text sx={{
                          fontSize: 1,
                          fontWeight: 'medium',
                          display: 'block',
                          color: stop.is_active ? 'fg.default' : 'fg.muted',
                          textDecoration: stop.is_active ? 'none' : 'line-through',
                        }}>
                          {stop.name}
                        </Text>
                        {stop.name_bn && <Text sx={{ fontSize: 0, color: 'fg.muted', display: 'block' }}>{stop.name_bn}</Text>}
                      </Box>
                      <Box className="stop-actions" sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: 0, transition: 'opacity 0.15s' }}>
                        <IconButton
                          icon={stop.is_active ? ToggleRight : ToggleLeft}
                          aria-label={stop.is_active ? 'Deactivate stop' : 'Activate stop'}
                          variant="invisible"
                          size="small"
                          onClick={() => handleToggleStop(stop)}
                          sx={{ color: stop.is_active ? 'success.fg' : 'fg.muted' }}
                        />
                        <IconButton
                          icon={Pencil}
                          aria-label="Edit stop"
                          variant="invisible"
                          size="small"
                          onClick={() => { setFormError(null); setEditStop(stop) }}
                        />
                        <IconButton
                          icon={Trash2}
                          aria-label="Delete stop"
                          variant="invisible"
                          size="small"
                          onClick={() => setDeleteStop(stop)}
                          sx={{ color: 'danger.fg' }}
                        />
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, color: 'fg.subtle' }}>
              <GripVertical size={12} />
              <Text sx={{ fontSize: 0, color: 'fg.muted' }}>Drag stops to reorder</Text>
            </Box>
          </>
        )}
      </Box>

      {/* Modals */}
      <Modal open={addRouteOpen} onClose={() => setAddRouteOpen(false)} title="New Route">
        <RouteForm onSubmit={handleAddRoute} onCancel={() => setAddRouteOpen(false)} loading={formLoading} error={formError} />
      </Modal>
      <Modal open={!!editRoute} onClose={() => setEditRoute(null)} title="Edit Route">
        {editRoute && <RouteForm initial={editRoute} onSubmit={handleEditRoute} onCancel={() => setEditRoute(null)} loading={formLoading} error={formError} />}
      </Modal>
      <ConfirmDialog open={!!deleteRoute} onClose={() => setDeleteRoute(null)} onConfirm={handleDeleteRoute}
        title="Delete Route" message={`Delete "${deleteRoute?.name}" and all its stops?`} confirmLabel="Delete" danger />

      <Modal open={addStopOpen} onClose={() => setAddStopOpen(false)} title="Add Stop" size="sm">
        {selected && <StopForm routeId={selected.id} onSubmit={handleAddStop} onCancel={() => setAddStopOpen(false)}
          loading={formLoading} error={formError} nextOrder={(selected.stops.length || 0) + 1} />}
      </Modal>
      <Modal open={!!editStop} onClose={() => setEditStop(null)} title="Edit Stop" size="sm">
        {editStop && selected && <StopForm routeId={selected.id} initial={editStop} onSubmit={handleEditStop}
          onCancel={() => setEditStop(null)} loading={formLoading} error={formError} nextOrder={editStop.sequence_order} />}
      </Modal>
      <ConfirmDialog open={!!deleteStop} onClose={() => setDeleteStop(null)} onConfirm={handleDeleteStop}
        title="Delete Stop" message={`Delete stop "${deleteStop?.name}"?`} confirmLabel="Delete" danger />

      <ConfirmDialog
        open={clearAllOpen}
        onClose={() => setClearAllOpen(false)}
        onConfirm={handleClearAll}
        title="Clear All Routes"
        message={`Delete all ${routes.length} route${routes.length !== 1 ? 's' : ''} and every stop inside them? All associated runs will also be removed. This cannot be undone.`}
        confirmLabel="Clear All"
        danger
      />
    </Box>
  )
}
