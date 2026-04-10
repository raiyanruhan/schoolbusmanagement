import { ipcMain } from 'electron'
import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { getDb, getSqlite } from '../db'
import { routes, stops, stopConfigs, buses } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import type { IpcResult } from '../../shared/types'

export interface ImportBusesResult {
  created: number
  skipped: number
}

const ROUTE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
  '#a855f7', '#22c55e', '#eab308', '#6366f1', '#0ea5e9'
]

function now() { return new Date().toISOString() }

export interface ImportRoutesResult {
  routesCreated: number
  routesExisting: number
  stopsCreated: number
  stopsSkipped: number
}

export interface ImportShiftConfigResult {
  updated: number
  notFound: string[]
}

export function registerExcelHandlers(): void {

  // ── Import routes & stops from Excel ────────────────────────────────────────
  ipcMain.handle('excel:importRoutes', (_e, buffer: ArrayBuffer): IpcResult<ImportRoutesResult> => {
    try {
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

      // Skip header row(s) — skip first row always
      const dataRows = rawRows.slice(1).filter((r) => {
        const row = r as unknown[]
        return row.length >= 2 && row[0] && row[1]
      })

      // Group stops by route name, preserving order of appearance
      const routeMap = new Map<string, string[]>() // routeName → stopNames[]
      for (const rawRow of dataRows) {
        const row = rawRow as unknown[]
        const stopName = String(row[0]).trim()
        const routeName = String(row[1]).trim()
        if (!stopName || !routeName) continue
        if (!routeMap.has(routeName)) routeMap.set(routeName, [])
        routeMap.get(routeName)!.push(stopName)
      }

      const db = getDb()
      let routesCreated = 0
      let routesExisting = 0
      let stopsCreated = 0
      let stopsSkipped = 0
      let colorIndex = 0

      for (const [routeName, stopNames] of routeMap) {
        const ts = now()

        // Find or create route
        let existingRoute = db.select().from(routes).where(eq(routes.name, routeName)).get()
        let routeId: string

        if (existingRoute) {
          routeId = (existingRoute as { id: string }).id
          routesExisting++
        } else {
          routeId = uuidv4()
          db.insert(routes).values({
            id: routeId,
            name: routeName,
            name_bn: null,
            color: ROUTE_COLORS[colorIndex % ROUTE_COLORS.length],
            is_active: true,
            notes: null,
            created_at: ts,
            updated_at: ts
          }).run()
          colorIndex++
          routesCreated++
        }

        // Get existing stops for this route to determine sequence + dedup
        const existingStops = db.select().from(stops).where(eq(stops.route_id, routeId)).all() as { name: string; sequence_order: number }[]
        const existingNames = new Set(existingStops.map((s) => s.name.toLowerCase()))
        const maxOrder = existingStops.length > 0
          ? Math.max(...existingStops.map((s) => s.sequence_order))
          : 0

        let seq = maxOrder
        for (const stopName of stopNames) {
          if (existingNames.has(stopName.toLowerCase())) {
            stopsSkipped++
            continue
          }
          seq++
          db.insert(stops).values({
            id: uuidv4(),
            route_id: routeId,
            name: stopName,
            name_bn: null,
            sequence_order: seq,
            is_active: true,
            created_at: ts,
            updated_at: ts
          }).run()
          stopsCreated++
        }
      }

      return { success: true, data: { routesCreated, routesExisting, stopsCreated, stopsSkipped } }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // ── Import shift stop configs from Excel ─────────────────────────────────────
  ipcMain.handle('excel:importShiftConfigs', (_e, input: { shift_id: string; buffer: ArrayBuffer }): IpcResult<ImportShiftConfigResult> => {
    try {
      const { shift_id, buffer } = input
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

      // Skip first row (header)
      const dataRows = rawRows.slice(1).filter((r) => {
        const row = r as unknown[]
        return row.length >= 2 && row[0]
      })

      const db = getDb()
      const sqlite = getSqlite()

      // Build a map of stop name (lowercase) → stop id from all stops
      const allStops = sqlite.prepare('SELECT id, name FROM stops').all() as { id: string; name: string }[]
      const stopNameMap = new Map(allStops.map((s) => [s.name.toLowerCase().trim(), s.id]))

      let updated = 0
      const notFound: string[] = []
      const ts = now()

      for (const rawRow of dataRows) {
        const row = rawRow as unknown[]
        const stopName = String(row[0]).trim()
        if (!stopName) continue

        const stopId = stopNameMap.get(stopName.toLowerCase())
        if (!stopId) {
          notFound.push(stopName)
          continue
        }

        let planned_boys = 0
        let planned_girls = 0

        if (row.length >= 3) {
          // Format: stop, boys, girls
          planned_boys = Number(row[1]) || 0
          planned_girls = Number(row[2]) || 0
        } else {
          // Format: stop, total — import as boys only (user can adjust)
          planned_boys = Number(row[1]) || 0
          planned_girls = 0
        }

        // Upsert stop_config
        const existing = db.select()
          .from(stopConfigs)
          .where(and(eq(stopConfigs.stop_id, stopId), eq(stopConfigs.shift_id, shift_id)))
          .get()

        if (existing) {
          db.update(stopConfigs)
            .set({ planned_boys, planned_girls, is_active: true, updated_at: ts })
            .where(and(eq(stopConfigs.stop_id, stopId), eq(stopConfigs.shift_id, shift_id)))
            .run()
        } else {
          db.insert(stopConfigs).values({
            id: uuidv4(),
            stop_id: stopId,
            shift_id,
            is_active: true,
            planned_boys,
            planned_girls,
            created_at: ts,
            updated_at: ts
          }).run()
        }

        updated++
      }

      return { success: true, data: { updated, notFound } }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // ── Import buses from Excel ───────────────────────────────────────────────────
  ipcMain.handle('excel:importBuses', (_e, buffer: ArrayBuffer): IpcResult<ImportBusesResult> => {
    try {
      const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

      // Skip first row (header/description)
      const dataRows = rawRows.slice(1).filter((r) => {
        const row = r as unknown[]
        return row.length >= 2 && row[0] !== null && row[0] !== undefined && row[0] !== ''
      })

      const db = getDb()
      let created = 0
      let skipped = 0
      const ts = now()

      for (const rawRow of dataRows) {
        const row = rawRow as unknown[]
        const busNumber = String(row[0]).trim()
        const capacity = Number(row[1])

        if (!busNumber || isNaN(capacity) || capacity <= 0) continue

        // Skip if bus with same number already exists
        const existing = db.select().from(buses).where(eq(buses.number, busNumber)).get()
        if (existing) { skipped++; continue }

        db.insert(buses).values({
          id: uuidv4(),
          number: busNumber,
          capacity,
          status: 'ACTIVE',
          notes: null,
          created_at: ts,
          updated_at: ts
        }).run()
        created++
      }

      return { success: true, data: { created, skipped } }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}
