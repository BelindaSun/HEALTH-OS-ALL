"use client";

import { C } from "../constants";

interface OsTab {
  key: string;
  label: string;
  icon: string;
  active: boolean;
}

export function OsNav({ tabs, active, onTab }: {
  tabs: OsTab[];
  active: string;
  onTab: (key: string) => void;
}) {
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        const isAvailable = tab.active;
        return (
          <button
            key={tab.key}
            onClick={() => isAvailable && onTab(tab.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
              border: `1px solid ${isActive ? C.emerald + "50" : isAvailable ? C.border : "rgba(255,255,255,0.04)"}`,
              background: isActive ? C.emeraldDim : "transparent",
              color: isActive ? C.emerald : isAvailable ? C.textSub : C.textMuted,
              fontSize: 12, fontWeight: isActive ? 700 : 500,
              cursor: isAvailable ? "pointer" : "not-allowed",
              opacity: isAvailable ? 1 : 0.45,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {!isAvailable && <span style={{ fontSize: 9, opacity: 0.7 }}>Soon</span>}
          </button>
        );
      })}
    </div>
  );
}
