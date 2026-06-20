"use client";

import React, { useState } from "react";
import { C, g, STORAGE_KEY, TEXT_PROVIDERS } from "../constants";
import { AppState } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileSection = "personal" | "goals" | "advanced" | "data";

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

// ─── Save Toast ───────────────────────────────────────────────────────────────

function SaveToast({ show }: { show: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%",
      transform: `translateX(-50%) translateY(${show ? 0 : 80}px)`,
      transition: "transform 0.3s ease",
      padding: "10px 20px", borderRadius: 20,
      background: C.emerald, color: "#020817",
      fontSize: 13, fontWeight: 700,
      boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
      zIndex: 100, pointerEvents: "none",
    }}>
      ✓ 已保存，刷新后生效
    </div>
  );
}

// ─── Section Nav ──────────────────────────────────────────────────────────────

function SectionBtn({ id, label, icon, active, onClick }: {
  id: ProfileSection; label: string; icon: string;
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
      <span>{icon}</span><span>{label}</span>
    </button>
  );
}

// ─── Personal Info ────────────────────────────────────────────────────────────

function PersonalSection({ saved, onSave }: {
  saved: Partial<AppState>; onSave: (p: Partial<AppState>) => void;
}) {
  const [age, setAge] = useState(String(saved.age ?? ""));
  const [heightCm, setHeightCm] = useState(String(saved.heightCm ?? ""));
  const [gender, setGender] = useState(saved.gender ?? "female");
  const [activityLevel, setActivityLevel] = useState(saved.activityLevel ?? "medium");
  const [sleepTime, setSleepTime] = useState(saved.sleepTime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(saved.wakeTime ?? "07:00");

  const inp = {
    padding: "9px 12px", borderRadius: 10, outline: "none",
    border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
    color: C.text, fontSize: 13, fontFamily: "inherit",
    width: "100%", boxSizing: "border-box" as const,
  };

  const chip = (selected: boolean, color = C.sky) => ({
    flex: 1, padding: "8px", borderRadius: 10, cursor: "pointer",
    border: `1px solid ${selected ? color + "50" : C.border}`,
    background: selected ? color + "12" : "transparent",
    color: selected ? color : C.textMuted,
    fontSize: 12, fontWeight: selected ? 700 : 500,
  });

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>个人资料</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>影响 BMR 估算和 AI 建议</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
        {[
          { label: "年龄", val: age, set: setAge, ph: "如：28" },
          { label: "身高 (cm)", val: heightCm, set: setHeightCm, ph: "如：165" },
        ].map((f, i) => (
          <div key={i}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{f.label}</div>
            <input type="number" value={f.val} placeholder={f.ph} onChange={e => f.set(e.target.value)} style={inp} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>性别</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ v: "female", l: "女" }, { v: "male", l: "男" }, { v: "other", l: "其他" }].map(o => (
            <button key={o.v} onClick={() => setGender(o.v as any)} style={chip(gender === o.v)}>{o.l}</button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>日常活动量</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { v: "low", l: "久坐", sub: "办公室为主" },
            { v: "medium", l: "适中", sub: "偶尔走动" },
            { v: "high", l: "活跃", sub: "体力/运动多" },
          ].map(o => (
            <button key={o.v} onClick={() => setActivityLevel(o.v as any)} style={{ ...chip(activityLevel === o.v), display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px" }}>
              <span>{o.l}</span>
              <span style={{ fontSize: 10, opacity: 0.6 }}>{o.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>作息时间</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>入睡</div>
            <input type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
          </div>
          <div style={{ color: C.textMuted, marginTop: 16 }}>→</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>起床</div>
            <input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
          </div>
        </div>
      </div>

      <button onClick={() => onSave({ age: parseInt(age) || saved.age, heightCm: parseInt(heightCm) || saved.heightCm, gender: gender as any, activityLevel: activityLevel as any, sleepTime, wakeTime })}
        style={{ padding: "10px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.emerald},#059669)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        保存
      </button>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────

function GoalsSection({ saved, onSave }: {
  saved: Partial<AppState>; onSave: (p: Partial<AppState>) => void;
}) {
  const [goal, setGoal] = useState(saved.goal ?? "weight_loss");
  const [healthGoal, setHealthGoal] = useState(saved.healthGoal ?? "fat_loss");

  const GOALS = [
    { v: "weight_loss", l: "减脂瘦身", desc: "降低体脂为主" },
    { v: "muscle_gain", l: "增肌塑形", desc: "增加肌肉量为主" },
    { v: "recomposition", l: "体态重塑", desc: "减脂同时增肌" },
    { v: "maintain", l: "维持体形", desc: "保持当前状态" },
  ];

  const MODES = [
    { v: "fat_loss",       l: "减脂模式",  focuses: ["蛋白质摄入", "训练频率", "热量控制"] },
    { v: "muscle_gain",    l: "增肌模式",  focuses: ["训练强度", "蛋白质摄入", "睡眠质量"] },
    { v: "fitness",        l: "提升体能",  focuses: ["训练频率", "睡眠质量", "整体均衡"] },
    { v: "sleep_recovery", l: "改善睡眠",  focuses: ["睡眠时长", "饮水习惯", "压力管理"] },
  ];

  const card = (selected: boolean, color = C.emerald) => ({
    padding: "12px 16px", borderRadius: 14, cursor: "pointer", textAlign: "left" as const, width: "100%",
    border: `1px solid ${selected ? color + "50" : C.border}`,
    background: selected ? color + "10" : "rgba(255,255,255,0.03)",
  });

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>目标管理</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>主要目标影响 Goal Progress，执行模式影响 Compliance 权重</div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>我的目标</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {GOALS.map(o => (
            <button key={o.v} onClick={() => setGoal(o.v as any)} style={card(goal === o.v)}>
              <div style={{ fontSize: 13, fontWeight: 700, color: goal === o.v ? C.emerald : C.text, marginBottom: 2 }}>{o.l}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{o.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>执行模式</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 10, opacity: 0.7 }}>决定系统最关注哪些健康行为</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MODES.map(o => (
            <button key={o.v} onClick={() => setHealthGoal(o.v as any)} style={card(healthGoal === o.v, C.violet)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: healthGoal === o.v ? C.violet : C.text }}>{o.l}</span>
                {healthGoal === o.v && <span style={{ fontSize: 11, color: C.violet }}>当前</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>系统将更关注：</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {o.focuses.map(f => (
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

      <button onClick={() => onSave({ goal: goal as any, healthGoal: healthGoal as any })}
        style={{ padding: "10px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.emerald},#059669)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        保存
      </button>
    </div>
  );
}

// ─── Advanced ────────────────────────────────────────────────────────────────

function AdvancedSection({ saved, onSave }: {
  saved: Partial<AppState>; onSave: (p: Partial<AppState>) => void;
}) {
  // Vision (image recognition)
  const [visionProvider, setVisionProvider] = useState(saved.visionProvider ?? "qwen");
  const [visionApiKey, setVisionApiKey] = useState(saved.visionApiKey ?? "");
  const [showVisionKey, setShowVisionKey] = useState(false);

  // Text (AI analysis)
  const [provider, setProvider] = useState(saved.provider ?? "deepseek");
  const [apiKey, setApiKey] = useState(saved.apiKey ?? "");
  const [modelName, setModelName] = useState(saved.modelName ?? "");
  const [showKey, setShowKey] = useState(false);

  const inp = {
    width: "100%", padding: "10px 14px", borderRadius: 10, outline: "none",
    border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)",
    color: C.text, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const,
  };

  const providerBtn = (selected: boolean) => ({
    padding: "7px 14px", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${selected ? C.emerald + "50" : C.border}`,
    background: selected ? C.emeraldDim : "transparent",
    color: selected ? C.emerald : C.textSub,
    fontSize: 12, fontWeight: 600 as const,
    display: "flex", alignItems: "center", gap: 6,
  });

  const VISION_TEXT_PROVIDERS = [
    { id: "qwen",   label: "Qwen-VL",  tag: "国内直连" },
    { id: "openai", label: "GPT-4o",   tag: "需VPN" },
    { id: "claude", label: "Claude",   tag: "需VPN" },
    { id: "ollama", label: "Ollama",   tag: "本地" },
  ];

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>高级设置</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 24 }}>两套 AI 配置，用途不同</div>

      {/* ── Vision API (图像识别) ── */}
      <div style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>📷</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>图像识别</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.skyDim, color: C.sky }}>上传 InBody 截图时使用</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
          推荐 Qwen-VL（国内直连，免费额度充足）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {VISION_TEXT_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => setVisionProvider(p.id)} style={providerBtn(visionProvider === p.id)}>
              <span>{p.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>{p.tag}</span>
            </button>
          ))}
        </div>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <input type={showVisionKey ? "text" : "password"} value={visionApiKey}
            onChange={e => setVisionApiKey(e.target.value)}
            placeholder={`${VISION_TEXT_PROVIDERS.find(p => p.id === visionProvider)?.label ?? visionProvider} API Key`}
            style={{ ...inp, paddingRight: 72 }} />
          <button onClick={() => setShowVisionKey(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
            {showVisionKey ? "隐藏" : "显示"}
          </button>
        </div>
        {visionApiKey && <div style={{ fontSize: 11, color: C.emerald }}>✓ 已配置 {visionApiKey.length} 位</div>}
      </div>

      {/* ── Text API (文字分析) ── */}
      <div style={{ padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>🧠</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>文字分析</span>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: C.violetDim, color: C.violet }}>AI 分析、Daily Reflection 等使用</span>
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 14 }}>
          推荐 DeepSeek（国内直连，5元用很久）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {TEXT_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { setProvider(p.id); setModelName(""); }} style={providerBtn(provider === p.id)}>
              <span>{p.label}</span>
              <span style={{ fontSize: 10, opacity: 0.6, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>{p.tag}</span>
            </button>
          ))}
        </div>
        <div style={{ position: "relative", marginBottom: 6 }}>
          <input type={showKey ? "text" : "password"} value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder={`${TEXT_PROVIDERS.find(p => p.id === provider)?.label ?? provider} API Key`}
            style={{ ...inp, paddingRight: 72 }} />
          <button onClick={() => setShowKey(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", padding: "3px 8px", borderRadius: 6, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 11, cursor: "pointer" }}>
            {showKey ? "隐藏" : "显示"}
          </button>
        </div>
        {apiKey && <div style={{ fontSize: 11, color: C.emerald, marginBottom: 10 }}>✓ 已配置 {apiKey.length} 位</div>}
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>模型名称（留空使用默认）</div>
          <input type="text" value={modelName} onChange={e => setModelName(e.target.value)}
            placeholder={provider === "qwen" ? "qwen-plus" : provider === "deepseek" ? "deepseek-chat" : provider === "openai" ? "gpt-4o" : provider === "claude" ? "claude-sonnet-4-6" : "留空使用默认"}
            style={inp} />
        </div>
      </div>

      <button onClick={() => onSave({ visionProvider, visionApiKey, provider, apiKey, modelName })}
        style={{ padding: "10px 28px", borderRadius: 12, border: "none", background: `linear-gradient(135deg,${C.emerald},#059669)`, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
        保存
      </button>
    </div>
  );
}

// ─── Data Management ─────────────────────────────────────────────────────────

function DataSection() {
  const [confirm, setConfirm] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Export JSON backup
  const handleExport = () => {
    const data: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? "";
      try { data[key] = JSON.parse(localStorage.getItem(key) ?? ""); } catch { data[key] = localStorage.getItem(key); }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `personal-body-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows: string[] = ["日期,体重(kg),蛋白达标率(%),饮水(ml),训练,睡眠时长,疲劳,压力,酸痛,心情"];
    for (let i = 89; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const date = d.toISOString().slice(0, 10);
      try {
        const raw = localStorage.getItem(`checkin_${date}`);
        if (!raw) continue;
        const ci = JSON.parse(raw);
        const hasTrain = !!localStorage.getItem(`training_${date}`);
        const sleepLabels = ["<5h","5-6h","6-7h","7-8h",">8h"];
        rows.push([
          date,
          ci.morning?.weight ?? "",
          ci.evening?.proteinPct ?? "",
          ci.evening?.waterMl ?? "",
          hasTrain ? "是" : ci.evening?.training === "rest" ? "休息" : "否",
          ci.morning?.sleepDuration !== undefined ? sleepLabels[ci.morning.sleepDuration] : "",
          ci.morning?.fatigue ?? "",
          ci.morning?.stress ?? "",
          ci.morning?.soreness ?? "",
          ci.evening?.mood ?? "",
        ].join(","));
      } catch {}
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `personal-body-os-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Import JSON backup
  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target!.result as string);
        Object.entries(data).forEach(([k, v]) => {
          localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
        });
        setDone("import");
        setTimeout(() => { setDone(null); window.location.reload(); }, 1500);
      } catch { alert("导入失败，文件格式不正确"); }
    };
    reader.readAsText(file);
  };

  const actions = [
    {
      id: "today",
      label: "清除今日记录",
      desc: "删除今天的 Check-in、训练、饮食数据",
      color: C.amber,
      action: () => {
        const today = new Date().toISOString().slice(0, 10);
        ["checkin", "training", "nutrition", "reflection"].forEach(prefix => localStorage.removeItem(`${prefix}_${today}`));
      },
    },
    {
      id: "all_history",
      label: "清除所有历史记录",
      desc: "删除过去90天的所有 Check-in、训练、饮食记录",
      color: C.rose,
      action: () => {
        for (let i = 0; i < 90; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const date = d.toISOString().slice(0, 10);
          ["checkin", "training", "nutrition", "reflection"].forEach(prefix => localStorage.removeItem(`${prefix}_${date}`));
        }
        localStorage.removeItem("inbody_wins_unlocked");
        localStorage.removeItem("inbody_scan_history");
      },
    },
    {
      id: "full_reset",
      label: "完全重置",
      desc: "删除所有数据，回到初始欢迎页",
      color: C.rose,
      action: () => { localStorage.clear(); window.location.reload(); },
    },
  ];

  const handleAction = (id: string) => {
    if (confirm !== id) { setConfirm(id); return; }
    const a = actions.find(x => x.id === id);
    if (a) { a.action(); setConfirm(null); setDone(id); setTimeout(() => setDone(null), 2000); }
  };

  // Storage usage
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) ?? "";
    totalBytes += (localStorage.getItem(k) ?? "").length;
  }
  const kb = (totalBytes / 1024).toFixed(1);

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>数据管理</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 20 }}>所有数据存储在本地浏览器，不会上传到任何服务器</div>

      {/* Export / Import */}
      <div style={{ ...g({ padding: "18px 20px" }), marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 12 }}>备份与恢复</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={handleExport} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 12, border: `1px solid ${C.emerald}40`, background: C.emeraldDim, color: C.emerald, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ⬇ JSON 备份
          </button>
          <button onClick={handleExportCSV} style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 12, border: `1px solid ${C.violet}40`, background: C.violetDim, color: C.violet, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ⬇ CSV 导出
          </button>
          <label style={{ flex: 1, minWidth: 120, padding: "10px", borderRadius: 12, border: `1px solid ${C.sky}40`, background: C.skyDim, color: C.sky, fontSize: 12, fontWeight: 700, cursor: "pointer", textAlign: "center" as const }}>
            ⬆ 导入备份
            <input type="file" accept=".json" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleImport(e.target.files[0])} />
          </label>
        </div>
        {done === "import" && <div style={{ marginTop: 8, fontSize: 12, color: C.emerald }}>✓ 导入成功，正在刷新...</div>}
      </div>

      {/* Delete actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {actions.map(a => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 14, background: "rgba(255,255,255,0.03)", border: `1px solid ${confirm === a.id ? a.color + "40" : C.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{a.label}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{a.desc}</div>
            </div>
            <button onClick={() => handleAction(a.id)} style={{ padding: "6px 14px", borderRadius: 10, cursor: "pointer", flexShrink: 0, marginLeft: 12, border: `1px solid ${a.color}40`, background: confirm === a.id ? a.color : a.color + "15", color: confirm === a.id ? "#020817" : a.color, fontSize: 12, fontWeight: 700, transition: "all 0.15s" }}>
              {done === a.id ? "✓ 完成" : confirm === a.id ? "确认" : "清除"}
            </button>
          </div>
        ))}
      </div>

      {/* Storage indicator */}
      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.02)", border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>本地存储用量</div>
        <div style={{ fontSize: 13, color: C.textSub }}>
          约 <span style={{ color: C.emerald, fontWeight: 700 }}>{kb} KB</span>
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 8 }}>/ 5120 KB</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfilePage({ state, onClose }: {
  state: AppState;
  onClose: () => void;
}) {
  const [section, setSection] = useState<ProfileSection>("personal");
  const [showToast, setShowToast] = useState(false);
  const [savedState, setSavedState] = useState<Partial<AppState>>(() => loadState());

  const handleSave = (partial: Partial<AppState>) => {
    savePartial(partial);
    setSavedState(s => ({ ...s, ...partial }));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const m = state.measurements;
  const bfColor = m.bodyFatPercentage > 30 ? C.rose : m.bodyFatPercentage > 22 ? C.amber : C.emerald;

  const sections: { id: ProfileSection; label: string; icon: string }[] = [
    { id: "personal", label: "个人资料", icon: "👤" },
    { id: "goals",    label: "目标管理", icon: "🎯" },
    { id: "advanced", label: "高级设置", icon: "⚙️" },
    { id: "data",     label: "数据管理", icon: "🗄️" },
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 60 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: C.textMuted, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Profile</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: C.text, margin: 0 }}>我的档案</h2>
        </div>
        <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 13, cursor: "pointer" }}>
          {"<-"} 返回
        </button>
      </div>

      {/* Goal + Body snapshot summary */}
      {m.weight > 0 && (
        <div style={{ ...g({ padding: "16px 20px" }), marginBottom: 24 }}>
          {/* Goal - most prominent */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid rgba(255,255,255,0.06)` }}>
            <span style={{ fontSize: 11, color: C.textMuted }}>当前目标</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.emerald }}>
              {({ weight_loss: "减脂瘦身", muscle_gain: "增肌塑形", recomposition: "体态重塑", maintain: "维持体形" } as any)[state.goal] ?? state.goal}
            </span>
            <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 4 }}>·</span>
            <span style={{ fontSize: 11, color: C.violet }}>
              {({ fat_loss: "减脂模式", muscle_gain: "增肌模式", fitness: "提升体能", sleep_recovery: "改善睡眠" } as any)[state.healthGoal] ?? ""}
            </span>
            <button onClick={() => setSection("goals")} style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}>
              修改
            </button>
          </div>
          {/* Body data */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { label: "体重", val: `${m.weight} kg`, color: C.text },
              { label: "体脂", val: `${m.bodyFatPercentage.toFixed(1)}%`, color: bfColor },
              { label: "骨骼肌", val: `${m.skeletalMuscleMass.toFixed(1)} kg`, color: C.emerald },
              { label: "内脏脂肪", val: `${m.visceralFatLevel} 级`, color: m.visceralFatLevel >= 10 ? C.rose : m.visceralFatLevel >= 6 ? C.amber : C.emerald },
            ].map((item, i) => (
              <div key={i}>
                <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.val}</div>
              </div>
            ))}
            <div style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted, alignSelf: "center" }}>
              InBody 基准数据
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sections.map(s => (
            <SectionBtn key={s.id} id={s.id} label={s.label} icon={s.icon}
              active={section === s.id} onClick={() => setSection(s.id)} />
          ))}
        </div>
        <div style={g({ padding: "24px" })}>
          {section === "personal" && <PersonalSection saved={savedState} onSave={handleSave} />}
          {section === "goals"    && <GoalsSection    saved={savedState} onSave={handleSave} />}
          {section === "advanced" && <AdvancedSection  saved={savedState} onSave={handleSave} />}
          {section === "data"     && <DataSection />}
        </div>
      </div>

      <SaveToast show={showToast} />
    </div>
  );
}
