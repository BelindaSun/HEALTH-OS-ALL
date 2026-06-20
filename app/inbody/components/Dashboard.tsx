"use client";

import { useState, useCallback, useEffect } from "react";
import { C, g } from "../constants";
import { AppState, CheckinData } from "../types";
import { callTextAI, parseJSON } from "../lib/ai";
import {
  buildDataBlock,
  promptBodyState,
} from "../lib/prompts";
import { calcBodyState } from "../lib/bodyState";
import { calcComplianceScore } from "../lib/compliance";
import { OsNav } from "./OsNav";
import { BodyStateCard } from "./BodyState";
import { CheckInCard, MorningCheckin, EveningCheckin } from "./CheckIn";
import { ComplianceCard } from "./Compliance";
import { ConsistencyCard } from "./Consistency";
import {
  TodayFocusCard,
  GoalProgressCard,
  DailyReflectionCard,
} from "./GoalProgressAndReflection";
import { NutritionPage } from "./Nutrition";
import { TrainingPage } from "./Training";
import { loadTrainingDay, loadZone } from "../lib/training";
import { WeeklyWinCard } from "./WeeklyWin";
import ReportsPage from "./Reports";
import RecoveryPage from "./Recovery";
import { calcRecoveryScore, getTrainingRec } from "./Recovery";
import PredictionPage from "./Prediction";
import BodyCompPage from "./BodyComp";
import ProfilePage from "./Profile";

const OS_TABS = [
  { key: "dashboard", label: "Dashboard", icon: "⚡", active: true },
  { key: "nutrition", label: "Nutrition", icon: "🥗", active: true },
  { key: "training", label: "Training", icon: "💪", active: true },
  { key: "recovery", label: "Recovery", icon: "🌙", active: true },
  { key: "body", label: "Body Comp", icon: "📊", active: true },
  { key: "reports", label: "Reports", icon: "📈", active: true },
  { key: "prediction", label: "Prediction", icon: "🔮", active: true },
  { key: "profile", label: "我的档案", icon: "👤", active: true },
];


// ── PROGRESS CENTER (collapsible) ────────────────────────────
function ProgressCenter({ m, state }: { m: any; state: any }) {
  const [open, setOpen] = useState(false);

  // Quick summary for collapsed view
  const consistency = (() => {
    try {
      let scored = 0;
      for (let i = 0; i < 14; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const raw = localStorage.getItem(`checkin_${d.toISOString().slice(0, 10)}`);
        if (raw) scored++;
      }
      return scored;
    } catch { return 0; }
  })();

  const goalLabel = ({
    weight_loss: "减脂瘦身", muscle_gain: "增肌塑形",
    recomposition: "体成分重塑", maintain: "维持体形",
  } as any)[state.goal] ?? state.goal;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, marginBottom: 20, border: `1px solid rgba(255,255,255,0.07)`, overflow: "hidden" }}>
      {/* Header - always visible */}
      <button onClick={() => setOpen(v => !v)} style={{
        width: "100%", padding: "16px 20px", background: "transparent", border: "none",
        display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Progress Center</div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
              {goalLabel} · 14天记录 {consistency} 天
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#475569" }}>{open ? "收起 ▲" : "展开 ▼"}</span>
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "4px 0 8px" }}>
          <GoalProgressCard m={m} p={state} />
          <ConsistencyCard />
          <WeeklyWinCard />
        </div>
      )}
    </div>
  );
}

export function Dashboard({
  state,
  onBack,
}: {
  state: AppState;
  onBack: () => void;
}) {
  const m = state.measurements;
  const [osTab, setOsTab] = useState("dashboard");

  // Weekly Coach auto-trigger
  const showWeeklyCoach = (() => {
    try {
      // Need 7+ days of data
      let dataDays = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        if (localStorage.getItem(`checkin_${d.toISOString().slice(0, 10)}`)) dataDays++;
      }
      if (dataDays < 7) return false;
      // Check last generated time
      const lastGen = localStorage.getItem("weekly_coach_last_seen");
      if (!lastGen) return true;
      const daysSince = (Date.now() - parseInt(lastGen)) / (1000 * 60 * 60 * 24);
      return daysSince >= 7;
    } catch { return false; }
  })();
  const [coachDismissed, setCoachDismissed] = useState(false);



  const [bodyStateAI, setBodyStateAI] = useState<any>(null);
  const [bodyStateStatus, setBodyStateStatus] = useState("idle");
  const [bodyStateError, setBodyStateError] = useState<string | null>(null);

  const [checkinModal, setCheckinModal] = useState<
    "morning" | "evening" | null
  >(null);
  const todayKey = `checkin_${new Date().toISOString().slice(0, 10)}`;
  const [checkin, setCheckinRaw] = useState<CheckinData>(() => {
    try {
      const s = localStorage.getItem(todayKey);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });
  const setCheckin = (val: CheckinData) => {
    setCheckinRaw(val);
    try {
      localStorage.setItem(todayKey, JSON.stringify(val));
    } catch {}
  };

  // Re-read checkin when returning to dashboard (Nutrition writes proteinPct directly)
  useEffect(() => {
    try {
      const s = localStorage.getItem(todayKey);
      if (s) setCheckinRaw(JSON.parse(s));
    } catch {}
  }, [osTab, todayKey]);

  const localScore = calcBodyState(m, state, checkin);
  const aiCfg = {
    provider: state.provider,
    apiKey: state.apiKey,
    modelName: state.modelName,
  };

  // Nutrition protein quick stats
  const nutritionKey = `nutrition_${new Date().toISOString().slice(0, 10)}`;
  const nutritionTodayProtein = (() => {
    try {
      const raw = localStorage.getItem(nutritionKey);
      if (!raw) return null;
      const meals = JSON.parse(raw);
      return Object.values(meals)
        .flatMap((meal: any) => meal?.items || [])
        .reduce((s: number, it: any) => s + (it.protein || 0), 0);
    } catch {
      return null;
    }
  })();
  const { proteinG: proteinTarget, tdee } = buildDataBlock(m, state);
  const nutritionPct =
    nutritionTodayProtein !== null
      ? Math.min(100, Math.round((nutritionTodayProtein / proteinTarget) * 100))
      : null;

  // Training quick stats
  const trainingToday = loadTrainingDay();
  const trainingZone = loadZone(trainingToday.totalLoad);

  // Recovery score for today (used for Training card signal + Recovery tab)
  const todayRecoveryScore: number | null = (() => {
    if (!checkin?.morning) return null;
    return calcRecoveryScore(checkin.morning);
  })();
  const recoveryDebt: number = (() => {
    try {
      let debt = 0; let tw = 0;
      const weights = [2.0, 1.7, 1.4, 1.2, 1.0, 0.85, 0.7];
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const raw = localStorage.getItem(`checkin_${d.toISOString().slice(0, 10)}`);
        if (!raw) continue;
        const ci = JSON.parse(raw);
        const s = ci.morning ? calcRecoveryScore(ci.morning) : null;
        if (s === null) continue;
        debt += Math.max(0, 60 - s) * weights[i]; tw += weights[i];
      }
      return tw > 0 ? Math.min(100, Math.round(debt / tw)) : 0;
    } catch { return 0; }
  })();
  const recovRec = todayRecoveryScore !== null ? getTrainingRec(todayRecoveryScore, recoveryDebt) : null;





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
      setBodyStateAI(parseJSON(raw));
      setBodyStateStatus("success");
    } catch (err: any) {
      setBodyStateError(err.message);
      setBodyStateStatus("error");
    }
  };

  if (!m) return null;

  const vColor =
    m.visceralFatLevel >= 10
      ? C.rose
      : m.visceralFatLevel >= 5
        ? C.amber
        : C.emerald;

  // Nutrition tab
  if (osTab === "nutrition") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <NutritionPage state={state} onBack={() => setOsTab("dashboard")} />
      </div>
    );
  }

  // Training tab
  if (osTab === "training") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <TrainingPage onBack={() => setOsTab("dashboard")} recoveryScore={todayRecoveryScore} recoveryDebt={recoveryDebt} />
      </div>
    );
  }

  // Recovery tab
  if (osTab === "recovery") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <RecoveryPage />
      </div>
    );
  }

  // Reports tab
  if (osTab === "reports") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <ReportsPage />
      </div>
    );
  }

  // Prediction tab
  if (osTab === "prediction") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <PredictionPage state={state} />
      </div>
    );
  }

  // Body Comp tab
  if (osTab === "body") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <BodyCompPage state={state} />
      </div>
    );
  }

  // Profile tab
  if (osTab === "profile") {
    return (
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}@media print{nav,.no-print{display:none!important}}`}</style>
        <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />
        <ProfilePage state={state} onClose={() => setOsTab("dashboard")} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes slide{0%{width:0%;margin-left:0}50%{width:55%;margin-left:20%}100%{width:0%;margin-left:100%}}
        @keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @media print{nav,.no-print{display:none!important}body{background:#fff!important;color:#000!important}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      `}</style>

      <OsNav tabs={OS_TABS} active={osTab} onTab={setOsTab} />

      {/* Weekly Coach banner */}
      {showWeeklyCoach && !coachDismissed && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: 16, marginBottom: 16,
          background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(16,185,129,0.1))",
          border: `1px solid ${C.violet}40`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📬</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>本周教练信已就绪</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>查看你这周的身体变化总结和下周建议</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => {
              localStorage.setItem("weekly_coach_last_seen", Date.now().toString());
              setOsTab("reports");
              setCoachDismissed(true);
            }} style={{
              padding: "6px 14px", borderRadius: 20, border: "none",
              background: C.violet, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}>
              阅读 →
            </button>
            <button onClick={() => {
              localStorage.setItem("weekly_coach_last_seen", Date.now().toString());
              setCoachDismissed(true);
            }} style={{
              padding: "6px 10px", borderRadius: 20, border: `1px solid ${C.border}`,
              background: "transparent", color: C.textMuted, fontSize: 12, cursor: "pointer",
            }}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: C.emerald,
              marginBottom: 6,
              textTransform: "uppercase",
            }}
          >
            InBody OS · Dashboard
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: C.text,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            今日状态
          </h1>
          <div style={{ color: C.textMuted, fontSize: 13, marginTop: 4 }}>
            {state.age}岁 · {state.gender === "male" ? "男" : "女"} ·{" "}
            {(
              {
                muscle_gain: "增肌塑形",
                weight_loss: "减脂瘦身",
                recomposition: "体成分重塑",
                maintain: "维持体形",
              } as any
            )[state.goal] || state.goal}
          </div>
        </div>
        <div className="no-print" style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: "7px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.03)",
              color: C.textMuted,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            导出 PDF
          </button>
          <button
            onClick={onBack}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "rgba(255,255,255,0.03)",
              color: C.textSub,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {"<-"} 上一步
          </button>
        </div>
      </div>

      {/* Dashboard narrative chain */}
      <BodyStateCard
        state={state}
        localScore={localScore}
        aiScore={bodyStateAI}
        aiStatus={bodyStateStatus}
        aiError={bodyStateError}
        onGenerate={generateBodyStateAI}
      />
      <CheckInCard checkin={checkin} onOpen={setCheckinModal} />
      <ComplianceCard checkin={checkin} />
      <TodayFocusCard
        m={m}
        p={state}
        checkin={checkin}
        nutritionProtein={nutritionTodayProtein}
        proteinTarget={proteinTarget}
        onGoNutrition={() => setOsTab("nutrition")}
      />
      <ProgressCenter m={m} state={state} />
      <DailyReflectionCard
        checkin={checkin}
        todayCompliance={(() => {
          const r = calcComplianceScore(checkin);
          return r ? r.total : 0;
        })()}
        aiCfg={aiCfg}
        nutritionProtein={nutritionTodayProtein}
        proteinTarget={proteinTarget}
      />

      {/* Module entry cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {/* Nutrition entry */}
        {(() => {
          const hasGap =
            nutritionTodayProtein !== null &&
            proteinTarget - nutritionTodayProtein > 20;
          const notStarted = nutritionTodayProtein === null;
          const accentColor = hasGap ? C.amber : C.emerald;
          return (
            <button
              onClick={() => setOsTab("nutrition")}
              style={{
                ...g({
                  padding: "16px 18px",
                  border: `1px solid ${hasGap ? C.amber + "50" : C.emerald + "40"}`,
                  cursor: "pointer",
                  textAlign: "left",
                }),
                background: hasGap ? C.amberDim : C.emeraldDim,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 22 }}>🥗</div>
                <div
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 8,
                    background: accentColor + "20",
                    color: accentColor,
                    border: `1px solid ${accentColor}40`,
                    fontWeight: 700,
                  }}
                >
                  {notStarted ? "开始记录" : hasGap ? "需要补充" : "已达标 ✓"}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Nutrition
              </div>
              {notStarted ? (
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  今日尚未记录饮食
                </div>
              ) : (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      color: accentColor,
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    蛋白 {nutritionTodayProtein}g / {proteinTarget}g
                  </div>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: "rgba(255,255,255,0.08)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${nutritionPct}%`,
                        background: accentColor,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  {hasGap && (
                    <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>
                      还差 {proteinTarget - nutritionTodayProtein!}g 蛋白
                    </div>
                  )}
                </>
              )}
            </button>
          );
        })()}

        {/* Training entry - live */}
        {(() => {
          const hasTraining = trainingToday.sessions.length > 0;
          const accentColor = trainingZone.color;
          return (
            <button
              onClick={() => setOsTab("training")}
              style={{
                ...g({
                  padding: "16px 18px",
                  border: `1px solid ${accentColor}40`,
                  cursor: "pointer",
                  textAlign: "left",
                }),
                background: accentColor + "10",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${accentColor}15, transparent 70%)`,
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <div style={{ fontSize: 22 }}>💪</div>
                <div
                  style={{
                    fontSize: 10,
                    padding: "3px 8px",
                    borderRadius: 8,
                    background: accentColor + "20",
                    color: accentColor,
                    border: `1px solid ${accentColor}40`,
                    fontWeight: 700,
                  }}
                >
                  {hasTraining ? trainingZone.label : "去记录"}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                Training
              </div>
              {hasTraining ? (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      color: accentColor,
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    Load {trainingToday.totalLoad} ·{" "}
                    {trainingToday.totalDuration}min
                  </div>
                  <div style={{ fontSize: 10, color: C.textMuted }}>
                    {trainingToday.sessions.length} 组训练 · {trainingZone.desc}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, color: C.textMuted }}>
                  今日尚未记录训练
                </div>
              )}
            </button>
          );
        })()}

        {/* Recovery card - live */}
        <button
          onClick={() => setOsTab("recovery")}
          style={{
            ...g({ padding: "16px 18px", border: `1px solid ${recovRec ? recovRec.color + "40" : C.border}` }),
            cursor: "pointer", textAlign: "left", width: "100%",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ fontSize: 20 }}>🌙</div>
            <div style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 8, fontWeight: 700,
              background: recovRec ? recovRec.color + "20" : "rgba(255,255,255,0.05)",
              color: recovRec ? recovRec.color : C.textMuted,
              border: `1px solid ${recovRec ? recovRec.color + "40" : "transparent"}`,
            }}>
              {todayRecoveryScore !== null ? `${todayRecoveryScore}分` : "未记录"}
            </div>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Recovery
          </div>
          {recovRec ? (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: recovRec.color, marginBottom: 2 }}>
                {recovRec.icon} {recovRec.label}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted }}>恢复债 {recoveryDebt} · 点击查看详情</div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: C.textMuted }}>完成晨间 Check-in 后查看</div>
          )}
        </button>
      </div>



      {/* Footer */}
      <div
        style={g({
          padding: "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: `1px solid ${C.emerald}18`,
        })}
      >
        <div style={{ fontSize: 11, color: C.textMuted }}>
          基于 <span style={{ color: C.emerald }}>InBody 实测数据</span> 驱动 ·
          非公式估算
        </div>
        <div
          style={{ display: "flex", gap: 10, fontSize: 11, color: C.textMuted }}
        >
          <span>
            BMR <span style={{ color: C.sky }}>{m.basalMetabolicRate}</span>
          </span>
          <span>
            SMM <span style={{ color: C.emerald }}>{m.skeletalMuscleMass}</span>
          </span>
          <span>
            VFL <span style={{ color: vColor }}>{m.visceralFatLevel}</span>
          </span>
        </div>
      </div>

      {/* Check-in Modal */}
      {checkinModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={g({
              padding: "28px",
              maxWidth: 480,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              border: `1px solid ${C.border}`,
            })}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 22,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: C.textMuted,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    marginBottom: 4,
                  }}
                >
                  {checkinModal === "morning" ? "晨间" : "晚间"} Check-in
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>
                  {checkinModal === "morning" ? "☀️ 早上好" : "🌙 今天怎么样"}
                </div>
              </div>
              <button
                onClick={() => setCheckinModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: C.textMuted,
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>
            {checkinModal === "morning" ? (
              <MorningCheckin
                checkin={checkin}
                onChange={setCheckin}
                onDone={() => setCheckinModal(null)}
              />
            ) : (
              <EveningCheckin
                checkin={checkin}
                onChange={setCheckin}
                onDone={() => setCheckinModal(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
