"use client";

import { C } from "../constants";
import { CheckinData } from "../types";
import { calcComplianceScore } from "../lib/compliance";

function Ring({ value, color, size = 48 }: { value: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  );
}

export function ComplianceCard({ checkin }: { checkin: CheckinData }) {
  const result = calcComplianceScore(checkin);
  if (!result) return null;
  const { total, dims, level } = result;

  const yesterdayKey = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `checkin_${d.toISOString().slice(0, 10)}`; })();
  const yesterdayTotal = (() => {
    try {
      const raw = localStorage.getItem(yesterdayKey);
      if (!raw) return null;
      const yr = calcComplianceScore(JSON.parse(raw));
      return yr ? yr.total : null;
    } catch { return null; }
  })();
  const trend = yesterdayTotal !== null ? total - yesterdayTotal : null;
  const trendUp = trend !== null && trend > 0;
  const trendFlat = trend !== null && trend === 0;

  return (
    <div style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(20px)", border: `1px solid ${C.border}`, borderRadius: 24, padding: "20px 24px", marginBottom: 16 }}>
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
            {trendFlat && <div style={{ fontSize: 13, color: C.textMuted }}>-</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
            <div style={{ fontSize: 11, color: level.color, padding: "2px 8px", background: level.bg, borderRadius: 20 }}>{level.label}</div>
            {yesterdayTotal !== null && <div style={{ fontSize: 10, color: C.textMuted }}>昨天 {yesterdayTotal}</div>}
          </div>
        </div>
      </div>

      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${total}%`, background: `linear-gradient(90deg, ${level.color}80, ${level.color})`, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>

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
