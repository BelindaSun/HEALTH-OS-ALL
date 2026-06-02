"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const STORAGE_KEY = "inbody_os_state";

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
        model: modelName || "qwen2.5:3b",
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
STRICT REQUIREMENTS: weeklyPlan MUST contain EXACTLY 7 entries (Monday to Sunday). macroSplit values are PERCENTAGES (integer, must sum to 100, e.g. protein:30,carbs:45,fat:25). All meals in Chinese food.
Return JSON:
{"bmrSource":"inbody_measured","basalMetabolicRate":${m.basalMetabolicRate},"tdee":${tdee},"dailyCalorieTarget":0,"macroSplit":{"protein":30,"carbs":45,"fat":25},"proteinTargetGrams":${proteinG},"weeklyPlan":[{"day":"周一","breakfast":{"name":"","foods":[""],"calories":0,"protein":0},"lunch":{"name":"","foods":[""],"calories":0,"protein":0},"dinner":{"name":"","foods":[""],"calories":0,"protein":0},"snack":{"name":"","foods":[""],"calories":0,"protein":0},"totalCalories":0}],"keyPrinciples":[""],"inBodyDataRationale":"","personalizedNote":""}`;
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
          value={value || ""}
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
        {(() => {
          // macroSplit should be percentages (sum to 100)
          // Defensive: if values look like grams (any > 100), recalculate from calories
          const p = macro.protein || 0;
          const c = macro.carbs || 0;
          const f = macro.fat || 0;
          const total = p + c + f;
          const isGrams = total > 110; // percentages should sum to ~100
          const pPct = isGrams ? Math.round((p * 4 / (p * 4 + c * 4 + f * 9)) * 100) : p;
          const cPct = isGrams ? Math.round((c * 4 / (p * 4 + c * 4 + f * 9)) * 100) : c;
          const fPct = isGrams ? Math.round((f * 9 / (p * 4 + c * 4 + f * 9)) * 100) : f;
          return [
            { label: `蛋白质 ${pPct}%`, val: pPct, color: C.sky },
            { label: `碳水 ${cPct}%`, val: cPct, color: C.emerald },
            { label: `脂肪 ${fPct}%`, val: fPct, color: C.amber },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>
                {m.label}
              </div>
              <Bar value={m.val} max={100} color={m.color} h={6} />
            </div>
          ));
        })()}
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

      {/* Data preview - shown when weight and BMR are filled */}
      {m.weight > 0 && m.basalMetabolicRate > 0 && (
        <div style={g({ padding: "20px 22px", marginTop: 20, border: `1px solid ${C.emerald}20` })}>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>
            数据预览
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
            {[
              { label: "体重", val: m.weight, unit: "kg", color: C.text, icon: "⚖️" },
              { label: "骨骼肌", val: m.skeletalMuscleMass, unit: "kg", color: C.emerald, icon: "💪" },
              { label: "体脂率", val: m.bodyFatPercentage, unit: "%", color: C.amber, icon: "🔥" },
              { label: "实测BMR", val: m.basalMetabolicRate, unit: "kcal", color: C.sky, icon: "⚡" },
            ].map((item, i) => (
              <div key={i} style={g({ padding: "12px 14px", border: `1px solid ${item.color}18`, textAlign: "center" })}>
                <div style={{ fontSize: 15, marginBottom: 5 }}>{item.icon}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.color, lineHeight: 1 }}>
                  {item.val}<span style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}>{item.unit}</span>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10 }}>体成分构成</div>
              {[
                { label: "骨骼肌量", val: m.skeletalMuscleMass, max: m.weight * 0.55, color: C.emerald },
                { label: "体脂肪量", val: m.bodyFatMass, max: m.weight * 0.45, color: C.amber },
                { label: "蛋白质", val: m.protein, max: 14, color: C.sky },
                { label: "无机盐", val: m.minerals, max: 5, color: C.violet },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: C.textSub }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{item.val} kg</span>
                  </div>
                  <Bar value={item.val} max={item.max} color={item.color} h={4} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, alignContent: "start" }}>
              {m.inBodyScore > 0 && (
                <div style={g({ padding: "12px", textAlign: "center", border: `1px solid ${C.emerald}18` })}>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <GaugeArc value={m.inBodyScore} max={100} color={C.emerald} size={72} />
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: C.emerald }}>{m.inBodyScore}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: -2 }}>InBody 评分</div>
                </div>
              )}
              {m.visceralFatLevel > 0 && (
                <div style={g({ padding: "12px", textAlign: "center", border: `1px solid ${m.visceralFatLevel >= 10 ? C.rose : C.amber}18` })}>
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <GaugeArc value={m.visceralFatLevel} max={20} color={m.visceralFatLevel >= 10 ? C.rose : C.amber} size={72} />
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: m.visceralFatLevel >= 10 ? C.rose : C.amber }}>{m.visceralFatLevel}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: -2 }}>内脏脂肪</div>
                </div>
              )}
              {m.segmentalLeanMass && m.segmentalLeanMass.trunk > 0 && (
                <div style={g({ padding: "12px", border: `1px solid ${C.sky}18`, gridColumn: "1 / -1" })}>
                  <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 8 }}>节段骨骼肌</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
                    {[["右臂","rightArm"],["左臂","leftArm"],["躯干","trunk"],["右腿","rightLeg"],["左腿","leftLeg"]].map(([l,k]) => (
                      <div key={k} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.sky }}>{m.segmentalLeanMass[k]}</div>
                        <div style={{ fontSize: 9, color: C.textMuted }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                ollama: "qwen2.5:3b",
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
//  BODY STATE ENGINE - local scoring
// ══════════════════════════════════════════════════════════════
function calcBodyState(m, p, checkin) {
  if (!m || !m.weight) return null;

  // ── BASELINE LAYER (40%) - slow variables from InBody ──
  const smmIdeal = p.gender === "female" ? m.weight * 0.38 : m.weight * 0.45;
  const smmRatio = m.skeletalMuscleMass / smmIdeal;
  const smmScore = Math.min(100, Math.round(smmRatio * 80 + (smmRatio >= 1 ? 20 : 0)));
  const bfIdeal = p.gender === "female" ? 22 : 15;
  const bfDiff = Math.abs(m.bodyFatPercentage - bfIdeal);
  const bfScore = Math.max(0, Math.round(100 - bfDiff * 4));
  let hydScore = 80;
  if (m.intracellularWater > 0) {
    const ecwRatio = m.extracellularWater / (m.intracellularWater + m.extracellularWater);
    if (ecwRatio < 0.36) hydScore = Math.round(60 + (ecwRatio / 0.36) * 20);
    else if (ecwRatio <= 0.38) hydScore = 100;
    else hydScore = Math.max(30, Math.round(100 - (ecwRatio - 0.38) * 500));
  }
  const vflScore = m.visceralFatLevel <= 4 ? 100
    : m.visceralFatLevel <= 9 ? Math.round(100 - (m.visceralFatLevel - 4) * 8)
    : Math.max(0, Math.round(60 - (m.visceralFatLevel - 9) * 6));
  const bmrEst = p.gender === "female"
    ? 10 * m.weight + 6.25 * p.heightCm - 5 * p.age - 161
    : 10 * m.weight + 6.25 * p.heightCm - 5 * p.age + 5;
  const bmrRatio = bmrEst > 0 ? m.basalMetabolicRate / bmrEst : 1;
  const metScore = Math.min(100, Math.round(bmrRatio * 85 + (bmrRatio >= 1 ? 15 : 0)));
  const baselineScore = Math.round(smmScore * 0.35 + bfScore * 0.30 + hydScore * 0.15 + vflScore * 0.12 + metScore * 0.08);

  // ── RECOVERY LAYER (30%) - sleep / fatigue / soreness ──
  const hasCheckin = checkin?.morningDone;
  const mc = checkin?.morning || {};
  let recoveryScore = 75; // default when no checkin
  if (hasCheckin) {
    const sleepMap = [30, 55, 75, 95, 85]; // <5h, 5-6h, 6-7h, 7-8h, >8h
    const sleepS = mc.sleepDuration !== undefined ? sleepMap[mc.sleepDuration] : 75;
    const qualityS = mc.sleepQuality ? mc.sleepQuality * 20 : 75;
    const fatigueS = mc.fatigue ? Math.round((11 - mc.fatigue) * 10) : 75;
    const sorenessS = mc.soreness ? Math.round((11 - mc.soreness) * 10) : 80;
    recoveryScore = Math.round(sleepS * 0.35 + qualityS * 0.30 + fatigueS * 0.20 + sorenessS * 0.15);
  }

  // ── BEHAVIOR LAYER (20%) - nutrition / water / training ──
  const ec = checkin?.evening || {};
  let behaviorScore = 75;
  if (checkin?.eveningDone) {
    const proteinS = ec.proteinPct !== undefined ? ec.proteinPct : 70;
    const waterTarget = 2000;
    const waterS = ec.waterMl ? Math.min(100, Math.round((ec.waterMl / waterTarget) * 100)) : 70;
    const trainingS = ec.training === "done" ? 100 : ec.training === "rest" ? 85 : 50;
    behaviorScore = Math.round(proteinS * 0.40 + waterS * 0.30 + trainingS * 0.30);
  }

  // ── STRESS LAYER (10%) - stress / mood ──
  let stressScore = 75;
  if (hasCheckin && mc.stress) {
    const stressS = Math.round((11 - mc.stress) * 10);
    const moodS = ec.mood ? ec.mood * 20 : 70;
    stressScore = Math.round(stressS * 0.65 + moodS * 0.35);
  }

  // ── FINAL WEIGHTED SCORE ──
  const hasAnyCheckin = hasCheckin || checkin?.eveningDone;
  const total = hasAnyCheckin
    ? Math.round(baselineScore * 0.40 + recoveryScore * 0.30 + behaviorScore * 0.20 + stressScore * 0.10)
    : Math.round(baselineScore * 0.85 + 75 * 0.15); // baseline-only when no checkin

  // ── STATE LABEL - now considers fast variables too ──
  const ecwR = m.intracellularWater > 0
    ? m.extracellularWater / (m.intracellularWater + m.extracellularWater) : 0.37;
  const isEdema = ecwR > 0.38;
  const highFat = m.bodyFatPercentage > (p.gender === "female" ? 30 : 25);
  const goodMuscle = smmRatio >= 0.95;
  const highVFL = m.visceralFatLevel >= 10;
  const tiredToday = hasCheckin && ((mc.fatigue || 0) >= 7 || (mc.soreness || 0) >= 7);
  const badSleep = hasCheckin && mc.sleepDuration !== undefined && mc.sleepDuration <= 1;
  const highStress = hasCheckin && (mc.stress || 0) >= 8;

  let stateKey, stateIcon, stateColor, stateDesc, todayFocus, topAlert;
  // Sleep debt accumulation: 2+ consecutive bad sleeps (check yesterday too)
  const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate()-1); return `checkin_${d.toISOString().slice(0,10)}`; })();
  const yesterdayCheckin = (() => { try { const s = localStorage.getItem(yesterdayKey); return s ? JSON.parse(s) : null; } catch { return null; } })();
  const yesterdayBadSleep = yesterdayCheckin?.morningDone && yesterdayCheckin?.morning?.sleepDuration !== undefined && yesterdayCheckin.morning.sleepDuration <= 1;
  const sleepDebt = badSleep && yesterdayBadSleep;

  if (highVFL || (highFat && isEdema)) {
    stateKey = "need_attention"; stateIcon = "🔴"; stateColor = C.rose;
    stateDesc = "代谢风险期";
    todayFocus = `内脏脂肪 ${m.visceralFatLevel} 级，控制精制碳水，避免高强度训练`;
    topAlert = "VFL 偏高会增加胰岛素抵抗和心血管风险";
  } else if (sleepDebt) {
    stateKey = "sleep_debt"; stateIcon = "🟠"; stateColor = "#fb923c";
    stateDesc = "睡眠债累积";
    todayFocus = "连续睡眠不足，今日以低强度拉伸为主，今晚提前入睡";
    topAlert = "睡眠债会压制睾酮和生长激素，影响合成代谢";
  } else if (badSleep) {
    stateKey = "recovery_first"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = "轻度恢复不足";
    todayFocus = `睡眠不足，避免高强度${(mc.soreness||0) >= 6 ? "下肢" : ""}训练，可做轻量有氧`;
    topAlert = "睡眠不足时蛋白质合成效率下降约 20%";
  } else if (tiredToday) {
    stateKey = "recovery_first"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = `${(mc.soreness||0) >= 7 ? "肌肉恢复期" : "疲劳管理期"}`;
    todayFocus = (mc.soreness||0) >= 7 ? "酸痛较高，建议泡沫轴放松或游泳，避免原肌群" : "疲劳值偏高，适合轻度有氧或休息";
    topAlert = "过度训练会抑制肌肉生长，恢复即是进步";
  } else if (highStress) {
    stateKey = "stress_mode"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = "高压力模式";
    todayFocus = "皮质醇偏高，选择瑜伽/慢跑，避免大重量训练";
    topAlert = "高压力状态下强行训练会加速肌肉分解";
  } else if (isEdema || (highFat && !goodMuscle)) {
    stateKey = "fat_loss"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = isEdema ? "水分滞留期" : "减脂塑形期";
    todayFocus = isEdema ? "减少钠摄入，保证 2L+ 饮水，有氧促循环" : "中等强度有氧 + 力量，控制餐后碳水时间";
    topAlert = isEdema ? `ECW 比偏高，注意电解质平衡` : `体脂 ${m.bodyFatPercentage}%，增肌减脂并行效率最高`;
  } else if (goodMuscle && !highFat && recoveryScore >= 75) {
    stateKey = "muscle_window"; stateIcon = "🟢"; stateColor = C.emerald;
    stateDesc = "增肌窗口";
    todayFocus = "恢复充分，适合大重量复合动作，训练后 30min 补充蛋白质";
    topAlert = "当前是突破训练记录的最佳时机";
  } else if (goodMuscle && recoveryScore >= 60) {
    stateKey = "maintain_build"; stateIcon = "🔵"; stateColor = C.sky;
    stateDesc = "稳定进阶期";
    todayFocus = "中等强度训练，注意蛋白质摄入，保持睡眠规律";
    topAlert = "身体底子好，坚持一致性是核心";
  } else {
    stateKey = "maintain"; stateIcon = "🔵"; stateColor = C.sky;
    stateDesc = "均衡维持期";
    todayFocus = "均衡训练 + 维持热量平衡，重点提升肌肉量";
    topAlert = "持续的一致性比任何单次训练都更重要";
  }

  const hasCheckinData = hasAnyCheckin;
  return {
    total, smmScore, bfScore, hydScore, vflScore, metScore,
    recoveryScore, behaviorScore, stressScore, baselineScore,
    stateKey, stateIcon, stateColor, stateDesc, todayFocus, topAlert,
    hasCheckinData,
  };
}

function promptBodyState(m, p, localScore, checkin) {
  const { block } = buildDataBlock(m, p);
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const sleepLabels = ["<5小时","5-6小时","6-7小时","7-8小时",">8小时"];
  const checkinBlock = checkin?.morningDone || checkin?.eveningDone ? `
Today's Check-in Data (FAST VARIABLES - prioritize these for today's recommendations):
Morning: sleep=${mc.sleepDuration !== undefined ? sleepLabels[mc.sleepDuration] : "unknown"}, sleepQuality=${mc.sleepQuality || "unknown"}/5, fatigue=${mc.fatigue || "unknown"}/10, stress=${mc.stress || "unknown"}/10, soreness=${mc.soreness || "unknown"}/10${mc.weight ? `, weight=${mc.weight}kg` : ""}
Evening: protein=${ec.proteinPct || "unknown"}% of target, water=${ec.waterMl || "unknown"}ml, training=${ec.training || "unknown"}, mood=${ec.mood || "unknown"}/5
Pre-calculated layer scores: baseline=${localScore.baselineScore}, recovery=${localScore.recoveryScore}, behavior=${localScore.behaviorScore}, stress=${localScore.stressScore}` : `
No check-in data available today. Base analysis on InBody data only.`;

  return `You are an elite sports medicine doctor. Analyze this person's body state. Return ONLY JSON.
${block}${checkinBlock}
IMPORTANT: If check-in data is available, let fast variables (sleep, fatigue, stress) heavily influence your stateLabel and todayFocus. A person with great InBody scores but poor sleep should be labeled "恢复优先" not "增肌窗口".
Return JSON:
{"bodyScore":85,"stateLabel":"增肌窗口|减脂窗口|恢复优先|维持期|需要关注","stateEmoji":"🟢","stateColor":"emerald|amber|rose|sky","oneLiner":"一句话描述当前身体状态（20字以内）","todayFocus":"今天最应该做什么，包含✅❌具体行动（40字以内）","topAlert":"最需要关注的风险点（30字以内）","dimensionScores":{"muscle":85,"bodyFat":72,"hydration":90,"visceral":88,"metabolic":80},"aiInsight":"基于InBody+今日状态的深度洞察，150字","actionPlan":["立即行动（具体，基于今日数据）","本周重点（具体）","长期方向（具体）"],"recoveryTips":"基于今日恢复状态的具体建议"}`;
}

// ── CHECK-IN COMPONENTS ──────────────────────────────────────
function SliderField({ label, value, min = 1, max = 10, color, onChange }) {
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

function MoodPicker({ value, onChange }) {
  const moods = ["😫","😕","😐","🙂","😄"];
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 18 }}>
      {moods.map((m, i) => (
        <button key={i} onClick={() => onChange(i + 1)}
          style={{ fontSize: 26, padding: "8px 10px", borderRadius: 12, border: `2px solid ${value === i + 1 ? C.emerald : "transparent"}`, background: value === i + 1 ? C.emeraldDim : "transparent", cursor: "pointer", transition: "all .15s" }}>
          {m}
        </button>
      ))}
    </div>
  );
}

function MorningCheckin({ checkin, onChange, onDone }) {
  const c = checkin.morning || {};
  const set = (k, v) => onChange({ ...checkin, morning: { ...c, [k]: v }, morningDone: true });
  const sleepOpts = ["<5小时","5-6小时","6-7小时","7-8小时",">8小时"];
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>昨晚睡眠时长</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sleepOpts.map((opt, i) => (
            <button key={i} onClick={() => set("sleepDuration", i)}
              style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${c.sleepDuration === i ? C.sky + "80" : C.border}`, background: c.sleepDuration === i ? C.skyDim : "transparent", color: c.sleepDuration === i ? C.sky : C.textSub, fontSize: 12, cursor: "pointer" }}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>睡眠质量</div>
        <MoodPicker value={c.sleepQuality} onChange={v => set("sleepQuality", v)} />
      </div>
      <SliderField label="疲劳感" value={c.fatigue ?? 5} min={1} max={10} color={c.fatigue >= 7 ? C.rose : C.amber} onChange={v => set("fatigue", v)} />
      <SliderField label="压力水平" value={c.stress ?? 5} min={1} max={10} color={c.stress >= 7 ? C.rose : C.violet} onChange={v => set("stress", v)} />
      <SliderField label="肌肉酸痛" value={c.soreness ?? 3} min={1} max={10} color={c.soreness >= 7 ? C.rose : C.sky} onChange={v => set("soreness", v)} />
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

function EveningCheckin({ checkin, onChange, onDone }) {
  const c = checkin.evening || {};
  const set = (k, v) => onChange({ ...checkin, evening: { ...c, [k]: v }, eveningDone: true });
  return (
    <div>
      <SliderField label="蛋白质完成度" value={c.proteinPct ?? 50} min={0} max={100} color={c.proteinPct >= 80 ? C.emerald : C.amber} onChange={v => set("proteinPct", v)} />
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
          {[["✅ 完成","done",C.emerald],["⏭ 跳过","skip",C.amber],["🛌 休息日","rest",C.sky]].map(([label, val, color]) => (
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

// ── COMPLIANCE SCORE ─────────────────────────────────────────
function calcComplianceScore(checkin) {
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const morningDone = checkin?.morningDone;
  const eveningDone = checkin?.eveningDone;

  // Protein: from Nutrition page writeback OR evening check-in
  // ec.proteinPct is written by Nutrition even without eveningDone
  const proteinScore = ec.proteinPct !== undefined
    ? Math.min(100, ec.proteinPct)
    : null;

  // Water: 25% - only from evening check-in
  const waterTarget = 2000;
  const waterScore = eveningDone && ec.waterMl !== undefined
    ? Math.min(100, Math.round((ec.waterMl / waterTarget) * 100))
    : null;

  // Training: 25% - only from evening check-in
  const trainingScore = eveningDone && ec.training
    ? ec.training === "done" ? 100 : ec.training === "rest" ? 85 : 30
    : null;

  // Sleep: 20% - from morning check-in
  const sleepScoreMap = [30, 55, 75, 100, 90];
  const sleepScore = morningDone && mc.sleepDuration !== undefined
    ? sleepScoreMap[mc.sleepDuration]
    : null;

  // Show card if we have at least one data point
  const hasData = proteinScore !== null || waterScore !== null || trainingScore !== null || sleepScore !== null;
  if (!hasData) return null;

  const dims = [
    { key: "protein", label: "蛋白质", weight: 0.30, score: proteinScore, color: "#10b981", icon: "P", unit: `${ec.proteinPct ?? "-"}%` },
    { key: "water",   label: "饮水",   weight: 0.25, score: waterScore,   color: "#0ea5e9", icon: "W", unit: `${ec.waterMl ?? "-"}ml` },
    { key: "training",label: "训练",   weight: 0.25, score: trainingScore, color: "#8b5cf6", icon: "T",
      unit: ec.training === "done" ? "完成" : ec.training === "rest" ? "休息日" : "跳过" },
    { key: "sleep",   label: "睡眠",   weight: 0.20, score: sleepScore,   color: "#f59e0b", icon: "Z",
      unit: sleepScore !== null ? ["<5h","5-6h","6-7h","7-8h",">8h"][mc.sleepDuration] : "-" },
  ];

  // Weighted total - use 75 as fallback for missing dims
  const total = Math.round(
    dims.reduce((sum, d) => sum + (d.score !== null ? d.score : 75) * d.weight, 0)
  );

  const level = total >= 85 ? { label: "优秀执行", color: "#10b981", bg: "rgba(16,185,129,0.12)" }
    : total >= 70 ? { label: "良好执行", color: "#0ea5e9", bg: "rgba(14,165,233,0.12)" }
    : total >= 55 ? { label: "一般执行", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" }
    : { label: "需要改善", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" };

  return { total, dims, level };
}

function ComplianceCard({ checkin }) {
  const result = calcComplianceScore(checkin);
  if (!result) return null;
  const { total, dims, level } = result;

  // Yesterday's compliance for trend arrow
  const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate()-1); return `checkin_${d.toISOString().slice(0,10)}`; })();
  const yesterdayTotal = (() => {
    try {
      const raw = localStorage.getItem(yesterdayKey);
      if (!raw) return null;
      const yc = JSON.parse(raw);
      const yr = calcComplianceScore(yc);
      return yr ? yr.total : null;
    } catch { return null; }
  })();
  const trend = yesterdayTotal !== null ? total - yesterdayTotal : null;
  const trendUp = trend !== null && trend > 0;
  const trendFlat = trend !== null && trend === 0;

  // Mini ring SVG
  const Ring = ({ value, color, size = 48 }) => {
    const r = (size - 8) / 2;
    const circ = 2 * Math.PI * r;
    const filled = (value / 100) * circ;
    return (
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
    );
  };

  return (
    <div style={{ ...g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.border}` }) }}>
      {/* Header with trend */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Today Compliance</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>今日执行分</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, justifyContent: "flex-end" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: level.color, lineHeight: 1 }}>{total}</div>
            {trend !== null && !trendFlat && (
              <div style={{ fontSize: 14, fontWeight: 800, color: trendUp ? C.emerald : C.rose }}>
                {trendUp ? "↑" : "↓"}{Math.abs(trend)}
              </div>
            )}
            {trendFlat && <div style={{ fontSize: 13, color: C.textMuted }}>—</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <div style={{ fontSize: 11, color: level.color, padding: "2px 8px", background: level.bg, borderRadius: 20, display: "inline-block" }}>{level.label}</div>
            {yesterdayTotal !== null && (
              <div style={{ fontSize: 10, color: C.textMuted }}>昨天 {yesterdayTotal}</div>
            )}
          </div>
        </div>
      </div>

      {/* Main score bar */}
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${total}%`, background: `linear-gradient(90deg, ${level.color}80, ${level.color})`, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>

      {/* 4 Ring dims */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {dims.map(d => {
          const s = d.score !== null ? d.score : 0;
          return (
            <div key={d.key} style={{ background: "rgba(255,255,255,0.025)", borderRadius: 14, padding: "12px 8px", border: `1px solid rgba(255,255,255,0.05)`, textAlign: "center" }}>
              <div style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <Ring value={d.score !== null ? s : 0} color={d.score !== null ? d.color : "rgba(255,255,255,0.1)"} size={48} />
                <div style={{ position: "absolute", fontSize: 11, fontWeight: 800, color: d.score !== null ? d.color : C.textMuted }}>
                  {d.score !== null ? s : "-"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, marginBottom: 2 }}>{d.label}</div>
              <div style={{ fontSize: 10, color: C.textMuted }}>{d.score !== null ? d.unit : "未记录"}</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: C.textMuted, textAlign: "center" }}>
        蛋白质 30% + 饮水 25% + 训练 25% + 睡眠 20%
      </div>
    </div>
  );
}

function CheckInCard({ checkin, onOpen }) {
  const morningDone = checkin?.morningDone;
  const eveningDone = checkin?.eveningDone;
  const m = checkin?.morning || {};
  const e = checkin?.evening || {};
  const sleepLabels = ["<5小时","5-6小时","6-7小时","7-8小时",">8小时"];

  return (
    <div style={g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.border}` })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Today Check-in</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>今日状态记录</div>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          {morningDone && eveningDone ? "✓ 今日已完成" : morningDone ? "晨间 ✓  晚间 ○" : "晨间 ○  晚间 ○"}
        </div>
      </div>

      {/* Summary if done */}
      {morningDone && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {m.sleepDuration !== undefined && <Tag color={C.sky}>睡眠 {sleepLabels[m.sleepDuration]}</Tag>}
          {m.fatigue && <Tag color={m.fatigue >= 7 ? C.rose : C.amber}>疲劳 {m.fatigue}/10</Tag>}
          {m.stress && <Tag color={m.stress >= 7 ? C.rose : C.violet}>压力 {m.stress}/10</Tag>}
          {m.soreness && <Tag color={m.soreness >= 7 ? C.rose : C.sky}>酸痛 {m.soreness}/10</Tag>}
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

// ── TODAY'S FOCUS ─────────────────────────────────────────────
function calcTodayFocus(m, p, checkin, nutritionProtein, proteinTarget) {
  if (!m || !m.weight) return [];
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const items = [];

  // Recovery priority: bad sleep or high fatigue
  if (checkin?.morningDone) {
    const sleepIdx = mc.sleepDuration ?? 2;
    if (sleepIdx <= 1) items.push({ icon: "😴", color: "#0ea5e9", priority: "high", title: "恢复优先", desc: `睡眠不足，今日降低训练强度，补充碳水` });
    else if (mc.fatigue >= 7) items.push({ icon: "⚡", color: "#f59e0b", priority: "high", title: "控制疲劳", desc: `疲劳度 ${mc.fatigue}/10，建议轻度训练或休息` });
    else if (mc.soreness >= 7) items.push({ icon: "💆", color: "#8b5cf6", priority: "medium", title: "肌肉恢复", desc: `酸痛度 ${mc.soreness}/10，今日做拉伸或有氧` });
  }

  // Protein gap from Nutrition
  if (nutritionProtein !== null && proteinTarget > 0) {
    const gap = proteinTarget - nutritionProtein;
    if (gap > proteinTarget * 0.5) items.push({ icon: "🥩", color: "#10b981", priority: "high", title: "补充蛋白质", desc: `今日还差 ${gap}g 蛋白，进入 Nutrition 记录` });
    else if (gap > 20) items.push({ icon: "🥛", color: "#10b981", priority: "medium", title: "蛋白收尾", desc: `再补 ${gap}g 即达标，1勺蛋白粉或1盒希腊酸奶` });
  } else if (nutritionProtein === null) {
    items.push({ icon: "📋", color: "#10b981", priority: "medium", title: "记录今日饮食", desc: "还未记录，进入 Nutrition 开始追踪" });
  }

  // InBody-based structural focus
  const bfIdeal = p.gender === "female" ? 22 : 15;
  if (m.bodyFatPercentage > bfIdeal + 5) items.push({ icon: "🔥", color: "#f59e0b", priority: "medium", title: "热量控制", desc: `体脂 ${m.bodyFatPercentage}%，当前 TDEE 赤字有效` });
  const smmIdeal = p.gender === "female" ? m.weight * 0.38 : m.weight * 0.45;
  if (m.skeletalMuscleMass < smmIdeal * 0.92) items.push({ icon: "💪", color: "#8b5cf6", priority: "medium", title: "优先抗阻训练", desc: `肌肉量低于理想 ${Math.round((smmIdeal - m.skeletalMuscleMass) * 10) / 10}kg，今日安排力量` });
  if (m.visceralFatLevel >= 10) items.push({ icon: "🫀", color: "#f43f5e", priority: "high", title: "内脏脂肪警戒", desc: `VFL ${m.visceralFatLevel}，有氧运动 + 控糖是首选` });

  // ECW ratio hydration
  if (m.intracellularWater > 0) {
    const ecwR = m.extracellularWater / (m.intracellularWater + m.extracellularWater);
    if (ecwR > 0.38) items.push({ icon: "💧", color: "#0ea5e9", priority: "medium", title: "注意水肿风险", desc: `ECW比 ${ecwR.toFixed(3)}，减少钠摄入，保证饮水` });
  }

  // Training done check
  if (checkin?.eveningDone && ec.training === "skip") {
    items.push({ icon: "⚠️", color: "#f59e0b", priority: "low", title: "今日未训练", desc: "明日补上或调整计划，保持一致性" });
  }

  // Sort: high first, max 3
  const order = { high: 0, medium: 1, low: 2 };
  return items.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 3);
}

function TodayFocusCard({ m, p, checkin, nutritionProtein, proteinTarget, onGoNutrition }) {
  const items = calcTodayFocus(m, p, checkin, nutritionProtein, proteinTarget);
  if (items.length === 0) return null;

  return (
    <div style={{ ...g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.border}` }) }}>
      <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
        Today's Focus · 今日重点
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it, i) => (
          <div
            key={i}
            onClick={it.title.includes("蛋白") || it.title.includes("饮食") || it.title.includes("Nutrition") ? onGoNutrition : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 14px", borderRadius: 12,
              background: it.color + "0d", border: `1px solid ${it.color}22`,
              cursor: (it.title.includes("蛋白") || it.title.includes("饮食") || it.title.includes("Nutrition")) ? "pointer" : "default",
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: it.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{it.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{it.title}</span>
                {it.priority === "high" && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 6, background: "#f43f5e20", color: "#f43f5e", fontWeight: 700 }}>重要</span>}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{it.desc}</div>
            </div>
            {(it.title.includes("蛋白") || it.title.includes("饮食") || it.title.includes("Nutrition")) && (
              <div style={{ padding: "4px 10px", borderRadius: 8, background: it.color + "20", border: `1px solid ${it.color}40`, fontSize: 11, color: it.color, fontWeight: 700, whiteSpace: "nowrap" }}>去记录 {"->"}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GOAL PROGRESS ─────────────────────────────────────────────
function calcGoalProgress(m, p) {
  if (!m || !m.weight) return null;
  const goal = p.goal;
  const gender = p.gender;

  // Ideal targets based on goal
  const idealBF = goal === "muscle_gain" ? (gender === "female" ? 20 : 12)
    : goal === "weight_loss" ? (gender === "female" ? 22 : 15)
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

  // Progress 0-100: how close to ideal
  const bfProgress = Math.max(0, Math.min(100, Math.round(100 - Math.abs(bfGap) * 5)));
  const smmProgress = Math.max(0, Math.min(100, Math.round((m.skeletalMuscleMass / idealSMM) * 100)));

  // ETA calculation
  const getETA = (gapKg, weeklyRateKg) => {
    if (gapKg <= 0.3) return "已达标";
    const weeks = Math.ceil(gapKg / weeklyRateKg);
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return `${d.getFullYear()}年${d.getMonth()+1}月预计达成`;
  };
  const bfWeeklyRate = goal === "weight_loss" ? 0.3 : 0.15; // % per week
  const smmWeeklyRate = goal === "muscle_gain" ? 0.15 : 0.08; // kg per week
  const bfETA = getETA(Math.max(0, bfGap), bfWeeklyRate);
  const smmETA = getETA(Math.max(0, smmGap), smmWeeklyRate);
  const weightETA = getETA(Math.abs(weightGap), 0.25);

  const dims = [
    {
      label: "体脂率", current: `${m.bodyFatPercentage}%`, target: `${idealBF}%`,
      gap: bfGap > 0.5 ? `-${bfGap.toFixed(1)}%` : bfGap < -0.5 ? `+${Math.abs(bfGap).toFixed(1)}%` : "达标 ✓",
      progress: bfProgress, color: bfGap > 5 ? C.rose : bfGap > 2 ? C.amber : C.emerald,
      note: bfGap > 0.5 ? "需减脂" : "已达标", eta: bfETA,
    },
    {
      label: "肌肉量", current: `${m.skeletalMuscleMass}kg`, target: `${idealSMM.toFixed(1)}kg`,
      gap: smmGap > 0.5 ? `+${smmGap.toFixed(1)}kg` : smmGap < -0.5 ? `-${Math.abs(smmGap).toFixed(1)}kg` : "达标 ✓",
      progress: smmProgress, color: smmGap > 3 ? C.amber : smmGap > 1 ? C.sky : C.emerald,
      note: smmGap > 0.5 ? "需增肌" : "已达标", eta: smmETA,
    },
    {
      label: "目标体重", current: `${m.weight}kg`, target: `${idealWeight}kg`,
      gap: Math.abs(weightGap) > 0.5 ? `${weightGap > 0 ? "-" : "+"}${Math.abs(weightGap).toFixed(1)}kg` : "达标 ✓",
      progress: Math.max(0, Math.min(100, Math.round(100 - Math.abs(weightGap) * 3))),
      color: Math.abs(weightGap) > 5 ? C.rose : Math.abs(weightGap) > 2 ? C.amber : C.emerald,
      note: Math.abs(weightGap) > 1 ? "进行中" : "已达标", eta: weightETA,
    },
  ];

  const overallProgress = Math.round((bfProgress + smmProgress) / 2);
  return { dims, overallProgress, goal: GOAL_CN[goal] || goal };
}

function GoalProgressCard({ m, p }) {
  const result = calcGoalProgress(m, p);
  if (!result) return null;
  const { dims, overallProgress, goal } = result;
  const ringColor = overallProgress >= 80 ? C.emerald : overallProgress >= 60 ? C.sky : C.amber;

  return (
    <div style={{ ...g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.border}` }) }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Goal Progress · 目标进度</div>
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
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 5, paddingTop: 5, borderTop: `1px solid rgba(255,255,255,0.04)` }}>
              {d.eta}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CONSISTENCY ENGINE ───────────────────────────────────────
function calcConsistency() {
  const results = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { results.push(null); continue; }
      const ci = JSON.parse(raw);
      const cr = calcComplianceScore(ci);
      results.push(cr ? cr.total : null);
    } catch { results.push(null); }
  }

  const scored = results.filter(x => x !== null);
  const rate = scored.length > 0 ? Math.round((scored.length / 30) * 100) : 0;
  const avg = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;

  // Streak: count consecutive days from today
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    if (results[i] !== null && results[i] >= 50) streak++;
    else break;
  }

  // Consistency grade
  // New users (<7 days of data): grade purely on avg score, no rate penalty
  // Established users (7+ days): weight both rate and avg
  const isNewUser = scored.length < 7;
  const grade = isNewUser
    ? (avg >= 80 ? "A" : avg >= 65 ? "B" : avg >= 50 ? "C" : "D")
    : (rate >= 80 && avg >= 75) ? "S"
    : (rate >= 70 && avg >= 65) ? "A"
    : (rate >= 55 && avg >= 55) ? "B"
    : (rate >= 40) ? "C" : "D";

  const gradeColor = grade === "S" ? "#10b981"
    : grade === "A" ? "#0ea5e9"
    : grade === "B" ? "#f59e0b"
    : grade === "C" ? "#f97316" : "#f43f5e";

  const gradeDesc = isNewUser
    ? (avg >= 80 ? "优秀开局" : avg >= 65 ? "良好开局" : "建立习惯中")
    : grade === "S" ? "卓越一致性" : grade === "A" ? "优秀一致性"
    : grade === "B" ? "良好一致性" : grade === "C" ? "建立习惯中" : "需要提升";

  // Last 14 days for mini heatmap
  const heatmap = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { heatmap.push(null); continue; }
      const ci = JSON.parse(raw);
      const cr = calcComplianceScore(ci);
      heatmap.push(cr ? cr.total : null);
    } catch { heatmap.push(null); }
  }

  return { streak, rate, avg, grade, gradeColor, gradeDesc, heatmap, scored, isNewUser };
}

function ConsistencyCard() {
  const c = calcConsistency();
  const { streak, rate, avg, grade, gradeColor, gradeDesc, heatmap, isNewUser, scored } = c;

  return (
    <div style={g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${C.border}` })}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Consistency Engine</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>执行一致性</div>
        </div>
        {/* Grade badge */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: gradeColor + "18", border: `2px solid ${gradeColor}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: gradeColor }}>{grade}</span>
          </div>
          <div style={{ fontSize: 9, color: gradeColor }}>{gradeDesc}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: `1px solid rgba(255,255,255,0.05)`, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: streak >= 7 ? "#f59e0b" : C.text, lineHeight: 1, marginBottom: 3 }}>
            {streak >= 1 ? "🔥" : ""}{streak}
          </div>
          <div style={{ fontSize: 10, color: C.textMuted }}>连续天数</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: `1px solid rgba(255,255,255,0.05)`, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: gradeColor, lineHeight: 1, marginBottom: 3 }}>{rate}%</div>
          <div style={{ fontSize: 10, color: C.textMuted }}>30天执行率</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: `1px solid rgba(255,255,255,0.05)`, textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: C.sky, lineHeight: 1, marginBottom: 3 }}>{avg || "-"}</div>
          <div style={{ fontSize: 10, color: C.textMuted }}>平均执行分</div>
        </div>
      </div>

      {/* New user hint */}
      {isNewUser && (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(14,165,233,0.08)", border: `1px solid rgba(14,165,233,0.2)`, fontSize: 11, color: C.sky }}>
          📊 数据积累中（{scored.length}/7天）· 等级基于当前平均执行分，7天后切换完整算法
        </div>
      )}

      {/* 14-day heatmap */}
      <div>
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>过去14天</div>
        <div style={{ display: "flex", gap: 4 }}>
          {heatmap.map((val, i) => {
            const color = val === null ? "rgba(255,255,255,0.05)"
              : val >= 85 ? "#10b981"
              : val >= 70 ? "#0ea5e9"
              : val >= 55 ? "#f59e0b"
              : "#f43f5e";
            return (
              <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, background: color, position: "relative" }}
                title={val !== null ? `${val}分` : "未记录"}>
                {val !== null && (
                  <div style={{ position: "absolute", bottom: -14, left: "50%", transform: "translateX(-50%)", fontSize: 8, color: C.textMuted, whiteSpace: "nowrap" }}>
                    {i === 13 ? "今" : i === 12 ? "昨" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.textMuted, marginTop: 18 }}>
          <span>14天前</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span>🟥低</span><span>🟨中</span><span>🟦良</span><span>🟩优</span>
          </span>
          <span>今天</span>
        </div>
      </div>
    </div>
  );
}

// ── DAILY REFLECTION ──────────────────────────────────────────
function promptDailyReflection(todayScore, yesterdayScore, checkin, nutritionProtein, proteinTarget, consistency) {
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const sleepLabels = ["<5h", "5-6h", "6-7h", "7-8h", ">8h"];
  const diff = yesterdayScore !== null ? todayScore - yesterdayScore : null;
  return `You are a warm, insightful personal health coach. Write a short Daily Reflection in Chinese for the user.
Today's data:
- Compliance score: ${todayScore}${diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff} vs yesterday's ${yesterdayScore})` : ""}
- Sleep: ${mc.sleepDuration !== undefined ? sleepLabels[mc.sleepDuration] : "unknown"}, quality ${mc.sleepQuality || "?"}/5
- Fatigue: ${mc.fatigue || "?"}/10, Stress: ${mc.stress || "?"}/10, Soreness: ${mc.soreness || "?"}/10
- Protein: ${nutritionProtein !== null ? `${nutritionProtein}g (${Math.round(nutritionProtein/proteinTarget*100)}% of ${proteinTarget}g target)` : "not tracked"}
- Training: ${ec.training || "unknown"}, Water: ${ec.waterMl || "?"}ml, Mood: ${ec.mood || "?"}/5
- Consistency: ${consistency.rate}% over 30 days, grade ${consistency.grade}, streak ${consistency.streak} days

Write a Daily Reflection with 3 parts:
1. Today summary (1-2 sentences, specific, mention actual numbers)
2. One key insight (what's working or what's the main bottleneck)
3. One concrete suggestion for tomorrow

Tone: like a knowledgeable coach who genuinely cares, not a chatbot. Be specific, not generic.
Return ONLY JSON:
{"summary":"今天比昨天提高了8分...","insight":"蛋白质摄入明显改善...","tomorrow":"明天建议...","highlight":"一句话亮点（15字内）","mood":"positive|neutral|concern"}`;
}

function DailyReflectionCard({ checkin, todayCompliance, aiCfg, nutritionProtein, proteinTarget }) {
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(() => {
    try {
      const key = `reflection_${new Date().toISOString().slice(0, 10)}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [error, setError] = useState(null);

  const consistency = calcConsistency();

  const yesterdayCompliance = (() => {
    try {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const key = `checkin_${d.toISOString().slice(0, 10)}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cr = calcComplianceScore(JSON.parse(raw));
      return cr ? cr.total : null;
    } catch { return null; }
  })();

  const generate = async () => {
    if (!aiCfg.apiKey && aiCfg.provider !== "ollama") {
      // Local fallback reflection
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
    setStatus("loading");
    setError(null);
    try {
      const raw = await callTextAI(
        promptDailyReflection(todayCompliance, yesterdayCompliance, checkin, nutritionProtein, proteinTarget, consistency),
        aiCfg.provider, aiCfg.apiKey, aiCfg.modelName
      );
      const data = parseJSON(raw);
      if (data?.summary) {
        setResult(data);
        setStatus("success");
        try { localStorage.setItem(`reflection_${new Date().toISOString().slice(0, 10)}`, JSON.stringify(data)); } catch {}
      } else { setError("解析失败，请重试"); setStatus("error"); }
    } catch (e) { setError(String(e)); setStatus("error"); }
  };

  const moodColor = result?.mood === "positive" ? C.emerald : result?.mood === "concern" ? C.amber : C.sky;

  return (
    <div style={g({ padding: "20px 24px", marginBottom: 16, border: `1px solid ${result ? moodColor + "25" : C.border}`, position: "relative", overflow: "hidden" })}>
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
          {result && (
            <button onClick={generate} style={{ padding: "5px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
              刷新
            </button>
          )}
        </div>
      </div>

      {result && (
        <div>
          {/* Highlight pill */}
          <div style={{ display: "inline-block", padding: "4px 12px", borderRadius: 20, background: moodColor + "15", border: `1px solid ${moodColor}30`, color: moodColor, fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
            {result.highlight}
          </div>

          {/* 3 reflection blocks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${moodColor}` }}>
              <div style={{ fontSize: 10, color: moodColor, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>今日总结</div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{result.summary}</div>
            </div>
            <div style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${C.sky}` }}>
              <div style={{ fontSize: 10, color: C.sky, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>关键洞察</div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{result.insight}</div>
            </div>
            <div style={{ padding: "11px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${C.emerald}` }}>
              <div style={{ fontSize: 10, color: C.emerald, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>明日建议</div>
              <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6 }}>{result.tomorrow}</div>
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.rose }}>⚠ {error}</div>
      )}

      {!result && status === "idle" && (
        <div style={{ marginTop: 12, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
          完成今日 Check-in 后生成个性化回顾，AI 会告诉你今天哪里做得好、明天怎么进步。
        </div>
      )}
    </div>
  );
}

// ── BODY STATE CARD ──────────────────────────────────────────
function BodyStateCard({ state, localScore, aiScore, aiStatus, aiError, onGenerate }) {
  const score = aiScore || localScore;
  if (!score) return null;
  const isAI = !!aiScore;
  const scoreColor = score.total >= 80 ? C.emerald : score.total >= 60 ? C.sky : score.total >= 40 ? C.amber : C.rose;

  // If checkin data available, show 4-layer breakdown; otherwise show 5 InBody dims
  const dims = isAI
    ? [
        { label: "肌肉", val: score.dimensionScores?.muscle ?? score.smmScore, color: C.emerald },
        { label: "体脂", val: score.dimensionScores?.bodyFat ?? score.bfScore, color: C.amber },
        { label: "水分", val: score.dimensionScores?.hydration ?? score.hydScore, color: C.sky },
        { label: "内脏", val: score.dimensionScores?.visceral ?? score.vflScore, color: C.rose },
        { label: "代谢", val: score.dimensionScores?.metabolic ?? score.metScore, color: C.violet },
      ]
    : score.hasCheckinData
    ? [
        { label: "基础底子", val: score.baselineScore, color: C.emerald },
        { label: "恢复状态", val: score.recoveryScore, color: C.sky },
        { label: "行为执行", val: score.behaviorScore, color: C.amber },
        { label: "压力心情", val: score.stressScore, color: C.violet },
        { label: "综合", val: score.total, color: scoreColor },
      ]
    : [
        { label: "肌肉", val: score.smmScore, color: C.emerald },
        { label: "体脂", val: score.bfScore, color: C.amber },
        { label: "水分", val: score.hydScore, color: C.sky },
        { label: "内脏", val: score.vflScore, color: C.rose },
        { label: "代谢", val: score.metScore, color: C.violet },
      ];

  return (
    <div style={g({ padding: "24px", marginBottom: 20, border: `1px solid ${scoreColor}25`, position: "relative", overflow: "hidden" })}>
      {/* bg glow */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${scoreColor}08 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            基础身体状态 · Baseline Body State {isAI && <span style={{ color: C.violet, marginLeft: 6 }}>· AI 精准模式</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, opacity: 0.6 }}>
            基于 InBody 慢变量 · 非今日实时状态
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <GaugeArc value={score.total} max={100} color={scoreColor} size={90} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score.total}</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>Body Score</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>
                {isAI ? score.stateEmoji : score.stateIcon}
                <span style={{ fontSize: 18, fontWeight: 700, color: isAI ? (score.stateColor === "emerald" ? C.emerald : score.stateColor === "amber" ? C.amber : score.stateColor === "rose" ? C.rose : C.sky) : score.stateColor, marginLeft: 8 }}>
                  {isAI ? score.stateLabel : score.stateDesc}
                </span>
              </div>
              <div style={{ fontSize: 13, color: C.textSub, maxWidth: 260, lineHeight: 1.5 }}>
                {isAI ? score.oneLiner : score.topAlert}
              </div>
            </div>
          </div>
        </div>

        <div className="no-print">
          {aiStatus === "idle" && (
            <button onClick={onGenerate} style={{ padding: "7px 16px", borderRadius: 20, border: `1px solid ${C.violet}40`, background: C.violetDim, color: C.violet, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              AI 精准分析
            </button>
          )}
          {aiStatus === "loading" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.violet, fontSize: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.violet, animation: "blink 1s infinite" }} />
              分析中...
            </div>
          )}
          {aiStatus === "success" && (
            <button onClick={onGenerate} style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
              重新生成
            </button>
          )}
          {aiStatus === "error" && (
            <button onClick={onGenerate} style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${C.rose}40`, background: C.roseDim, color: C.rose, fontSize: 11, cursor: "pointer" }}>
              重试
            </button>
          )}
        </div>
      </div>

      {/* 5 dimension bars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 18 }}>
        {dims.map((d, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: d.color, marginBottom: 4 }}>{d.val}</div>
            <Bar value={d.val} max={100} color={d.color} h={4} />
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {/* Suggestion + alert */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: `${scoreColor}0f`, border: `1px solid ${scoreColor}20` }}>
          <div style={{ fontSize: 10, color: scoreColor, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>建议方向</div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{isAI ? score.todayFocus : score.todayFocus}</div>
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" }}>关注点</div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6 }}>{isAI ? score.topAlert : score.topAlert}</div>
        </div>
      </div>

      {/* AI insight (only in AI mode) */}
      {isAI && score.aiInsight && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: C.violetDim, border: `1px solid ${C.violet}20` }}>
          <div style={{ fontSize: 10, color: C.violet, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI 深度洞察</div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>{score.aiInsight}</div>
          {score.actionPlan?.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {score.actionPlan.map((a, i) => (
                <Bullet key={i} color={[C.rose, C.amber, C.emerald][i] || C.emerald}>{a}</Bullet>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nudge when no checkin */}
      {!score.hasCheckinData && !isAI && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18 }}>☀️</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
            完成今日晨间 Check-in 后，评分将加入睡眠、疲劳、压力等快变量，建议更准确
          </div>
        </div>
      )}

      {aiStatus === "error" && (
        <div style={{ marginTop: 10, fontSize: 12, color: C.rose }}>{"⚠ "}{aiError}</div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  NUTRITION PAGE
// ══════════════════════════════════════════════════════════════

const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
const MEAL_ICONS = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🥛" };
const MEAL_COLORS = { breakfast: "#f59e0b", lunch: "#10b981", dinner: "#8b5cf6", snack: "#0ea5e9" };

function promptFoodParse(input, proteinTarget, calTarget) {
  return `You are a precise sports nutritionist. Parse this food description and return ONLY JSON with consistent values.
CRITICAL: For the same food and weight, always return the same numbers. Use standard nutritional databases.
Food input: "${input}"
Protein target today: ${proteinTarget}g, Calorie target: ${calTarget}kcal

Return ONLY this JSON (no markdown, no explanation):
{"items":[{"name":"食物名","weight":"150g","protein":32,"carbs":0,"fat":3,"calories":165}],"total":{"protein":32,"carbs":0,"fat":3,"calories":165},"mealScore":82,"mealScoreNote":"蛋白质充足，低脂优质","proteinQuality":"high","proteinQualityNote":"优质动物蛋白，氨基酸完整"}`;
}

function promptGapAnalysis(todayTotals, targets) {
  const gapProtein = Math.max(0, targets.protein - todayTotals.protein);
  const gapCal = Math.max(0, targets.calories - todayTotals.calories);
  return `You are a sports nutritionist. The user needs to close nutrition gaps today. Return ONLY JSON.
Today so far: protein=${todayTotals.protein}g, calories=${todayTotals.calories}kcal, carbs=${todayTotals.carbs}g, fat=${todayTotals.fat}g
Daily targets: protein=${targets.protein}g, calories=${targets.calories}kcal
Gaps: protein=${gapProtein}g, calories=${gapCal}kcal

Suggest 2-3 practical, easy food combinations to close the gap. Be specific with portions.
Return ONLY this JSON:
{"gapSummary":"今日还差X蛋白质，Y热量","suggestions":[{"emoji":"🥛","foods":"乳清蛋白1勺+希腊酸奶1盒","protein":41,"calories":320,"note":"最方便"},{"emoji":"🍗","foods":"鸡胸肉150g","protein":39,"calories":185,"note":"高性价比"}],"todayAdvice":"一句话今日建议"}`;
}

function NutritionMealCard({ mealKey, meal, onAdd, onRemove, onClear, proteinTarget, calTarget, aiCfg }) {
  const [expanded, setExpanded] = useState(false);
  const [inputMode, setInputMode] = useState("ai"); // "ai" | "manual"
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", protein: "", carbs: "", fat: "", calories: "" });
  const color = MEAL_COLORS[mealKey];
  const items = meal?.items || [];
  const total = items.reduce((acc, it) => ({
    protein: acc.protein + (it.protein || 0),
    carbs: acc.carbs + (it.carbs || 0),
    fat: acc.fat + (it.fat || 0),
    calories: acc.calories + (it.calories || 0),
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });
  // Round totals to avoid floating point accumulation
  const totalRounded = {
    protein: Math.round(total.protein * 10) / 10,
    carbs: Math.round(total.carbs * 10) / 10,
    fat: Math.round(total.fat * 10) / 10,
    calories: Math.round(total.calories),
  };

  const handleAIParse = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const raw = await callTextAI(promptFoodParse(aiInput, proteinTarget, calTarget), aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      const data = parseJSON(raw);
      if (data?.items) {
        // Round all numeric values to avoid floating point display issues
        const cleanItems = data.items.map(it => ({
          ...it,
          protein: Math.round((it.protein || 0) * 10) / 10,
          carbs: Math.round((it.carbs || 0) * 10) / 10,
          fat: Math.round((it.fat || 0) * 10) / 10,
          calories: Math.round(it.calories || 0),
        }));
        onAdd(mealKey, cleanItems, data.mealScore, data.mealScoreNote, data.proteinQuality, data.proteinQualityNote);
        setAiInput("");
      }
    } catch {}
    setAiLoading(false);
  };

  const handleAIRescore = async () => {
    if (items.length === 0) return;
    setAiLoading(true);
    const desc = items.map(it => `${it.name}${it.weight && it.weight !== "-" ? " " + it.weight : ""}`).join(" + ");
    try {
      const raw = await callTextAI(promptFoodParse(desc, proteinTarget, calTarget), aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      const data = parseJSON(raw);
      if (data?.mealScore) {
        onAdd(mealKey, [], data.mealScore, data.mealScoreNote, data.proteinQuality, data.proteinQualityNote);
      }
    } catch {}
    setAiLoading(false);
  };

  const handleManualAdd = () => {
    const it = {
      name: manualItem.name || "自定义食物",
      weight: "-",
      protein: Number(manualItem.protein) || 0,
      carbs: Number(manualItem.carbs) || 0,
      fat: Number(manualItem.fat) || 0,
      calories: Number(manualItem.calories) || 0,
    };
    onAdd(mealKey, [it], null, null, null, null);
    setManualItem({ name: "", protein: "", carbs: "", fat: "", calories: "" });
  };

  return (
    <div style={{ ...g({ padding: 0, marginBottom: 12, overflow: "hidden", border: `1px solid ${expanded ? color + "30" : C.border}` }), transition: "border-color 0.2s" }}>
      {/* Header */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{MEAL_ICONS[mealKey]}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{MEAL_LABELS[mealKey]}</div>
            {items.length > 0 ? (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                {items.length}种食物 · {totalRounded.protein}g蛋白 · {totalRounded.calories}kcal
              </div>
            ) : (
              <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>未记录</div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {meal?.mealScore && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: meal.mealScore >= 80 ? C.emerald : meal.mealScore >= 60 ? C.amber : C.rose }}>
                {meal.mealScore}分
              </div>
              {meal.mealScoreNote && (
                <div style={{ fontSize: 9, color: C.textMuted, maxWidth: 90, lineHeight: 1.3 }}>{meal.mealScoreNote}</div>
              )}
            </div>
          )}
          {meal?.proteinQuality && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: meal.proteinQuality === "high" ? C.emeraldDim : C.amberDim, color: meal.proteinQuality === "high" ? C.emerald : C.amber }}>
                P{meal.proteinQuality === "high" ? "优" : meal.proteinQuality === "medium" ? "中" : "低"}
              </div>
              {meal.proteinQualityNote && (
                <div style={{ fontSize: 9, color: C.textMuted, maxWidth: 70, lineHeight: 1.3, marginTop: 2 }}>{meal.proteinQualityNote}</div>
              )}
            </div>
          )}
          <div style={{ color: C.textMuted, fontSize: 12, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 20px" }}>
          {/* Food items list */}
          {items.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {items.map((it, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <div>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{it.name}</span>
                    {it.weight && it.weight !== "-" && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>{it.weight}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 11, color: C.textMuted }}>
                      P<span style={{ color: C.emerald }}>{it.protein}g</span> C{it.carbs}g F{it.fat}g <span style={{ color: C.amber }}>{it.calories}kcal</span>
                    </div>
                    <button onClick={() => onRemove(mealKey, idx)} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 14, padding: "0 4px" }}>✕</button>
                  </div>
                </div>
              ))}
              {/* Meal total + actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Re-score button */}
                  <button onClick={handleAIRescore} disabled={aiLoading || items.length === 0} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${color}40`, background: color + "10", color: color, fontSize: 11, fontWeight: 600, cursor: items.length === 0 ? "not-allowed" : "pointer", opacity: items.length === 0 ? 0.4 : 1 }}>
                    {aiLoading ? "评分中..." : "重新评分"}
                  </button>
                  {/* Clear all button */}
                  <button onClick={() => onClear(mealKey)} style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(244,63,94,0.3)`, background: "rgba(244,63,94,0.08)", color: C.rose, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                    清空本餐
                  </button>
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ color: C.emerald }}>蛋白 {totalRounded.protein}g</span>
                  <span style={{ color: C.textSub }}>碳水 {totalRounded.carbs}g</span>
                  <span style={{ color: C.textSub }}>脂肪 {totalRounded.fat}g</span>
                  <span style={{ color: C.amber }}>{totalRounded.calories}kcal</span>
                </div>
              </div>
            </div>
          )}

          {/* Input mode tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <button onClick={() => setInputMode("ai")} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${inputMode === "ai" ? color + "60" : C.border}`, background: inputMode === "ai" ? color + "15" : "transparent", color: inputMode === "ai" ? color : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>AI 解析</button>
            <button onClick={() => setInputMode("manual")} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${inputMode === "manual" ? color + "60" : C.border}`, background: inputMode === "manual" ? color + "15" : "transparent", color: inputMode === "manual" ? color : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>手动输入</button>
            <button onClick={() => {}} disabled style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 12, cursor: "not-allowed", opacity: 0.4 }}>📷 拍照 Coming Soon</button>
          </div>

          {inputMode === "ai" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAIParse()}
                placeholder="例：鸡胸肉150g + 米饭200g + 西兰花100g"
                style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 13, outline: "none" }}
              />
              <button onClick={handleAIParse} disabled={aiLoading || !aiInput.trim()} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: aiLoading ? "rgba(255,255,255,0.05)" : color, color: aiLoading ? C.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {aiLoading ? "解析中..." : "解析"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 6 }}>
              <input value={manualItem.name} onChange={e => setManualItem(s => ({ ...s, name: e.target.value }))} placeholder="食物名称" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={manualItem.protein} onChange={e => setManualItem(s => ({ ...s, protein: e.target.value }))} placeholder="蛋白g" type="number" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={manualItem.carbs} onChange={e => setManualItem(s => ({ ...s, carbs: e.target.value }))} placeholder="碳水g" type="number" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={manualItem.fat} onChange={e => setManualItem(s => ({ ...s, fat: e.target.value }))} placeholder="脂肪g" type="number" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              <input value={manualItem.calories} onChange={e => setManualItem(s => ({ ...s, calories: e.target.value }))} placeholder="热量" type="number" style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              <button onClick={handleManualAdd} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NutritionPage({ state, onBack }) {
  const m = state.measurements;
  const { tdee, proteinG } = buildDataBlock(m, state);
  const calTarget = state.goal === "weight_loss" ? tdee - 300 : state.goal === "muscle_gain" ? tdee + 300 : tdee;
  const targets = { protein: proteinG, calories: calTarget, carbs: Math.round((calTarget * 0.40) / 4), fat: Math.round((calTarget * 0.25) / 9) };

  const todayKey = `nutrition_${new Date().toISOString().slice(0, 10)}`;
  const checkinKey = `checkin_${new Date().toISOString().slice(0, 10)}`;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [meals, setMealsRaw] = useState(() => {
    try { const s = localStorage.getItem(todayKey); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });

  // Stable setMeals: persists to localStorage + syncs proteinPct to checkin (never forces eveningDone)
  const setMeals = useCallback((updater) => {
    setMealsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(todayKey, JSON.stringify(next)); } catch {}
      const allItems = Object.values(next).flatMap(meal => meal?.items || []);
      const totalProtein = allItems.reduce((s, it) => s + (it.protein || 0), 0);
      const pct = Math.min(100, Math.round((totalProtein / targetsRef.current.protein) * 100));
      try {
        const raw = localStorage.getItem(checkinKey);
        const ci = raw ? JSON.parse(raw) : {};
        const updated = { ...ci, evening: { ...(ci.evening || {}), proteinPct: pct } };
        localStorage.setItem(checkinKey, JSON.stringify(updated));
      } catch {}
      return next;
    });
  }, [todayKey, checkinKey]);

  const [gapResult, setGapResult] = useState(null);
  const [gapLoading, setGapLoading] = useState(false);
  const aiCfg = { provider: state.provider, apiKey: state.apiKey, modelName: state.modelName };

  const allItems = Object.values(meals).flatMap(meal => meal?.items || []);
  const todayTotals = allItems.reduce((acc, it) => ({
    protein: acc.protein + (it.protein || 0),
    carbs: acc.carbs + (it.carbs || 0),
    fat: acc.fat + (it.fat || 0),
    calories: acc.calories + (it.calories || 0),
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });

  const handleAddItems = (mealKey, items, mealScore, mealScoreNote, proteinQuality, proteinQualityNote) => {
    setMeals(prev => ({
      ...prev,
      [mealKey]: {
        // If items is empty, this is a rescore-only call — keep existing items
        items: items.length > 0 ? [...(prev[mealKey]?.items || []), ...items] : (prev[mealKey]?.items || []),
        mealScore: mealScore ?? prev[mealKey]?.mealScore,
        mealScoreNote: mealScoreNote ?? prev[mealKey]?.mealScoreNote,
        proteinQuality: proteinQuality ?? prev[mealKey]?.proteinQuality,
        proteinQualityNote: proteinQualityNote ?? prev[mealKey]?.proteinQualityNote,
      }
    }));
  };

  const handleRemoveItem = (mealKey, idx) => {
    setMeals(prev => {
      const items = [...(prev[mealKey]?.items || [])];
      items.splice(idx, 1);
      return { ...prev, [mealKey]: { ...prev[mealKey], items } };
    });
  };

  const handleClearMeal = (mealKey) => {
    setMeals(prev => ({ ...prev, [mealKey]: { items: [], mealScore: null, mealScoreNote: null, proteinQuality: null, proteinQualityNote: null } }));
  };

  const fetchGap = async () => {
    setGapLoading(true);
    try {
      const raw = await callTextAI(promptGapAnalysis(todayTotals, targets), aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      setGapResult(parseJSON(raw));
    } catch {}
    setGapLoading(false);
  };

  const proteinPct = Math.round((todayTotals.protein / targets.protein) * 100);
  const calPct = Math.round((todayTotals.calories / targets.calories) * 100);
  const carbPct = Math.round((todayTotals.carbs / targets.carbs) * 100);
  const fatPct = Math.round((todayTotals.fat / targets.fat) * 100);

  const macros = [
    { label: "蛋白质", current: todayTotals.protein, target: targets.protein, pct: proteinPct, color: C.emerald, unit: "g" },
    { label: "热量", current: todayTotals.calories, target: targets.calories, pct: calPct, color: C.amber, unit: "kcal" },
    { label: "碳水", current: todayTotals.carbs, target: targets.carbs, pct: carbPct, color: C.sky, unit: "g" },
    { label: "脂肪", current: todayTotals.fat, target: targets.fat, pct: fatPct, color: C.violet, unit: "g" },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.emerald, marginBottom: 6, textTransform: "uppercase" }}>Nutrition Tracker</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>今日饮食</h2>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" })}
          </div>
        </div>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.textSub, fontSize: 13, cursor: "pointer" }}>
          {"<-"} Dashboard
        </button>
      </div>

      {/* Macro Summary */}
      <div style={g({ padding: "20px 24px", marginBottom: 16 })}>
        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Today Macros</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {macros.map(mac => {
            const over = mac.pct > 100;
            const barColor = over ? (mac.label === "热量" || mac.label === "脂肪" ? C.rose : C.emerald) : mac.color;
            return (
            <div key={mac.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.textSub }}>{mac.label}</span>
                <span style={{ fontSize: 11, color: over ? barColor : mac.color, fontWeight: 700 }}>
                  {mac.pct}%{over && " ↑"}
                </span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", width: `${Math.min(100, mac.pct)}%`, background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{mac.current}<span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400 }}>/{mac.target}{mac.unit}</span></div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Gap Analysis */}
      <div style={g({ padding: "16px 20px", marginBottom: 16, border: `1px solid ${C.border}` })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gapResult ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Gap Analysis · 今日缺口</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              蛋白还差 <span style={{ color: C.emerald, fontWeight: 700 }}>{Math.max(0, targets.protein - todayTotals.protein)}g</span>
              {" · "}热量还差 <span style={{ color: C.amber, fontWeight: 700 }}>{Math.max(0, targets.calories - todayTotals.calories)}kcal</span>
            </div>
          </div>
          <button onClick={fetchGap} disabled={gapLoading} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.emerald}40`, background: C.emeraldDim, color: C.emerald, fontSize: 12, fontWeight: 700, cursor: gapLoading ? "not-allowed" : "pointer" }}>
            {gapLoading ? "分析中..." : "AI 补充方案"}
          </button>
        </div>
        {gapResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{gapResult.gapSummary}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(gapResult.suggestions || []).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.05)` }}>
                  <span style={{ fontSize: 20 }}>{s.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{s.foods}</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>+{s.protein}g蛋白 · +{s.calories}kcal</div>
                  </div>
                  <div style={{ fontSize: 11, padding: "3px 8px", borderRadius: 8, background: C.emeraldDim, color: C.emerald }}>{s.note}</div>
                </div>
              ))}
            </div>
            {gapResult.todayAdvice && (
              <div style={{ marginTop: 10, fontSize: 12, color: C.textSub, padding: "8px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", borderLeft: `3px solid ${C.emerald}` }}>
                {gapResult.todayAdvice}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Best / Worst Meal Award */}
      {(() => {
        const scored = MEAL_KEYS.map(k => ({ key: k, label: MEAL_LABELS[k], icon: MEAL_ICONS[k], score: meals[k]?.mealScore || null, color: MEAL_COLORS[k] })).filter(x => x.score !== null);
        if (scored.length < 2) return null;
        const best = scored.reduce((a, b) => a.score >= b.score ? a : b);
        const worst = scored.reduce((a, b) => a.score <= b.score ? a : b);
        if (best.key === worst.key) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div style={{ ...g({ padding: "12px 16px", border: `1px solid ${C.emerald}25` }), background: C.emeraldDim }}>
              <div style={{ fontSize: 10, color: C.emerald, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🏆 今日最佳餐</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{best.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{best.label}</div>
                  <div style={{ fontSize: 11, color: C.emerald, fontWeight: 800 }}>{best.score} 分</div>
                </div>
              </div>
            </div>
            <div style={{ ...g({ padding: "12px 16px", border: `1px solid ${C.amber}25` }), background: C.amberDim }}>
              <div style={{ fontSize: 10, color: C.amber, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>⚠️ 最需改善</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{worst.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{worst.label}</div>
                  <div style={{ fontSize: 11, color: C.amber, fontWeight: 800 }}>{worst.score} 分</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Meal Cards */}
      <div style={{ marginBottom: 8 }}>
        {MEAL_KEYS.map(key => (
          <NutritionMealCard
            key={key}
            mealKey={key}
            meal={meals[key]}
            onAdd={handleAddItems}
            onRemove={handleRemoveItem}
            onClear={handleClearMeal}
            proteinTarget={targets.protein}
            calTarget={targets.calories}
            aiCfg={aiCfg}
          />
        ))}
      </div>

      {/* Footer note */}
      <div style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 8 }}>
        饮食数据已自动同步到 Compliance Score · 蛋白达成率 {proteinPct}%
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ state, onReset, onBack, onNavigate }) {
  const m = state.measurements;
  const [osTab, setOsTab] = useState("dashboard");
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
  const [bodyStateAI, setBodyStateAI] = useState(null);
  const [bodyStateStatus, setBodyStateStatus] = useState("idle");
  const [bodyStateError, setBodyStateError] = useState(null);
  const [checkinModal, setCheckinModal] = useState(null); // "morning" | "evening" | null
  const todayKey = `checkin_${new Date().toISOString().slice(0,10)}`;
  const [checkin, setCheckinRaw] = useState(() => {
    try { const s = localStorage.getItem(todayKey); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const setCheckin = (val) => {
    setCheckinRaw(val);
    try { localStorage.setItem(todayKey, JSON.stringify(val)); } catch {}
  };

  // Re-read checkin from localStorage every time we return to dashboard tab
  // (Nutrition page writes proteinPct directly to localStorage)
  useEffect(() => {
    try { const s = localStorage.getItem(todayKey); if (s) setCheckinRaw(JSON.parse(s)); } catch {}
  }, [osTab, todayKey]);

  const localScore = calcBodyState(m, state, checkin);

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

  const generateBodyStateAI = async () => {
    if (!localScore) return;
    setBodyStateStatus("loading");
    setBodyStateError(null);
    try {
      const raw = await callTextAI(
        promptBodyState(m, state, localScore, checkin),
        aiCfg.provider,
        aiCfg.apiKey,
        aiCfg.modelName,
      );
      const data = parseJSON(raw);
      setBodyStateAI(data);
      setBodyStateStatus("success");
    } catch (err) {
      setBodyStateError(err.message);
      setBodyStateStatus("error");
    }
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

  // OS-level navigation tabs
  const OS_TABS = [
    { key: "dashboard", label: "Dashboard", icon: "⚡", active: true },
    { key: "nutrition", label: "Nutrition", icon: "🥗", active: true },
    { key: "training", label: "Training", icon: "💪", active: false },
    { key: "recovery", label: "Recovery", icon: "🌙", active: false },
    { key: "body", label: "Body Comp", icon: "📊", active: false },
    { key: "reports", label: "Reports", icon: "📈", active: false },
    { key: "settings", label: "Settings", icon: "⚙️", active: false },
  ];

  // Nutrition quick stats from localStorage
  const nutritionKey = `nutrition_${new Date().toISOString().slice(0, 10)}`;
  const nutritionTodayProtein = (() => {
    try {
      const raw = localStorage.getItem(nutritionKey);
      if (!raw) return null;
      const meals = JSON.parse(raw);
      const items = Object.values(meals).flatMap(meal => meal?.items || []);
      return items.reduce((s, it) => s + (it.protein || 0), 0);
    } catch { return null; }
  })();
  const { proteinG: proteinTarget } = buildDataBlock(m, state);
  const nutritionPct = nutritionTodayProtein !== null ? Math.min(100, Math.round((nutritionTodayProtein / proteinTarget) * 100)) : null;

  if (osTab === "nutrition") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} onBack={onBack} />
        <NutritionPage state={state} onBack={() => setOsTab("dashboard")} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slide{0%{width:0%;margin-left:0}50%{width:55%;margin-left:20%}100%{width:0%;margin-left:100%}}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @media print {
          nav, .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* OS Navigation */}
      <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} onBack={onBack} />

      {/* Dashboard Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: C.emerald, marginBottom: 6, textTransform: "uppercase" }}>InBody OS · Dashboard</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.1 }}>今日状态</h1>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {state.age}岁 · {state.gender === "male" ? "男" : "女"} · {GOAL_CN[state.goal] || state.goal}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.print()} style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", color: C.textMuted, fontSize: 12, cursor: "pointer" }}>导出 PDF</button>
          <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", color: C.textSub, fontSize: 12, cursor: "pointer" }}>{"<-"} 上一步</button>
        </div>
      </div>

      {/* Body State Engine */}
      <BodyStateCard
        state={state}
        localScore={localScore}
        aiScore={bodyStateAI}
        aiStatus={bodyStateStatus}
        aiError={bodyStateError}
        onGenerate={generateBodyStateAI}
      />

      {/* Today Check-in */}
      <CheckInCard checkin={checkin} onOpen={setCheckinModal} />

      {/* Compliance Score */}
      <ComplianceCard checkin={checkin} />

      {/* Today's Focus */}
      <TodayFocusCard
        m={m}
        p={state}
        checkin={checkin}
        nutritionProtein={nutritionTodayProtein}
        proteinTarget={proteinTarget}
        onGoNutrition={() => setOsTab("nutrition")}
      />

      {/* Goal Progress */}
      <GoalProgressCard m={m} p={state} />

      {/* Consistency Engine */}
      <ConsistencyCard />

      {/* Daily Reflection */}
      <DailyReflectionCard
        checkin={checkin}
        todayCompliance={(() => { const r = calcComplianceScore(checkin); return r ? r.total : 0; })()}
        aiCfg={{ provider: state.provider, apiKey: state.apiKey, modelName: state.modelName }}
        nutritionProtein={nutritionTodayProtein}
        proteinTarget={proteinTarget}
      />

      {/* Module entry cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Nutrition entry - prominent with gap urgency */}
        {(() => {
          const hasGap = nutritionTodayProtein !== null && (proteinTarget - nutritionTodayProtein) > 20;
          const notStarted = nutritionTodayProtein === null;
          const borderColor = hasGap ? `${C.amber}50` : `${C.emerald}40`;
          const bgColor = hasGap ? C.amberDim : C.emeraldDim;
          const accentColor = hasGap ? C.amber : C.emerald;
          return (
            <button onClick={() => setOsTab("nutrition")} style={{ ...g({ padding: "16px 18px", border: `1px solid ${borderColor}`, cursor: "pointer", textAlign: "left" }), background: bgColor, position: "relative", overflow: "hidden" }}>
              {/* Glow effect */}
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`, pointerEvents: "none" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ fontSize: 22 }}>🥗</div>
                <div style={{ fontSize: 10, padding: "3px 8px", borderRadius: 8, background: accentColor + "20", color: accentColor, border: `1px solid ${accentColor}40`, fontWeight: 700 }}>
                  {notStarted ? "开始记录" : hasGap ? "需要补充" : "已达标 ✓"}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Nutrition</div>
              {notStarted ? (
                <div style={{ fontSize: 11, color: C.textMuted }}>今日尚未记录饮食</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: accentColor, fontWeight: 700, marginBottom: 2 }}>
                    蛋白 {nutritionTodayProtein}g / {proteinTarget}g
                  </div>
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${nutritionPct}%`, background: accentColor, borderRadius: 2 }} />
                  </div>
                  {hasGap && (
                    <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>
                      还差 {proteinTarget - nutritionTodayProtein}g 蛋白 →
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })()}

        {/* Training - coming soon */}
        <div style={g({ padding: "16px 18px", border: `1px solid ${C.border}`, opacity: 0.5 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 20 }}>💪</div>
            <div style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: C.textMuted }}>Coming Soon</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Training</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>运动记录 · 消耗追踪</div>
        </div>

        {/* Recovery - coming soon */}
        <div style={g({ padding: "16px 18px", border: `1px solid ${C.border}`, opacity: 0.5 })}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 20 }}>🌙</div>
            <div style={{ fontSize: 10, padding: "2px 7px", borderRadius: 6, background: "rgba(255,255,255,0.05)", color: C.textMuted }}>Coming Soon</div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Recovery</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>睡眠 · 疲劳 · 恢复</div>
        </div>
      </div>

      {/* AI Analysis modules (collapsed by default) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>AI 分析模块</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
        </div>
      </div>

      {/* Footer */}
      <div style={g({ padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.emerald}18` })}>
        <div style={{ fontSize: 11, color: C.textMuted }}>
          基于 <span style={{ color: C.emerald }}>InBody 实测数据</span> 驱动 · 非公式估算
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 11, color: C.textMuted }}>
          <span>BMR <span style={{ color: C.sky }}>{m.basalMetabolicRate}</span></span>
          <span>SMM <span style={{ color: C.emerald }}>{m.skeletalMuscleMass}</span></span>
          <span>VFL <span style={{ color: vColor }}>{m.visceralFatLevel}</span></span>
        </div>
      </div>

      {/* Check-in Modal */}
      {checkinModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={g({ padding: "28px", maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${C.border}` })}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                  {checkinModal === "morning" ? "晨间" : "晚间"} Check-in
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                  {checkinModal === "morning" ? "☀️ 早上好" : "🌙 今天怎么样"}
                </div>
              </div>
              <button onClick={() => setCheckinModal(null)} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>
            {checkinModal === "morning" ? (
              <MorningCheckin checkin={checkin} onChange={setCheckin} onDone={() => setCheckinModal(null)} />
            ) : (
              <EveningCheckin checkin={checkin} onChange={setCheckin} onDone={() => setCheckinModal(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── OS NAVIGATION BAR ─────────────────────────────────────────
function OsNav({ tabs, active, onTab, onBack }) {
  return (
    <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 24, paddingBottom: 16, borderBottom: `1px solid ${C.border}`, overflowX: "auto" }}>
      {tabs.map(tab => {
        const isActive = active === tab.key;
        const isAvailable = tab.active;
        return (
          <button
            key={tab.key}
            onClick={() => isAvailable && onTab(tab.key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "6px 14px", borderRadius: 20, whiteSpace: "nowrap",
              border: `1px solid ${isActive ? C.emerald + "50" : isAvailable ? C.border : "rgba(255,255,255,0.04)"}`,
              background: isActive ? C.emeraldDim : "transparent",
              color: isActive ? C.emerald : isAvailable ? C.textSub : C.textMuted,
              fontSize: 12, fontWeight: isActive ? 700 : 500,
              cursor: isAvailable ? "pointer" : "not-allowed",
              opacity: isAvailable ? 1 : 0.45,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {!isAvailable && <span style={{ fontSize: 9, opacity: 0.7 }}>Soon</span>}
          </button>
        );
      })}
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
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return INIT;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Always start from welcome on page load for clean UX
        return { ...INIT, ...parsed, step: "welcome" };
      }
    } catch {}
    return INIT;
  });

  // Persist state to localStorage whenever it changes (skip imageFile which can't be serialized)
  useEffect(() => {
    try {
      const toSave = { ...state, imageFile: null };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {}
  }, [state]);

  const update = (key, val) => setState((s) => ({ ...s, [key]: val }));
  const go = (step) => setState((s) => ({ ...s, step }));
  const goBack = () => {
    const steps = ["welcome", "import", "measurements", "profile", "dashboard"];
    const idx = steps.indexOf(state.step);
    if (idx > 0) go(steps[idx - 1]);
  };
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
          <Dashboard state={state} onReset={() => { setState(INIT); localStorage.removeItem(STORAGE_KEY); }} onBack={goBack} />
        )}
      </div>
    </div>
  );
}
