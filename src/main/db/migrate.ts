import type Database from 'better-sqlite3'

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 5,
    sql: `
      ALTER TABLE routes ADD COLUMN travel_time_inbound_min INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE routes ADD COLUMN travel_time_outbound_min INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS audio_clips (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL CHECK(type IN ('GREETING','ROUTE','BUS','GENDER')),
        ref_id      TEXT,
        file_path   TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        UNIQUE(type, ref_id)
      );

      CREATE TABLE IF NOT EXISTS route_stop_timestamps (
        id         TEXT PRIMARY KEY,
        route_id   TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        stop_id    TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
        start_ms   INTEGER NOT NULL,
        end_ms     INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(route_id, stop_id)
      );

      CREATE INDEX IF NOT EXISTS idx_audio_clips_type ON audio_clips(type);
      CREATE INDEX IF NOT EXISTS idx_route_stop_ts_route ON route_stop_timestamps(route_id);
    `
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS incidents (
        id              TEXT PRIMARY KEY,
        session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        type            TEXT NOT NULL CHECK(type IN ('BUS_BREAKDOWN','BUS_DELAYED','DRIVER_ABSENT','ROUTE_BLOCKED','BUS_MAINTENANCE')),
        status          TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
        severity        TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
        title           TEXT NOT NULL,
        description     TEXT,
        bus_id          TEXT REFERENCES buses(id),
        run_id          TEXT REFERENCES runs(id),
        reported_by     TEXT,
        resolved_by     TEXT,
        created_at      TEXT NOT NULL,
        acknowledged_at TEXT,
        resolved_at     TEXT,
        metadata        TEXT
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id          TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id   TEXT NOT NULL,
        action      TEXT NOT NULL,
        actor       TEXT,
        payload     TEXT,
        created_at  TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_incidents_session ON incidents(session_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
    `
  },
  {
    version: 2,
    sql: `__v2_drop_buses_gender__`
  },
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS buses (
        id         TEXT PRIMARY KEY,
        number     TEXT NOT NULL UNIQUE,
        capacity   INTEGER NOT NULL,
        status     TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','MAINTENANCE','RETIRED')),
        notes      TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS routes (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL UNIQUE,
        name_bn    TEXT,
        color      TEXT NOT NULL DEFAULT '#3b82f6',
        is_active  INTEGER NOT NULL DEFAULT 1,
        notes      TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stops (
        id             TEXT PRIMARY KEY,
        route_id       TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        name_bn        TEXT,
        sequence_order INTEGER NOT NULL,
        is_active      INTEGER NOT NULL DEFAULT 1,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS shifts (
        id                     TEXT PRIMARY KEY,
        name                   TEXT NOT NULL,
        name_bn                TEXT,
        sort_order             INTEGER NOT NULL DEFAULT 1,
        is_active              INTEGER NOT NULL DEFAULT 1,
        inbound_depart_school  TEXT,
        inbound_arrive_stops   TEXT,
        inbound_arrive_school  TEXT,
        school_start_time      TEXT,
        school_end_time        TEXT,
        outbound_depart_school TEXT,
        outbound_arrive_stops  TEXT,
        gender_mode            TEXT NOT NULL DEFAULT 'COMBINED' CHECK(gender_mode IN ('COMBINED','SEPARATED','AUTO')),
        default_overload       INTEGER NOT NULL DEFAULT 0,
        created_at             TEXT NOT NULL,
        updated_at             TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stop_configs (
        id            TEXT PRIMARY KEY,
        stop_id       TEXT NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
        shift_id      TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        is_active     INTEGER NOT NULL DEFAULT 1,
        planned_boys  INTEGER NOT NULL DEFAULT 0,
        planned_girls INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL,
        UNIQUE(stop_id, shift_id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id         TEXT PRIMARY KEY,
        date       TEXT NOT NULL UNIQUE,
        status     TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','LOCKED')),
        notes      TEXT,
        created_at TEXT NOT NULL,
        locked_at  TEXT
      );

      CREATE TABLE IF NOT EXISTS runs (
        id             TEXT PRIMARY KEY,
        session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        shift_id       TEXT NOT NULL REFERENCES shifts(id),
        bus_id         TEXT NOT NULL REFERENCES buses(id),
        route_id       TEXT NOT NULL REFERENCES routes(id),
        direction      TEXT NOT NULL CHECK(direction IN ('INBOUND','OUTBOUND')),
        gender         TEXT NOT NULL DEFAULT 'MIXED' CHECK(gender IN ('BOYS','GIRLS','MIXED')),
        type           TEXT NOT NULL DEFAULT 'REGULAR' CHECK(type IN ('REGULAR','SPECIAL')),
        status         TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK(status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
        planned_depart TEXT,
        planned_return TEXT,
        actual_depart  TEXT,
        actual_return  TEXT,
        overload_limit INTEGER NOT NULL DEFAULT 0,
        assigned_by    TEXT NOT NULL DEFAULT 'MANUAL' CHECK(assigned_by IN ('MANUAL','AUTO')),
        notes          TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS run_stops (
        id             TEXT PRIMARY KEY,
        run_id         TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        stop_id        TEXT NOT NULL REFERENCES stops(id),
        sequence_order INTEGER NOT NULL,
        student_count  INTEGER NOT NULL DEFAULT 0,
        gender         TEXT NOT NULL DEFAULT 'MIXED' CHECK(gender IN ('BOYS','GIRLS','MIXED'))
      );

      CREATE TABLE IF NOT EXISTS _migrations (
        version    INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `
  }
]

function runMigrationStep(sqlite: Database.Database, version: number, sql: string): void {
  if (version === 2) {
    // SQLite doesn't support ALTER TABLE DROP COLUMN IF EXISTS — check manually
    const cols = sqlite.prepare("PRAGMA table_info(buses)").all() as Array<{ name: string }>
    if (cols.some((c) => c.name === 'gender')) {
      sqlite.exec('ALTER TABLE buses DROP COLUMN gender')
    }
    return
  }
  sqlite.exec(sql)
}

export function runMigrations(sqlite: Database.Database): void {
  // Create migrations table if not exists
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const getApplied = sqlite.prepare<[], { version: number }>('SELECT version FROM _migrations ORDER BY version')
  const insertMigration = sqlite.prepare('INSERT INTO _migrations (version, applied_at) VALUES (?, ?)')

  const applied = new Set(getApplied.all().map((r) => r.version))

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue

    console.log(`[DB] Applying migration v${migration.version}`)
    runMigrationStep(sqlite, migration.version, migration.sql)
    insertMigration.run(migration.version, new Date().toISOString())
    console.log(`[DB] Migration v${migration.version} applied`)
  }
}
