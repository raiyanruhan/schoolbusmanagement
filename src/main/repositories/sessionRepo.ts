import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { sessions } from '../db/schema'
import type { Session } from '../../shared/types'

function now() {
  return new Date().toISOString()
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export const sessionRepo = {
  getByDate(date: string): Session | null {
    const result = getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.date, date))
      .get()
    return (result as Session) ?? null
  },

  getById(id: string): Session | null {
    const result = getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .get()
    return (result as Session) ?? null
  },

  getAll(): Session[] {
    return getDb().select().from(sessions).all() as Session[]
  },

  getOrCreateToday(): Session {
    const date = todayDate()
    const existing = this.getByDate(date)
    if (existing) return existing

    const id = uuidv4()
    const ts = now()
    getDb().insert(sessions).values({
      id,
      date,
      status: 'OPEN',
      notes: null,
      created_at: ts,
      locked_at: null
    }).run()

    return this.getById(id)!
  }
}
