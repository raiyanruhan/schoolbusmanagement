import { useEffect, useState, useRef } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Bus,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import {
  Button,
  Text,
  Heading,
  FormControl,
  TextInput,
  Select,
  Textarea,
  Label,
  Flash,
  IconButton,
  Spinner,
  ActionMenu,
  ActionList,
} from "@primer/react";
import Modal from "../ui/Modal";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useUiStore } from "../../store/uiStore";
import type {
  Bus as BusType,
  BusStatus,
  CreateBusInput,
  UpdateBusInput,
} from "../../../shared/types";

type StatusVariant = "success" | "attention" | "secondary";
const STATUS_VARIANT: Record<BusStatus, StatusVariant> = {
  ACTIVE: "success",
  MAINTENANCE: "attention",
  RETIRED: "secondary",
};

interface BusFormData {
  number: string;
  capacity: string;
  status: BusStatus;
  notes: string;
}

const defaultForm: BusFormData = {
  number: "",
  capacity: "40",
  status: "ACTIVE",
  notes: "",
};

interface BusFormProps {
  initial?: BusType;
  onSubmit: (data: BusFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  error: string | null;
}

function BusForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: BusFormProps) {
  const [form, setForm] = useState<BusFormData>(
    initial
      ? {
          number: initial.number,
          capacity: String(initial.capacity),
          status: initial.status,
          notes: initial.notes ?? "",
        }
      : defaultForm,
  );

  const set = (k: keyof BusFormData, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      onSubmit={(e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(form);
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <FormControl required>
        <FormControl.Label>Bus Number</FormControl.Label>
        <TextInput
          value={form.number}
          onChange={(e) => set("number", e.target.value)}
          placeholder="e.g. Bus 07, BCPSC-12"
          block
        />
      </FormControl>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FormControl required>
          <FormControl.Label>Capacity</FormControl.Label>
          <TextInput
            type="number"
            min={1}
            max={200}
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
            block
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Status</FormControl.Label>
          <ActionMenu>
            <ActionMenu.Button>{form.status}</ActionMenu.Button>
            <ActionMenu.Overlay>
              <ActionList>
                <ActionList.Item onClick={() => set("status", "ACTIVE")}>
                  Active
                </ActionList.Item>
                <ActionList.Item onClick={() => set("status", "MAINTENANCE")}>
                  Maintenance
                </ActionList.Item>
                <ActionList.Item onClick={() => set("status", "RETIRED")}>
                  Retired
                </ActionList.Item>
              </ActionList>
            </ActionMenu.Overlay>
          </ActionMenu>
        </FormControl>
      </div>

      <FormControl>
        <FormControl.Label>Notes</FormControl.Label>
        <Textarea
          style={{ resize: "none" }}
          cols={100}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Optional notes"
          resize="vertical"
        />
      </FormControl>

      {error && <Flash variant="danger">{error}</Flash>}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 4,
        }}
      >
        <Button type="button" variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Saving..." : initial ? "Save Changes" : "Add Bus"}
        </Button>
      </div>
    </form>
  );
}

export default function BusManagement() {
  const { showToast } = useUiStore();
  const [buses, setBuses] = useState<BusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editBus, setEditBus] = useState<BusType | null>(null);
  const [deleteBus, setDeleteBus] = useState<BusType | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBuses = async () => {
    setLoading(true);
    const result = await window.api.bus.getAll();
    if (result.success) setBuses(result.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  const handleAdd = async (form: BusFormData) => {
    setFormLoading(true);
    setFormError(null);
    const input: CreateBusInput = {
      number: form.number.trim(),
      capacity: parseInt(form.capacity),
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    const result = await window.api.bus.create(input);
    setFormLoading(false);
    if (result.success) {
      setAddOpen(false);
      fetchBuses();
      showToast(`Bus "${result.data.number}" added`);
    } else setFormError(result.error);
  };

  const handleEdit = async (form: BusFormData) => {
    if (!editBus) return;
    setFormLoading(true);
    setFormError(null);
    const input: UpdateBusInput = {
      id: editBus.id,
      number: form.number.trim(),
      capacity: parseInt(form.capacity),
      status: form.status,
      notes: form.notes.trim() || undefined,
    };
    const result = await window.api.bus.update(input);
    setFormLoading(false);
    if (result.success) {
      setEditBus(null);
      fetchBuses();
      showToast(`Bus "${result.data.number}" updated`);
    } else setFormError(result.error);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await window.api.excel.importBuses(buffer);
      if (result.success) {
        const { created, skipped } = result.data;
        showToast(
          `${created} bus${created !== 1 ? "es" : ""} imported` +
            (skipped > 0 ? ` · ${skipped} already existed` : ""),
        );
        fetchBuses();
      } else {
        showToast(result.error, "error");
      }
    } catch {
      showToast("Failed to read file", "error");
    }
    setImporting(false);
  };

  const handleDelete = async () => {
    if (!deleteBus) return;
    const result = await window.api.bus.delete(deleteBus.id);
    if (result.success) {
      fetchBuses();
      showToast(`Bus "${deleteBus.number}" deleted`, "info");
    } else showToast(result.error, "error");
    setDeleteBus(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header — never scrolls */}
      <div
        style={{
          padding: "24px 32px",
          borderBottom: "1px solid var(--borderColor-default)",
          flexShrink: 0,
          background: "var(--bgColor-default)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
    boxShadow: "0 2px 54px #0000001a, 0 1px 4px #00000012",

        }}
      >
        <div>
          <Heading as="h1" sx={{ fontSize: 4 }}>
            Bus Management
          </Heading>
          <Text
            sx={{ color: "fg.muted", fontSize: 1, mt: 1, display: "block" }}
          >
            {buses.length} bus{buses.length !== 1 ? "es" : ""} registered
          </Text>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleExcelImport}
          />
          <Button
            variant="default"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
          >
            {importing ? "Importing..." : "Import Excel"}
          </Button>
          <Button
            variant="primary"
            leadingVisual={Plus}
            onClick={() => {
              setFormError(null);
              setAddOpen(true);
            }}
          >
            Add Bus
          </Button>
        </div>
      </div>

      {/* Scrollable table area */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>

      {/* Table */}
      <div
        style={{
          border: "1px solid var(--borderColor-default)",
          borderRadius: 6,
          overflow: "hidden",
          boxShadow: "0 2px 4px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        {loading ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--fgColor-muted)",
            }}
          >
            <Spinner />
          </div>
        ) : buses.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center" }}>
            <div style={{ color: "var(--fgColor-muted)", marginBottom: 8 }}>
              <Bus size={48} />
            </div>
            <Text
              sx={{
                fontWeight: "semibold",
                color: "fg.muted",
                display: "block",
              }}
            >
              No buses yet
            </Text>
            <Text
              sx={{ fontSize: 0, color: "fg.muted", mt: 1, display: "block" }}
            >
              Add your first bus to get started.
            </Text>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead
              style={{
                background: "var(--bgColor-muted)",
                borderBottom: "1px solid var(--borderColor-default)",
              }}
            >
              <tr>
                {["Number", "Capacity", "Status", "Notes", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 16px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--fgColor-muted)",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {buses.map((bus) => (
                <tr
                  key={bus.id}
                  className="hov-bg-subtle last-no-border"
                  style={{ borderBottom: "1px solid var(--borderColor-muted)" }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {bus.number}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: 14,
                      color: "var(--fgColor-muted)",
                    }}
                  >
                    {bus.capacity} seats
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Label>
                      {bus.status}
                    </Label>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      fontSize: 12,
                      color: "var(--fgColor-muted)",
                    }}
                  >
                    {bus.notes ?? "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <IconButton
                        icon={Pencil}
                        aria-label="Edit"
                        variant="invisible"
                        size="small"
                        onClick={() => {
                          setFormError(null);
                          setEditBus(bus);
                        }}
                      />
                      <IconButton
                        icon={Trash2}
                        aria-label="Delete"
                        variant="invisible"
                        size="small"
                        onClick={() => setDeleteBus(bus)}
                        sx={{ color: "danger.fg" }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      </div>{/* end scrollable area */}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Bus">
        <BusForm
          onSubmit={handleAdd}
          onCancel={() => setAddOpen(false)}
          loading={formLoading}
          error={formError}
        />
      </Modal>
      <Modal open={!!editBus} onClose={() => setEditBus(null)} title="Edit Bus">
        {editBus && (
          <BusForm
            initial={editBus}
            onSubmit={handleEdit}
            onCancel={() => setEditBus(null)}
            loading={formLoading}
            error={formError}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleteBus}
        onClose={() => setDeleteBus(null)}
        onConfirm={handleDelete}
        title="Delete Bus"
        message={`Are you sure you want to delete "${deleteBus?.number}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
