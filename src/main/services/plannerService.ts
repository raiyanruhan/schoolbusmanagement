import { z } from 'zod'
import { runRepo } from '../repositories/runRepo'
import { busRepo } from '../repositories/busRepo'
import { routeRepo } from '../repositories/routeRepo'
import { shiftRepo } from '../repositories/shiftRepo'
import type { Run, RunWithDetails, IpcResult, CreateRunInput } from '../../shared/types'

const CreateRunSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  bus_id: z.string().uuid(),
  route_id: z.string().uuid(),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  gender: z.enum(['BOYS', 'GIRLS', 'MIXED']),
  stop_ids: z.array(z.string().uuid()).min(1, 'At least one stop required'),
  overload_limit: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional()
})

export const plannerService = {
  getRunsForSession(session_id: unknown): IpcResult<Run[]> {
    try {
      const id = z.string().uuid().parse(session_id)
      return { success: true, data: runRepo.getRunsBySession(id) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getAllRunsWithDetails(session_id: unknown): IpcResult<RunWithDetails[]> {
    try {
      const id = z.string().uuid().parse(session_id)
      return { success: true, data: runRepo.getAllRunsWithDetails(id) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getRunWithDetails(run_id: unknown): IpcResult<RunWithDetails> {
    try {
      const id = z.string().uuid().parse(run_id)
      const run = runRepo.getRunWithDetails(id)
      if (!run) return { success: false, error: 'Run not found' }
      return { success: true, data: run }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  createRun(input: unknown): IpcResult<Run> {
    try {
      const parsed = CreateRunSchema.parse(input)

      // Validate bus exists and is active
      const bus = busRepo.getById(parsed.bus_id)
      if (!bus) return { success: false, error: 'Bus not found' }
      if (bus.status !== 'ACTIVE') return { success: false, error: `Bus ${bus.number} is not active` }

      // Validate route
      const route = routeRepo.getRouteById(parsed.route_id)
      if (!route) return { success: false, error: 'Route not found' }

      // Validate stops belong to route and are contiguous
      const routeStops = routeRepo.getStopsByRoute(parsed.route_id)
      const routeStopIds = routeStops.map((s) => s.id)

      for (const stopId of parsed.stop_ids) {
        if (!routeStopIds.includes(stopId)) {
          return { success: false, error: 'All stops must belong to the selected route' }
        }
      }

      // Validate contiguous: the selected stops must be a consecutive subsequence
      const selectedIndices = parsed.stop_ids
        .map((id) => routeStopIds.indexOf(id))
        .sort((a, b) => a - b)

      for (let i = 1; i < selectedIndices.length; i++) {
        if (selectedIndices[i] !== selectedIndices[i - 1] + 1) {
          return { success: false, error: 'Stops must be contiguous (consecutive) on the route' }
        }
      }

      // Check stops not already assigned in this session+shift
      for (const stopId of parsed.stop_ids) {
        const alreadyAssigned = runRepo.isStopAssignedInSession(
          parsed.session_id,
          stopId,
          parsed.shift_id
        )
        if (alreadyAssigned) {
          const stop = routeStops.find((s) => s.id === stopId)
          return {
            success: false,
            error: `Stop "${stop?.name ?? stopId}" is already assigned in this session`
          }
        }
      }

      const run = runRepo.createRun(parsed as CreateRunInput)
      return { success: true, data: run }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  deleteRun(id: unknown): IpcResult<void> {
    try {
      const validId = z.string().uuid().parse(id)
      runRepo.deleteRun(validId)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
