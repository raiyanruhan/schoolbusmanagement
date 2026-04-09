## ⚡ Core

* **Electron** (latest stable)

---

## 🧠 Frontend (Renderer)

* **React**
* **TypeScript**

👉 Why:

* Your UI is **dashboard-heavy + state-heavy**
* TypeScript will **save you from logic bugs** (VERY important for Runs, Sessions)

---

## 🎨 UI System

* **Tailwind CSS**
* **shadcn/ui**

👉 Needed because:

* Display Board
* Planner drag UI
* Tables (Fleet, Audit Log)
* Modals (Incidents)

---

## 🧠 State Management

* **Zustand**

👉 Why NOT Redux:

* You don’t need global complexity
* Zustand is simple and fast

Use Zustand for:

* Current session
* Selected shift
* Planner state
* UI states (modals, filters)

---

## 💾 Database Layer (CRITICAL)

### DB Engine:

* **SQLite**

### Driver:

* **better-sqlite3**

👉 Why:

* Sync (important for Electron)
* Extremely fast
* Reliable for long-term storage

---

## 🧬 ORM / Query Layer (IMPORTANT DECISION)

### ✅ BEST CHOICE:

* **Drizzle ORM**

👉 Why Drizzle (not Prisma):

* Works perfectly with SQLite
* Fully type-safe
* No heavy runtime
* Long-term maintainable

👉 Your system has:

* Many joins (Run ↔ Stop ↔ Session)
* Strong typing needed

Drizzle fits perfectly.

---

## 🔌 Electron Architecture (VERY IMPORTANT)

### Use:

* **Context Bridge (secure IPC)**

Structure:

```
main/
  db/
  services/
  engine/
  ipc/
preload/
renderer/
```

---

## 🧠 Business Logic Layer (YOUR CORE POWER)

Split logic into:

```
/engine
  assignmentEngine.ts
  genderLogic.ts
  conflictDetector.ts
  incidentHandler.ts
```

👉 Rules:

* PURE functions
* No DB calls inside engine
* Input → Output only

This matches your PRD exactly.

---

## 🔄 Data Access Layer

```
/repositories
  busRepo.ts
  runRepo.ts
  stopRepo.ts
  sessionRepo.ts
```

👉 NEVER call DB directly from UI.

---

## 📡 IPC Layer

```
/ipc
  bus.ipc.ts
  run.ipc.ts
  planner.ipc.ts
```

Frontend → IPC → Service → DB

---

## ⚙️ Build Tool

* **Vite**

👉 Fast + modern + works well with Electron

---

## 📦 Packaging

* **electron-builder**

---

## 🔊 Audio System

* Native HTML Audio (renderer)
* Optional:

  * **ElevenLabs** API

---

## 📊 Tables / Heavy UI

* **TanStack Table**

👉 Needed for:

* Audit Log (huge data)
* Fleet table
* Reports

---

## 🧪 Validation

* **Zod**

👉 For:

* Form validation
* IPC data validation
* Settings validation

---

# 🧱 FINAL STACK (CLEAN VERSION)

```
Electron
React + TypeScript
Tailwind CSS + shadcn/ui
Zustand
SQLite + better-sqlite3
Drizzle ORM
Vite
electron-builder
Zod
TanStack Table
```

---

# 🧠 ARCHITECTURE (THIS IS YOUR REAL POWER)

### Follow this strictly:

```
UI (React)
   ↓
State (Zustand)
   ↓
IPC (secure bridge)
   ↓
Service Layer
   ↓
Engine (pure logic)
   ↓
Repository (DB)
   ↓
SQLite
```

---

# ⚠️ CRITICAL RULES (DON’T BREAK THESE)

### 1. Engine must be pure

Your Assignment Engine:

* ❌ No DB
* ❌ No UI
* ✅ Only logic

---

### 2. Never mix UI + Logic

Bad:

```js
if (bus.capacity < students) { ... }
```

Good:

```ts
engine.assignRuns(...)
```

---

### 3. Audit log must be automatic

Every DB write → log entry
(no manual logging)

---

### 4. Use UUID everywhere

Already in your PRD — keep it.

---

### 5. Offline-first always

* No required internet
* API = optional

---