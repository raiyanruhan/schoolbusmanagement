import { useParams, useNavigate } from "react-router-dom";
import { Bus, MapPin, Clock } from "lucide-react";
import { Text } from "@primer/react";
import TopBar from "../components/ui/TopBar";
import BusManagement from "../components/settings/BusManagement";
import RouteManagement from "../components/settings/RouteManagement";
import ShiftManagement from "../components/settings/ShiftManagement";

const TABS = [
  { id: "buses", label: "Bus", icon: Bus, component: BusManagement },
  { id: "routes", label: "Routes", icon: MapPin, component: RouteManagement },
  { id: "shifts", label: "Shifts", icon: Clock, component: ShiftManagement },
];

export default function Settings() {
  const { tab = "buses" } = useParams();
  const navigate = useNavigate();

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];
  const ActiveComponent = active.component;

  return (
    <div
      style={{
        height: "100vh",
        background: "var(--bgColor-default)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        overflow: "hidden",
      }}
    >
      <TopBar showBack backTo="/" backLabel="Home" title="Settings" />

      <div
        style={{ display: "flex", flex: 1, padding: "0 24px 24px", gap: 24, minHeight: 0 }}
      >
        {/* Sidebar nav */}
        <aside
          style={{
            width: 200,
            flexShrink: 0,
            paddingTop: 16,
            position: "sticky",
            top: 0,
            height: "fit-content",
          }}
        >
          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const isSelected = active.id === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(`/settings/${id}`)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    // Spectrum use "Pill" or "Large" rounding for nav indicators
                    borderRadius: "8px",
                    fontSize: "14px",
                    fontWeight: 400,
                    border: "none",
                    cursor: "pointer",
                    color: "#010001",
                    textAlign: "left",
                    transition: "background 0.13s ease-in-out",
                    // Adobe uses subtle greys for selection, not high-contrast borders
                    background: isSelected
                      ? "var(--color-action-list-item-default-selected-bg, #e9e9e9)"
                      : "transparent",
                  }}
                  onMouseEnter={(e) =>
                    !isSelected &&
                    (e.currentTarget.style.backgroundColor =
                      "var(--bgColor-muted)")
                  }
                  onMouseLeave={(e) =>
                    !isSelected &&
                    (e.currentTarget.style.backgroundColor = "transparent")
                  }
                >
                  {/* <Icon size={18} strokeWidth={isSelected ? 2.5 : 2} style={{ flexShrink: 0 }} /> */}
                  <span style={{ lineHeight: "1" }}>{label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            background: "var(--bgColor-default)",
            borderRadius: "8px",
            border: "1px solid var(--borderColor-default)",
            overflowY: "auto",
            marginTop: 8,
          }}
        >
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
