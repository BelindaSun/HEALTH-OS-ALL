"use client";

import { C } from "../constants";
import { calcConsistency } from "../lib/compliance";

export function ConsistencyCard() {
  const c = calcConsistency();
  const { streak, rate, avg, grade, gradeColor, gradeDesc, heatmap, isNewUser, scored } = c;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "20px 24px", marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Consistency Engine</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>执行一致性</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: gradeColor + "18", border: `2px solid ${gradeColor}40`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: gradeColor }}>{grade}</span>
          </div>
          <div style={{ fontSize: 9, color: gradeColor }}>{gradeDesc}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { val: `${streak >= 1 ? "🔥" : ""}${streak}`, label: "连续天数", color: streak >= 7 ? C.amber : C.text },
          { val: `${rate}%`, label: "30天执行率", color: gradeColor },
          { val: avg || "-", label: "平均执行分", color: C.sky },
        ].map((item, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px", border: `1px solid rgba(255,255,255,0.05)`, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: item.color, lineHeight: 1, marginBottom: 3 }}>{item.val}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{item.label}</div>
          </div>
        ))}
      </div>

      {isNewUser && (
        <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(14,165,233,0.08)", border: `1px solid rgba(14,165,233,0.2)`, fontSize: 11, color: C.sky }}>
          📊 数据积累中（{scored.length}/7天）- 等级基于当前平均执行分，7天后切换完整算法
        </div>
      )}

      <div>
        <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 6 }}>过去14天</div>
        <div style={{ display: "flex", gap: 4 }}>
          {heatmap.map((val, i) => {
            const color = val === null ? "rgba(255,255,255,0.05)"
              : val >= 85 ? C.emerald
              : val >= 70 ? C.sky
              : val >= 55 ? C.amber
              : C.rose;
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
            <span>低</span><span>中</span><span>良</span><span>优</span>
          </span>
          <span>今天</span>
        </div>
      </div>
    </div>
  );
}
