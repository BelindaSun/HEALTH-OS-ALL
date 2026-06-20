"use client";

import { useState, useRef, useCallback } from "react";
import { C, g, VISION_PROVIDERS, TEXT_PROVIDERS } from "../constants";
import { AppState } from "../types";
import { callVisionAI, parseJSON } from "../lib/ai";
import { Bar, GaugeArc, NumField } from "./ui";

// ── STEP GOAL: ONBOARDING TARGET SELECTION ───────────────────
export function StepGoal({
  onSelect,
  onBack,
}: {
  onSelect: (goal: string, healthGoal: string) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const GOALS = [
    {
      goal: "weight_loss",
      healthGoal: "fat_loss",
      icon: "🔥",
      label: "减脂瘦身",
      desc: "降低体脂，提升体型线条",
      color: C.amber,
    },
    {
      goal: "muscle_gain",
      healthGoal: "muscle_gain",
      icon: "💪",
      label: "增肌塑形",
      desc: "增加肌肉量，提升力量",
      color: C.emerald,
    },
    {
      goal: "recomposition",
      healthGoal: "fitness",
      icon: "⚡",
      label: "体态重塑",
      desc: "减脂同时增肌，全面改善",
      color: C.violet,
    },
    {
      goal: "maintain",
      healthGoal: "fat_loss",
      icon: "✨",
      label: "维持体形",
      desc: "保持现有状态，优化健康",
      color: C.sky,
    },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 20 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          第一步
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.text,
            marginBottom: 10,
            lineHeight: 1.2,
          }}
        >
          你最想改变什么？
        </h2>
        <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          系统会根据你的目标调整所有分析和建议
        </p>
      </div>

      {/* Goal cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {GOALS.map((g) => {
          const isSelected = selected === g.goal;
          return (
            <button
              key={g.goal}
              onClick={() => setSelected(g.goal)}
              style={{
                padding: "20px 16px",
                borderRadius: 20,
                border: `2px solid ${isSelected ? g.color : "rgba(255,255,255,0.07)"}`,
                background: isSelected ? g.color + "15" : "rgba(15,23,42,0.85)",
                backdropFilter: "blur(20px)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: g.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#020817",
                    fontWeight: 800,
                  }}
                >
                  ✓
                </div>
              )}
              <div style={{ fontSize: 28, marginBottom: 10 }}>{g.icon}</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: isSelected ? g.color : C.text,
                  marginBottom: 4,
                }}
              >
                {g.label}
              </div>
              <div
                style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}
              >
                {g.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={() => {
          const g = GOALS.find((x) => x.goal === selected);
          if (g) onSelect(g.goal, g.healthGoal);
        }}
        disabled={!selected}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: 14,
          border: "none",
          background: selected
            ? `linear-gradient(135deg,${C.emerald},#059669)`
            : "rgba(255,255,255,0.05)",
          color: selected ? "#fff" : C.textMuted,
          fontSize: 16,
          fontWeight: 700,
          cursor: selected ? "pointer" : "not-allowed",
          marginBottom: 14,
          transition: "all 0.15s",
        }}
      >
        {selected ? "继续 →" : "请选择一个目标"}
      </button>

      <button
        onClick={onBack}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: "transparent",
          color: C.textMuted,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ← 返回
      </button>
    </div>
  );
}

// ── STEP 1: IMPORT ────────────────────────────────────────────
export function StepImport({
  state,
  onUpdate,
  onNext,
}: {
  state: AppState;
  onUpdate: (k: string, v: any) => void;
  onNext: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) {
        setParseError("请上传图片文件（JPG / PNG / HEIC）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target!.result as string);
        onUpdate("imageFile", file);
        onUpdate("imageBase64", (e.target!.result as string).split(",")[1]);
      };
      reader.readAsDataURL(file);
      setParseError(null);
    },
    [onUpdate],
  );

  const handleParse = async () => {
    if (!state.imageBase64) {
      setParseError("请先上传截图");
      return;
    }
    if (!state.visionApiKey && state.visionProvider !== "ollama") {
      setParseError("请填写 API Key");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const raw = await callVisionAI(
        state.imageBase64,
        state.visionProvider,
        state.visionApiKey,
        state.visionModel,
      );
      const parsed = parseJSON(raw);
      const fields = [
        "weight",
        "skeletalMuscleMass",
        "bodyFatMass",
        "bodyFatPercentage",
        "totalBodyWater",
        "intracellularWater",
        "extracellularWater",
        "protein",
        "minerals",
        "leanBodyMass",
        "basalMetabolicRate",
        "bmi",
        "visceralFatLevel",
        "waistHipRatio",
        "inBodyScore",
      ];
      const m: Record<string, any> = {};
      fields.forEach((f) => {
        if (parsed[f] != null) m[f] = parsed[f];
      });
      if (parsed.segmentalLeanMass)
        m.segmentalLeanMass = parsed.segmentalLeanMass;
      if (!m.leanBodyMass && m.weight && m.bodyFatMass)
        m.leanBodyMass = parseFloat((m.weight - m.bodyFatMass).toFixed(2));
      onUpdate("measurements", { ...state.measurements, ...m });
      onUpdate("parseSuccess", true);
      onUpdate("parsedFields", Object.keys(m).length);
    } catch (e: any) {
      setParseError(e.message || "识别失败，请重试或切换到手动填写");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          01 / 02
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          上传 InBody 截图
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 8 }}>
          拍照或截图你的 InBody 报告，AI 自动识别所有数值
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        style={g({
          border: `2px dashed ${dragging ? C.emerald : preview ? C.emerald : "rgba(255,255,255,0.12)"}`,
          background: dragging ? C.emeraldDim : "transparent",
          padding: preview ? "16px" : "48px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 20,
          transition: "all .2s",
          touchAction: "manipulation",
          WebkitAppearance: "none",
        })}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <div>
            <img
              src={preview}
              alt="InBody report"
              style={{
                maxWidth: "100%",
                maxHeight: 280,
                borderRadius: 12,
                objectFit: "contain",
              }}
            />
            <div style={{ color: C.emerald, fontSize: 13, marginTop: 10 }}>
              点击重新选择
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 14 }}>
              📱
            </div>
            <div style={{ color: C.textSub, fontSize: 15, marginBottom: 6 }}>
              点击上传 或 拖拽图片到此处
            </div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>
              支持 JPG / PNG / HEIC
            </div>
          </>
        )}
      </div>

      {state.parseSuccess && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: C.emeraldDim,
            border: `1px solid ${C.emerald}30`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.emerald,
              marginBottom: 4,
            }}
          >
            {"✅ 识别成功！共提取 "}
            {state.parsedFields}
            {" 个字段"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            下一步可核对并补填缺失数值
          </div>
        </div>
      )}

      {/* AI识别区 — 引擎配置在"我的档案 > 高级设置"里 */}
      {!state.visionApiKey && state.visionProvider !== "ollama" && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 16,
            background: C.amberDim,
            border: `1px solid ${C.amber}30`,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.amber,
                marginBottom: 2,
              }}
            >
              需要配置 AI Key
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              前往「我的档案 → 高级设置」配置 API Key 后即可自动识别
            </div>
          </div>
        </div>
      )}

      {parseError && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: C.roseDim,
            border: `1px solid ${C.rose}30`,
            fontSize: 13,
            color: C.rose,
            marginBottom: 12,
          }}
        >
          {"⚠ "}
          {parseError}
        </div>
      )}

      <button
        onClick={handleParse}
        disabled={
          parsing ||
          !preview ||
          (!state.visionApiKey && state.visionProvider !== "ollama")
        }
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 14,
          border: "none",
          marginBottom: 16,
          background:
            !preview ||
            parsing ||
            (!state.visionApiKey && state.visionProvider !== "ollama")
              ? "rgba(255,255,255,0.05)"
              : `linear-gradient(135deg,${C.emerald},#059669)`,
          color:
            !preview ||
            parsing ||
            (!state.visionApiKey && state.visionProvider !== "ollama")
              ? C.textMuted
              : "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: !preview || parsing ? "not-allowed" : "pointer",
        }}
      >
        {parsing
          ? "AI 识别中..."
          : !state.visionApiKey && state.visionProvider !== "ollama"
            ? "请先配置 API Key"
            : preview
              ? "开始识别"
              : "请先上传截图"}
      </button>

      {/* 识别成功后进入核对页 */}
      {state.parseSuccess && (
        <button
          onClick={onNext}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 14,
            border: "none",
            background: `linear-gradient(135deg,${C.emerald},#059669)`,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 10,
          }}
        >
          核对/手动填写数据 →
        </button>
      )}

      {/* 没有API Key也可以跳过直接手动填写 */}
      {!state.parseSuccess && (
        <button
          onClick={() => {
            onUpdate("parseSuccess", true);
            onNext();
          }}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 14,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textMuted,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          跳过，直接手动填写 →
        </button>
      )}
    </div>
  );
}

// ── BODY TAB CONTENT (quick + expandable) ────────────────────
function BodyTabContent({
  m,
  setM,
}: {
  m: any;
  setM: (k: string, v: any) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  return (
    <>
      {/* 必填三项 */}
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          color: C.emerald,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        核心数据（必填）
      </div>
      <NumField
        label="体重"
        value={m.weight}
        onChange={(v) => setM("weight", v)}
        unit="kg"
      />
      <NumField
        label="体脂率 (PBF)"
        value={m.bodyFatPercentage}
        onChange={(v) => setM("bodyFatPercentage", v)}
        unit="%"
        hint="Percent Body Fat"
        color={C.amber}
      />
      <NumField
        label="骨骼肌量 (SMM)"
        value={m.skeletalMuscleMass}
        onChange={(v) => setM("skeletalMuscleMass", v)}
        unit="kg"
        hint="Skeletal Muscle Mass"
        color={C.emerald}
      />

      {/* 展开更多 */}
      <button
        onClick={() => setShowMore((v) => !v)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: 10,
          marginTop: 4,
          marginBottom: showMore ? 12 : 0,
          border: `1px solid ${C.border}`,
          background: "transparent",
          color: C.textMuted,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {showMore ? "▲ 收起选填项" : "▼ 展开更多字段（选填）"}
      </button>

      {showMore && (
        <>
          <div
            style={{
              marginBottom: 8,
              fontSize: 11,
              color: C.textMuted,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            选填数据
          </div>
          <NumField
            label="体脂肪量"
            value={m.bodyFatMass}
            onChange={(v) => setM("bodyFatMass", v)}
            unit="kg"
            color={C.amber}
          />
          <NumField
            label="去脂体重 (LBM)"
            value={m.leanBodyMass}
            onChange={(v) => setM("leanBodyMass", v)}
            unit="kg"
            hint="自动计算: 体重-体脂"
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <NumField
              label="蛋白质"
              value={m.protein}
              onChange={(v) => setM("protein", v)}
              unit="kg"
            />
            <NumField
              label="无机盐"
              value={m.minerals}
              onChange={(v) => setM("minerals", v)}
              unit="kg"
            />
          </div>
        </>
      )}
    </>
  );
}

// ── STEP 2: MEASUREMENTS ──────────────────────────────────────
export function StepMeasurements({
  state,
  onUpdate,
  onNext,
  onBack,
}: {
  state: AppState;
  onUpdate: (k: string, v: any) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const m = state.measurements;
  const setM = (k: string, v: any) =>
    onUpdate("measurements", { ...m, [k]: v });
  const setSeg = (k: string, v: any) =>
    onUpdate("measurements", {
      ...m,
      segmentalLeanMass: { ...m.segmentalLeanMass, [k]: v },
    });
  const [tab, setTab] = useState("body");
  const TABS = [
    { id: "body", label: "⚖ 体成分" },
    { id: "water", label: "💧 水分" },
    { id: "meta", label: "🔥 代谢" },
    { id: "risk", label: "⚡ 风险" },
    { id: "seg", label: "💪 节段" },
  ];
  const ecwRatio =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          02 / 02
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          核对 / 手动填写数据
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
          {state.parseSuccess && state.parsedFields > 0
            ? `AI 已识别 ${state.parsedFields} 个字段，请核对并补填缺失项`
            : "请对照报告逐项填写"}
        </p>
      </div>

      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              outline: "none",
              cursor: "pointer",
              border: `1px solid ${tab === t.id ? C.emerald + "50" : "transparent"}`,
              background:
                tab === t.id ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: tab === t.id ? C.emerald : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={g({ padding: "24px" })}>
        {tab === "body" && <BodyTabContent m={m} setM={setM} />}
        {tab === "water" && (
          <>
            <NumField
              label="体水分 (TBW)"
              value={m.totalBodyWater}
              onChange={(v) => setM("totalBodyWater", v)}
              unit="L"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="细胞内水分 (ICW)"
                value={m.intracellularWater}
                onChange={(v) => setM("intracellularWater", v)}
                unit="L"
                color={C.sky}
              />
              <NumField
                label="细胞外水分 (ECW)"
                value={m.extracellularWater}
                onChange={(v) => setM("extracellularWater", v)}
                unit="L"
                color={C.sky}
              />
            </div>
            {ecwRatio && (
              <div
                style={{
                  marginTop: 8,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background:
                    parseFloat(ecwRatio) >= 0.38 ? C.amberDim : C.emeraldDim,
                  border: `1px solid ${parseFloat(ecwRatio) >= 0.38 ? C.amber + "40" : C.emerald + "40"}`,
                }}
              >
                <span style={{ fontSize: 13, color: C.textSub }}>
                  ECW/TBW:{" "}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: parseFloat(ecwRatio) >= 0.38 ? C.amber : C.emerald,
                  }}
                >
                  {ecwRatio}
                </span>
                <span
                  style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}
                >
                  {parseFloat(ecwRatio) >= 0.38 ? "⚠ 偏高，水肿风险" : "✓ 正常"}
                </span>
              </div>
            )}
          </>
        )}
        {tab === "meta" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.emerald}25`,
                background: C.emeraldDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.emerald,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"🔬 InBody 实测 BMR"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                InBody 直接测量，精度高于公式估算，所有营养计算均基于此值。
              </div>
            </div>
            <NumField
              label="基础代谢率 (BMR)"
              value={m.basalMetabolicRate}
              onChange={(v) => setM("basalMetabolicRate", v)}
              unit="kcal"
              hint="Basal Metabolic Rate"
              color={C.emerald}
            />
            <NumField
              label="BMI"
              value={m.bmi}
              onChange={(v) => setM("bmi", v)}
              unit=""
            />
          </>
        )}
        {tab === "risk" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 5 }}>
                内脏脂肪等级 (VFL 1-20)
              </div>
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={m.visceralFatLevel || ""}
                placeholder="0"
                onChange={(e) =>
                  setM("visceralFatLevel", parseInt(e.target.value) || 0)
                }
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.visceralFatLevel >= 10 ? C.amber + "60" : C.border}`,
                  borderRadius: 10,
                  color: m.visceralFatLevel >= 10 ? C.amber : C.text,
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              {m.visceralFatLevel > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color:
                      m.visceralFatLevel >= 10
                        ? C.rose
                        : m.visceralFatLevel >= 5
                          ? C.amber
                          : C.emerald,
                  }}
                >
                  {m.visceralFatLevel <= 4
                    ? "✓ 正常(1-4)"
                    : m.visceralFatLevel <= 9
                      ? "⚠ 偏高(5-9)"
                      : m.visceralFatLevel <= 14
                        ? "🚨 高风险(10-14)"
                        : "🚨 极高风险(15-20)"}
                </div>
              )}
            </div>
            <NumField
              label="腰臀比 (WHR)"
              value={m.waistHipRatio}
              onChange={(v) => setM("waistHipRatio", v)}
              unit=""
              hint="男>0.9 / 女>0.85 高风险"
              color={C.amber}
            />
            <NumField
              label="InBody 评分（可选）"
              value={m.inBodyScore || 0}
              onChange={(v) => setM("inBodyScore", v)}
              unit="分"
              hint="0-100"
            />
          </>
        )}
        {tab === "seg" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.sky}25`,
                background: C.skyDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.sky,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"💡 节段骨骼肌（可选）"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                用于判断肌肉不平衡，差异 {">"} 10% 触发矫正训练建议。
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <NumField
                label="右臂"
                value={m.segmentalLeanMass?.rightArm || 0}
                onChange={(v) => setSeg("rightArm", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左臂"
                value={m.segmentalLeanMass?.leftArm || 0}
                onChange={(v) => setSeg("leftArm", v)}
                unit="kg"
                color={C.sky}
              />
            </div>
            <NumField
              label="躯干"
              value={m.segmentalLeanMass?.trunk || 0}
              onChange={(v) => setSeg("trunk", v)}
              unit="kg"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="右腿"
                value={m.segmentalLeanMass?.rightLeg || 0}
                onChange={(v) => setSeg("rightLeg", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左腿"
                value={m.segmentalLeanMass?.leftLeg || 0}
                onChange={(v) => setSeg("leftLeg", v)}
                unit="kg"
                color={C.sky}
              />
            </div>
          </>
        )}
      </div>

      {/* Data preview */}
      {m.weight > 0 && m.basalMetabolicRate > 0 && (
        <div
          style={g({
            padding: "20px 22px",
            marginTop: 20,
            border: `1px solid ${C.emerald}20`,
          })}
        >
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            数据预览
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 10,
            }}
          >
            {[
              {
                label: "体重",
                val: m.weight,
                unit: "kg",
                color: C.text,
                icon: "⚖️",
              },
              {
                label: "骨骼肌",
                val: m.skeletalMuscleMass,
                unit: "kg",
                color: C.emerald,
                icon: "💪",
              },
              {
                label: "体脂率",
                val: m.bodyFatPercentage,
                unit: "%",
                color: C.amber,
                icon: "🔥",
              },
              {
                label: "实测BMR",
                val: m.basalMetabolicRate,
                unit: "kcal",
                color: C.sky,
                icon: "⚡",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={g({
                  padding: "12px 14px",
                  border: `1px solid ${item.color}18`,
                  textAlign: "center",
                })}
              >
                <div style={{ fontSize: 15, marginBottom: 5 }}>{item.icon}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.val}
                  <span
                    style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}
                  >
                    {item.unit}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textMuted,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {"<"} 返回
        </button>
        <button
          onClick={onNext}
          disabled={!m.weight || !m.basalMetabolicRate}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background:
              m.weight && m.basalMetabolicRate
                ? `linear-gradient(135deg,${C.emerald},#059669)`
                : "rgba(255,255,255,0.05)",
            color: m.weight && m.basalMetabolicRate ? "#fff" : C.textMuted,
            fontSize: 15,
            fontWeight: 700,
            cursor:
              m.weight && m.basalMetabolicRate ? "pointer" : "not-allowed",
          }}
        >
          {m.weight && m.basalMetabolicRate
            ? "填写基础信息 ->"
            : "请至少填写体重和BMR"}
        </button>
      </div>
    </div>
  );
}
"use client";

import { useState, useRef, useCallback } from "react";
import { C, g, VISION_PROVIDERS, TEXT_PROVIDERS } from "../constants";
import { AppState } from "../types";
import { callVisionAI, parseJSON } from "../lib/ai";
import { Bar, GaugeArc, NumField } from "./ui";

// ── STEP GOAL: ONBOARDING TARGET SELECTION ───────────────────
export function StepGoal({
  onSelect,
  onBack,
}: {
  onSelect: (goal: string, healthGoal: string) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const GOALS = [
    {
      goal: "weight_loss",
      healthGoal: "fat_loss",
      icon: "🔥",
      label: "减脂瘦身",
      desc: "降低体脂，提升体型线条",
      color: C.amber,
    },
    {
      goal: "muscle_gain",
      healthGoal: "muscle_gain",
      icon: "💪",
      label: "增肌塑形",
      desc: "增加肌肉量，提升力量",
      color: C.emerald,
    },
    {
      goal: "recomposition",
      healthGoal: "fitness",
      icon: "⚡",
      label: "体态重塑",
      desc: "减脂同时增肌，全面改善",
      color: C.violet,
    },
    {
      goal: "maintain",
      healthGoal: "fat_loss",
      icon: "✨",
      label: "维持体形",
      desc: "保持现有状态，优化健康",
      color: C.sky,
    },
  ];

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: 20 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 12,
            textTransform: "uppercase",
          }}
        >
          第一步
        </div>
        <h2
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: C.text,
            marginBottom: 10,
            lineHeight: 1.2,
          }}
        >
          你最想改变什么？
        </h2>
        <p style={{ fontSize: 14, color: C.textMuted, lineHeight: 1.6 }}>
          系统会根据你的目标调整所有分析和建议
        </p>
      </div>

      {/* Goal cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginBottom: 28,
        }}
      >
        {GOALS.map((g) => {
          const isSelected = selected === g.goal;
          return (
            <button
              key={g.goal}
              onClick={() => setSelected(g.goal)}
              style={{
                padding: "20px 16px",
                borderRadius: 20,
                border: `2px solid ${isSelected ? g.color : "rgba(255,255,255,0.07)"}`,
                background: isSelected ? g.color + "15" : "rgba(15,23,42,0.85)",
                backdropFilter: "blur(20px)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
                position: "relative",
              }}
            >
              {isSelected && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 12,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: g.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    color: "#020817",
                    fontWeight: 800,
                  }}
                >
                  ✓
                </div>
              )}
              <div style={{ fontSize: 28, marginBottom: 10 }}>{g.icon}</div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: isSelected ? g.color : C.text,
                  marginBottom: 4,
                }}
              >
                {g.label}
              </div>
              <div
                style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}
              >
                {g.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* CTA */}
      <button
        onClick={() => {
          const g = GOALS.find((x) => x.goal === selected);
          if (g) onSelect(g.goal, g.healthGoal);
        }}
        disabled={!selected}
        style={{
          width: "100%",
          padding: "15px",
          borderRadius: 14,
          border: "none",
          background: selected
            ? `linear-gradient(135deg,${C.emerald},#059669)`
            : "rgba(255,255,255,0.05)",
          color: selected ? "#fff" : C.textMuted,
          fontSize: 16,
          fontWeight: 700,
          cursor: selected ? "pointer" : "not-allowed",
          marginBottom: 14,
          transition: "all 0.15s",
        }}
      >
        {selected ? "继续 →" : "请选择一个目标"}
      </button>

      <button
        onClick={onBack}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: "transparent",
          color: C.textMuted,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ← 返回
      </button>
    </div>
  );
}

// ── STEP 1: IMPORT ────────────────────────────────────────────
export function StepImport({
  state,
  onUpdate,
  onNext,
}: {
  state: AppState;
  onUpdate: (k: string, v: any) => void;
  onNext: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file || !file.type.startsWith("image/")) {
        setParseError("请上传图片文件（JPG / PNG / HEIC）");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target!.result as string);
        onUpdate("imageFile", file);
        onUpdate("imageBase64", (e.target!.result as string).split(",")[1]);
      };
      reader.readAsDataURL(file);
      setParseError(null);
    },
    [onUpdate],
  );

  const handleParse = async () => {
    if (!state.imageBase64) {
      setParseError("请先上传截图");
      return;
    }
    if (!state.visionApiKey && state.visionProvider !== "ollama") {
      setParseError("请填写 API Key");
      return;
    }
    setParsing(true);
    setParseError(null);
    try {
      const raw = await callVisionAI(
        state.imageBase64,
        state.visionProvider,
        state.visionApiKey,
        state.visionModel,
      );
      const parsed = parseJSON(raw);
      const fields = [
        "weight",
        "skeletalMuscleMass",
        "bodyFatMass",
        "bodyFatPercentage",
        "totalBodyWater",
        "intracellularWater",
        "extracellularWater",
        "protein",
        "minerals",
        "leanBodyMass",
        "basalMetabolicRate",
        "bmi",
        "visceralFatLevel",
        "waistHipRatio",
        "inBodyScore",
      ];
      const m: Record<string, any> = {};
      fields.forEach((f) => {
        if (parsed[f] != null) m[f] = parsed[f];
      });
      if (parsed.segmentalLeanMass)
        m.segmentalLeanMass = parsed.segmentalLeanMass;
      if (!m.leanBodyMass && m.weight && m.bodyFatMass)
        m.leanBodyMass = parseFloat((m.weight - m.bodyFatMass).toFixed(2));
      onUpdate("measurements", { ...state.measurements, ...m });
      onUpdate("parseSuccess", true);
      onUpdate("parsedFields", Object.keys(m).length);
    } catch (e: any) {
      setParseError(e.message || "识别失败，请重试或切换到手动填写");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          01 / 02
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          上传 InBody 截图
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 8 }}>
          拍照或截图你的 InBody 报告，AI 自动识别所有数值
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
        style={g({
          border: `2px dashed ${dragging ? C.emerald : preview ? C.emerald : "rgba(255,255,255,0.12)"}`,
          background: dragging ? C.emeraldDim : "transparent",
          padding: preview ? "16px" : "48px 20px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 20,
          transition: "all .2s",
          touchAction: "manipulation",
          WebkitAppearance: "none",
        })}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {preview ? (
          <div>
            <img
              src={preview}
              alt="InBody report"
              style={{
                maxWidth: "100%",
                maxHeight: 280,
                borderRadius: 12,
                objectFit: "contain",
              }}
            />
            <div style={{ color: C.emerald, fontSize: 13, marginTop: 10 }}>
              点击重新选择
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 14 }}>
              📱
            </div>
            <div style={{ color: C.textSub, fontSize: 15, marginBottom: 6 }}>
              点击上传 或 拖拽图片到此处
            </div>
            <div style={{ color: C.textMuted, fontSize: 12 }}>
              支持 JPG / PNG / HEIC
            </div>
          </>
        )}
      </div>

      {state.parseSuccess && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: C.emeraldDim,
            border: `1px solid ${C.emerald}30`,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: C.emerald,
              marginBottom: 4,
            }}
          >
            {"✅ 识别成功！共提取 "}
            {state.parsedFields}
            {" 个字段"}
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            下一步可核对并补填缺失数值
          </div>
        </div>
      )}

      {/* AI识别区 — 引擎配置在"我的档案 > 高级设置"里 */}
      {!state.visionApiKey && state.visionProvider !== "ollama" && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: 16,
            background: C.amberDim,
            border: `1px solid ${C.amber}30`,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.amber,
                marginBottom: 2,
              }}
            >
              需要配置 AI Key
            </div>
            <div style={{ fontSize: 12, color: C.textMuted }}>
              前往「我的档案 → 高级设置」配置 API Key 后即可自动识别
            </div>
          </div>
        </div>
      )}

      {parseError && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: C.roseDim,
            border: `1px solid ${C.rose}30`,
            fontSize: 13,
            color: C.rose,
            marginBottom: 12,
          }}
        >
          {"⚠ "}
          {parseError}
        </div>
      )}

      <button
        onClick={handleParse}
        disabled={
          parsing ||
          !preview ||
          (!state.visionApiKey && state.visionProvider !== "ollama")
        }
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 14,
          border: "none",
          marginBottom: 16,
          background:
            !preview ||
            parsing ||
            (!state.visionApiKey && state.visionProvider !== "ollama")
              ? "rgba(255,255,255,0.05)"
              : `linear-gradient(135deg,${C.emerald},#059669)`,
          color:
            !preview ||
            parsing ||
            (!state.visionApiKey && state.visionProvider !== "ollama")
              ? C.textMuted
              : "#fff",
          fontSize: 15,
          fontWeight: 700,
          cursor: !preview || parsing ? "not-allowed" : "pointer",
        }}
      >
        {parsing
          ? "AI 识别中..."
          : !state.visionApiKey && state.visionProvider !== "ollama"
            ? "请先配置 API Key"
            : preview
              ? "开始识别"
              : "请先上传截图"}
      </button>

      <button
        onClick={onNext}
        disabled={!state.parseSuccess}
        style={{
          width: "100%",
          padding: "14px",
          borderRadius: 14,
          border: "none",
          background: state.parseSuccess
            ? `linear-gradient(135deg,${C.emerald},#059669)`
            : "rgba(255,255,255,0.04)",
          color: state.parseSuccess ? "#fff" : C.textMuted,
          fontSize: 15,
          fontWeight: 700,
          cursor: state.parseSuccess ? "pointer" : "not-allowed",
        }}
      >
        {state.parseSuccess ? "核对/手动填写数据 ->" : "请先上传截图后识别"}
      </button>
    </div>
  );
}

// ── BODY TAB CONTENT (quick + expandable) ────────────────────
function BodyTabContent({
  m,
  setM,
}: {
  m: any;
  setM: (k: string, v: any) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  return (
    <>
      {/* 必填三项 */}
      <div
        style={{
          marginBottom: 8,
          fontSize: 11,
          color: C.emerald,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        核心数据（必填）
      </div>
      <NumField
        label="体重"
        value={m.weight}
        onChange={(v) => setM("weight", v)}
        unit="kg"
      />
      <NumField
        label="体脂率 (PBF)"
        value={m.bodyFatPercentage}
        onChange={(v) => setM("bodyFatPercentage", v)}
        unit="%"
        hint="Percent Body Fat"
        color={C.amber}
      />
      <NumField
        label="骨骼肌量 (SMM)"
        value={m.skeletalMuscleMass}
        onChange={(v) => setM("skeletalMuscleMass", v)}
        unit="kg"
        hint="Skeletal Muscle Mass"
        color={C.emerald}
      />

      {/* 展开更多 */}
      <button
        onClick={() => setShowMore((v) => !v)}
        style={{
          width: "100%",
          padding: "8px",
          borderRadius: 10,
          marginTop: 4,
          marginBottom: showMore ? 12 : 0,
          border: `1px solid ${C.border}`,
          background: "transparent",
          color: C.textMuted,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {showMore ? "▲ 收起选填项" : "▼ 展开更多字段（选填）"}
      </button>

      {showMore && (
        <>
          <div
            style={{
              marginBottom: 8,
              fontSize: 11,
              color: C.textMuted,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            选填数据
          </div>
          <NumField
            label="体脂肪量"
            value={m.bodyFatMass}
            onChange={(v) => setM("bodyFatMass", v)}
            unit="kg"
            color={C.amber}
          />
          <NumField
            label="去脂体重 (LBM)"
            value={m.leanBodyMass}
            onChange={(v) => setM("leanBodyMass", v)}
            unit="kg"
            hint="自动计算: 体重-体脂"
          />
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <NumField
              label="蛋白质"
              value={m.protein}
              onChange={(v) => setM("protein", v)}
              unit="kg"
            />
            <NumField
              label="无机盐"
              value={m.minerals}
              onChange={(v) => setM("minerals", v)}
              unit="kg"
            />
          </div>
        </>
      )}
    </>
  );
}

// ── STEP 2: MEASUREMENTS ──────────────────────────────────────
export function StepMeasurements({
  state,
  onUpdate,
  onNext,
  onBack,
}: {
  state: AppState;
  onUpdate: (k: string, v: any) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const m = state.measurements;
  const setM = (k: string, v: any) =>
    onUpdate("measurements", { ...m, [k]: v });
  const setSeg = (k: string, v: any) =>
    onUpdate("measurements", {
      ...m,
      segmentalLeanMass: { ...m.segmentalLeanMass, [k]: v },
    });
  const [tab, setTab] = useState("body");
  const TABS = [
    { id: "body", label: "⚖ 体成分" },
    { id: "water", label: "💧 水分" },
    { id: "meta", label: "🔥 代谢" },
    { id: "risk", label: "⚡ 风险" },
    { id: "seg", label: "💪 节段" },
  ];
  const ecwRatio =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : null;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.2em",
            color: C.emerald,
            marginBottom: 10,
            textTransform: "uppercase",
          }}
        >
          02 / 02
        </div>
        <h2 style={{ fontSize: 30, fontWeight: 800, color: C.text, margin: 0 }}>
          核对 / 手动填写数据
        </h2>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 6 }}>
          {state.parseSuccess && state.parsedFields > 0
            ? `AI 已识别 ${state.parsedFields} 个字段，请核对并补填缺失项`
            : "请对照报告逐项填写"}
        </p>
      </div>

      <div
        style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto" }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              outline: "none",
              cursor: "pointer",
              border: `1px solid ${tab === t.id ? C.emerald + "50" : "transparent"}`,
              background:
                tab === t.id ? C.emeraldDim : "rgba(255,255,255,0.04)",
              color: tab === t.id ? C.emerald : C.textMuted,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              transition: "all .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={g({ padding: "24px" })}>
        {tab === "body" && <BodyTabContent m={m} setM={setM} />}
        {tab === "water" && (
          <>
            <NumField
              label="体水分 (TBW)"
              value={m.totalBodyWater}
              onChange={(v) => setM("totalBodyWater", v)}
              unit="L"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="细胞内水分 (ICW)"
                value={m.intracellularWater}
                onChange={(v) => setM("intracellularWater", v)}
                unit="L"
                color={C.sky}
              />
              <NumField
                label="细胞外水分 (ECW)"
                value={m.extracellularWater}
                onChange={(v) => setM("extracellularWater", v)}
                unit="L"
                color={C.sky}
              />
            </div>
            {ecwRatio && (
              <div
                style={{
                  marginTop: 8,
                  padding: "12px 16px",
                  borderRadius: 12,
                  background:
                    parseFloat(ecwRatio) >= 0.38 ? C.amberDim : C.emeraldDim,
                  border: `1px solid ${parseFloat(ecwRatio) >= 0.38 ? C.amber + "40" : C.emerald + "40"}`,
                }}
              >
                <span style={{ fontSize: 13, color: C.textSub }}>
                  ECW/TBW:{" "}
                </span>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: parseFloat(ecwRatio) >= 0.38 ? C.amber : C.emerald,
                  }}
                >
                  {ecwRatio}
                </span>
                <span
                  style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}
                >
                  {parseFloat(ecwRatio) >= 0.38 ? "⚠ 偏高，水肿风险" : "✓ 正常"}
                </span>
              </div>
            )}
          </>
        )}
        {tab === "meta" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.emerald}25`,
                background: C.emeraldDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.emerald,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"🔬 InBody 实测 BMR"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                InBody 直接测量，精度高于公式估算，所有营养计算均基于此值。
              </div>
            </div>
            <NumField
              label="基础代谢率 (BMR)"
              value={m.basalMetabolicRate}
              onChange={(v) => setM("basalMetabolicRate", v)}
              unit="kcal"
              hint="Basal Metabolic Rate"
              color={C.emerald}
            />
            <NumField
              label="BMI"
              value={m.bmi}
              onChange={(v) => setM("bmi", v)}
              unit=""
            />
          </>
        )}
        {tab === "risk" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: C.textSub, marginBottom: 5 }}>
                内脏脂肪等级 (VFL 1-20)
              </div>
              <input
                type="number"
                min="1"
                max="20"
                step="1"
                value={m.visceralFatLevel || ""}
                placeholder="0"
                onChange={(e) =>
                  setM("visceralFatLevel", parseInt(e.target.value) || 0)
                }
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${m.visceralFatLevel >= 10 ? C.amber + "60" : C.border}`,
                  borderRadius: 10,
                  color: m.visceralFatLevel >= 10 ? C.amber : C.text,
                  fontSize: 15,
                  fontWeight: 600,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
              {m.visceralFatLevel > 0 && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color:
                      m.visceralFatLevel >= 10
                        ? C.rose
                        : m.visceralFatLevel >= 5
                          ? C.amber
                          : C.emerald,
                  }}
                >
                  {m.visceralFatLevel <= 4
                    ? "✓ 正常(1-4)"
                    : m.visceralFatLevel <= 9
                      ? "⚠ 偏高(5-9)"
                      : m.visceralFatLevel <= 14
                        ? "🚨 高风险(10-14)"
                        : "🚨 极高风险(15-20)"}
                </div>
              )}
            </div>
            <NumField
              label="腰臀比 (WHR)"
              value={m.waistHipRatio}
              onChange={(v) => setM("waistHipRatio", v)}
              unit=""
              hint="男>0.9 / 女>0.85 高风险"
              color={C.amber}
            />
            <NumField
              label="InBody 评分（可选）"
              value={m.inBodyScore || 0}
              onChange={(v) => setM("inBodyScore", v)}
              unit="分"
              hint="0-100"
            />
          </>
        )}
        {tab === "seg" && (
          <>
            <div
              style={g({
                border: `1px solid ${C.sky}25`,
                background: C.skyDim,
                padding: "12px 16px",
                marginBottom: 16,
              })}
            >
              <div
                style={{
                  fontSize: 12,
                  color: C.sky,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {"💡 节段骨骼肌（可选）"}
              </div>
              <div style={{ fontSize: 12, color: C.textMuted }}>
                用于判断肌肉不平衡，差异 {">"} 10% 触发矫正训练建议。
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <NumField
                label="右臂"
                value={m.segmentalLeanMass?.rightArm || 0}
                onChange={(v) => setSeg("rightArm", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左臂"
                value={m.segmentalLeanMass?.leftArm || 0}
                onChange={(v) => setSeg("leftArm", v)}
                unit="kg"
                color={C.sky}
              />
            </div>
            <NumField
              label="躯干"
              value={m.segmentalLeanMass?.trunk || 0}
              onChange={(v) => setSeg("trunk", v)}
              unit="kg"
              color={C.sky}
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <NumField
                label="右腿"
                value={m.segmentalLeanMass?.rightLeg || 0}
                onChange={(v) => setSeg("rightLeg", v)}
                unit="kg"
                color={C.sky}
              />
              <NumField
                label="左腿"
                value={m.segmentalLeanMass?.leftLeg || 0}
                onChange={(v) => setSeg("leftLeg", v)}
                unit="kg"
                color={C.sky}
              />
            </div>
          </>
        )}
      </div>

      {/* Data preview */}
      {m.weight > 0 && m.basalMetabolicRate > 0 && (
        <div
          style={g({
            padding: "20px 22px",
            marginTop: 20,
            border: `1px solid ${C.emerald}20`,
          })}
        >
          <div
            style={{
              fontSize: 11,
              color: C.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            数据预览
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 10,
            }}
          >
            {[
              {
                label: "体重",
                val: m.weight,
                unit: "kg",
                color: C.text,
                icon: "⚖️",
              },
              {
                label: "骨骼肌",
                val: m.skeletalMuscleMass,
                unit: "kg",
                color: C.emerald,
                icon: "💪",
              },
              {
                label: "体脂率",
                val: m.bodyFatPercentage,
                unit: "%",
                color: C.amber,
                icon: "🔥",
              },
              {
                label: "实测BMR",
                val: m.basalMetabolicRate,
                unit: "kcal",
                color: C.sky,
                icon: "⚡",
              },
            ].map((item, i) => (
              <div
                key={i}
                style={g({
                  padding: "12px 14px",
                  border: `1px solid ${item.color}18`,
                  textAlign: "center",
                })}
              >
                <div style={{ fontSize: 15, marginBottom: 5 }}>{item.icon}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: item.color,
                    lineHeight: 1,
                  }}
                >
                  {item.val}
                  <span
                    style={{ fontSize: 10, fontWeight: 400, marginLeft: 2 }}
                  >
                    {item.unit}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, marginTop: 3 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button
          onClick={onBack}
          style={{
            padding: "13px 22px",
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: "transparent",
            color: C.textMuted,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {"<"} 返回
        </button>
        <button
          onClick={onNext}
          disabled={!m.weight || !m.basalMetabolicRate}
          style={{
            flex: 1,
            padding: "13px",
            borderRadius: 12,
            border: "none",
            background:
              m.weight && m.basalMetabolicRate
                ? `linear-gradient(135deg,${C.emerald},#059669)`
                : "rgba(255,255,255,0.05)",
            color: m.weight && m.basalMetabolicRate ? "#fff" : C.textMuted,
            fontSize: 15,
            fontWeight: 700,
            cursor:
              m.weight && m.basalMetabolicRate ? "pointer" : "not-allowed",
          }}
        >
          {m.weight && m.basalMetabolicRate
            ? "填写基础信息 ->"
            : "请至少填写体重和BMR"}
        </button>
      </div>
    </div>
  );
}
