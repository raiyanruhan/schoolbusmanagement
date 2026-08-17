import { eq, and, isNull } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db'
import { audioClips } from '../db/schema'
import type { AudioClipType } from '../../shared/types'

export interface AudioClipRow {
  id: string
  type: AudioClipType
  ref_id: string | null
  file_path: string
  duration_ms: number
  created_at: string
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

export const audioClipRepo = {
  getAll(): AudioClipRow[] {
    return getDb().select().from(audioClips).all() as AudioClipRow[]
  },

  getById(id: string): AudioClipRow | null {
    const result = getDb().select().from(audioClips).where(eq(audioClips.id, id)).get()
    return (result as AudioClipRow) ?? null
  },

  getByTypeRef(type: AudioClipType, ref_id: string | null): AudioClipRow | null {
    const condition = ref_id === null
      ? and(eq(audioClips.type, type), isNull(audioClips.ref_id))
      : and(eq(audioClips.type, type), eq(audioClips.ref_id, ref_id))
    const result = getDb().select().from(audioClips).where(condition).get()
    return (result as AudioClipRow) ?? null
  },

  /** Insert or replace the clip for this (type, ref_id) pair. */
  upsert(input: { type: AudioClipType; ref_id: string | null; file_path: string; duration_ms: number }): AudioClipRow {
    const existing = this.getByTypeRef(input.type, input.ref_id)
    const ts = now()

    if (existing) {
      getDb().update(audioClips)
        .set({ file_path: input.file_path, duration_ms: input.duration_ms, updated_at: ts })
        .where(eq(audioClips.id, existing.id))
        .run()
      return this.getByTypeRef(input.type, input.ref_id)!
    }

    const id = uuidv4()
    getDb().insert(audioClips).values({
      id,
      type: input.type,
      ref_id: input.ref_id,
      file_path: input.file_path,
      duration_ms: input.duration_ms,
      created_at: ts,
      updated_at: ts
    }).run()
    return this.getByTypeRef(input.type, input.ref_id)!
  },

  delete(id: string): void {
    getDb().delete(audioClips).where(eq(audioClips.id, id)).run()
  }
}
