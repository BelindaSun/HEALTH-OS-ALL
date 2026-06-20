import { Measurements, AppState, CheckinData, LocalBodyScore } from "../types";
import { C } from "../constants";

export function calcBodyState(
  m: Measurements,
  p: AppState,
  checkin: CheckinData,
): LocalBodyScore | null {
  if (!m || !m.weight) return null;

  // ── BASELINE LAYER (40%) - slow variables from InBody ──
  const smmIdeal = p.gender === "female" ? m.weight * 0.38 : m.weight * 0.45;
  const smmRatio = m.skeletalMuscleMass / smmIdeal;
  const smmScore = Math.min(100, Math.round(smmRatio * 80 + (smmRatio >= 1 ? 20 : 0)));
  const bfIdeal = p.gender === "female" ? 22 : 15;
  const bfDiff = Math.abs(m.bodyFatPercentage - bfIdeal);
  const bfScore = Math.max(0, Math.round(100 - bfDiff * 4));
  let hydScore = 80;
  if (m.intracellularWater > 0) {
    const ecwRatio = m.extracellularWater / (m.intracellularWater + m.extracellularWater);
    if (ecwRatio < 0.36) hydScore = Math.round(60 + (ecwRatio / 0.36) * 20);
    else if (ecwRatio <= 0.38) hydScore = 100;
    else hydScore = Math.max(30, Math.round(100 - (ecwRatio - 0.38) * 500));
  }
  const vflScore = m.visceralFatLevel <= 4 ? 100
    : m.visceralFatLevel <= 9 ? Math.round(100 - (m.visceralFatLevel - 4) * 8)
    : Math.max(0, Math.round(60 - (m.visceralFatLevel - 9) * 6));
  const bmrEst = p.gender === "female"
    ? 10 * m.weight + 6.25 * p.heightCm - 5 * p.age - 161
    : 10 * m.weight + 6.25 * p.heightCm - 5 * p.age + 5;
  const bmrRatio = bmrEst > 0 ? m.basalMetabolicRate / bmrEst : 1;
  const metScore = Math.min(100, Math.round(bmrRatio * 85 + (bmrRatio >= 1 ? 15 : 0)));
  const baselineScore = Math.round(
    smmScore * 0.35 + bfScore * 0.30 + hydScore * 0.15 + vflScore * 0.12 + metScore * 0.08,
  );

  // ── RECOVERY LAYER (30%) ──
  const hasCheckin = checkin?.morningDone;
  const mc = checkin?.morning || {};
  let recoveryScore = 75;
  if (hasCheckin) {
    const sleepMap = [30, 55, 75, 95, 85];
    const sleepS = mc.sleepDuration !== undefined ? sleepMap[mc.sleepDuration] : 75;
    const qualityS = mc.sleepQuality ? mc.sleepQuality * 20 : 75;
    const fatigueS = mc.fatigue ? Math.round((11 - mc.fatigue) * 10) : 75;
    const sorenessS = mc.soreness ? Math.round((11 - mc.soreness) * 10) : 80;
    recoveryScore = Math.round(sleepS * 0.35 + qualityS * 0.30 + fatigueS * 0.20 + sorenessS * 0.15);
  }

  // ── BEHAVIOR LAYER (20%) ──
  const ec = checkin?.evening || {};
  let behaviorScore = 75;
  if (checkin?.eveningDone) {
    const proteinS = ec.proteinPct !== undefined ? ec.proteinPct : 70;
    const waterS = ec.waterMl ? Math.min(100, Math.round((ec.waterMl / 2000) * 100)) : 70;
    const trainingS = ec.training === "done" ? 100 : ec.training === "rest" ? 85 : 50;
    behaviorScore = Math.round(proteinS * 0.40 + waterS * 0.30 + trainingS * 0.30);
  }

  // ── STRESS LAYER (10%) ──
  let stressScore = 75;
  if (hasCheckin && mc.stress) {
    const stressS = Math.round((11 - mc.stress) * 10);
    const moodS = ec.mood ? ec.mood * 20 : 70;
    stressScore = Math.round(stressS * 0.65 + moodS * 0.35);
  }

  // ── FINAL WEIGHTED SCORE ──
  const hasAnyCheckin = hasCheckin || checkin?.eveningDone;
  const total = hasAnyCheckin
    ? Math.round(baselineScore * 0.40 + recoveryScore * 0.30 + behaviorScore * 0.20 + stressScore * 0.10)
    : Math.round(baselineScore * 0.85 + 75 * 0.15);

  // ── STATE LABEL ──
  const ecwR = m.intracellularWater > 0
    ? m.extracellularWater / (m.intracellularWater + m.extracellularWater)
    : 0.37;
  const isEdema = ecwR > 0.38;
  const highFat = m.bodyFatPercentage > (p.gender === "female" ? 30 : 25);
  const goodMuscle = smmRatio >= 0.95;
  const highVFL = m.visceralFatLevel >= 10;
  const tiredToday = hasCheckin && ((mc.fatigue || 0) >= 7 || (mc.soreness || 0) >= 7);
  const badSleep = hasCheckin && mc.sleepDuration !== undefined && mc.sleepDuration <= 1;
  const highStress = hasCheckin && (mc.stress || 0) >= 8;

  const yesterdayKey = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `checkin_${d.toISOString().slice(0, 10)}`;
  })();
  const yesterdayCheckin = (() => {
    try {
      const s = localStorage.getItem(yesterdayKey);
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  })();
  const yesterdayBadSleep =
    yesterdayCheckin?.morningDone &&
    yesterdayCheckin?.morning?.sleepDuration !== undefined &&
    yesterdayCheckin.morning.sleepDuration <= 1;
  const sleepDebt = badSleep && yesterdayBadSleep;

  let stateKey: string, stateIcon: string, stateColor: string, stateDesc: string, todayFocus: string, topAlert: string;

  if (highVFL || (highFat && isEdema)) {
    stateKey = "need_attention"; stateIcon = "🔴"; stateColor = C.rose;
    stateDesc = "代谢风险期";
    todayFocus = `内脏脂肪 ${m.visceralFatLevel} 级，控制精制碳水，避免高强度训练`;
    topAlert = "VFL 偏高会增加胰岛素抵抗和心血管风险";
  } else if (sleepDebt) {
    stateKey = "sleep_debt"; stateIcon = "🟠"; stateColor = "#fb923c";
    stateDesc = "睡眠债累积";
    todayFocus = "连续睡眠不足，今日以低强度拉伸为主，今晚提前入睡";
    topAlert = "睡眠债会压制睾酮和生长激素，影响合成代谢";
  } else if (badSleep) {
    stateKey = "recovery_first"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = "轻度恢复不足";
    todayFocus = `睡眠不足，避免高强度${(mc.soreness || 0) >= 6 ? "下肢" : ""}训练，可做轻量有氧`;
    topAlert = "睡眠不足时蛋白质合成效率下降约 20%";
  } else if (tiredToday) {
    stateKey = "recovery_first"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = `${(mc.soreness || 0) >= 7 ? "肌肉恢复期" : "疲劳管理期"}`;
    todayFocus = (mc.soreness || 0) >= 7
      ? "酸痛较高，建议泡沫轴放松或游泳，避免原肌群"
      : "疲劳值偏高，适合轻度有氧或休息";
    topAlert = "过度训练会抑制肌肉生长，恢复即是进步";
  } else if (highStress) {
    stateKey = "stress_mode"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = "高压力模式";
    todayFocus = "皮质醇偏高，选择瑜伽/慢跑，避免大重量训练";
    topAlert = "高压力状态下强行训练会加速肌肉分解";
  } else if (isEdema || (highFat && !goodMuscle)) {
    stateKey = "fat_loss"; stateIcon = "🟡"; stateColor = C.amber;
    stateDesc = isEdema ? "水分滞留期" : "减脂塑形期";
    todayFocus = isEdema
      ? "减少钠摄入，保证 2L+ 饮水，有氧促循环"
      : "中等强度有氧 + 力量，控制餐后碳水时间";
    topAlert = isEdema
      ? `ECW 比偏高，注意电解质平衡`
      : `体脂 ${m.bodyFatPercentage}%，增肌减脂并行效率最高`;
  } else if (goodMuscle && !highFat && recoveryScore >= 75) {
    stateKey = "muscle_window"; stateIcon = "🟢"; stateColor = C.emerald;
    stateDesc = "增肌窗口";
    todayFocus = "恢复充分，适合大重量复合动作，训练后 30min 补充蛋白质";
    topAlert = "当前是突破训练记录的最佳时机";
  } else if (goodMuscle && recoveryScore >= 60) {
    stateKey = "maintain_build"; stateIcon = "🔵"; stateColor = C.sky;
    stateDesc = "稳定进阶期";
    todayFocus = "中等强度训练，注意蛋白质摄入，保持睡眠规律";
    topAlert = "身体底子好，坚持一致性是核心";
  } else {
    stateKey = "maintain"; stateIcon = "🔵"; stateColor = C.sky;
    stateDesc = "均衡维持期";
    todayFocus = "均衡训练 + 维持热量平衡，重点提升肌肉量";
    topAlert = "持续的一致性比任何单次训练都更重要";
  }

  return {
    total, smmScore, bfScore, hydScore, vflScore, metScore,
    recoveryScore, behaviorScore, stressScore, baselineScore,
    stateKey, stateIcon, stateColor, stateDesc, todayFocus, topAlert,
    hasCheckinData: !!(hasAnyCheckin),
  };
}
