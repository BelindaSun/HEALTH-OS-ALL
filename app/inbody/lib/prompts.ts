import { Measurements, AppState, LocalBodyScore, CheckinData } from "../types";
import { GOAL_CN } from "../constants";

// ── SHARED DATA BLOCK ─────────────────────────────────────────
export function buildDataBlock(m: Measurements, p: AppState) {
  const ecw =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "N/A";
  const tdee = Math.round(
    m.basalMetabolicRate *
      (p.activityLevel === "high"
        ? 1.55
        : p.activityLevel === "medium"
          ? 1.375
          : 1.2),
  );
  const proteinG = Math.round(
    m.leanBodyMass *
      (p.goal === "muscle_gain" ? 2.2 : p.goal === "weight_loss" ? 2.0 : 1.8),
  );
  const block = `
InBody Data: weight=${m.weight}kg BMI=${m.bmi} BMR=${m.basalMetabolicRate}kcal(measured)
SMM=${m.skeletalMuscleMass}kg LBM=${m.leanBodyMass}kg BFM=${m.bodyFatMass}kg BF%=${m.bodyFatPercentage}%
TBW=${m.totalBodyWater}L ICW=${m.intracellularWater}L ECW=${m.extracellularWater}L ECW/TBW=${ecw}
Protein=${m.protein}kg Minerals=${m.minerals}kg VFL=${m.visceralFatLevel}/20 WHR=${m.waistHipRatio}
${m.inBodyScore ? `InBodyScore=${m.inBodyScore}` : ""}
${m.segmentalLeanMass ? `Segmental: RA=${m.segmentalLeanMass.rightArm} LA=${m.segmentalLeanMass.leftArm} Trunk=${m.segmentalLeanMass.trunk} RL=${m.segmentalLeanMass.rightLeg} LL=${m.segmentalLeanMass.leftLeg}kg` : ""}
User: age=${p.age} gender=${p.gender} height=${p.heightCm}cm goal=${p.goal}
activity=${p.activityLevel} fitness=${p.fitnessLevel} time=${p.availableMinutesPerDay}min/day
equipment=${p.equipmentList || "none"} diet=${p.dietStyle} budget=CNY${p.weeklyBudget}/week
TDEE=${tdee}kcal protein_target=${proteinG}g/day`;
  return { ecw, tdee, proteinG, block };
}

// ── MODULE PROMPTS ────────────────────────────────────────────
export function promptBodyComp(m: Measurements, p: AppState): string {
  const { block } = buildDataBlock(m, p);
  return `You are a professional body composition expert. Analyze this InBody report and return ONLY JSON.
${block}
Return JSON: {"summary":"150字整体解读","analysis":{"smmRating":"low|normal|high","bodyFatRating":"low|normal|high","visceralRisk":"low|moderate|high","ecwRatio":0.370,"isEdemaRisk":false},"keyFindings":[{"title":"","value":"","interpretation":"","priority":"critical|important|info"}],"targetRanges":[{"metric":"","current":0,"idealMin":0,"idealMax":0,"unit":"","gapNote":""}],"actionPriority":["","",""],"personalizedNote":""}`;
}

export function promptWorkout(m: Measurements, p: AppState): string {
  const { block } = buildDataBlock(m, p);
  const eq =
    p.equipmentList === "gym"
      ? "gym with all equipment"
      : p.equipmentList === "home"
        ? "home equipment"
        : "bodyweight only";
  return `You are a professional fitness coach. Create a workout plan based on InBody data. Return ONLY JSON.
${block} equipment=${eq}
Return JSON (weeklySchedule must have 7 days including 1 rest day):
{"overview":"","dataDriverNotes":"based on which InBody metrics","weeklySchedule":[{"day":"Monday","focus":"","warmup":["","",""],"exercises":[{"name":"","sets":3,"reps":"","muscleGroup":"","tip":""}],"cooldown":["",""],"durationMinutes":45}],"progressionLogic":"","safetyNote":"","personalizedNote":""}`;
}

export function promptNutrition(m: Measurements, p: AppState): string {
  const { tdee, proteinG, block } = buildDataBlock(m, p);
  const calTarget =
    p.goal === "weight_loss"
      ? `${tdee - 400}~${tdee - 200}`
      : p.goal === "muscle_gain"
        ? `${tdee + 200}~${tdee + 400}`
        : `${tdee - 100}~${tdee + 100}`;
  const styleDesc =
    (
      {
        budget: "budget-friendly simple foods",
        balanced: "balanced variety",
        premium: "premium quality ingredients",
      } as any
    )[p.dietStyle] || "balanced";
  return `You are a sports nutritionist. Create a 7-day meal plan based on InBody measured BMR. Return ONLY JSON.
${block} calorie_target=${calTarget}kcal diet_style=${styleDesc}
IMPORTANT: Use InBody measured BMR=${m.basalMetabolicRate}kcal (not formula estimate). Protein target=${proteinG}g/day based on LBM.
STRICT REQUIREMENTS: weeklyPlan MUST contain EXACTLY 7 entries (Monday to Sunday). macroSplit values are PERCENTAGES (integer, must sum to 100, e.g. protein:30,carbs:45,fat:25). All meals in Chinese food.
Return JSON:
{"bmrSource":"inbody_measured","basalMetabolicRate":${m.basalMetabolicRate},"tdee":${tdee},"dailyCalorieTarget":0,"macroSplit":{"protein":30,"carbs":45,"fat":25},"proteinTargetGrams":${proteinG},"weeklyPlan":[{"day":"周一","breakfast":{"name":"","foods":[""],"calories":0,"protein":0},"lunch":{"name":"","foods":[""],"calories":0,"protein":0},"dinner":{"name":"","foods":[""],"calories":0,"protein":0},"snack":{"name":"","foods":[""],"calories":0,"protein":0},"totalCalories":0}],"keyPrinciples":[""],"inBodyDataRationale":"","personalizedNote":""}`;
}

export function promptHydration(m: Measurements, p: AppState): string {
  const { block } = buildDataBlock(m, p);
  const mlPerKg =
    p.activityLevel === "high" ? 43 : p.activityLevel === "medium" ? 38 : 33;
  const target = Math.min(Math.max(Math.round(m.weight * mlPerKg), 1500), 3500);
  const ecw =
    m.intracellularWater > 0
      ? (
          m.extracellularWater /
          (m.intracellularWater + m.extracellularWater)
        ).toFixed(3)
      : "0.370";
  const edema = parseFloat(ecw) >= 0.38;
  return `You are a hydration expert. Create a hydration plan based on InBody water analysis. Return ONLY JSON.
${block} water_target=${target}ml ECW_ratio=${ecw} edema_risk=${edema}
Return JSON (hydrationSchedule 8+ entries from wake time ${p.wakeTime}):
{"currentTBW":${m.totalBodyWater},"currentECWRatio":${ecw},"isEdemaRisk":${edema},"edemaNote":${edema ? '"explain edema risk"' : "null"},"dailyWaterTargetMl":${target},"hydrationSchedule":[{"time":"07:00","amount":"400ml","note":""}],"electrolyteTips":["","",""],"hydrationPrinciples":["","",""],"warningSignals":["","",""],"sleepOptimizationTips":["","",""],"scienceNote":"","personalizedNote":""}`;
}

export function promptVisceral(m: Measurements, p: AppState): string {
  const { block } = buildDataBlock(m, p);
  const risk =
    m.visceralFatLevel >= 15
      ? "critical"
      : m.visceralFatLevel >= 10
        ? "high"
        : m.visceralFatLevel >= 5
          ? "moderate"
          : "low";
  return `You are a metabolic health expert. Analyze visceral fat and metabolic health. Return ONLY JSON.
${block}
${m.visceralFatLevel >= 15 ? "CRITICAL: VFL>=15, medicalNote MUST recommend seeing a doctor." : ""}
Return JSON:
{"visceralFatLevel":${m.visceralFatLevel},"visceralRiskLevel":"${risk}","visceralInterpretation":"","metabolicAge":0,"bmrAnalysis":"","interventionPlan":[{"category":"diet|exercise|lifestyle","action":"","frequency":"","rationale":"","expectedEffect":""}],"progressMetrics":["","","",""],"timelineExpectation":"","medicalNote":${m.visceralFatLevel >= 15 ? '"recommend doctor"' : "null"},"personalizedNote":""}`;
}

// ── BODY STATE PROMPT ─────────────────────────────────────────
export function promptBodyState(
  m: Measurements,
  p: AppState,
  localScore: LocalBodyScore,
  checkin: CheckinData,
): string {
  const { block } = buildDataBlock(m, p);
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const sleepLabels = ["<5小时", "5-6小时", "6-7小时", "7-8小时", ">8小时"];
  const checkinBlock =
    checkin?.morningDone || checkin?.eveningDone
      ? `
Today's Check-in Data (FAST VARIABLES - prioritize these for today's recommendations):
Morning: sleep=${mc.sleepDuration !== undefined ? sleepLabels[mc.sleepDuration] : "unknown"}, sleepQuality=${mc.sleepQuality || "unknown"}/5, fatigue=${mc.fatigue || "unknown"}/10, stress=${mc.stress || "unknown"}/10, soreness=${mc.soreness || "unknown"}/10${mc.weight ? `, weight=${mc.weight}kg` : ""}
Evening: protein=${ec.proteinPct || "unknown"}% of target, water=${ec.waterMl || "unknown"}ml, training=${ec.training || "unknown"}, mood=${ec.mood || "unknown"}/5
Pre-calculated layer scores: baseline=${localScore.baselineScore}, recovery=${localScore.recoveryScore}, behavior=${localScore.behaviorScore}, stress=${localScore.stressScore}`
      : `
No check-in data available today. Base analysis on InBody data only.`;

  return `You are an elite sports medicine doctor. Analyze this person's body state. Return ONLY JSON.
${block}${checkinBlock}
IMPORTANT: If check-in data is available, let fast variables (sleep, fatigue, stress) heavily influence your stateLabel and todayFocus. A person with great InBody scores but poor sleep should be labeled "恢复优先" not "增肌窗口".
Return JSON:
{"bodyScore":85,"stateLabel":"增肌窗口|减脂窗口|恢复优先|维持期|需要关注","stateEmoji":"🟢","stateColor":"emerald|amber|rose|sky","oneLiner":"一句话描述当前身体状态（20字以内）","todayFocus":"今天最应该做什么，包含具体行动（40字以内）","topAlert":"最需要关注的风险点（30字以内）","dimensionScores":{"muscle":85,"bodyFat":72,"hydration":90,"visceral":88,"metabolic":80},"aiInsight":"基于InBody+今日状态的深度洞察，150字","actionPlan":["立即行动（具体，基于今日数据）","本周重点（具体）","长期方向（具体）"],"recoveryTips":"基于今日恢复状态的具体建议"}`;
}

// ── DAILY REFLECTION PROMPT ───────────────────────────────────
export function promptDailyReflection(
  todayScore: number,
  yesterdayScore: number | null,
  checkin: CheckinData,
  nutritionProtein: number | null,
  proteinTarget: number,
  consistency: { rate: number; grade: string; streak: number },
): string {
  const mc = checkin?.morning || {};
  const ec = checkin?.evening || {};
  const sleepLabels = ["<5h", "5-6h", "6-7h", "7-8h", ">8h"];
  const diff = yesterdayScore !== null ? todayScore - yesterdayScore : null;
  return `You are a warm, insightful personal health coach. Write a short Daily Reflection in Chinese for the user.
Today's data:
- Compliance score: ${todayScore}${diff !== null ? ` (${diff >= 0 ? "+" : ""}${diff} vs yesterday's ${yesterdayScore})` : ""}
- Sleep: ${mc.sleepDuration !== undefined ? sleepLabels[mc.sleepDuration] : "unknown"}, quality ${mc.sleepQuality || "?"}/5
- Fatigue: ${mc.fatigue || "?"}/10, Stress: ${mc.stress || "?"}/10, Soreness: ${mc.soreness || "?"}/10
- Protein: ${nutritionProtein !== null ? `${nutritionProtein}g (${Math.round((nutritionProtein / proteinTarget) * 100)}% of ${proteinTarget}g target)` : "not tracked"}
- Training: ${ec.training || "unknown"}, Water: ${ec.waterMl || "?"}ml, Mood: ${ec.mood || "?"}/5
- Consistency: ${consistency.rate}% over 30 days, grade ${consistency.grade}, streak ${consistency.streak} days

🔹 Important: If the user has less than 7 days of check-in history, 
consistency numbers do not represent long-term habits. In the "insight" 
field, you MUST note this is early data, avoid drawing conclusions from 
consistency %, and instead encourage the user to keep recording — 
early signals like protein adherence or recovery scores are more 
meaningful at this stage.

Write a Daily Reflection with 3 parts:
1. Today summary (1-2 sentences, specific, mention actual numbers)
2. One key insight (what's working or what's the main bottleneck)（
3. One concrete suggestion for tomorrow

Tone: like a knowledgeable coach who genuinely cares, not a chatbot. Be specific, not generic.
Return ONLY JSON:
{"summary":"今天比昨天提高了8分...","insight":"蛋白质摄入明显改善...","tomorrow":"明天建议...","highlight":"一句话亮点（15字内）","mood":"positive|neutral|concern"}`;
}

// ── NUTRITION PROMPTS ─────────────────────────────────────────
export function promptFoodParse(
  input: string,
  proteinTarget: number,
  calTarget: number,
): string {
  return `You are a precise sports nutritionist. Parse this food description and return ONLY JSON with consistent values.
CRITICAL: For the same food and weight, always return the same numbers. Use standard nutritional databases.
Food input: "${input}"
Protein target today: ${proteinTarget}g, Calorie target: ${calTarget}kcal

Return ONLY this JSON (no markdown, no explanation):
{"items":[{"name":"食物名","weight":"150g","protein":32,"carbs":0,"fat":3,"calories":165}],"total":{"protein":32,"carbs":0,"fat":3,"calories":165},"mealScore":82,"mealScoreNote":"蛋白质充足，低脂优质","proteinQuality":"high","proteinQualityNote":"优质动物蛋白，氨基酸完整"}`;
}

export function promptGapAnalysis(
  todayTotals: {
    protein: number;
    calories: number;
    carbs: number;
    fat: number;
  },
  targets: { protein: number; calories: number },
): string {
  const gapProtein = Math.max(0, targets.protein - todayTotals.protein);
  const gapCal = Math.max(0, targets.calories - todayTotals.calories);
  return `You are a sports nutritionist. The user needs to close nutrition gaps today. Return ONLY JSON.
Today so far: protein=${todayTotals.protein}g, calories=${todayTotals.calories}kcal, carbs=${todayTotals.carbs}g, fat=${todayTotals.fat}g
Daily targets: protein=${targets.protein}g, calories=${targets.calories}kcal
Gaps: protein=${gapProtein}g, calories=${gapCal}kcal

Suggest 2-3 practical, easy food combinations to close the gap. Be specific with portions.
Return ONLY this JSON:
{"gapSummary":"今日还差X蛋白质，Y热量","suggestions":[{"emoji":"🥛","foods":"乳清蛋白1勺+希腊酸奶1盒","protein":41,"calories":320,"note":"最方便"},{"emoji":"🍗","foods":"鸡胸肉150g","protein":39,"calories":185,"note":"高性价比"}],"todayAdvice":"一句话今日建议"}`;
}
