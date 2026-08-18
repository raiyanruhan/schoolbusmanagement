import { z } from 'zod'
import { routeRepo } from '../repositories/routeRepo'
import type { Route, Stop, RouteWithStops, IpcResult, CreateRouteInput, UpdateRouteInput, CreateStopInput, UpdateStopInput, ReorderStopsInput } from '../../shared/types'

const CreateRouteSchema = z.object({
  name: z.string().min(1, 'Route name is required').max(100),
  name_bn: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color hex'),
  notes: z.string().max(500).optional(),
  travel_time_inbound_min: z.number().int().min(0).max(300).optional(),
  travel_time_outbound_min: z.number().int().min(0).max(300).optional()
})

const UpdateRouteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  name_bn: z.string().max(100).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(500).optional(),
  travel_time_inbound_min: z.number().int().min(0).max(300).optional(),
  travel_time_outbound_min: z.number().int().min(0).max(300).optional()
})

const CreateStopSchema = z.object({
  route_id: z.string().uuid(),
  name: z.string().min(1, 'Stop name is required').max(100),
  name_bn: z.string().max(100).optional(),
  sequence_order: z.number().int().min(1)
})

const UpdateStopSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  name_bn: z.string().max(100).optional(),
  is_active: z.boolean().optional()
})

const ReorderStopsSchema = z.object({
  route_id: z.string().uuid(),
  stop_ids: z.array(z.string().uuid()).min(1)
})

export const routeService = {
  getAllRoutes(): IpcResult<Route[]> {
    try {
      return { success: true, data: routeRepo.getAllRoutes() }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getRouteWithStops(route_id: unknown): IpcResult<RouteWithStops> {
    try {
      const id = z.string().uuid().parse(route_id)
      const route = routeRepo.getRouteById(id)
      if (!route) return { success: false, error: 'Route not found' }
      const routeStops = routeRepo.getStopsByRoute(id)
      return { success: true, data: { ...route, stops: routeStops } }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  createRoute(input: unknown): IpcResult<Route> {
    try {
      const parsed = CreateRouteSchema.parse(input)
      const route = routeRepo.createRoute(parsed as CreateRouteInput)
      return { success: true, data: route }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  updateRoute(input: unknown): IpcResult<Route> {
    try {
      const parsed = UpdateRouteSchema.parse(input)
      const route = routeRepo.updateRoute(parsed as UpdateRouteInput)
      return { success: true, data: route }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  deleteAllRoutes(): IpcResult<void> {
    try {
      routeRepo.deleteAllRoutes()
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  deleteRoute(id: unknown): IpcResult<void> {
    try {
      const validId = z.string().uuid().parse(id)
      routeRepo.deleteRoute(validId)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  createStop(input: unknown): IpcResult<Stop> {
    try {
      const parsed = CreateStopSchema.parse(input)
      // Check duplicate name in route
      const existing = routeRepo.getStopsByRoute(parsed.route_id)
      if (existing.some((s) => s.name.toLowerCase() === parsed.name.toLowerCase())) {
        return { success: false, error: `Stop "${parsed.name}" already exists in this route` }
      }
      const stop = routeRepo.createStop(parsed as CreateStopInput)
      return { success: true, data: stop }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  updateStop(input: unknown): IpcResult<Stop> {
    try {
      const parsed = UpdateStopSchema.parse(input)
      const stop = routeRepo.updateStop(parsed as UpdateStopInput)
      return { success: true, data: stop }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  reorderStops(input: unknown): IpcResult<void> {
    try {
      const parsed = ReorderStopsSchema.parse(input)
      routeRepo.reorderStops(parsed as ReorderStopsInput)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  deleteStop(id: unknown): IpcResult<void> {
    try {
      const validId = z.string().uuid().parse(id)
      routeRepo.deleteStop(validId)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
