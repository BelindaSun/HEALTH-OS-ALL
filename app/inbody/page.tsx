"use client";

import { useState, useEffect } from "react";
import { C, STORAGE_KEY } from "./constants";
import { AppState } from "./types";
import { Dashboard } from "./components/Dashboard";
import { StepImport, StepMeasurements, StepGoal } from "./components/Steps";

// ── INITIAL STATE ─────────────────────────────────────────────
const INIT: AppState = {
  step: "welcome",
  imageFile: null,
  imageBase64: null,
  preview: null,
  parseSuccess: false,
  parsedFields: 0,
  visionProvider: "qwen",
  visionApiKey: "",
  visionModel: "",
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
  age: 0,
  gender: "male",
  heightCm: 0,
  goal: "weight_loss",
  healthGoal: "fat_loss", // default: 减脂优先 (paired)
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
};

// ── ROOT ──────────────────────────────────────────────────────
export default function InBodyOS() {
<<<<<<< HEAD
  const [state, setState] = useState(() => {
    if (typeof window === "undefined") return INIT;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Always start from welcome on page load for clean UX
        return { ...INIT, ...parsed, step: "welcome" };
      }
=======
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === "undefined") return INIT;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...INIT, ...JSON.parse(saved), step: "welcome" };
>>>>>>> 9c968ca (Personal Body OS - Alpha ready)
    } catch {}
    return INIT;
  });

<<<<<<< HEAD
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
=======
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...state, imageFile: null }),
      );
    } catch {}
  }, [state]);

  const update = (key: string, val: any) =>
    setState((s) => ({ ...s, [key]: val }));
  const go = (step: AppState["step"]) => setState((s) => ({ ...s, step }));
  const goBack = () => {
    const steps: AppState["step"][] = [
      "welcome",
      "profile",
      "import",
      "measurements",
      "dashboard",
    ];
    const idx = steps.indexOf(state.step);
    if (idx > 0) go(steps[idx - 1]);
  };

  const emerald = C.emerald;
  const features = [
    { icon: "📱", title: "截图即可", sub: "手机拍照直接上传" },
    { icon: "📊", title: "实测BMR驱动", sub: "非公式估算，精准到位" },
    { icon: "🌍", title: "国内直连", sub: "Qwen-VL 无需 VPN" },
  ];

>>>>>>> 9c968ca (Personal Body OS - Alpha ready)
  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(ellipse 80% 50% at 50% -5%, rgba(16,185,129,.07) 0%, transparent 55%),
                   radial-gradient(ellipse 50% 40% at 85% 85%, rgba(14,165,233,.05) 0%, transparent 50%), ${C.bg}`,
        color: C.text,
        fontFamily: "'DM Sans','PingFang SC','Helvetica Neue',sans-serif",
        padding: "0 clamp(12px, 4vw, 20px) 60px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:rgba(100,116,139,.4)}
        button{font-family:inherit;-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:99px}
        @media(max-width:600px){
          .mobile-grid-1{grid-template-columns:1fr!important}
          .mobile-text-sm{font-size:36px!important}
          .mobile-pad{padding:0 16px 40px!important}
          .mobile-top{padding-top:20px!important}
        }
      `}</style>

      {/* Top nav */}
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
              background: `linear-gradient(135deg,${emerald},#059669)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <span style={{ fontWeight: 800, fontSize: 16, color: C.text }}>
            Personal Body
          </span>
          <span style={{ fontWeight: 400, fontSize: 16, color: C.textMuted }}>
            OS
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 7px",
              borderRadius: 5,
              background: "rgba(16,185,129,0.12)",
              color: emerald,
              border: `1px solid ${emerald}25`,
              letterSpacing: "0.08em",
            }}
          >
            PRO
          </span>
        </div>
        {["profile", "import", "measurements"].includes(state.step) && (
          <div style={{ display: "flex", gap: 5 }}>
            {["profile", "import", "measurements"].map((s, i) => (
              <div
                key={s}
                style={{
                  width: 26,
                  height: 3,
                  borderRadius: 99,
                  background:
                    ["profile", "import", "measurements"].indexOf(state.step) >= i
                      ? emerald
                      : "rgba(255,255,255,.09)",
                  transition: "background .3s",
                }}
              />
            ))}
          </div>
        )}

      </nav>

      <div style={{ maxWidth: 920, margin: "0 auto", paddingTop: 40 }}>
        {state.step === "welcome" && (
          <div
            style={{
              maxWidth: 560,
              margin: "clamp(20px, 5vw, 60px) auto 0",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.22em",
                color: emerald,
                marginBottom: 14,
                textTransform: "uppercase",
              }}
            >
              专业体成分分析系统
            </div>
            <h1
              style={{
                fontSize: "clamp(36px, 8vw, 56px)",
                fontWeight: 800,
                color: C.text,
                lineHeight: 1.05,
                marginBottom: 18,
              }}
            >
              Personal Body OS
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
              拍照上传 InBody 报告，AI 自动识别全部数值，生成专业级训练 · 营养 ·
              水分 · 代谢方案。
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 12,
                marginBottom: 44,
              }}
            >
              {features.map((f, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(15,23,42,0.85)",
                    backdropFilter: "blur(20px)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 24,
                    padding: "18px 16px",
                    textAlign: "center",
                  }}
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
              onClick={() => go("profile")}
              style={{
                padding: "16px 48px",
                borderRadius: 14,
                border: "none",
                background: `linear-gradient(135deg,${emerald},#059669)`,
                color: "#fff",
                fontSize: 17,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 16px 48px rgba(16,185,129,.22)",
                WebkitAppearance: "none",
                touchAction: "manipulation",
                minHeight: 52,
                width: "100%",
                maxWidth: 320,
              }}
            >
              开始分析 →
            </button>
          </div>
        )}

        {state.step === "profile" && (
          <StepGoal
            onSelect={(goal, healthGoal) => {
              update("goal", goal);
              update("healthGoal", healthGoal);
              go("import");
            }}
            onBack={() => go("welcome")}
          />
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
            onNext={() => go("dashboard")}
            onBack={() => go("import")}
          />
        )}
        {state.step === "dashboard" && (
<<<<<<< HEAD
          <Dashboard state={state} onReset={() => { setState(INIT); localStorage.removeItem(STORAGE_KEY); }} onBack={goBack} />
=======
          <Dashboard state={state} onBack={goBack} />
>>>>>>> 9c968ca (Personal Body OS - Alpha ready)
        )}
      </div>
    </div>
  );
}
