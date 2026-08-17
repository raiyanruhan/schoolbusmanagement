import { z } from 'zod'
import { app } from 'electron'
import { join } from 'path'
import { mkdirSync, writeFileSync, unlinkSync } from 'fs'
import { audioClipRepo, type AudioClipRow } from '../repositories/audioClipRepo'
import { routeStopTimestampRepo } from '../repositories/routeStopTimestampRepo'
import { runRepo } from '../repositories/runRepo'
import { groupRunsForAnnouncements, resolveAnnouncementGroups } from '../engine/announcementBuilder'
import type {
  AudioClip, AudioClipType, IpcResult, RouteStopTimestamp, AnnouncementGroup
} from '../../shared/types'

// ─── Input schemas ────────────────────────────────────────────────────────────

const AudioClipTypeSchema = z.enum(['GREETING', 'ROUTE', 'BUS', 'GENDER'])

const SaveClipSchema = z.object({
  type: AudioClipTypeSchema,
  ref_id: z.string().nullable(),
  buffer: z.instanceof(ArrayBuffer),
  duration_ms: z.number().nonnegative()
})

const SaveTimestampsSchema = z.object({
  route_id: z.string().uuid(),
  timestamps: z.array(z.object({
    stop_id: z.string().uuid(),
    start_ms: z.number().nonnegative(),
    end_ms: z.number().nonnegative()
  }))
})

const ResolveAnnouncementsSchema = z.object({
  session_id: z.string().uuid(),
  shift_id: z.string().uuid().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional()
})

// ─── File storage ─────────────────────────────────────────────────────────────

function audioDir(): string {
  return join(app.getPath('userData'), 'data', 'audio')
}

function fileNameFor(ref_id: string | null): string {
  return `${ref_id ?? 'default'}.webm`
}

function toAudioClip(row: AudioClipRow): AudioClip {
  return {
    id: row.id,
    type: row.type,
    ref_id: row.ref_id,
    file_path: row.file_path,
    // Explicit "clip" host — with a "standard" scheme, three slashes (empty
    // host) lets Chromium's URL parser swallow the first path segment as the
    // host instead of pathname, silently dropping it. A real host avoids that.
    url: `audio-file://clip/${row.file_path}?t=${Date.parse(row.updated_at) || 0}`,
    duration_ms: row.duration_ms,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const audioService = {
  getAll(): IpcResult<AudioClip[]> {
    try {
      return { success: true, data: audioClipRepo.getAll().map(toAudioClip) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  saveClip(rawInput: unknown): IpcResult<AudioClip> {
    try {
      const input = SaveClipSchema.parse(rawInput)

      const dir = join(audioDir(), input.type)
      mkdirSync(dir, { recursive: true })
      const fileName = fileNameFor(input.ref_id)
      const absPath = join(dir, fileName)
      writeFileSync(absPath, Buffer.from(input.buffer))

      const relPath = `${input.type}/${fileName}`
      const row = audioClipRepo.upsert({
        type: input.type,
        ref_id: input.ref_id,
        file_path: relPath,
        duration_ms: Math.round(input.duration_ms)
      })

      return { success: true, data: toAudioClip(row) }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  deleteClip(rawId: unknown): IpcResult<void> {
    try {
      const id = z.string().uuid().parse(rawId)
      const row = audioClipRepo.getById(id)
      if (row) {
        try { unlinkSync(join(audioDir(), row.file_path)) } catch { /* file already gone */ }
      }
      audioClipRepo.delete(id)
      return { success: true, data: undefined }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  getStopTimestamps(rawRouteId: unknown): IpcResult<RouteStopTimestamp[]> {
    try {
      const route_id = z.string().uuid().parse(rawRouteId)
      return { success: true, data: routeStopTimestampRepo.getByRoute(route_id) }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  },

  saveStopTimestamps(rawInput: unknown): IpcResult<void> {
    try {
      const input = SaveTimestampsSchema.parse(rawInput)
      routeStopTimestampRepo.replaceForRoute(input.route_id, input.timestamps)
      return { success: true, data: undefined }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  },

  resolveAnnouncements(rawInput: unknown): IpcResult<AnnouncementGroup[]> {
    try {
      const input = ResolveAnnouncementsSchema.parse(rawInput)

      let runs = runRepo.getAllRunsWithDetails(input.session_id)
      if (input.shift_id) runs = runs.filter((r) => r.shift_id === input.shift_id)
      if (input.direction) runs = runs.filter((r) => r.direction === input.direction)

      const groups = groupRunsForAnnouncements(runs)

      const allClips = audioClipRepo.getAll()
      const byType = (type: AudioClipType) => allClips.filter((c) => c.type === type)
      const greetingRow = byType('GREETING')[0] ?? null
      const routeRows = new Map(byType('ROUTE').map((c) => [c.ref_id, c]))
      const busRows = new Map(byType('BUS').map((c) => [c.ref_id, c]))
      const genderRows = new Map(byType('GENDER').map((c) => [c.ref_id, c]))

      const timestampCache = new Map<string, ReturnType<typeof routeStopTimestampRepo.getByRoute>>()

      const result = resolveAnnouncementGroups(
        groups,
        {
          greeting: greetingRow ? toAudioClip(greetingRow) : null,
          route: (route_id) => {
            const row = routeRows.get(route_id)
            return row ? toAudioClip(row) : null
          },
          bus: (bus_id) => {
            const row = busRows.get(bus_id)
            return row ? toAudioClip(row) : null
          },
          gender: (gender) => {
            const row = genderRows.get(gender)
            return row ? toAudioClip(row) : null
          }
        },
        (route_id) => {
          if (!timestampCache.has(route_id)) {
            timestampCache.set(route_id, routeStopTimestampRepo.getByRoute(route_id))
          }
          return timestampCache.get(route_id)!
        }
      )

      return { success: true, data: result }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return { success: false, error: e.errors.map((err) => err.message).join(', ') }
      }
      return { success: false, error: String(e) }
    }
  }
}
