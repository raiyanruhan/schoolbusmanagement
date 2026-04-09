import { z } from 'zod'
import { busRepo } from '../repositories/busRepo'
import type { Bus, CreateBusInput, UpdateBusInput, IpcResult } from '../../shared/types'

const CreateBusSchema = z.object({
  number: z.string().min(1, 'Bus number is required').max(20),
  capacity: z.number().int().min(1, 'Capacity must be at least 1').max(200),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']),
  notes: z.string().max(500).optional()
})

const UpdateBusSchema = z.object({
  id: z.string().uuid(),
  number: z.string().min(1).max(20).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'RETIRED']).optional(),
  notes: z.string().max(500).optional()
})

export const busService = {
  getAll(): IpcResult<Bus[]> {
    try {
      return { success: true, data: busRepo.getAll() }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  create(input: unknown): IpcResult<Bus> {
    try {
      const parsed = CreateBusSchema.parse(input)

      const existing = busRepo.getByNumber(parsed.number)
      if (existing) {
        return { success: false, error: `Bus number "${parsed.number}" already exists` }
      }

      const bus = busRepo.create(parsed as CreateBusInput)
      return { success: true, data: bus }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  update(input: unknown): IpcResult<Bus> {
    try {
      const parsed = UpdateBusSchema.parse(input)

      if (parsed.number) {
        const existing = busRepo.getByNumber(parsed.number)
        if (existing && existing.id !== parsed.id) {
          return { success: false, error: `Bus number "${parsed.number}" already exists` }
        }
      }

      const bus = busRepo.update(parsed as UpdateBusInput)
      return { success: true, data: bus }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  delete(id: unknown): IpcResult<void> {
    try {
      const validId = z.string().uuid().parse(id)
      busRepo.delete(validId)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  }
}
