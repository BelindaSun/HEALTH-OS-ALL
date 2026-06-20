"use client";

import { C } from "../constants";
import { LocalBodyScore } from "../types";
import { GaugeArc, Bar } from "./ui";

export function BodyStateCard({ state, localScore, aiScore, aiStatus, aiError, onGenerate }: {
  state: any;
  localScore: LocalBodyScore | null;
  aiScore: any;
  aiStatus: string;
  aiError: string | null;
  onGenerate: () => void;
}) {
  const score = aiScore || localScore;
  if (!score) return null;
  const isAI = !!aiScore;
  const scoreColor = score.total >= 80 ? C.emerald : score.total >= 60 ? C.sky : score.total >= 40 ? C.amber : C.rose;

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

  const aiStateColor = isAI
    ? score.stateColor === "emerald" ? C.emerald
    : score.stateColor === "amber" ? C.amber
    : score.stateColor === "rose" ? C.rose
    : C.sky
    : score.stateColor;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, padding: "24px", marginBottom: 20, border: `1px solid ${scoreColor}25`, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `radial-gradient(circle, ${scoreColor}08 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            基础身体状态 · Baseline Body State {isAI && <span style={{ color: C.violet, marginLeft: 6 }}>· AI 精准模式</span>}
          </div>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, opacity: 0.6 }}>基于 InBody 慢变量 · 非今日实时状态</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 90, height: 90 }}>
              <GaugeArc value={score.total} max={100} color={scoreColor} size={90} />
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score.total}</div>
                <div style={{ fontSize: 9, color: C.textMuted }}>
                  {score.total >= 80 ? "优秀" : score.total >= 65 ? "良好" : score.total >= 50 ? "一般" : "待改善"}
                </div>
              </div>
              {/* Score anchor below gauge */}
            </div>
            <div>
              {/* Score reference */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { label: "50 一般", color: C.amber },
                  { label: "65 良好", color: C.sky },
                  { label: "80 优秀", color: C.emerald },
                ].map((ref, i) => (
                  <span key={i} style={{ fontSize: 9, color: ref.color, opacity: 0.7 }}>{ref.label}</span>
                ))}
              </div>
              <div style={{ fontSize: 22, marginBottom: 4 }}>
                {isAI ? score.stateEmoji : score.stateIcon}
                <span style={{ fontSize: 18, fontWeight: 700, color: aiStateColor, marginLeft: 8 }}>
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
            <button onClick={onGenerate} style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>重新生成</button>
          )}
          {aiStatus === "error" && (
            <button onClick={onGenerate} style={{ padding: "5px 12px", borderRadius: 14, border: `1px solid ${C.rose}40`, background: C.roseDim, color: C.rose, fontSize: 11, cursor: "pointer" }}>重试</button>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 18 }}>
        {dims.map((d, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: d.color, marginBottom: 4 }}>{d.val}</div>
            <Bar value={d.val} max={100} color={d.color} h={4} />
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {isAI && score.aiInsight && (
        <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: C.violetDim, border: `1px solid ${C.violet}20` }}>
          <div style={{ fontSize: 10, color: C.violet, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI 深度洞察</div>
          <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.7 }}>{score.aiInsight}</div>
          {score.actionPlan?.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {score.actionPlan.map((a: string, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: [C.rose, C.amber, C.emerald][i] || C.emerald, flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{a}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!score.hasCheckinData && !isAI && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 18 }}>☀️</div>
          <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>完成今日晨间 Check-in 后，评分将加入睡眠、疲劳、压力等快变量，建议更准确</div>
        </div>
      )}

      {aiStatus === "error" && <div style={{ marginTop: 10, fontSize: 12, color: C.rose }}>{"⚠ "}{aiError}</div>}
    </div>
  );
}
