"use client";

import React, { useState, useMemo } from "react";
import { C, g, GOAL_CN } from "../constants";
import { AppState, Measurements } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanRecord {
  date: string;          // YYYY-MM-DD
  label?: string;        // e.g. "第1次扫描"
  measurements: Partial<Measurements>;
}

interface BodyDirection {
  signals: { icon: "✓" | "⚠" | "✗"; text: string; color: string }[];
  summary: string;
}

interface Contributor {
  icon: string;
  label: string;
  value: string;
  positive: boolean;
}

type TrendRange = "30" | "90" | "180";

// ─── Scan History Storage ─────────────────────────────────────────────────────

const SCAN_HISTORY_KEY = "inbody_scan_history";

function loadScanHistory(): ScanRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCAN_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveScanHistory(history: ScanRecord[]) {
  try {
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

// ─── Behavior Data ────────────────────────────────────────────────────────────

function loadRecentBehavior(days = 14) {
  const proteinPcts: number[] = [];
  const trainingDays: number[] = [];
  const recoveryScores: number[] = [];
  const sleepMap = [30, 55, 75, 100, 85];
  // Training frequency uses 7-day window (more intuitive "per week")
  const TRAIN_WINDOW = 7;

  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(`checkin_${dateStr}`) : null;
      if (raw) {
        const ci = JSON.parse(raw);
        if (ci.evening?.proteinPct !== undefined) proteinPcts.push(ci.evening.proteinPct);
        if (ci.morning?.sleepDuration !== undefined) {
          const sl = sleepMap[ci.morning.sleepDuration] ?? 75;
          const fq = ci.morning.fatigue ? (1 - (ci.morning.fatigue - 1) / 9) * 100 : 75;
          const st = ci.morning.stress ? (1 - (ci.morning.stress - 1) / 9) * 100 : 75;
          recoveryScores.push(Math.round(sl * 0.5 + fq * 0.3 + st * 0.2));
        }
      }
      // Only count training within 7-day window
      if (i < TRAIN_WINDOW) {
        const tr = typeof window !== "undefined" ? localStorage.getItem(`training_${dateStr}`) : null;
        if (tr) {
          const td = JSON.parse(tr);
          if ((td.sessions?.length ?? 0) > 0) trainingDays.push(1);
        }
      }
    } catch {}
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b) / arr.length) : 0;
  return {
    avgProtein: avg(proteinPcts),
    // trainingFreq = actual days trained in last 7 days (not extrapolated)
    trainingFreq: trainingDays.length,
    avgRecovery: avg(recoveryScores),
    dataDays: proteinPcts.length,
  };
}

// ─── Direction Engine ─────────────────────────────────────────────────────────

function genBodyDirection(
  current: Measurements,
  prev: Partial<Measurements> | null,
  behavior: ReturnType<typeof loadRecentBehavior>,
  goal: string,
): BodyDirection {
  const signals: BodyDirection["signals"] = [];

  const isFatLoss = ["weight_loss", "recomposition"].includes(goal);
  const isMuscle = ["muscle_gain", "recomposition"].includes(goal);

  // Fat trend
  if (prev?.bodyFatPercentage) {
    const bfDelta = current.bodyFatPercentage - prev.bodyFatPercentage;
    if (isFatLoss) {
      if (bfDelta < -0.5) signals.push({ icon: "✓", text: "体脂持续下降", color: C.emerald });
      else if (bfDelta < 0.3) signals.push({ icon: "⚠", text: "体脂基本稳定，减脂进展缓慢", color: C.amber });
      else signals.push({ icon: "✗", text: "体脂有所上升", color: C.rose });
    }
  } else if (isFatLoss) {
    signals.push({ icon: "✓", text: `当前体脂 ${current.bodyFatPercentage.toFixed(1)}%，已建立基准`, color: C.sky });
  }

  // Muscle trend
  if (prev?.skeletalMuscleMass) {
    const smmDelta = current.skeletalMuscleMass - prev.skeletalMuscleMass;
    if (isMuscle) {
      if (smmDelta > 0.2) signals.push({ icon: "✓", text: `肌肉量增加 ${smmDelta.toFixed(1)}kg`, color: C.emerald });
      else if (smmDelta > -0.2) signals.push({ icon: "✓", text: "肌肉量保持稳定", color: C.emerald });
      else signals.push({ icon: "⚠", text: `肌肉量减少 ${Math.abs(smmDelta).toFixed(1)}kg，注意蛋白质摄入`, color: C.amber });
    } else {
      if (smmDelta > -0.2) signals.push({ icon: "✓", text: "减脂过程中肌肉得到保留", color: C.emerald });
      else signals.push({ icon: "⚠", text: "肌肉有少量流失，增加蛋白质摄入", color: C.amber });
    }
  } else if (isMuscle) {
    signals.push({ icon: "✓", text: `肌肉量 ${current.skeletalMuscleMass.toFixed(1)}kg，已建立基准`, color: C.sky });
  }

  // Recovery limiting
  if (behavior.avgRecovery > 0 && behavior.avgRecovery < 55) {
    signals.push({ icon: "⚠", text: "恢复质量可能限制进一步进展", color: C.amber });
  } else if (behavior.avgRecovery >= 70) {
    signals.push({ icon: "✓", text: "恢复状态支持训练适应", color: C.emerald });
  }

  // Training consistency
  if (behavior.trainingFreq >= 3) {
    signals.push({ icon: "✓", text: `训练频率 ${behavior.trainingFreq} 次/周，一致性良好`, color: C.emerald });
  } else if (behavior.dataDays > 0) {
    signals.push({ icon: "⚠", text: `训练频率 ${behavior.trainingFreq} 次/周，建议增加`, color: C.amber });
  }

  // Summary
  const positives = signals.filter(s => s.icon === "✓").length;
  const warnings = signals.filter(s => s.icon === "⚠").length;
  const summary = prev
    ? positives > warnings
      ? "整体趋势向好，保持当前节律。"
      : warnings > positives
      ? "有几项需要关注，针对性调整后进展会加快。"
      : "部分指标改善，部分需要关注。"
    : "这是你的基准数据，开始 Check-in 后即可追踪变化趋势。";

  return { signals, summary };
}

// ─── Interpretation Engine ────────────────────────────────────────────────────

// Returns ranked behavior factors for display
function getRankedFactors(behavior: ReturnType<typeof loadRecentBehavior>): {
  rank: number; label: string; value: string; positive: boolean; icon: string; impact: number;
}[] {
  const factors = [
    {
      label: "训练频率", icon: "🏋️",
      value: `${behavior.trainingFreq}次/周`,
      positive: behavior.trainingFreq >= 3,
      impact: behavior.trainingFreq >= 3 ? behavior.trainingFreq * 15 : behavior.trainingFreq * 8,
    },
    {
      label: "蛋白达标率", icon: "🥩",
      value: `${behavior.avgProtein}%`,
      positive: behavior.avgProtein >= 70,
      impact: behavior.avgProtein,
    },
    {
      label: "恢复质量", icon: "🌙",
      value: behavior.avgRecovery > 0 ? `${behavior.avgRecovery}分` : "暂无数据",
      positive: behavior.avgRecovery >= 60 || behavior.avgRecovery === 0,
      impact: behavior.avgRecovery > 0 ? behavior.avgRecovery : 70,
    },
  ];
  // Sort: negatives first (limiting factors), then by impact desc
  return factors
    .sort((a, b) => {
      if (a.positive !== b.positive) return a.positive ? 1 : -1;
      return b.impact - a.impact;
    })
    .map((f, i) => ({ ...f, rank: i + 1 }));
}

function genInterpretation(
  current: Measurements,
  prev: Partial<Measurements> | null,
  behavior: ReturnType<typeof loadRecentBehavior>,
  goal: string,
): string {
  const ranked = getRankedFactors(behavior);
  const limiting = ranked.find(f => !f.positive);
  const positives = ranked.filter(f => f.positive);

  if (!prev) {
    const lines: string[] = [];
    if (behavior.dataDays > 3) {
      if (positives.length > 0) {
        lines.push(`你的${positives.map(f => f.label).join("和")}保持在较好水平。`);
      }
      if (limiting) {
        lines.push(`目前最大的限制因素是${limiting.label}（当前 ${limiting.value}）。`);
        if (limiting.label === "训练频率") {
          lines.push(`如果训练频率提高到每周 3 次以上，身体组成变化速度有望明显提升。`);
        } else if (limiting.label === "蛋白达标率") {
          lines.push(`蛋白质是体成分改变的物质基础，提升到 80%+ 会加快进展。`);
        } else if (limiting.label === "恢复质量") {
          lines.push(`恢复质量影响训练适应效率，改善睡眠是最直接的提升路径。`);
        }
      } else {
        lines.push("各项行为指标表现良好，保持当前节律即可。");
      }
    } else {
      lines.push("坚持 Check-in 记录行为数据，两周后这里会生成基于你实际行为的解读。");
    }
    return lines.join(" ");
  }

  const weightDelta = current.weight - (prev.weight ?? current.weight);
  const bfDelta = current.bodyFatPercentage - (prev.bodyFatPercentage ?? current.bodyFatPercentage);
  const smmDelta = current.skeletalMuscleMass - (prev.skeletalMuscleMass ?? current.skeletalMuscleMass);
  const lines: string[] = [];

  // What happened
  if (Math.abs(weightDelta) > 0.3) {
    if (weightDelta < 0 && bfDelta < 0 && smmDelta > -0.2) {
      lines.push(`体重减少 ${Math.abs(weightDelta).toFixed(1)}kg，主要来自脂肪，肌肉得到保留——这是理想的减脂模式。`);
    } else if (weightDelta < 0 && smmDelta < -0.3) {
      lines.push(`体重减少 ${Math.abs(weightDelta).toFixed(1)}kg，但肌肉量也有流失，减脂速度可能过快或蛋白质不足。`);
    } else if (weightDelta > 0 && smmDelta > 0.1) {
      lines.push(`体重增加 ${weightDelta.toFixed(1)}kg，其中肌肉量增加 ${smmDelta.toFixed(1)}kg——增肌进展良好。`);
    } else if (weightDelta > 0 && bfDelta > 0.5) {
      lines.push(`体重增加 ${weightDelta.toFixed(1)}kg，主要来自脂肪，建议检查饮食结构和训练强度。`);
    }
  } else {
    lines.push("体重基本稳定，身体成分可能在悄悄重组——体重数字不能反映全貌。");
  }

  // Why — narrative from ranked factors
  if (behavior.dataDays > 3) {
    if (positives.length > 0) {
      lines.push(`你的${positives.map(f => `${f.label}（${f.value}）`).join("、")}保持在较高水平。`);
    }
    if (limiting) {
      lines.push(`目前最大的限制因素是${limiting.label}（当前 ${limiting.value}）。`);
      if (limiting.label === "训练频率") lines.push("如果训练频率提高到每周 3 次以上，身体组成变化速度有望明显提升。");
      else if (limiting.label === "蛋白达标率") lines.push("蛋白质充足是肌肉保留和体脂下降的基础，优先提升到 80%+。");
      else if (limiting.label === "恢复质量") lines.push("恢复分偏低可能在限制训练适应，改善睡眠是最直接的突破口。");
    }
  }

  const isOnTrack = (["weight_loss","recomposition"].includes(goal) && bfDelta < 0)
    || (["muscle_gain"].includes(goal) && smmDelta > 0);
  lines.push(isOnTrack ? "当前轨迹符合目标方向，保持一致性。" : "需要针对性调整以加快向目标靠近。");

  return lines.join(" ");
}

// ─── Contributors Card ────────────────────────────────────────────────────────

function ContributorsCard({ behavior }: {
  behavior: ReturnType<typeof loadRecentBehavior>;
}) {
  if (behavior.dataDays === 0) return null;
  const ranked = getRankedFactors(behavior);

  return (
    <div style={{ ...g({ padding: "20px 24px" }), marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
        主要影响因素
      </div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>按影响力排序，限制因素优先</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ranked.map((item) => (
          <div key={item.rank} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "10px 14px", borderRadius: 12,
            background: item.positive ? C.emeraldDim : C.amberDim,
            border: `1px solid ${item.positive ? C.emerald : C.amber}25`,
          }}>
            <span style={{
              fontSize: 11, fontWeight: 800,
              color: item.positive ? C.emerald : C.amber,
              minWidth: 18, opacity: 0.7,
            }}>
              {item.rank}
            </span>
            <span style={{ fontSize: 14 }}>{item.icon}</span>
            <span style={{ fontSize: 13, color: C.textSub, flex: 1 }}>{item.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: item.positive ? C.emerald : C.amber }}>
              {item.value}
            </span>
            <span style={{ fontSize: 12, color: item.positive ? C.emerald : C.amber }}>
              {item.positive ? "✓" : "⚠"}
            </span>
          </div>
        ))}
      </div>
      {ranked.find(f => !f.positive) && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.02)", lineHeight: 1.6 }}>
          💡 下一阶段最值得优化：
          <span style={{ color: C.amber, fontWeight: 700 }}> {ranked.find(f => !f.positive)?.label}</span>
        </div>
      )}
    </div>
  );
}

// ─── SVG Trend Line ───────────────────────────────────────────────────────────

function TrendLine({ data, color, label, unit, formatVal }: {
  data: { date: string; value: number }[];
  color: string; label: string; unit: string;
  formatVal?: (v: number) => string;
}) {
  const W = 480; const H = 70;
  const PAD = { top: 8, bottom: 18, left: 36, right: 8 };
  if (data.length < 2) return (
    <div style={{ fontSize: 11, color: C.textMuted, padding: "12px 0" }}>
      需要至少 2 次扫描数据才能显示趋势
    </div>
  );

  const vals = data.map(d => d.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const range = hi - lo || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = data.length;

  const px = (i: number) => PAD.left + (i / (n - 1)) * innerW;
  const py = (v: number) => PAD.top + innerH - ((v - lo) / range) * innerH;

  const path = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.value).toFixed(1)}`).join(" ");
  const area = `${path} L${px(n - 1).toFixed(1)},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;
  const fmt = formatVal ?? ((v: number) => v.toFixed(1));
  const gradId = `tg-${color.replace("#", "")}`;
  const delta = data[data.length - 1].value - data[0].value;
  const deltaColor = delta === 0 ? C.textMuted : delta < 0 ? C.emerald : C.rose;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.textSub, fontWeight: 600 }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color }}>{fmt(data[data.length - 1].value)}{unit}</span>
          <span style={{ fontSize: 10, color: deltaColor, fontWeight: 700 }}>
            {delta > 0 ? "+" : ""}{fmt(delta)}{unit}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={px(i).toFixed(1)} cy={py(d.value).toFixed(1)} r="3" fill={color} />
        ))}
        {[lo, hi].map((v, i) => (
          <text key={i} x={PAD.left - 4} y={py(v) + 4} textAnchor="end" fontSize="9" fill="#475569">
            {fmt(v)}
          </text>
        ))}
        {data.map((d, i) => {
          if (i % Math.max(1, Math.floor(n / 4)) !== 0 && i !== n - 1) return null;
          const [, m, day] = d.date.split("-");
          return <text key={i} x={px(i).toFixed(1)} y={H - 2} textAnchor="middle" fontSize="9" fill="#475569">{parseInt(m)}/{parseInt(day)}</text>;
        })}
      </svg>
    </div>
  );
}

// ─── Scan History Modal ───────────────────────────────────────────────────────

function AddScanModal({ onSave, onClose }: {
  onSave: (record: ScanRecord) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("");
  const [bf, setBf] = useState("");
  const [smm, setSmm] = useState("");
  const [vfl, setVfl] = useState("");

  const handleSave = () => {
    if (!date || !weight) return;
    const record: ScanRecord = {
      date, label,
      measurements: {
        weight: parseFloat(weight) || 0,
        bodyFatPercentage: parseFloat(bf) || 0,
        skeletalMuscleMass: parseFloat(smm) || 0,
        visceralFatLevel: parseFloat(vfl) || 0,
      },
    };
    onSave(record);
    onClose();
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 10, outline: "none",
    border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
    color: C.text, fontSize: 13,
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(2,8,23,0.85)", backdropFilter: "blur(8px)",
    }}>
      <div style={{ ...g({ padding: "24px" }), width: "100%", maxWidth: 400, margin: "0 16px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 20 }}>录入历史扫描数据</div>

        {[
          { label: "扫描日期", val: date, set: setDate, type: "date", placeholder: "" },
          { label: "标签（可选）", val: label, set: setLabel, type: "text", placeholder: "如：第1次扫描" },
          { label: "体重 (kg)", val: weight, set: setWeight, type: "number", placeholder: "如：72.4" },
          { label: "体脂率 (%)", val: bf, set: setBf, type: "number", placeholder: "如：24.8" },
          { label: "骨骼肌 (kg)", val: smm, set: setSmm, type: "number", placeholder: "如：31.2" },
          { label: "内脏脂肪", val: vfl, set: setVfl, type: "number", placeholder: "如：8" },
        ].map((field, i) => (
          <div key={i} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{field.label}</div>
            <input type={field.type} value={field.val} placeholder={field.placeholder}
              onChange={e => field.set(e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={handleSave} style={{
            flex: 1, padding: "10px", borderRadius: 12, border: "none",
            background: `linear-gradient(135deg,${C.emerald},#059669)`,
            color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>保存</button>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", borderRadius: 12,
            border: `1px solid ${C.border}`, background: "transparent",
            color: C.textMuted, fontSize: 14, cursor: "pointer",
          }}>取消</button>
        </div>
      </div>
    </div>
  );
}

// ─── Current Trajectory (from Prediction) ────────────────────────────────────

function TrajectoryBadge({ current, goal }: { current: Measurements; goal: string }) {
  const behavior = loadRecentBehavior();
  const isFatLoss = ["weight_loss", "recomposition"].includes(goal);
  const isMuscle = goal === "muscle_gain";

  // Target values
  // Conservative targets: -3% BF (achievable in ~12-16 weeks), +2kg muscle
  const targetBF = isFatLoss ? Math.max(12, current.bodyFatPercentage - 3)
    : isMuscle ? current.bodyFatPercentage + 1
    : current.bodyFatPercentage;
  const targetSMM = isMuscle ? current.skeletalMuscleMass + 2 : current.skeletalMuscleMass;

  const execCoeff = behavior.dataDays > 0
    ? 0.4 + (behavior.avgProtein / 100) * 0.3
      + (Math.min(1, behavior.trainingFreq / 4)) * 0.2
      + (behavior.avgRecovery > 0 ? (behavior.avgRecovery / 100) * 0.1 : 0.075)
    : 0.5;

  const weeklyRate = isMuscle ? 0.12 * execCoeff : 0.35 * execCoeff;
  const delta = isMuscle
    ? Math.abs(targetSMM - current.skeletalMuscleMass)
    : Math.abs((targetBF - current.bodyFatPercentage) / 100) * current.weight;
  const weeksBase = delta / weeklyRate;
  const weeksMin = Math.max(4, Math.round(weeksBase / 1.2));
  const weeksMax = Math.round(weeksBase * 1.3);

  const currentVal = isMuscle ? `${current.skeletalMuscleMass.toFixed(1)}kg` : `${current.bodyFatPercentage.toFixed(1)}%`;
  const targetVal = isMuscle ? `${targetSMM.toFixed(1)}kg` : `${targetBF.toFixed(1)}%`;
  const metricLabel = isMuscle ? "目标骨骼肌" : "目标体脂";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
      borderRadius: 16, overflow: "hidden", marginBottom: 16,
      border: `1px solid ${C.violet}25`,
    }}>
      {[
        { label: isMuscle ? "当前骨骼肌" : "当前体脂", val: currentVal, color: C.textSub },
        { label: metricLabel, val: targetVal, color: C.violet },
        { label: "预计仍需", val: `${weeksMin}–${weeksMax} 周`, color: C.violet },
      ].map((item, i) => (
        <div key={i} style={{
          padding: "12px 16px", textAlign: "center",
          background: i === 2 ? "rgba(139,92,246,0.10)" : "rgba(139,92,246,0.05)",
          borderRight: i < 2 ? `1px solid ${C.violet}20` : "none",
        }}>
          <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: item.color }}>{item.val}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BodyCompPage({ state }: { state: AppState }) {
  const m = state.measurements;
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>(() => loadScanHistory());
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trendRange] = useState<TrendRange>("90");

  const behavior = useMemo(() => loadRecentBehavior(), []);

  // Build full scan list: history + current
  const allScans = useMemo((): ScanRecord[] => {
    const today = new Date().toISOString().slice(0, 10);
    const currentScan: ScanRecord = {
      date: today, label: "当前",
      measurements: m,
    };
    // Merge history + current, sort by date
    const merged = [...scanHistory.filter(s => s.date !== today), currentScan];
    return merged.sort((a, b) => a.date.localeCompare(b.date));
  }, [scanHistory, m]);

  const prevScan = allScans.length >= 2 ? allScans[allScans.length - 2] : null;
  const prev = prevScan?.measurements ?? null;

  // Personal best over last 90 days
  const personalBest = useMemo(() => {
    const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recent = allScans.filter(s => s.date >= ninetyDaysAgo.toISOString().slice(0, 10));
    if (recent.length < 2) return null;
    const bfVals = recent.map(s => s.measurements.bodyFatPercentage).filter((v): v is number => v !== undefined && v > 0);
    const smmVals = recent.map(s => s.measurements.skeletalMuscleMass).filter((v): v is number => v !== undefined && v > 0);
    return {
      bestBF: bfVals.length > 0 ? Math.min(...bfVals) : null,
      bestSMM: smmVals.length > 0 ? Math.max(...smmVals) : null,
    };
  }, [allScans]);

  const direction = useMemo(() => genBodyDirection(m, prev, behavior, state.goal), [m, prev, behavior, state.goal]);
  const interpretation = useMemo(() => genInterpretation(m, prev, behavior, state.goal), [m, prev, behavior, state.goal]);

  // Trend data for charts
  const trendDays = parseInt(trendRange);
  const trendScans = allScans.filter(s => {
    const d = new Date(); d.setDate(d.getDate() - trendDays);
    return s.date >= d.toISOString().slice(0, 10);
  });

  const handleAddScan = (record: ScanRecord) => {
    const updated = [...scanHistory.filter(s => s.date !== record.date), record]
      .sort((a, b) => a.date.localeCompare(b.date));
    setScanHistory(updated);
    saveScanHistory(updated);
  };

  const handleDeleteScan = (date: string) => {
    const updated = scanHistory.filter(s => s.date !== date);
    setScanHistory(updated);
    saveScanHistory(updated);
  };

  const GOAL_LABEL = GOAL_CN[state.goal] ?? state.goal;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.sky, marginBottom: 6, textTransform: "uppercase" }}>
          Body Composition
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>
          身体成分
        </h2>
        <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
          {GOAL_LABEL} · {allScans.length} 次扫描记录
        </div>
      </div>

      {/* Trajectory badge */}
      <TrajectoryBadge current={m} goal={state.goal} />

      {/* ── ① Scan Conclusion (most prominent) ── */}
      <div style={{ ...g({ padding: "22px 24px", border: `1px solid ${C.sky}30` }), marginBottom: 16, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${C.sky}06 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ fontSize: 11, color: C.sky, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, fontWeight: 700 }}>
          {prevScan ? `过去 ${Math.round((new Date().getTime() - new Date(prevScan.date).getTime()) / (1000*60*60*24*7))} 周` : "本次扫描结论"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {direction.signals.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 10,
              background: s.icon === "✓" ? "rgba(16,185,129,0.07)" : s.icon === "⚠" ? "rgba(245,158,11,0.07)" : "rgba(244,63,94,0.07)",
            }}>
              <span style={{ fontSize: 15, color: s.color, fontWeight: 800, minWidth: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 13, color: s.icon === "✓" ? C.text : C.textSub, fontWeight: s.icon === "✓" ? 600 : 400 }}>{s.text}</span>
            </div>
          ))}
        </div>
        {/* Next stage optimization */}
        {direction.signals.some(s => s.icon === "⚠") && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(245,158,11,0.08)", border: `1px solid ${C.amber}25`, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12 }}>🎯</span>
            <div>
              <span style={{ fontSize: 11, color: C.textMuted }}>下一阶段最值得优化：</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginLeft: 4 }}>
                {direction.signals.find(s => s.icon === "⚠")?.text.split("，")[0].replace("⚠", "").trim()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── ② Since Last Scan ── */}
      <div style={{ ...g({ padding: "20px 24px" }), marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {prev ? `与上次扫描对比（${prevScan?.label ?? prevScan?.date}）` : "基准快照"}
          </div>
          <button onClick={() => setShowAddModal(true)} style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
            border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted,
          }}>
            + 录入历史数据
          </button>
        </div>

        {!prev ? (
          <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(14,165,233,0.08)", border: `1px solid ${C.sky}20` }}>
            <p style={{ fontSize: 13, color: C.textSub, margin: 0, lineHeight: 1.6 }}>
              这是你的起点。完成下一次扫描后，系统将开始分析身体变化趋势。<br />
              <span style={{ fontSize: 11, color: C.textMuted }}>高级用户可点击"录入历史数据"导入以往扫描结果。</span>
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "体重", curr: m.weight, p: prev.weight, unit: "kg", color: C.text, invert: false },
              { label: "体脂率", curr: m.bodyFatPercentage, p: prev.bodyFatPercentage, unit: "%", color: C.amber, invert: true },
              { label: "骨骼肌", curr: m.skeletalMuscleMass, p: prev.skeletalMuscleMass, unit: "kg", color: C.emerald, invert: false },
            ].map((item, i) => {
              const delta = item.p !== undefined ? item.curr - item.p : null;
              const isGood = delta !== null ? (item.invert ? delta < 0 : delta > 0) : null;
              const deltaColor = delta === null ? C.textMuted
                : Math.abs(delta) < 0.15 ? C.textMuted
                : isGood ? C.emerald : C.rose;
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>{item.label}</div>
                  {item.p !== undefined && (
                    <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
                      {item.p.toFixed(1)} → <span style={{ color: item.color, fontWeight: 700 }}>{item.curr.toFixed(1)}</span>
                      <span style={{ fontSize: 10 }}>{item.unit}</span>
                    </div>
                  )}
                  {delta !== null && (
                    <div style={{ fontSize: 16, fontWeight: 800, color: deltaColor }}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}{item.unit}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── ③ What This Means ── */}
      <div style={{ ...g({ padding: "20px 24px", border: `1px solid ${C.violet}20` }), marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.violet, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, fontWeight: 700 }}>
          What This Means
        </div>
        <p style={{ fontSize: 14, color: C.textSub, lineHeight: 1.8, margin: 0 }}>
          {interpretation}
        </p>
      </div>

      {/* Contributors */}
      <ContributorsCard behavior={behavior} />

      {/* ── Personal Best ── */}
      {personalBest && (personalBest.bestBF !== null || personalBest.bestSMM !== null) && (
        <div style={{ ...g({ padding: "16px 20px" }), marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            过去90天最佳
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {personalBest.bestBF !== null && (
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>最低体脂</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: C.amber }}>{personalBest.bestBF.toFixed(1)}%</span>
                  {m.bodyFatPercentage > 0 && personalBest.bestBF < m.bodyFatPercentage && (
                    <span style={{ fontSize: 11, color: C.rose }}>当前 {m.bodyFatPercentage.toFixed(1)}% ↑{(m.bodyFatPercentage - personalBest.bestBF).toFixed(1)}%</span>
                  )}
                  {m.bodyFatPercentage > 0 && personalBest.bestBF >= m.bodyFatPercentage && (
                    <span style={{ fontSize: 11, color: C.emerald }}>当前最佳 ✓</span>
                  )}
                </div>
              </div>
            )}
            {personalBest.bestSMM !== null && (
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>最高骨骼肌</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: C.emerald }}>{personalBest.bestSMM.toFixed(1)}kg</span>
                  {m.skeletalMuscleMass > 0 && personalBest.bestSMM > m.skeletalMuscleMass && (
                    <span style={{ fontSize: 11, color: C.rose }}>当前 {m.skeletalMuscleMass.toFixed(1)}kg ↓{(personalBest.bestSMM - m.skeletalMuscleMass).toFixed(1)}kg</span>
                  )}
                  {m.skeletalMuscleMass > 0 && personalBest.bestSMM <= m.skeletalMuscleMass && (
                    <span style={{ fontSize: 11, color: C.emerald }}>当前最佳 ✓</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ④ Long-Term Trends ── */}
      <div style={{ ...g({ padding: "20px 24px" }), marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            长期趋势 · {allScans.length} 次扫描
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            {allScans.length < 2 ? "录入更多扫描数据后显示" : `${allScans[0].date} 至今`}
          </div>
        </div>

        {trendScans.length >= 2 ? (
          <>
            <TrendLine
              data={trendScans.filter(s => s.measurements.weight).map(s => ({ date: s.date, value: s.measurements.weight! }))}
              color={C.text} label="体重" unit="kg"
            />
            <TrendLine
              data={trendScans.filter(s => s.measurements.bodyFatPercentage).map(s => ({ date: s.date, value: s.measurements.bodyFatPercentage! }))}
              color={C.amber} label="体脂率" unit="%"
            />
            <TrendLine
              data={trendScans.filter(s => s.measurements.skeletalMuscleMass).map(s => ({ date: s.date, value: s.measurements.skeletalMuscleMass! }))}
              color={C.emerald} label="骨骼肌" unit="kg"
            />
          </>
        ) : (
          <div style={{ padding: "20px", textAlign: "center", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
              至少需要 2 次扫描数据才能显示趋势图<br />
              <span style={{ fontSize: 11 }}>点击"录入历史数据"导入以往 InBody 扫描结果</span>
            </div>
          </div>
        )}
      </div>

      {/* ── ⑤ Advanced Metrics (折叠) ── */}
      <div style={g({ padding: "0" })}>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: "100%", padding: "16px 24px", background: "transparent", border: "none",
            display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Advanced Metrics
          </span>
          <span style={{ fontSize: 12, color: C.textMuted, transition: "transform 0.2s", transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)" }}>
            ▾
          </span>
        </button>

        {showAdvanced && (
          <div style={{ padding: "0 24px 20px", borderTop: `1px solid ${C.border}` }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              {[
                { label: "去脂体重 (LBM)", val: `${m.leanBodyMass.toFixed(1)} kg`, color: C.emerald },
                { label: "基础代谢 (BMR)", val: `${m.basalMetabolicRate} kcal`, color: C.violet },
                { label: "体质指数 (BMI)", val: m.bmi.toFixed(1), color: C.sky },
                { label: "内脏脂肪", val: `${m.visceralFatLevel} 级`, color: m.visceralFatLevel >= 10 ? C.rose : m.visceralFatLevel >= 6 ? C.amber : C.emerald },
                { label: "总体水分", val: `${m.totalBodyWater.toFixed(1)} L`, color: C.sky },
                { label: "ECW/TBW", val: m.intracellularWater > 0 ? ((m.extracellularWater / (m.intracellularWater + m.extracellularWater)) * 100).toFixed(1) + "%" : "-", color: C.sky },
                { label: "蛋白质 (kg)", val: `${m.protein.toFixed(1)} kg`, color: C.emerald },
                { label: "矿物质 (kg)", val: `${m.minerals.toFixed(1)} kg`, color: C.textSub },
              ].map((item, i) => (
                <div key={i} style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: item.color }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Scan history management */}
            {scanHistory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  历史扫描记录
                </div>
                {scanHistory.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{s.label || s.date}</span>
                      <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>
                        {s.measurements.weight}kg · 体脂{s.measurements.bodyFatPercentage}% · 肌肉{s.measurements.skeletalMuscleMass}kg
                      </span>
                    </div>
                    <button onClick={() => handleDeleteScan(s.date)} style={{
                      padding: "3px 10px", borderRadius: 8, fontSize: 11,
                      border: `1px solid ${C.border}`, background: "transparent",
                      color: C.textMuted, cursor: "pointer",
                    }}>删除</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add scan modal */}
      {showAddModal && (
        <AddScanModal
          onSave={handleAddScan}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
