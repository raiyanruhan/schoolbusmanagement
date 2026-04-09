import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'

export function seedInitialData(sqlite: Database.Database): void {
  const now = new Date().toISOString()

  // Check if already seeded
  const busCount = sqlite.prepare('SELECT COUNT(*) as count FROM buses').get() as { count: number }
  if (busCount.count > 0) return

  console.log('[DB] Seeding initial data...')

  // ── Seed 2 buses ──────────────────────────────────────────────────────────
  const busInsert = sqlite.prepare(`
    INSERT INTO buses (id, number, capacity, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  busInsert.run(uuidv4(), 'Bus 01', 40, 'ACTIVE', 'Main fleet bus', now, now)
  busInsert.run(uuidv4(), 'Bus 02', 35, 'ACTIVE', 'Second fleet bus', now, now)

  // ── Seed 1 route with 4 stops ─────────────────────────────────────────────
  const routeId = uuidv4()
  sqlite.prepare(`
    INSERT INTO routes (id, name, name_bn, color, is_active, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(routeId, 'Route North', null, '#3b82f6', 1, 'Main northern route', now, now)

  const stopInsert = sqlite.prepare(`
    INSERT INTO stops (id, route_id, name, name_bn, sequence_order, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const stopIds = [uuidv4(), uuidv4(), uuidv4(), uuidv4()]
  const stopNames = ['Railway Crossing', 'Central Market', 'Park Gate', 'Hospital Road']
  stopNames.forEach((name, i) => {
    stopInsert.run(stopIds[i], routeId, name, null, i + 1, 1, now, now)
  })

  // ── Seed 1 shift ──────────────────────────────────────────────────────────
  const shiftId = uuidv4()
  sqlite.prepare(`
    INSERT INTO shifts (
      id, name, name_bn, sort_order, is_active,
      inbound_depart_school, inbound_arrive_stops, inbound_arrive_school,
      school_start_time, school_end_time,
      outbound_depart_school, outbound_arrive_stops,
      gender_mode, default_overload,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    shiftId, 'Morning', null, 1, 1,
    '06:45', '07:15', '07:50',
    '08:00', '11:00',
    '11:15', '11:50',
    'COMBINED', 5,
    now, now
  )

  // ── Seed stop configs for the shift ───────────────────────────────────────
  const stopConfigInsert = sqlite.prepare(`
    INSERT INTO stop_configs (id, stop_id, shift_id, is_active, planned_boys, planned_girls, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const defaultCounts = [
    { boys: 8, girls: 7 },
    { boys: 10, girls: 5 },
    { boys: 6, girls: 9 },
    { boys: 4, girls: 6 }
  ]

  stopIds.forEach((stopId, i) => {
    stopConfigInsert.run(
      uuidv4(), stopId, shiftId, 1,
      defaultCounts[i].boys, defaultCounts[i].girls,
      now, now
    )
  })

  console.log('[DB] Seed data inserted successfully')
}
