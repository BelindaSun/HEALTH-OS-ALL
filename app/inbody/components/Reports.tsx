"use client";

import React, { useState, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MorningCheckin {
  weight?: number;
  sleep?: number;
  stress?: number;
  energy?: number;
}

interface EveningCheckin {
  proteinPct?: number;
  waterLiters?: number;
  mood?: number;
}

interface DailyCheckin {
  morning?: MorningCheckin;
  evening?: EveningCheckin;
}

interface DayPoint {
  date: string;
  label: string;
  value: number | null;
}

type Range = "7" | "30";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatesBack(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

function loadCheckin(date: string): DailyCheckin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`checkin_${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasTraining(date: string): boolean {
  try {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem(`training_${date}`)
        : null;
    if (!raw) return false;
    const sessions = JSON.parse(raw);
    return Array.isArray(sessions) && sessions.length > 0;
  } catch {
    return false;
  }
}

// Weight presets — must stay in sync with compliance.ts COMPLIANCE_WEIGHTS
type HealthGoal = "fat_loss" | "muscle_gain" | "fitness" | "sleep_recovery";
const COMPLIANCE_WEIGHTS: Record<HealthGoal, [number, number, number, number]> = {
  fat_loss:       [0.35, 0.20, 0.30, 0.15],
  muscle_gain:    [0.35, 0.10, 0.35, 0.20],
  fitness:        [0.25, 0.20, 0.30, 0.25],
  sleep_recovery: [0.20, 0.25, 0.15, 0.40],
};
const DEFAULT_WEIGHTS: [number, number, number, number] = [0.30, 0.25, 0.25, 0.20];

function loadHealthGoal(): HealthGoal | undefined {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem("inbody_os_state") : null;
    return raw ? JSON.parse(raw).healthGoal : undefined;
  } catch { return undefined; }
}

function calcDayCompliance(date: string, checkin: DailyCheckin): number {
  const goal = loadHealthGoal();
  const [wProtein, wWater, wTraining, wSleep] = goal
    ? (COMPLIANCE_WEIGHTS[goal] ?? DEFAULT_WEIGHTS)
    : DEFAULT_WEIGHTS;

  const protein = Math.min(100, checkin.evening?.proteinPct ?? 0);
  // Water: uses waterMl with 2000ml target — same as compliance.ts
  const waterMl = (checkin.evening as any)?.waterMl;
  const water = waterMl !== undefined ? Math.min(100, Math.round((waterMl / 2000) * 100)) : 0;
  // Sleep: uses sleepDuration index (0-4) with same score map as compliance.ts
  // [<5h=30, 5-6h=55, 6-7h=75, 7-8h=100, >8h=90]
  const sleepScoreMap = [30, 55, 75, 100, 90];
  const sleepDuration = (checkin.morning as any)?.sleepDuration;
  const sleep = sleepDuration !== undefined ? sleepScoreMap[sleepDuration] ?? 0 : 0;
  const training = hasTraining(date) ? 100 : 0;

  return Math.round(
    protein * wProtein + water * wWater + training * wTraining + sleep * wSleep,
  );
}

function forwardFill(points: DayPoint[]): DayPoint[] {
  let last: number | null = null;
  return points.map((p) => {
    if (p.value !== null) {
      last = p.value;
      return p;
    }
    return { ...p, value: last };
  });
}

// ─── System Diagnosis ─────────────────────────────────────────────────────────
// Produces the top-level "AI already read everything" summary

interface DiagnosisResult {
  headline: string; // e.g. "系统运行正常"
  headlineColor: string;
  lines: string[]; // 2-3 bullet observations
  action: string; // single bottom recommendation
}

function genDiagnosis(
  days: number,
  avgCompliance: number | null,
  avgProtein: number | null,
  trainingDays: number,
  weightTrend: number | null,
): DiagnosisResult {
  const hasData = avgCompliance !== null;

  if (!hasData) {
    return {
      headline: "数据积累中",
      headlineColor: "#64748b",
      lines: ["完成几次 Check-in 后，这里会给你完整的系统诊断。"],
      action: "先去完成今天的晨间或晚间 Check-in。",
    };
  }

  const comp = avgCompliance!;
  const prot = avgProtein ?? 0;
  const trainRate = Math.round((trainingDays / days) * 100);

  // Headline
  let headline = "系统运行正常";
  let headlineColor = "#10b981";
  if (comp < 40) {
    headline = "系统需要重启";
    headlineColor = "#f43f5e";
  } else if (comp < 65) {
    headline = "系统波动较大";
    headlineColor = "#f59e0b";
  } else if (comp >= 85) {
    headline = "系统运行优秀";
    headlineColor = "#10b981";
  }

  // Observations
  const lines: string[] = [];

  if (prot >= 85)
    lines.push(
      `蛋白执行优秀，${days}天均值达标率 ${prot.toFixed(0)}%，是目前最稳定的健康行为。`,
    );
  else if (prot >= 65)
    lines.push(
      `蛋白达标率 ${prot.toFixed(0)}%，还有提升空间，重点加强晚餐蛋白比例。`,
    );
  else lines.push(`蛋白达标率仅 ${prot.toFixed(0)}%，是当前最大的营养缺口。`);

  if (trainRate >= 70)
    lines.push(
      `训练频率高，${days}天内有 ${trainingDays} 天记录了训练，身体刺激充足。`,
    );
  else if (trainingDays > 0)
    lines.push(
      `训练数据开始积累，${days}天内完成 ${trainingDays} 次，继续建立节律。`,
    );
  else lines.push(`暂无训练记录，适当增加运动频率有助于整体执行率提升。`);

  if (comp < 65) lines.push(`执行一致性是当前最大瓶颈，均值 ${comp}%。`);

  // Weight observation
  if (weightTrend !== null) {
    if (Math.abs(weightTrend) < 0.3)
      lines.push("体重稳定，波动在正常水分范围内。");
    else if (weightTrend < 0)
      lines.push(`体重下降 ${Math.abs(weightTrend).toFixed(1)} kg，赤字稳定。`);
    else
      lines.push(
        `体重上升 ${weightTrend.toFixed(1)} kg，注意区分增肌还是水分。`,
      );
  }

  // Action
  let action = "保持当前节律，持续记录。";
  if (comp < 40) action = "本周只关注一个目标，先把执行率稳定到 60% 以上。";
  else if (comp < 65) action = "找出拖分最多的维度，集中突破一项。";
  else if (prot < 65) action = "蛋白是当前最大缺口，优先补足每日蛋白摄入。";
  else if (trainRate < 30 && days >= 7)
    action = "增加训练频率，每周至少 3 次有记录的训练。";

  return { headline, headlineColor, lines: lines.slice(0, 3), action };
}

// ─── Per-card Insight ─────────────────────────────────────────────────────────

interface CardInsight {
  badge: string; // e.g. "蛋白目标执行优秀"
  badgeColor: string;
  detail: string; // one sentence with the number
}

function genCardInsight(
  label: "执行率" | "蛋白" | "体重",
  vals: number[],
  unit: string,
): CardInsight {
  if (vals.length < 2) {
    return {
      badge: "数据积累中",
      badgeColor: "#475569",
      detail: "继续记录后即可查看趋势分析。",
    };
  }

  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const latest = vals[vals.length - 1];
  const first = vals[0];
  const trend = latest - first;

  if (label === "执行率") {
    if (avg >= 80)
      return {
        badge: "执行一致性强",
        badgeColor: "#10b981",
        detail: `过去 ${vals.length} 天平均执行率 ${avg.toFixed(0)}%，习惯已经稳定成型。`,
      };
    if (avg >= 60)
      return {
        badge: trend > 5 ? "执行率持续上升" : "执行率基本稳定",
        badgeColor: "#f59e0b",
        detail: `过去 ${vals.length} 天平均执行率 ${avg.toFixed(0)}%，${trend > 5 ? "势头不错，继续。" : "还有提升空间。"}`,
      };
    return {
      badge: "未形成稳定习惯",
      badgeColor: "#f43f5e",
      detail: `过去 ${vals.length} 天平均执行率 ${avg.toFixed(0)}%，建议本周只关注一个目标。`,
    };
  }

  if (label === "蛋白") {
    if (avg >= 85)
      return {
        badge: "蛋白目标执行优秀",
        badgeColor: "#10b981",
        detail: `过去 ${vals.length} 天达标率 ${avg.toFixed(0)}%，这是目前最稳定的健康行为。`,
      };
    if (avg >= 65)
      return {
        badge: trend > 0 ? "蛋白摄入在改善" : "蛋白摄入基本达标",
        badgeColor: "#f59e0b",
        detail: `过去 ${vals.length} 天达标率 ${avg.toFixed(0)}%，可以试试提前备一餐高蛋白食物。`,
      };
    return {
      badge: "蛋白缺口持续存在",
      badgeColor: "#f43f5e",
      detail: `过去 ${vals.length} 天达标率 ${avg.toFixed(0)}%，考虑增加进餐频率或提高每餐蛋白密度。`,
    };
  }

  // 体重
  const absTrend = Math.abs(trend);
  if (absTrend < 0.3)
    return {
      badge: "体重保持稳定",
      badgeColor: "#10b981",
      detail: `波动在 0.3 kg 以内，大概率是水分变化，非组织改变。`,
    };
  if (trend < 0)
    return {
      badge: "体重持续下降",
      badgeColor: "#10b981",
      detail: `周期内下降 ${absTrend.toFixed(1)} kg，赤字稳定，体成分在变化。`,
    };
  return {
    badge: "体重有所上升",
    badgeColor: "#f59e0b",
    detail: `周期内上升 ${absTrend.toFixed(1)} kg，确认是增肌还是恢复/水分问题。`,
  };
}

// ─── SVG Sparkline ────────────────────────────────────────────────────────────

function SparkLine({
  points,
  color,
  unit,
  minVal,
  maxVal,
}: {
  points: DayPoint[];
  color: string;
  unit: string;
  minVal?: number;
  maxVal?: number;
}) {
  const W = 520;
  const H = 90;
  const PAD = { top: 8, bottom: 20, left: 32, right: 8 };
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  if (values.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-20 text-xs"
        style={{ color: "#334155" }}
      >
        暂无数据
      </div>
    );
  }
  const lo = minVal ?? Math.min(...values);
  const hi = maxVal ?? Math.max(...values);
  const range = hi - lo || 1;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = points.length;
  const px = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const py = (v: number) => PAD.top + innerH - ((v - lo) / range) * innerH;

  const segments: string[] = [];
  let seg = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (seg) segments.push(seg);
      seg = "";
      return;
    }
    const x = px(i);
    const y = py(p.value);
    seg += seg ? ` L${x},${y}` : `M${x},${y}`;
  });
  if (seg) segments.push(seg);

  const firstIdx = points.findIndex((p) => p.value !== null);
  const lastIdx = points.reduce(
    (acc, p, i) => (p.value !== null ? i : acc),
    firstIdx,
  );
  const areaPath = segments[0]
    ? `${segments[0]} L${px(lastIdx)},${PAD.top + innerH} L${px(firstIdx)},${PAD.top + innerH} Z`
    : "";

  const step = n <= 7 ? 1 : Math.ceil(n / 7);
  const labelIndices = points.reduce<number[]>((acc, _, i) => {
    if (i % step === 0 || i === n - 1) acc.push(i);
    return acc;
  }, []);

  const gradId = `grad-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + innerH * (1 - t);
        const val = lo + range * t;
        return (
          <g key={t}>
            <line
              x1={PAD.left}
              y1={y}
              x2={W - PAD.right}
              y2={y}
              stroke="#1e293b"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 4}
              y={y + 4}
              textAnchor="end"
              fontSize="9"
              fill="#475569"
            >
              {Number.isInteger(val) ? val : val.toFixed(1)}
              {unit === "%" ? "%" : ""}
            </text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {points.map((p, i) =>
        p.value !== null ? (
          <circle
            key={i}
            cx={px(i)}
            cy={py(p.value)}
            r="2.5"
            fill={color}
            opacity="0.85"
          />
        ) : null,
      )}
      {labelIndices.map((i) => (
        <text
          key={i}
          x={px(i)}
          y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill="#475569"
        >
          {points[i].label}
        </text>
      ))}
    </svg>
  );
}

// ─── Trend Card ───────────────────────────────────────────────────────────────

function TrendCard({
  title,
  icon,
  color,
  points,
  unit,
  insight,
  minVal,
  maxVal,
}: {
  title: string;
  icon: string;
  color: string;
  points: DayPoint[];
  unit: string;
  insight: CardInsight;
  minVal?: number;
  maxVal?: number;
}) {
  const vals: number[] = points
    .map((p) => p.value)
    .filter(
      (v): v is number =>
        v !== null && v !== undefined && typeof v === "number",
    );
  const latest: number | null = vals.length > 0 ? vals[vals.length - 1] : null;
  const prev: number | null = vals.length > 1 ? vals[vals.length - 2] : null;
  const delta: number | null =
    latest !== null && prev !== null ? latest - prev : null;

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Title row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-slate-300">{title}</span>
        </div>
        {latest != null && !isNaN(Number(latest)) && (
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-semibold" style={{ color }}>
              {unit === "%"
                ? `${Number(latest).toFixed(0)}%`
                : `${Number(latest).toFixed(1)} kg`}
            </span>
            {delta != null &&
              !isNaN(Number(delta)) &&
              Math.abs(Number(delta)) > 0.05 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{
                    background:
                      Number(delta) > 0
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(244,63,94,0.15)",
                    color: Number(delta) > 0 ? "#10b981" : "#f43f5e",
                  }}
                >
                  {Number(delta) > 0 ? "+" : ""}
                  {unit === "%"
                    ? `${Number(delta).toFixed(0)}pt`
                    : `${Number(delta).toFixed(1)}`}
                </span>
              )}
          </div>
        )}
      </div>

      {/* Insight badge */}
      <div className="mb-1">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            background: insight.badgeColor + "22",
            color: insight.badgeColor,
          }}
        >
          {insight.badge}
        </span>
      </div>

      {/* Insight detail */}
      <p className="text-xs mb-4 leading-relaxed" style={{ color: "#94a3b8" }}>
        {insight.detail}
      </p>

      {/* Chart */}
      <SparkLine
        points={points}
        color={color}
        unit={unit}
        minVal={minVal}
        maxVal={maxVal}
      />
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [range, setRange] = useState<Range>("7");
  const days = parseInt(range, 10);
  const dates = useMemo(() => getDatesBack(days), [days]);

  const checkinMap = useMemo(() => {
    const map: Record<string, DailyCheckin> = {};
    dates.forEach((d) => {
      const c = loadCheckin(d);
      if (c) map[d] = c;
    });
    return map;
  }, [dates]);

  function buildPoints(
    extractor: (date: string, c: DailyCheckin | null) => number | null,
    fill: boolean,
  ): DayPoint[] {
    const raw: DayPoint[] = dates.map((d) => {
      const [, m, day] = d.split("-");
      const label = `${parseInt(m)}/${parseInt(day)}`;
      const c = checkinMap[d] ?? null;
      return { date: d, label, value: c !== null ? extractor(d, c) : null };
    });
    return fill ? forwardFill(raw) : raw;
  }

  const compliancePoints = useMemo(
    () =>
      buildPoints((date, c) => (c ? calcDayCompliance(date, c) : null), false),
    [checkinMap, dates],
  );

  const proteinPoints = useMemo(
    () =>
      buildPoints((_, c) => {
        const v = c?.evening?.proteinPct;
        return v !== undefined ? Math.min(100, v) : null;
      }, false),
    [checkinMap, dates],
  );

  const weightPoints = useMemo(
    () =>
      buildPoints((_, c) => {
        const v = c?.morning?.weight;
        return v !== undefined && v > 0 ? v : null;
      }, true),
    [checkinMap, dates],
  );

  // Derived stats for diagnosis
  const compVals = compliancePoints
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const protVals = proteinPoints
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const wtVals = weightPoints
    .map((p) => p.value)
    .filter((v): v is number => v !== null);
  const avgCompliance = compVals.length
    ? Math.round(compVals.reduce((a, b) => a + b) / compVals.length)
    : null;
  const avgProtein = protVals.length
    ? Math.round(protVals.reduce((a, b) => a + b) / protVals.length)
    : null;
  const trainingDays = dates.filter((d) => hasTraining(d)).length;
  const weightTrend =
    wtVals.length >= 2 ? wtVals[wtVals.length - 1] - wtVals[0] : null;

  const diagnosis = useMemo(
    () =>
      genDiagnosis(days, avgCompliance, avgProtein, trainingDays, weightTrend),
    [days, avgCompliance, avgProtein, trainingDays, weightTrend],
  );

  const compInsight = useMemo(
    () => genCardInsight("执行率", compVals, "%"),
    [compVals],
  );
  const protInsight = useMemo(
    () => genCardInsight("蛋白", protVals, "%"),
    [protVals],
  );
  const wtInsight = useMemo(
    () => genCardInsight("体重", wtVals, "kg"),
    [wtVals],
  );

  return (
    <div
      style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40, color: "#e2e8f0" }}
    >
      {/* Weekly Coach Header */}
      <div className="mb-5">
        <div style={{ fontSize: 10, color: "#475569", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Weekly Coach</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", marginBottom: 4 }}>本周教练信</h1>
        <div style={{ fontSize: 11, color: "#475569" }}>
          {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
        </div>
      </div>

      {/* Range Toggle */}
      <div className="flex items-center justify-end mb-4">
        <div style={{ display: "inline-flex", borderRadius: 12, padding: 4, background: "rgba(15,23,42,0.85)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {(["7", "30"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={range === r ? { background: "#10b981", color: "#020817" } : { color: "#64748b" }}
            >
              {r}天
            </button>
          ))}
        </div>
      </div>

      {/* ── Weekly Coach Body ── */}
      <div
        className="rounded-2xl p-5 mb-6"
        style={{
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(20px)",
          border: `1px solid ${diagnosis.headlineColor}33`,
        }}
      >
        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: diagnosis.headlineColor, display: "inline-block" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: diagnosis.headlineColor }}>{diagnosis.headline}</span>
        </div>

        {/* Letter body */}
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 14, fontStyle: "italic" }}>
          过去 {days} 天，你的身体系统运行情况如下：
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {diagnosis.lines.map((line: string, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ color: i === 0 ? diagnosis.headlineColor : "#475569", fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                {i === 0 ? "✦" : "·"}
              </span>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: i === 0 ? "#e2e8f0" : "#94a3b8", margin: 0 }}>{line}</p>
            </div>
          ))}
        </div>

        {/* Next week CTA */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
            下周只做一件事
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
            {diagnosis.action}
          </p>
        </div>
      </div>

      {/* ── Trend Cards ── */}
      <div className="flex flex-col gap-4">
        <TrendCard
          title="执行率趋势"
          icon="⬡"
          color="#10b981"
          points={compliancePoints}
          unit="%"
          insight={compInsight}
          minVal={0}
          maxVal={100}
        />
        <TrendCard
          title="蛋白达标趋势"
          icon="◎"
          color="#0ea5e9"
          points={proteinPoints}
          unit="%"
          insight={protInsight}
          minVal={0}
          maxVal={100}
        />
        <TrendCard
          title="体重变化"
          icon="◇"
          color="#8b5cf6"
          points={weightPoints}
          unit="kg"
          insight={wtInsight}
        />
      </div>

      <p className="text-center text-xs mt-6" style={{ color: "#334155" }}>
        体重取晨间 Check-in 数据，空缺日用前值填补
      </p>
    </div>
  );
}
