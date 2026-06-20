"use client";

import { C } from "../constants";
import { Bar, GaugeArc, Tag, Bullet } from "./ui";

export function BodyCompResult({ data }: { data: any }) {
  if (!data) return null;
  const rc = (r: string) => r === "high" ? C.amber : r === "low" ? C.rose : C.emerald;
  return (
    <div>
      <p style={{ color: C.textSub, fontSize: 14, lineHeight: 1.7, marginBottom: 14 }}>{data.summary}</p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
        <Tag color={rc(data.analysis?.smmRating)}>骨骼肌 {data.analysis?.smmRating}</Tag>
        <Tag color={rc(data.analysis?.bodyFatRating)}>体脂 {data.analysis?.bodyFatRating}</Tag>
        <Tag color={data.analysis?.visceralRisk === "high" ? C.rose : data.analysis?.visceralRisk === "moderate" ? C.amber : C.emerald}>
          内脏 {data.analysis?.visceralRisk}
        </Tag>
        {data.analysis?.isEdemaRisk && <Tag color={C.amber}>{"⚠ 水肿风险"}</Tag>}
      </div>
      {data.keyFindings?.slice(0, 3).map((f: any, i: number) => (
        <div key={i} style={{
          padding: "10px 14px", borderRadius: 12, marginBottom: 8,
          background: f.priority === "critical" ? C.roseDim : f.priority === "important" ? C.amberDim : C.emeraldDim,
          border: `1px solid ${f.priority === "critical" ? C.rose + "30" : f.priority === "important" ? C.amber + "30" : C.emerald + "30"}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: f.priority === "critical" ? C.rose : f.priority === "important" ? C.amber : C.emerald }}>
            {f.title} · {f.value}
          </div>
          <div style={{ fontSize: 12, color: C.textSub }}>{f.interpretation}</div>
        </div>
      ))}
      {data.actionPriority?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>优先行动</div>
          {data.actionPriority.map((a: string, i: number) => (
            <Bullet key={i} color={[C.rose, C.amber, C.emerald][i] || C.emerald}>{a}</Bullet>
          ))}
        </div>
      )}
      {data.personalizedNote && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 12, background: C.emeraldDim, border: `1px solid ${C.emerald}25` }}>
          <span style={{ fontSize: 12, color: C.emerald }}>{"✦ "}</span>
          <span style={{ fontSize: 13, color: C.textSub }}>{data.personalizedNote}</span>
        </div>
      )}
    </div>
  );
}

export function WorkoutResult({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.6, marginBottom: 12 }}>{data.dataDriverNotes}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        {data.weeklySchedule?.map((d: any, i: number) => (
          <div key={i} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 12px", borderRadius: 10,
            background: d.focus === "休息与恢复" ? "rgba(255,255,255,0.03)" : C.skyDim,
            border: `1px solid ${d.focus === "休息与恢复" ? C.border : C.sky + "25"}`,
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: d.focus === "休息与恢复" ? C.textMuted : C.sky }}>{d.day}</span>
              <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>{d.focus}</span>
            </div>
            {d.durationMinutes > 0 && <Tag color={C.sky}>{d.durationMinutes}min</Tag>}
          </div>
        ))}
      </div>
      {data.progressionLogic && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>4周递进逻辑</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{data.progressionLogic}</div>
        </div>
      )}
    </div>
  );
}

export function NutritionResult({ data }: { data: any }) {
  if (!data) return null;
  const macro = data.macroSplit || {};
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { label: "热量目标", val: data.dailyCalorieTarget, unit: "kcal", color: C.emerald },
          { label: "蛋白质目标", val: data.proteinTargetGrams, unit: "g/天", color: C.sky },
          { label: "BMR来源", val: "实测", unit: "InBody", color: C.amber },
        ].map((item, i) => (
          <div key={i} style={{ padding: "11px", textAlign: "center", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, border: `1px solid ${item.color}20` }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{item.unit}</div>
            <div style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        {(() => {
          const p = macro.protein || 0, c = macro.carbs || 0, f = macro.fat || 0;
          const total = p + c + f;
          const isGrams = total > 110;
          const pPct = isGrams ? Math.round((p * 4 / (p * 4 + c * 4 + f * 9)) * 100) : p;
          const cPct = isGrams ? Math.round((c * 4 / (p * 4 + c * 4 + f * 9)) * 100) : c;
          const fPct = isGrams ? Math.round((f * 9 / (p * 4 + c * 4 + f * 9)) * 100) : f;
          return [
            { label: `蛋白质 ${pPct}%`, val: pPct, color: C.sky },
            { label: `碳水 ${cPct}%`, val: cPct, color: C.emerald },
            { label: `脂肪 ${fPct}%`, val: fPct, color: C.amber },
          ].map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 4 }}>{m.label}</div>
              <Bar value={m.val} max={100} color={m.color} h={6} />
            </div>
          ));
        })()}
      </div>
      {data.weeklyPlan?.slice(0, 3).map((day: any, i: number) => (
        <div key={i} style={{ padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{day.day}</span>
            <Tag color={C.emerald}>{day.totalCalories} kcal</Tag>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            {[day.breakfast, day.lunch, day.dinner].filter(Boolean).map((m: any) => `${m.name}(${m.protein}g蛋白)`).join(" · ")}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, textAlign: "right" }}>
        共7天完整计划 · 基于InBody实测 BMR {data.basalMetabolicRate}kcal
      </div>
    </div>
  );
}

export function HydrationResult({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {[
          { label: "实测体水分", val: `${data.currentTBW}L`, color: C.sky },
          { label: "每日目标", val: `${data.dailyWaterTargetMl}ml`, color: C.sky },
          { label: "ECW/TBW", val: data.currentECWRatio, color: data.isEdemaRisk ? C.amber : C.sky },
        ].map((item, i) => (
          <div key={i} style={{ flex: 1, padding: "12px", textAlign: "center", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", borderRadius: 24, border: `1px solid ${item.color}20` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.val}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {data.isEdemaRisk && data.edemaNote && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: C.amberDim, border: `1px solid ${C.amber}30`, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 4 }}>{"⚠ 水肿风险提示"}</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{data.edemaNote}</div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>饮水时间表（前6项）</div>
        {data.hydrationSchedule?.slice(0, 6).map((h: any, i: number) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.sky, minWidth: 44 }}>{h.time}</span>
            <span style={{ fontSize: 12, color: C.emerald, minWidth: 52 }}>{h.amount}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{h.note}</span>
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>电解质建议</div>
        {data.electrolyteTips?.map((t: string, i: number) => <Bullet key={i} color={C.sky}>{t}</Bullet>)}
      </div>
    </div>
  );
}

export function VisceralResult({ data }: { data: any }) {
  if (!data) return null;
  const rc = ({ low: C.emerald, moderate: C.amber, high: C.rose, critical: C.rose } as any)[data.visceralRiskLevel] || C.emerald;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
        <div style={{ position: "relative" }}>
          <GaugeArc value={data.visceralFatLevel} max={20} color={rc} size={88} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-46%)", textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: rc }}>{data.visceralFatLevel}</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
            <Tag color={rc}>{data.visceralRiskLevel}</Tag>
            {data.metabolicAge && <Tag color={C.sky}>代谢年龄 {data.metabolicAge}岁</Tag>}
          </div>
          <div style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{data.visceralInterpretation}</div>
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.textSub, lineHeight: 1.6, marginBottom: 12 }}>{data.bmrAnalysis}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>干预计划</div>
        {data.interventionPlan?.slice(0, 4).map((p: any, i: number) => (
          <div key={i} style={{ padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: p.category === "diet" ? C.emerald : p.category === "exercise" ? C.sky : C.violet }}>
                {p.category === "diet" ? "饮食" : p.category === "exercise" ? "运动" : "生活"} · {p.action}
              </span>
              <span style={{ fontSize: 11, color: C.textMuted }}>{p.frequency}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{p.expectedEffect}</div>
          </div>
        ))}
      </div>
      {data.medicalNote && (
        <div style={{ padding: "10px 14px", borderRadius: 12, background: C.roseDim, border: `1px solid ${C.rose}30` }}>
          <div style={{ fontSize: 12, color: C.rose, fontWeight: 700, marginBottom: 4 }}>{"🏥 建议就医"}</div>
          <div style={{ fontSize: 12, color: C.textSub }}>{data.medicalNote}</div>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted }}>{data.timelineExpectation}</div>
    </div>
  );
}
