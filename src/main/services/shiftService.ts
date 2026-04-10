import { z } from 'zod'
import { shiftRepo } from '../repositories/shiftRepo'
import type { Shift, StopConfig, IpcResult, CreateShiftInput, UpdateShiftInput, UpsertStopConfigInput } from '../../shared/types'

const TimeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format').optional()

const CreateShiftSchema = z.object({
  name: z.string().min(1, 'Shift name is required').max(50),
  name_bn: z.string().max(50).optional(),
  sort_order: z.number().int().min(1),
  inbound_depart_school: TimeSchema,
  inbound_arrive_stops: TimeSchema,
  inbound_arrive_school: TimeSchema,
  school_start_time: TimeSchema,
  school_end_time: TimeSchema,
  outbound_depart_school: TimeSchema,
  outbound_arrive_stops: TimeSchema,
  gender_mode: z.enum(['COMBINED', 'SEPARATED', 'AUTO']),
  default_overload: z.number().int().min(0)
})

const UpdateShiftSchema = CreateShiftSchema.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional()
})

const UpsertStopConfigSchema = z.object({
  stop_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  is_active: z.boolean(),
  planned_boys: z.number().int().min(0),
  planned_girls: z.number().int().min(0)
})

export const shiftService = {
  getAll(): IpcResult<Shift[]> {
    try {
      return { success: true, data: shiftRepo.getAll() }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  create(input: unknown): IpcResult<Shift> {
    try {
      const parsed = CreateShiftSchema.parse(input)
      const shift = shiftRepo.create(parsed as CreateShiftInput)
      return { success: true, data: shift }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  update(input: unknown): IpcResult<Shift> {
    try {
      const parsed = UpdateShiftSchema.parse(input)
      const shift = shiftRepo.update(parsed as UpdateShiftInput)
      return { success: true, data: shift }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  delete(id: unknown): IpcResult<void> {
    try {
      const shiftId = z.string().uuid().parse(id)
      shiftRepo.delete(shiftId)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getStopConfigsByShift(shift_id: unknown): IpcResult<StopConfig[]> {
    try {
      const id = z.string().uuid().parse(shift_id)
      return { success: true, data: shiftRepo.getStopConfigsByShift(id) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  upsertStopConfig(input: unknown): IpcResult<StopConfig> {
    try {
      const parsed = UpsertStopConfigSchema.parse(input)
      const config = shiftRepo.upsertStopConfig(parsed as UpsertStopConfigInput)
      return { success: true, data: config }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  }
}
