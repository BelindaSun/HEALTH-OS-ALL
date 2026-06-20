"use client";

import { useState, useEffect } from "react";
import { C } from "../constants";
import { calcWeeklyWins, WeeklyWin } from "../lib/weeklyWin";

export function WeeklyWinCard() {
  const [wins, setWins] = useState<WeeklyWin[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setWins(calcWeeklyWins());
  }, []);

  if (wins.length === 0) return null;

  const newCount = wins.filter(w => w.isNew).length;
  const hasNew = newCount > 0;

  return (
    <div style={{
      background: "rgba(15,23,42,0.85)",
      backdropFilter: "blur(20px)",
      border: `1px solid ${hasNew ? "#f59e0b40" : C.border}`,
      borderRadius: 24,
      padding: "20px 24px",
      marginBottom: 16,
      position: "relative",
      overflow: "hidden",
      transition: "border-color 0.3s",
    }}>
      {/* Glow for new wins */}
      {hasNew && (
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,158,11,0.08), transparent 70%)", pointerEvents: "none" }} />
      )}

      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: expanded ? 16 : 0 }}
      >
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
            Weekly Win
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>本周成就</span>
            {hasNew && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)", fontWeight: 700 }}>
                {newCount} 项新解锁 ✨
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Win emoji preview when collapsed */}
          {!expanded && (
            <div style={{ display: "flex", gap: 4 }}>
              {wins.slice(0, 3).map((w, i) => (
                <div key={i} style={{
                  width: 32, height: 32, borderRadius: 10,
                  background: w.color + "18",
                  border: `1px solid ${w.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15,
                  position: "relative",
                }}>
                  {w.emoji}
                  {w.isNew && (
                    <div style={{ position: "absolute", top: -3, right: -3, width: 8, height: 8, borderRadius: "50%", background: "#f59e0b", border: "1.5px solid rgba(2,8,23,0.9)" }} />
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ color: C.textMuted, fontSize: 12, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</div>
        </div>
      </div>

      {/* Expanded win list */}
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {wins.map((win, i) => (
            <WinItem key={win.id} win={win} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function WinItem({ win, index }: { win: WeeklyWin; index: number }) {
  const [celebrated, setCelebrated] = useState(win.isNew);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "12px 16px", borderRadius: 16,
      background: celebrated ? win.color + "12" : "rgba(255,255,255,0.03)",
      border: `1px solid ${celebrated ? win.color + "35" : "rgba(255,255,255,0.05)"}`,
      transition: "all 0.4s ease",
      animation: celebrated ? `win-slide-in 0.35s ease ${index * 0.08}s both` : "none",
    }}>
      {/* Icon */}
      <div style={{
        width: 42, height: 42, borderRadius: 13, flexShrink: 0,
        background: win.color + "18",
        border: `1px solid ${win.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, position: "relative",
      }}>
        {win.emoji}
        {win.isNew && !celebrated && (
          <div style={{ position: "absolute", top: -4, right: -4, width: 10, height: 10, borderRadius: "50%", background: "#f59e0b", border: "2px solid rgba(2,8,23,0.9)" }} />
        )}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{win.title}</span>
          <span style={{
            fontSize: 9, padding: "1px 6px", borderRadius: 6, fontWeight: 700,
            background: win.type === "breakthrough" ? win.color + "20" : "rgba(255,255,255,0.06)",
            color: win.type === "breakthrough" ? win.color : C.textMuted,
            border: `1px solid ${win.type === "breakthrough" ? win.color + "30" : "rgba(255,255,255,0.05)"}`,
          }}>
            {win.type === "breakthrough" ? "突破" : "持续"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{win.desc}</div>
      </div>

      {/* New badge / dismiss */}
      {celebrated ? (
        <button
          onClick={() => setCelebrated(false)}
          style={{ padding: "4px 10px", borderRadius: 10, border: `1px solid ${win.color}40`, background: win.color + "15", color: win.color, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
        >
          🎉 新！
        </button>
      ) : (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: win.color + "60", flexShrink: 0 }} />
      )}

      <style>{`
        @keyframes win-slide-in {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
