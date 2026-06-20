"use client";

import { useState, useCallback, useRef } from "react";
import { C, MEAL_KEYS, MEAL_LABELS, MEAL_ICONS, MEAL_COLORS, g } from "../constants";
import { AppState, MealsRecord } from "../types";
import { callTextAI, parseJSON } from "../lib/ai";
import { buildDataBlock, promptFoodParse, promptGapAnalysis } from "../lib/prompts";

// ── NUTRITION MEAL CARD ───────────────────────────────────────
export function NutritionMealCard({ mealKey, meal, onAdd, onRemove, onClear, proteinTarget, calTarget, aiCfg }: {
  mealKey: string; meal: any; onAdd: any; onRemove: any; onClear: any;
  proteinTarget: number; calTarget: number; aiCfg: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const [inputMode, setInputMode] = useState("ai");
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [manualItem, setManualItem] = useState({ name: "", protein: "", carbs: "", fat: "", calories: "" });
  const color = MEAL_COLORS[mealKey];
  const items = meal?.items || [];

  const total = items.reduce((acc: any, it: any) => ({
    protein: acc.protein + (it.protein || 0),
    carbs: acc.carbs + (it.carbs || 0),
    fat: acc.fat + (it.fat || 0),
    calories: acc.calories + (it.calories || 0),
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });

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
        const cleanItems = data.items.map((it: any) => ({
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
    const desc = items.map((it: any) => `${it.name}${it.weight && it.weight !== "-" ? " " + it.weight : ""}`).join(" + ");
    try {
      const raw = await callTextAI(promptFoodParse(desc, proteinTarget, calTarget), aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      const data = parseJSON(raw);
      if (data?.mealScore) onAdd(mealKey, [], data.mealScore, data.mealScoreNote, data.proteinQuality, data.proteinQualityNote);
    } catch {}
    setAiLoading(false);
  };

  const handleManualAdd = () => {
    onAdd(mealKey, [{
      name: manualItem.name || "自定义食物",
      weight: "-",
      protein: Number(manualItem.protein) || 0,
      carbs: Number(manualItem.carbs) || 0,
      fat: Number(manualItem.fat) || 0,
      calories: Number(manualItem.calories) || 0,
    }], null, null, null, null);
    setManualItem({ name: "", protein: "", carbs: "", fat: "", calories: "" });
  };

  return (
    <div style={{ ...g({ padding: 0, marginBottom: 12, overflow: "hidden", border: `1px solid ${expanded ? color + "30" : C.border}` }), transition: "border-color 0.2s" }}>
      {/* Header */}
      <div onClick={() => setExpanded(!expanded)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
            {MEAL_ICONS[mealKey]}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{MEAL_LABELS[mealKey]}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              {items.length > 0 ? `${items.length}种食物 · ${totalRounded.protein}g蛋白 · ${totalRounded.calories}kcal` : "未记录"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {meal?.mealScore && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: meal.mealScore >= 80 ? C.emerald : meal.mealScore >= 60 ? C.amber : C.rose }}>
                {meal.mealScore}分
              </div>
              {meal.mealScoreNote && <div style={{ fontSize: 9, color: C.textMuted, maxWidth: 90, lineHeight: 1.3 }}>{meal.mealScoreNote}</div>}
            </div>
          )}
          {meal?.proteinQuality && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: meal.proteinQuality === "high" ? C.emeraldDim : C.amberDim, color: meal.proteinQuality === "high" ? C.emerald : C.amber }}>
                P{meal.proteinQuality === "high" ? "优" : meal.proteinQuality === "medium" ? "中" : "低"}
              </div>
              {meal.proteinQualityNote && <div style={{ fontSize: 9, color: C.textMuted, maxWidth: 70, lineHeight: 1.3, marginTop: 2 }}>{meal.proteinQualityNote}</div>}
            </div>
          )}
          <div style={{ color: C.textMuted, fontSize: 12, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</div>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 20px" }}>
          {items.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {items.map((it: any, idx: number) => (
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAIRescore} disabled={aiLoading || items.length === 0}
                    style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${color}40`, background: color + "10", color, fontSize: 11, fontWeight: 600, cursor: items.length === 0 ? "not-allowed" : "pointer", opacity: items.length === 0 ? 0.4 : 1 }}>
                    {aiLoading ? "评分中..." : "重新评分"}
                  </button>
                  <button onClick={() => onClear(mealKey)}
                    style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid rgba(244,63,94,0.3)`, background: "rgba(244,63,94,0.08)", color: C.rose, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
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
            {["ai", "manual"].map(mode => (
              <button key={mode} onClick={() => setInputMode(mode)}
                style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${inputMode === mode ? color + "60" : C.border}`, background: inputMode === mode ? color + "15" : "transparent", color: inputMode === mode ? color : C.textMuted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {mode === "ai" ? "AI 解析" : "手动输入"}
              </button>
            ))}
            <button disabled style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${C.border}`, background: "transparent", color: C.textMuted, fontSize: 12, cursor: "not-allowed", opacity: 0.4 }}>
              📷 拍照 Coming Soon
            </button>
          </div>

          {inputMode === "ai" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={aiInput} onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAIParse()}
                placeholder="例：鸡胸肉150g + 米饭200g + 西兰花100g"
                style={{ flex: 1, padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 13, outline: "none" }}
              />
              <button onClick={handleAIParse} disabled={aiLoading || !aiInput.trim()}
                style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: aiLoading ? "rgba(255,255,255,0.05)" : color, color: aiLoading ? C.textMuted : "#fff", fontSize: 13, fontWeight: 700, cursor: aiLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                {aiLoading ? "解析中..." : "解析"}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 6 }}>
              {[
                { k: "name", ph: "食物名称", type: "text" },
                { k: "protein", ph: "蛋白g", type: "number" },
                { k: "carbs", ph: "碳水g", type: "number" },
                { k: "fat", ph: "脂肪g", type: "number" },
                { k: "calories", ph: "热量", type: "number" },
              ].map(({ k, ph, type }) => (
                <input key={k} type={type} placeholder={ph} value={(manualItem as any)[k]}
                  onChange={e => setManualItem(s => ({ ...s, [k]: e.target.value }))}
                  style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 12, outline: "none" }} />
              ))}
              <button onClick={handleManualAdd}
                style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── NUTRITION PAGE ────────────────────────────────────────────
export function NutritionPage({ state, onBack }: { state: AppState; onBack: () => void }) {
  const m = state.measurements;
  const { tdee, proteinG } = buildDataBlock(m, state);
  const calTarget = state.goal === "weight_loss" ? tdee - 300 : state.goal === "muscle_gain" ? tdee + 300 : tdee;
  const targets = { protein: proteinG, calories: calTarget, carbs: Math.round((calTarget * 0.40) / 4), fat: Math.round((calTarget * 0.25) / 9) };

  const todayKey = `nutrition_${new Date().toISOString().slice(0, 10)}`;
  const checkinKey = `checkin_${new Date().toISOString().slice(0, 10)}`;
  const targetsRef = useRef(targets);
  targetsRef.current = targets;

  const [meals, setMealsRaw] = useState<MealsRecord>(() => {
    try { const s = localStorage.getItem(todayKey); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });

  const setMeals = useCallback((updater: any) => {
    setMealsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(todayKey, JSON.stringify(next)); } catch {}
      const allItems = Object.values(next as MealsRecord).flatMap((meal: any) => meal?.items || []);
      const totalProtein = allItems.reduce((s: number, it: any) => s + (it.protein || 0), 0);
      const pct = Math.min(100, Math.round((totalProtein / targetsRef.current.protein) * 100));
      try {
        const raw = localStorage.getItem(checkinKey);
        const ci = raw ? JSON.parse(raw) : {};
        localStorage.setItem(checkinKey, JSON.stringify({ ...ci, evening: { ...(ci.evening || {}), proteinPct: pct } }));
      } catch {}
      return next;
    });
  }, [todayKey, checkinKey]);

  const [gapResult, setGapResult] = useState<any>(null);
  const [gapLoading, setGapLoading] = useState(false);
  const [missionResult, setMissionResult] = useState<any>(null);
  const [missionLoading, setMissionLoading] = useState(false);

  const fetchMission = async () => {
    setMissionLoading(true);
    try {
      const remaining = Math.max(0, targets.protein - Math.round(todayTotals.protein * 10) / 10);
      const prompt = `用户今日蛋白质目标${targets.protein}g，已摄入${Math.round(todayTotals.protein*10)/10}g，还需要${remaining}g。热量目标${targets.calories}kcal，已摄入${Math.round(todayTotals.calories)}kcal。请用JSON回复，格式：{"mission":"一句话今日使命（20字内）","foods":[{"name":"食物名","protein":数字,"desc":"份量描述"},{"name":"食物名","protein":数字,"desc":"份量描述"},{"name":"食物名","protein":数字,"desc":"份量描述"}]}，foods给3个高蛋白食物建议，只回复JSON不要其他内容。`;
      const raw = await callTextAI(prompt, aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      const data = parseJSON(raw);
      if (data?.foods) setMissionResult(data);
    } catch {}
    setMissionLoading(false);
  };
  const aiCfg = { provider: state.provider, apiKey: state.apiKey, modelName: state.modelName };

  const allItems = Object.values(meals).flatMap((meal: any) => meal?.items || []);
  const todayTotals = allItems.reduce((acc: any, it: any) => ({
    protein: acc.protein + (it.protein || 0),
    carbs: acc.carbs + (it.carbs || 0),
    fat: acc.fat + (it.fat || 0),
    calories: acc.calories + (it.calories || 0),
  }), { protein: 0, carbs: 0, fat: 0, calories: 0 });

  const handleAddItems = (mealKey: string, items: any[], mealScore: any, mealScoreNote: any, proteinQuality: any, proteinQualityNote: any) => {
    setMeals((prev: any) => ({
      ...prev,
      [mealKey]: {
        items: items.length > 0 ? [...(prev[mealKey]?.items || []), ...items] : (prev[mealKey]?.items || []),
        mealScore: mealScore ?? prev[mealKey]?.mealScore,
        mealScoreNote: mealScoreNote ?? prev[mealKey]?.mealScoreNote,
        proteinQuality: proteinQuality ?? prev[mealKey]?.proteinQuality,
        proteinQualityNote: proteinQualityNote ?? prev[mealKey]?.proteinQualityNote,
      },
    }));
  };

  const handleRemoveItem = (mealKey: string, idx: number) => {
    setMeals((prev: any) => {
      const items = [...(prev[mealKey]?.items || [])];
      items.splice(idx, 1);
      return { ...prev, [mealKey]: { ...prev[mealKey], items } };
    });
  };

  const handleClearMeal = (mealKey: string) => {
    setMeals((prev: any) => ({ ...prev, [mealKey]: { items: [], mealScore: null, mealScoreNote: null, proteinQuality: null, proteinQualityNote: null } }));
  };

  const fetchGap = async () => {
    setGapLoading(true);
    try {
      const raw = await callTextAI(promptGapAnalysis(todayTotals, targets), aiCfg.provider, aiCfg.apiKey, aiCfg.modelName);
      setGapResult(parseJSON(raw));
    } catch {}
    setGapLoading(false);
  };

  const macros = [
    { label: "蛋白质", current: Math.round(todayTotals.protein * 10) / 10, target: targets.protein, pct: Math.round((todayTotals.protein / targets.protein) * 100), color: C.emerald, unit: "g" },
    { label: "热量",   current: Math.round(todayTotals.calories),           target: targets.calories, pct: Math.round((todayTotals.calories / targets.calories) * 100), color: C.amber, unit: "kcal" },
    { label: "碳水",   current: Math.round(todayTotals.carbs * 10) / 10,    target: targets.carbs,    pct: Math.round((todayTotals.carbs / targets.carbs) * 100),    color: C.sky,   unit: "g" },
    { label: "脂肪",   current: Math.round(todayTotals.fat * 10) / 10,      target: targets.fat,      pct: Math.round((todayTotals.fat / targets.fat) * 100),      color: C.violet, unit: "g" },
  ];

  const proteinPct = macros[0].pct;

  // Best / worst meal
  const scoredMeals = MEAL_KEYS.map(k => ({ key: k, label: MEAL_LABELS[k], icon: MEAL_ICONS[k], score: (meals as any)[k]?.mealScore || null, color: MEAL_COLORS[k] })).filter(x => x.score !== null);
  const bestMeal = scoredMeals.length >= 2 ? scoredMeals.reduce((a, b) => a.score >= b.score ? a : b) : null;
  const worstMeal = scoredMeals.length >= 2 ? scoredMeals.reduce((a, b) => a.score <= b.score ? a : b) : null;
  const showAward = bestMeal && worstMeal && bestMeal.key !== worstMeal.key;

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
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.textSub, fontSize: 13, cursor: "pointer" }}>
          {"<-"} Dashboard
        </button>
      </div>

      {/* Today Mission */}
      <div style={g({ padding: "18px 22px", marginBottom: 16, border: `1px solid ${C.emerald}25` })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.emerald, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              今日蛋白任务
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: C.text }}>{Math.round(todayTotals.protein * 10) / 10}</span>
              <span style={{ fontSize: 13, color: C.textMuted }}>/ {targets.protein}g</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: Math.round(todayTotals.protein * 10) / 10 >= targets.protein ? C.emerald : C.amber }}>
                {Math.round(todayTotals.protein * 10) / 10 >= targets.protein ? "✓ 已达标" : `还差 ${Math.max(0, targets.protein - Math.round(todayTotals.protein * 10) / 10)}g`}
              </span>
            </div>
          </div>
          {!missionResult && (
            <button onClick={fetchMission} disabled={missionLoading || (!aiCfg.apiKey && aiCfg.provider !== "ollama")}
              style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.emerald}40`, background: C.emeraldDim, color: C.emerald, fontSize: 12, fontWeight: 700, cursor: missionLoading ? "not-allowed" : "pointer" }}>
              {missionLoading ? "生成中..." : (!aiCfg.apiKey && aiCfg.provider !== "ollama") ? "需配置AI" : "AI 推荐食物"}
            </button>
          )}
        </div>
        {missionResult && (
          <div>
            {missionResult.mission && (
              <div style={{ fontSize: 13, color: C.textSub, marginBottom: 10, padding: "6px 10px", borderRadius: 8, background: "rgba(16,185,129,0.07)" }}>
                🎯 {missionResult.mission}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>优先完成：</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(missionResult.foods || []).map((f: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 14 }}>{"🥩🥚🥛"[i]}</span>
                  <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{f.desc}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.emerald }}>+{f.protein}g</span>
                </div>
              ))}
            </div>
            <button onClick={() => setMissionResult(null)} style={{ marginTop: 8, fontSize: 11, color: C.textMuted, background: "none", border: "none", cursor: "pointer" }}>重新生成</button>
          </div>
        )}
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
                  <span style={{ fontSize: 11, color: over ? barColor : mac.color, fontWeight: 700 }}>{mac.pct}%{over && " ↑"}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, mac.pct)}%`, background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>
                  {mac.current}<span style={{ fontSize: 10, color: C.textMuted, fontWeight: 400 }}>/{mac.target}{mac.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gap Analysis */}
      <div style={g({ padding: "16px 20px", marginBottom: 16, border: `1px solid ${C.border}` })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: gapResult ? 14 : 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>今日缺口</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
              蛋白还差 <span style={{ color: C.emerald, fontWeight: 700 }}>{Math.max(0, targets.protein - Math.round(todayTotals.protein * 10) / 10)}g</span>
              {" · "}热量还差 <span style={{ color: C.amber, fontWeight: 700 }}>{Math.max(0, targets.calories - Math.round(todayTotals.calories))}kcal</span>
            </div>
          </div>
          <button onClick={fetchGap} disabled={gapLoading}
            style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${C.emerald}40`, background: C.emeraldDim, color: C.emerald, fontSize: 12, fontWeight: 700, cursor: gapLoading ? "not-allowed" : "pointer" }}>
            {gapLoading ? "分析中..." : "AI 补充方案"}
          </button>
        </div>
        {gapResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>{gapResult.gapSummary}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(gapResult.suggestions || []).map((s: any, i: number) => (
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

      {/* Best / Worst meal award */}
      {showAward && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[
            { title: "🏆 今日最佳餐", meal: bestMeal!, color: C.emerald, dim: C.emeraldDim },
            { title: "⚠️ 最需改善",   meal: worstMeal!, color: C.amber,   dim: C.amberDim },
          ].map(({ title, meal, color, dim }) => (
            <div key={meal.key} style={{ ...g({ padding: "12px 16px", border: `1px solid ${color}25` }), background: dim }}>
              <div style={{ fontSize: 10, color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{title}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{meal.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{meal.label}</div>
                  <div style={{ fontSize: 11, color, fontWeight: 800 }}>{meal.score} 分</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meal Cards */}
      <div style={{ marginBottom: 8 }}>
        {MEAL_KEYS.map(key => (
          <NutritionMealCard
            key={key} mealKey={key} meal={(meals as any)[key]}
            onAdd={handleAddItems} onRemove={handleRemoveItem} onClear={handleClearMeal}
            proteinTarget={targets.protein} calTarget={targets.calories} aiCfg={aiCfg}
          />
        ))}
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 8 }}>
        饮食数据已自动同步到 Compliance Score · 蛋白达成率 {proteinPct}%
      </div>
    </div>
  );
}
