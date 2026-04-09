import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, MapPin, GripVertical, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useUiStore } from '../store/uiStore'
import type { Route, Stop, RouteWithStops } from '../../shared/types'

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
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form) }} className="space-y-4">
      <div>
        <label className="form-label">Route Name *</label>
        <input className="form-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Route North" required />
      </div>
      <div>
        <label className="form-label">Bengali Name</label>
        <input className="form-input" value={form.name_bn} onChange={(e) => set('name_bn', e.target.value)} placeholder="বাংলা নাম" />
      </div>
      <div>
        <label className="form-label">Color</label>
        <div className="flex gap-2 flex-wrap mt-1">
          {COLORS.map((c) => (
            <button type="button" key={c} onClick={() => set('color', c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="form-label">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : initial ? 'Save Changes' : 'Create Route'}
        </button>
      </div>
    </form>
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
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(name, name_bn) }} className="space-y-4">
      <div>
        <label className="form-label">Stop Name *</label>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Railway Crossing" required />
      </div>
      <div>
        <label className="form-label">Bengali Name</label>
        <input className="form-input" value={name_bn} onChange={(e) => setNameBn(e.target.value)} placeholder="বাংলা নাম" />
      </div>
      {!initial && <p className="text-xs text-gray-400">Will be added as stop #{nextOrder}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Saving...' : initial ? 'Save' : 'Add Stop'}
        </button>
      </div>
    </form>
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

  // Modals
  const [addRouteOpen, setAddRouteOpen] = useState(false)
  const [editRoute, setEditRoute] = useState<Route | null>(null)
  const [deleteRoute, setDeleteRoute] = useState<Route | null>(null)
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
    <div className="flex h-full">
      {/* Left: Route list */}
      <div className="w-72 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="section-title">Routes</h2>
          <button onClick={() => { setFormError(null); setAddRouteOpen(true) }} className="btn-primary btn-sm">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
        ) : routes.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">No routes yet</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {routes.map((route) => (
              <button
                key={route.id}
                onClick={() => handleSelectRoute(route)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 flex items-center gap-3 transition-colors
                  ${selected?.id === route.id ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-gray-50'}`}
              >
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: route.color }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${!route.is_active ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                    {route.name}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Stops */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MapPin className="w-12 h-12 mb-3 text-gray-300" />
            <p className="font-medium">Select a route</p>
            <p className="text-sm mt-1">Choose a route on the left to manage its stops</p>
          </div>
        ) : (
          <>
            {/* Route header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selected.color }} />
                <div>
                  <h2 className="section-title">{selected.name}</h2>
                  {selected.name_bn && <p className="text-sm text-gray-400">{selected.name_bn}</p>}
                </div>
                <span className={selected.is_active ? 'badge-green' : 'badge-gray'}>
                  {selected.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleToggleRoute(selected)} className="btn-secondary btn-sm">
                  {selected.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                  {selected.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => { setFormError(null); setEditRoute(selected) }} className="btn-secondary btn-sm">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => setDeleteRoute(selected)} className="btn-secondary btn-sm text-red-500 hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stops */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-700">Stops ({selected.stops.length})</p>
                <button onClick={() => { setFormError(null); setAddStopOpen(true) }} className="btn-primary btn-sm">
                  <Plus className="w-3.5 h-3.5" /> Add Stop
                </button>
              </div>

              {selected.stops.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">No stops yet. Add the first stop.</div>
              ) : (
                <ul>
                  {selected.stops.map((stop, i) => (
                    <li
                      key={stop.id}
                      draggable
                      onDragStart={() => handleDragStart(stop.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(stop.id)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 group
                        ${dragging === stop.id ? 'opacity-50' : ''}
                        ${!stop.is_active ? 'opacity-60' : ''}`}
                    >
                      <GripVertical className="w-4 h-4 text-gray-300 cursor-grab active:cursor-grabbing shrink-0" />
                      <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-mono shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!stop.is_active ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          {stop.name}
                        </p>
                        {stop.name_bn && <p className="text-xs text-gray-400">{stop.name_bn}</p>}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleToggleStop(stop)}
                          className="btn-ghost btn-sm p-1.5"
                          title={stop.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {stop.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                        </button>
                        <button onClick={() => { setFormError(null); setEditStop(stop) }} className="btn-ghost btn-sm p-1.5">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeleteStop(stop)} className="btn-ghost btn-sm p-1.5 text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <GripVertical className="w-3 h-3" /> Drag stops to reorder
            </p>
          </>
        )}
      </div>

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
    </div>
  )
}
