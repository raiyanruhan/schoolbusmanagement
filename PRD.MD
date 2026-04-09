# School Bus Management System
## Product Requirements Document — Final
**Version:** 2.0  
**Status:** Final Draft  
**Target Lifespan:** 30+ years  
**Platform:** Electron (offline-first desktop, Windows)

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Core Concepts — Read This First](#2-core-concepts--read-this-first)
3. [Data Model](#3-data-model)
4. [Pages & Features](#4-pages--features)
   - 4.1 Dashboard
   - 4.2 Fleet Management (Buses)
   - 4.3 Route & Stop Management
   - 4.4 Shift Management
   - 4.5 Daily Planner (Run Scheduling)
   - 4.6 Assignment Engine
   - 4.7 Incidents & Conflict Resolution
   - 4.8 Special Dispatch
   - 4.9 Display Board
   - 4.10 Announcement System
   - 4.11 Reports & Print
   - 4.12 Settings
   - 4.13 Audit Log
5. [Assignment Engine — Rules & Logic](#5-assignment-engine--rules--logic)
6. [Gender Separation Logic](#6-gender-separation-logic)
7. [Attendance Integration](#7-attendance-integration)
8. [Incident System](#8-incident-system)
9. [Settings Architecture](#9-settings-architecture)
10. [Future-Proofing Contracts](#10-future-proofing-contracts)
11. [Error States & Edge Cases](#11-error-states--edge-cases)
12. [Glossary](#12-glossary)

---

## 1. What This System Does

A school operates a fleet of buses. Every day, buses make multiple trips — picking students up from stops in the morning, dropping them home in the afternoon. This repeats across multiple shifts (Morning, Mid, Day) each with different times and different sets of students.

This software manages everything: which bus goes to which stops, in which order, at what time, for which shift, for which gender. It handles breakdowns, driver absences, blocked roads, special trips, and generates the display board and voice announcements that students see and hear.

**The operator's daily job is:** open the software, confirm today's plan, handle any incidents, lock the session, go home.

---

## 2. Core Concepts — Read This First

These five ideas connect everything. Understand these and the rest of the document is obvious.

### 2.1 Routes are permanent geography
A Route is a road path with stops on it. Route North exists forever. It doesn't belong to Morning shift or Day shift. It is a physical path in the real world.

### 2.2 Stops are permanent locations on a route
Stop "Railway Crossing" is on Route North. It exists regardless of which shift is running. What changes per shift is: is this stop active for this shift, and how many boys/girls travel from here in this shift.

### 2.3 Shifts define time and gender policy — nothing else
A Shift (Morning, Mid, Day) is a contract: "students must arrive at school by time X, and leave school at time Y." The shift also says whether buses are gender-separated for that shift or combined. That's all a shift is.

### 2.4 A Run is one bus making one trip
A Run is the atomic unit of the whole system. One bus, one direction (to school or from school), one set of stops, one departure time, one expected return time. Everything — scheduling, display, announcements, conflict detection — is built on Runs.

### 2.5 A Session is one calendar day
All Runs for today belong to today's Session. Yesterday's Session is preserved forever. The system always knows what happened on any past day.

---

## 3. Data Model

All entities use UUID as primary key. Names are never primary keys. Renaming anything never breaks anything.

### 3.1 Bus
```
id              UUID            Primary key
number          String          Unique. e.g. "Bus 07", "BCPSC-12"
capacity        Integer         Nominal seat count. Min 1.
gender          Enum            BOYS | GIRLS | MIXED
status          Enum            ACTIVE | MAINTENANCE | RETIRED
notes           String          Optional. e.g. "AC bus", "needs brake check"
created_at      DateTime
updated_at      DateTime
```

`status = MAINTENANCE` means the bus is temporarily unavailable. Set a `maintenance_until` date. On that date the system auto-restores to ACTIVE.  
`status = RETIRED` means permanently removed from fleet. Preserved for historical records.

---

### 3.2 Route
```
id              UUID            Primary key
name            String          Unique. e.g. "Route North", "Airport Road"
name_bn         String          Bengali name
color           String          Hex color for display board differentiation
is_active       Boolean
notes           String
created_at      DateTime
updated_at      DateTime
```

Routes have no shift_id. They are global.

---

### 3.3 Stop
```
id              UUID            Primary key
route_id        UUID            → Route
name            String          e.g. "Railway Crossing"
name_bn         String          Bengali name
sequence_order  Integer         Pickup order within the route. 1 = first pickup.
is_active       Boolean         Global active flag. If false, excluded from everything.
created_at      DateTime
updated_at      DateTime
```

Stop names within a Route must be unique. The same stop name can exist on different routes.

---

### 3.4 StopConfig
This is the bridge between a Stop and a Shift. It stores everything that is shift-specific about a stop.

```
id                  UUID        Primary key
stop_id             UUID        → Stop
shift_id            UUID        → Shift
is_active           Boolean     Is this stop used in this shift?
planned_boys        Integer     Expected boys count for this stop in this shift
planned_girls       Integer     Expected girls count for this stop in this shift
created_at          DateTime
updated_at          DateTime
```

Unique constraint: (stop_id, shift_id) — one config per stop per shift.

If a stop has no StopConfig for a given shift, it is treated as inactive for that shift. The operator does not need to explicitly create a "disabled" config.

---

### 3.5 Shift
```
id                      UUID        Primary key
name                    String      e.g. "Morning", "Mid", "Day"
name_bn                 String      Bengali name
sort_order              Integer     Display order. Morning=1, Mid=2, Day=3.
is_active               Boolean

-- Inbound run times (stops → school)
inbound_depart_school   Time        When empty buses leave school
inbound_arrive_stops    Time        When buses reach first stops (estimated)
inbound_arrive_school   Time        Deadline: all buses must be back
school_start_time       Time        When classes begin

-- Outbound run times (school → stops)
school_end_time         Time        When classes end
outbound_depart_school  Time        When loaded buses leave school
outbound_arrive_stops   Time        When buses finish all drop-offs

-- Policy
gender_mode             Enum        COMBINED | SEPARATED | AUTO
default_overload        Integer     Extra seats allowed beyond capacity

created_at              DateTime
updated_at              DateTime
```

Example — Morning Shift:
```
inbound_depart_school   = 06:45
inbound_arrive_stops    = 07:15
inbound_arrive_school   = 07:50
school_start_time       = 08:00
school_end_time         = 11:00
outbound_depart_school  = 11:15
outbound_arrive_stops   = 11:50
gender_mode             = COMBINED
default_overload        = 27
```

---

### 3.6 Run
The atomic scheduling unit. One bus, one direction, one set of stops, one date.

```
id                  UUID        Primary key
session_id          UUID        → Session (which day)
shift_id            UUID        → Shift (which shift's time contract applies)
bus_id              UUID        → Bus
route_id            UUID        → Route (which route's stops are served)
direction           Enum        INBOUND | OUTBOUND
gender              Enum        BOYS | GIRLS | MIXED (who is on this run)
type                Enum        REGULAR | SPECIAL
status              Enum        SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
planned_depart      DateTime    Scheduled departure time
planned_return      DateTime    Scheduled return time
actual_depart       DateTime    Null until bus actually departs
actual_return       DateTime    Null until bus actually returns
overload_limit      Integer     Overload for this specific run (overrides shift default)
assigned_by         Enum        MANUAL | AUTO
notes               String
created_at          DateTime
updated_at          DateTime
```

---

### 3.7 RunStop
Which specific stops are served by a Run, and in what order.

```
id              UUID        Primary key
run_id          UUID        → Run
stop_id         UUID        → Stop
sequence_order  Integer     Pickup/dropoff order for this run (copied from Stop.sequence_order at time of assignment, can be overridden)
student_count   Integer     Actual students for this run at this stop (from attendance if available, else planned)
gender          Enum        BOYS | GIRLS | MIXED
```

This is how you assign 2 buses to one route: Bus A gets RunStops for stops 1-3, Bus B gets RunStops for stops 4-6. Both Runs point to the same Route.

---

### 3.8 Session
```
id              UUID        Primary key
date            Date        Unique. One session per calendar day.
status          Enum        OPEN | LOCKED
notes           String
created_at      DateTime
locked_at       DateTime
```

---

### 3.9 AttendanceRecord
Live data from the school's attendance API. Stored locally so the system works if the API goes down mid-day.

```
id              UUID        Primary key
session_id      UUID        → Session
stop_id         UUID        → Stop
shift_id        UUID        → Shift
actual_boys     Integer
actual_girls    Integer
source          Enum        API | MANUAL_OVERRIDE | PLANNED_FALLBACK
fetched_at      DateTime
```

---

### 3.10 Incident
Any problem that affects a Bus, Route, or Run.

```
id              UUID        Primary key
session_id      UUID        → Session
type            Enum        BUS_BREAKDOWN | BUS_DELAYED | DRIVER_ABSENT |
                            ROUTE_BLOCKED | BUS_MAINTENANCE | OTHER
severity        Enum        WARNING | CRITICAL
affected_type   Enum        BUS | ROUTE | RUN | STOP
affected_id     UUID        ID of the affected entity
description     String
status          Enum        OPEN | RESOLVED | ACKNOWLEDGED
resolution      String      What was done to fix it
created_at      DateTime
resolved_at     DateTime
```

---

### 3.11 SpecialRun
A one-off trip not tied to any shift. School trip, sports day, emergency.

```
id              UUID        Primary key
session_id      UUID        → Session
name            String      e.g. "Museum Trip", "Sports Day"
bus_id          UUID        → Bus
direction       Enum        OUTBOUND | INBOUND | ROUND_TRIP
priority        Enum        NORMAL | EMERGENCY
planned_depart  DateTime
planned_return  DateTime
actual_depart   DateTime
actual_return   DateTime
status          Enum        SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED
notes           String
created_at      DateTime
```

SpecialRuns have their own stop list: **SpecialRunStop** table with (special_run_id, stop_id, sequence_order, passenger_count, notes). Stops used in SpecialRuns can be any existing stop or a free-text custom location.

---

### 3.12 Setting
```
key             String      Primary key. e.g. "system.min_turnaround_minutes"
value           String      JSON-encoded value
scope           Enum        SYSTEM | SHIFT | SESSION
scope_id        UUID        If scope=SHIFT: shift UUID. If scope=SESSION: session UUID. Else null.
updated_at      DateTime
```

Three-scope settings. System is the default. Shift overrides System for that shift. Session overrides everything for today only.

---

### 3.13 AuditLog
```
id              UUID        Primary key
timestamp       DateTime
entity_type     String      e.g. "Bus", "Run", "StopConfig"
entity_id       UUID
action          Enum        CREATE | UPDATE | DELETE | DEACTIVATE
field_name      String      Which field changed (null for CREATE/DELETE)
old_value       String      JSON
new_value       String      JSON
triggered_by    Enum        OPERATOR | SYSTEM | API | IMPORT
```

Append-only. Never deleted.

---

## 4. Pages & Features

### 4.1 Dashboard

The home screen. Shows today at a glance. The operator sees everything important without navigating anywhere.

**Layout:**
```
[Top Bar]  School Logo | School Name | Today's Date | Session Status | Clock (live)

[Alert Bar] — Red if any open Incidents. "2 incidents need attention → View"
             — Yellow if attendance API is unavailable. "Using planned counts"
             — Green if everything is clear.

[Shift Tabs]  Morning | Mid | Day | + any custom shifts

[Main Content — two columns]

Left (35%):                          Right (65%):
  Today's Summary                      Run Timeline for selected shift
  ─────────────────                    ─────────────────────────────
  Active Buses: 14                     06:45  Inbound ●
  Buses Assigned: 12                   ├─ Bus 07 → Route North (Boys+Girls)
  Buses Available: 2                   ├─ Bus 09 → Route South (Boys+Girls)
                                       └─ Bus 11 → Airport Road (Boys+Girls)
  Students Today                       
  Morning: 420 / 450 (live)           11:15  Outbound ●
  Mid:     280 / 310 (live)           ├─ Bus 07 → Route North
  Day:     195 / 220 (live)           └─ Bus 09 → Route South
  
  Fleet Status
  ✓ Active: 14
  ⚠ Maintenance: 1 (Bus 03, back Thu)
  ✗ Incidents: 2
```

**Buttons on Dashboard:**

| Button | Where | What it does |
|--------|--------|--------------|
| `New Session` | Top bar | Creates today's session. Disabled if today's session already exists. |
| `Lock Session` | Top bar | Locks today's session. Confirmation dialog required. |
| `Open Display Board` | Top bar | Opens the full-screen Display Board in a second window. |
| `Plan Today` | Top bar | Shortcut to Daily Planner for today. |
| `View Incidents` | Alert bar | Navigates to Incidents page filtered to open incidents. |
| `[Shift Tab]` | Below top bar | Switches which shift's timeline is shown. |
| Run row (click) | Timeline | Opens that Run's detail. |
| `+ Add Special Dispatch` | Bottom of timeline | Opens Special Dispatch page. |

**Run status indicators on timeline:**
- Grey circle = Scheduled (not yet departed)
- Blue circle = In Progress (departed, not yet returned)
- Green circle = Completed
- Red circle = Cancelled or has open Incident

---

### 4.2 Fleet Management (Buses)

Manage the permanent bus fleet. Every bus the school owns or uses regularly lives here.

**Layout:**
- Top: Search | Filter by status | Filter by gender | `+ Add Bus` | `Import` | `Export`
- Main: Table, sorted Active first then by bus number

**Table columns:**
Bus Number | Capacity | Gender | Status | Maintenance Until | Notes | Actions

**Actions per row:**
| Button | What it does |
|--------|--------------|
| `Edit` | Slide-in panel. All fields editable. |
| `Mark Maintenance` | Opens dialog: From date, Until date, reason. Bus is excluded from all scheduling during this range. |
| `Restore to Active` | Marks bus active. Only shown for MAINTENANCE buses. |
| `Retire` | Confirmation required ("Retire Bus [X]? This is permanent."). Status → RETIRED. |
| `View History` | Modal: every Run this bus has ever been on, newest first. |
| `View Today's Schedule` | Modal: all Runs assigned to this bus today, as a timeline. |

**Add / Edit Bus fields:**
- Bus Number (required, unique among ACTIVE + MAINTENANCE buses)
- Capacity (required, integer 1–300)
- Gender (BOYS / GIRLS / MIXED)
- Status (ACTIVE / MAINTENANCE / RETIRED)
- Maintenance Until (date picker, only shown when status = MAINTENANCE)
- Notes (optional free text)

**Import from Excel:**
Required headers: `Bus Number`, `Capacity`, `Gender`  
Optional headers: `Notes`, `Status`  
`Gender` accepts: `boys`, `girls`, `mixed` (case-insensitive)  
If a bus number already exists: update it (do not duplicate).  
After import: show summary. "14 added, 2 updated, 1 skipped (see details)."

**Export:** All buses to `.xlsx`. Filename: `buses_YYYY-MM-DD.xlsx`

---

### 4.3 Route & Stop Management

Routes and stops are permanent geography. This page manages them. This is not where you configure which stops serve which shift — that is done in Shift Management (4.4).

**Layout:**
- Left panel (30%): Route list with `+ Add Route` and search
- Right panel (70%): Stop list for selected route

**Route list items show:**
Route name (colored dot) | Total stops | Active stops | Edit | Deactivate

**Stop list (right panel):**
- Header: Route name | `Edit Route` | `Deactivate Route` | `Import Stops` | `Export Stops`
- Stops shown as a numbered list (sequence order)
- Drag handles for reordering (sequence_order updates on drop)
- Each stop row: # | Stop Name | Bengali Name | Status | Edit | Deactivate

**Add / Edit Route:**
- Name (required, unique)
- Bengali Name
- Color (color picker, for display board)
- Notes

**Add / Edit Stop:**
- Name (required, unique within this route)
- Bengali Name (required)
- This is the permanent name. To set student counts per shift, go to Shift Management.

**Deactivate Stop:**
Confirmation: "Deactivate [Stop Name]? It will be removed from all future runs but historical records are preserved."
A deactivated stop also deactivates all its StopConfigs across all shifts. The operator is warned: "This stop is configured in 3 shifts. Those configurations will also be deactivated."

**Import Stops for a Route:**
Required headers: `Stop Name`, `Bengali Name`  
Optional header: `Sequence Order`  
If Sequence Order is missing, stops are added in file order after existing stops.

---

### 4.4 Shift Management

Configure each shift's time contract, gender policy, and which stops are active with what student counts.

**Layout:**
- Left panel (25%): Shift list with `+ Add Shift`
- Right panel (75%): Configuration for selected shift

**Shift list items show:**
Shift name | Time summary (e.g. "In: 06:45 | Out: 11:15") | Gender mode badge | Active toggle

**Right panel — four tabs:**

#### Tab 1: Time & Policy
All time fields for this shift (see Shift data model). All fields are editable inline.

Gender Mode radio:
- `Combined` — boys and girls ride the same buses
- `Separated` — boys and girls always on different buses (2 buses per route)
- `Auto` — system separates if fleet allows, combines if it doesn't

Default Overload field: integer, how many extra students beyond bus capacity are allowed for runs in this shift.

Minimum Fill % field: if a bus is assigned but will be less than this % full, the system flags it as underfilled.

`Save Changes` button. Changes take effect from the next session — today's session is not affected.

#### Tab 2: Stop Configuration
This is where you set which stops are active for this shift and how many students travel per stop.

Display: all routes, expandable. Each route shows all its stops.

Per stop row:
| Column | Type | Description |
|--------|------|-------------|
| Active | Toggle | Is this stop used in this shift? |
| Stop Name | Read-only | From Stop record (edit in Route management) |
| Bengali Name | Read-only | From Stop record |
| Boys | Number input | Planned boys count for this stop in this shift |
| Girls | Number input | Planned girls count for this stop in this shift |
| Total | Calculated | Boys + Girls |

Inactive stops are greyed out. Their Boys/Girls fields are hidden.

`Import Stop Configs` button:
Required headers: `Route`, `Stop`, `Active`, `Boys`, `Girls`
`Active` accepts: `yes/no`, `true/false`, `1/0`

`Copy from Shift` button: copies all StopConfigs from another shift as a starting point. Useful when creating a new shift that's similar to an existing one.

#### Tab 3: Travel Times
Per-route estimated travel time. The system uses this for schedule optimization.

Per route row:
| Column | Type | Description |
|--------|------|-------------|
| Route | Read-only | Route name |
| Inbound Travel Time | Minutes | How long the inbound run takes (school → stops → school) |
| Outbound Travel Time | Minutes | How long the outbound run takes (school → stops) |
| Notes | Text | e.g. "add 10 min on rainy days" |

These are operator estimates. The system does not use GPS. If travel times are wrong, the schedule plan will be wrong. The UI makes this clear: "Travel times are estimates. Update them when you notice consistent deviation."

#### Tab 4: Overrides (Discord-style toggles)
Per-shift feature toggles that override system defaults for this shift only.

| Setting | Options | Default |
|---------|---------|---------|
| Gender Separation | Always Separate / Follow Shift Policy / Always Combined | Follow Shift Policy |
| Attendance Source | Always Use API / Use API if Available / Always Use Planned | Use API if Available |
| Auto-Announcements | Always Generate / Generate if Configured / Disabled | Generate if Configured |
| Overload Warnings | Always Warn / Warn if Exceeded / Silent | Warn if Exceeded |
| Minimum Fill Warnings | Enabled / Disabled | Enabled |

---

### 4.5 Daily Planner (Run Scheduling)

The core operational page. This is where the operator plans today's runs: which bus serves which route, with which stops, at what time.

**Accessed from:** Dashboard → Plan Today, or main nav.

**Layout:**
- Top bar: Session date | Shift selector tabs | `Auto-Plan This Shift` | `Clear Shift Plan` | `Copy from Yesterday`
- Main area: split view

```
Left panel (40%)              Right panel (60%)
─────────────────             ─────────────────────────
Available Buses               Route Breakdown
                              
Bus 07  60 seats  MIXED       Route North
Bus 09  55 seats  GIRLS         Stop 1: Railway Crossing  B:28 G:22
Bus 11  60 seats  BOYS          Stop 2: Bypass Road       B:31 G:19
Bus 12  50 seats  MIXED         Stop 3: College Gate      B:15 G:25
Bus 14  55 seats  BOYS           
Bus 15  60 seats  MIXED       Route South
Bus 17  55 seats  GIRLS         Stop 1: Market            B:40 G:35
                                Stop 2: Hospital Road     B:22 G:18
                                Stop 3: Stadium           B:18 G:12
```

**Left Panel — Bus card shows:**
- Bus number, capacity, gender badge
- Today's runs already assigned (as a mini timeline bar)
- Available time windows (gaps between assigned runs)
- Colour: green if available for this shift's time window, yellow if tight (< 15 min buffer), red if unavailable

**Right Panel — Route/Stop section shows:**
- Total students per route
- Per stop: stop name, boys count (planned vs actual), girls count
- Unassigned student count highlighted in orange
- Already-covered stops shown with which bus covers them

**How assignment works:**

1. Operator clicks a Bus in the left panel. It becomes "selected" (blue highlight).
2. Operator clicks stops in the right panel to add them to this bus.
3. Stops must be added in contiguous sequence order — the system prevents non-contiguous selection with a tooltip: "Stops must be in sequence. Skip between stops is not allowed."
4. As stops are added, the bus card in the left panel updates: occupancy bar fills, student count increases.
5. When happy, operator clicks `Confirm Run` on the selected bus card.
6. Run is saved to DB immediately. Stops are marked as covered.

**Buttons in Daily Planner:**

| Button | Where | What it does |
|--------|--------|--------------|
| `Auto-Plan This Shift` | Top bar | Runs the assignment engine for this shift. Shows preview before saving. |
| `Clear Shift Plan` | Top bar | Removes all Runs for this shift in today's session. Two-step confirm required. |
| `Copy from Yesterday` | Top bar | Copies yesterday's run plan as today's starting point. Useful when nothing has changed. |
| `Confirm Run` | Selected bus card | Saves the current bus+stops selection as a Run. |
| `Edit Run` | Confirmed run (in bus timeline) | Re-opens that run for editing. Removes and recreates. |
| `Remove Run` | Confirmed run | Removes just this run. Stops become unassigned again. |
| `Split Route` | Route header in right panel | Opens a wizard to split one route across 2 buses automatically. |
| `Auto-Plan This Shift` preview → `Approve` | Preview panel | Saves the auto-plan to DB. |
| `Auto-Plan This Shift` preview → `Discard` | Preview panel | Discards preview, returns to manual state. |

**Split Route Wizard:**
When a route has more students than a single bus can carry, the operator can click `Split Route`. The wizard:
1. Shows the route's stops in order with student counts
2. Shows available buses that match the shift's gender mode
3. Automatically suggests a split point (where cumulative count crosses bus capacity)
4. Operator can drag the split point to adjust
5. Preview shows Bus A gets Stops 1-N, Bus B gets Stops N+1-M
6. `Confirm Split` creates both Runs

**Today's session override:**
At the top of the planner, there is a small `Session Overrides` panel (collapsed by default):
- Overload Limit for this shift today: number input (default = shift default)
- Gender Mode today: Combined / Separated / Auto
These are session-level and expire at midnight. They do not change the shift's permanent settings.

---

### 4.6 Assignment Engine

The assignment engine is a **pure function**. It takes data in, returns a proposed plan out. It never writes to the database. The operator reviews the proposal and either approves or discards it.

Input:
```
buses[]           — active buses with capacity and gender
routes[]          — routes with their active stops for this shift
stopConfigs[]     — student counts per stop (actual if API available, planned as fallback)
existingRuns[]    — runs already assigned today (to check bus availability)
config {
  shift           — shift entity with gender_mode and default_overload
  overload_limit  — session override if set, else shift default
  strategy        — LARGEST_ROUTE_FIRST | SMALLEST_ROUTE_FIRST | SEQUENCE_ORDER
  gender_mode     — session override if set, else shift policy
}
```

Output:
```
proposedRuns[] {
  bus_id
  route_id
  direction
  stops[] (in sequence order)
  gender
  student_count
  capacity_used
  overload_used
  warnings[]     — e.g. "Bus 07 will be 94% full"
}
unassignedStops[] {
  stop_id
  reason         — "No bus with sufficient capacity", "No gender-matching bus", etc.
}
summary {
  total_buses_used
  total_students_covered
  total_students_unassigned
  overloaded_runs
  underfilled_runs
}
```

The engine result is shown in the Daily Planner's preview panel before any DB write.

---

### 4.7 Incidents & Conflict Resolution

Any problem that disrupts the day's plan is an Incident. This page manages all incidents.

**Layout:**
- Top: `+ Report Incident` | Filter by type | Filter by status | Filter by date
- Main: Incident list, most recent first

**Incident card shows:**
Type badge | Affected entity | Description | Severity | Status | Time reported | Actions

**Actions per incident:**
| Button | What it does |
|--------|--------------|
| `View Details` | Expands to show full description, affected runs, suggested resolutions |
| `Resolve` | Opens resolution panel. Operator selects or writes the resolution. Status → RESOLVED. |
| `Acknowledge` | Marks as seen but not yet fixed. Status → ACKNOWLEDGED. |
| `Reassign Affected Runs` | Opens the Daily Planner pre-filtered to the affected runs for quick reassignment |

**Adding an Incident (`+ Report Incident`):**

Fields:
- Type (dropdown): Bus Breakdown / Bus Delayed / Driver Absent / Route Blocked / Bus Under Maintenance / Other
- Affected entity: dynamic based on type
  - Bus Breakdown → Bus selector
  - Route Blocked → Route selector + optional Stop selector
  - Driver Absent → Bus selector (driver is implied per bus)
  - Bus Delayed → Bus selector + Run selector + estimated delay in minutes
- Severity: Warning / Critical
- Description (text)
- `Save Incident` button

**Automatic system response on save:**

| Incident Type | System automatically does |
|---------------|--------------------------|
| BUS_BREAKDOWN | Marks bus as unavailable for rest of day. Flags all its today's runs as CANCELLED. Shows affected student count. Suggests available buses that can absorb the stops. |
| BUS_DELAYED | Flags the specific Run as delayed. Calculates new estimated arrival time. If delay causes a chain conflict (bus can't make its next Run in time), escalates to CRITICAL and flags the next Run. |
| DRIVER_ABSENT | Same as BUS_BREAKDOWN for today only. Bus is available again tomorrow. |
| ROUTE_BLOCKED | Marks affected stops as temporarily unavailable. Shows all runs with those stops. Suggests redirecting affected students to nearest alternative stop (based on sequence_order proximity). |
| BUS_MAINTENANCE | Marks bus as unavailable for the date range. Excludes from all scheduling for that range. |

**Conflict detection (automatic, runs continuously):**

The system checks for conflicts every time data changes:
- Run's assigned students exceed bus capacity + overload → CONFLICT: Overloaded
- Bus status changed to MAINTENANCE but has assigned Runs → CONFLICT: Bus unavailable
- StopConfig boys or girls count updated after run was already created → WARNING: Run counts may be stale
- Two Runs assigned to same bus with overlapping time windows → CRITICAL CONFLICT: Schedule collision

Conflicts appear as red badges on the Dashboard alert bar and on affected runs in the timeline.

---

### 4.8 Special Dispatch

One-off trips not tied to any shift. School trips, sports days, emergencies, teacher transport.

**Layout:**
- Top: `+ New Special Dispatch` | Filter by date | Filter by status
- Main: List of special dispatches, sorted by planned departure

**Special Dispatch card shows:**
Name | Bus | Direction | Departure | Return | Status | Passenger count

**Create Special Dispatch:**

Fields:
- Name (e.g. "Museum Trip Grade 6", "Emergency Evacuation")
- Bus (dropdown of available buses — system shows availability warning if bus has a Run near this time)
- Direction: Outbound Only / Inbound Only / Round Trip
- Priority: Normal / Emergency
- Planned Departure (date + time)
- Planned Return (date + time, required for Round Trip)
- Stops/Destinations: add from existing stops OR type a custom address (free text)
  - Per stop: passenger count, notes
- Notes

`Emergency` priority removes all validation — any bus can be selected regardless of schedule conflicts, gender policy, or capacity. A red banner appears: "Emergency mode: all rules suspended."

**Buttons:**
| Button | What it does |
|--------|--------------|
| `Save` | Creates the SpecialRun record. If bus has a schedule conflict, shows a warning (not a block). |
| `Mark Departed` | Sets actual_depart to now. Status → IN_PROGRESS. |
| `Mark Returned` | Sets actual_return to now. Status → COMPLETED. |
| `Cancel` | Status → CANCELLED. Confirmation required. |
| `Duplicate` | Copies this dispatch as a new one with a new date. Useful for recurring events. |

---

### 4.9 Display Board

Full-screen output for a TV or projector. Students look at this to find their bus.

**Opened from:** Dashboard → `Open Display Board`. Always opens in a new, full-screen window.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [School Logo]  School Name              08:47:23   │
│  ─────────────────────────────────────────────────  │
│  [ Morning ] [ Mid ] [ Day ]                        │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Bus 07          │  │  Bus 09          │         │
│  │  Route North     │  │  Route North     │         │
│  │  ● Boys          │  │  ● Girls         │         │
│  │                  │  │                  │         │
│  │  • Railway Cross │  │  • Railway Cross │         │
│  │  • Bypass Road   │  │  • Bypass Road   │         │
│  │  • College Gate  │  │  • College Gate  │         │
│  │                  │  │                  │         │
│  │  Departs: 06:45  │  │  Departs: 06:45  │         │
│  └──────────────────┘  └──────────────────┘         │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐         │
│  │  Bus 11          │  │  Bus 12          │         │
│  │  Route South     │  │  Route South     │         │
│  │  ● Boys          │  │  ● Girls         │         │
│  └──────────────────┘  └──────────────────┘         │
└─────────────────────────────────────────────────────┘
```

**Auto-behavior:**
- Refreshes every 30 seconds (configurable in Settings)
- Shift tabs auto-switch to the upcoming/current shift based on current time
- Runs that have departed are moved to a "Departed" section at the bottom
- Runs that are completed disappear after 10 minutes (configurable)
- If an Incident affects a run, the bus card shows a red banner: "⚠ Delayed" or "⚠ Cancelled"

**Display settings (in Settings panel → Display):**
- Font size: Small / Medium / Large / Extra Large
- Theme: Light / Dark / High Contrast
- Show student counts on board: Yes / No
- Show departure times: Yes / No
- Auto-scroll speed (px/sec)
- Refresh interval (seconds)
- Columns per row: 2 / 3 / 4 / Auto

**No interactive buttons on this screen.** The only exception is the Shift tab selector for when someone needs to switch views.

---

### 4.10 Announcement System

Generate and play Bengali voice announcements for bus departures.

**Layout:**
- Top: Shift selector | Run selector | `Generate All` | `Play All in Sequence`
- Main: List of announcement cards, one per Run

**Each Announcement Card:**
```
┌─────────────────────────────────────────────────────┐
│  Bus 07  •  Route North  •  Boys  •  Inbound        │
│                                                     │
│  বাস নম্বর সাত, রুট নর্থের ছাত্রদের জন্য,          │
│  গেইট ১ এ অনুগ্রহ করে আসুন।                       │
│                               [Edit Text]           │
│                                                     │
│  Gate: [Gate 1     ▼]                               │
│                                                     │
│  [ ▶ Play ]  [ 🔁 Re-generate ]  [ 📥 Export ]     │
│                                                     │
│  Status: ✓ Audio ready  (ElevenLabs, cached)        │
└─────────────────────────────────────────────────────┘
```

**Buttons:**
| Button | What it does |
|--------|--------------|
| `Generate All` | Generates audio for all runs in this shift. Shows progress bar. |
| `Play All in Sequence` | Plays each announcement in order with a configurable pause between them. A `Stop` button appears while playing. |
| `▶ Play` | Plays this specific announcement immediately. |
| `🔁 Re-generate` | Regenerates audio (useful after editing text). |
| `📥 Export` | Saves the audio file to a user-chosen folder. |
| `Edit Text` | Makes the Bengali text editable inline. Text changes are local until `Re-generate` is clicked. |
| `Schedule Auto-Play` | Sets a time for this announcement to play automatically. System plays it at that time even without operator action. |

**Announcement text template** (configured in Settings → Announcements):
```
বাস নম্বর {bus_number}, {route_name} রুটের {gender_label} শিক্ষার্থীরা,
অনুগ্রহ করে {gate} এ আসুন।
```

Template variables: `{bus_number}`, `{route_name}`, `{gender_label}`, `{gate}`, `{shift_name}`, `{depart_time}`

**Gender label values** (configurable in Settings):
- BOYS → "ছাত্রদের" (default) or custom
- GIRLS → "ছাত্রীদের" (default) or custom
- MIXED → "শিক্ষার্থীদের" (default) or custom

**TTS engine** (set in Settings → Announcements):
1. ElevenLabs API (requires API key) — high quality
2. System TTS (offline) — lower quality, always available

Fallback: if ElevenLabs fails, automatically use System TTS. Show a warning badge on affected cards: "Used system TTS (ElevenLabs unavailable)."

Audio caching: generated audio files are stored locally. If the same text is requested again, the cached file is used. Cache key = SHA256 of the announcement text. If text changes, new file is generated.

**Auto-play scheduling:**
In Settings → Announcements, you can configure: "Play announcements N minutes before each shift's departure time." The system will automatically play all announcements for a shift without any operator action. This can be enabled/disabled per shift.

---

### 4.11 Reports & Print

Generate printable driver sheets and exportable data.

**Layout:**
- Top: Date selector | Shift selector | Format selector | `Print` | `Export PDF` | `Export Excel`
- Main: Live preview of the output

**Driver Sheet format (A4 print):**
- Header: School logo | School name | Shift name | Date | Inbound/Outbound
- One section per Run, sorted by bus number
- Each section:
  ```
  Bus 07    |  Route North  |  Boys  |  60 seats / 52 assigned
  ──────────────────────────────────────────────────────────
  1. Railway Crossing     Boys: 28   Girls: —   Total: 28
  2. Bypass Road          Boys: 15   Girls: —   Total: 15
  3. College Gate         Boys: 9    Girls: —   Total: 9
  ─────────────────────────────────────
  Total: 52 students     Departs: 06:45
  ```

**Export formats:**
- PDF: one file, one sheet per shift
- Excel: one workbook, one sheet per shift, columns: Bus | Route | Stop | Boys | Girls | Total | Departure Time
- Historical: date selector allows any past session

**Historical note banner:**
When viewing a past date: "Viewing session from [date] — this is historical data. Read only."

---

### 4.12 Settings

All configurable values. Organized into sections. Nothing is hardcoded in application logic.

**Navigation:** Settings icon in main sidebar → Settings page with section tabs.

---

#### Section 1: School

| Setting | Type | Description |
|---------|------|-------------|
| School name | Text | Shown on display board, print headers |
| School name (Bengali) | Text | Bengali version |
| Logo | Image upload | Shown on display board, print headers |
| Gates | List | Named gates (e.g. "Gate 1", "Gate 2", "Main Gate"). Used in announcements. |
| Academic year start | Date | For report grouping |

---

#### Section 2: Shifts

Table of all shifts. Columns: Name | Bengali Name | Sort Order | Active | Edit | Delete (if no assignments)

`+ Add Shift` button: creates a new shift with a UUID. Fill in name and time fields.

Editing a shift opens the full Shift Management page (4.4) for that shift.

---

#### Section 3: Assignment Defaults

These are system-wide defaults. Shift-level settings override these per shift.

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| Default overload per bus | `system.default_overload` | Integer | 10 |
| Minimum bus fill % | `system.min_fill_pct` | Integer | 70 |
| Minimum turnaround between runs | `system.min_turnaround_min` | Integer | 15 |
| Default assignment strategy | `system.assignment_strategy` | Enum | LARGEST_ROUTE_FIRST |
| Default gender mode | `system.gender_mode` | Enum | COMBINED |

---

#### Section 4: Display Board

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| Refresh interval | `display.refresh_sec` | Integer | 30 |
| Font size | `display.font_size` | Enum S/M/L/XL | M |
| Theme | `display.theme` | Enum | LIGHT |
| Show student counts | `display.show_counts` | Boolean | true |
| Show departure times | `display.show_times` | Boolean | true |
| Auto-scroll speed | `display.scroll_px_s` | Integer | 30 |
| Columns layout | `display.columns` | Enum 2/3/4/Auto | Auto |
| Completed run visible for (minutes) | `display.completed_visible_min` | Integer | 10 |

---

#### Section 5: Announcements

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| TTS engine | `tts.engine` | Enum | SYSTEM |
| ElevenLabs API key | `tts.elevenlabs_key` | String (masked) | — |
| ElevenLabs voice ID | `tts.elevenlabs_voice` | String | — |
| Announcement template (Bengali) | `tts.template_bn` | Multiline text | (see 4.10) |
| Boys gender label | `tts.label_boys` | Text | ছাত্রদের |
| Girls gender label | `tts.label_girls` | Text | ছাত্রীদের |
| Mixed gender label | `tts.label_mixed` | Text | শিক্ষার্থীদের |
| Pause between announcements | `tts.pause_ms` | Integer | 2000 |
| Auto-play before departure (min) | `tts.autoplay_before_min` | Integer | 15 |
| Cache audio files | `tts.cache_audio` | Boolean | true |
| Audio output folder | `tts.output_folder` | Path | system temp |

`Test Connection` button next to ElevenLabs API key: sends a test phrase and shows "Connected ✓" or the error.

---

#### Section 6: Attendance API

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| API endpoint URL | `attendance.api_url` | URL | — |
| API key | `attendance.api_key` | String (masked) | — |
| Fetch interval (minutes) | `attendance.fetch_interval_min` | Integer | 5 |
| Use for outbound runs | `attendance.use_outbound` | Boolean | true |
| Use for inbound runs | `attendance.use_inbound` | Boolean | false |
| Fallback behavior | `attendance.fallback` | Enum | USE_PLANNED |

`Test Connection` button: pings the API and shows status and sample response.

Note on `use_inbound`: inbound runs (stops → school) happen before students arrive, so attendance is unknown. Default is false — use planned counts for inbound. Outbound runs (school → stops) use live attendance because students are already at school and counted.

---

#### Section 7: Feature Toggles (Discord-style)

Per-feature, three states: **Always On** / **Default (follow context)** / **Always Off**

| Feature | States | Default |
|---------|--------|---------|
| Attendance API | Always Use / Use if Available / Always Use Planned | Use if Available |
| Auto-announcements | Always Generate / Generate if Configured / Disabled | Generate if Configured |
| Conflict detection | Always On / On / Disabled | On |
| Overload warnings | Always Warn / Warn if Exceeded / Silent | Warn if Exceeded |
| Underfill warnings | Enabled / Disabled | Enabled |
| Schedule optimization hints | Enabled / Disabled | Enabled |
| Audit logging | Always On / — / — | Always On (cannot disable) |

---

#### Section 8: Data Management

All destructive operations are in this section. All require explicit confirmation.

| Button | Action | Confirmation type |
|--------|--------|-------------------|
| `Export Full Backup` | Exports all data as JSON. Non-destructive. | None |
| `Import from Backup` | Merges a backup file into current data. | "Confirm import" dialog |
| `Reset Today's Assignments` | Removes all Runs for today's open session. Routes, buses, stops untouched. | Type `RESET TODAY` |
| `Reset All Assignments` | Removes ALL Runs from ALL sessions. Everything else untouched. | Type `RESET ASSIGNMENTS` |
| `Factory Reset` | Removes everything. | Type `FACTORY RESET` + tick "I understand this cannot be undone" |
| `Clean Old Sessions` | Removes sessions older than N months. N is configurable. | "Remove [N] sessions from before [date]?" dialog |

---

#### Section 9: Application

| Setting | Key | Type | Default |
|---------|-----|------|---------|
| Database path | `app.db_path` | Path | userData directory |
| Audio cache path | `app.audio_cache_path` | Path | userData/audio |
| Application language | `app.language` | Enum EN/BN | EN |
| Auto-lock session at | `app.session_lock_time` | Time or OFF | OFF |
| Show audit log in navigation | `app.show_audit_log` | Boolean | true |
| Developer tools shortcut | `app.devtools_enabled` | Boolean | false |
| Check for updates | `app.check_updates` | Boolean | true |

---

### 4.13 Audit Log

An immutable record of every change. Cannot be edited. Cannot be deleted. Ever.

**Layout:**
- Top: Date range filter | Entity type filter | Action filter | Search | `Export Log`
- Main: Table, newest first, paginated at 100 per page

**Table columns:**
Timestamp | Action | Entity Type | Entity | Field | Old Value | New Value | Triggered By

**Examples of log entries:**
```
2026-03-15 06:32:11  UPDATE   Bus         Bus 07   capacity     60 → 55         OPERATOR
2026-03-15 06:45:22  CREATE   Run         Run#381  (new run)    —               OPERATOR
2026-03-15 07:12:08  CREATE   Incident    Inc#22   bus_breakdown Bus 09         OPERATOR
2026-03-15 07:12:09  UPDATE   Run         Run#382  status       SCHEDULED→CANCELLED  SYSTEM
2026-03-15 07:15:33  UPDATE   StopConfig  Stop#14  planned_boys 28 → 31        OPERATOR
2026-03-15 11:48:02  UPDATE   Session     2026-03-15 status    OPEN → LOCKED   OPERATOR
2026-03-15 14:02:17  CREATE   AttendanceRecord Stop#14 actual_boys 24          API
```

`Export Log` exports the filtered view as `.xlsx`.

---

## 5. Assignment Engine — Rules & Logic

The engine is a pure function. It has no side effects.

### 5.1 Strategies

**LARGEST_ROUTE_FIRST (default)**
Process routes in descending order of total student count. Ensures the biggest demand gets served before smaller ones.

**SMALLEST_ROUTE_FIRST**
Process routes ascending. Ensures smaller routes get dedicated buses before large routes consume the fleet.

**SEQUENCE_ORDER**
Process routes in the order they are defined in the system (route sort_order). Full manual control.

### 5.2 Assignment Steps (per route, in strategy order)

1. Get all active stops for this route in this shift, sorted by sequence_order.
2. Get student count per stop (actual from attendance if available, else planned).
3. Apply gender mode (see Section 6).
4. For each gender group of stops:
   a. Try to fit all stops into one bus. If they fit: assign all stops to one bus.
   b. If they don't fit: find the optimal split point — the last stop that keeps the first bus under capacity. The second bus takes the remaining stops.
   c. If two buses aren't enough: split further. Each segment must be contiguous.
5. Prefer buses that match the required gender. If none available with right gender, flag as warning and suggest MIXED bus.
6. A bus already used for another route in this run cannot be reused. (One bus = one route per run.)

### 5.3 Bus Availability Check

A bus is available for a Run if:
- `bus.status = ACTIVE`
- No other Run is assigned to this bus with an overlapping time window
- Time window check: `proposed_run.depart > existing_run.planned_return + min_turnaround`
- No open BUS_BREAKDOWN or DRIVER_ABSENT incident for today

### 5.4 Contiguous Stop Rule

Stops assigned to a bus must be contiguous by sequence_order within their route. If Bus A has stops 1, 2, 3 and Bus B has stops 4, 5, 6 — that is valid. If Bus A has stops 1, 3, 5 — that is invalid and the engine will never produce this. Students at stop 3 should not see their bus skip stop 2.

### 5.5 Overload Rules

- Overload = extra students allowed beyond `bus.capacity`
- Value resolution: session override → shift default → system default
- A bus at capacity + overload is flagged as OVERLOADED in the output summary but assignment is still created
- Setting overload to 0 enforces strict capacity

### 5.6 Underfill Rule

If a bus is assigned but will be less than `min_fill_pct` % full, it is flagged as UNDERFILLED in the output summary. This is a warning, not a block. The operator may choose to merge it with another bus or accept the waste.

---

## 6. Gender Separation Logic

Gender mode is set at the Shift level. Three modes:

### COMBINED
Boys and girls ride the same bus. The engine treats all students at a stop as one count (boys + girls). Bus gender designation is ignored.

### SEPARATED
Boys and girls are always on different buses. For each route, the engine creates two sets of stops — one for boys, one for girls — and assigns them to buses matching those genders. For a route with 3 stops, this results in Bus A serving stops 1-3 for boys, Bus B serving stops 1-3 for girls. Both buses visit the same stops but carry different passengers.

If the boys count at all stops of a route is zero: no boys bus is created for that route.
If the girls count at all stops of a route is zero: no girls bus is created for that route.

**Minimum threshold rule:** If one gender's total count across a route is below `system.gender_min_threshold` (default: 5 students), the engine does not create a dedicated bus for that gender. Instead it flags: "Only N girls on Route X. Recommend combining with boys bus. Override?" The operator can confirm or override.

### AUTO
The engine tries SEPARATED mode first. If it cannot satisfy all students in SEPARATED mode (not enough gender-matching buses), it falls back to COMBINED mode and logs: "Insufficient gender-specific fleet. Switched to COMBINED for [route]."

### Bus Gender vs Shift Gender Mode

| Shift Gender Mode | Bus Gender | Result |
|-------------------|------------|--------|
| COMBINED | Any | Bus can carry both genders |
| SEPARATED | BOYS | Can only carry boys |
| SEPARATED | GIRLS | Can only carry girls |
| SEPARATED | MIXED | Can carry either gender, but only one gender per run |
| AUTO | Any | Resolved as above based on fleet availability |

---

## 7. Attendance Integration

### 7.1 How it works

The school has an attendance API. Students arrive at school and are marked present. This gives the system a live count of exactly how many students from each stop are at school today.

This is used for **outbound runs only** (school → stops). For inbound runs (stops → school), students haven't been counted yet, so planned counts are used.

### 7.2 Data flow

1. Operator creates today's session.
2. System starts polling the attendance API at the configured interval (default: 5 minutes).
3. API response maps students to their stops and shifts.
4. System stores the response as `AttendanceRecord` per stop per shift.
5. Daily Planner shows actual counts alongside planned counts for outbound planning.
6. Assignment engine uses actual counts when creating outbound Runs.

### 7.3 When API is unavailable

- System falls back to `planned_count` from StopConfig.
- Yellow warning banner on Dashboard and Daily Planner: "Attendance API unavailable. Using planned student counts."
- The operator can manually override counts per stop via the Daily Planner's `Session Overrides` panel.
- The AttendanceRecord is saved with `source = PLANNED_FALLBACK` so the audit log reflects this.

### 7.4 API contract

The system expects the attendance API to return:
```json
{
  "date": "2026-03-15",
  "shift_id": "<external-id>",
  "stops": [
    {
      "stop_external_id": "<id>",
      "boys_present": 24,
      "girls_present": 18
    }
  ]
}
```

The mapping between the school's `stop_external_id` and the system's Stop UUID is configured in Settings → Attendance API → Stop Mapping. This is a table: External ID ↔ Internal Stop. This mapping is set up once and doesn't change unless the school changes their system.

---

## 8. Incident System

Incidents are the system's response to anything going wrong. An incident is always linked to a specific affected entity and creates a documented resolution trail.

### 8.1 Incident lifecycle

```
Reported → [OPEN] → Acknowledged → [ACKNOWLEDGED] → Resolved → [RESOLVED]
                                                   ↗
                    Or directly: Reported → Resolved
```

### 8.2 What the system does per incident type

**BUS_BREAKDOWN**
- Bus marked unavailable for rest of day
- All this bus's remaining Runs set to CANCELLED
- Affected student count calculated
- Suggestion shown: "N students affected. Available buses with capacity: Bus 14 (8 seats free), Bus 15 (12 seats free). Reassign?"
- Operator can one-click reassign to a suggested bus or open the planner for full control

**BUS_DELAYED**
- Specific Run flagged as DELAYED
- New estimated arrival calculated: `planned_return + delay_minutes`
- If new estimated return time conflicts with this bus's next Run:
  - Chain conflict raised: "Bus 07 cannot complete Run#382 before Run#385 departs. Cascade conflict."
  - Operator must resolve the downstream Run manually or cancel it
- Display Board shows "⚠ Delayed" on affected bus card

**DRIVER_ABSENT**
- Same as BUS_BREAKDOWN for today
- Bus status unchanged in permanent records (the bus is fine, the driver is absent)
- Tomorrow the bus is automatically available again

**ROUTE_BLOCKED**
- Specific stops marked temporarily unavailable
- All Runs with those stops flagged
- System suggests: nearest alternate stop by sequence_order ("Redirect Stop 3 students to Stop 2 or Stop 4?")
- Operator chooses alternate or cancels those stops from today's runs

**BUS_MAINTENANCE (date range)**
- Bus excluded from scheduling for the entire date range
- On `maintenance_until` date: bus automatically returns to ACTIVE status
- Any Runs already scheduled for that bus during maintenance range are flagged as conflicts

---

## 9. Settings Architecture

### Three scopes, one resolution order

Every setting can exist at three scopes. The most specific scope wins.

```
Session override   (today only, expires at midnight)
      ↓ overrides
Shift policy       (permanent per shift)
      ↓ overrides
System default     (permanent, fallback for everything)
```

**Example:** Default overload is 10 (system). Morning shift overload is 27 (shift policy). Today the operator sets Morning overload to 35 because of exams (session override). The engine uses 35.

In the UI, wherever a setting is displayed, a small badge shows which scope is active:
- `System` (grey) — using system default
- `Shift` (blue) — using shift policy
- `Today` (orange) — using session override

Changing a session override does not change the shift policy or system default. When the session ends, the override expires.

### Discord-style feature toggles

For features that are on/off decisions, three states:

- **Always On** — feature is forced on regardless of any other condition
- **Default** — feature follows its natural logic (e.g. "use attendance API if it's available")
- **Always Off** — feature is forced off regardless of any other condition

These are set at the system level in Settings → Feature Toggles. They can also be set per-shift in Shift Management → Tab 4: Overrides, where they override the system-level toggle for that shift only.

---

## 10. Future-Proofing Contracts

These are architectural decisions that must never be broken. Any future developer adding a feature must respect these.

### Adding a new Shift
1. Settings → Shifts → `+ Add Shift`
2. Fill in name, Bengali name, time fields, gender mode
3. Configure its stops via Shift Management → Stop Configuration

Zero code changes. The new shift appears in all dropdowns, tabs, and the engine automatically.

### Adding a new Route
Route & Stop Management → `+ Add Route`. Configure stops. Go to each relevant shift's Stop Configuration and activate the stops with student counts.

Zero code changes.

### Renaming anything
- Rename a bus: change `bus.number`. All Run records still point to the bus UUID. History intact.
- Rename a route: change `route.name`. All Stop records still point to the route UUID. All RunStop records point to Stop UUIDs.
- Rename a stop: change `stop.name`. Updates immediately everywhere because it's one record.
- Rename a shift: change `shift.name`. All StopConfig and Run records still point to the shift UUID.

Nothing breaks. Nothing becomes orphaned. Rename freely.

### Adding a new Assignment Strategy
The engine's strategy is a named function behind an interface:
```
strategy(routes, buses, config) → assignmentOrder[]
```
Adding a new strategy: write the function, add its name to the `system.assignment_strategy` dropdown options.

### Adding a new TTS Engine
All TTS engines implement:
```
generateAudio(text: string, options: TTSOptions) → Promise<FilePath>
```
Add the implementation, add it to the `tts.engine` dropdown.

### Adding a new Incident Type
Add the new type to the `Incident.type` enum definition. Add its handling logic to the incident response handler. The rest of the system (audit log, dashboard, conflict detection) handles it automatically because they operate on generic Incident entities.

### Changing the attendance API provider
The system is decoupled from the specific API through the `stop_external_id` mapping table. Changing providers means:
1. Update the API URL and key in Settings
2. Update the stop mapping table if IDs changed

No code changes unless the response format changes.

---

## 11. Error States & Edge Cases

| Scenario | System Behaviour |
|----------|-----------------|
| No buses in fleet | Dashboard onboarding card: "Add your first bus →" |
| No routes configured | Shift assignment pages show: "No routes found. Go to Route & Stop Management →" |
| Stop has 0 students for both genders | Stop shown in configuration but with a warning badge: "No students configured" |
| All buses at capacity after optimization | Engine output shows: "X students could not be assigned. Increase overload limit or add buses." Unassigned stops listed. |
| Attendance API returns data for unknown stop external ID | Logged as warning in audit log. Count ignored. Admin notified via Settings → Attendance API status page. |
| Attendance API returns zero for all stops | System treats as API error and falls back to planned counts. Does not zero out all assignments. |
| Bus assigned to Run is put in maintenance for today | Conflict raised immediately: "Bus 07 is now in maintenance but has 2 runs today." Dashboard alert. |
| Same bus assigned to two overlapping runs | CRITICAL conflict raised. One of the runs must be reassigned. System blocks saving the second Run if the conflict is clear at creation time. |
| Route has no active stops in a shift | Route is excluded from this shift's assignment. It appears in the planner with a grey "No active stops" badge. |
| Stop deactivated while it has an active RunStop for today | CONFLICT raised. The run is not cancelled automatically. Operator is notified and must decide. |
| Session is locked but operator tries to edit | All edit buttons disabled. Lock badge on page header. A banner reads: "Session locked — [date]. To unlock, go to Settings → Data Management → Unlock Session." Unlock requires typing "UNLOCK [date]". |
| Import Excel with unrecognised shift name in StopConfig import | Row skipped. Import report shows: "Row 14: shift 'Evening' not found — skipped." |
| Two stops in same route with same name | Prevented at data entry. "A stop named [X] already exists on this route." |
| Database file not found at startup | Recovery dialog: "Database not found at [path]. [Create New Database] [Choose Different Path] [Restore from Backup]" |
| Database file corrupted | Recovery dialog with same options, plus: "The file at [path] appears to be corrupted. Do not overwrite it — it may be repairable." |
| Special dispatch bus conflicts with a regular Run | Warning shown (not a block for NORMAL priority). Block shown for conflicting time but overrideable. For EMERGENCY priority: no block, always allow. |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Run** | The atomic unit of the system. One bus, one direction (inbound or outbound), one set of stops, one departure time, one date. |
| **Session** | One calendar day. All Runs, Incidents, and attendance data for that day belong to its Session. |
| **Shift** | A time contract: when buses must depart, when students must arrive, and whether buses are gender-separated. Shifts don't own routes. |
| **Route** | A permanent geographic path with stops on it. Not owned by any shift. Reused across all shifts. |
| **Stop** | A fixed pickup/drop-off location on a Route. Has a sequence order. |
| **StopConfig** | The per-shift configuration for a Stop. Is this stop active in this shift? How many boys and girls travel from here in this shift? |
| **RunStop** | Which specific stops are served by a Run, in what order, with how many students. |
| **Inbound** | Direction: stops → school. Buses go to stops and bring students to school. |
| **Outbound** | Direction: school → stops. Buses carry students from school to their stops. |
| **Overload** | Extra students allowed beyond a bus's nominal capacity. Set as a number (e.g. 10 = 10 extra students allowed). |
| **Special Dispatch** | A one-off trip not tied to any shift. School trips, events, emergencies. |
| **Incident** | A documented problem affecting a Bus, Route, or Run. Has a lifecycle and resolution. |
| **AttendanceRecord** | Live student counts per stop per shift from the school's attendance API, stored locally for the session. |
| **StopConfig** | Per-shift configuration of a stop: active flag, planned boys count, planned girls count. |
| **Gender Mode** | Shift-level policy: COMBINED (boys+girls share buses), SEPARATED (must be on different buses), AUTO (system decides). |
| **Assignment Engine** | A pure function that takes buses, stops, and config and proposes a Run plan. Has no side effects. Never writes to DB. |
| **Three-scope settings** | Settings exist at: System default (permanent fallback) → Shift policy (permanent per shift) → Session override (today only). Most specific wins. |
| **Contiguous stops rule** | Stops assigned to a bus must be consecutive in sequence order. No skipping stops. |
| **Soft delete** | Deactivating a record rather than permanently deleting it. All deactivations in this system are soft. Historical records are always preserved. |
| **UUID** | Universally Unique Identifier. Used as the primary key for every entity. Never based on names. Stable forever. |