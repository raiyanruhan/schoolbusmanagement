import { useEffect, useState, useCallback } from "react";
import type {
  Bus,
  Route,
  Shift,
  RouteWithStops,
  Run,
  StopConfig,
  EngineOutput,
  ProposedRun,
  AssignmentStrategy,
  RunDirection,
  Conflict,
} from "../../shared/types";
import { useSessionStore } from "../store/sessionStore";
import { usePlannerStore } from "../store/plannerStore";
import { useUiStore } from "../store/uiStore";
import {
  Bus as BusIcon,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Zap,
  Users,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  ActionMenu,
  ActionList,
  Button,
  Text,
  Heading,
  Label,
  Spinner,
  Flash,
  IconButton,
} from "@primer/react";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import TopBar from "../components/ui/TopBar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function busStatusBorderColor(status: string): string {
  if (status === "ACTIVE") return "var(--borderColor-success-emphasis)";
  if (status === "MAINTENANCE") return "var(--borderColor-attention-emphasis)";
  return "var(--borderColor-default)";
}

// ─── Run Card ─────────────────────────────────────────────────────────────────

function RunCard({
  run,
  buses,
  routes,
  shifts,
  conflicts,
  onDelete,
}: {
  run: Run;
  buses: Bus[];
  routes: Route[];
  shifts: Shift[];
  conflicts: Conflict[];
  onDelete: (id: string) => void;
}) {
  const bus = buses.find((b) => b.id === run.bus_id);
  const route = routes.find((r) => r.id === run.route_id);
  const shift = shifts.find((s) => s.id === run.shift_id);
  const runConflicts = conflicts.filter(
    (c) => c.run_id === run.id || (c.bus_id === run.bus_id && !c.run_id),
  );
  const hasCritical = runConflicts.some((c) => c.severity === "CRITICAL");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: 16,
        border: `1px solid ${hasCritical ? "var(--borderColor-danger-emphasis)" : runConflicts.length > 0 ? "var(--borderColor-attention-emphasis)" : "var(--borderColor-default)"}`,
        borderRadius: 6,
        background: hasCritical
          ? "var(--bgColor-danger-muted)"
          : runConflicts.length > 0
            ? "var(--bgColor-attention-muted)"
            : "var(--bgColor-muted)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: hasCritical ? "var(--bgColor-danger-muted)" : "var(--bgColor-accent-muted)",
          color: hasCritical ? "var(--fgColor-danger)" : "var(--fgColor-accent)",
        }}
      >
        <BusIcon size={20} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
            {bus?.number ?? "—"}
          </Text>
          <ChevronRight size={12} />
          <Text
            sx={{
              fontSize: 1,
              color: "fg.muted",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {route?.name ?? "—"}
          </Text>
          {runConflicts.length > 0 && (
            <Label
              variant={hasCritical ? "danger" : "attention"}
              sx={{ ml: "auto", flexShrink: 0 }}
            >
              ⚠ {hasCritical ? "Conflict" : "Warning"}
            </Label>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>
            {shift?.name ?? "—"}
          </Text>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>•</Text>
          <Text
            sx={{
              fontSize: 0,
              fontWeight: "medium",
              color: run.direction === "OUTBOUND" ? "attention.fg" : "accent.fg",
            }}
          >
            {run.direction === "OUTBOUND" ? (
              <>
                <ArrowRight size={10} style={{ display: "inline" }} /> Outbound
              </>
            ) : (
              <>
                <ArrowLeft size={10} style={{ display: "inline" }} /> Inbound
              </>
            )}
          </Text>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>•</Text>
          <Label variant="secondary">{run.status}</Label>
        </div>
        {runConflicts.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {runConflicts.map((c, i) => (
              <Text
                key={i}
                as="p"
                sx={{
                  fontSize: 0,
                  color: hasCritical ? "danger.fg" : "attention.fg",
                  m: 0,
                }}
              >
                {c.message}
              </Text>
            ))}
          </div>
        )}
      </div>

      <IconButton
        icon={Trash2}
        aria-label="Delete run"
        variant="invisible"
        size="small"
        onClick={() => onDelete(run.id)}
        sx={{ color: "danger.fg", flexShrink: 0 }}
      />
    </div>
  );
}

// ─── Capacity Bar ─────────────────────────────────────────────────────────────

function CapacityBar({
  used,
  capacity,
  overload,
}: {
  used: number;
  capacity: number;
  overload: number;
}) {
  const max = capacity + overload;
  const pct = Math.min((used / Math.max(max, 1)) * 100, 100);
  const overPct =
    capacity > 0 ? Math.min((capacity / Math.max(max, 1)) * 100, 100) : 100;
  const isOver = used > capacity;
  const isWay = used > max;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <Text
          sx={{
            fontSize: 0,
            color: isOver ? "attention.fg" : "fg.muted",
            fontWeight: isOver ? "semibold" : "normal",
          }}
        >
          {used} / {capacity} students{" "}
          {isOver && `(+${used - capacity} overload)`}
        </Text>
        {isWay && (
          <Text
            sx={{
              fontSize: 0,
              color: "danger.fg",
              fontWeight: "semibold",
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <AlertTriangle size={12} /> Exceeds limit
          </Text>
        )}
      </div>
      <div
        style={{
          height: 8,
          background: "rgba(0,0,0,0.1)",
          borderRadius: 9999,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: isWay
              ? "var(--bgColor-danger-emphasis)"
              : isOver
                ? "var(--bgColor-attention-emphasis)"
                : "var(--bgColor-success-emphasis)",
            width: `${pct}%`,
            transition: "width 0.2s",
          }}
        />
        {overload > 0 && (
          <div
            style={{
              position: "absolute",
              top: 0,
              height: "100%",
              borderRight: "2px dashed var(--fgColor-muted)",
              left: `${overPct}%`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Proposed Run Card ────────────────────────────────────────────────────────

function ProposedRunCard({ pr, buses }: { pr: ProposedRun; buses: Bus[] }) {
  const [expanded, setExpanded] = useState(false);
  const bus = buses.find((b) => b.id === pr.bus_id);
  const genderVariant: Record<string, "accent" | "done" | "sponsors"> = {
    BOYS: "accent",
    GIRLS: "sponsors",
    MIXED: "done",
  };
  const pct = Math.min(
    (pr.totalStudents / (pr.capacity + pr.overload_limit)) * 100,
    100,
  );
  const isOver = pr.totalStudents > pr.capacity;

  return (
    <div
      style={{
        border: `2px solid ${pr.isOverloaded ? "var(--borderColor-attention-emphasis)" : "var(--borderColor-default)"}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 16,
          }}
        >
          <div>
            <Text sx={{ fontWeight: "bold", fontSize: 2 }}>
              {bus?.number ?? pr.bus_number}
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: pr.route_color,
                }}
              />
              <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                {pr.route_name}
              </Text>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 4,
            }}
          >
            <Label variant={genderVariant[pr.gender] ?? "secondary"}>
              {pr.gender}
            </Label>
            <Label
              variant={pr.direction === "OUTBOUND" ? "attention" : "accent"}
            >
              {pr.direction}
            </Label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <Text
              sx={{
                fontSize: 0,
                color: isOver ? "attention.fg" : "fg.muted",
                fontWeight: isOver ? "semibold" : "normal",
              }}
            >
              {pr.totalStudents} / {pr.capacity} students
              {isOver && ` (+${pr.totalStudents - pr.capacity} over)`}
            </Text>
          </div>
          <div
            style={{
              height: 8,
              background: "rgba(0,0,0,0.1)",
              borderRadius: 9999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                borderRadius: 9999,
                background: pr.isOverloaded
                  ? "var(--bgColor-danger-emphasis)"
                  : isOver
                    ? "var(--bgColor-attention-emphasis)"
                    : "var(--bgColor-success-emphasis)",
                width: `${pct}%`,
              }}
            />
          </div>
        </div>

        {pr.warnings.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 16 }}>
            {pr.warnings.map((w, i) => (
              <Label
                key={i}
                variant={w.severity === "CRITICAL" ? "danger" : "attention"}
              >
                {w.type.replace("_", " ")}
              </Label>
            ))}
          </div>
        )}

        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--fgColor-muted)",
            fontSize: 12,
            padding: 0,
          }}
        >
          <Text sx={{ fontSize: 0 }}>
            {pr.stops.length} stop{pr.stops.length !== 1 ? "s" : ""}
          </Text>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {expanded && (
          <div style={{ marginTop: 8 }}>
            {pr.stops.map((s, i) => (
              <div
                key={s.stop_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  borderTop: "1px solid var(--borderColor-muted)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    color: "var(--fgColor-muted)",
                  }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--bgColor-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                  </div>
                  <Text sx={{ fontSize: 0 }}>{s.stop_name}</Text>
                </div>
                <Text
                  sx={{
                    fontSize: 0,
                    fontWeight: "semibold",
                    color: "fg.default",
                  }}
                >
                  {s.student_count}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Auto-Plan Tab ────────────────────────────────────────────────────────────

function AutoPlanTab({
  session,
  shifts,
  buses,
  runs,
  onRunsCreated,
}: {
  session: { id: string; date: string };
  shifts: Shift[];
  buses: Bus[];
  runs: Run[];
  onRunsCreated: () => void;
}) {
  const { showToast } = useUiStore();
  const activeShifts = shifts.filter((s) => s.is_active);

  const [selectedShiftId, setSelectedShiftId] = useState<string>(
    activeShifts[0]?.id ?? "",
  );
  const [direction, setDirection] = useState<RunDirection>("OUTBOUND");
  const [strategy, setStrategy] = useState<AssignmentStrategy>(
    "LARGEST_ROUTE_FIRST",
  );
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [plan, setPlan] = useState<EngineOutput | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const handleGenerate = async () => {
    if (!selectedShiftId) return;
    setGenerating(true);
    setPlan(null);
    const res = await window.api.autoPlanner.generate({
      session_id: session.id,
      shift_id: selectedShiftId,
      direction,
      strategy,
    });
    setGenerating(false);
    if (res.success) {
      setPlan(res.data);
    } else {
      showToast(res.error ?? "Failed to generate plan", "error");
    }
  };

  const handleApprove = async () => {
    if (!plan || !selectedShiftId) return;
    setApproving(true);
    const res = await window.api.autoPlanner.approve({
      session_id: session.id,
      shift_id: selectedShiftId,
      proposedRuns: plan.proposedRuns,
    });
    setApproving(false);
    if (res.success) {
      showToast(
        `${res.data.length} run${res.data.length !== 1 ? "s" : ""} saved successfully`,
      );
      setPlan(null);
      onRunsCreated();
    } else {
      showToast(res.error ?? "Failed to approve plan", "error");
    }
  };

  const criticalWarnings =
    plan?.warnings.filter((w) => w.severity === "CRITICAL") ?? [];
  const normalWarnings =
    plan?.warnings.filter((w) => w.severity === "WARNING") ?? [];

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* LEFT: Config */}
      <div
        style={{
          width: 288,
          borderRight: "1px solid var(--borderColor-default)",
          background: "var(--bgColor-default)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Shift */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--borderColor-muted)",
            }}
          >
            <Text
              as="label"
              sx={{
                fontSize: 1,
                fontWeight: "semibold",
                color: "fg.default",
                display: "block",
                mb: 2,
              }}
            >
              Shift
            </Text>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {activeShifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedShiftId(s.id);
                    setPlan(null);
                  }}
                  className="hov-bg-subtle"
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 6,
                    fontSize: 14,
                    border: "none",
                    cursor: "pointer",
                    background: selectedShiftId === s.id ? "var(--bgColor-accent-muted)" : "transparent",
                    color: selectedShiftId === s.id ? "var(--fgColor-accent)" : "var(--fgColor-default)",
                    fontWeight: selectedShiftId === s.id ? 600 : 400,
                  }}
                >
                  {s.name}
                </button>
              ))}
              {activeShifts.length === 0 && (
                <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                  No active shifts
                </Text>
              )}
            </div>
          </div>

          {/* Direction */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--borderColor-muted)",
            }}
          >
            <Text
              as="label"
              sx={{
                fontSize: 1,
                fontWeight: "semibold",
                color: "fg.default",
                display: "block",
                mb: 2,
              }}
            >
              Direction
            </Text>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                size="small"
                variant={direction === "OUTBOUND" ? "primary" : "default"}
                onClick={() => {
                  setDirection("OUTBOUND");
                  setPlan(null);
                }}
                style={{ flex: 1 }}
              >
                Outbound
              </Button>
              <Button
                size="small"
                variant={direction === "INBOUND" ? "primary" : "default"}
                onClick={() => {
                  setDirection("INBOUND");
                  setPlan(null);
                }}
                style={{ flex: 1 }}
              >
                Inbound
              </Button>
            </div>
          </div>

          {/* Strategy */}
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid var(--borderColor-muted)",
            }}
          >
            <Text
              sx={{
                fontSize: 1,
                fontWeight: "semibold",
                color: "fg.default",
                display: "block",
                mb: 2,
              }}
            >
              Assignment Strategy
            </Text>
            <ActionMenu>
              <ActionMenu.Button sx={{ width: "100%" }}>
                {strategy === "LARGEST_ROUTE_FIRST" && "Largest Route First"}
                {strategy === "SMALLEST_ROUTE_FIRST" && "Smallest Route First"}
                {strategy === "SEQUENCE_ORDER" && "Sequence Order"}
              </ActionMenu.Button>
              <ActionMenu.Overlay>
                <ActionList>
                  <ActionList.Item
                    selected={strategy === "LARGEST_ROUTE_FIRST"}
                    onSelect={() => {
                      setStrategy("LARGEST_ROUTE_FIRST");
                      setPlan(null);
                    }}
                  >
                    Largest Route First
                  </ActionList.Item>
                  <ActionList.Item
                    selected={strategy === "SMALLEST_ROUTE_FIRST"}
                    onSelect={() => {
                      setStrategy("SMALLEST_ROUTE_FIRST");
                      setPlan(null);
                    }}
                  >
                    Smallest Route First
                  </ActionList.Item>
                  <ActionList.Item
                    selected={strategy === "SEQUENCE_ORDER"}
                    onSelect={() => {
                      setStrategy("SEQUENCE_ORDER");
                      setPlan(null);
                    }}
                  >
                    Sequence Order
                  </ActionList.Item>
                </ActionList>
              </ActionMenu.Overlay>
            </ActionMenu>
            <Text
              sx={{ fontSize: 0, color: "fg.muted", mt: 1, display: "block" }}
            >
              {strategy === "LARGEST_ROUTE_FIRST" &&
                "Fill buses with highest-student routes first"}
              {strategy === "SMALLEST_ROUTE_FIRST" &&
                "Fill buses with lowest-student routes first"}
              {strategy === "SEQUENCE_ORDER" && "Assign buses in route order"}
            </Text>
          </div>

          {/* Info */}
          <div style={{ padding: 16 }}>
            <Flash
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 2,
                fontSize: 0,
              }}
            >
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Gender separation is controlled by shift settings. Capacity
                limits and overload are applied automatically.
              </span>
            </Flash>
          </div>
        </div>

        <div
          style={{ padding: 16, borderTop: "1px solid var(--borderColor-default)" }}
        >
          <Button
            variant="primary"
            disabled={!selectedShiftId || generating}
            onClick={handleGenerate}
            sx={{ width: "100%" }}
          >
            {generating ? "Generating..." : "Generate Plan"}
          </Button>
        </div>
      </div>

      {/* CENTER: Proposed runs */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!plan ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--fgColor-muted)",
            }}
          >
            {generating ? (
              <>
                <Spinner size="large" />
                <Text sx={{ mt: 3, fontSize: 1, color: "fg.default" }}>
                  Generating plan...
                </Text>
              </>
            ) : (
              <>
                <Zap size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                <Text sx={{ fontSize: 1 }}>Configure and generate a plan</Text>
                <Text sx={{ fontSize: 0, mt: 1 }}>
                  Select a shift and direction, then click Generate
                </Text>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div
              style={{
                padding: "8px 24px",
                background: "var(--bgColor-muted)",
                borderBottom: "1px solid var(--borderColor-default)",
                display: "flex",
                alignItems: "center",
                gap: 24,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <BusIcon size={16} />
                <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                  {plan.summary.totalBusesUsed}
                </Text>
                <Text sx={{ fontSize: 1, color: "fg.muted" }}>buses</Text>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={16} />
                <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                  {plan.summary.totalStudentsAssigned}
                </Text>
                <Text sx={{ fontSize: 1, color: "fg.muted" }}>assigned</Text>
              </div>
              {plan.summary.totalStudentsUnassigned > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--fgColor-danger)",
                  }}
                >
                  <AlertTriangle size={16} />
                  <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                    {plan.summary.totalStudentsUnassigned}
                  </Text>
                  <Text sx={{ fontSize: 1 }}>unassigned</Text>
                </div>
              )}
              {plan.summary.overloadedRuns > 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    color: "var(--fgColor-attention)",
                  }}
                >
                  <AlertCircle size={16} />
                  <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                    {plan.summary.overloadedRuns}
                  </Text>
                  <Text sx={{ fontSize: 1 }}>overloaded</Text>
                </div>
              )}
            </div>

            {/* Proposed run cards */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {plan.proposedRuns.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--fgColor-muted)",
                  }}
                >
                  <BusIcon
                    size={32}
                    style={{ marginBottom: 8, opacity: 0.3 }}
                  />
                  <Text sx={{ fontSize: 1 }}>No runs could be generated</Text>
                </div>
              ) : (
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}
                >
                  {plan.proposedRuns.map((pr) => (
                    <ProposedRunCard key={pr.temp_id} pr={pr} buses={buses} />
                  ))}
                </div>
              )}
              {plan.unassignedStops.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <Text
                    as="h4"
                    sx={{
                      fontSize: 1,
                      fontWeight: "semibold",
                      color: "danger.fg",
                      mb: 2,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    <AlertTriangle size={16} /> Unassigned Stops (
                    {plan.unassignedStops.length})
                  </Text>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {plan.unassignedStops.map((us) => (
                      <div
                        key={us.stop_id}
                        style={{
                          background: "var(--bgColor-danger-muted)",
                          border: "1px solid var(--borderColor-danger-muted)",
                          borderRadius: 6,
                          padding: 16,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                          }}
                        >
                          <div>
                            <Text
                              sx={{
                                fontWeight: "semibold",
                                fontSize: 0,
                                color: "danger.fg",
                                display: "block",
                              }}
                            >
                              {us.stop_name}
                            </Text>
                            <Text
                              sx={{
                                fontSize: 0,
                                color: "danger.fg",
                                opacity: 0.8,
                              }}
                            >
                              {us.route_name}
                            </Text>
                          </div>
                          <Text
                            sx={{
                              fontSize: 0,
                              color: "danger.fg",
                              flexShrink: 0,
                            }}
                          >
                            {us.planned_boys + us.planned_girls} students
                          </Text>
                        </div>
                        <Text
                          sx={{
                            fontSize: 0,
                            color: "danger.fg",
                            mt: 1,
                            fontStyle: "italic",
                            display: "block",
                          }}
                        >
                          {us.reason}
                        </Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* RIGHT: Actions + Warnings */}
      <div
        style={{
          width: 288,
          borderLeft: "1px solid var(--borderColor-default)",
          background: "var(--bgColor-muted)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--borderColor-muted)",
            background: "var(--bgColor-default)",
          }}
        >
          <Heading as="h3" sx={{ fontSize: 2 }}>
            Plan Actions
          </Heading>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {plan ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Button
                  variant="primary"
                  leadingVisual={CheckCircle2}
                  disabled={approving || plan.proposedRuns.length === 0}
                  onClick={handleApprove}
                  sx={{ width: "100%" }}
                >
                  {approving ? "Saving..." : "Approve & Save"}
                </Button>
                <Button
                  variant="default"
                  onClick={() => setDiscardConfirm(true)}
                  sx={{ width: "100%" }}
                >
                  Discard Plan
                </Button>
              </div>
              {(criticalWarnings.length > 0 || normalWarnings.length > 0) && (
                <div>
                  <Text
                    sx={{
                      fontSize: 0,
                      fontWeight: "semibold",
                      color: "fg.muted",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      display: "block",
                      mb: 2,
                    }}
                  >
                    Warnings
                  </Text>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {criticalWarnings.map((w, i) => (
                      <Flash key={i} variant="danger" sx={{ fontSize: 0 }}>
                        <Text sx={{ fontWeight: "semibold", display: "block" }}>
                          {w.type.replace("_", " ")}
                        </Text>
                        <Text>{w.message}</Text>
                        {w.context && (
                          <Text
                            sx={{
                              opacity: 0.8,
                              fontStyle: "italic",
                              display: "block",
                            }}
                          >
                            {w.context}
                          </Text>
                        )}
                      </Flash>
                    ))}
                    {normalWarnings.map((w, i) => (
                      <Flash key={i} variant="warning" sx={{ fontSize: 0 }}>
                        <Text sx={{ fontWeight: "semibold", display: "block" }}>
                          {w.type.replace("_", " ")}
                        </Text>
                        <Text>{w.message}</Text>
                      </Flash>
                    ))}
                  </div>
                </div>
              )}
              {plan.warnings.length === 0 && (
                <Flash variant="success" sx={{ fontSize: 0 }}>
                  Plan looks good!
                </Flash>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", color: "var(--fgColor-muted)", padding: "16px 0" }}>
              <Zap size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1, display: "block" }}>
                Generate a plan to see actions
              </Text>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={discardConfirm}
        onClose={() => setDiscardConfirm(false)}
        onConfirm={() => {
          setPlan(null);
          setDiscardConfirm(false);
        }}
        title="Discard Plan"
        message="Are you sure you want to discard this plan? No runs will be saved."
        confirmLabel="Discard"
        danger
      />
    </div>
  );
}

// ─── Main Planner ─────────────────────────────────────────────────────────────

export default function Planner() {
  const { session } = useSessionStore();
  const { showToast } = useUiStore();
  const {
    buses,
    routes,
    shifts,
    runs,
    loading,
    selectedShift,
    selectedBus,
    selectedRoute,
    selectedStopIds,
    plannerDirection,
    selectedGender,
    loadData,
    setSelectedShift,
    setSelectedBus,
    setSelectedRoute,
    toggleStop,
    clearStopSelection,
    setDirection,
    setGender,
    confirmRun,
    deleteRun,
  } = usePlannerStore();

  const [routeDetails, setRouteDetails] = useState<RouteWithStops | null>(null);
  const [stopConfigs, setStopConfigs] = useState<StopConfig[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual");

  const loadConflicts = useCallback(async () => {
    if (!session) return;
    const res = await window.api.incident.getConflicts(session.id);
    if (res.success) setConflicts(res.data);
  }, [session]);

  useEffect(() => {
    if (session) {
      loadData(session.id);
      loadConflicts();
    }
  }, [session, loadData, loadConflicts]);

  useEffect(() => {
    if (selectedRoute) {
      window.api.route.getWithStops(selectedRoute.id).then((r) => {
        if (r.success) {
          setRouteDetails(r.data);
          setSelectedRoute(r.data);
        }
      });
    } else {
      setRouteDetails(null);
    }
  }, [selectedRoute?.id]);

  useEffect(() => {
    if (!selectedShift) {
      setStopConfigs([]);
      return;
    }
    window.api.shift.getStopConfigs(selectedShift.id).then((r) => {
      if (r.success) setStopConfigs(r.data);
    });
  }, [selectedShift?.id]);

  const handleConfirmRun = async () => {
    if (!session) return;
    setConfirming(true);
    const result = await confirmRun(session.id);
    setConfirming(false);
    if (result.success) {
      showToast("Run created successfully");
      loadConflicts();
    } else showToast(result.error ?? "Failed to create run", "error");
  };

  const handleDeleteRun = async () => {
    if (!deleteRunId) return;
    const result = await deleteRun(deleteRunId);
    setDeleteRunId(null);
    if (result.success) {
      showToast("Run deleted", "info");
      loadConflicts();
    } else showToast(result.error ?? "Failed to delete run", "error");
  };

  const handleClearShiftPlan = async () => {
    if (!selectedShift) return;
    setClearing(true);
    const shiftRuns = runs.filter((r) => r.shift_id === selectedShift.id);
    for (const run of shiftRuns) await deleteRun(run.id);
    setClearing(false);
    setClearConfirm(false);
    showToast("Shift plan cleared", "info");
  };

  const selectedStudentCount =
    routeDetails?.stops
      .filter((s) => selectedStopIds.includes(s.id))
      .reduce((sum, stop) => {
        const cfg = stopConfigs.find((c) => c.stop_id === stop.id);
        return sum + (cfg ? cfg.planned_boys + cfg.planned_girls : 0);
      }, 0) ?? 0;

  const activeBuses = buses.filter((b) => b.status === "ACTIVE");
  const activeRoutes = routes.filter((r) => r.is_active);
  const activeShifts = shifts.filter((s) => s.is_active);
  const shiftRuns = selectedShift
    ? runs.filter((r) => r.shift_id === selectedShift.id)
    : [];

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bgColor-default)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar showBack backTo="/" backLabel="Home" title="Planner" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div style={{ textAlign: "center", color: "var(--fgColor-muted)" }}>
            <Spinner size="large" />
            <Text sx={{ display: "block", mt: 2 }}>Loading session...</Text>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bgColor-default)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <TopBar
        showBack
        backTo="/"
        backLabel="Home"
        title={`Planner (${session.date})`}
        right={
          activeTab === "manual" && shiftRuns.length > 0 ? (
            <Button
              variant="danger"
              size="small"
              leadingVisual={Trash2}
              onClick={() => setClearConfirm(true)}
            >
              Clear Shift Plan
            </Button>
          ) : undefined
        }
      />

      {/* Tab bar */}
      <div
        style={{
          background: "var(--bgColor-default)",
          borderBottom: "1px solid var(--borderColor-default)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 0,
        }}
      >
        {(["manual", "auto"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 12px",
              fontSize: 14,
              fontWeight: 500,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              borderBottom: `2px solid ${activeTab === tab ? "var(--borderColor-accent-emphasis)" : "transparent"}`,
              color: activeTab === tab ? "var(--fgColor-accent)" : "var(--fgColor-muted)",
              marginBottom: -1,
            }}
          >
            {tab === "manual" ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin size={14} /> Manual
              </span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Zap size={14} /> Auto-Plan
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "manual" ? (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT PANEL: Config */}
          <div
            style={{
              width: 320,
              borderRight: "1px solid var(--borderColor-default)",
              background: "var(--bgColor-default)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div style={{ flex: 1, overflowY: "auto" }}>
              {/* Shift */}
              <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid var(--borderColor-muted)",
                }}
              >
                <Text
                  sx={{
                    fontSize: 1,
                    fontWeight: "semibold",
                    display: "block",
                    mb: 2,
                  }}
                >
                  1. Select Shift
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeShifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift)}
                      className="hov-bg-subtle"
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: 6,
                        fontSize: 14,
                        border: "none",
                        cursor: "pointer",
                        background: selectedShift?.id === shift.id ? "var(--bgColor-accent-muted)" : "transparent",
                        color: selectedShift?.id === shift.id ? "var(--fgColor-accent)" : "var(--fgColor-default)",
                        fontWeight: selectedShift?.id === shift.id ? 600 : 400,
                      }}
                    >
                      {shift.name}
                    </button>
                  ))}
                  {activeShifts.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active shifts
                    </Text>
                  )}
                </div>
              </div>

              {/* Direction */}
              <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid var(--borderColor-muted)",
                }}
              >
                <Text
                  sx={{
                    fontSize: 1,
                    fontWeight: "semibold",
                    display: "block",
                    mb: 2,
                  }}
                >
                  2. Direction
                </Text>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button
                    size="small"
                    variant={
                      plannerDirection === "OUTBOUND" ? "primary" : "default"
                    }
                    leadingVisual={ArrowRight}
                    onClick={() => setDirection("OUTBOUND")}
                    style={{ flex: 1 }}
                  >
                    Outbound
                  </Button>
                  <Button
                    size="small"
                    variant={
                      plannerDirection === "INBOUND" ? "primary" : "default"
                    }
                    leadingVisual={ArrowLeft}
                    onClick={() => setDirection("INBOUND")}
                    style={{ flex: 1 }}
                  >
                    Inbound
                  </Button>
                </div>
              </div>

              {/* Bus selector */}
              <div
                style={{
                  padding: 16,
                  borderBottom: "1px solid var(--borderColor-muted)",
                }}
              >
                <Text
                  sx={{
                    fontSize: 1,
                    fontWeight: "semibold",
                    display: "block",
                    mb: 2,
                  }}
                >
                  3. Select Bus
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeBuses.map((bus) => {
                    const isSelected = selectedBus?.id === bus.id;
                    const isUsed = runs.some(
                      (r) =>
                        r.bus_id === bus.id && r.shift_id === selectedShift?.id,
                    );
                    return (
                      <button
                        key={bus.id}
                        onClick={() => setSelectedBus(isSelected ? null : bus)}
                        className="hov-bg-subtle"
                        style={{
                          textAlign: "left",
                          borderRadius: 6,
                          border: `2px solid ${isSelected ? "var(--borderColor-accent-emphasis)" : busStatusBorderColor(bus.status)}`,
                          cursor: "pointer",
                          background: "transparent",
                          padding: "8px 12px",
                          opacity: isUsed ? 0.6 : 1,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text sx={{ fontSize: 1, fontWeight: "semibold" }}>
                            {bus.number}{" "}
                            <Text
                              sx={{ color: "fg.muted", fontWeight: "normal" }}
                            >
                              ({bus.capacity} seats)
                            </Text>
                          </Text>
                          {isSelected && (
                            <CheckCircle2
                              size={15}
                              style={{ color: "var(--fgColor-accent)" }}
                            />
                          )}
                          {isUsed && !isSelected && (
                            <Label variant="attention">In use</Label>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {activeBuses.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active buses
                    </Text>
                  )}
                </div>
              </div>

              {/* Route selector */}
              <div style={{ padding: 16 }}>
                <Text
                  sx={{
                    fontSize: 1,
                    fontWeight: "semibold",
                    display: "block",
                    mb: 2,
                  }}
                >
                  4. Select Route
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activeRoutes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() =>
                        setSelectedRoute(
                          selectedRoute?.id === route.id
                            ? null
                            : (route as RouteWithStops),
                        )
                      }
                      className="hov-bg-subtle"
                      style={{
                        textAlign: "left",
                        padding: "8px 12px",
                        borderRadius: 6,
                        fontSize: 14,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: selectedRoute?.id === route.id ? "var(--bgColor-accent-muted)" : "transparent",
                        color: selectedRoute?.id === route.id ? "var(--fgColor-accent)" : "var(--fgColor-default)",
                        fontWeight: selectedRoute?.id === route.id ? 600 : 400,
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: route.color,
                        }}
                      />
                      {route.name}
                    </button>
                  ))}
                  {activeRoutes.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active routes
                    </Text>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* CENTER PANEL: Stop selection */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--borderColor-default)",
                background: "var(--bgColor-default)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Heading as="h3" sx={{ fontSize: 2 }}>
                  {selectedRoute
                    ? `Stops — ${selectedRoute.name}`
                    : "Select a route"}
                </Heading>
                {selectedStopIds.length > 0 && (
                  <Text
                    sx={{
                      fontSize: 0,
                      color: "fg.muted",
                      mt: 1,
                      display: "block",
                    }}
                  >
                    {selectedStopIds.length} stop
                    {selectedStopIds.length !== 1 ? "s" : ""} selected
                    {selectedStudentCount > 0 &&
                      ` · ${selectedStudentCount} students`}
                  </Text>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {selectedShift && selectedShift.gender_mode !== "COMBINED" && (
                  <div
                    style={{
                      display: "flex",
                      border: "1px solid var(--borderColor-default)",
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    {(["BOYS", "GIRLS", "MIXED"] as const)
                      .filter(
                        (g) =>
                          selectedShift.gender_mode === "AUTO" || g !== "MIXED",
                      )
                      .map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g)}
                          style={{
                            padding: "4px 8px",
                            fontSize: 12,
                            fontWeight: 500,
                            border: "none",
                            cursor: "pointer",
                            background: selectedGender === g
                              ? g === "BOYS"
                                ? "var(--bgColor-accent-emphasis)"
                                : g === "GIRLS"
                                  ? "#db2777"
                                  : "var(--bgColor-done-emphasis)"
                              : "transparent",
                            color: selectedGender === g ? "white" : "var(--fgColor-muted)",
                          }}
                        >
                          {g === "BOYS" ? "B" : g === "GIRLS" ? "G" : "M"}
                        </button>
                      ))}
                  </div>
                )}
                {selectedStopIds.length > 0 && (
                  <Button
                    size="small"
                    variant="invisible"
                    onClick={clearStopSelection}
                  >
                    Clear
                  </Button>
                )}
                <Button
                  size="small"
                  variant="primary"
                  leadingVisual={CheckCircle2}
                  disabled={
                    !selectedBus ||
                    !selectedRoute ||
                    !selectedShift ||
                    selectedStopIds.length === 0 ||
                    confirming
                  }
                  onClick={handleConfirmRun}
                >
                  {confirming ? "Saving..." : "Confirm Run"}
                </Button>
              </div>
            </div>

            {selectedBus && selectedRoute && (
              <div
                style={{
                  padding: "8px 16px",
                  background: "var(--bgColor-muted)",
                  borderBottom: "1px solid var(--borderColor-default)",
                }}
              >
                <CapacityBar
                  used={selectedStudentCount}
                  capacity={selectedBus.capacity}
                  overload={selectedShift?.default_overload ?? 0}
                />
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {!selectedRoute ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "var(--fgColor-muted)",
                  }}
                >
                  <MapPin size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <Text sx={{ fontSize: 1 }}>Select a route to see stops</Text>
                </div>
              ) : routeDetails ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {routeDetails.stops
                    .filter((s) => s.is_active)
                    .map((stop, i) => {
                      const isSelected = selectedStopIds.includes(stop.id);
                      const cfg = stopConfigs.find(
                        (c) => c.stop_id === stop.id,
                      );
                      const boys = cfg?.planned_boys ?? 0;
                      const girls = cfg?.planned_girls ?? 0;
                      const total = boys + girls;
                      return (
                        <button
                          key={stop.id}
                          onClick={() => toggleStop(stop.id)}
                          style={{
                            textAlign: "left",
                            padding: 16,
                            borderRadius: 6,
                            border: `2px solid ${isSelected ? "var(--borderColor-accent-emphasis)" : "var(--borderColor-default)"}`,
                            cursor: "pointer",
                            background: isSelected ? "var(--bgColor-accent-muted)" : "var(--bgColor-default)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                background: isSelected
                                  ? "var(--bgColor-accent-emphasis)"
                                  : "var(--bgColor-muted)",
                                color: isSelected
                                  ? "white"
                                  : "var(--fgColor-muted)",
                              }}
                            >
                              <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Text
                                sx={{
                                  fontSize: 1,
                                  fontWeight: "medium",
                                  display: "block",
                                }}
                              >
                                {stop.name}
                              </Text>
                              {stop.name_bn && (
                                <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                                  {stop.name_bn}
                                </Text>
                              )}
                            </div>
                            {stopConfigs.length > 0 && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  flexShrink: 0,
                                }}
                              >
                                {boys > 0 && (
                                  <Text
                                    sx={{
                                      fontSize: 0,
                                      fontWeight: "semibold",
                                      color: "accent.fg",
                                    }}
                                  >
                                    B:{boys}
                                  </Text>
                                )}
                                {girls > 0 && (
                                  <Text
                                    sx={{
                                      fontSize: 0,
                                      fontWeight: "semibold",
                                      color: "sponsors.fg",
                                    }}
                                  >
                                    G:{girls}
                                  </Text>
                                )}
                                {total === 0 && cfg && (
                                  <Text
                                    sx={{ fontSize: 0, color: "fg.subtle" }}
                                  >
                                    0
                                  </Text>
                                )}
                              </div>
                            )}
                            {isSelected && (
                              <CheckCircle2
                                size={20}
                                style={{
                                  color: "var(--fgColor-accent)",
                                  flexShrink: 0,
                                }}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  {routeDetails.stops.filter((s) => s.is_active).length ===
                    0 && (
                    <Text
                      sx={{
                        textAlign: "center",
                        color: "fg.muted",
                        fontSize: 1,
                        py: 4,
                        display: "block",
                      }}
                    >
                      No active stops on this route
                    </Text>
                  )}
                </div>
              ) : (
                <Text
                  sx={{
                    textAlign: "center",
                    color: "fg.muted",
                    fontSize: 1,
                    py: 4,
                    display: "block",
                  }}
                >
                  Loading stops...
                </Text>
              )}
            </div>
          </div>

          {/* RIGHT PANEL: Today's runs */}
          <div
            style={{
              width: 288,
              borderLeft: "1px solid var(--borderColor-default)",
              background: "var(--bgColor-muted)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--borderColor-muted)",
                background: "var(--bgColor-default)",
              }}
            >
              <Heading as="h3" sx={{ fontSize: 2 }}>
                Today's Runs
              </Heading>
              <Text
                sx={{ fontSize: 0, color: "fg.muted", mt: 1, display: "block" }}
              >
                {runs.length} run{runs.length !== 1 ? "s" : ""} planned
              </Text>
            </div>

            {conflicts.length > 0 && (
              <div
                style={{
                  padding: "8px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderBottom: "1px solid",
                  background: conflicts.some((c) => c.severity === "CRITICAL")
                    ? "var(--bgColor-danger-muted)"
                    : "var(--bgColor-attention-muted)",
                  borderColor: conflicts.some((c) => c.severity === "CRITICAL")
                    ? "var(--borderColor-danger-muted)"
                    : "var(--borderColor-attention-muted)",
                }}
              >
                <AlertTriangle size={14} />
                <Text
                  sx={{
                    fontSize: 0,
                    fontWeight: "semibold",
                    color: conflicts.some((c) => c.severity === "CRITICAL")
                      ? "danger.fg"
                      : "attention.fg",
                  }}
                >
                  {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}{" "}
                  detected
                </Text>
              </div>
            )}

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {loading ? (
                <div style={{ textAlign: "center", color: "var(--fgColor-muted)", padding: "16px 0" }}>
                  <Spinner />
                </div>
              ) : runs.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--fgColor-muted)", padding: "16px 0" }}>
                  <BusIcon
                    size={32}
                    style={{ marginBottom: 8, opacity: 0.3 }}
                  />
                  <Text sx={{ fontSize: 1, display: "block" }}>
                    No runs yet
                  </Text>
                  <Text sx={{ fontSize: 0, mt: 1 }}>
                    Create a run using the planner
                  </Text>
                </div>
              ) : (
                runs.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    buses={buses}
                    routes={routes}
                    shifts={shifts}
                    conflicts={conflicts}
                    onDelete={setDeleteRunId}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <AutoPlanTab
          session={session}
          shifts={shifts}
          buses={buses}
          runs={runs}
          onRunsCreated={() => loadData(session.id)}
        />
      )}

      <ConfirmDialog
        open={!!deleteRunId}
        onClose={() => setDeleteRunId(null)}
        onConfirm={handleDeleteRun}
        title="Delete Run"
        message="Are you sure you want to delete this run? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
      <ConfirmDialog
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        onConfirm={handleClearShiftPlan}
        title="Clear Shift Plan"
        message={`Remove all ${shiftRuns.length} run${shiftRuns.length !== 1 ? "s" : ""} for ${selectedShift?.name ?? "this shift"}? This cannot be undone.`}
        confirmLabel={clearing ? "Clearing..." : "Clear All"}
        danger
      />
    </div>
  );
}
