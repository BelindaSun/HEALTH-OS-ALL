"use client";

import React, { useState, useEffect } from "react";
import { C, g, STORAGE_KEY } from "../constants";
import { AppState } from "../types";
import { TEXT_PROVIDERS } from "../constants";

// ─── Types ────────────────────────────────────────────────────────────────────

type SettingsSection = "ai" | "goals" | "profile" | "data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadState(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function savePartial(partial: Partial<AppState>) {
  try {
    const current = loadState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {}
}

// ─── Section Tab ──────────────────────────────────────────────────────────────

function SectionTab({ id, label, icon, active, onClick }: {
  id: SettingsSection; label: string; icon: string;
  active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 16px", borderRadius: 12, cursor: "pointer",
      border: `1px solid ${active ? C.emerald + "40" : "transparent"}`,
      background: active ? C.emeraldDim : "rgba(255,255,255,0.03)",
      color: active ? C.emerald : C.textMuted,
      fontSize: 13, fontWeight: active ? 700 : 500,
      width: "100%", textAlign: "left",
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// ─── Save Toast ───────────────────────────────────────────────────────────────

function SaveToast({ show }: { show: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: `translateX(-50%) translateY(${show ? 0 : 80}px)`,
      transition: "transform 0.3s ease",
      padding: "10px 20px", borderRadius: 20,
      background: C.emerald, color: "#020817",
      fontSize: 13, fontWeight: 700,
      boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
      zIndex: 100, pointerEvents: "none",
    }}>
      ✓ 已保存，刷新页面后生效
    </div>
  );
}

// ─── Section: AI Config ───────────────────────────────────────────────────────

function AISection({ saved, onSave }: {
  saved: Partial<AppState>;
  onSave: (partial: Partial<AppState>) => void;
}) {
  const [provider, setProvider] = useState(saved.provider ?? "qwen");
  const [apiKey, setApiKey] = useState(saved.apiKey ?? "");
  const [modelName, setModelName] = useState(saved.modelName ?? "");
  const [showKey, setShowKey] = useState(false);

  const selectedProvider = TEXT_PROVIDERS.find(p => p.id === provider);

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10, outline: "none",
    border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
    color: C.text, fontSize: 13, fontFamily: "inherit",
    boxSizing: "border-box" as const,
  };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>AI 配置</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        用于 AI 分析的模型服务。修改后刷新页面生效。
      </div>

      {/* Provider */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          服务商
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TEXT_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setProvider(p.id); setModelName(""); }}
              style={{
                padding: "8px 16px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${provider === p.id ? C.emerald + "50" : C.border}`,
                background: provider === p.id ? C.emeraldDim : "transparent",
                color: provider === p.id ? C.emerald : C.textSub,
                fontSize: 12, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}>
              <span>{p.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
                {p.tag}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* API Key */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          API Key
        </div>
        <div style={{ position: "relative" }}>
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={`输入 ${selectedProvider?.label ?? provider} API Key`}
            style={{ ...inputStyle, paddingRight: 80 }}
          />
          <button onClick={() => setShowKey(v => !v)} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`,
            background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer",
          }}>
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
        {apiKey && (
          <div style={{ fontSize: 11, color: C.emerald, marginTop: 4 }}>
            ✓ 已输入 {apiKey.length} 位
          </div>
        )}
      </div>

      {/* Model name */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          模型名称（可选）
        </div>
        <input
          type="text"
          value={modelName}
          onChange={e => setModelName(e.target.value)}
          placeholder={
            provider === "qwen" ? "qwen-plus / qwen-turbo / qwen-max" :
            provider === "deepseek" ? "deepseek-chat" :
            provider === "openai" ? "gpt-4o / gpt-4o-mini" :
            provider === "claude" ? "claude-sonnet-4-6" :
            provider === "ollama" ? "qwen2.5:3b" : "留空使用默认"
          }
          style={inputStyle}
        />
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>
          留空则使用各服务商默认模型
        </div>
      </div>

      <button onClick={() => onSave({ provider, apiKey, modelName })} style={{
        padding: "10px 28px", borderRadius: 12, border: "none",
        background: `linear-gradient(135deg,${C.emerald},#059669)`,
        color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
        保存 AI 配置
      </button>
    </div>
  );
}

// ─── Section: Health Goal ─────────────────────────────────────────────────────

function GoalsSection({ saved, onSave }: {
  saved: Partial<AppState>;
  onSave: (partial: Partial<AppState>) => void;
}) {
  const [goal, setGoal] = useState(saved.goal ?? "weight_loss");
  const [healthGoal, setHealthGoal] = useState(saved.healthGoal ?? "fat_loss");

  const GOALS = [
    { v: "muscle_gain", l: "增肌塑形", desc: "增加肌肉量为主" },
    { v: "weight_loss", l: "减脂瘦身", desc: "降低体脂为主" },
    { v: "recomposition", l: "体成分重塑", desc: "减脂同时增肌" },
    { v: "maintain", l: "维持体形", desc: "保持当前状态" },
  ];

  const HEALTH_GOALS = [
    { v: "fat_loss",       l: "减脂模式",   focuses: ["蛋白质摄入", "训练频率", "热量控制"] },
    { v: "muscle_gain",    l: "增肌模式",   focuses: ["训练强度", "蛋白质摄入", "睡眠质量"] },
    { v: "fitness",        l: "提升体能",   focuses: ["训练频率", "睡眠质量", "整体均衡"] },
    { v: "sleep_recovery", l: "改善睡眠",   focuses: ["睡眠时长", "饮水习惯", "压力管理"] },
  ];

  const optStyle = (selected: boolean, color = C.emerald) => ({
    padding: "10px 16px", borderRadius: 14, cursor: "pointer",
    border: `1px solid ${selected ? color + "50" : C.border}`,
    background: selected ? color + "12" : "rgba(255,255,255,0.03)",
    textAlign: "left" as const, width: "100%",
  });

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>目标设置</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        主要目标影响 Goal Progress 和 AI 建议，健康优先级影响 Compliance Score 权重。
      </div>

      {/* Main goal */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          主要目标
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GOALS.map(o => (
            <button key={o.v} onClick={() => setGoal(o.v as any)} style={optStyle(goal === o.v)}>
              <div style={{ fontSize: 13, fontWeight: 700, color: goal === o.v ? C.emerald : C.text, marginBottom: 2 }}>
                {o.l}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Health goal */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          健康优先级
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, opacity: 0.7 }}>
          决定执行率各维度的权重比例
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(HEALTH_GOALS as any[]).map(o => (
            <button key={o.v} onClick={() => setHealthGoal(o.v as any)} style={optStyle(healthGoal === o.v, C.violet)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: healthGoal === o.v ? C.violet : C.text }}>
                  {o.l}
                </span>
                {healthGoal === o.v && <span style={{ fontSize: 11, color: C.violet }}>当前</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>系统将更关注：</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {o.focuses.map((f: string) => (
                  <span key={f} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10,
                    background: healthGoal === o.v ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.05)",
                    color: healthGoal === o.v ? C.violet : C.textMuted }}>
                    ✓ {f}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => onSave({ goal: goal as any, healthGoal: healthGoal as any })} style={{
        padding: "10px 28px", borderRadius: 12, border: "none",
        background: `linear-gradient(135deg,${C.emerald},#059669)`,
        color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
        保存目标设置
      </button>
    </div>
  );
}

// ─── Section: Profile ─────────────────────────────────────────────────────────

function ProfileSection({ saved, onSave }: {
  saved: Partial<AppState>;
  onSave: (partial: Partial<AppState>) => void;
}) {
  const [age, setAge] = useState(String(saved.age ?? ""));
  const [heightCm, setHeightCm] = useState(String(saved.heightCm ?? ""));
  const [gender, setGender] = useState(saved.gender ?? "female");
  const [activityLevel, setActivityLevel] = useState(saved.activityLevel ?? "medium");
  const [sleepTime, setSleepTime] = useState(saved.sleepTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(saved.wakeTime ?? "07:00");

  const inputStyle = {
    padding: "9px 12px", borderRadius: 10, outline: "none",
    border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
    color: C.text, fontSize: 13, fontFamily: "inherit",
  };

  const btnStyle = (selected: boolean) => ({
    flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer",
    border: `1px solid ${selected ? C.sky + "50" : C.border}`,
    background: selected ? C.skyDim : "transparent",
    color: selected ? C.sky : C.textMuted,
    fontSize: 12, fontWeight: selected ? 700 : 500,
  });

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>基本信息</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        影响 BMR 估算、Goal Progress 和 AI 建议。
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {[
          { label: "年龄", val: age, set: setAge, placeholder: "如：28", type: "number" },
          { label: "身高 (cm)", val: heightCm, set: setHeightCm, placeholder: "如：165", type: "number" },
        ].map((f, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {f.label}
            </div>
            <input type={f.type} value={f.val} placeholder={f.placeholder}
              onChange={e => f.set(e.target.value)}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" as const }} />
          </div>
        ))}
      </div>

      {/* Gender */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>性别</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ v: "male", l: "男" }, { v: "female", l: "女" }, { v: "other", l: "其他" }].map(o => (
            <button key={o.v} onClick={() => setGender(o.v as any)} style={btnStyle(gender === o.v)}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Activity level */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          日常活动量
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { v: "low", l: "久坐", desc: "办公室为主" },
            { v: "medium", l: "适中", desc: "偶尔走动" },
            { v: "high", l: "活跃", desc: "体力工作/运动多" },
          ].map(o => (
            <button key={o.v} onClick={() => setActivityLevel(o.v as any)} style={{
              ...btnStyle(activityLevel === o.v),
              flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px",
            }}>
              <span>{o.l}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{o.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sleep schedule */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          作息时间
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>入睡</div>
            <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>
          <div style={{ color: C.textMuted, marginTop: 16 }}>→</div>
          <div>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>起床</div>
            <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }} />
          </div>
        </div>
      </div>

      <button onClick={() => onSave({
        age: parseInt(age) || saved.age,
        heightCm: parseInt(heightCm) || saved.heightCm,
        gender: gender as any,
        activityLevel: activityLevel as any,
        sleepTime, wakeTime,
      })} style={{
        padding: "10px 28px", borderRadius: 12, border: "none",
        background: `linear-gradient(135deg,${C.emerald},#059669)`,
        color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
        保存基本信息
      </button>
    </div>
  );
}

// ─── Section: Data Management ─────────────────────────────────────────────────

function DataSection() {
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const actions = [
    {
      id: "today_checkin",
      label: "清除今日 Check-in",
      desc: "删除今天的晨间和晚间记录",
      color: C.amber,
      action: () => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`checkin_${today}`);
      },
    },
    {
      id: "today_training",
      label: "清除今日训练记录",
      desc: "删除今天所有训练 Session",
      color: C.amber,
      action: () => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`training_${today}`);
      },
    },
    {
      id: "today_nutrition",
      label: "清除今日饮食记录",
      desc: "删除今天所有餐食数据",
      color: C.amber,
      action: () => {
        const today = new Date().toISOString().slice(0, 10);
        localStorage.removeItem(`nutrition_${today}`);
      },
    },
    {
      id: "scan_history",
      label: "清除扫描历史",
      desc: "删除所有录入的历史 InBody 扫描数据",
      color: C.rose,
      action: () => localStorage.removeItem("inbody_scan_history"),
    },
    {
      id: "all_checkins",
      label: "清除所有 Check-in 记录",
      desc: "删除过去 90 天的所有晨间/晚间记录",
      color: C.rose,
      action: () => {
        for (let i = 0; i < 90; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          localStorage.removeItem(`checkin_${d.toISOString().slice(0, 10)}`);
          localStorage.removeItem(`training_${d.toISOString().slice(0, 10)}`);
          localStorage.removeItem(`nutrition_${d.toISOString().slice(0, 10)}`);
          localStorage.removeItem(`reflection_${d.toISOString().slice(0, 10)}`);
        }
        localStorage.removeItem("inbody_wins_unlocked");
      },
    },
    {
      id: "full_reset",
      label: "完全重置",
      desc: "删除所有数据，回到初始欢迎页面",
      color: C.rose,
      action: () => {
        localStorage.clear();
        window.location.reload();
      },
    },
  ];

  const handleAction = (id: string) => {
    if (confirmReset !== id) {
      setConfirmReset(id);
      return;
    }
    const a = actions.find(x => x.id === id);
    if (a) {
      a.action();
      setConfirmReset(null);
      setDone(id);
      setTimeout(() => setDone(null), 2000);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>数据管理</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        所有数据存储在本地浏览器，不会上传到任何服务器。
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {actions.map(a => (
          <div key={a.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${confirmReset === a.id ? a.color + "40" : C.border}`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{a.desc}</div>
            </div>
            <button onClick={() => handleAction(a.id)} style={{
              padding: "6px 14px", borderRadius: 10, cursor: "pointer", flexShrink: 0, marginLeft: 12,
              border: `1px solid ${a.color}40`,
              background: confirmReset === a.id ? a.color : a.color + "15",
              color: confirmReset === a.id ? "#020817" : a.color,
              fontSize: 12, fontWeight: 700, transition: "all 0.15s",
            }}>
              {done === a.id ? "✓ 完成" : confirmReset === a.id ? "确认删除" : "清除"}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          存储用量
        </div>
        {(() => {
          let total = 0;
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) ?? "";
            total += (localStorage.getItem(key) ?? "").length;
          }
          const kb = (total / 1024).toFixed(1);
          return (
            <div style={{ fontSize: 13, color: C.textSub }}>
              本地数据约 <span style={{ color: C.emerald, fontWeight: 700 }}>{kb} KB</span>
              <span style={{ color: C.textMuted, fontSize: 11, marginLeft: 8 }}>/ 5120 KB 上限</span>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SettingsPage({ state }: { state: AppState }) {
  const [section, setSection] = useState<SettingsSection>("ai");
  const [showToast, setShowToast] = useState(false);
  const [savedState, setSavedState] = useState<Partial<AppState>>(() => loadState());

  const handleSave = (partial: Partial<AppState>) => {
    savePartial(partial);
    setSavedState(s => ({ ...s, ...partial }));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const sections: { id: SettingsSection; label: string; icon: string }[] = [
    { id: "ai",      label: "AI 配置",   icon: "🤖" },
    { id: "goals",   label: "目标设置",  icon: "🎯" },
    { id: "profile", label: "基本信息",  icon: "👤" },
    { id: "data",    label: "数据管理",  icon: "🗄️" },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.textMuted, marginBottom: 6, textTransform: "uppercase" }}>
          Settings
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>设置</h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, alignItems: "start" }}>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sections.map(s => (
            <SectionTab key={s.id} id={s.id} label={s.label} icon={s.icon}
              active={section === s.id} onClick={() => setSection(s.id)} />
          ))}
        </div>

        {/* Content */}
        <div style={g({ padding: "24px" })}>
          {section === "ai"      && <AISection      saved={savedState} onSave={handleSave} />}
          {section === "goals"   && <GoalsSection   saved={savedState} onSave={handleSave} />}
          {section === "profile" && <ProfileSection saved={savedState} onSave={handleSave} />}
          {section === "data"    && <DataSection />}
        </div>
      </div>

      <SaveToast show={showToast} />
    </div>
  );
}
