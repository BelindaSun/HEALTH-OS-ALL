"use client";

import { useState } from "react";
import { C, GOAL_CN } from "../constants";
import { GaugeArc } from "./ui";
import { Measurements, AppState, CheckinData } from "../types";
import { calcComplianceScore, calcConsistency } from "../lib/compliance";
import { callTextAI, parseJSON } from "../lib/ai";
import { promptDailyReflection } from "../lib/prompts";

// ── GOAL PROGRESS ─────────────────────────────────────────────
function calcGoalProgress(m: Measurements, p: AppState) {
  if (!m || !m.weight) return null;
  const { goal, gender } = p;
  const idealBF = goal === "muscle_gain" ? (gender === "female" ? 20 : 12)
    : (gender === "female" ? 22 : 15);
  const idealSMM = gender === "female" ? m.weight * 0.38 : m.weight * 0.45;
  const idealWeight = goal === "weight_loss"
    ? Math.round((m.leanBodyMass / (1 - idealBF / 100)) * 10) / 10
    : goal === "muscle_gain"
    ? Math.round((m.weight + (idealSMM - m.skeletalMuscleMass)) * 10) / 10
    : m.weight;

  const bfGap = m.bodyFatPercentage - idealBF;
  const smmGap = idealSMM - m.skeletalMuscleMass;
  const weightGap = m.weight - idealWeight;

  const bfProgress = Math.max(0, Math.min(100, Math.round(100 - Math.abs(bfGap) * 5)));
  const smmProgress = Math.max(0, Math.min(100, Math.round((m.skeletalMuscleMass / idealSMM) * 100)));



  const dims = [
    {
      label: "体脂率", current: `${m.bodyFatPercentage}%`, target: `${idealBF}%`,
      gap: bfGap > 0.5 ? `-${bfGap.toFixed(1)}%` : bfGap < -0.5 ? `+${Math.abs(bfGap).toFixed(1)}%` : "达标 ✓",
      progress: bfProgress,
      color: bfGap > 5 ? C.rose : bfGap > 2 ? C.amber : C.emerald
    },
    {
      label: "肌肉量", current: `${m.skeletalMuscleMass}kg`, target: `${idealSMM.toFixed(1)}kg`,
      gap: smmGap > 0.5 ? `+${smmGap.toFixed(1)}kg` : smmGap < -0.5 ? `-${Math.abs(smmGap).toFixed(1)}kg` : "达标 ✓",
      progress: smmProgress,
      color: smmGap > 3 ? C.amber : smmGap > 1 ? C.sky : C.emerald
    },
    {
      label: "目标体重", current: `${m.weight}kg`, target: `${idealWeight}kg`,
      gap: Math.abs(weightGap) > 0.5 ? `${weightGap > 0 ? "-" : "+"}${Math.abs(weightGap).toFixed(1)}kg` : "达标 ✓",
      progress: Math.max(0, Math.min(100, Math.round(100 - Math.abs(weightGap) * 3))),
      color: Math.abs(weightGap) > 5 ? C.rose : Math.abs(weightGap) > 2 ? C.amber : C.emerald
    },
  ];

  return { dims, overallProgress: Math.round((bfProgress + smmProgress) / 2), goal: GOAL_CN[goal] || goal };
}

export function GoalProgressCard({ m, p }: { m: Measurements; p: AppState }) {
  const result = calcGoalProgress(m, p);
  if (!result) return null;
  const { dims, overallProgress, goal } = result;
  const ringColor = overallProgress >= 80 ? C.emerald : overallProgress >= 60 ? C.sky : C.amber;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>距离目标</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{goal}</div>
        </div>
        <div style={{ position: "relative", width: 64, height: 64 }}>
          <GaugeArc value={overallProgress} max={100} color={ringColor} size={64} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: ringColor, lineHeight: 1 }}>{overallProgress}</div>
            <div style={{ fontSize: 8, color: C.textMuted }}>%</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {dims.map(d => (
          <div key={d.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", border: `1px solid rgba(255,255,255,0.05)` }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{d.label}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 2 }}>{d.current}</div>
            <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${d.progress}%`, background: d.color, borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: C.textMuted }}>目标 {d.target}</span>
              <span style={{ fontSize: 10, color: d.color, fontWeight: 700 }}>{d.gap}</span>
            </div>

          </div>
        ))}
      </div>
    </div>
  );
}

// ── TODAY'S FOCUS ─────────────────────────────────────────────
function calcTodayFocus(m: Measurements, p: AppState, checkin: CheckinData, nutritionProtein: number | null, proteinTarget: number) {
  if (!m || !m.weight) return [];
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const items: any[] = [];

  if (checkin?.morningDone) {
    const sleepIdx = mc.sleepDuration ?? 2;
    if (sleepIdx <= 1) items.push({ icon: "😴", color: C.sky, priority: "high", title: "恢复优先", desc: `睡眠不足，今日降低训练强度，补充碳水` });
    else if ((mc.fatigue ?? 0) >= 7) items.push({ icon: "⚡", color: C.amber, priority: "high", title: "控制疲劳", desc: `疲劳度 ${mc.fatigue}/10，建议轻度训练或休息` });
    else if ((mc.soreness ?? 0) >= 7) items.push({ icon: "💆", color: C.violet, priority: "medium", title: "肌肉恢复", desc: `酸痛度 ${mc.soreness}/10，今日做拉伸或有氧` });
  }

  if (nutritionProtein !== null && proteinTarget > 0) {
    const gap = proteinTarget - nutritionProtein;
    if (gap > proteinTarget * 0.5) items.push({ icon: "🥩", color: C.emerald, priority: "high", title: "补充蛋白质", desc: `今日还差 ${gap}g 蛋白，进入 Nutrition 记录` });
    else if (gap > 20) items.push({ icon: "🥛", color: C.emerald, priority: "medium", title: "蛋白收尾", desc: `再补 ${gap}g 即达标，1勺蛋白粉或1盒希腊酸奶` });
  } else if (nutritionProtein === null) {
    items.push({ icon: "📋", color: C.emerald, priority: "medium", title: "记录今日饮食", desc: "还未记录，进入 Nutrition 开始追踪" });
  }

  const bfIdeal = p.gender === "female" ? 22 : 15;
  if (m.bodyFatPercentage > bfIdeal + 5) items.push({ icon: "🔥", color: C.amber, priority: "medium", title: "热量控制", desc: `体脂 ${m.bodyFatPercentage}%，当前 TDEE 赤字有效` });
  const smmIdeal = p.gender === "female" ? m.weight * 0.38 : m.weight * 0.45;
  if (m.skeletalMuscleMass < smmIdeal * 0.92) items.push({ icon: "💪", color: C.violet, priority: "medium", title: "优先抗阻训练", desc: `肌肉量低于理想 ${Math.round((smmIdeal - m.skeletalMuscleMass) * 10) / 10}kg，今日安排力量` });
  if (m.visceralFatLevel >= 10) items.push({ icon: "🫀", color: C.rose, priority: "high", title: "内脏脂肪警戒", desc: `VFL ${m.visceralFatLevel}，有氧运动 + 控糖是首选` });
  if (m.intracellularWater > 0) {
    const ecwR = m.extracellularWater / (m.intracellularWater + m.extracellularWater);
    if (ecwR > 0.38) items.push({ icon: "💧", color: C.sky, priority: "medium", title: "注意水肿风险", desc: `ECW比 ${ecwR.toFixed(3)}，减少钠摄入，保证饮水` });
  }
  if (checkin?.eveningDone && ec.training === "skip") {
    items.push({ icon: "⚠️", color: C.amber, priority: "low", title: "今日未训练", desc: "明日补上或调整计划，保持一致性" });
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
}

export function TodayFocusCard({ m, p, checkin, nutritionProtein, proteinTarget, onGoNutrition }: {
  m: Measurements; p: AppState; checkin: CheckinData;
  nutritionProtein: number | null; proteinTarget: number;
  onGoNutrition: () => void;
}) {
  const items = calcTodayFocus(m, p, checkin, nutritionProtein, proteinTarget);
  if (items.length === 0) return null;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Today's Focus · 今日重点</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => {
          const isNutrition = it.title.includes("蛋白") || it.title.includes("饮食") || it.title.includes("Nutrition");
          return (
            <div key={i} onClick={isNutrition ? onGoNutrition : undefined}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: it.color + "0d", border: `1px solid ${it.color}22`, cursor: isNutrition ? "pointer" : "default" }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: it.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{it.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{it.title}</span>
                  {it.priority === "high" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, background: `${C.rose}20`, color: C.rose, fontWeight: 700 }}>重要</span>}
                </div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{it.desc}</div>
              </div>
              {isNutrition && (
                <div style={{ padding: "4px 10px", borderRadius: 8, background: it.color + "20", border: `1px solid ${it.color}40`, fontSize: 11, color: it.color, fontWeight: 700, whiteSpace: "nowrap" }}>去记录</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DAILY REFLECTION ──────────────────────────────────────────
export function DailyReflectionCard({ checkin, todayCompliance, aiCfg, nutritionProtein, proteinTarget }: {
  checkin: CheckinData; todayCompliance: number; aiCfg: { provider: string; apiKey: string; modelName: string };
  nutritionProtein: number | null; proteinTarget: number;
}) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState<any>(() => {
    try {
      const key = `reflection_${new Date().toISOString().slice(0, 10)}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [error, setError] = useState<string | null>(null);

  const consistency = calcConsistency();
  const yesterdayCompliance = (() => {
    try {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const raw = localStorage.getItem(`checkin_${d.toISOString().slice(0, 10)}`);
      if (!raw) return null;
      const cr = calcComplianceScore(JSON.parse(raw));
      return cr ? cr.total : null;
    } catch { return null; }
  })();

  const generate = async () => {
    if (!aiCfg.apiKey && aiCfg.provider !== "ollama") {
      const diff = yesterdayCompliance !== null ? todayCompliance - yesterdayCompliance : null;
      const localResult = {
        summary: diff !== null
          ? `今天执行分 ${todayCompliance}，${diff > 0 ? `比昨天提高了 ${diff} 分` : diff < 0 ? `比昨天下降了 ${Math.abs(diff)} 分` : "与昨天持平"}。`
          : `今天执行分 ${todayCompliance}，${todayCompliance >= 80 ? "表现优秀" : todayCompliance >= 65 ? "执行良好" : "还有提升空间"}。`,
        insight: nutritionProtein !== null
          ? `蛋白质摄入 ${nutritionProtein}g，达成率 ${Math.round(nutritionProtein / proteinTarget * 100)}%。${nutritionProtein >= proteinTarget * 0.9 ? "蛋白目标完成得很好。" : "蛋白摄入是今日主要缺口。"}`
          : "今日饮食暂未记录，建议明天开始使用 Nutrition 追踪。",
        tomorrow: consistency.streak >= 3
          ? `已连续 ${consistency.streak} 天达标，明天保持节奏。`
          : "明天专注完成晨间 Check-in，让系统更准确地了解你的状态。",
        highlight: todayCompliance >= 80 ? "今日表现优秀 🌟" : todayCompliance >= 65 ? "稳步前进 💪" : "明天会更好 ↑",
        mood: todayCompliance >= 75 ? "positive" : todayCompliance >= 55 ? "neutral" : "concern",
      };
      setResult(localResult);
      try { localStorage.setItem(`reflection_${new Date().toISOString().slice(0, 10)}`, JSON.stringify(localResult)); } catch {}
      return;
    }
    setStatus("loading"); setError(null);
    try {
      const raw = await callTextAI(
        promptDailyReflection(todayCompliance, yesterdayCompliance, checkin, nutritionProtein, proteinTarget, consistency),
        aiCfg.provider, aiCfg.apiKey, aiCfg.modelName,
      );
      const data = parseJSON(raw);
      if (data?.summary) {
        setResult(data); setStatus("success");
        try { localStorage.setItem(`reflection_${new Date().toISOString().slice(0, 10)}`, JSON.stringify(data)); } catch {}
      } else { setError("解析失败，请重试"); setStatus("error"); }
    } catch (e: any) { setError(String(e)); setStatus("error"); }
  };

  const moodColor = result?.mood === "positive" ? C.emerald : result?.mood === "concern" ? C.amber : C.sky;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, padding: "20px 24px", marginBottom: 16, border: `1px solid ${result ? moodColor + "25" : C.border}`, position: "relative", overflow: "hidden" }}>
      {result && <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: `radial-gradient(circle, ${moodColor}07, transparent 70%)`, pointerEvents: "none" }} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: result ? 16 : 0 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Daily Reflection</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>今日回顾</div>
        </div>
        <div>
          {!result && status === "idle" && (
            <button onClick={generate} style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${C.violet}40`, background: C.violetDim, color: C.violet, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {aiCfg.apiKey || aiCfg.provider === "ollama" ? "✦ AI 生成" : "生成回顾"}
            </button>
          )}
          {status === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.violet, fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.violet, animation: "blink 1s infinite" }} />
              思考中...
            </div>
          )}
          {result && <button onClick={generate} style={{ padding: "5px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>刷新</button>}
        </div>
      </div>

      {result && (
        <div>
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: moodColor + "15", border: `1px solid ${moodColor}30`, color: moodColor, fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
            {result.highlight}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { key: "summary", label: "今日总结", color: moodColor },
              { key: "insight", label: "关键洞察", color: C.sky },
              { key: "tomorrow", label: "明日建议", color: C.emerald },
            ].map(({ key, label, color }) => (
              <div key={key} style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${color}` }}>
                <div style={{ fontSize: 10, color, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{result[key]}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {status === "error" && <div style={{ marginTop: 10, fontSize: 12, color: C.rose }}>⚠ {error}</div>}
      {!result && status === "idle" && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>完成今日 Check-in 后生成个性化回顾，AI 会告诉你今天哪里做得好、明天怎么进步。</div>
      )}
    </div>
  );
}
