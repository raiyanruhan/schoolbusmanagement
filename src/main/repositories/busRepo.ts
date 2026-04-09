import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { buses } from '../db/schema'
import type { Bus, CreateBusInput, UpdateBusInput } from '../../shared/types'

function now() {
  return new Date().toISOString()
}

export const busRepo = {
  getAll(): Bus[] {
    return getDb().select().from(buses).all() as Bus[]
  },

  getById(id: string): Bus | null {
    const result = getDb().select().from(buses).where(eq(buses.id, id)).get()
    return (result as Bus) ?? null
  },

  getByNumber(number: string): Bus | null {
    const result = getDb().select().from(buses).where(eq(buses.number, number)).get()
    return (result as Bus) ?? null
  },

  create(input: CreateBusInput): Bus {
    const id = uuidv4()
    const ts = now()
    getDb().insert(buses).values({
      id,
      number: input.number,
      capacity: input.capacity,
      status: input.status,
      notes: input.notes ?? null,
      created_at: ts,
      updated_at: ts
    }).run()
    return this.getById(id)!
  },

  update(input: UpdateBusInput): Bus {
    const ts = now()
    getDb().update(buses)
      .set({
        ...(input.number !== undefined && { number: input.number }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
        updated_at: ts
      })
      .where(eq(buses.id, input.id))
      .run()
    return this.getById(input.id)!
  },

  delete(id: string): void {
    getDb().delete(buses).where(eq(buses.id, id)).run()
  }
}
