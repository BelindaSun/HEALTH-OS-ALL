"use client";

import { C } from "../constants";
import { Tag } from "./ui";
import { CheckinData } from "../types";

// ── SLIDER FIELD ──────────────────────────────────────────────
export function SliderField({ label, value, min = 1, max = 10, color, onChange }: {
  label: string; value: number; min?: number; max?: number; color: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: C.textSub }}>{label}</span>
        <span style={{ fontSize: 16, fontWeight: 800, color }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted, marginTop: 3 }}>
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

// ── MOOD PICKER ───────────────────────────────────────────────
export function MoodPicker({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  const moods = ["😫", "😕", "😐", "🙂", "😄"];
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
      {moods.map((m, i) => (
        <button key={i} onClick={() => onChange(i + 1)}
          style={{
            fontSize: 26, padding: "8px 10px", borderRadius: 12,
            border: `2px solid ${value === i + 1 ? C.emerald : "transparent"}`,
            background: value === i + 1 ? C.emeraldDim : "transparent",
            cursor: "pointer", transition: "all .15s",
          }}>
          {m}
        </button>
      ))}
    </div>
  );
}

// ── MORNING CHECKIN ───────────────────────────────────────────
export function MorningCheckin({ checkin, onChange, onDone }: {
  checkin: CheckinData; onChange: (v: CheckinData) => void; onDone: () => void;
}) {
  const c = checkin.morning || {};
  const set = (k: string, v: any) => onChange({ ...checkin, morning: { ...c, [k]: v }, morningDone: true });
  const sleepOpts = ["<5小时", "5-6小时", "6-7小时", "7-8小时", ">8小时"];
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>昨晚睡眠时长</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sleepOpts.map((opt, i) => (
            <button key={i} onClick={() => set("sleepDuration", i)}
              style={{
                padding: "7px 14px", borderRadius: 20,
                border: `1px solid ${c.sleepDuration === i ? C.sky + "80" : C.border}`,
                background: c.sleepDuration === i ? C.skyDim : "transparent",
                color: c.sleepDuration === i ? C.sky : C.textSub,
                fontSize: 12, cursor: "pointer",
              }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>睡眠质量</div>
        <MoodPicker value={c.sleepQuality} onChange={v => set("sleepQuality", v)} />
      </div>
      <SliderField label="疲劳感" value={c.fatigue ?? 5} min={1} max={10} color={(c.fatigue ?? 0) >= 7 ? C.rose : C.amber} onChange={v => set("fatigue", v)} />
      <SliderField label="压力水平" value={c.stress ?? 5} min={1} max={10} color={(c.stress ?? 0) >= 7 ? C.rose : C.violet} onChange={v => set("stress", v)} />
      <SliderField label="肌肉酸痛" value={c.soreness ?? 3} min={1} max={10} color={(c.soreness ?? 0) >= 7 ? C.rose : C.sky} onChange={v => set("soreness", v)} />
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>今日体重（可选）</div>
        <div style={{ position: "relative" }}>
          <input type="number" placeholder="kg" value={c.weight || ""}
            onChange={e => set("weight", e.target.value)}
            style={{ width: "100%", padding: "10px 40px 10px 14px", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 12 }}>kg</span>
        </div>
      </div>
      <button onClick={onDone} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.emerald},#059669)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        完成 ✓
      </button>
    </div>
  );
}

// ── EVENING CHECKIN ───────────────────────────────────────────
export function EveningCheckin({ checkin, onChange, onDone }: {
  checkin: CheckinData; onChange: (v: CheckinData) => void; onDone: () => void;
}) {
  const c = checkin.evening || {};
  const set = (k: string, v: any) => onChange({ ...checkin, evening: { ...c, [k]: v }, eveningDone: true });
  return (
    <div>
      <SliderField label="蛋白质完成度" value={c.proteinPct ?? 50} min={0} max={100} color={(c.proteinPct ?? 0) >= 80 ? C.emerald : C.amber} onChange={v => set("proteinPct", v)} />
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: C.textSub }}>今日饮水</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.sky }}>{c.waterMl ?? 1500} ml</span>
        </div>
        <input type="range" min={500} max={4000} step={100} value={c.waterMl ?? 1500}
          onChange={e => set("waterMl", Number(e.target.value))}
          style={{ width: "100%", accentColor: C.sky, cursor: "pointer" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.textMuted, marginTop: 3 }}>
          <span>500ml</span><span>4000ml</span>
        </div>
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>今日训练</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["完成", "done", C.emerald], ["跳过", "skip", C.amber], ["休息日", "rest", C.sky]].map(([label, val, color]: any) => (
            <button key={val} onClick={() => set("training", val)}
              style={{ flex: 1, padding: "9px 8px", borderRadius: 12, border: `1px solid ${c.training === val ? color + "60" : C.border}`, background: c.training === val ? color + "18" : "transparent", color: c.training === val ? color : C.textSub, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>今日心情</div>
        <MoodPicker value={c.mood} onChange={v => set("mood", v)} />
      </div>
      <button onClick={onDone} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.emerald},#059669)`, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
        完成 ✓
      </button>
    </div>
  );
}

// ── CHECK-IN CARD ─────────────────────────────────────────────
export function CheckInCard({ checkin, onOpen }: { checkin: CheckinData; onOpen: (type: "morning" | "evening") => void }) {
  const morningDone = checkin?.morningDone;
  const eveningDone = checkin?.eveningDone;
  const m = checkin?.morning || {};
  const e = checkin?.evening || {};
  const sleepLabels = ["<5小时", "5-6小时", "6-7小时", "7-8小时", ">8小时"];
  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Today Check-in</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>今日状态记录</div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {morningDone && eveningDone ? "✓ 今日已完成" : morningDone ? "晨间 ✓  晚间 ○" : "晨间 ○  晚间 ○"}
        </div>
      </div>
      {morningDone && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {m.sleepDuration !== undefined && <Tag color={C.sky}>睡眠 {sleepLabels[m.sleepDuration]}</Tag>}
          {m.fatigue && <Tag color={(m.fatigue ?? 0) >= 7 ? C.rose : C.amber}>疲劳 {m.fatigue}/10</Tag>}
          {m.stress && <Tag color={(m.stress ?? 0) >= 7 ? C.rose : C.violet}>压力 {m.stress}/10</Tag>}
          {m.soreness && <Tag color={(m.soreness ?? 0) >= 7 ? C.rose : C.sky}>酸痛 {m.soreness}/10</Tag>}
          {eveningDone && e.training && <Tag color={C.emerald}>{e.training === "done" ? "训练 ✓" : e.training === "rest" ? "休息日" : "跳过"}</Tag>}
          {eveningDone && e.waterMl && <Tag color={C.sky}>饮水 {e.waterMl}ml</Tag>}
        </div>
      )}
      <div className="no-print" style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onOpen("morning")}
          style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${morningDone ? C.emerald + "40" : C.border}`, background: morningDone ? C.emeraldDim : "rgba(255,255,255,0.03)", color: morningDone ? C.emerald : C.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ☀️ 晨间 {morningDone ? "✓" : "Check-in"}
        </button>
        <button onClick={() => onOpen("evening")}
          style={{ flex: 1, padding: "10px", borderRadius: 12, border: `1px solid ${eveningDone ? C.violet + "40" : C.border}`, background: eveningDone ? C.violetDim : "rgba(255,255,255,0.03)", color: eveningDone ? C.violet : C.textSub, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          🌙 晚间 {eveningDone ? "✓" : "Check-in"}
        </button>
      </div>
    </div>
  );
}
