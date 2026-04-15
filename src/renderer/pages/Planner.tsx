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
  RefreshCw,
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
  Box,
  ActionMenu,
  ActionList,
  Button,
  Text,
  Heading,
  Select,
  FormControl,
  Label,
  Spinner,
  Flash,
  IconButton,
} from "@primer/react";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import TopBar from "../components/ui/TopBar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function busStatusBorderColor(status: string): string {
  if (status === "ACTIVE") return "success.emphasis";
  if (status === "MAINTENANCE") return "attention.emphasis";
  return "border.default";
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
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 3,
        p: 3,
        border: "1px solid",
        borderColor: hasCritical
          ? "danger.emphasis"
          : runConflicts.length > 0
            ? "attention.emphasis"
            : "border.default",
        borderRadius: 2,
        bg: hasCritical
          ? "danger.subtle"
          : runConflicts.length > 0
            ? "attention.subtle"
            : "canvas.subtle",
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          bg: hasCritical ? "danger.subtle" : "accent.subtle",
          color: hasCritical ? "danger.fg" : "accent.fg",
        }}
      >
        <BusIcon size={20} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
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
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1 }}>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>
            {shift?.name ?? "—"}
          </Text>
          <Text sx={{ fontSize: 0, color: "fg.muted" }}>•</Text>
          <Text
            sx={{
              fontSize: 0,
              fontWeight: "medium",
              color:
                run.direction === "OUTBOUND" ? "attention.fg" : "accent.fg",
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
        </Box>
        {runConflicts.length > 0 && (
          <Box sx={{ mt: 1 }}>
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
          </Box>
        )}
      </Box>

      <IconButton
        icon={Trash2}
        aria-label="Delete run"
        variant="invisible"
        size="small"
        onClick={() => onDelete(run.id)}
        sx={{ color: "danger.fg", flexShrink: 0 }}
      />
    </Box>
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
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
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
      </Box>
      <Box
        sx={{
          height: 8,
          bg: "neutral.muted",
          borderRadius: 9999,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <Box
          sx={{
            height: "100%",
            borderRadius: 9999,
            bg: isWay
              ? "danger.emphasis"
              : isOver
                ? "attention.emphasis"
                : "success.emphasis",
            width: `${pct}%`,
            transition: "width 0.2s",
          }}
        />
        {overload > 0 && (
          <Box
            sx={{
              position: "absolute",
              top: 0,
              height: "100%",
              borderRight: "2px dashed",
              borderColor: "fg.muted",
              left: `${overPct}%`,
            }}
          />
        )}
      </Box>
    </Box>
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
    <Box
      sx={{
        border: "2px solid",
        borderColor: pr.isOverloaded ? "attention.emphasis" : "border.default",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 3 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 2,
            mb: 3,
          }}
        >
          <Box>
            <Text sx={{ fontWeight: "bold", fontSize: 2 }}>
              {bus?.number ?? pr.bus_number}
            </Text>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bg: pr.route_color,
                }}
              />
              <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                {pr.route_name}
              </Text>
            </Box>
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 1,
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
          </Box>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
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
          </Box>
          <Box
            sx={{
              height: 8,
              bg: "neutral.muted",
              borderRadius: 9999,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                height: "100%",
                borderRadius: 9999,
                bg: pr.isOverloaded
                  ? "danger.emphasis"
                  : isOver
                    ? "attention.emphasis"
                    : "success.emphasis",
                width: `${pct}%`,
              }}
            />
          </Box>
        </Box>

        {pr.warnings.length > 0 && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
            {pr.warnings.map((w, i) => (
              <Label
                key={i}
                variant={w.severity === "CRITICAL" ? "danger" : "attention"}
              >
                {w.type.replace("_", " ")}
              </Label>
            ))}
          </Box>
        )}

        <Box
          as="button"
          onClick={() => setExpanded((e) => !e)}
          sx={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            bg: "transparent",
            border: "none",
            cursor: "pointer",
            color: "fg.muted",
            fontSize: 0,
            p: 0,
          }}
        >
          <Text sx={{ fontSize: 0 }}>
            {pr.stops.length} stop{pr.stops.length !== 1 ? "s" : ""}
          </Text>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </Box>

        {expanded && (
          <Box sx={{ mt: 2 }}>
            {pr.stops.map((s, i) => (
              <Box
                key={s.stop_id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                  borderTop: "1px solid",
                  borderColor: "border.muted",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    color: "fg.muted",
                  }}
                >
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      bg: "canvas.subtle",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                  </Box>
                  <Text sx={{ fontSize: 0 }}>{s.stop_name}</Text>
                </Box>
                <Text
                  sx={{
                    fontSize: 0,
                    fontWeight: "semibold",
                    color: "fg.default",
                  }}
                >
                  {s.student_count}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
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
    <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* LEFT: Config */}
      <Box
        sx={{
          width: 288,
          borderRight: "1px solid",
          borderColor: "border.default",
          bg: "canvas.default",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {/* Shift */}
          <Box
            sx={{
              p: 3,
              borderBottom: "1px solid",
              borderColor: "border.muted",
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
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {activeShifts.map((s) => (
                <Box
                  key={s.id}
                  as="button"
                  onClick={() => {
                    setSelectedShiftId(s.id);
                    setPlan(null);
                  }}
                  sx={{
                    textAlign: "left",
                    px: 3,
                    py: 2,
                    borderRadius: 2,
                    fontSize: 1,
                    border: "none",
                    cursor: "pointer",
                    bg: selectedShiftId === s.id ? "" : "transparent",
                    color: selectedShiftId === s.id ? "" : "fg.default",
                    fontWeight:
                      selectedShiftId === s.id ? "semibold" : "normal",
                    "&:hover": { bg: "actionListItem.default.hoverBg" },
                  }}
                >
                  {s.name}
                </Box>
              ))}
              {activeShifts.length === 0 && (
                <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                  No active shifts
                </Text>
              )}
            </Box>
          </Box>

          {/* Direction */}
          <Box
            sx={{
              p: 3,
              borderBottom: "1px solid",
              borderColor: "border.muted",
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
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                size="small"
                variant={direction === "OUTBOUND" ? "primary" : "default"}
                onClick={() => {
                  setDirection("OUTBOUND");
                  setPlan(null);
                }}
                sx={{ flex: 1 }}
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
                sx={{ flex: 1 }}
              >
                Inbound
              </Button>
            </Box>
          </Box>

          {/* Strategy */}
          <Box
            sx={{
              p: 3,
              borderBottom: "1px solid",
              borderColor: "border.muted",
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
          </Box>

          {/* Info */}
          <Box sx={{ p: 3 }}>
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
          </Box>
        </Box>

        <Box
          sx={{ p: 3, borderTop: "1px solid", borderColor: "border.default" }}
        >
          <Button
            variant="primary"
            disabled={!selectedShiftId || generating}
            onClick={handleGenerate}
            sx={{ width: "100%" }}
          >
            {generating ? "Generating..." : "Generate Plan"}
          </Button>
        </Box>
      </Box>

      {/* CENTER: Proposed runs */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {!plan ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "fg.muted",
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
          </Box>
        ) : (
          <>
            {/* Summary bar */}
            <Box
              sx={{
                px: 4,
                py: 2,
                bg: "canvas.subtle",
                borderBottom: "1px solid",
                borderColor: "border.default",
                display: "flex",
                alignItems: "center",
                gap: 4,
                flexShrink: 0,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <BusIcon size={16} />
                <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                  {plan.summary.totalBusesUsed}
                </Text>
                <Text sx={{ fontSize: 1, color: "fg.muted" }}>buses</Text>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Users size={16} />
                <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                  {plan.summary.totalStudentsAssigned}
                </Text>
                <Text sx={{ fontSize: 1, color: "fg.muted" }}>assigned</Text>
              </Box>
              {plan.summary.totalStudentsUnassigned > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "danger.fg",
                  }}
                >
                  <AlertTriangle size={16} />
                  <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                    {plan.summary.totalStudentsUnassigned}
                  </Text>
                  <Text sx={{ fontSize: 1 }}>unassigned</Text>
                </Box>
              )}
              {plan.summary.overloadedRuns > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "attention.fg",
                  }}
                >
                  <AlertCircle size={16} />
                  <Text sx={{ fontWeight: "semibold", fontSize: 1 }}>
                    {plan.summary.overloadedRuns}
                  </Text>
                  <Text sx={{ fontSize: 1 }}>overloaded</Text>
                </Box>
              )}
            </Box>

            {/* Proposed run cards */}
            <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
              {plan.proposedRuns.length === 0 ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "fg.muted",
                  }}
                >
                  <BusIcon
                    size={32}
                    style={{ marginBottom: 8, opacity: 0.3 }}
                  />
                  <Text sx={{ fontSize: 1 }}>No runs could be generated</Text>
                </Box>
              ) : (
                <Box
                  sx={{ display: "grid", gridTemplateColumns: "1fr", gap: 3 }}
                >
                  {plan.proposedRuns.map((pr) => (
                    <ProposedRunCard key={pr.temp_id} pr={pr} buses={buses} />
                  ))}
                </Box>
              )}
              {plan.unassignedStops.length > 0 && (
                <Box sx={{ mt: 4 }}>
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
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {plan.unassignedStops.map((us) => (
                      <Box
                        key={us.stop_id}
                        sx={{
                          bg: "danger.subtle",
                          border: "1px solid",
                          borderColor: "danger.muted",
                          borderRadius: 2,
                          p: 3,
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 2,
                          }}
                        >
                          <Box>
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
                          </Box>
                          <Text
                            sx={{
                              fontSize: 0,
                              color: "danger.fg",
                              flexShrink: 0,
                            }}
                          >
                            {us.planned_boys + us.planned_girls} students
                          </Text>
                        </Box>
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
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* RIGHT: Actions + Warnings */}
      <Box
        sx={{
          width: 288,
          borderLeft: "1px solid",
          borderColor: "border.default",
          bg: "canvas.subtle",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            p: 3,
            borderBottom: "1px solid",
            borderColor: "border.muted",
            bg: "canvas.default",
          }}
        >
          <Heading as="h3" sx={{ fontSize: 2 }}>
            Plan Actions
          </Heading>
        </Box>
        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            p: 3,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {plan ? (
            <>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
              </Box>
              {(criticalWarnings.length > 0 || normalWarnings.length > 0) && (
                <Box>
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
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 2 }}
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
                  </Box>
                </Box>
              )}
              {plan.warnings.length === 0 && (
                <Flash variant="success" sx={{ fontSize: 0 }}>
                  Plan looks good!
                </Flash>
              )}
            </>
          ) : (
            <Box sx={{ textAlign: "center", color: "fg.muted", py: 4 }}>
              <Zap size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
              <Text sx={{ fontSize: 1, display: "block" }}>
                Generate a plan to see actions
              </Text>
            </Box>
          )}
        </Box>
      </Box>

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
    </Box>
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
      <Box
        sx={{
          minHeight: "100vh",
          bg: "canvas.default",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar showBack backTo="/" backLabel="Home" title="Planner" />
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <Box sx={{ textAlign: "center", color: "fg.muted" }}>
            <Spinner size="large" />
            <Text sx={{ display: "block", mt: 2 }}>Loading session...</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bg: "canvas.default",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <TopBar
        showBack
        backTo="/"
        backLabel="Home"
        title={`${session.date}`}
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
      <Box
        sx={{
          bg: "canvas.default",
          borderBottom: "1px solid",
          borderColor: "border.default",
          px: 4,
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexShrink: 0,
        }}
      >
        {(["manual", "auto"] as const).map((tab) => (
          <Box
            key={tab}
            as="button"
            onClick={() => setActiveTab(tab)}
            sx={{
              px: 3,
              py: 2,
              fontSize: 1,
              fontWeight: "medium",
              border: "none",
              bg: "transparent",
              cursor: "pointer",
              borderBottom: "2px solid",
              borderColor:
                activeTab === tab ? "accent.emphasis" : "transparent",
              color: activeTab === tab ? "accent.fg" : "fg.muted",
              mb: "-1px",
            }}
          >
            {tab === "manual" ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <MapPin size={14} /> Manual
              </Box>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Zap size={14} /> Auto-Plan
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {activeTab === "manual" ? (
        <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* LEFT PANEL: Config */}
          <Box
            sx={{
              width: 320,
              borderRight: "1px solid",
              borderColor: "border.default",
              bg: "canvas.default",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box sx={{ flex: 1, overflowY: "auto" }}>
              {/* Shift */}
              <Box
                sx={{
                  p: 3,
                  borderBottom: "1px solid",
                  borderColor: "border.muted",
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {activeShifts.map((shift) => (
                    <Box
                      key={shift.id}
                      as="button"
                      onClick={() => setSelectedShift(shift)}
                      sx={{
                        textAlign: "left",
                        px: 3,
                        py: 2,
                        borderRadius: 2,
                        fontSize: 1,
                        border: "none",
                        cursor: "pointer",
                        bg: selectedShift?.id === shift.id ? "" : "transparent",
                        color: selectedShift?.id === shift.id ? "" : "",
                        fontWeight:
                          selectedShift?.id === shift.id
                            ? "semibold"
                            : "normal",
                        "&:hover": { bg: "actionListItem.default.hoverBg" },
                      }}
                    >
                      {shift.name}
                    </Box>
                  ))}
                  {activeShifts.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active shifts
                    </Text>
                  )}
                </Box>
              </Box>

              {/* Direction */}
              <Box
                sx={{
                  p: 3,
                  borderBottom: "1px solid",
                  borderColor: "border.muted",
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
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Button
                    size="small"
                    variant={
                      plannerDirection === "OUTBOUND" ? "primary" : "default"
                    }
                    leadingVisual={ArrowRight}
                    onClick={() => setDirection("OUTBOUND")}
                    sx={{ flex: 1 }}
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
                    sx={{ flex: 1 }}
                  >
                    Inbound
                  </Button>
                </Box>
              </Box>

              {/* Bus selector */}
              <Box
                sx={{
                  p: 3,
                  borderBottom: "1px solid",
                  borderColor: "border.muted",
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {activeBuses.map((bus) => {
                    const isSelected = selectedBus?.id === bus.id;
                    const isUsed = runs.some(
                      (r) =>
                        r.bus_id === bus.id && r.shift_id === selectedShift?.id,
                    );
                    return (
                      <Box
                        key={bus.id}
                        as="button"
                        onClick={() => setSelectedBus(isSelected ? null : bus)}
                        sx={{
                          textAlign: "left",
                          borderRadius: 2,
                          border: "2px solid",
                          cursor: "pointer",
                          bg: "transparent",
                          borderColor: isSelected
                            ? "accent.emphasis"
                            : busStatusBorderColor(bus.status),
                          opacity: isUsed ? 0.6 : 1,
                          "&:hover": { bg: "actionListItem.default.hoverBg" },
                        }}
                      >
                        <Box
                          sx={{
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
                        </Box>
                      </Box>
                    );
                  })}
                  {activeBuses.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active buses
                    </Text>
                  )}
                </Box>
              </Box>

              {/* Route selector */}
              <Box sx={{ p: 3 }}>
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {activeRoutes.map((route) => (
                    <Box
                      key={route.id}
                      as="button"
                      onClick={() =>
                        setSelectedRoute(
                          selectedRoute?.id === route.id
                            ? null
                            : (route as RouteWithStops),
                        )
                      }
                      sx={{
                        textAlign: "left",
                        px: 3,
                        py: 2,
                        borderRadius: 2,
                        fontSize: 1,
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        bg:
                          selectedRoute?.id === route.id
                            ? "accent.subtle"
                            : "transparent",
                        color:
                          selectedRoute?.id === route.id
                            ? "accent.fg"
                            : "fg.default",
                        fontWeight:
                          selectedRoute?.id === route.id
                            ? "semibold"
                            : "normal",
                        "&:hover": { bg: "actionListItem.default.hoverBg" },
                      }}
                    >
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          flexShrink: 0,
                          bg: route.color,
                        }}
                      />
                      {route.name}
                    </Box>
                  ))}
                  {activeRoutes.length === 0 && (
                    <Text sx={{ fontSize: 0, color: "fg.muted" }}>
                      No active routes
                    </Text>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* CENTER PANEL: Stop selection */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                p: 3,
                borderBottom: "1px solid",
                borderColor: "border.default",
                bg: "canvas.default",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
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
              </Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  flexShrink: 0,
                }}
              >
                {selectedShift && selectedShift.gender_mode !== "COMBINED" && (
                  <Box
                    sx={{
                      display: "flex",
                      border: "1px solid",
                      borderColor: "border.default",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    {(["BOYS", "GIRLS", "MIXED"] as const)
                      .filter(
                        (g) =>
                          selectedShift.gender_mode === "AUTO" || g !== "MIXED",
                      )
                      .map((g) => (
                        <Box
                          key={g}
                          as="button"
                          onClick={() => setGender(g)}
                          sx={{
                            px: 2,
                            py: 1,
                            fontSize: 0,
                            fontWeight: "medium",
                            border: "none",
                            cursor: "pointer",
                            bg:
                              selectedGender === g
                                ? g === "BOYS"
                                  ? "accent.emphasis"
                                  : g === "GIRLS"
                                    ? "sponsors.emphasis"
                                    : "done.emphasis"
                                : "transparent",
                            color:
                              selectedGender === g
                                ? "fg.onEmphasis"
                                : "fg.muted",
                            "&:hover": {
                              bg:
                                selectedGender === g
                                  ? undefined
                                  : "actionListItem.default.hoverBg",
                            },
                          }}
                        >
                          {g === "BOYS" ? "B" : g === "GIRLS" ? "G" : "M"}
                        </Box>
                      ))}
                  </Box>
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
              </Box>
            </Box>

            {selectedBus && selectedRoute && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  bg: "canvas.subtle",
                  borderBottom: "1px solid",
                  borderColor: "border.default",
                }}
              >
                <CapacityBar
                  used={selectedStudentCount}
                  capacity={selectedBus.capacity}
                  overload={selectedShift?.default_overload ?? 0}
                />
              </Box>
            )}

            <Box sx={{ flex: 1, overflowY: "auto", p: 3 }}>
              {!selectedRoute ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "fg.muted",
                  }}
                >
                  <MapPin size={40} style={{ marginBottom: 8, opacity: 0.3 }} />
                  <Text sx={{ fontSize: 1 }}>Select a route to see stops</Text>
                </Box>
              ) : routeDetails ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
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
                        <Box
                          key={stop.id}
                          as="button"
                          onClick={() => toggleStop(stop.id)}
                          sx={{
                            textAlign: "left",
                            p: 3,
                            borderRadius: 2,
                            border: "2px solid",
                            cursor: "pointer",
                            bg: isSelected ? "accent.subtle" : "canvas.default",
                            borderColor: isSelected
                              ? "accent.emphasis"
                              : "border.default",
                            "&:hover": {
                              borderColor: isSelected
                                ? "accent.emphasis"
                                : "border.muted",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                            }}
                          >
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                                bg: isSelected
                                  ? "accent.emphasis"
                                  : "canvas.subtle",
                                color: isSelected
                                  ? "fg.onEmphasis"
                                  : "fg.muted",
                              }}
                            >
                              <Text sx={{ fontSize: 0 }}>{i + 1}</Text>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
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
                            </Box>
                            {stopConfigs.length > 0 && (
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
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
                              </Box>
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
                          </Box>
                        </Box>
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
                </Box>
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
            </Box>
          </Box>

          {/* RIGHT PANEL: Today's runs */}
          <Box
            sx={{
              width: 288,
              borderLeft: "1px solid",
              borderColor: "border.default",
              bg: "canvas.subtle",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                p: 3,
                borderBottom: "1px solid",
                borderColor: "border.muted",
                bg: "canvas.default",
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
            </Box>

            {conflicts.length > 0 && (
              <Box
                sx={{
                  px: 3,
                  py: 2,
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  borderBottom: "1px solid",
                  bg: conflicts.some((c) => c.severity === "CRITICAL")
                    ? "danger.subtle"
                    : "attention.subtle",
                  borderColor: conflicts.some((c) => c.severity === "CRITICAL")
                    ? "danger.muted"
                    : "attention.muted",
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
              </Box>
            )}

            <Box
              sx={{
                flex: 1,
                overflowY: "auto",
                p: 3,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {loading ? (
                <Box sx={{ textAlign: "center", color: "fg.muted", py: 4 }}>
                  <Spinner />
                </Box>
              ) : runs.length === 0 ? (
                <Box sx={{ textAlign: "center", color: "fg.muted", py: 4 }}>
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
                </Box>
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
            </Box>
          </Box>
        </Box>
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
    </Box>
  );
}
