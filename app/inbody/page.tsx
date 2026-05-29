"use client";
import { useState, useCallback, useRef } from "react";

// ══════════════════════════════════════════════════════════════
//  COLORS & STYLES
// ══════════════════════════════════════════════════════════════
const C = {
  bg: "#020817",
  surface: "rgba(15,23,42,0.85)",
  border: "rgba(255,255,255,0.07)",
  emerald: "#10b981",
  emeraldDim: "rgba(16,185,129,0.12)",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.12)",
  sky: "#0ea5e9",
  skyDim: "rgba(14,165,233,0.12)",
  rose: "#f43f5e",
  roseDim: "rgba(244,63,94,0.12)",
  violet: "#8b5cf6",
  violetDim: "rgba(139,92,246,0.12)",
  text: "#f1f5f9",
  textSub: "#94a3b8",
  textMuted: "#475569",
};
const glass = (extra = {}) => ({
  background: C.surface,
  backdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  ...extra,
});

// ══════════════════════════════════════════════════════════════
//  AI ENGINE - 真实调用，支持6个Provider
// ══════════════════════════════════════════════════════════════
async function callAI(prompt, { provider, apiKey, modelName }) {
  const configs = {
    deepseek: {
      url: "https://api.deepseek.com/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model: modelName || "deepseek-chat",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    qwen: {
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model: modelName || "qwen-max",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    openai: {
      url: "https://api.openai.com/v1/chat/completions",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: {
        model: modelName || "gpt-4o",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    claude: {
      url: "https://api.anthropic.com/v1/messages",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: modelName || "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.content[0].text,
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      headers: { "Content-Type": "application/json" },
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      },
      extract: (d) => d.candidates[0].content.parts[0].text,
    },
    ollama: {
      url: "http://localhost:11434/api/chat",
      headers: { "Content-Type": "application/json" },
      body: {
        model: modelName || "qwen2.5:3b",
        stream: false,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.message.content,
    },
  };
  const cfg = configs[provider] || configs.deepseek;
  const resp = await fetch(cfg.url, {
    method: "POST",
    headers: cfg.headers,
    body: JSON.stringify(cfg.body),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`${provider} API ${resp.status}: ${err.slice(0, 200)}`);
  }
  return cfg.extract(await resp.json());
}

function parseJSON(raw) {
  const clean = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const s = clean.indexOf("{"),
    e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("响应中无 JSON");
  return JSON.parse(clean.slice(s, e + 1));
}

// ══════════════════════════════════════════════════════════════
//  PROMPTS（内联精简版）
// ══════════════════════════════════════════════════════════════
function buildMeasurementBlock(m) {
  const ecw =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "N/A";
  return `
【InBody 实测数据】
体重:${m.weight}kg BMI:${m.bmi} BMR(实测):${m.basalMetabolicRate}kcal
骨骼肌量(SMM):${m.skeletalMuscleMass}kg 去脂体重(LBM):${m.leanBodyMass}kg
体脂肪量:${m.bodyFatMass}kg 体脂率:${m.bodyFatPercentage}%
体水分:${m.totalBodyWater}L ICW:${m.intracellularWater}L ECW:${m.extracellularWater}L ECW/TBW:${ecw}
蛋白质:${m.protein}kg 无机盐:${m.minerals}kg
内脏脂肪等级:${m.visceralFatLevel}/20 腰臀比:${m.waistHipRatio}
${m.inBodyScore ? `InBody评分:${m.inBodyScore}` : ""}
${m.segmentalLeanMass ? `节段骨骼肌 右臂:${m.segmentalLeanMass.rightArm} 左臂:${m.segmentalLeanMass.leftArm} 躯干:${m.segmentalLeanMass.trunk} 右腿:${m.segmentalLeanMass.rightLeg} 左腿:${m.segmentalLeanMass.leftLeg} (kg)` : ""}`;
}

const GOAL_MAP = {
  muscle_gain: "增肌塑形",
  weight_loss: "减脂瘦身",
  recomposition: "体成分重塑",
  maintain: "维持体形",
};
const ACT_MAP = {
  low: "低(久坐)",
  medium: "中(轻度活动)",
  high: "高(经常运动)",
};
const FIT_MAP = { beginner: "初级", intermediate: "中级", advanced: "高级" };

function promptBodyComposition(p, m) {
  return `你是专业体成分评估专家，解读InBody报告，返回纯JSON不含其他内容。
用户:${p.age}岁 ${p.gender === "male" ? "男" : "女"} 目标:${GOAL_MAP[p.goal]}
${buildMeasurementBlock(m)}
返回JSON格式:
{"summary":"150字整体解读","analysis":{"smmRating":"normal|low|high","bodyFatRating":"normal|low|high","visceralRisk":"low|moderate|high","ecwRatio":数字,"isEdemaRisk":false},"keyFindings":[{"title":"","value":"","interpretation":"","priority":"critical|important|info"}],"targetRanges":[{"metric":"","current":0,"idealMin":0,"idealMax":0,"unit":"","gapNote":""}],"actionPriority":["","",""],"personalizedNote":""}`;
}

function promptWorkout(p, m) {
  const tdee = Math.round(
    m.basalMetabolicRate *
      (p.activityLevel === "high"
        ? 1.55
        : p.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const eq =
    p.equipmentList === "gym"
      ? "健身房全器械"
      : p.equipmentList === "home"
        ? "家用器材"
        : "徒手自重";
  return `你是专业健身教练，根据InBody数据制定训练计划，返回纯JSON不含其他内容。
用户:${p.age}岁 ${p.gender === "male" ? "男" : "女"} ${FIT_MAP[p.fitnessLevel]} 目标:${GOAL_MAP[p.goal]} 每天${p.availableMinutesPerDay}分钟 ${eq} TDEE:${tdee}kcal
${buildMeasurementBlock(m)}
返回JSON(weeklySchedule必须7天含1休息日):
{"overview":"","dataDriverNotes":"","weeklySchedule":[{"day":"周一","focus":"","warmup":["","",""],"exercises":[{"name":"","sets":3,"reps":"","muscleGroup":"","tip":""}],"cooldown":["",""],"durationMinutes":45}],"progressionLogic":"","safetyNote":"","personalizedNote":""}`;
}

function promptNutrition(p, m) {
  const tdee = Math.round(
    m.basalMetabolicRate *
      (p.activityLevel === "high"
        ? 1.55
        : p.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const proteinG = Math.round(
    m.leanBodyMass *
      (p.goal === "muscle_gain" ? 2.2 : p.goal === "weight_loss" ? 2.0 : 1.8),
  );
  const cal =
    p.goal === "weight_loss"
      ? `${tdee - 400}~${tdee - 200}`
      : p.goal === "muscle_gain"
        ? `${tdee + 200}~${tdee + 400}`
        : `${tdee - 100}~${tdee + 100}`;
  const styleDesc = {
    budget: "经济实惠，鸡蛋豆腐鸡胸肉",
    balanced: "均衡适中，可含牛肉三文鱼",
    premium: "豪华品质，和牛帝王蟹松露",
  }[p.dietStyle || "balanced"];
  return `你是专业运动营养师，基于InBody实测BMR制定营养方案，返回纯JSON不含其他内容。
用户:${p.age}岁 目标:${GOAL_MAP[p.goal]} 活动:${ACT_MAP[p.activityLevel]} 饮食:${styleDesc} 预算¥${p.weeklyBudget}/周
InBody实测BMR:${m.basalMetabolicRate}kcal TDEE:${tdee}kcal 目标热量:${cal}kcal LBM:${m.leanBodyMass}kg 蛋白质目标:${proteinG}g/天
${buildMeasurementBlock(m)}
返回JSON(weeklyPlan必须7天周一到周日):
{"bmrSource":"inbody_measured","basalMetabolicRate":${m.basalMetabolicRate},"tdee":${tdee},"dailyCalorieTarget":0,"macroSplit":{"protein":0,"carbs":0,"fat":0},"proteinTargetGrams":${proteinG},"weeklyPlan":[{"day":"周一","breakfast":{"name":"","foods":[""],"calories":0,"protein":0},"lunch":{"name":"","foods":[""],"calories":0,"protein":0},"dinner":{"name":"","foods":[""],"calories":0,"protein":0},"snack":{"name":"","foods":[""],"calories":0,"protein":0},"totalCalories":0}],"keyPrinciples":[""],"inBodyDataRationale":"","personalizedNote":""}`;
}

function promptHydration(p, m) {
  const mlPerKg =
    p.activityLevel === "high" ? 43 : p.activityLevel === "medium" ? 38 : 33;
  const target = Math.min(Math.max(Math.round(m.weight * mlPerKg), 1500), 3500);
  const ecw =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "0.370";
  const edema = parseFloat(ecw) >= 0.38;
  return `你是运动水合专家，基于InBody水分数据制定方案，返回纯JSON不含其他内容。
用户:${p.age}岁 体重:${m.weight}kg 起床:${p.wakeTime} 睡眠:${p.sleepTime}
InBody水分: TBW:${m.totalBodyWater}L ICW:${m.intracellularWater}L ECW:${m.extracellularWater}L ECW/TBW:${ecw}${edema ? " ⚠️水肿风险" : ""}
每日饮水目标:${target}ml
返回JSON(hydrationSchedule至少8个节点从${p.wakeTime}到睡前):
{"currentTBW":${m.totalBodyWater},"currentECWRatio":${ecw},"isEdemaRisk":${edema},"edemaNote":${edema ? '"水肿说明"' : "null"},"dailyWaterTargetMl":${target},"hydrationSchedule":[{"time":"07:00","amount":"400ml","note":""}],"electrolyteTips":["","",""],"hydrationPrinciples":["","",""],"warningSignals":["","",""],"sleepOptimizationTips":["","",""],"scienceNote":"","personalizedNote":""}`;
}

function promptVisceral(p, m) {
  const tdee = Math.round(
    m.basalMetabolicRate *
      (p.activityLevel === "high"
        ? 1.55
        : p.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const risk =
    m.visceralFatLevel >= 15
      ? "critical"
      : m.visceralFatLevel >= 10
        ? "high"
        : m.visceralFatLevel >= 5
          ? "moderate"
          : "low";
  return `你是代谢健康专家，解读内脏脂肪与代谢数据，返回纯JSON不含其他内容。
用户:${p.age}岁 ${p.gender === "male" ? "男" : "女"} 目标:${GOAL_MAP[p.goal]}
内脏脂肪等级:${m.visceralFatLevel}/20 腰臀比:${m.waistHipRatio} BMR:${m.basalMetabolicRate}kcal TDEE:${tdee}kcal 体脂率:${m.bodyFatPercentage}%
${m.visceralFatLevel >= 10 ? "⚠️内脏脂肪偏高，需重点干预" : ""}
${m.visceralFatLevel >= 15 ? "⚠️等级≥15高风险，medicalNote必须建议就医" : ""}
返回JSON:
{"visceralFatLevel":${m.visceralFatLevel},"visceralRiskLevel":"${risk}","visceralInterpretation":"","metabolicAge":0,"bmrAnalysis":"","interventionPlan":[{"category":"diet|exercise|lifestyle","action":"","frequency":"","rationale":"","expectedEffect":""}],"progressMetrics":["","","",""],"timelineExpectation":"","medicalNote":${m.visceralFatLevel >= 15 ? '"建议就医说明"' : "null"},"personalizedNote":""}`;
}

// ══════════════════════════════════════════════════════════════
//  SHARED UI COMPONENTS
// ══════════════════════════════════════════════════════════════
function Bar({ value, max, color, h = 5 }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.06)",
        borderRadius: 99,
        height: h,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min((value / max) * 100, 100)}%`,
          height: "100%",
          background: color,
          boxShadow: `0 0 8px ${color}50`,
          borderRadius: 99,
          transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
        }}
      />
    </div>
  );
}

function GaugeArc({ value, max, color, size = 100 }) {
  const r = 38,
    cx = 50,
    cy = 50,
    toR = (d) => (d * Math.PI) / 180;
  const start = -210,
    sweep = 240,
    end = start + sweep * Math.min(value / max, 1);
  const arc = (a1, a2) => {
    const s = { x: cx + r * Math.cos(toR(a1)), y: cy + r * Math.sin(toR(a1)) };
    const e = { x: cx + r * Math.cos(toR(a2)), y: cy + r * Math.sin(toR(a2)) };
    return `M${s.x} ${s.y} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path
        d={arc(start, start + sweep)}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d={arc(start, end)}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${color}90)` }}
      />
    </svg>
  );
}

function Tag({ children, color }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "2px 8px",
        borderRadius: 6,
        background: `${color}18`,
        color,
        border: `1px solid ${color}30`,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Chip({ children, color = C.textMuted }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 0",
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: color,
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 13, color: C.textSub, lineHeight: 1.4 }}>
        {children}
      </span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODULE CARD - wraps each AI result
// ══════════════════════════════════════════════════════════════
function ModuleCard({
  title,
  icon,
  color,
  dim,
  status,
  error,
  onGenerate,
  children,
}) {
  return (
    <div
      style={glass({
        border: `1px solid ${status === "success" ? `${color}25` : C.border}`,
        transition: "border-color .3s",
        overflow: "hidden",
      })}
    >
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: `1px solid ${C.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: dim,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 17,
            }}
          >
            {icon}
          </div>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status === "loading" && (
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: color,
                animation: "blink 1s ease infinite",
              }}
            />
          )}
          {status === "success" && <Tag color={color}>✓ 完成</Tag>}
          {(status === "idle" || status === "error") && (
            <button
              onClick={onGenerate}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: `1px solid ${color}40`,
                background: dim,
                color,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {status === "error" ? "重试" : "生成"}
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: "18px 22px" }}>
        {status === "idle" && (
          <div
            style={{
              textAlign: "center",
              padding: "20px 0",
              color: C.textMuted,
              fontSize: 13,
            }}
          >
            点击「生成」获取 AI 专业分析
          </div>
        )}
        {status === "loading" && (
          <div style={{ padding: "20px 0" }}>
            <div
              style={{
                color,
                fontSize: 13,
                marginBottom: 10,
                textAlign: "center",
              }}
            >
              AI 分析中，请稍候…
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 4,
                height: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: color,
                  animation: "slide 1.6s ease infinite",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        )}
        {status === "error" && (
          <div style={{ color: C.rose, fontSize: 13, padding: "12px 0" }}>
            ⚠️ {error || "生成失败，请检查 API Key 后重试"}
          </div>
        )}
        {status === "success" && children}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MODULE RENDERERS - 渲染各模块的 AI 数据
// ══════════════════════════════════════════════════════════════
function BodyCompResult({ data }) {
  if (!data) return null;
  const ratingColor = (r) =>
    r === "high" ? C.amber : r === "low" ? C.rose : C.emerald;
  return (
    <div>
      <p
        style={{
          color: C.textSub,
          fontSize: 14,
          lineHeight: 1.7,
          marginBottom: 16,
        }}
      >
        {data.summary}
      </p>
      <div
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        <Tag color={ratingColor(data.analysis?.smmRating)}>
          骨骼肌 {data.analysis?.smmRating}
        </Tag>
        <Tag color={ratingColor(data.analysis?.bodyFatRating)}>
          体脂 {data.analysis?.bodyFatRating}
        </Tag>
        <Tag
          color={
            data.analysis?.visceralRisk === "high"
              ? C.rose
              : data.analysis?.visceralRisk === "moderate"
                ? C.amber
                : C.emerald
          }
        >
          内脏 {data.analysis?.visceralRisk}
        </Tag>
        {data.analysis?.isEdemaRisk && <Tag color={C.amber}>⚠️ 水肿风险</Tag>}
      </div>
      <div style={{ marginBottom: 14 }}>
        {(data.keyFindings || []).slice(0, 3).map((f, i) => (
          <div
            key={i}
            style={{
              padding: "10px 14px",
              borderRadius: 12,
              marginBottom: 8,
              background:
                f.priority === "critical"
                  ? C.roseDim
                  : f.priority === "important"
                    ? C.amberDim
                    : C.emeraldDim,
              border: `1px solid ${f.priority === "critical" ? C.rose + "30" : f.priority === "important" ? C.amber + "30" : C.emerald + "30"}`,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color:
                  f.priority === "critical"
                    ? C.rose
                    : f.priority === "important"
                      ? C.amber
                      : C.emerald,
                marginBottom: 4,
              }}
            >
              {f.title} · {f.value}
            </div>
            <div style={{ fontSize: 12, color: C.textSub }}>
              {f.interpretation}
            </div>
          </div>
        ))}
      </div>
      {data.actionPriority?.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              letterSpacing: "0.1em",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            优先行动
          </div>
          {data.actionPriority.map((a, i) => (
            <Chip key={i} color={[C.rose, C.amber, C.emerald][i] || C.emerald}>
              {a}
            </Chip>
          ))}
        </div>
      )}
      {data.personalizedNote && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 12,
            background: C.emeraldDim,
            border: `1px solid ${C.emerald}25`,
          }}
        >
          <span style={{ fontSize: 12, color: C.emerald }}>✦ </span>
          <span style={{ fontSize: 13, color: C.textSub }}>
            {data.personalizedNote}
          </span>
        </div>
      )}
    </div>
  );
}

function WorkoutResult({ data }) {
  if (!data) return null;
  const trainingDays = (data.weeklySchedule || []).filter(
    (d) => d.focus !== "休息与恢复",
  );
  return (
    <div>
      <p
        style={{
          fontSize: 13,
          color: C.textSub,
          lineHeight: 1.6,
          marginBottom: 4,
        }}
      >
        {data.dataDriverNotes}
      </p>
      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
        {data.overview}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 16,
        }}
      >
        {(data.weeklySchedule || []).map((d, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "9px 12px",
              borderRadius: 10,
              background:
                d.focus === "休息与恢复" ? "rgba(255,255,255,0.03)" : C.skyDim,
              border: `1px solid ${d.focus === "休息与恢复" ? C.border : C.sky + "25"}`,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: d.focus === "休息与恢复" ? C.textMuted : C.sky,
                }}
              >
                {d.day}
              </span>
              <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>
                {d.focus}
              </span>
            </div>
            {d.durationMinutes > 0 && (
              <Tag color={C.sky}>{d.durationMinutes}min</Tag>
            )}
          </div>
        ))}
      </div>
      {data.progressionLogic && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>
            4周递进逻辑
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>
            {data.progressionLogic}
          </div>
        </div>
      )}
    </div>
  );
}

function NutritionResult({ data }) {
  if (!data) return null;
  const macro = data.macroSplit || {};
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "目标热量",
            val: data.dailyCalorieTarget,
            unit: "kcal",
            color: C.emerald,
          },
          {
            label: "蛋白质目标",
            val: data.proteinTargetGrams,
            unit: "g/天",
            color: C.sky,
          },
          { label: "BMR来源", val: "实测", unit: "InBody", color: C.amber },
        ].map((item, i) => (
          <div
            key={i}
            style={glass({
              padding: "12px",
              textAlign: "center",
              border: `1px solid ${item.color}20`,
            })}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>
              {item.val}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{item.unit}</div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 3 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      {/* 宏量营养素条 */}
      <div style={{ marginBottom: 16 }}>
        {[
          {
            label: `蛋白质 ${macro.protein || 0}%`,
            val: macro.protein || 0,
            color: C.sky,
          },
          {
            label: `碳水 ${macro.carbs || 0}%`,
            val: macro.carbs || 0,
            color: C.emerald,
          },
          {
            label: `脂肪 ${macro.fat || 0}%`,
            val: macro.fat || 0,
            color: C.amber,
          },
        ].map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>
              {m.label}
            </div>
            <Bar value={m.val} max={100} color={m.color} h={6} />
          </div>
        ))}
      </div>
      {/* 前3天 */}
      {(data.weeklyPlan || []).slice(0, 3).map((day, i) => (
        <div
          key={i}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            marginBottom: 6,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {day.day}
            </span>
            <Tag color={C.emerald}>{day.totalCalories} kcal</Tag>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {[day.breakfast, day.lunch, day.dinner]
              .filter(Boolean)
              .map((m) => `${m.name}(${m.protein}g蛋白)`)
              .join(" · ")}
          </div>
        </div>
      ))}
      <div
        style={{
          fontSize: 11,
          color: C.textMuted,
          marginTop: 8,
          textAlign: "right",
        }}
      >
        共7天完整计划 · 基于InBody实测BMR {data.basalMetabolicRate}kcal
      </div>
    </div>
  );
}

function HydrationResult({ data }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div
          style={glass({
            flex: 1,
            padding: "14px",
            textAlign: "center",
            border: `1px solid ${C.sky}20`,
          })}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: C.sky }}>
            {data.currentTBW}L
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>实测体水分</div>
        </div>
        <div
          style={glass({
            flex: 1,
            padding: "14px",
            textAlign: "center",
            border: `1px solid ${C.sky}20`,
          })}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: C.sky }}>
            {data.dailyWaterTargetMl}ml
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>每日目标</div>
        </div>
        <div
          style={glass({
            flex: 1,
            padding: "14px",
            textAlign: "center",
            border: `1px solid ${data.isEdemaRisk ? C.amber + "40" : C.emerald + "20"}`,
          })}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: data.isEdemaRisk ? C.amber : C.emerald,
            }}
          >
            {data.currentECWRatio}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted }}>
            ECW/TBW{data.isEdemaRisk ? " ⚠️" : ""}
          </div>
        </div>
      </div>
      {data.isEdemaRisk && data.edemaNote && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: C.amberDim,
            border: `1px solid ${C.amber}30`,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: C.amber,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            ⚠️ 水肿风险提示
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>{data.edemaNote}</div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          饮水时间表（前5项）
        </div>
        {(data.hydrationSchedule || []).slice(0, 5).map((h, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: "7px 0",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.sky,
                minWidth: 44,
              }}
            >
              {h.time}
            </span>
            <span style={{ fontSize: 12, color: C.emerald, minWidth: 48 }}>
              {h.amount}
            </span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{h.note}</span>
          </div>
        ))}
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          电解质建议
        </div>
        {(data.electrolyteTips || []).map((t, i) => (
          <Chip key={i} color={C.sky}>
            {t}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function VisceralResult({ data }) {
  if (!data) return null;
  const riskColor =
    { low: C.emerald, moderate: C.amber, high: C.rose, critical: C.rose }[
      data.visceralRiskLevel
    ] || C.emerald;
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <div style={{ position: "relative" }}>
          <GaugeArc
            value={data.visceralFatLevel}
            max={20}
            color={riskColor}
            size={90}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-46%)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: riskColor }}>
              {data.visceralFatLevel}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <Tag color={riskColor}>{data.visceralRiskLevel}</Tag>
            {data.metabolicAge && (
              <Tag color={C.sky}>代谢年龄 {data.metabolicAge}岁</Tag>
            )}
          </div>
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>
            {data.visceralInterpretation}
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12,
          color: C.textSub,
          lineHeight: 1.6,
          marginBottom: 14,
        }}
      >
        {data.bmrAnalysis}
      </div>
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          干预计划
        </div>
        {(data.interventionPlan || []).slice(0, 4).map((p, i) => (
          <div
            key={i}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              marginBottom: 6,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color:
                    p.category === "diet"
                      ? C.emerald
                      : p.category === "exercise"
                        ? C.sky
                        : C.violet,
                }}
              >
                {p.category === "diet"
                  ? "饮食"
                  : p.category === "exercise"
                    ? "运动"
                    : "生活"}{" "}
                · {p.action}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>
                {p.frequency}
              </span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>
              {p.expectedEffect}
            </div>
          </div>
        ))}
      </div>
      {data.medicalNote && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            background: C.roseDim,
            border: `1px solid ${C.rose}30`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: C.rose,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            🏥 建议就医
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>
            {data.medicalNote}
          </div>
        </div>
      )}
      <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted }}>
        {data.timelineExpectation}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  STEP COMPONENTS
// ══════════════════════════════════════════════════════════════
const DEMO_M = {
  weight: 78.5,
  skeletalMuscleMass: 32.4,
  bodyFatMass: 18.2,
  bodyFatPercentage: 23.2,
  totalBodyWater: 43.1,
  intracellularWater: 27.8,
  extracellularWater: 15.3,
  protein: 11.8,
  minerals: 3.42,
  leanBodyMass: 60.3,
  basalMetabolicRate: 1724,
  bmi: 24.1,
  visceralFatLevel: 8,
  waistHipRatio: 0.88,
  inBodyScore: 74,
  segmentalLeanMass: {
    rightArm: 3.2,
    leftArm: 3.0,
    trunk: 25.1,
    rightLeg: 9.8,
    leftLeg: 9.6,
  },
};

function StepImport({ onNext }) {
  const [method, setMethod] = useState(null);
  const [provider, setProvider] = useState("qwen");

  const providers = [
    { id: "qwen", label: "Qwen-VL", tag: "国内直连 ✅", color: C.emerald },
    { id: "claude", label: "Claude Vision", tag: "需VPN", color: C.violet },
    { id: "openai", label: "GPT-4o", tag: "需VPN", color: C.sky },
    { id: "gemini", label: "Gemini 2.0", tag: "需VPN", color: C.amber },
    { id: "ollama", label: "Ollama 本地", tag: "离线 ✅", color: C.rose },
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          01 / 03
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          导入 InBody 数据
        </h2>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 28,
        }}
      >
        {[
          {
            id: "pdf",
            icon: "⬆️",
            title: "上传 PDF",
            sub: "AI 视觉识别，推荐",
          },
          {
            id: "manual",
            icon: "✏️",
            title: "手动填写",
            sub: "保底方案，全面兼容",
          },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMethod(opt.id)}
            style={{
              ...glass({
                border: `1px solid ${method === opt.id ? C.emerald : C.border}`,
                background: method === opt.id ? C.emeraldDim : C.surface,
              }),
              padding: "26px 20px",
              cursor: "pointer",
              textAlign: "center",
              outline: "none",
              transition: "all .2s",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.icon}</div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
              {opt.title}
            </div>
            <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
              {opt.sub}
            </div>
          </button>
        ))}
      </div>

      {method === "pdf" && (
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              ...glass({
                border: `2px dashed rgba(255,255,255,0.12)`,
                background: "transparent",
              }),
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 36, opacity: 0.4, marginBottom: 10 }}>
              📄
            </div>
            <div style={{ color: C.textSub, fontSize: 14 }}>
              拖拽或点击上传 InBody PDF
            </div>
            <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
              支持所有 InBody 机型
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: C.textMuted,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            识别引擎
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {providers.map((p) => (
              <button
                key={p.id}
                onClick={() => setProvider(p.id)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: `1px solid ${provider === p.id ? p.color + "60" : C.border}`,
                  background:
                    provider === p.id ? `${p.color}15` : "transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ color: p.color, fontSize: 12, fontWeight: 700 }}>
                  {p.label}
                </span>
                <span style={{ fontSize: 10, color: C.textMuted }}>
                  {p.tag}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {method === "manual" && (
        <div
          style={{
            ...glass({ border: `1px solid ${C.sky}25`, background: C.skyDim }),
            padding: "16px 20px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              color: C.sky,
              fontWeight: 600,
              fontSize: 13,
              marginBottom: 4,
            }}
          >
            📋 对照 InBody 报告填写
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, lineHeight: 1.6 }}>
            准备好 InBody 报告，下一步按字段填写，约需 3 分钟。
          </div>
        </div>
      )}

      <button
        disabled={!method}
        onClick={() => onNext({ method, pdfProvider: provider })}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: 14,
          border: "none",
          background: method
            ? `linear-gradient(135deg,${C.emerald},#059669)`
            : "rgba(255,255,255,0.04)",
          color: method ? "#fff" : C.textMuted,
          fontSize: 15,
          fontWeight: 700,
          cursor: method ? "pointer" : "not-allowed",
          transition: "all .2s",
        }}
      >
        {method === "pdf"
          ? "开始识别 →"
          : method === "manual"
            ? "手动填写 →"
            : "请先选择方式"}
      </button>
    </div>
  );
}

function StepMeasurements({ onNext, onBack }) {
  const [data, setData] = useState({ ...DEMO_M });
  const [tab, setTab] = useState("body");
  const set = (k, v) => setData((d) => ({ ...d, [k]: parseFloat(v) || 0 }));
  const setSeg = (k, v) =>
    setData((d) => ({
      ...d,
      segmentalLeanMass: { ...d.segmentalLeanMass, [k]: parseFloat(v) || 0 },
    }));

  const tabs = [
    { id: "body", label: "⚖ 体成分" },
    { id: "water", label: "💧 水分" },
    { id: "meta", label: "🔥 代谢" },
    { id: "risk", label: "⚡ 风险" },
    { id: "seg", label: "💪 节段" },
  ];

<<<<<<< HEAD
  const FI = ({
    label,
    field,
    unit,
    hint = "",
    color = C.text,
    seg = false,
  }) => (
=======
  const FI = ({ label, field, unit, hint = "", color = C.text, seg = false }) => (
>>>>>>> bfb8c6371dc78cec03f7cd04924eb4a5bec4dd87
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 5,
        }}
      >
        <label style={{ fontSize: 12, color: C.textSub }}>{label}</label>
        {hint && (
          <span style={{ fontSize: 11, color: C.textMuted }}>{hint}</span>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <input
          type="number"
          step="0.01"
          value={
            seg ? data.segmentalLeanMass?.[field] || "" : data[field] || ""
          }
          onChange={(e) =>
            seg ? setSeg(field, e.target.value) : set(field, e.target.value)
          }
          style={{
            width: "100%",
            padding: "11px 44px 11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${(seg ? data.segmentalLeanMass?.[field] : data[field]) ? `${C.emerald}50` : C.border}`,
            borderRadius: 10,
            color,
            fontSize: 15,
            fontWeight: 600,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
            transition: "border .2s",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: C.textMuted,
            fontSize: 12,
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );

  const ecw =
    data.intracellularWater > 0
      ? (
          data.extracellularWater /
          (data.intracellularWater + data.extracellularWater)
        ).toFixed(3)
      : null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          02 / 03
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          InBody 测量数据
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
          对照报告填写以下数值（已预填示例数据）
        </p>
      </div>
      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: `1px solid ${tab === t.id ? `${C.emerald}50` : "transparent"}`,
              background:
                tab === t.id ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: tab === t.id ? C.emerald : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={glass({ padding: "24px" })}>
        {tab === "body" && (
          <>
            <FI label="体重" field="weight" unit="kg" />
            <FI
              label="骨骼肌量 (SMM)"
              field="skeletalMuscleMass"
              unit="kg"
              hint="Skeletal Muscle Mass"
              color={C.emerald}
            />
            <FI
              label="体脂肪量"
              field="bodyFatMass"
              unit="kg"
              color={C.amber}
            />
            <FI
              label="体脂率 (PBF)"
              field="bodyFatPercentage"
              unit="%"
              hint="Percent Body Fat"
              color={C.amber}
            />
            <FI
              label="去脂体重 (LBM)"
              field="leanBodyMass"
              unit="kg"
              hint="Lean Body Mass"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <FI label="蛋白质" field="protein" unit="kg" />
              <FI label="无机盐" field="minerals" unit="kg" hint="Minerals" />
            </div>
          </>
        )}
        {tab === "water" && (
          <>
            <FI
              label="体水分 (TBW)"
              field="totalBodyWater"
              unit="L"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <FI
                label="细胞内水分 (ICW)"
                field="intracellularWater"
                unit="L"
                color={C.sky}
              />
              <FI
                label="细胞外水分 (ECW)"
                field="extracellularWater"
                unit="L"
                color={C.sky}
              />
            </div>
            {ecw && (
              <div
                style={{
                  marginTop: 8,
                  padding: "11px 14px",
                  borderRadius: 10,
                  background:
                    parseFloat(ecw) >= 0.38 ? C.amberDim : C.emeraldDim,
                  border: `1px solid ${parseFloat(ecw) >= 0.38 ? C.amber + "40" : C.emerald + "40"}`,
                }}
              >
                <span style={{ fontSize: 12, color: C.textSub }}>
                  ECW/TBW：
                </span>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: parseFloat(ecw) >= 0.38 ? C.amber : C.emerald,
                  }}
                >
                  {ecw}
                </span>
                <span
                  style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}
                >
                  {parseFloat(ecw) >= 0.38 ? "⚠️ 偏高，水肿风险" : "✅ 正常"}
                </span>
              </div>
            )}
          </>
        )}
        {tab === "meta" && (
          <>
            <div
              style={{
                ...glass({
                  border: `1px solid ${C.emerald}25`,
                  background: C.emeraldDim,
                }),
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.emerald,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                🔬 InBody 实测 BMR
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                InBody 机器直接测量，精度高于 Mifflin
                公式，所有营养计算均基于此值。
              </div>
            </div>
            <FI
              label="基础代谢率 (BMR)"
              field="basalMetabolicRate"
              unit="kcal"
              hint="Basal Metabolic Rate"
              color={C.emerald}
            />
            <FI label="BMI" field="bmi" unit="" hint="Body Mass Index" />
          </>
        )}
        {tab === "risk" && (
          <>
            <FI
              label="内脏脂肪等级 (VFL 1–20)"
              field="visceralFatLevel"
              unit=""
              hint={
                data.visceralFatLevel >= 10
                  ? "⚠️偏高"
                  : data.visceralFatLevel >= 5
                    ? "注意"
                    : "正常"
              }
              color={data.visceralFatLevel >= 10 ? C.amber : C.text}
            />
            <FI
              label="腰臀比 (WHR)"
              field="waistHipRatio"
              unit=""
              hint="Waist-Hip Ratio"
              color={C.amber}
            />
            <FI
              label="InBody 评分（可选）"
              field="inBodyScore"
              unit="分"
              hint="0–100"
            />
          </>
        )}
        {tab === "seg" && (
          <>
            <div
              style={{
                ...glass({
                  border: `1px solid ${C.sky}25`,
                  background: C.skyDim,
                }),
                padding: "12px 16px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.sky,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                💡 节段骨骼肌（可选）
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                用于判断肌肉不平衡，部分机型有此数据。
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <FI label="右臂" field="rightArm" unit="kg" seg />
              <FI label="左臂" field="leftArm" unit="kg" seg />
            </div>
            <FI label="躯干" field="trunk" unit="kg" seg />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <FI label="右腿" field="rightLeg" unit="kg" seg />
              <FI label="左腿" field="leftLeg" unit="kg" seg />
            </div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textMuted,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← 返回
        </button>
        <button
          onClick={() => onNext(data)}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background: `linear-gradient(135deg,${C.emerald},#059669)`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          填写基础信息 →
        </button>
      </div>
    </div>
  );
}

function StepProfile({ onNext, onBack }) {
  const [f, setF] = useState({
    age: 28,
    gender: "male",
    heightCm: 175,
    goal: "muscle_gain",
    fitnessLevel: "intermediate",
    activityLevel: "medium",
    availableMinutesPerDay: 45,
    equipmentList: "gym",
    weeklyBudget: 300,
    dietStyle: "balanced",
    sleepTime: "23:00",
    wakeTime: "07:00",
    provider: "qwen",
    apiKey: "",
    modelName: "",
  });
  const s = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const Sel = ({ label, field, opts }) => (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 12,
          color: C.textMuted,
          marginBottom: 8,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        {opts.map((o) => (
          <button
            key={o.v}
            onClick={() => s(field, o.v)}
            style={{
              padding: "7px 15px",
              borderRadius: 20,
              border: `1px solid ${f[field] === o.v ? `${C.emerald}50` : "transparent"}`,
              background:
                f[field] === o.v ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: f[field] === o.v ? C.emerald : C.textSub,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  const needsVPN = ["claude", "openai", "gemini"].includes(f.provider);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          03 / 03
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          基础信息 & AI 配置
        </h2>
      </div>
      <div style={glass({ padding: "26px" })}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 20,
          }}
        >
          {[
            { l: "年龄", k: "age", u: "岁" },
            { l: "身高", k: "heightCm", u: "cm" },
            { l: "预算", k: "weeklyBudget", u: "¥/周" },
          ].map((item) => (
            <div key={item.k}>
              <div
                style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}
              >
                {item.l}
              </div>
              <input
                type="number"
                value={f[item.k]}
                onChange={(e) => s(item.k, +e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${C.border}`,
                  borderRadius: 9,
                  color: C.text,
                  fontSize: 15,
                  fontWeight: 700,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: C.textMuted,
                  textAlign: "right",
                  marginTop: 2,
                }}
              >
                {item.u}
              </div>
            </div>
          ))}
        </div>
        <Sel
          label="性别"
          field="gender"
          opts={[
            { v: "male", l: "男性" },
            { v: "female", l: "女性" },
            { v: "other", l: "其他" },
          ]}
        />
        <Sel
          label="目标"
          field="goal"
          opts={[
            { v: "muscle_gain", l: "增肌" },
            { v: "weight_loss", l: "减脂" },
            { v: "recomposition", l: "重塑" },
            { v: "maintain", l: "维持" },
          ]}
        />
        <Sel
          label="健身水平"
          field="fitnessLevel"
          opts={[
            { v: "beginner", l: "初级" },
            { v: "intermediate", l: "中级" },
            { v: "advanced", l: "高级" },
          ]}
        />
        <Sel
          label="活动水平"
          field="activityLevel"
          opts={[
            { v: "low", l: "低（久坐）" },
            { v: "medium", l: "中（轻度）" },
            { v: "high", l: "高（经常运动）" },
          ]}
        />
        <Sel
          label="训练场地"
          field="equipmentList"
          opts={[
            { v: "gym", l: "健身房" },
            { v: "home", l: "家用器材" },
            { v: "none", l: "徒手" },
          ]}
        />
        <Sel
          label="饮食风格"
          field="dietStyle"
          opts={[
            { v: "budget", l: "经济实惠" },
            { v: "balanced", l: "均衡适中" },
            { v: "premium", l: "豪华品质" },
          ]}
        />

        <div
          style={{ borderTop: `1px solid ${C.border}`, margin: "20px 0 18px" }}
        />

        <div
          style={{
            fontSize: 12,
            color: C.textMuted,
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          AI 方案生成引擎
        </div>
        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {[
            { v: "qwen", l: "Qwen ✅", note: "国内直连" },
            { v: "deepseek", l: "DeepSeek ✅", note: "国内直连" },
            { v: "claude", l: "Claude", note: "需VPN" },
            { v: "openai", l: "OpenAI", note: "需VPN" },
            { v: "gemini", l: "Gemini", note: "需VPN" },
            { v: "ollama", l: "Ollama", note: "本地" },
          ].map((p) => (
            <button
              key={p.v}
              onClick={() => s("provider", p.v)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: `1px solid ${f.provider === p.v ? `${C.emerald}50` : "transparent"}`,
                background:
                  f.provider === p.v ? C.emeraldDim : "rgba(255,255,255,0.04)",
                color: f.provider === p.v ? C.emerald : C.textSub,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
        {needsVPN && (
          <div
            style={{
              ...glass({
                border: `1px solid ${C.amber}25`,
                background: C.amberDim,
              }),
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <span style={{ fontSize: 12, color: C.amber }}>
              ⚠️ {f.provider} 在国内需要 VPN 才能访问
            </span>
          </div>
        )}
        <input
          type="password"
          placeholder={`${f.provider} API Key`}
          value={f.apiKey}
          onChange={(e) => s("apiKey", e.target.value)}
          style={{
            width: "100%",
            padding: "11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            color: C.text,
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
            fontFamily: "inherit",
            marginBottom: 8,
          }}
        />
        <div style={{ fontSize: 11, color: C.textMuted }}>
          Key 存于本地浏览器，不上传任何服务器
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textMuted,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← 返回
        </button>
        <button
          onClick={() => onNext(f)}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background: `linear-gradient(135deg,${C.emerald},#059669)`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          生成专业方案 ✦
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ measurements: m, profile: p, onReset }) {
  const [states, setStates] = useState({
    bodyComposition: "idle",
    workout: "idle",
    nutrition: "idle",
    hydration: "idle",
    visceral: "idle",
  });
  const [data, setData] = useState({});
  const [errors, setErrors] = useState({});
  const [genAll, setGenAll] = useState(false);

  const aiCfg = {
    provider: p.provider,
    apiKey: p.apiKey,
    modelName: p.modelName,
  };

  const MODULES = [
    {
      key: "bodyComposition",
      title: "体成分概览",
      icon: "📊",
      color: C.emerald,
      dim: C.emeraldDim,
      prompt: () => promptBodyComposition(p, m),
      render: (d) => <BodyCompResult data={d} />,
    },
    {
      key: "workout",
      title: "精准训练计划",
      icon: "💪",
      color: C.sky,
      dim: C.skyDim,
      prompt: () => promptWorkout(p, m),
      render: (d) => <WorkoutResult data={d} />,
    },
    {
      key: "nutrition",
      title: "精准营养方案",
      icon: "🥗",
      color: C.emerald,
      dim: C.emeraldDim,
      prompt: () => promptNutrition(p, m),
      render: (d) => <NutritionResult data={d} />,
    },
    {
      key: "hydration",
      title: "水分管理",
      icon: "💧",
      color: C.sky,
      dim: C.skyDim,
      prompt: () => promptHydration(p, m),
      render: (d) => <HydrationResult data={d} />,
    },
    {
      key: "visceral",
      title: "内脏健康与代谢",
      icon: "🫀",
      color: m.visceralFatLevel >= 10 ? C.rose : C.amber,
      dim: m.visceralFatLevel >= 10 ? C.roseDim : C.amberDim,
      prompt: () => promptVisceral(p, m),
      render: (d) => <VisceralResult data={d} />,
    },
  ];

  const generate = useCallback(
    async (key) => {
      const mod = MODULES.find((m) => m.key === key);
      if (!mod) return;
      setStates((s) => ({ ...s, [key]: "loading" }));
      setErrors((e) => ({ ...e, [key]: null }));
      try {
        const raw = await callAI(mod.prompt(), aiCfg);
        const parsed = parseJSON(raw);
        setData((d) => ({ ...d, [key]: parsed }));
        setStates((s) => ({ ...s, [key]: "success" }));
      } catch (err) {
        setErrors((e) => ({ ...e, [key]: err.message }));
        setStates((s) => ({ ...s, [key]: "error" }));
      }
    },
    [m, p],
  );

  const generateAll = async () => {
    setGenAll(true);
    for (const mod of MODULES) {
      await generate(mod.key);
    }
    setGenAll(false);
  };

  const tdee = Math.round(
    m.basalMetabolicRate *
      (p.activityLevel === "high"
        ? 1.55
        : p.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const ecwRatio =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "-";
  const vColor =
    m.visceralFatLevel >= 10
      ? C.rose
      : m.visceralFatLevel >= 5
        ? C.amber
        : C.emerald;
  const goalMap = {
    muscle_gain: "增肌塑形",
    weight_loss: "减脂瘦身",
    recomposition: "体成分重塑",
    maintain: "维持体形",
  };

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slide{0%{width:0%;margin-left:0}50%{width:55%;margin-left:20%}100%{width:0%;margin-left:100%}}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 28,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: C.emerald,
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            InBody OS · 专业体成分分析
          </div>
          <h1
            style={{
              fontSize: 34,
              fontWeight: 800,
              color: C.text,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            体成分方案
          </h1>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
            {p.age}岁 · {p.gender === "male" ? "男" : "女"} ·{" "}
            {goalMap[p.goal] || p.goal}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={generateAll}
            disabled={genAll}
            style={{
              padding: "9px 18px",
              borderRadius: 12,
              border: "none",
              background: genAll
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg,${C.emerald},#059669)`,
              color: genAll ? C.textMuted : "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: genAll ? "not-allowed" : "pointer",
            }}
          >
            {genAll ? "生成中…" : "✦ 全部生成"}
          </button>
          <button
            onClick={onReset}
            style={{
              padding: "9px 14px",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.textMuted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            重新导入
          </button>
        </div>
      </div>

      {/* 核心数据总览 */}
      <div style={glass({ padding: "26px", marginBottom: 20 })}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            letterSpacing: "0.1em",
            marginBottom: 18,
            textTransform: "uppercase",
          }}
        >
          InBody 核心数据一览
        </div>
        {/* 4大指标 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4,1fr)",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {[
            {
              label: "体重",
              val: m.weight,
              unit: "kg",
              color: C.text,
              icon: "⚖️",
            },
            {
              label: "骨骼肌量",
              val: m.skeletalMuscleMass,
              unit: "kg",
              color: C.emerald,
              icon: "💪",
            },
            {
              label: "体脂率",
              val: `${m.bodyFatPercentage}%`,
              unit: "",
              color: C.amber,
              icon: "🔥",
            },
            {
              label: "实测 BMR",
              val: m.basalMetabolicRate,
              unit: "kcal",
              color: C.sky,
              icon: "⚡",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={glass({
                padding: "16px 18px",
                border: `1px solid ${item.color}18`,
                animation: `up .4s ease ${i * 0.07}s both`,
              })}
            >
              <div style={{ fontSize: 18, marginBottom: 7 }}>{item.icon}</div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: item.color,
                  lineHeight: 1,
                }}
              >
                {item.val}
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>
                  {item.unit}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* 体成分 + 仪表 */}
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}
        >
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
              体成分构成
            </div>
            {[
              {
                label: "骨骼肌量",
                val: m.skeletalMuscleMass,
                max: m.weight * 0.55,
                color: C.emerald,
              },
              {
                label: "体脂肪量",
                val: m.bodyFatMass,
                max: m.weight * 0.45,
                color: C.amber,
              },
              { label: "蛋白质", val: m.protein, max: 14, color: C.sky },
              { label: "无机盐", val: m.minerals, max: 5, color: C.violet },
            ].map((item, i) => (
              <div key={i} style={{ marginBottom: 11 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ fontSize: 12, color: C.textSub }}>
                    {item.label}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: item.color }}
                  >
                    {item.val} kg
                  </span>
                </div>
                <Bar value={item.val} max={item.max} color={item.color} />
              </div>
            ))}
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {m.inBodyScore && (
              <div
                style={glass({
                  padding: "14px",
                  textAlign: "center",
                  border: `1px solid ${C.emerald}18`,
                })}
              >
                <div style={{ position: "relative", display: "inline-block" }}>
                  <GaugeArc
                    value={m.inBodyScore}
                    max={100}
                    color={C.emerald}
                    size={84}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%,-46%)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: C.emerald,
                      }}
                    >
                      {m.inBodyScore}
                    </div>
                  </div>
                </div>
                <div
                  style={{ fontSize: 11, color: C.textMuted, marginTop: -2 }}
                >
                  InBody 评分
                </div>
              </div>
            )}
            <div
              style={glass({
                padding: "14px",
                textAlign: "center",
                border: `1px solid ${vColor}18`,
              })}
            >
              <div style={{ position: "relative", display: "inline-block" }}>
                <GaugeArc
                  value={m.visceralFatLevel}
                  max={20}
                  color={vColor}
                  size={84}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%,-46%)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 800, color: vColor }}>
                    {m.visceralFatLevel}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: -2 }}>
                内脏脂肪等级
              </div>
            </div>
            <div
              style={glass({ padding: "12px", border: `1px solid ${C.sky}18` })}
            >
              <div
                style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}
              >
                ECW/TBW
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: parseFloat(ecwRatio) >= 0.38 ? C.amber : C.sky,
                }}
              >
                {ecwRatio}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                {parseFloat(ecwRatio) >= 0.38 ? "⚠ 水肿风险" : "✓ 正常"}
              </div>
            </div>
            <div
              style={glass({
                padding: "12px",
                border: `1px solid ${C.emerald}18`,
              })}
            >
              <div
                style={{ fontSize: 10, color: C.textMuted, marginBottom: 5 }}
              >
                TDEE
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.emerald }}>
                {tdee}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                kcal / 天
              </div>
            </div>
          </div>
        </div>

        {/* 节段 */}
        {m.segmentalLeanMass && (
          <div
            style={{
              marginTop: 22,
              paddingTop: 18,
              borderTop: `1px solid ${C.border}`,
            }}
          >
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>
              节段骨骼肌分布
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5,1fr)",
                gap: 8,
              }}
            >
              {[
                ["右臂", "rightArm"],
                ["左臂", "leftArm"],
                ["躯干", "trunk"],
                ["右腿", "rightLeg"],
                ["左腿", "leftLeg"],
              ].map(([l, k]) => (
                <div
                  key={k}
                  style={glass({
                    padding: "12px",
                    textAlign: "center",
                    border: `1px solid ${C.sky}15`,
                  })}
                >
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.sky }}>
                    {m.segmentalLeanMass[k]}
                  </div>
                  <div
                    style={{ fontSize: 9, color: C.textMuted, margin: "2px 0" }}
                  >
                    kg
                  </div>
                  <div style={{ fontSize: 11, color: C.textSub }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 6个模块卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {MODULES.map((mod) => (
          <ModuleCard
            key={mod.key}
            title={mod.title}
            icon={mod.icon}
            color={mod.color}
            dim={mod.dim}
            status={states[mod.key]}
            error={errors[mod.key]}
            onGenerate={() => generate(mod.key)}
          >
            {mod.render(data[mod.key])}
          </ModuleCard>
        ))}

        {/* 进度追踪（占位） */}
        <div
          style={glass({
            border: `1px solid ${C.violetDim}`,
            overflow: "hidden",
          })}
        >
          <div
            style={{
              padding: "18px 22px 14px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: C.violetDim,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 17,
              }}
            >
              📈
            </div>
            <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>
              进度追踪
            </span>
            <Tag color={C.violet}>下次检测后开启</Tag>
          </div>
          <div style={{ padding: "28px 22px", textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.25, marginBottom: 12 }}>
              📊
            </div>
            <div style={{ color: C.textSub, fontSize: 14, marginBottom: 8 }}>
              上传第二份 InBody 报告后可用
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              自动对比体成分变化趋势
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={glass({
          padding: "14px 22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: `1px solid ${C.emerald}18`,
        })}
      >
        <div style={{ fontSize: 12, color: C.textMuted }}>
          基于 <span style={{ color: C.emerald }}>InBody 实测数据</span> 驱动 ·
          非公式估算
        </div>
        <div
          style={{ display: "flex", gap: 12, fontSize: 11, color: C.textMuted }}
        >
          <span>
            BMR <span style={{ color: C.sky }}>{m.basalMetabolicRate}</span>{" "}
            kcal
          </span>
          <span>·</span>
          <span>
            SMM <span style={{ color: C.emerald }}>{m.skeletalMuscleMass}</span>{" "}
            kg
          </span>
          <span>·</span>
          <span>
            VFL <span style={{ color: vColor }}>{m.visceralFatLevel}</span>
          </span>
          <span>·</span>
          <span>
            引擎 <span style={{ color: C.violet }}>{p.provider}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  APP ROOT
// ══════════════════════════════════════════════════════════════
export default function InBodyOS() {
  const [step, setStep] = useState("welcome");
  const [measurements, setMeasurements] = useState(null);
  const [profile, setProfile] = useState(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `
        radial-gradient(ellipse 80% 50% at 50% -5%, rgba(16,185,129,.07) 0%, transparent 55%),
        radial-gradient(ellipse 50% 40% at 85% 85%, rgba(14,165,233,.05) 0%, transparent 50%),
        ${C.bg}`,
        color: C.text,
        fontFamily: "'DM Sans','PingFang SC','Helvetica Neue',sans-serif",
        padding: "0 20px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:rgba(100,116,139,.4)}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}
        button{font-family:inherit}
      `}</style>

      {/* Nav */}
      <nav
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "20px 0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `linear-gradient(135deg,${C.emerald},#059669)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>
            InBody
          </span>
          <span style={{ fontWeight: 400, fontSize: 16, color: C.textMuted }}>
            OS
          </span>
          <div
            style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 5,
              background: C.emeraldDim,
              color: C.emerald,
              border: `1px solid ${C.emerald}25`,
              letterSpacing: "0.08em",
            }}
          >
            PRO
          </div>
        </div>
        {step !== "welcome" && step !== "dashboard" && (
          <div style={{ display: "flex", gap: 5 }}>
            {["import", "measurements", "profile"].map((s, i) => (
              <div
                key={s}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background:
                    ["measurements", "profile", "dashboard"].indexOf(step) >= i
                      ? C.emerald
                      : "rgba(255,255,255,.09)",
                  transition: "background .3s",
                }}
              />
            ))}
          </div>
        )}
      </nav>

      <div style={{ maxWidth: 920, margin: "0 auto", paddingTop: 40 }}>
        {step === "welcome" && (
          <div
            style={{
              maxWidth: 580,
              margin: "60px auto 0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                color: C.emerald,
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              专业体成分分析系统
            </div>
            <h1
              style={{
                fontSize: 56,
                fontWeight: 800,
                color: C.text,
                lineHeight: 1.05,
                marginBottom: 18,
              }}
            >
              InBody OS
            </h1>
            <p
              style={{
                fontSize: 16,
                color: C.textMuted,
                lineHeight: 1.75,
                marginBottom: 44,
                maxWidth: 440,
                margin: "0 auto 44px",
              }}
            >
              上传 InBody 报告，AI 自动解析实测数据， 生成专业级训练 · 营养 ·
              水分 · 代谢管理方案。
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 44,
              }}
            >
              {[
                {
                  icon: "📊",
                  title: "实测 BMR 驱动",
                  sub: "非公式估算，精准到位",
                },
                { icon: "💧", title: "水分精准分析", sub: "ICW/ECW 比值解读" },
                {
                  icon: "🌍",
                  title: "国内直连可用",
                  sub: "Qwen/DeepSeek 无需 VPN",
                },
              ].map((f, i) => (
                <div
                  key={i}
                  style={glass({ padding: "18px 16px", textAlign: "center" })}
                >
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{f.icon}</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 4,
                    }}
                  >
                    {f.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    {f.sub}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("import")}
              style={{
                padding: "16px 48px",
                borderRadius: 14,
                border: "none",
                background: `linear-gradient(135deg,${C.emerald},#059669)`,
                color: "#fff",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 16px 48px rgba(16,185,129,.22)",
                letterSpacing: "0.02em",
              }}
            >
              开始分析 →
            </button>
          </div>
        )}
        {step === "import" && (
          <StepImport onNext={() => setStep("measurements")} />
        )}
        {step === "measurements" && (
          <StepMeasurements
            onNext={(m) => {
              setMeasurements(m);
              setStep("profile");
            }}
            onBack={() => setStep("import")}
          />
        )}
        {step === "profile" && (
          <StepProfile
            onNext={(prof) => {
              setProfile(prof);
              setStep("dashboard");
            }}
            onBack={() => setStep("measurements")}
          />
        )}
        {step === "dashboard" && (
          <Dashboard
            measurements={measurements || DEMO_M}
            profile={
              profile || {
                age: 28,
                gender: "male",
                goal: "muscle_gain",
                activityLevel: "medium",
                fitnessLevel: "intermediate",
                availableMinutesPerDay: 45,
                equipmentList: "gym",
                weeklyBudget: 300,
                dietStyle: "balanced",
                provider: "qwen",
                apiKey: "",
              }
            }
            onReset={() => {
              setStep("welcome");
              setMeasurements(null);
              setProfile(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
