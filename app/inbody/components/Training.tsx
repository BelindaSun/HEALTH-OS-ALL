"use client";

import { useState, useCallback } from "react";
import { C } from "../constants";
import { TrainingType, TrainingSession } from "../types";
import {
  loadTrainingDay,
  addSession,
  removeSession,
  loadZone,
  TRAINING_TYPES,
  typeMeta,
  calcLoad,
} from "../lib/training";

// ── INTENSITY SLIDER ──────────────────────────────────────────
function IntensitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const color =
    value <= 3 ? C.sky : value <= 6 ? C.emerald : value <= 8 ? C.amber : C.rose;
  const label =
    value <= 3
      ? "轻松"
      : value <= 5
        ? "适中"
        : value <= 7
          ? "较难"
          : value <= 9
            ? "很难"
            : "极限";
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 13, color: C.textSub }}>主观强度（RPE）</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>
            {value}
          </span>
          <span style={{ fontSize: 12, color }}>{label}</span>
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: C.textMuted,
          marginTop: 3,
        }}
      >
        <span>1 极轻</span>
        <span>5 适中</span>
        <span>10 极限</span>
      </div>
    </div>
  );
}

// ── DURATION PICKER ───────────────────────────────────────────
function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const presets = [15, 30, 45, 60, 90];
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>
        时长（分钟）
      </div>
      <div
        style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}
      >
        {presets.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${value === p ? C.sky + "60" : C.border}`,
              background: value === p ? C.skyDim : "transparent",
              color: value === p ? C.sky : C.textSub,
            }}
          >
            {p}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          type="number"
          min={1}
          max={300}
          value={value === 0 ? "" : value}
          placeholder="自定义"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || raw === "0") { onChange(0); return; }
            const n = parseInt(raw, 10);
            if (!isNaN(n)) onChange(Math.min(300, Math.max(1, n)));
          }}
          style={{
            width: 90,
            padding: "8px 12px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.04)",
            color: C.text,
            fontSize: 14,
            fontWeight: 700,
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <span style={{ fontSize: 12, color: C.textMuted }}>分钟</span>
      </div>
    </div>
  );
}

// ── ADD SESSION FORM ──────────────────────────────────────────
function AddSessionForm({ onAdd }: { onAdd: () => void }) {
  const [type, setType] = useState<TrainingType>("strength");
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState(6);
  const [note, setNote] = useState("");

  const previewLoad = calcLoad(duration, intensity);
  const zone = loadZone(previewLoad);

  const handleSubmit = () => {
    if (!duration || !intensity) return;
    addSession({
      type,
      durationMin: duration,
      intensity,
      note: note.trim() || undefined,
    });
    setNote("");
    onAdd();
  };

  return (
    <div
      style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        padding: "22px 24px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 16,
        }}
      >
        记录训练
      </div>

      {/* Type selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10 }}>
          训练类型
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {TRAINING_TYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              style={{
                flex: 1,
                padding: "10px 6px",
                borderRadius: 14,
                cursor: "pointer",
                border: `1px solid ${type === t.key ? t.color + "60" : C.border}`,
                background:
                  type === t.key ? t.color + "15" : "rgba(255,255,255,0.03)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 20 }}>{t.emoji}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: type === t.key ? t.color : C.textMuted,
                }}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <DurationPicker value={duration} onChange={setDuration} />
      <IntensitySlider value={intensity} onChange={setIntensity} />

      {/* Note */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: C.textSub, marginBottom: 8 }}>
          备注（可选）
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="例：胸推 PR / 跑步配速 5:30"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.04)",
            color: C.text,
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
          }}
        />
      </div>

      {/* Training Impact preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderRadius: 12,
          background: zone.color + "10",
          border: `1px solid ${zone.color}25`,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
            这次训练
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: zone.color }}>
              {previewLoad}
            </span>
            <span style={{ fontSize: 11, color: zone.color, fontWeight: 700 }}>
              {zone.label === "中强度"
                ? "有效训练区间 ✓"
                : zone.label === "高强度"
                  ? "高强度刺激"
                  : zone.label === "极高强度"
                    ? "超量负荷"
                    : zone.label === "低强度"
                      ? "热身级别"
                      : "休息日"}
            </span>
          </div>
        </div>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            textAlign: "right",
            maxWidth: 130,
            lineHeight: 1.5,
          }}
        >
          {zone.desc}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!duration}
        style={{
          width: "100%",
          padding: "13px",
          borderRadius: 12,
          border: "none",
          background: duration
            ? `linear-gradient(135deg, #8b5cf6, #7c3aed)`
            : "rgba(255,255,255,0.05)",
          color: duration ? "#fff" : C.textMuted,
          fontSize: 15,
          fontWeight: 700,
          cursor: duration ? "pointer" : "not-allowed",
        }}
      >
        记录这次训练 ✓
      </button>
    </div>
  );
}

// ── SESSION ITEM ──────────────────────────────────────────────
function SessionItem({
  session,
  onRemove,
}: {
  session: TrainingSession;
  onRemove: () => void;
}) {
  const meta = typeMeta(session.type);
  const zone = loadZone(session.load);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid rgba(255,255,255,0.05)`,
        marginBottom: 8,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: meta.color + "18",
          border: `1px solid ${meta.color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {meta.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 11, color: C.textMuted }}>
            {session.durationMin}分钟
          </span>
          <span style={{ fontSize: 11, color: C.textMuted }}>
            强度 {session.intensity}/10
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: zone.color }}>
            {zone.label === "中强度"
              ? "有效训练"
              : zone.label === "高强度"
                ? "高强度"
                : zone.label === "极高强度"
                  ? "超量负荷"
                  : zone.label === "低强度"
                    ? "热身级别"
                    : "休息日"}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "1px 6px",
              borderRadius: 6,
              background: zone.color + "18",
              color: zone.color,
            }}
          >
            {session.load}
          </span>
          {session.note && (
            <span
              style={{
                fontSize: 11,
                color: C.textMuted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {session.note}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          color: C.textMuted,
          cursor: "pointer",
          fontSize: 16,
          padding: "4px 8px",
          borderRadius: 8,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── TRAINING SUMMARY CARD ─────────────────────────────────────
function TrainingSummary({
  sessions,
  totalLoad,
  totalDuration,
}: {
  sessions: TrainingSession[];
  totalLoad: number;
  totalDuration: number;
}) {
  if (sessions.length === 0) return null;
  const zone = loadZone(totalLoad);

  // Type breakdown
  const byType = TRAINING_TYPES.map((t) => ({
    ...t,
    count: sessions.filter((s) => s.type === t.key).length,
    load: sessions
      .filter((s) => s.type === t.key)
      .reduce((sum, s) => sum + s.load, 0),
  })).filter((t) => t.count > 0);

  return (
    <div
      style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${zone.color}25`,
        borderRadius: 24,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.textMuted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 14,
        }}
      >
        今日训练总结
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          { label: "今日训练量", val: totalLoad, unit: "", color: zone.color },
          { label: "总时长", val: totalDuration, unit: "min", color: C.sky },
          {
            label: "训练次数",
            val: sessions.length,
            unit: "组",
            color: C.violet,
          },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 12,
              padding: "12px 14px",
              border: `1px solid rgba(255,255,255,0.05)`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: item.color,
                lineHeight: 1,
                marginBottom: 4,
              }}
            >
              {item.val}
              <span
                style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}
              >
                {item.unit}
              </span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Conclusion banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 12,
          background: zone.color + "10",
          border: `1px solid ${zone.color}20`,
          marginBottom: byType.length > 0 ? 14 : 0,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: zone.color }}>
          {zone.label === "中强度"
            ? "处于有效训练区间 ✓"
            : zone.label === "高强度"
              ? "高强度训练日，注意明日恢复"
              : zone.label === "极高强度"
                ? "超量负荷，明日必须休息"
                : zone.label === "低强度"
                  ? "热身级别，可以加量"
                  : "休息日"}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>{zone.desc}</div>
      </div>

      {/* Type breakdown */}
      {byType.length > 1 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {byType.map((t) => (
            <div
              key={t.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 10px",
                borderRadius: 10,
                background: t.color + "12",
                border: `1px solid ${t.color}25`,
              }}
            >
              <span style={{ fontSize: 13 }}>{t.emoji}</span>
              <span style={{ fontSize: 11, color: t.color, fontWeight: 600 }}>
                {t.label}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>
                ×{t.count}
              </span>
              <span style={{ fontSize: 10, color: t.color, opacity: 0.7 }}>
                {t.load}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TRAINING PAGE ─────────────────────────────────────────────
export function TrainingPage({ onBack, recoveryScore, recoveryDebt }: { onBack: () => void; recoveryScore?: number | null; recoveryDebt?: number }) {
  const [day, setDay] = useState(() => loadTrainingDay());

  const refresh = useCallback(() => {
    setDay(loadTrainingDay());
  }, []);

  const handleRemove = (id: string) => {
    setDay(removeSession(id));
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.15em",
              color: C.violet,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            Training Log
          </div>
          <h2
            style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}
          >
            今日训练
          </h2>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })}
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 16px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "rgba(255,255,255,0.04)",
            color: C.textSub,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {"<-"} Dashboard
        </button>
      </div>

      {/* Recovery signal banner */}
      {recoveryScore !== undefined && recoveryScore !== null && (() => {
        const debt = recoveryDebt ?? 0;
        const isRest = recoveryScore < 35 || debt > 55;
        const isLight = recoveryScore < 50 || debt > 35;
        const color = isRest ? "#f43f5e" : isLight ? "#f59e0b" : "#10b981";
        const icon = isRest ? "🛑" : isLight ? "🚶" : "✅";
        const msg = isRest
          ? "恢复不足，建议今日完全休息或主动恢复"
          : isLight
          ? "恢复偏低，建议控制训练强度，避免高负荷"
          : "恢复状态良好，可以按计划训练";
        return (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", borderRadius: 12, marginBottom: 16,
            background: color + "12", border: `1px solid ${color}30`,
          }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{msg}</span>
              <span style={{ fontSize: 11, color: "#475569", marginLeft: 8 }}>
                恢复分 {recoveryScore} · 恢复债 {debt}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Summary (shown when sessions exist) */}
      <TrainingSummary
        sessions={day.sessions}
        totalLoad={day.totalLoad}
        totalDuration={day.totalDuration}
      />

      {/* Session list */}
      {day.sessions.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 10,
            }}
          >
            训练记录 · {day.sessions.length} 组
          </div>
          {day.sessions.map((s) => (
            <SessionItem
              key={s.id}
              session={s}
              onRemove={() => handleRemove(s.id)}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      <AddSessionForm onAdd={refresh} />

      {/* Load guide - collapsible */}
      <LoadGuide />
    </div>
  );
}

function LoadGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        overflow: "hidden",
      }}
    >
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", padding: "14px 20px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: "transparent", border: "none", cursor: "pointer",
      }}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          今天练得够吗？
        </div>
        <span style={{ fontSize: 12, color: C.textMuted }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && <div style={{ padding: "0 20px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            {
              range: "0",
              label: "休息日",
              color: "#475569",
              desc: "主动恢复，无训练",
            },
            {
              range: "1–149",
              label: "热身级别",
              color: C.sky,
              desc: "强度偏低，可以加量",
            },
            {
              range: "150–299",
              label: "有效训练",
              color: C.emerald,
              desc: "训练窗口最佳区间 ✓",
            },
            {
              range: "300–499",
              label: "高强度",
              color: C.amber,
              desc: "充分刺激，注意次日恢复",
            },
            {
              range: "500+",
              label: "超量负荷",
              color: C.rose,
              desc: "次日必须安排休息",
            },
          ].map((row, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 10 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: row.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: row.color,
                  minWidth: 60,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: C.textMuted,
                  minWidth: 52,
                  opacity: 0.5,
                }}
              >
                {row.range}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {row.desc}
              </span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
