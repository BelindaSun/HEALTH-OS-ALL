"use client";
import { useState, useRef, useCallback } from "react";

// ── COLORS ──────────────────────────────────────────────────
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
const g = (ex = {}) => ({
  background: C.surface,
  backdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  ...ex,
});

// ── VISION PROVIDERS ────────────────────────────────────────
const VISION_PROVIDERS = [
  {
    id: "qwen",
    label: "Qwen-VL",
    tag: "国内直连",
    vpn: false,
    color: C.emerald,
  },
  { id: "openai", label: "GPT-4o", tag: "需VPN", vpn: true, color: C.sky },
  {
    id: "claude",
    label: "Claude Vision",
    tag: "需VPN",
    vpn: true,
    color: C.violet,
  },
  { id: "gemini", label: "Gemini", tag: "需VPN", vpn: true, color: C.amber },
  {
    id: "ollama",
    label: "Ollama+LLaVA",
    tag: "本地",
    vpn: false,
    color: C.rose,
  },
];

const TEXT_PROVIDERS = [
  { id: "qwen", label: "Qwen", tag: "国内直连", vpn: false },
  { id: "deepseek", label: "DeepSeek", tag: "国内直连", vpn: false },
  { id: "openai", label: "GPT-4o", tag: "需VPN", vpn: true },
  { id: "claude", label: "Claude", tag: "需VPN", vpn: true },
  { id: "gemini", label: "Gemini", tag: "需VPN", vpn: true },
  { id: "ollama", label: "Ollama", tag: "本地", vpn: false },
];

// ── AI CALL ─────────────────────────────────────────────────
async function callVisionAI(imageBase64, provider, apiKey, modelName) {
  const prompt = `You are an InBody report OCR assistant. Extract all measurement values from this InBody body composition report image.
Return ONLY a JSON object with these exact keys (use null for missing values):
{
  "weight": number, "skeletalMuscleMass": number, "bodyFatMass": number,
  "bodyFatPercentage": number, "totalBodyWater": number, "intracellularWater": number,
  "extracellularWater": number, "protein": number, "minerals": number,
  "leanBodyMass": number, "basalMetabolicRate": number, "bmi": number,
  "visceralFatLevel": integer, "waistHipRatio": number, "inBodyScore": integer,
  "segmentalLeanMass": { "rightArm": number, "leftArm": number, "trunk": number, "rightLeg": number, "leftLeg": number }
}
No explanations, no markdown, just the JSON object.`;

  if (provider === "qwen") {
    const res = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName || "qwen-vl-max",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
                },
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) throw new Error(`Qwen API error: ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName || "gpt-4o",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelName || "claude-opus-4-5",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: imageBase64,
                },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    return (await res.json()).content[0].text;
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    return (await res.json()).candidates[0].content.parts[0].text;
  }

  if (provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName || "llava",
        stream: false,
        messages: [{ role: "user", content: prompt, images: [imageBase64] }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    return (await res.json()).message.content;
  }

  throw new Error(`Unsupported vision provider: ${provider}`);
}

async function callTextAI(prompt, provider, apiKey, modelName) {
  const configs = {
    deepseek: {
      url: "https://api.deepseek.com/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: {
        model: modelName || "deepseek-chat",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    qwen: {
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: {
        model: modelName || "qwen-max",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    openai: {
      url: "https://api.openai.com/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: {
        model: modelName || "gpt-4o",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.choices[0].message.content,
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      auth: null,
      body: {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4096 },
      },
      extract: (d) => d.candidates[0].content.parts[0].text,
    },
    ollama: {
      url: "http://localhost:11434/api/chat",
      auth: null,
      body: {
        model: modelName || "qwen2.5:14b",
        stream: false,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.message.content,
    },
    claude: {
      url: "https://api.anthropic.com/v1/messages",
      auth: null,
      body: {
        model: modelName || "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      },
      extract: (d) => d.content[0].text,
    },
  };
  const cfg = configs[provider] || configs.deepseek;
  const headers = { "Content-Type": "application/json" };
  if (provider === "claude") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (cfg.auth) headers["Authorization"] = cfg.auth;
  const res = await fetch(cfg.url, {
    method: "POST",
    headers,
    body: JSON.stringify(cfg.body),
  });
  if (!res.ok)
    throw new Error(
      `${provider} API error: ${res.status}: ${await res.text()}`,
    );
  return cfg.extract(await res.json());
}

function parseJSON(raw) {
  const clean = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const s = clean.indexOf("{"),
    e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON found in response");
  return JSON.parse(clean.slice(s, e + 1));
}

// ── PROMPTS ─────────────────────────────────────────────────
function buildDataBlock(m, p) {
  const ecw =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "N/A";
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
  return {
    ecw,
    tdee,
    proteinG,
    block: `
InBody Data: weight=${m.weight}kg BMI=${m.bmi} BMR=${m.basalMetabolicRate}kcal(measured)
SMM=${m.skeletalMuscleMass}kg LBM=${m.leanBodyMass}kg BFM=${m.bodyFatMass}kg BF%=${m.bodyFatPercentage}%
TBW=${m.totalBodyWater}L ICW=${m.intracellularWater}L ECW=${m.extracellularWater}L ECW/TBW=${ecw}
Protein=${m.protein}kg Minerals=${m.minerals}kg VFL=${m.visceralFatLevel}/20 WHR=${m.waistHipRatio}
${m.inBodyScore ? `InBodyScore=${m.inBodyScore}` : ""}
${m.segmentalLeanMass ? `Segmental: RA=${m.segmentalLeanMass.rightArm} LA=${m.segmentalLeanMass.leftArm} Trunk=${m.segmentalLeanMass.trunk} RL=${m.segmentalLeanMass.rightLeg} LL=${m.segmentalLeanMass.leftLeg}kg` : ""}
User: age=${p.age} gender=${p.gender} height=${p.heightCm}cm goal=${p.goal}
activity=${p.activityLevel} fitness=${p.fitnessLevel} time=${p.availableMinutesPerDay}min/day
equipment=${p.equipmentList || "none"} diet=${p.dietStyle} budget=CNY${p.weeklyBudget}/week
TDEE=${tdee}kcal protein_target=${proteinG}g/day`,
  };
}

const GOAL_CN = {
  muscle_gain: "增肌塑形",
  weight_loss: "减脂瘦身",
  recomposition: "体成分重塑",
  maintain: "维持体形",
};

function promptBodyComp(m, p) {
  const { block } = buildDataBlock(m, p);
  return `You are a professional body composition expert. Analyze this InBody report and return ONLY JSON.
${block}
Return JSON: {"summary":"150字整体解读","analysis":{"smmRating":"low|normal|high","bodyFatRating":"low|normal|high","visceralRisk":"low|moderate|high","ecwRatio":0.370,"isEdemaRisk":false},"keyFindings":[{"title":"","value":"","interpretation":"","priority":"critical|important|info"}],"targetRanges":[{"metric":"","current":0,"idealMin":0,"idealMax":0,"unit":"","gapNote":""}],"actionPriority":["","",""],"personalizedNote":""}`;
}

function promptWorkout(m, p) {
  const { block } = buildDataBlock(m, p);
  const eq =
    p.equipmentList === "gym"
      ? "gym with all equipment"
      : p.equipmentList === "home"
        ? "home equipment"
        : "bodyweight only";
  return `You are a professional fitness coach. Create a workout plan based on InBody data. Return ONLY JSON.
${block} equipment=${eq}
Return JSON (weeklySchedule must have 7 days including 1 rest day):
{"overview":"","dataDriverNotes":"based on which InBody metrics","weeklySchedule":[{"day":"Monday","focus":"","warmup":["","",""],"exercises":[{"name":"","sets":3,"reps":"","muscleGroup":"","tip":""}],"cooldown":["",""],"durationMinutes":45}],"progressionLogic":"","safetyNote":"","personalizedNote":""}`;
}

function promptNutrition(m, p) {
  const { tdee, proteinG, block } = buildDataBlock(m, p);
  const calTarget =
    p.goal === "weight_loss"
      ? `${tdee - 400}~${tdee - 200}`
      : p.goal === "muscle_gain"
        ? `${tdee + 200}~${tdee + 400}`
        : `${tdee - 100}~${tdee + 100}`;
  const styleDesc =
    {
      budget: "budget-friendly simple foods",
      balanced: "balanced variety",
      premium: "premium quality ingredients",
    }[p.dietStyle] || "balanced";
  return `You are a sports nutritionist. Create a 7-day meal plan based on InBody measured BMR. Return ONLY JSON.
${block} calorie_target=${calTarget}kcal diet_style=${styleDesc}
IMPORTANT: Use InBody measured BMR=${m.basalMetabolicRate}kcal (not formula estimate). Protein target=${proteinG}g/day based on LBM.
Return JSON (weeklyPlan must have 7 days Mon-Sun, all meals in Chinese food):
{"bmrSource":"inbody_measured","basalMetabolicRate":${m.basalMetabolicRate},"tdee":${tdee},"dailyCalorieTarget":0,"macroSplit":{"protein":0,"carbs":0,"fat":0},"proteinTargetGrams":${proteinG},"weeklyPlan":[{"day":"周一","breakfast":{"name":"","foods":[""],"calories":0,"protein":0},"lunch":{"name":"","foods":[""],"calories":0,"protein":0},"dinner":{"name":"","foods":[""],"calories":0,"protein":0},"snack":{"name":"","foods":[""],"calories":0,"protein":0},"totalCalories":0}],"keyPrinciples":[""],"inBodyDataRationale":"","personalizedNote":""}`;
}

function promptHydration(m, p) {
  const { block } = buildDataBlock(m, p);
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
  return `You are a hydration expert. Create a hydration plan based on InBody water analysis. Return ONLY JSON.
${block} water_target=${target}ml ECW_ratio=${ecw} edema_risk=${edema}
Return JSON (hydrationSchedule 8+ entries from wake time ${p.wakeTime}):
{"currentTBW":${m.totalBodyWater},"currentECWRatio":${ecw},"isEdemaRisk":${edema},"edemaNote":${edema ? '"explain edema risk"' : "null"},"dailyWaterTargetMl":${target},"hydrationSchedule":[{"time":"07:00","amount":"400ml","note":""}],"electrolyteTips":["","",""],"hydrationPrinciples":["","",""],"warningSignals":["","",""],"sleepOptimizationTips":["","",""],"scienceNote":"","personalizedNote":""}`;
}

function promptVisceral(m, p) {
  const { block } = buildDataBlock(m, p);
  const risk =
    m.visceralFatLevel >= 15
      ? "critical"
      : m.visceralFatLevel >= 10
        ? "high"
        : m.visceralFatLevel >= 5
          ? "moderate"
          : "low";
  return `You are a metabolic health expert. Analyze visceral fat and metabolic health. Return ONLY JSON.
${block}
${m.visceralFatLevel >= 15 ? "CRITICAL: VFL>=15, medicalNote MUST recommend seeing a doctor." : ""}
Return JSON:
{"visceralFatLevel":${m.visceralFatLevel},"visceralRiskLevel":"${risk}","visceralInterpretation":"","metabolicAge":0,"bmrAnalysis":"","interventionPlan":[{"category":"diet|exercise|lifestyle","action":"","frequency":"","rationale":"","expectedEffect":""}],"progressMetrics":["","","",""],"timelineExpectation":"","medicalNote":${m.visceralFatLevel >= 15 ? '"recommend doctor"' : "null"},"personalizedNote":""}`;
}

// ── SMALL UI COMPONENTS ──────────────────────────────────────
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

function GaugeArc({ value, max, color, size = 90 }) {
  const r = 38,
    cx = 50,
    cy = 50;
  const toR = (d) => (d * Math.PI) / 180;
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

function Bullet({ children, color = C.emerald }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
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
          marginTop: 5,
        }}
      />
      <span style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>
        {children}
      </span>
    </div>
  );
}

// ── NUMBER INPUT (no pre-clear needed) ──────────────────────
function NumField({
  label,
  value,
  onChange,
  unit,
  hint = "",
  color = C.text,
  step = "0.01",
}) {
  return (
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
          step={step}
          value={value === 0 ? "" : value}
          placeholder="0"
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%",
            padding: "11px 44px 11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${value > 0 ? `${C.emerald}50` : C.border}`,
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
        {unit && (
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
        )}
      </div>
    </div>
  );
}

// ── MODULE CARD ──────────────────────────────────────────────
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
      style={g({
        border: `1px solid ${status === "success" ? `${color}25` : C.border}`,
        overflow: "hidden",
        transition: "border-color .3s",
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
          {status === "success" && <Tag color={color}>{"✓ 已生成"}</Tag>}
          {status === "success" && (
            <button
              onClick={onGenerate}
              style={{
                padding: "4px 10px",
                borderRadius: 14,
                border: `1px solid ${C.border}`,
                background: "transparent",
                color: C.textMuted,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              重新生成
            </button>
          )}
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
              padding: "22px 0",
              color: C.textMuted,
              fontSize: 13,
            }}
          >
            点击「生成」获取 AI 专业分析
          </div>
        )}
        {status === "loading" && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div style={{ color, fontSize: 13, marginBottom: 10 }}>
              AI 分析中，请稍候...
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
            {"⚠ "}
            {error || "生成失败，请检查 API Key 后重试"}
          </div>
        )}
        {status === "success" && children}
      </div>
    </div>
  );
}

// ── MODULE RESULT RENDERERS ──────────────────────────────────
function BodyCompResult({ data }) {
  if (!data) return null;
  const rc = (r) => (r === "high" ? C.amber : r === "low" ? C.rose : C.emerald);
  return (
    <div>
      <p
        style={{
          color: C.textSub,
          fontSize: 14,
          lineHeight: 1.7,
          marginBottom: 14,
        }}
      >
        {data.summary}
      </p>
      <div
        style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}
      >
        <Tag color={rc(data.analysis?.smmRating)}>
          骨骼肌 {data.analysis?.smmRating}
        </Tag>
        <Tag color={rc(data.analysis?.bodyFatRating)}>
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
        {data.analysis?.isEdemaRisk && (
          <Tag color={C.amber}>{"⚠ 水肿风险"}</Tag>
        )}
      </div>
      {data.keyFindings?.slice(0, 3).map((f, i) => (
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
              marginBottom: 4,
              color:
                f.priority === "critical"
                  ? C.rose
                  : f.priority === "important"
                    ? C.amber
                    : C.emerald,
            }}
          >
            {f.title} · {f.value}
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>
            {f.interpretation}
          </div>
        </div>
      ))}
      {data.actionPriority?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              letterSpacing: "0.1em",
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            优先行动
          </div>
          {data.actionPriority.map((a, i) => (
            <Bullet
              key={i}
              color={[C.rose, C.amber, C.emerald][i] || C.emerald}
            >
              {a}
            </Bullet>
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
          <span style={{ fontSize: 12, color: C.emerald }}>{"✦ "}</span>
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
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          color: C.textSub,
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        {data.dataDriverNotes}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          marginBottom: 14,
        }}
      >
        {data.weeklySchedule?.map((d, i) => (
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
          marginBottom: 14,
        }}
      >
        {[
          {
            label: "热量目标",
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
            style={g({
              padding: "11px",
              textAlign: "center",
              border: `1px solid ${item.color}20`,
            })}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: item.color }}>
              {item.val}
            </div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{item.unit}</div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
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
      {data.weeklyPlan?.slice(0, 3).map((day, i) => (
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
              marginBottom: 5,
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
          marginTop: 6,
          textAlign: "right",
        }}
      >
        共7天完整计划 · 基于InBody实测 BMR {data.basalMetabolicRate}kcal
      </div>
    </div>
  );
}

function HydrationResult({ data }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "实测体水分", val: `${data.currentTBW}L`, color: C.sky },
          {
            label: "每日目标",
            val: `${data.dailyWaterTargetMl}ml`,
            color: C.sky,
          },
          {
            label: "ECW/TBW",
            val: data.currentECWRatio,
            color: data.isEdemaRisk ? C.amber : C.sky,
          },
        ].map((item, i) => (
          <div
            key={i}
            style={g({
              flex: 1,
              padding: "12px",
              textAlign: "center",
              border: `1px solid ${item.color}20`,
            })}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>
              {item.val}
            </div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
              {item.label}
            </div>
          </div>
        ))}
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
            {"⚠ 水肿风险提示"}
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
          饮水时间表（前6项）
        </div>
        {data.hydrationSchedule?.slice(0, 6).map((h, i) => (
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
            <span style={{ fontSize: 12, color: C.emerald, minWidth: 52 }}>
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
        {data.electrolyteTips?.map((t, i) => (
          <Bullet key={i} color={C.sky}>
            {t}
          </Bullet>
        ))}
      </div>
    </div>
  );
}

function VisceralResult({ data }) {
  if (!data) return null;
  const rc =
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
          marginBottom: 14,
        }}
      >
        <div style={{ position: "relative" }}>
          <GaugeArc
            value={data.visceralFatLevel}
            max={20}
            color={rc}
            size={88}
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
            <div style={{ fontSize: 22, fontWeight: 800, color: rc }}>
              {data.visceralFatLevel}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: 7,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <Tag color={rc}>{data.visceralRiskLevel}</Tag>
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
          marginBottom: 12,
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
        {data.interventionPlan?.slice(0, 4).map((p, i) => (
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
                marginBottom: 3,
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
            {"🏥 建议就医"}
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>
            {data.medicalNote}
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted }}>
        {data.timelineExpectation}
      </div>
    </div>
  );
}
// ══════════════════════════════════════════════════════════════
//  STEP 1 — 截图上传 + AI识别
// ══════════════════════════════════════════════════════════════
function StepImport({ state, onUpdate, onNext }) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback(
    (file) => {
      if (!file || !file.type.startsWith("image/")) {
        setParseError("请上传图片文件（JPG / PNG / HEIC）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target.result);
        onUpdate("imageFile", file);
        onUpdate("imageBase64", (e.target.result as string).split(",")[1]);
      };
      reader.readAsDataURL(file);
      setParseError(null);
    },
    [onUpdate],
  );

  const handleParse = async () => {
    if (!state.imageBase64) {
      setParseError("请先上传截图");
      return;
    }
    if (!state.visionApiKey && state.visionProvider !== "ollama") {
      setParseError("请填写 API Key");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const raw = await callVisionAI(
        state.imageBase64,
        state.visionProvider,
        state.visionApiKey,
        state.visionModel,
      );
      const parsed = parseJSON(raw);
      // fill measurements
      const m: Record<string, any> = {};
      const fields = [
        "weight",
        "skeletalMuscleMass",
        "bodyFatMass",
        "bodyFatPercentage",
        "totalBodyWater",
        "intracellularWater",
        "extracellularWater",
        "protein",
        "minerals",
        "leanBodyMass",
        "basalMetabolicRate",
        "bmi",
        "visceralFatLevel",
        "waistHipRatio",
        "inBodyScore",
      ];
      fields.forEach((f) => {
        if (parsed[f] != null) m[f] = parsed[f];
      });
      if (parsed.segmentalLeanMass)
        m.segmentalLeanMass = parsed.segmentalLeanMass;
      // fill LBM if missing
      if (!m.leanBodyMass && m.weight && m.bodyFatMass)
        m.leanBodyMass = parseFloat((m.weight - m.bodyFatMass).toFixed(2));
      onUpdate("measurements", { ...state.measurements, ...m });
      onUpdate("parseSuccess", true);
      onUpdate("parsedFields", Object.keys(m).length);
    } catch (e) {
      setParseError(e.message || "识别失败，请重试或切换到手动填写");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
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
          上传 InBody 截图
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 8 }}>
          拍照或截图你的 InBody 报告，AI 自动识别所有数值
        </p>
      </div>

      {/* 上传区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        style={g({
          border: `2px dashed ${dragging ? C.emerald : preview ? C.emerald : "rgba(255,255,255,0.12)"}`,
          background: dragging ? C.emeraldDim : "transparent",
          padding: preview ? "16px" : "48px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 20,
          transition: "all .2s",
        })}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {preview ? (
          <div>
            <img
              src={preview}
              alt="InBody report"
              style={{
                maxWidth: "100%",
                maxHeight: 280,
                borderRadius: 12,
                objectFit: "contain",
              }}
            />
            <div style={{ color: C.emerald, fontSize: 13, marginTop: 10 }}>
              点击重新选择
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 14 }}>
              📱
            </div>
            <div style={{ color: C.textSub, fontSize: 15, marginBottom: 6 }}>
              点击上传 或 拖拽图片到此处
            </div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>
              支持 JPG / PNG / HEIC · 手机截图直接上传
            </div>
          </>
        )}
      </div>

      {/* 识别成功反馈 */}
      {state.parseSuccess && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: C.emeraldDim,
            border: `1px solid ${C.emerald}30`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.emerald,
              marginBottom: 4,
            }}
          >
            {"✅ 识别成功！共提取 "}
            {state.parsedFields}
            {" 个字段"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            下一步可核对并补填缺失数值
          </div>
        </div>
      )}

      {/* 视觉引擎选择 */}
      <div style={g({ padding: "20px 22px", marginBottom: 16 })}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          识别引擎
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {VISION_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => onUpdate("visionProvider", p.id)}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                cursor: "pointer",
                outline: "none",
                border: `1px solid ${state.visionProvider === p.id ? `${p.color}60` : C.border}`,
                background:
                  state.visionProvider === p.id
                    ? `${p.color}15`
                    : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all .15s",
              }}
            >
              <span style={{ color: p.color, fontSize: 12, fontWeight: 700 }}>
                {p.label}
              </span>
              <span style={{ fontSize: 10, color: C.textMuted }}>{p.tag}</span>
            </button>
          ))}
        </div>
        {VISION_PROVIDERS.find((p) => p.id === state.visionProvider)?.vpn && (
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: C.amberDim,
              border: `1px solid ${C.amber}30`,
              fontSize: 12,
              color: C.amber,
              marginBottom: 12,
            }}
          >
            {"⚠ "}
            {state.visionProvider} 在中国大陆需要 VPN
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>
            API Key
          </div>
          <input
            type="password"
            placeholder={`${state.visionProvider} API Key`}
            value={state.visionApiKey}
            onChange={(e) => onUpdate("visionApiKey", e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${state.visionApiKey ? `${C.emerald}50` : C.border}`,
              borderRadius: 10,
              color: C.text,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </div>
        {parseError && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: C.roseDim,
              border: `1px solid ${C.rose}30`,
              fontSize: 13,
              color: C.rose,
              marginBottom: 10,
            }}
          >
            {"⚠ "}
            {parseError}
          </div>
        )}
        <button
          onClick={handleParse}
          disabled={parsing || !preview}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 12,
            border: "none",
            background:
              !preview || parsing
                ? "rgba(255,255,255,0.05)"
                : `linear-gradient(135deg,${C.emerald},#059669)`,
            color: !preview || parsing ? C.textMuted : "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: !preview || parsing ? "not-allowed" : "pointer",
          }}
        >
          {parsing ? "AI 识别中..." : preview ? "开始识别" : "请先上传截图"}
        </button>
      </div>

      {/* 手动填写提示 */}
      <div
        style={{
          textAlign: "center",
          color: C.textMuted,
          fontSize: 13,
          marginBottom: 20,
        }}
      >
        没有截图？
        <button
          onClick={() => onUpdate("parseSuccess", true)}
          style={{
            background: "none",
            border: "none",
            color: C.sky,
            fontSize: 13,
            cursor: "pointer",
            textDecoration: "underline",
            marginLeft: 4,
          }}
        >
          直接手动填写
        </button>
      </div>

      <button
        onClick={onNext}
        disabled={!state.parseSuccess}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 14,
          border: "none",
          background: state.parseSuccess
            ? `linear-gradient(135deg,${C.emerald},#059669)`
            : "rgba(255,255,255,0.04)",
          color: state.parseSuccess ? "#fff" : C.textMuted,
          fontSize: 15,
          fontWeight: 700,
          cursor: state.parseSuccess ? "pointer" : "not-allowed",
        }}
      >
        {state.parseSuccess ? "核对数据 ->" : "请先识别或选择手动填写"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  STEP 2 — 数据核对填写
// ══════════════════════════════════════════════════════════════
function StepMeasurements({ state, onUpdate, onNext, onBack }) {
  const m = state.measurements;
  const setM = (k, v) => onUpdate("measurements", { ...m, [k]: v });
  const setSeg = (k, v) =>
    onUpdate("measurements", {
      ...m,
      segmentalLeanMass: { ...m.segmentalLeanMass, [k]: v },
    });
  const [tab, setTab] = useState("body");

  const ecwRatio =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : null;

  const TABS = [
    { id: "body", label: "⚖ 体成分" },
    { id: "water", label: "💧 水分" },
    { id: "meta", label: "🔥 代谢" },
    { id: "risk", label: "⚡ 风险" },
    { id: "seg", label: "💪 节段" },
  ];

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
          核对 InBody 数据
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
          {state.parseSuccess && state.parsedFields > 0
            ? `AI 已识别 ${state.parsedFields} 个字段，请核对并补填缺失项`
            : "请对照报告逐项填写"}
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              outline: "none",
              cursor: "pointer",
              border: `1px solid ${tab === t.id ? `${C.emerald}50` : "transparent"}`,
              background:
                tab === t.id ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: tab === t.id ? C.emerald : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={g({ padding: "24px" })}>
        {tab === "body" && (
          <>
            <NumField
              label="体重"
              value={m.weight}
              onChange={(v) => setM("weight", v)}
              unit="kg"
            />
            <NumField
              label="骨骼肌量 (SMM)"
              value={m.skeletalMuscleMass}
              onChange={(v) => setM("skeletalMuscleMass", v)}
              unit="kg"
              hint="Skeletal Muscle Mass"
              color={C.emerald}
            />
            <NumField
              label="体脂肪量"
              value={m.bodyFatMass}
              onChange={(v) => setM("bodyFatMass", v)}
              unit="kg"
              color={C.amber}
            />
            <NumField
              label="体脂率 (PBF)"
              value={m.bodyFatPercentage}
              onChange={(v) => setM("bodyFatPercentage", v)}
              unit="%"
              hint="Percent Body Fat"
              color={C.amber}
            />
            <NumField
              label="去脂体重 (LBM)"
              value={m.leanBodyMass}
              onChange={(v) => setM("leanBodyMass", v)}
              unit="kg"
              hint="自动计算: 体重-体脂"
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="蛋白质"
                value={m.protein}
                onChange={(v) => setM("protein", v)}
                unit="kg"
              />
              <NumField
                label="无机盐"
                value={m.minerals}
                onChange={(v) => setM("minerals", v)}
                unit="kg"
              />
            </div>
          </>
        )}
        {tab === "water" && (
          <>
            <NumField
              label="体水分 (TBW)"
              value={m.totalBodyWater}
              onChange={(v) => setM("totalBodyWater", v)}
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
              <NumField
                label="细胞内水分 (ICW)"
                value={m.intracellularWater}
                onChange={(v) => setM("intracellularWater", v)}
                unit="L"
                color={C.sky}
              />
              <NumField
                label="细胞外水分 (ECW)"
                value={m.extracellularWater}
                onChange={(v) => setM("extracellularWater", v)}
                unit="L"
                color={C.sky}
              />
            </div>
            {ecwRatio && (
              <div
                style={{
                  marginTop: 8,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background:
                    parseFloat(ecwRatio) >= 0.38 ? C.amberDim : C.emeraldDim,
                  border: `1px solid ${parseFloat(ecwRatio) >= 0.38 ? C.amber + "40" : C.emerald + "40"}`,
                }}
              >
                <span style={{ fontSize: 13, color: C.textSub }}>
                  ECW/TBW:{" "}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: parseFloat(ecwRatio) >= 0.38 ? C.amber : C.emerald,
                  }}
                >
                  {ecwRatio}
                </span>
                <span
                  style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}
                >
                  {parseFloat(ecwRatio) >= 0.38 ? "⚠ 偏高，水肿风险" : "✓ 正常"}
                </span>
              </div>
            )}
          </>
        )}
        {tab === "meta" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.emerald}25`,
                background: C.emeraldDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.emerald,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"🔬 InBody 实测 BMR"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                InBody 直接测量，精度高于公式估算，所有营养计算均基于此值。
              </div>
            </div>
            <NumField
              label="基础代谢率 (BMR)"
              value={m.basalMetabolicRate}
              onChange={(v) => setM("basalMetabolicRate", v)}
              unit="kcal"
              hint="Basal Metabolic Rate"
              color={C.emerald}
            />
            <NumField
              label="BMI"
              value={m.bmi}
              onChange={(v) => setM("bmi", v)}
              unit=""
            />
          </>
        )}
        {tab === "risk" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 5 }}>
                内脏脂肪等级 (VFL 1-20)
              </div>
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={m.visceralFatLevel || ""}
                placeholder="0"
                onChange={(e) =>
                  setM("visceralFatLevel", parseInt(e.target.value) || 0)
                }
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.visceralFatLevel >= 10 ? C.amber + "60" : C.border}`,
                  borderRadius: 10,
                  color: m.visceralFatLevel >= 10 ? C.amber : C.text,
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              {m.visceralFatLevel > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color:
                      m.visceralFatLevel >= 10
                        ? C.rose
                        : m.visceralFatLevel >= 5
                          ? C.amber
                          : C.emerald,
                  }}
                >
                  {m.visceralFatLevel <= 4
                    ? "✓ 正常(1-4)"
                    : m.visceralFatLevel <= 9
                      ? "⚠ 偏高(5-9)"
                      : m.visceralFatLevel <= 14
                        ? "🚨 高风险(10-14)"
                        : "🚨 极高风险(15-20)"}
                </div>
              )}
            </div>
            <NumField
              label="腰臀比 (WHR)"
              value={m.waistHipRatio}
              onChange={(v) => setM("waistHipRatio", v)}
              unit=""
              hint="男>0.9 / 女>0.85 高风险"
              color={C.amber}
            />
            <NumField
              label="InBody 评分（可选）"
              value={m.inBodyScore || 0}
              onChange={(v) => setM("inBodyScore", v)}
              unit="分"
              hint="0-100"
            />
          </>
        )}
        {tab === "seg" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.sky}25`,
                background: C.skyDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.sky,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"💡 节段骨骼肌（可选）"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                用于判断肌肉不平衡，差异 {">"} 10% 触发矫正训练建议。
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
              <NumField
                label="右臂"
                value={m.segmentalLeanMass?.rightArm || 0}
                onChange={(v) => setSeg("rightArm", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左臂"
                value={m.segmentalLeanMass?.leftArm || 0}
                onChange={(v) => setSeg("leftArm", v)}
                unit="kg"
                color={C.sky}
              />
            </div>
            <NumField
              label="躯干"
              value={m.segmentalLeanMass?.trunk || 0}
              onChange={(v) => setSeg("trunk", v)}
              unit="kg"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="右腿"
                value={m.segmentalLeanMass?.rightLeg || 0}
                onChange={(v) => setSeg("rightLeg", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左腿"
                value={m.segmentalLeanMass?.leftLeg || 0}
                onChange={(v) => setSeg("leftLeg", v)}
                unit="kg"
                color={C.sky}
              />
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
          {"<"} 返回
        </button>
        <button
          onClick={onNext}
          disabled={!m.weight || !m.basalMetabolicRate}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background:
              m.weight && m.basalMetabolicRate
                ? `linear-gradient(135deg,${C.emerald},#059669)`
                : "rgba(255,255,255,0.05)",
            color: m.weight && m.basalMetabolicRate ? "#fff" : C.textMuted,
            fontSize: 15,
            fontWeight: 700,
            cursor:
              m.weight && m.basalMetabolicRate ? "pointer" : "not-allowed",
          }}
        >
          {m.weight && m.basalMetabolicRate
            ? "填写基础信息 ->"
            : "请至少填写体重和BMR"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  STEP 3 — 基础信息 + AI配置
// ══════════════════════════════════════════════════════════════
function StepProfile({ state, onUpdate, onNext, onBack }) {
  const s = (k, v) => onUpdate(k, v);
  const needsVPN =
    TEXT_PROVIDERS.find((p) => p.id === state.provider)?.vpn ?? false;

  const Sel = ({ label, field, opts }) => (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
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
              outline: "none",
              cursor: "pointer",
              border: `1px solid ${state[field] === o.v ? `${C.emerald}50` : "transparent"}`,
              background:
                state[field] === o.v ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: state[field] === o.v ? C.emerald : C.textSub,
              fontSize: 12,
              fontWeight: 600,
              transition: "all .15s",
            }}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

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

      <div style={g({ padding: "26px" })}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
            marginBottom: 22,
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
                value={state[item.k] || ""}
                placeholder="0"
                onChange={(e) => s(item.k, +e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${state[item.k] ? `${C.emerald}40` : C.border}`,
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
            { v: "low", l: "低(久坐)" },
            { v: "medium", l: "中(轻度)" },
            { v: "high", l: "高(经常运动)" },
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
          style={{ borderTop: `1px solid ${C.border}`, margin: "6px 0 20px" }}
        />

        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          方案生成 AI
        </div>
        <div
          style={{
            display: "flex",
            gap: 7,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          {TEXT_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => s("provider", p.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                outline: "none",
                cursor: "pointer",
                border: `1px solid ${state.provider === p.id ? `${C.emerald}50` : "transparent"}`,
                background:
                  state.provider === p.id
                    ? C.emeraldDim
                    : "rgba(255,255,255,0.04)",
                color: state.provider === p.id ? C.emerald : C.textSub,
                fontSize: 12,
                fontWeight: 600,
                transition: "all .15s",
              }}
            >
              {p.label} {!p.vpn ? "✅" : ""}
            </button>
          ))}
        </div>
        {needsVPN && (
          <div
            style={g({
              border: `1px solid ${C.amber}25`,
              background: C.amberDim,
              padding: "10px 14px",
              marginBottom: 12,
            })}
          >
            <span style={{ fontSize: 12, color: C.amber }}>
              {"⚠ "}
              {state.provider} 在中国大陆需要 VPN
            </span>
          </div>
        )}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>
            API Key
          </div>
          <input
            type="password"
            placeholder={`${state.provider} API Key`}
            value={state.apiKey}
            onChange={(e) => s("apiKey", e.target.value)}
            style={{
              width: "100%",
              padding: "11px 14px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${state.apiKey ? `${C.emerald}50` : C.border}`,
              borderRadius: 10,
              color: C.text,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
              transition: "border .2s",
            }}
          />
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
            Key 仅存于本地浏览器，不上传服务器
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 5 }}>
            自定义模型（可选，留空用默认）
          </div>
          <input
            type="text"
            placeholder={
              {
                qwen: "qwen-max",
                deepseek: "deepseek-chat",
                openai: "gpt-4o",
                claude: "claude-sonnet-4-6",
                gemini: "gemini-2.0-flash",
                ollama: "qwen2.5:14b",
              }[state.provider] || "model name"
            }
            value={state.modelName}
            onChange={(e) => s("modelName", e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "rgba(255,255,255,0.04)",
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              color: C.text,
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
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
          {"<"} 返回
        </button>
        <button
          onClick={onNext}
          disabled={!state.apiKey && state.provider !== "ollama"}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background:
              state.apiKey || state.provider === "ollama"
                ? `linear-gradient(135deg,${C.emerald},#059669)`
                : "rgba(255,255,255,0.05)",
            color:
              state.apiKey || state.provider === "ollama"
                ? "#fff"
                : C.textMuted,
            fontSize: 15,
            fontWeight: 700,
            cursor:
              state.apiKey || state.provider === "ollama"
                ? "pointer"
                : "not-allowed",
          }}
        >
          {state.apiKey || state.provider === "ollama"
            ? "生成专业方案 ✦"
            : "请填写 API Key"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ state, onReset }) {
  const m = state.measurements;
  const [moduleStates, setModuleStates] = useState({
    bodyComposition: "idle",
    workout: "idle",
    nutrition: "idle",
    hydration: "idle",
    visceral: "idle",
  });
  const [moduleData, setModuleData] = useState({});
  const [moduleErrors, setModuleErrors] = useState({});
  const [genAll, setGenAll] = useState(false);

  const aiCfg = {
    provider: state.provider,
    apiKey: state.apiKey,
    modelName: state.modelName,
  };

  const MODULES = [
    {
      key: "bodyComposition",
      title: "体成分概览",
      icon: "📊",
      color: C.emerald,
      dim: C.emeraldDim,
      prompt: () => promptBodyComp(m, state),
      render: (d) => <BodyCompResult data={d} />,
    },
    {
      key: "workout",
      title: "精准训练计划",
      icon: "💪",
      color: C.sky,
      dim: C.skyDim,
      prompt: () => promptWorkout(m, state),
      render: (d) => <WorkoutResult data={d} />,
    },
    {
      key: "nutrition",
      title: "精准营养方案",
      icon: "🥗",
      color: C.emerald,
      dim: C.emeraldDim,
      prompt: () => promptNutrition(m, state),
      render: (d) => <NutritionResult data={d} />,
    },
    {
      key: "hydration",
      title: "水分管理",
      icon: "💧",
      color: C.sky,
      dim: C.skyDim,
      prompt: () => promptHydration(m, state),
      render: (d) => <HydrationResult data={d} />,
    },
    {
      key: "visceral",
      title: "内脏健康与代谢",
      icon: "🫀",
      color: m.visceralFatLevel >= 10 ? C.rose : C.amber,
      dim: m.visceralFatLevel >= 10 ? C.roseDim : C.amberDim,
      prompt: () => promptVisceral(m, state),
      render: (d) => <VisceralResult data={d} />,
    },
  ];

  const generate = useCallback(
    async (key) => {
      const mod = MODULES.find((x) => x.key === key);
      if (!mod) return;
      setModuleStates((s) => ({ ...s, [key]: "loading" }));
      setModuleErrors((e) => ({ ...e, [key]: null }));
      try {
        const raw = await callTextAI(
          mod.prompt(),
          aiCfg.provider,
          aiCfg.apiKey,
          aiCfg.modelName,
        );
        const data = parseJSON(raw);
        setModuleData((d) => ({ ...d, [key]: data }));
        setModuleStates((s) => ({ ...s, [key]: "success" }));
      } catch (err) {
        setModuleErrors((e) => ({ ...e, [key]: err.message }));
        setModuleStates((s) => ({ ...s, [key]: "error" }));
      }
    },
    [m, state],
  );

  const generateAll = async () => {
    setGenAll(true);
    for (const mod of MODULES) await generate(mod.key);
    setGenAll(false);
  };

  if (!m) return null;

  const tdee = Math.round(
    m.basalMetabolicRate *
      (state.activityLevel === "high"
        ? 1.55
        : state.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const ecwRatio =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "N/A";
  const vColor =
    m.visceralFatLevel >= 10
      ? C.rose
      : m.visceralFatLevel >= 5
        ? C.amber
        : C.emerald;

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slide{0%{width:0%;margin-left:0}50%{width:55%;margin-left:20%}100%{width:0%;margin-left:100%}}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

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
            {state.age}岁 · {state.gender === "male" ? "男" : "女"} ·{" "}
            {GOAL_CN[state.goal] || state.goal}
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
            {genAll ? "生成中..." : "✦ 全部生成"}
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

      {/* 核心数据 */}
      <div style={g({ padding: "26px", marginBottom: 20 })}>
        <div
          style={{
            fontSize: 11,
            color: C.textMuted,
            letterSpacing: "0.1em",
            marginBottom: 18,
            textTransform: "uppercase",
          }}
        >
          InBody 核心数据
        </div>
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
              style={g({
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
            {m.inBodyScore > 0 && (
              <div
                style={g({
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
                    size={82}
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
              style={g({
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
                  size={82}
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
            <div style={g({ padding: "12px", border: `1px solid ${C.sky}18` })}>
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
                {parseFloat(ecwRatio) >= 0.38 ? "⚠ 水肿" : "✓ 正常"}
              </div>
            </div>
            <div
              style={g({ padding: "12px", border: `1px solid ${C.emerald}18` })}
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
                kcal/天
              </div>
            </div>
          </div>
        </div>

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
                  style={g({
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

      {/* 6个模块 */}
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
            status={moduleStates[mod.key]}
            error={moduleErrors[mod.key]}
            onGenerate={() => generate(mod.key)}
          >
            {mod.render(moduleData[mod.key])}
          </ModuleCard>
        ))}
        <div
          style={g({ border: `1px solid ${C.violetDim}`, overflow: "hidden" })}
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
            <div style={{ fontSize: 32, opacity: 0.22, marginBottom: 12 }}>
              📊
            </div>
            <div style={{ color: C.textSub, fontSize: 14, marginBottom: 8 }}>
              上传第二份 InBody 截图后可用
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              自动对比体成分变化趋势
            </div>
          </div>
        </div>
      </div>

      <div
        style={g({
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
            BMR <span style={{ color: C.sky }}>{m.basalMetabolicRate}</span>
          </span>
          <span>·</span>
          <span>
            SMM <span style={{ color: C.emerald }}>{m.skeletalMuscleMass}</span>
          </span>
          <span>·</span>
          <span>
            VFL <span style={{ color: vColor }}>{m.visceralFatLevel}</span>
          </span>
          <span>·</span>
          <span>
            AI <span style={{ color: C.violet }}>{state.provider}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  APP ROOT — 统一 state 管理，彻底解决跨步骤数据丢失
// ══════════════════════════════════════════════════════════════
const INIT = {
  // step
  step: "welcome",
  // image
  imageFile: null,
  imageBase64: null,
  preview: null,
  parseSuccess: false,
  parsedFields: 0,
  // vision AI
  visionProvider: "qwen",
  visionApiKey: "",
  visionModel: "",
  // measurements (pre-filled with zeros)
  measurements: {
    weight: 0,
    skeletalMuscleMass: 0,
    bodyFatMass: 0,
    bodyFatPercentage: 0,
    totalBodyWater: 0,
    intracellularWater: 0,
    extracellularWater: 0,
    protein: 0,
    minerals: 0,
    leanBodyMass: 0,
    basalMetabolicRate: 0,
    bmi: 0,
    visceralFatLevel: 0,
    waistHipRatio: 0,
    inBodyScore: 0,
    segmentalLeanMass: {
      rightArm: 0,
      leftArm: 0,
      trunk: 0,
      rightLeg: 0,
      leftLeg: 0,
    },
  },
  // profile
  age: 0,
  gender: "male",
  heightCm: 0,
  goal: "muscle_gain",
  fitnessLevel: "intermediate",
  activityLevel: "medium",
  availableMinutesPerDay: 45,
  equipmentList: "gym",
  weeklyBudget: 300,
  dietStyle: "balanced",
  sleepTime: "23:00",
  wakeTime: "07:00",
  // text AI
  provider: "qwen",
  apiKey: "",
  modelName: "",
};

export default function InBodyOS() {
  const [state, setState] = useState(INIT);
  const update = (key, val) => setState((s) => ({ ...s, [key]: val }));
  const go = (step) => setState((s) => ({ ...s, step }));

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 50% at 50% -5%, rgba(16,185,129,.07) 0%, transparent 55%),
                   radial-gradient(ellipse 50% 40% at 85% 85%, rgba(14,165,233,.05) 0%, transparent 50%), ${C.bg}`,
        color: C.text,
        fontFamily: "'DM Sans','PingFang SC','Helvetica Neue',sans-serif",
        padding: "0 20px 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:rgba(100,116,139,.4)}
        button{font-family:inherit}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}
      `}</style>

      {/* Nav */}
      <nav
        style={{
          maxWidth: 920,
          margin: "0 auto",
          padding: "20px 0 28px",
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
          <span
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
          </span>
        </div>
        {["import", "measurements", "profile"].includes(state.step) && (
          <div style={{ display: "flex", gap: 5 }}>
            {["import", "measurements", "profile"].map((s, i) => (
              <div
                key={s}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background:
                    ["import", "measurements", "profile"].indexOf(state.step) >=
                    i
                      ? C.emerald
                      : "rgba(255,255,255,.09)",
                  transition: "background .3s",
                }}
              />
            ))}
          </div>
        )}
        <a
          href="/"
          style={{
            fontSize: 12,
            color: C.textMuted,
            textDecoration: "none",
            padding: "6px 14px",
            borderRadius: 20,
            border: `1px solid ${C.border}`,
          }}
        >
          Health OS
        </a>
      </nav>

      <div style={{ maxWidth: 920, margin: "0 auto", paddingTop: 40 }}>
        {state.step === "welcome" && (
          <div
            style={{
              maxWidth: 560,
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
              拍照上传 InBody 报告，AI 自动识别全部数值， 生成专业级训练 · 营养
              · 水分 · 代谢方案。
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
                { icon: "📱", title: "截图即可", sub: "手机拍照直接上传" },
                {
                  icon: "📊",
                  title: "实测BMR驱动",
                  sub: "非公式估算，精准到位",
                },
                { icon: "🌍", title: "国内直连", sub: "Qwen-VL 无需 VPN" },
              ].map((f, i) => (
                <div
                  key={i}
                  style={g({ padding: "18px 16px", textAlign: "center" })}
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
              onClick={() => go("import")}
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
              }}
            >
              开始分析
            </button>
          </div>
        )}
        {state.step === "import" && (
          <StepImport
            state={state}
            onUpdate={update}
            onNext={() => go("measurements")}
          />
        )}
        {state.step === "measurements" && (
          <StepMeasurements
            state={state}
            onUpdate={update}
            onNext={() => go("profile")}
            onBack={() => go("import")}
          />
        )}
        {state.step === "profile" && (
          <StepProfile
            state={state}
            onUpdate={update}
            onNext={() => go("dashboard")}
            onBack={() => go("measurements")}
          />
        )}
        {state.step === "dashboard" && (
          <Dashboard state={state} onReset={() => setState(INIT)} />
        )}
      </div>
    </div>
  );
}
