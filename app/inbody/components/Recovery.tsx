"use client";

import React, { useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MorningData {
  sleepDuration?: number; // 0-4 index: <5h/5-6h/6-7h/7-8h/>8h
  sleepQuality?: number;  // 1-5
  fatigue?: number;       // 1-10
  stress?: number;        // 1-10
  soreness?: number;      // 1-10
}

interface DailyCheckin {
  morning?: MorningData;
  morningDone?: boolean;
}

interface DayRecovery {
  date: string;
  label: string;
  recoveryScore: number | null;  // 0-100
  trainingLoad: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLEEP_DURATION_SCORES = [20, 50, 75, 100, 85]; // <5h→20, 5-6h→50, 6-7h→75, 7-8h→100, >8h→85
const SLEEP_DURATION_LABELS = ["< 5小时", "5-6小时", "6-7小时", "7-8小时", "> 8小时"];

// ─── Core Algorithm ───────────────────────────────────────────────────────────
// Recovery score = Sleep 45% + Quality 20% + Fatigue 15% + Stress 12% + Soreness 8%
// Sleep is the dominant signal — most research-backed predictor of recovery

export function calcRecoveryScore(morning: MorningData): number | null {
  const hasSleep = morning.sleepDuration !== undefined || morning.sleepQuality !== undefined;
  if (!hasSleep) return null;

  const sleepDurScore = morning.sleepDuration !== undefined
    ? SLEEP_DURATION_SCORES[morning.sleepDuration] ?? 0 : 75; // default 6-7h if unknown
  const sleepQualScore = morning.sleepQuality !== undefined
    ? (morning.sleepQuality / 5) * 100 : 75;
  const fatigueScore = morning.fatigue !== undefined
    ? Math.round((1 - (morning.fatigue - 1) / 9) * 100) : 75; // inverted: high fatigue = low score
  const stressScore = morning.stress !== undefined
    ? Math.round((1 - (morning.stress - 1) / 9) * 100) : 75;
  const sorenessScore = morning.soreness !== undefined
    ? Math.round((1 - (morning.soreness - 1) / 9) * 100) : 75;

  return Math.round(
    sleepDurScore * 0.45 +
    sleepQualScore * 0.20 +
    fatigueScore * 0.15 +
    stressScore * 0.12 +
    sorenessScore * 0.08
  );
}

// Recovery debt = weighted sum of daily deficits over 7 days
// Deficit = max(0, 60 - recoveryScore) — anything below 60 contributes to debt
// Recent days weighted higher (day 0 = today = weight 2.0, day 6 = weight 0.7)
export function calcRecoveryDebt(history: (number | null)[]): number {
  const weights = [2.0, 1.7, 1.4, 1.2, 1.0, 0.85, 0.7];
  let debt = 0;
  let totalWeight = 0;
  history.slice(0, 7).forEach((score, i) => {
    if (score === null) return;
    const w = weights[i] ?? 0.7;
    debt += Math.max(0, 60 - score) * w;
    totalWeight += w;
  });
  if (totalWeight === 0) return 0;
  return Math.min(100, Math.round(debt / totalWeight));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatesBack(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function loadCheckin(date: string): DailyCheckin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`checkin_${date}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadTrainingLoad(date: string): number | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(`training_${date}`) : null;
    if (!raw) return null;
    const td = JSON.parse(raw);
    return typeof td.totalLoad === "number" ? td.totalLoad : null;
  } catch { return null; }
}

// ─── Recommendation Engine ────────────────────────────────────────────────────

interface TrainingRec {
  label: string;
  color: string;
  desc: string;
  icon: string;
}

export function getTrainingRec(recoveryScore: number, debt: number): TrainingRec {
  if (recoveryScore < 35 || debt > 55) return {
    label: "完全休息", color: "#f43f5e", icon: "🛑",
    desc: "身体需要修复，强训会加深损伤",
  };
  if (recoveryScore < 50 || debt > 35) return {
    label: "主动恢复", color: "#f59e0b", icon: "🚶",
    desc: "散步、拉伸、瑜伽，不要增加负荷",
  };
  if (recoveryScore < 65) return {
    label: "中等训练", color: "#0ea5e9", icon: "🏃",
    desc: "适合中低强度，控制总负荷在150-250",
  };
  if (recoveryScore >= 80 && debt < 20) return {
    label: "可以全力训练", color: "#10b981", icon: "💪",
    desc: "恢复充足，适合高强度或力量突破",
  };
  return {
    label: "有效训练区间", color: "#10b981", icon: "✅",
    desc: "状态良好，正常训练计划执行",
  };
}

// ─── SVG Radar Chart ──────────────────────────────────────────────────────────

function RadarChart({ morning }: { morning: MorningData }) {
  const SIZE = 180;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const R = 68;

  const dims = [
    { label: "睡眠时长", value: morning.sleepDuration !== undefined ? SLEEP_DURATION_SCORES[morning.sleepDuration] / 100 : 0.75 },
    { label: "睡眠质量", value: morning.sleepQuality !== undefined ? (morning.sleepQuality - 1) / 4 : 0.75 },
    { label: "疲劳感",   value: morning.fatigue !== undefined ? 1 - (morning.fatigue - 1) / 9 : 0.75 },
    { label: "压力",     value: morning.stress !== undefined ? 1 - (morning.stress - 1) / 9 : 0.75 },
    { label: "酸痛",     value: morning.soreness !== undefined ? 1 - (morning.soreness - 1) / 9 : 0.75 },
  ];

  const angle = (i: number) => (Math.PI * 2 * i) / dims.length - Math.PI / 2;
  const pt = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const dataPath = dims
    .map((d, i) => { const p = pt(i, R * d.value); return `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; })
    .join(" ") + " Z";

  const gridLevels = [0.33, 0.66, 1.0];

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: SIZE, height: SIZE }}>
      {/* Grid */}
      {gridLevels.map((t, li) => (
        <polygon key={li}
          points={dims.map((_, i) => { const p = pt(i, R * t); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1"
        />
      ))}
      {/* Axes */}
      {dims.map((_, i) => {
        const p = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      {/* Data fill */}
      <path d={dataPath} fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Data dots */}
      {dims.map((d, i) => {
        const p = pt(i, R * d.value);
        return <circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r="3" fill="#10b981" />;
      })}
      {/* Labels */}
      {dims.map((d, i) => {
        const p = pt(i, R + 16);
        return (
          <text key={i} x={p.x.toFixed(1)} y={p.y.toFixed(1)}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fill="#64748b">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Dual Line Chart (Recovery vs Training Load) ───────────────────────────────

function DualLineChart({ history }: { history: DayRecovery[] }) {
  const W = 520; const H = 110;
  const PAD = { top: 10, bottom: 22, left: 28, right: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const n = history.length;

  const recovScores = history.map(d => d.recoveryScore).filter((v): v is number => v !== null);
  const loadVals = history.map(d => d.trainingLoad).filter((v): v is number => v !== null);
  const maxLoad = loadVals.length > 0 ? Math.max(...loadVals, 300) : 300;

  const px = (i: number) => PAD.left + (i / Math.max(n - 1, 1)) * innerW;
  const pyRecov = (v: number) => PAD.top + innerH - (v / 100) * innerH;
  const pyLoad = (v: number) => PAD.top + innerH - (v / maxLoad) * innerH;

  // Build path from non-null points
  function buildPath(getter: (d: DayRecovery) => number | null, yFn: (v: number) => number): string {
    let path = "";
    history.forEach((d, i) => {
      const v = getter(d);
      if (v === null) return;
      const x = px(i).toFixed(1);
      const y = yFn(v).toFixed(1);
      path += path ? ` L${x},${y}` : `M${x},${y}`;
    });
    return path;
  }

  const recovPath = buildPath(d => d.recoveryScore, pyRecov);
  const loadPath = buildPath(d => d.trainingLoad, pyLoad);

  // 60% recovery threshold line
  const threshY = pyRecov(60);

  const stepLabel = n <= 7 ? 1 : Math.ceil(n / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid */}
      {[0, 50, 100].map(v => {
        const y = pyRecov(v);
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.left - 3} y={y + 4} textAnchor="end" fontSize="9" fill="#334155">{v}</text>
          </g>
        );
      })}

      {/* 60% threshold */}
      <line x1={PAD.left} y1={threshY} x2={W - PAD.right} y2={threshY}
        stroke="#f59e0b" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
      <text x={W - PAD.right + 3} y={threshY + 4} fontSize="8" fill="#f59e0b" opacity="0.7">60</text>

      {/* Recovery line */}
      {recovPath && <path d={recovPath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

      {/* Training load line (secondary axis) */}
      {loadPath && <path d={loadPath} fill="none" stroke="#8b5cf6" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,2" />}

      {/* Dots - recovery */}
      {history.map((d, i) => d.recoveryScore !== null
        ? <circle key={`r${i}`} cx={px(i).toFixed(1)} cy={pyRecov(d.recoveryScore).toFixed(1)}
            r="2.5" fill="#10b981" />
        : null
      )}
      {/* Dots - load */}
      {history.map((d, i) => d.trainingLoad !== null
        ? <circle key={`l${i}`} cx={px(i).toFixed(1)} cy={pyLoad(d.trainingLoad).toFixed(1)}
            r="2" fill="#8b5cf6" opacity="0.7" />
        : null
      )}

      {/* X labels */}
      {history.map((d, i) => (i % stepLabel === 0 || i === n - 1)
        ? <text key={i} x={px(i).toFixed(1)} y={H - 4} textAnchor="middle" fontSize="9" fill="#475569">{d.label}</text>
        : null
      )}

      {/* Legend */}
      <g>
        <line x1={W - PAD.right + 4} y1={PAD.top + 8} x2={W - PAD.right + 16} y2={PAD.top + 8} stroke="#10b981" strokeWidth="2" />
        <text x={W - PAD.right + 18} y={PAD.top + 12} fontSize="8" fill="#10b981">恢复</text>
        <line x1={W - PAD.right + 4} y1={PAD.top + 22} x2={W - PAD.right + 16} y2={PAD.top + 22}
          stroke="#8b5cf6" strokeWidth="1.5" strokeDasharray="4,2" />
        <text x={W - PAD.right + 18} y={PAD.top + 26} fontSize="8" fill="#8b5cf6">负荷</text>
      </g>
    </svg>
  );
}

// ─── Trend Insight ─────────────────────────────────────────────────────────────

function genTrendInsight(history: DayRecovery[], debt: number): { headline: string; detail: string } {
  const scores = history.map(d => d.recoveryScore).filter((v): v is number => v !== null);
  const loads = history.map(d => d.trainingLoad).filter((v): v is number => v !== null);

  if (scores.length < 2) return {
    headline: "数据积累中",
    detail: "坚持晨间 Check-in，3天后可以看到恢复趋势。",
  };

  const avg = Math.round(scores.reduce((a, b) => a + b) / scores.length);
  const trend = scores[scores.length - 1] - scores[0];
  const avgLoad = loads.length > 0 ? Math.round(loads.reduce((a, b) => a + b) / loads.length) : 0;
  const loadVsRecov = avgLoad > 250 && avg < 65;

  if (debt > 50) return {
    headline: "恢复债务较高，需要主动干预",
    detail: `过去7天累计恢复不足，建议本周降低训练强度，优先补眠。`,
  };
  if (loadVsRecov) return {
    headline: "训练负荷高于恢复能力",
    detail: `训练均值负荷 ${avgLoad}，恢复均分 ${avg}，负荷超出身体消化速度。`,
  };
  if (avg >= 75 && trend >= 0) return {
    headline: "恢复状态良好，趋势向上",
    detail: `${scores.length}天均值 ${avg}分，${trend > 5 ? "还在持续改善。" : "保持稳定。"}`,
  };
  if (avg >= 60) return {
    headline: "恢复基本够用",
    detail: `均值 ${avg}分，${trend < -10 ? "近期有下滑趋势，注意睡眠质量。" : "在正常范围内。"}`,
  };
  return {
    headline: "恢复持续偏低",
    detail: `均值仅 ${avg}分，最大瓶颈可能是睡眠时长或压力管理。`,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────


// ── RECOVERY CONCLUSION (human language) ─────────────────────
function RecoveryConclusion({ morning }: { morning: MorningData }) {
  const issues: string[] = [];
  const positives: string[] = [];

  // Sleep
  if (morning.sleepDuration !== undefined) {
    if (morning.sleepDuration <= 1) issues.push("睡眠严重不足（< 5小时）");
    else if (morning.sleepDuration === 2) issues.push("睡眠偏少（5-6小时）");
    else if (morning.sleepDuration >= 3) positives.push("睡眠时长充足");
  }
  if (morning.sleepQuality !== undefined) {
    if (morning.sleepQuality <= 2) issues.push("睡眠质量差");
    else if (morning.sleepQuality >= 4) positives.push("睡眠质量良好");
  }

  // Fatigue
  if (morning.fatigue !== undefined) {
    if (morning.fatigue >= 7) issues.push("疲劳积累明显");
    else if (morning.fatigue <= 3) positives.push("精力状态良好");
  }

  // Stress
  if (morning.stress !== undefined) {
    if (morning.stress >= 7) issues.push("压力水平偏高");
    else if (morning.stress <= 3) positives.push("压力水平低");
  }

  // Soreness
  if (morning.soreness !== undefined) {
    if (morning.soreness >= 7) issues.push("肌肉酸痛明显");
    else if (morning.soreness <= 2) positives.push("肌肉恢复良好");
  }

  if (issues.length === 0 && positives.length === 0) return null;

  return (
    <div style={{ padding: "12px 16px", borderRadius: 14,
      background: issues.length > 0 ? "rgba(245,158,11,0.08)" : "rgba(16,185,129,0.08)",
      border: `1px solid ${issues.length > 0 ? "#f59e0b" : "#10b981"}25`,
    }}>
      {issues.length > 0 && (
        <div style={{ marginBottom: positives.length > 0 ? 10 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", marginBottom: 6 }}>
            恢复质量主要受：
          </div>
          {issues.map((issue, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>{"①②③④⑤"[i]}</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{issue}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>影响</div>
        </div>
      )}
      {positives.length > 0 && issues.length === 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#10b981", marginBottom: 6 }}>恢复状态良好：</div>
          {positives.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: "#10b981" }}>✓</span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>{p}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RecoveryPage() {
  const dates7 = useMemo(() => getDatesBack(7), []);
  const dates14 = useMemo(() => getDatesBack(14), []);

  // Today's checkin
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCheckin = useMemo(() => loadCheckin(todayKey), [todayKey]);
  const todayMorning = todayCheckin?.morning ?? null;

  // Today's recovery score
  const todayScore = useMemo(() =>
    todayMorning ? calcRecoveryScore(todayMorning) : null,
  [todayMorning]);

  // 14-day history for chart
  const history14: DayRecovery[] = useMemo(() =>
    dates14.map(d => {
      const [, m, day] = d.split("-");
      const c = loadCheckin(d);
      return {
        date: d,
        label: `${parseInt(m)}/${parseInt(day)}`,
        recoveryScore: c?.morning ? calcRecoveryScore(c.morning) : null,
        trainingLoad: loadTrainingLoad(d),
      };
    }),
  [dates14]);

  // 7-day scores for debt calc (most recent first)
  const scores7 = useMemo(() =>
    [...dates7].reverse().map(d => {
      const c = loadCheckin(d);
      return c?.morning ? calcRecoveryScore(c.morning) : null;
    }),
  [dates7]);

  const debt = useMemo(() => calcRecoveryDebt(scores7), [scores7]);
  const rec = useMemo(() =>
    todayScore !== null ? getTrainingRec(todayScore, debt) : null,
  [todayScore, debt]);

  const trendInsight = useMemo(() => genTrendInsight(history14, debt), [history14, debt]);

  // Score color
  const scoreColor = todayScore === null ? "#475569"
    : todayScore >= 75 ? "#10b981"
    : todayScore >= 55 ? "#f59e0b"
    : "#f43f5e";

  // Debt color
  const debtColor = debt < 20 ? "#10b981" : debt < 40 ? "#f59e0b" : "#f43f5e";

  // Dim label for radar axes (inverted: high fatigue = bad)
  const hasMorning = todayMorning !== null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40, color: "#e2e8f0" }}>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white mb-1">恢复状态</h1>
        <p className="text-xs" style={{ color: "#64748b" }}>
          恢复决定你能不能吸收训练刺激。
        </p>
      </div>

      {/* ── Today Score Card ── */}
      <div className="rounded-2xl p-5 mb-4" style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${scoreColor}33`,
      }}>
        {hasMorning ? (
          <div className="flex items-start gap-5">
            {/* Score ring */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <svg viewBox="0 0 80 80" style={{ width: 80, height: 80 }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - (todayScore ?? 0) / 100)}`}
                  transform="rotate(-90 40 40)"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
                <text x="40" y="36" textAnchor="middle" fontSize="18" fontWeight="800" fill={scoreColor}>
                  {todayScore ?? "-"}
                </text>
                <text x="40" y="50" textAnchor="middle" fontSize="9" fill="#475569">恢复分</text>
              </svg>
            </div>

            {/* Recommendation */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{rec?.icon}</span>
                <span className="text-base font-bold" style={{ color: rec?.color ?? scoreColor }}>
                  {rec?.label ?? "数据不足"}
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "#94a3b8" }}>
                {rec?.desc ?? "完成晨间 Check-in 后查看建议"}
              </p>

              {/* Debt indicator */}
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#475569" }}>恢复债</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${debt}%`, background: debtColor }} />
                </div>
                <span className="text-xs font-bold" style={{ color: debtColor }}>{debt}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 gap-2">
            <span className="text-3xl">🌙</span>
            <p className="text-sm font-medium text-white">今日晨间 Check-in 未完成</p>
            <p className="text-xs" style={{ color: "#64748b" }}>完成后即可查看今日恢复评分</p>
          </div>
        )}
      </div>

      {/* ── Radar + Five Dims ── */}
      {hasMorning && (
        <div className="rounded-2xl p-5 mb-4" style={{
          background: "rgba(15,23,42,0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div className="text-xs font-medium mb-4" style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            五维分析
          </div>
          <div className="flex justify-center mb-4">
            <RadarChart morning={todayMorning!} />
          </div>
          {/* Human language conclusion */}
          <RecoveryConclusion morning={todayMorning!} />
        </div>
      )}

      {/* ── Trend Card ── */}
      <div className="rounded-2xl p-5 mb-4" style={{
        background: "rgba(15,23,42,0.85)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        <div className="text-xs font-medium mb-1" style={{ color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          14天恢复 vs 训练负荷
        </div>

        {/* Trend insight */}
        <p className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>{trendInsight.headline}</p>
        <p className="text-xs mb-4 leading-relaxed" style={{ color: "#94a3b8" }}>{trendInsight.detail}</p>

        <DualLineChart history={history14} />

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: "#10b981" }} />
            <span className="text-xs" style={{ color: "#475569" }}>恢复分（左轴 0-100）</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-px" style={{ background: "#8b5cf6", borderTop: "1px dashed #8b5cf6" }} />
            <span className="text-xs" style={{ color: "#475569" }}>训练负荷（相对轴）</span>
          </div>
        </div>
      </div>

      <p className="text-center text-xs mt-2" style={{ color: "#334155" }}>
        数据来自晨间 Check-in · 睡眠权重 45%
      </p>
    </div>
  );
}
