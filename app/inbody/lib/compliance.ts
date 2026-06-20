import { CheckinData, ComplianceResult, ConsistencyResult, HealthGoal } from "../types";
import { C } from "../constants";

// Compliance weight presets by health goal
// Protein | Water | Training | Sleep
const COMPLIANCE_WEIGHTS: Record<HealthGoal, [number, number, number, number]> = {
  fat_loss:       [0.35, 0.20, 0.30, 0.15],  // protein + training priority
  muscle_gain:    [0.35, 0.10, 0.35, 0.20],  // protein + training equal
  fitness:        [0.25, 0.20, 0.30, 0.25],  // balanced, training leads
  sleep_recovery: [0.20, 0.25, 0.15, 0.40],  // sleep dominant
};
const DEFAULT_WEIGHTS: [number, number, number, number] = [0.30, 0.25, 0.25, 0.20];

function getWeights(healthGoal?: HealthGoal): [number, number, number, number] {
  return healthGoal ? (COMPLIANCE_WEIGHTS[healthGoal] ?? DEFAULT_WEIGHTS) : DEFAULT_WEIGHTS;
}

export function calcComplianceScore(checkin: CheckinData | null, healthGoal?: HealthGoal): ComplianceResult | null {
  if (!checkin) return null;
  const mc = checkin.morning || {};
  const ec = checkin.evening || {};
  const morningDone = checkin.morningDone;
  const eveningDone = checkin.eveningDone;

  // Protein: from Nutrition writeback OR evening check-in
  const proteinScore = ec.proteinPct !== undefined ? Math.min(100, ec.proteinPct) : null;
  // Water: only from evening check-in
  const waterScore = eveningDone && ec.waterMl !== undefined
    ? Math.min(100, Math.round((ec.waterMl / 2000) * 100))
    : null;
  // Training: Training module writeback (done) > evening check-in > null
  // Training module writes ec.training = "done" via writebackToCompliance when sessions are logged
  // So we just read ec.training as before — the writeback handles the rest.
  // Additionally, read directly from training_YYYY-MM-DD for robustness (same-session sync)
  const todayTrainingKey = `training_${new Date().toISOString().slice(0, 10)}`;
  const hasTodayTraining = (() => {
    try {
      const raw = localStorage.getItem(todayTrainingKey);
      if (!raw) return false;
      const td = JSON.parse(raw);
      return (td.sessions?.length ?? 0) > 0;
    } catch { return false; }
  })();
  const trainingScore = hasTodayTraining ? 100
    : eveningDone && ec.training
    ? ec.training === "done" ? 100 : ec.training === "rest" ? 85 : 30
    : null;
  const trainingUnit = hasTodayTraining
    ? (() => {
        try {
          const raw = localStorage.getItem(todayTrainingKey);
          const td = raw ? JSON.parse(raw) : null;
          return td ? `Load ${td.totalLoad}` : "已记录";
        } catch { return "已记录"; }
      })()
    : ec.training === "done" ? "完成" : ec.training === "rest" ? "休息日" : "跳过";
  // Sleep: from morning check-in
  const sleepScoreMap = [30, 55, 75, 100, 90];
  const sleepScore = morningDone && mc.sleepDuration !== undefined
    ? sleepScoreMap[mc.sleepDuration]
    : null;

  const hasData = proteinScore !== null || waterScore !== null || trainingScore !== null || sleepScore !== null;
  if (!hasData) return null;

  const [wProtein, wWater, wTraining, wSleep] = getWeights(healthGoal);

  const dims = [
    { key: "protein",  label: "蛋白质", weight: wProtein,  score: proteinScore,  color: C.emerald, icon: "P", unit: `${ec.proteinPct ?? "-"}%` },
    { key: "water",    label: "饮水",   weight: wWater,    score: waterScore,    color: C.sky,     icon: "W", unit: `${ec.waterMl ?? "-"}ml` },
    { key: "training", label: "训练",   weight: wTraining, score: trainingScore, color: C.violet,  icon: "T",
      unit: trainingScore !== null ? trainingUnit : "-" },
    { key: "sleep",    label: "睡眠",   weight: wSleep,    score: sleepScore,    color: C.amber,   icon: "Z",
      unit: sleepScore !== null ? ["<5h", "5-6h", "6-7h", "7-8h", ">8h"][mc.sleepDuration!] : "-" },
  ];

  const total = Math.round(
    dims.reduce((sum, d) => sum + (d.score !== null ? d.score : 75) * d.weight, 0),
  );

  const level =
    total >= 85 ? { label: "优秀执行", color: C.emerald, bg: C.emeraldDim }
    : total >= 70 ? { label: "良好执行", color: C.sky,     bg: C.skyDim }
    : total >= 55 ? { label: "一般执行", color: C.amber,   bg: C.amberDim }
    :               { label: "需要改善", color: C.rose,    bg: C.roseDim };

  return { total, dims, level };
}

export function calcConsistency(): ConsistencyResult {
  // Read healthGoal from persisted state for consistent weight across history
  const healthGoal: HealthGoal | undefined = (() => {
    try {
      const raw = localStorage.getItem("inbody_os_state");
      return raw ? JSON.parse(raw).healthGoal : undefined;
    } catch { return undefined; }
  })();
  const results: (number | null)[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { results.push(null); continue; }
      const cr = calcComplianceScore(JSON.parse(raw), healthGoal);
      results.push(cr ? cr.total : null);
    } catch { results.push(null); }
  }

  const scored = results.filter((x): x is number => x !== null);
  const rate = scored.length > 0 ? Math.round((scored.length / 30) * 100) : 0;
  const avg = scored.length > 0 ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : 0;

  let streak = 0;
  for (let i = 0; i < 30; i++) {
    if (results[i] !== null && results[i]! >= 50) streak++;
    else break;
  }

  const isNewUser = scored.length < 7;
  const grade = isNewUser
    ? (avg >= 80 ? "A" : avg >= 65 ? "B" : avg >= 50 ? "C" : "D")
    : (rate >= 80 && avg >= 75) ? "S"
    : (rate >= 70 && avg >= 65) ? "A"
    : (rate >= 55 && avg >= 55) ? "B"
    : (rate >= 40) ? "C" : "D";

  const gradeColor = grade === "S" ? C.emerald
    : grade === "A" ? C.sky
    : grade === "B" ? C.amber
    : grade === "C" ? "#f97316" : C.rose;

  const gradeDesc = isNewUser
    ? (avg >= 80 ? "优秀开局" : avg >= 65 ? "良好开局" : "建立习惯中")
    : grade === "S" ? "卓越一致性" : grade === "A" ? "优秀一致性"
    : grade === "B" ? "良好一致性" : grade === "C" ? "建立习惯中" : "需要提升";

  const heatmap: (number | null)[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { heatmap.push(null); continue; }
      const cr = calcComplianceScore(JSON.parse(raw), healthGoal);
      heatmap.push(cr ? cr.total : null);
    } catch { heatmap.push(null); }
  }

  return { streak, rate, avg, grade: grade as any, gradeColor, gradeDesc, heatmap, scored, isNewUser };
}
