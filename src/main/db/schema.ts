import { sqliteTable, text, integer, unique } from 'drizzle-orm/sqlite-core'

// ─── Buses ─────────────────────────────────────────────────────────────────

export const buses = sqliteTable('buses', {
  id:         text('id').primaryKey(),
  number:     text('number').notNull().unique(),
  capacity:   integer('capacity').notNull(),
  status:     text('status', { enum: ['ACTIVE', 'MAINTENANCE', 'RETIRED'] }).notNull().default('ACTIVE'),
  notes:      text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
})

// ─── Routes ────────────────────────────────────────────────────────────────

export const routes = sqliteTable('routes', {
  id:         text('id').primaryKey(),
  name:       text('name').notNull().unique(),
  name_bn:    text('name_bn'),
  color:      text('color').notNull().default('#3b82f6'),
  is_active:  integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes:      text('notes'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull()
})

// ─── Stops ─────────────────────────────────────────────────────────────────

export const stops = sqliteTable('stops', {
  id:             text('id').primaryKey(),
  route_id:       text('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  name_bn:        text('name_bn'),
  sequence_order: integer('sequence_order').notNull(),
  is_active:      integer('is_active', { mode: 'boolean' }).notNull().default(true),
  created_at:     text('created_at').notNull(),
  updated_at:     text('updated_at').notNull()
})

// ─── Shifts ────────────────────────────────────────────────────────────────

export const shifts = sqliteTable('shifts', {
  id:                     text('id').primaryKey(),
  name:                   text('name').notNull(),
  name_bn:                text('name_bn'),
  sort_order:             integer('sort_order').notNull().default(1),
  is_active:              integer('is_active', { mode: 'boolean' }).notNull().default(true),
  inbound_depart_school:  text('inbound_depart_school'),
  inbound_arrive_stops:   text('inbound_arrive_stops'),
  inbound_arrive_school:  text('inbound_arrive_school'),
  school_start_time:      text('school_start_time'),
  school_end_time:        text('school_end_time'),
  outbound_depart_school: text('outbound_depart_school'),
  outbound_arrive_stops:  text('outbound_arrive_stops'),
  gender_mode:            text('gender_mode', { enum: ['COMBINED', 'SEPARATED', 'AUTO'] }).notNull().default('COMBINED'),
  default_overload:       integer('default_overload').notNull().default(0),
  created_at:             text('created_at').notNull(),
  updated_at:             text('updated_at').notNull()
})

// ─── StopConfig ────────────────────────────────────────────────────────────

export const stopConfigs = sqliteTable('stop_configs', {
  id:            text('id').primaryKey(),
  stop_id:       text('stop_id').notNull().references(() => stops.id, { onDelete: 'cascade' }),
  shift_id:      text('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  is_active:     integer('is_active', { mode: 'boolean' }).notNull().default(true),
  planned_boys:  integer('planned_boys').notNull().default(0),
  planned_girls: integer('planned_girls').notNull().default(0),
  created_at:    text('created_at').notNull(),
  updated_at:    text('updated_at').notNull()
}, (t) => ({
  uniqueStopShift: unique('uq_stop_shift').on(t.stop_id, t.shift_id)
}))

// ─── Sessions ──────────────────────────────────────────────────────────────

export const sessions = sqliteTable('sessions', {
  id:         text('id').primaryKey(),
  date:       text('date').notNull().unique(),
  status:     text('status', { enum: ['OPEN', 'LOCKED'] }).notNull().default('OPEN'),
  notes:      text('notes'),
  created_at: text('created_at').notNull(),
  locked_at:  text('locked_at')
})

// ─── Runs ──────────────────────────────────────────────────────────────────

export const runs = sqliteTable('runs', {
  id:             text('id').primaryKey(),
  session_id:     text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  shift_id:       text('shift_id').notNull().references(() => shifts.id),
  bus_id:         text('bus_id').notNull().references(() => buses.id),
  route_id:       text('route_id').notNull().references(() => routes.id),
  direction:      text('direction', { enum: ['INBOUND', 'OUTBOUND'] }).notNull(),
  gender:         text('gender', { enum: ['BOYS', 'GIRLS', 'MIXED'] }).notNull().default('MIXED'),
  type:           text('type', { enum: ['REGULAR', 'SPECIAL'] }).notNull().default('REGULAR'),
  status:         text('status', { enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] }).notNull().default('SCHEDULED'),
  planned_depart: text('planned_depart'),
  planned_return: text('planned_return'),
  actual_depart:  text('actual_depart'),
  actual_return:  text('actual_return'),
  overload_limit: integer('overload_limit').notNull().default(0),
  assigned_by:    text('assigned_by', { enum: ['MANUAL', 'AUTO'] }).notNull().default('MANUAL'),
  notes:          text('notes'),
  created_at:     text('created_at').notNull(),
  updated_at:     text('updated_at').notNull()
})

// ─── RunStops ──────────────────────────────────────────────────────────────

export const runStops = sqliteTable('run_stops', {
  id:             text('id').primaryKey(),
  run_id:         text('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  stop_id:        text('stop_id').notNull().references(() => stops.id),
  sequence_order: integer('sequence_order').notNull(),
  student_count:  integer('student_count').notNull().default(0),
  gender:         text('gender', { enum: ['BOYS', 'GIRLS', 'MIXED'] }).notNull().default('MIXED')
})

// ─── Incidents ─────────────────────────────────────────────────────────────

export const incidents = sqliteTable('incidents', {
  id:             text('id').primaryKey(),
  session_id:     text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  type:           text('type', { enum: ['BUS_BREAKDOWN', 'BUS_DELAYED', 'DRIVER_ABSENT', 'ROUTE_BLOCKED', 'BUS_MAINTENANCE'] }).notNull(),
  status:         text('status', { enum: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] }).notNull().default('OPEN'),
  severity:       text('severity', { enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] }).notNull().default('MEDIUM'),
  title:          text('title').notNull(),
  description:    text('description'),
  bus_id:         text('bus_id').references(() => buses.id),
  run_id:         text('run_id').references(() => runs.id),
  reported_by:    text('reported_by'),
  resolved_by:    text('resolved_by'),
  created_at:     text('created_at').notNull(),
  acknowledged_at: text('acknowledged_at'),
  resolved_at:    text('resolved_at'),
  metadata:       text('metadata')
})

// ─── Audit Log ─────────────────────────────────────────────────────────────

export const auditLog = sqliteTable('audit_log', {
  id:          text('id').primaryKey(),
  entity_type: text('entity_type').notNull(),
  entity_id:   text('entity_id').notNull(),
  action:      text('action').notNull(),
  actor:       text('actor'),
  payload:     text('payload'),
  created_at:  text('created_at').notNull()
})

// ─── Schema export ─────────────────────────────────────────────────────────

export const schema = {
  buses,
  routes,
  stops,
  shifts,
  stopConfigs,
  sessions,
  runs,
  runStops,
  incidents,
  auditLog
}
