"use client";

import React, { useState, useMemo, useCallback } from "react";
import { C, g } from "../constants";
import { AppState } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PredictionInput {
  // Current body
  currentWeight: number;
  currentBF: number;       // body fat %
  currentSMM: number;      // skeletal muscle mass kg
  // Goals
  goal: string;
  // Behavioral data (from localStorage history)
  avgCompliance: number;   // 0-100
  avgRecovery: number;     // 0-100, null if no data
  trainingDaysPerWeek: number;
  avgProteinPct: number;   // 0-100
  dataDays: number;        // how many days of data we have
  // Profile
  bmr: number;
  activityLevel: string;
}

interface PredictionOutput {
  // Target
  targetWeight: number | null;
  targetBF: number | null;
  targetSMM: number | null;
  // Timeline
  weeksMin: number;
  weeksMax: number;
  probability: number;     // 0-100
  // Limiting factor
  limitingFactor: string;
  limitingDetail: string;
  // Watchouts
  watchouts: Watchout[];
}

interface Watchout {
  icon: string;
  title: string;
  detail: string;
  color: string;
  severity: "high" | "medium" | "low";
}

interface ScenarioParams {
  trainingDays: number;    // 1-7
  proteinPct: number;      // 0-100
  compliancePct: number;   // 0-100
  sleepHours: number;      // 5-9
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Weekly progress rates (kg/week) under perfect conditions
// Source: evidence-based ranges from sports science literature
const BASE_RATES = {
  fat_loss_kg_per_week: 0.35,      // realistic: 0.25-0.5kg/week
  muscle_gain_kg_per_week: 0.12,   // realistic: 0.1-0.15kg/week (intermediate)
};

// Goal target deltas (if user hasn't set explicit targets)
// Conservative targets — achievable in 12-20 weeks at realistic compliance
const GOAL_DEFAULTS: Record<string, { bfDelta: number; smmDelta: number; weightDelta: number }> = {
  weight_loss:   { bfDelta: -3,  smmDelta: 0,    weightDelta: -3  },
  muscle_gain:   { bfDelta: 1,   smmDelta: 2,    weightDelta: 2   },
  recomposition: { bfDelta: -2,  smmDelta: 1.5,  weightDelta: -1  },
  maintain:      { bfDelta: 0,   smmDelta: 0,    weightDelta: 0   },
};

// ─── Core Algorithm ───────────────────────────────────────────────────────────

function calcPrediction(input: PredictionInput): PredictionOutput {
  const {
    currentWeight, currentBF, currentSMM, goal,
    avgCompliance, avgRecovery, trainingDaysPerWeek,
    avgProteinPct, dataDays, activityLevel,
  } = input;

  const defaults = GOAL_DEFAULTS[goal] ?? GOAL_DEFAULTS.maintain;
  const targetBF = currentBF + defaults.bfDelta;
  const targetSMM = currentSMM + defaults.smmDelta;
  const targetWeight = currentWeight + defaults.weightDelta;

  // ── Execution coefficient (0.3 - 1.0) ──
  // How well user's current behavior matches requirements
  const compCoeff = 0.3 + (avgCompliance / 100) * 0.4;        // 0.3-0.7
  const recovCoeff = avgRecovery > 0
    ? 0.7 + (avgRecovery / 100) * 0.3                          // 0.7-1.0
    : 0.85;                                                     // default if no data
  const proteinCoeff = 0.6 + (avgProteinPct / 100) * 0.4;     // 0.6-1.0
  const trainingCoeff = Math.min(1.0, trainingDaysPerWeek / 4) * 0.8 + 0.2; // 0.2-1.0

  const execCoeff = compCoeff * 0.35 + recovCoeff * 0.25 + proteinCoeff * 0.25 + trainingCoeff * 0.15;

  // ── Weekly progress rate ──
  const isFatLoss = ["weight_loss", "recomposition"].includes(goal);
  const isMuscle = ["muscle_gain", "recomposition"].includes(goal);

  const weeklyFatLoss = BASE_RATES.fat_loss_kg_per_week * execCoeff;
  const weeklyMuscleGain = BASE_RATES.muscle_gain_kg_per_week * execCoeff;

  // ── Timeline calculation ──
  let weeksBase = 12; // fallback
  if (goal === "maintain") {
    weeksBase = 0;
  } else if (isFatLoss && Math.abs(defaults.bfDelta) > 0) {
    const fatToLose = Math.abs(defaults.bfDelta / 100) * currentWeight;
    weeksBase = fatToLose / weeklyFatLoss;
  } else if (isMuscle) {
    weeksBase = defaults.smmDelta / weeklyMuscleGain;
  }

  // Timeline range: optimistic (execCoeff * 1.2) to pessimistic (execCoeff * 0.8)
  const weeksMin = Math.max(4, Math.round(weeksBase / 1.2));
  const weeksMax = Math.round(weeksBase * 1.3);

  // ── Probability ──
  // Base probability from execution coefficient, adjusted for data quality
  const dataConfidence = Math.min(1, dataDays / 14); // need 14 days for full confidence
  const baseProbability = execCoeff * 100;
  const probability = Math.round(
    baseProbability * (0.7 + dataConfidence * 0.3) // data uncertainty reduces confidence
  );

  // ── Limiting factor ──
  const factors = [
    { name: "执行一致性", score: avgCompliance, detail: `当前执行率 ${avgCompliance}%，提升到 80% 可缩短约 ${Math.round(weeksBase * 0.3)} 周` },
    { name: "蛋白质摄入", score: avgProteinPct, detail: `蛋白达标率 ${avgProteinPct}%，充足蛋白是体成分变化的基础` },
    { name: "训练频率",   score: Math.min(100, trainingDaysPerWeek / 5 * 100), detail: `每周训练 ${trainingDaysPerWeek} 天，建议目标 ${isMuscle ? "4-5" : "3-4"} 天` },
    { name: "恢复质量",   score: avgRecovery > 0 ? avgRecovery : 70, detail: `恢复分 ${avgRecovery > 0 ? avgRecovery : "暂无数据"}，恢复不足会抑制适应` },
  ];
  const limiting = factors.reduce((a, b) => a.score < b.score ? a : b);

  // ── Watchouts ──
  const watchouts: Watchout[] = [];

  // Plateau risk: weight/BF not changing + compliance ok
  if (avgCompliance > 65 && dataDays >= 14) {
    // Check recent weight trend
    const recentWeights: number[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      try {
        const raw = typeof window !== "undefined"
          ? localStorage.getItem(`checkin_${d.toISOString().slice(0, 10)}`) : null;
        if (raw) {
          const ci = JSON.parse(raw);
          const w = parseFloat(ci.morning?.weight);
          if (!isNaN(w) && w > 0) recentWeights.push(w);
        }
      } catch {}
    }
    if (recentWeights.length >= 7) {
      const recentAvg = recentWeights.slice(0, 7).reduce((a, b) => a + b) / 7;
      const olderAvg = recentWeights.slice(7).reduce((a, b) => a + b) / recentWeights.slice(7).length;
      const weeklyChange = Math.abs(recentAvg - olderAvg);
      if (weeklyChange < 0.2 && isFatLoss) {
        watchouts.push({
          icon: "⚠️", severity: "medium", color: C.amber,
          title: "最近两周体重变化趋缓，可能进入平台期",
          detail: "建议：增加训练频率，或调整饮食结构（非减少热量）",
        });
      }
    }
  }

  // Overtraining risk: high load + low recovery
  if (avgRecovery > 0 && avgRecovery < 55 && trainingDaysPerWeek >= 4) {
    watchouts.push({
      icon: "🔴", severity: "high", color: C.rose,
      title: "恢复分持续偏低，训练负荷可能超过恢复能力",
      detail: "建议：安排 1 天主动恢复，减少高强度训练频率",
    });
  }

  // Habit collapse risk: compliance dropping
  if (avgCompliance < 45 && dataDays >= 7) {
    watchouts.push({
      icon: "⚠️", severity: "high", color: C.rose,
      title: "执行率持续偏低，习惯还未稳定",
      detail: "建议：本周只保留一个核心目标，先把执行率稳定到 60%+",
    });
  }

  // Protein gap risk
  if (avgProteinPct < 60 && (isMuscle || isFatLoss)) {
    watchouts.push({
      icon: "⚠️", severity: "medium", color: C.amber,
      title: `蛋白达标率仅 ${avgProteinPct}%，体成分改变会比预期慢`,
      detail: "建议：每餐优先安排蛋白质，目标每餐 ≥25g",
    });
  }

  // Fallback: always show something
  if (watchouts.length === 0) {
    if (dataDays < 7) {
      watchouts.push({
        icon: "📊", severity: "low", color: C.violet,
        title: "数据积累中，暂无明显风险信号",
        detail: `已记录 ${dataDays} 天，积累 7 天以上后可以看到更准确的风险分析。`,
      });
    } else if (avgCompliance >= 70) {
      watchouts.push({
        icon: "✅", severity: "low", color: C.emerald,
        title: "各项指标运行良好，保持当前节律",
        detail: "执行一致性是最大的复利，不需要大改，持续就是优势。",
      });
    } else {
      watchouts.push({
        icon: "💡", severity: "low", color: C.sky,
        title: `执行率 ${avgCompliance}%，还有提升空间`,
        detail: "没有明显风险，但稳定提升执行率是加速目标达成的最直接路径。",
      });
    }
  }

  return {
    targetWeight, targetBF, targetSMM,
    weeksMin, weeksMax,
    probability: Math.min(95, Math.max(15, probability)),
    limitingFactor: limiting.name,
    limitingDetail: limiting.detail,
    watchouts,
  };
}

// ─── Scenario Simulator ───────────────────────────────────────────────────────

function calcScenario(
  base: PredictionInput,
  params: ScenarioParams
): { weeksMin: number; weeksMax: number; probability: number } {
  const modified: PredictionInput = {
    ...base,
    avgCompliance: params.compliancePct,
    trainingDaysPerWeek: params.trainingDays,
    avgProteinPct: params.proteinPct,
    avgRecovery: Math.min(100, base.avgRecovery + (params.sleepHours - 6.5) * 8),
  };
  const result = calcPrediction(modified);
  return {
    weeksMin: result.weeksMin,
    weeksMax: result.weeksMax,
    probability: result.probability,
  };
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

function loadBehaviorData(): {
  avgCompliance: number;
  avgRecovery: number;
  trainingDaysPerWeek: number;
  avgProteinPct: number;
  dataDays: number;
} {
  if (typeof window === "undefined") return { avgCompliance: 50, avgRecovery: 0, trainingDaysPerWeek: 3, avgProteinPct: 60, dataDays: 0 };

  const DAYS = 14;
  const compScores: number[] = [];
  const recovScores: number[] = [];
  const proteinPcts: number[] = [];
  let trainingDays = 0;

  for (let i = 0; i < DAYS; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const raw = localStorage.getItem(`checkin_${dateStr}`);
      if (raw) {
        const ci = JSON.parse(raw);
        // Compliance (simplified recalc)
        const protein = Math.min(100, ci.evening?.proteinPct ?? 0);
        const water = ci.evening?.waterMl ? Math.min(100, (ci.evening.waterMl / 2000) * 100) : 0;
        const sleepMap = [30, 55, 75, 100, 85];
        const sleep = ci.morning?.sleepDuration !== undefined ? sleepMap[ci.morning.sleepDuration] ?? 75 : 0;
        const hasTrain = !!localStorage.getItem(`training_${dateStr}`);
        const training = hasTrain ? 100 : 0;
        if (protein || water || sleep || training) {
          compScores.push(Math.round(protein * 0.3 + water * 0.25 + training * 0.25 + sleep * 0.2));
        }
        // Recovery
        if (ci.morning?.sleepDuration !== undefined) {
          const sleepDurScore = sleepMap[ci.morning.sleepDuration] ?? 75;
          const sleepQual = ci.morning.sleepQuality ? (ci.morning.sleepQuality / 5) * 100 : 75;
          const fatigue = ci.morning.fatigue ? (1 - (ci.morning.fatigue - 1) / 9) * 100 : 75;
          const stress = ci.morning.stress ? (1 - (ci.morning.stress - 1) / 9) * 100 : 75;
          const soreness = ci.morning.soreness ? (1 - (ci.morning.soreness - 1) / 9) * 100 : 75;
          recovScores.push(Math.round(sleepDurScore * 0.45 + sleepQual * 0.20 + fatigue * 0.15 + stress * 0.12 + soreness * 0.08));
        }
        // Protein
        if (ci.evening?.proteinPct !== undefined) proteinPcts.push(ci.evening.proteinPct);
      }
    } catch {}

    // Training days — only count within 7-day window
    if (i < 7) {
      try {
        const tr = localStorage.getItem(`training_${dateStr}`);
        if (tr) {
          const td = JSON.parse(tr);
          if ((td.sessions?.length ?? 0) > 0) trainingDays++;
        }
      } catch {}
    }
  }

  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b) / arr.length) : 0;

  return {
    avgCompliance: avg(compScores) || 50,
    avgRecovery: avg(recovScores),
    // Use actual count from 7-day window, not extrapolated from 14
    trainingDaysPerWeek: trainingDays,
    avgProteinPct: avg(proteinPcts) || 60,
    dataDays: compScores.length,
  };
}

// ─── UI Components ────────────────────────────────────────────────────────────

// Probability arc
function ProbabilityArc({ probability, color }: { probability: number; color: string }) {
  const R = 52; const cx = 70; const cy = 70;
  const circumference = Math.PI * R; // half circle
  const offset = circumference * (1 - probability / 100);
  return (
    <svg viewBox="0 0 140 80" style={{ width: 140, height: 80 }}>
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="800" fill={color}>
        {probability}%
      </text>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="#475569">成功概率</text>
    </svg>
  );
}

// Slider with label + current value indicator
function Slider({ label, value, min, max, step, unit, onChange, color, currentVal }: {
  label: string; value: number; min: number; max: number; step: number;
  unit: string; onChange: (v: number) => void; color: string; currentVal?: number;
}) {
  const changed = currentVal !== undefined && Math.abs(value - currentVal) >= step;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <div>
          <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
          {currentVal !== undefined && (
            <span style={{ fontSize: 10, color: "#334155", marginLeft: 6 }}>
              当前 {currentVal}{unit}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {changed && currentVal !== undefined && (
            <span style={{ fontSize: 10, color: C.textMuted }}>
              {currentVal}{unit} →
            </span>
          )}
          <span style={{ fontSize: 12, fontWeight: 700, color: changed ? color : C.textMuted }}>
            {value}{unit}
          </span>
        </div>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: color, cursor: "pointer", height: 4 }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span style={{ fontSize: 9, color: "#334155" }}>{min}{unit}</span>
        <span style={{ fontSize: 9, color: "#334155" }}>{max}{unit}</span>
      </div>
    </div>
  );
}

// Delta badge
function DeltaBadge({ delta, unit }: { delta: number; unit: string }) {
  if (Math.abs(delta) < 0.5) return null;
  const positive = delta > 0;
  const color = positive ? C.emerald : C.rose;
  return (
    <span style={{
      fontSize: 10, padding: "1px 6px", borderRadius: 6, marginLeft: 6,
      background: color + "20", color, fontWeight: 700,
    }}>
      {positive ? "+" : ""}{delta > 0 ? `提前${Math.abs(delta)}周` : `推后${Math.abs(delta)}周`}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PredictionPage({ state }: { state: AppState }) {
  const m = state.measurements;

  // Load behavioral data
  const behaviorData = useMemo(() => loadBehaviorData(), []);

  const baseInput: PredictionInput = useMemo(() => ({
    currentWeight: m.weight,
    currentBF: m.bodyFatPercentage,
    currentSMM: m.skeletalMuscleMass,
    goal: state.goal,
    bmr: m.basalMetabolicRate,
    activityLevel: state.activityLevel,
    ...behaviorData,
  }), [m, state, behaviorData]);

  const prediction = useMemo(() => calcPrediction(baseInput), [baseInput]);

  // Scenario state
  const [scenario, setScenario] = useState<ScenarioParams>({
    trainingDays: behaviorData.trainingDaysPerWeek || 3,
    proteinPct: behaviorData.avgProteinPct || 60,
    compliancePct: behaviorData.avgCompliance || 50,
    sleepHours: 7,
  });

  const scenarioResult = useMemo(
    () => calcScenario(baseInput, scenario),
    [baseInput, scenario]
  );

  const weeksDelta = prediction.weeksMax - scenarioResult.weeksMax;
  const probDelta = scenarioResult.probability - prediction.probability;

  // Color by probability
  const probColor = prediction.probability >= 70 ? C.emerald
    : prediction.probability >= 50 ? C.amber : C.rose;

  const GOAL_CN: Record<string, string> = {
    weight_loss: "减脂瘦身", muscle_gain: "增肌塑形",
    recomposition: "体成分重塑", maintain: "维持体形",
  };

  const isNoGoal = state.goal === "maintain";

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.violet, marginBottom: 6, textTransform: "uppercase" }}>
          Prediction Engine
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>
          目标预测
        </h2>
        <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
          基于 {behaviorData.dataDays} 天行为数据 · {GOAL_CN[state.goal] ?? state.goal}
        </div>
      </div>

      {behaviorData.dataDays < 3 ? (
        /* Not enough data state */
        <div style={g({ padding: "32px 24px", textAlign: "center" })}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>数据积累中</div>
          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.7 }}>
            预测引擎需要至少 3 天的 Check-in 数据才能运行。<br />
            继续坚持晨间和晚间 Check-in，稍后再来。
          </div>
        </div>
      ) : (
        <>
          {/* ── Module 1: Goal Status ── */}
          <div style={{ ...g({ padding: "20px 24px" }), marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              目标状态
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
              {/* Probability arc */}
              <div style={{ flexShrink: 0 }}>
                <ProbabilityArc probability={prediction.probability} color={probColor} />
              </div>

              {/* Goal details */}
              <div style={{ flex: 1 }}>
                {isNoGoal ? (
                  <div style={{ fontSize: 14, color: C.textSub, paddingTop: 12 }}>
                    当前目标为维持体形，无需预测达成时间。
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>预计达成</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>
                          {prediction.weeksMin}–{prediction.weeksMax}
                          <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}> 周</span>
                        </div>
                      </div>
                      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 14px" }}>
                        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>目标体脂</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: C.sky }}>
                          {prediction.targetBF?.toFixed(1)}
                          <span style={{ fontSize: 11, fontWeight: 400, color: C.textMuted }}>%</span>
                          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>
                            (现 {m.bodyFatPercentage.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Limiting factor */}
                    <div style={{
                      display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px",
                      borderRadius: 10, background: C.amberDim, border: `1px solid ${C.amber}25`,
                    }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>🎯</span>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 2 }}>
                          最大限制因素：{prediction.limitingFactor}
                        </div>
                        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                          {prediction.limitingDetail}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Module 2: Watchouts ── */}
          <div style={{ ...g({ padding: "20px 24px" }), marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              需要关注
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {prediction.watchouts.map((w, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "12px 14px", borderRadius: 12,
                  background: w.color + "10", border: `1px solid ${w.color}25`,
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1.3 }}>{w.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: w.color, marginBottom: 3 }}>
                      {w.title}
                    </div>
                    <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                      {w.detail}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Module 3: Scenario Simulator ── */}
          <div style={g({ padding: "20px 24px" })}>
            <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              情景模拟
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 16 }}>
              拨动滑块，实时看不同习惯对目标的影响
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Sliders */}
              <div>
                <Slider label="每周训练天数" value={scenario.trainingDays} min={1} max={7} step={1}
                  unit="天" color={C.violet} currentVal={behaviorData.trainingDaysPerWeek}
                  onChange={v => setScenario(s => ({ ...s, trainingDays: v }))} />
                <Slider label="蛋白达标率" value={scenario.proteinPct} min={20} max={100} step={5}
                  unit="%" color={C.sky} currentVal={behaviorData.avgProteinPct}
                  onChange={v => setScenario(s => ({ ...s, proteinPct: v }))} />
                <Slider label="执行率" value={scenario.compliancePct} min={20} max={100} step={5}
                  unit="%" color={C.emerald} currentVal={behaviorData.avgCompliance}
                  onChange={v => setScenario(s => ({ ...s, compliancePct: v }))} />
                <Slider label="平均睡眠时长" value={scenario.sleepHours} min={5} max={9} step={0.5}
                  unit="h" color={C.amber}
                  onChange={v => setScenario(s => ({ ...s, sleepHours: v }))} />
              </div>

              {/* Scenario result */}
              <div style={{
                display: "flex", flexDirection: "column", justifyContent: "center",
                padding: "16px 20px", borderRadius: 16,
                background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
              }}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  模拟结果
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>预计达成</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: C.text }}>
                      {scenarioResult.weeksMin}–{scenarioResult.weeksMax}
                    </span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>周</span>
                    <DeltaBadge delta={weeksDelta} unit="周" />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4 }}>成功概率</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: scenarioResult.probability >= 70 ? C.emerald : scenarioResult.probability >= 50 ? C.amber : C.rose }}>
                      {scenarioResult.probability}%
                    </span>
                    {probDelta !== 0 && (
                      <span style={{
                        fontSize: 11, padding: "1px 6px", borderRadius: 6,
                        background: probDelta > 0 ? C.emerald + "20" : C.rose + "20",
                        color: probDelta > 0 ? C.emerald : C.rose, fontWeight: 700,
                      }}>
                        {probDelta > 0 ? "+" : ""}{probDelta}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Key insight */}
                {(() => {
                  // B9: Show concrete impact of best improvement
                  const trainTarget = Math.min(7, Math.max(scenario.trainingDays + 2, 4));
                  const proteinTarget = Math.min(100, scenario.proteinPct + 20);

                  const trainScenario = calcScenario(baseInput, { ...scenario, trainingDays: trainTarget });
                  const proteinScenario = calcScenario(baseInput, { ...scenario, proteinPct: proteinTarget });

                  const trainWeeksDelta = scenarioResult.weeksMax - trainScenario.weeksMax;
                  const proteinWeeksDelta = scenarioResult.weeksMax - proteinScenario.weeksMax;
                  const trainProbDelta = trainScenario.probability - scenarioResult.probability;
                  const proteinProbDelta = proteinScenario.probability - scenarioResult.probability;

                  const useTrain = trainWeeksDelta >= proteinWeeksDelta;
                  const bestLabel = useTrain ? `训练 ${scenario.trainingDays}天 → ${trainTarget}天` : `蛋白 ${scenario.proteinPct}% → ${proteinTarget}%`;
                  const weeksDelta = useTrain ? trainWeeksDelta : proteinWeeksDelta;
                  const probDeltaBest = useTrain ? trainProbDelta : proteinProbDelta;
                  const bestProb = useTrain ? trainScenario.probability : proteinScenario.probability;
                  const bestWeeks = useTrain ? `${trainScenario.weeksMin}–${trainScenario.weeksMax}` : `${proteinScenario.weeksMin}–${proteinScenario.weeksMax}`;

                  if (weeksDelta <= 0 && probDeltaBest <= 0) return (
                    <div style={{ fontSize: 11, color: C.textMuted, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", lineHeight: 1.6 }}>
                      当前配置已接近最优，继续保持一致性。
                    </div>
                  );

                  return (
                    <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(16,185,129,0.07)", border: `1px solid ${C.emerald}25`, lineHeight: 1.7 }}>
                      <div style={{ fontSize: 11, color: C.emerald, fontWeight: 700, marginBottom: 6 }}>
                        💡 最高价值改变：{bestLabel}
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>成功率</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                            {scenarioResult.probability}%
                            <span style={{ color: C.emerald }}> → {bestProb}%</span>
                            {probDeltaBest > 0 && <span style={{ fontSize: 10, color: C.emerald }}> +{probDeltaBest}%</span>}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: C.textMuted }}>预计达成</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                            {scenarioResult.weeksMin}–{scenarioResult.weeksMax}周
                            <span style={{ color: C.emerald }}> → {bestWeeks}周</span>
                            {weeksDelta > 0 && <span style={{ fontSize: 10, color: C.emerald }}> 提前{weeksDelta}周</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Reset to current */}
            <button
              onClick={() => setScenario({
                trainingDays: behaviorData.trainingDaysPerWeek || 3,
                proteinPct: behaviorData.avgProteinPct || 60,
                compliancePct: behaviorData.avgCompliance || 50,
                sleepHours: 7,
              })}
              style={{
                marginTop: 14, padding: "6px 14px", borderRadius: 20,
                border: `1px solid ${C.border}`, background: "transparent",
                color: C.textMuted, fontSize: 11, cursor: "pointer",
              }}
            >
              重置为当前实际数据
            </button>
          </div>
        </>
      )}

      <div style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 20 }}>
        基于 {behaviorData.dataDays} 天行为数据 · 预测为统计模型，非医疗建议
      </div>
    </div>
  );
}
