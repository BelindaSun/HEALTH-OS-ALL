"use client";

import { C, g } from "../../constants";

// ── BAR ──────────────────────────────────────────────────────
export function Bar({ value, max, color, h = 5 }: { value: number; max: number; color: string; h?: number }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: h, overflow: "hidden" }}>
      <div style={{
        width: `${Math.min((value / max) * 100, 100)}%`,
        height: "100%",
        background: color,
        boxShadow: `0 0 8px ${color}50`,
        borderRadius: 99,
        transition: "width 1.2s cubic-bezier(.4,0,.2,1)",
      }} />
    </div>
  );
}

// ── GAUGE ARC ─────────────────────────────────────────────────
export function GaugeArc({ value, max, color, size = 90 }: { value: number; max: number; color: string; size?: number }) {
  const r = 38, cx = 50, cy = 50;
  const toR = (d: number) => (d * Math.PI) / 180;
  const start = -210, sweep = 240;
  const end = start + sweep * Math.min(value / max, 1);
  const arc = (a1: number, a2: number) => {
    const s = { x: cx + r * Math.cos(toR(a1)), y: cy + r * Math.sin(toR(a1)) };
    const e = { x: cx + r * Math.cos(toR(a2)), y: cy + r * Math.sin(toR(a2)) };
    return `M${s.x} ${s.y} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
  };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <path d={arc(start, start + sweep)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round" />
      <path d={arc(start, end)} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 5px ${color}90)` }} />
    </svg>
  );
}

// ── TAG ───────────────────────────────────────────────────────
export function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 6,
      background: `${color}18`, color,
      border: `1px solid ${color}30`, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

// ── BULLET ────────────────────────────────────────────────────
export function Bullet({ children, color = C.emerald }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 5 }} />
      <span style={{ fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// ── NUM FIELD ─────────────────────────────────────────────────
export function NumField({
  label, value, onChange, unit, hint = "", color = C.text, step = "0.01",
}: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; hint?: string; color?: string; step?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <label style={{ fontSize: 12, color: C.textSub }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: C.textMuted }}>{hint}</span>}
      </div>
      <div style={{ position: "relative" }}>
        <input
          type="number" step={step} value={value || ""} placeholder="0"
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          style={{
            width: "100%", padding: "11px 44px 11px 14px",
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${value > 0 ? `${C.emerald}50` : C.border}`,
            borderRadius: 10, color, fontSize: 15, fontWeight: 600,
            outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border .2s",
          }}
        />
        {unit && (
          <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted, fontSize: 12 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

// ── MODULE CARD ───────────────────────────────────────────────
export function ModuleCard({
  title, icon, color, dim, status, error, onGenerate, children,
}: {
  title: string; icon: string; color: string; dim: string;
  status: string; error?: string | null; onGenerate: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={g({ border: `1px solid ${status === "success" ? `${color}25` : C.border}`, overflow: "hidden", transition: "border-color .3s" })}>
      <div style={{ padding: "18px 22px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: dim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>
            {icon}
          </div>
          <span style={{ color: C.text, fontWeight: 700, fontSize: 15 }}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {status === "loading" && <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, animation: "blink 1s ease infinite" }} />}
          {status === "success" && <Tag color={color}>{"✓ 已生成"}</Tag>}
          {status === "success" && (
            <button onClick={onGenerate} style={{ padding: "4px 10px", borderRadius: 14, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
              重新生成
            </button>
          )}
          {(status === "idle" || status === "error") && (
            <button onClick={onGenerate} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${color}40`, background: dim, color, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {status === "error" ? "重试" : "生成"}
            </button>
          )}
        </div>
      </div>
      <div style={{ padding: "18px 22px" }}>
        {status === "idle" && <div style={{ textAlign: "center", padding: "22px 0", color: C.textMuted, fontSize: 13 }}>点击「生成」获取 AI 专业分析</div>}
        {status === "loading" && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div style={{ color, fontSize: 13, marginBottom: 10 }}>AI 分析中，请稍候...</div>
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: color, animation: "slide 1.6s ease infinite", borderRadius: 4 }} />
            </div>
          </div>
        )}
        {status === "error" && <div style={{ color: C.rose, fontSize: 13, padding: "12px 0" }}>{"⚠ "}{error || "生成失败，请检查 API Key 后重试"}</div>}
        {status === "success" && children}
      </div>
    </div>
  );
}
