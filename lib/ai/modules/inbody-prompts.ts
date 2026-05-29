// ============================================================
//  InBody OS - AI Prompts v1.0
//  基于 InBody 实测数据驱动，复用 Health OS v3 的 Prompt 风格
// ============================================================

import type {
  InBodyUserProfile,
  InBodyMeasurements,
  BodyCompositionAnalysis,
} from "../../types/inbody";

// ─── 辅助函数 ────────────────────────────────────────────────

function goalLabel(goal: InBodyUserProfile["goal"]): string {
  const map = {
    weight_loss: "减脂瘦身",
    muscle_gain: "增肌塑形",
    maintain: "维持体形、提升健康",
    recomposition: "体成分重塑（同步减脂增肌）",
  };
  return map[goal] ?? "综合健康";
}

function fitnessLabel(level: InBodyUserProfile["fitnessLevel"]): string {
  const map = { beginner: "初级", intermediate: "中级", advanced: "高级" };
  return map[level] ?? "初级";
}

function activityLabel(level: InBodyUserProfile["activityLevel"]): string {
  const map = {
    low: "低（久坐为主）",
    medium: "中（轻度活动）",
    high: "高（经常运动）",
  };
  return map[level] ?? "低";
}

function genderLabel(g: InBodyUserProfile["gender"]): string {
  const map = { male: "男性", female: "女性", other: "不便透露" };
  return map[g] ?? "不限";
}

/** 基于 InBody BMR 计算 TDEE */
function calcTDEE(
  bmr: number,
  activity: InBodyUserProfile["activityLevel"],
): number {
  const multiplier =
    activity === "high" ? 1.55 : activity === "medium" ? 1.375 : 1.2;
  return Math.round(bmr * multiplier);
}

/** 基于去脂体重计算每日蛋白质目标（增肌 2.2g/kg LBM，减脂 2.0g/kg，其他 1.8g/kg） */
function calcProteinTarget(
  lbm: number,
  goal: InBodyUserProfile["goal"],
): number {
  const multiplier =
    goal === "muscle_gain" ? 2.2 : goal === "weight_loss" ? 2.0 : 1.8;
  return Math.round(lbm * multiplier);
}

/** ECW/TBW 比值 - 正常范围 < 0.379 */
function calcECWRatio(icw: number, ecw: number): number {
  const tbw = icw + ecw;
  return parseFloat((ecw / tbw).toFixed(3));
}

/** 格式化 InBody 核心数据为 Prompt 可用的文字块 */
function formatMeasurements(m: InBodyMeasurements): string {
  const ecwRatio = calcECWRatio(m.intracellularWater, m.extracellularWater);
  return `
【InBody 实测数据】
体重：${m.weight} kg | BMI：${m.bmi}
─ 体成分 ─
骨骼肌量 (SMM)：${m.skeletalMuscleMass} kg
体脂肪量：${m.bodyFatMass} kg | 体脂率：${m.bodyFatPercentage}%
去脂体重 (LBM)：${m.leanBodyMass} kg
蛋白质：${m.protein} kg | 无机盐：${m.minerals} kg
─ 代谢 ─
基础代谢率 (BMR)：${m.basalMetabolicRate} kcal（InBody 实测值，非公式估算）
─ 水分 ─
体水分 (TBW)：${m.totalBodyWater} L
细胞内水分 (ICW)：${m.intracellularWater} L
细胞外水分 (ECW)：${m.extracellularWater} L
ECW/TBW 比值：${ecwRatio}${ecwRatio >= 0.38 ? " ⚠️ 偏高（水肿风险）" : "（正常）"}
─ 风险指标 ─
内脏脂肪等级：${m.visceralFatLevel} / 20${m.visceralFatLevel >= 10 ? " ⚠️ 偏高" : ""}
腰臀比 (WHR)：${m.waistHipRatio}
${m.inBodyScore !== undefined ? `InBody 评分：${m.inBodyScore} / 100` : ""}
${
  m.segmentalLeanMass
    ? `
─ 节段骨骼肌 ─
右臂：${m.segmentalLeanMass.rightArm} kg | 左臂：${m.segmentalLeanMass.leftArm} kg
躯干：${m.segmentalLeanMass.trunk} kg
右腿：${m.segmentalLeanMass.rightLeg} kg | 左腿：${m.segmentalLeanMass.leftLeg} kg`
    : ""
}`;
}

// ─── Prompt 1：体成分概览 ────────────────────────────────────

export function bodyCompositionPrompt(p: InBodyUserProfile): string {
  const m = p.measurements;

  return `
你是一位持证营养师兼体能评估专家，擅长解读 InBody 体成分报告。
根据以下 InBody 实测数据，为用户生成一份专业、深入的体成分解读报告。

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 身高：${p.heightCm} cm
健身水平：${fitnessLabel(p.fitnessLevel)} | 目标：${goalLabel(p.goal)}
${formatMeasurements(m)}

【评估要求】
1. summary：用150字以内的专业语言整体解读该用户的体成分状况，直接点出最突出的优势和问题。
2. analysis：评估以下4项--
   - smmRating：骨骼肌量评级（与同年龄同性别标准对比）
   - bodyFatRating：体脂率评级
   - visceralRisk：内脏脂肪风险（low/moderate/high）
   - ecwRatio：直接填入实测比值
   - isEdemaRisk：ECW/TBW ≥ 0.380 则为 true
3. keyFindings：列出3-5条关键发现，每条注明重要程度（critical/important/info）。
   例：内脏脂肪等级≥10为critical，骨骼肌不足为important。
4. muscleImbalance：如有节段骨骼肌数据，判断左右肢体是否存在不平衡（差异>10%则标注）。若无节段数据，此字段设为 null。
5. targetRanges：列出3-5个核心指标的当前值 vs 理想范围，并用人话说明需要改变多少。
6. actionPriority：根据数据紧迫程度，给出最需要优先处理的3件事（按重要性排序）。
7. personalizedNote：结合用户年龄、性别、目标、InBody评分给出1-2句鼓励性个性化说明。

严格按以下 JSON 格式返回，不要输出任何其他内容：
{
  "summary": "整体解读（150字以内）",
  "analysis": {
    "smmRating": "normal",
    "bodyFatRating": "high",
    "visceralRisk": "moderate",
    "ecwRatio": 数字,
    "isEdemaRisk": false
  },
  "keyFindings": [
    {
      "title": "发现标题",
      "value": "关键数值",
      "interpretation": "专业解读（2-3句话）",
      "priority": "critical"
    }
  ],
  "muscleImbalance": {
    "hasImbalance": true,
    "description": "右腿骨骼肌显著多于左腿，差异约15%",
    "affectedSide": "left"
  },
  "targetRanges": [
    {
      "metric": "体脂率",
      "current": 数字,
      "idealMin": 数字,
      "idealMax": 数字,
      "unit": "%",
      "gapNote": "需减少约 X% 体脂"
    }
  ],
  "actionPriority": ["优先事项1", "优先事项2", "优先事项3"],
  "personalizedNote": "个性化说明"
}
`;
}

// ─── Prompt 2：精准训练计划 ──────────────────────────────────

export function workoutPrompt(p: InBodyUserProfile): string {
  const m = p.measurements;
  const tdee = calcTDEE(m.basalMetabolicRate, p.activityLevel);

  const equipmentScenario = (() => {
    const el = p.equipmentList ?? "none";
    if (el === "gym")
      return "在健身房训练，可使用所有器械：杠铃、哑铃、器械架、跑步机、划船机、绳索机等。";
    if (el === "home" || p.hasEquipment)
      return "居家训练，有家用器材，可结合自重和器材训练。";
    return "居家无器材训练，只能用自重动作，不得包含任何需要器械的动作。";
  })();

  const segmentalNote = m.segmentalLeanMass
    ? `节段骨骼肌（右臂${m.segmentalLeanMass.rightArm}/左臂${m.segmentalLeanMass.leftArm}/躯干${m.segmentalLeanMass.trunk}/右腿${m.segmentalLeanMass.rightLeg}/左腿${m.segmentalLeanMass.leftLeg} kg）--请据此判断是否需要加入单侧矫正训练。`
    : "无节段数据。";

  return `
你是一位精通体成分训练的专业健身教练，擅长根据 InBody 数据定制个性化训练方案。

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 体重：${m.weight} kg
健身水平：${fitnessLabel(p.fitnessLevel)} | 目标：${goalLabel(p.goal)}
每天可用时间：${p.availableMinutesPerDay} 分钟 | 训练场地：${equipmentScenario}
活动水平：${activityLabel(p.activityLevel)} | TDEE（估算）：${tdee} kcal

【关键 InBody 数据】
骨骼肌量 (SMM)：${m.skeletalMuscleMass} kg | 体脂率：${m.bodyFatPercentage}%
去脂体重 (LBM)：${m.leanBodyMass} kg
内脏脂肪等级：${m.visceralFatLevel}
${segmentalNote}

【要求】
1. dataDriverNotes：用1-2句话说明本计划基于哪些 InBody 数据制定，以及核心逻辑（例如：骨骼肌量偏低->优先复合力量动作）。
2. weeklySchedule：7天计划，至少1天标注 focus:"休息与恢复"。
   - 每个训练日：热身3项 + 主体4-6个动作 + 冷身2项
   - 每个动作必须含：名称、组数、次数/时间、肌肉群、1条技巧提示
   - 对于核心动作，用 inBodyRationale 说明为何根据该用户数据选择此动作（可选字段，选3-4个关键动作填写即可）
3. muscleBalanceStrategy：如有节段数据且存在不平衡，给出具体矫正策略；否则填 null。
4. progressionLogic：说明第2/3/4周如何递进（增加重量/减少休息/增加难度等）。
5. safetyNote：针对内脏脂肪等级${m.visceralFatLevel >= 10 ? "偏高" : "正常"}给出安全提示。
6. personalizedNote：结合用户 InBody 数据和目标给出个性化激励。

严格按以下 JSON 格式返回：
{
  "overview": "计划总体说明",
  "dataDriverNotes": "基于 InBody 数据的制定逻辑",
  "weeklySchedule": [
    {
      "day": "周一",
      "focus": "训练重点",
      "warmup": ["热身1","热身2","热身3"],
      "exercises": [
        {
          "name": "动作名",
          "sets": 数字,
          "reps": "次数或时间",
          "muscleGroup": "肌肉群",
          "tip": "技巧提示",
          "inBodyRationale": "（可选）为何选此动作"
        }
      ],
      "cooldown": ["冷身1","冷身2"],
      "durationMinutes": 数字
    }
  ],
  "progressionLogic": "4周递进说明",
  "muscleBalanceStrategy": null,
  "safetyNote": "安全提示",
  "personalizedNote": "个性化说明"
}
`;
}

// ─── Prompt 3：精准营养方案 ──────────────────────────────────

export function nutritionPrompt(p: InBodyUserProfile): string {
  const m = p.measurements;
  const tdee = calcTDEE(m.basalMetabolicRate, p.activityLevel);
  const proteinTarget = calcProteinTarget(m.leanBodyMass, p.goal);

  const calorieTarget = (() => {
    if (p.goal === "weight_loss") return `${tdee - 400}~${tdee - 200}`;
    if (p.goal === "muscle_gain") return `${tdee + 200}~${tdee + 400}`;
    if (p.goal === "recomposition") return `${tdee - 100}~${tdee + 100}`;
    return `${tdee - 100}~${tdee + 100}`;
  })();

  const dietStyleMap = {
    budget: {
      label: "经济实惠型",
      desc: "食材简单易得、价格亲民，以鸡蛋、豆腐、鸡胸肉、时令蔬菜为主，控制整体花费。",
    },
    balanced: {
      label: "均衡适中型",
      desc: "兼顾营养与口感，食材多样，可以包含适量的牛肉、三文鱼、坚果等中等价位食材。",
    },
    premium: {
      label: "豪华奢侈型",
      desc: "不限预算，追求最优营养和口感体验，可以使用和牛、帝王蟹、三文鱼刺身、松露、有机食材、进口超级食品等高端食材，每餐都要精致丰盛。",
    },
  };
  const style = dietStyleMap[p.dietStyle ?? "budget"];

  return `
你是一位专业运动营养师，擅长根据 InBody 实测体成分数据制定精准营养方案。

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 身高：${p.heightCm} cm
目标：${goalLabel(p.goal)} | 活动水平：${activityLabel(p.activityLevel)}
饮食风格：${style.label} - ${style.desc}
每周饮食预算：约 ¥${p.weeklyBudget}

【关键 InBody 数据（请直接使用，勿用公式估算替代）】
InBody 实测 BMR：${m.basalMetabolicRate} kcal（这是 InBody 机器直接测量的结果，精度高于公式）
TDEE（BMR × 活动系数）：${tdee} kcal
去脂体重 (LBM)：${m.leanBodyMass} kg -> 每日蛋白质目标：${proteinTarget} g（${p.goal === "muscle_gain" ? "2.2g/kg LBM" : p.goal === "weight_loss" ? "2.0g/kg LBM" : "1.8g/kg LBM"}）
体脂率：${m.bodyFatPercentage}% | 骨骼肌量：${m.skeletalMuscleMass} kg
InBody 蛋白质存量：${m.protein} kg${m.protein < 10.0 ? " ⚠️ 偏低，优先补充" : "（正常）"}

【要求】
1. bmrSource 固定填 "inbody_measured"，强调数据来源。
2. basalMetabolicRate 直接填 ${m.basalMetabolicRate}（InBody 实测），tdee 填 ${tdee}。
3. proteinTargetGrams 填 ${proteinTarget}，macroSplit 按目标合理分配（增肌蛋白质35%+，减脂蛋白质30%+）。
4. weeklyPlan 必须包含完整7天，每天4餐（早/午/晚/加餐），每餐列出具体食物、热量、蛋白质(g)。
   - 严格按"${style.label}"风格选择食材
   - 不同天食物要有变化
   - 每天确保达到蛋白质目标 ${proteinTarget}g
5. inBodyDataRationale：用2-3句话解释营养方案如何与 InBody 数据对应（例如：蛋白质存量偏低->重点补充->每餐蛋白质分配策略）。
6. keyPrinciples：3-5条针对该用户 InBody 数据的核心饮食原则（要具体，避免泛泛而谈）。
7. personalizedNote：结合用户 InBody 评分和体成分目标给出1-2句个性化说明。

严格按以下 JSON 格式返回，weeklyPlan 数组必须有7个元素：
{
  "bmrSource": "inbody_measured",
  "basalMetabolicRate": ${m.basalMetabolicRate},
  "tdee": ${tdee},
  "dailyCalorieTarget": 数字,
  "macroSplit": { "protein": 蛋白质百分比, "carbs": 碳水百分比, "fat": 脂肪百分比 },
  "proteinTargetGrams": ${proteinTarget},
  "weeklyPlan": [
    {
      "day": "周一",
      "breakfast": { "name": "餐名", "foods": ["食物1","食物2"], "calories": 数字, "protein": 数字, "notes": "备注" },
      "lunch":     { "name": "餐名", "foods": ["食物1","食物2"], "calories": 数字, "protein": 数字, "notes": "备注" },
      "dinner":    { "name": "餐名", "foods": ["食物1","食物2"], "calories": 数字, "protein": 数字, "notes": "备注" },
      "snack":     { "name": "加餐", "foods": ["食物1"], "calories": 数字, "protein": 数字 },
      "totalCalories": 数字
    }
  ],
  "keyPrinciples": ["原则1","原则2","原则3"],
  "inBodyDataRationale": "营养方案与InBody数据的关联说明",
  "personalizedNote": "个性化说明"
}
`;
}

// ─── Prompt 4：水分管理 ──────────────────────────────────────

export function hydrationPrompt(p: InBodyUserProfile): string {
  const m = p.measurements;
  const ecwRatio = calcECWRatio(m.intracellularWater, m.extracellularWater);
  const isEdemaRisk = ecwRatio >= 0.38;

  // 基于体重和活动水平计算饮水目标
  const mlPerKg =
    p.activityLevel === "high" ? 43 : p.activityLevel === "medium" ? 38 : 33;
  const rawTarget = Math.round(m.weight * mlPerKg);
  const waterTargetMl = Math.min(Math.max(rawTarget, 1500), 3500);

  return `
你是一位专注于运动水合与细胞健康的专家，擅长解读 InBody 水分检测数据。

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 体重：${m.weight} kg
目标：${goalLabel(p.goal)} | 活动水平：${activityLabel(p.activityLevel)}
起床时间：${p.wakeTime} | 睡眠时间：${p.sleepTime}

【InBody 实测水分数据】
体水分 (TBW)：${m.totalBodyWater} L
细胞内水分 (ICW)：${m.intracellularWater} L
细胞外水分 (ECW)：${m.extracellularWater} L
ECW/TBW 比值：${ecwRatio}${isEdemaRisk ? " ⚠️ 偏高（≥0.380，存在水肿风险）" : "（正常，< 0.379）"}

【计算结果】
每日饮水目标：${waterTargetMl} ml（体重${m.weight}kg × ${mlPerKg}ml/kg，已限制在1500-3500ml范围）

【要求】
1. currentTBW 填 ${m.totalBodyWater}，currentECWRatio 填 ${ecwRatio}，isEdemaRisk 填 ${isEdemaRisk}。
2. dailyWaterTargetMl 填 ${waterTargetMl}（已计算好，直接使用）。
3. ${isEdemaRisk ? "⚠️ 用户存在水肿风险（ECW/TBW偏高），edemaNote 必须给出专业解读和建议（是否需要减少钠摄入、是否建议就医评估等）。" : "用户水分比值正常，edemaNote 填 null。"}
4. hydrationSchedule：从起床 ${p.wakeTime} 到睡前，至少8个饮水节点，每次注明时间、量（ml）、备注。
5. electrolyteTips：3条基于 InBody 水分分析的电解质补充建议（这是 Health OS 没有的 InBody 专属内容）。
6. warningSignals：3-4条需要注意的水分异常信号（细胞外水分升高的症状等）。
7. sleepOptimizationTips：3条改善睡眠的建议，结合用户睡眠时间 ${p.sleepTime}。
8. scienceNote：用2-3句话科学解释 ICW/ECW 比值与肌肉健康、水肿的关系。

严格按以下 JSON 格式返回：
{
  "currentTBW": ${m.totalBodyWater},
  "currentECWRatio": ${ecwRatio},
  "isEdemaRisk": ${isEdemaRisk},
  "edemaNote": ${isEdemaRisk ? '"水肿风险说明"' : "null"},
  "dailyWaterTargetMl": ${waterTargetMl},
  "hydrationSchedule": [
    { "time": "06:30", "amount": "400ml", "note": "起床后第一杯，激活代谢" }
  ],
  "electrolyteTips": ["电解质建议1","电解质建议2","电解质建议3"],
  "hydrationPrinciples": ["饮水原则1","饮水原则2","饮水原则3"],
  "warningSignals": ["警示信号1","警示信号2","警示信号3"],
  "sleepOptimizationTips": ["睡眠建议1","睡眠建议2","睡眠建议3"],
  "scienceNote": "科学说明",
  "personalizedNote": "个性化说明"
}
`;
}

// ─── Prompt 5：内脏健康与代谢 ────────────────────────────────

export function visceralMetabolicPrompt(p: InBodyUserProfile): string {
  const m = p.measurements;
  const tdee = calcTDEE(m.basalMetabolicRate, p.activityLevel);

  const visceralRisk =
    m.visceralFatLevel >= 15
      ? "critical"
      : m.visceralFatLevel >= 10
        ? "high"
        : m.visceralFatLevel >= 5
          ? "moderate"
          : "low";

  const visceralAlert =
    m.visceralFatLevel >= 15
      ? "\n⚠️ 内脏脂肪等级≥15，属于高风险区间，必须在 medicalNote 中建议用户咨询医生。"
      : m.visceralFatLevel >= 10
        ? "\n注意：内脏脂肪等级10-14，属于偏高，需重点干预。"
        : "";

  return `
你是一位专注于代谢健康与内脏脂肪管理的医学营养专家。
根据以下 InBody 数据，制定内脏健康与代谢优化方案。
${visceralAlert}

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 体重：${m.weight} kg
健身水平：${fitnessLabel(p.fitnessLevel)} | 目标：${goalLabel(p.goal)}

【关键 InBody 数据】
内脏脂肪等级：${m.visceralFatLevel} / 20（1-4正常，5-9偏高，10-14高，15-20极高）
腰臀比 (WHR)：${m.waistHipRatio}（男性>0.9 / 女性>0.85 为高风险）
InBody 实测 BMR：${m.basalMetabolicRate} kcal（TDEE：${tdee} kcal）
体脂肪量：${m.bodyFatMass} kg | 体脂率：${m.bodyFatPercentage}%

【要求】
1. visceralFatLevel 填 ${m.visceralFatLevel}，visceralRiskLevel 填 "${visceralRisk}"。
2. visceralInterpretation：对内脏脂肪等级${m.visceralFatLevel}给出专业解读（2-3句，包括健康风险说明）。
3. metabolicAge：基于 BMR ${m.basalMetabolicRate} kcal 和年龄 ${p.age} 岁，估算代谢年龄（代谢年龄 = 同等 BMR 对应的平均年龄，如低于实际年龄说明代谢良好）。
4. bmrAnalysis：解读 InBody BMR ${m.basalMetabolicRate} kcal 相对于同年龄、同性别的参考范围如何（偏高/正常/偏低）。
5. interventionPlan：针对内脏脂肪等级，制定涵盖3大维度的干预方案--
   - diet（饮食）：至少2条
   - exercise（运动）：至少2条（有氧 + 力量的组合策略）
   - lifestyle（生活方式）：至少1条
   每条包含：动作类别、具体行动、执行频率、原理说明、预期效果。
6. progressMetrics：4条可量化追踪内脏脂肪改善的指标（下次 InBody 检测时对比）。
7. timelineExpectation：基于用户当前内脏脂肪等级，给出实际改善时间线预期（多少周可降1级）。
8. ${m.visceralFatLevel >= 15 ? "medicalNote：必须建议用户咨询内科医生或代谢科，说明可能的健康风险。" : "medicalNote：填 null。"}

严格按以下 JSON 格式返回：
{
  "visceralFatLevel": ${m.visceralFatLevel},
  "visceralRiskLevel": "${visceralRisk}",
  "visceralInterpretation": "专业解读",
  "metabolicAge": 数字,
  "bmrAnalysis": "BMR分析",
  "interventionPlan": [
    {
      "category": "diet",
      "action": "具体行动",
      "frequency": "每天/每周X次",
      "rationale": "原理说明",
      "expectedEffect": "预期效果"
    }
  ],
  "progressMetrics": ["追踪指标1","追踪指标2","追踪指标3","追踪指标4"],
  "timelineExpectation": "改善时间线",
  "medicalNote": null,
  "personalizedNote": "个性化说明"
}
`;
}

// ─── Prompt 6：进度追踪对比 ──────────────────────────────────
// 此 Prompt 仅在有历史数据时调用（prevMeasurements 不为空）

export function progressPrompt(
  p: InBodyUserProfile,
  prevMeasurements: InBodyMeasurements,
  prevDate: string,
): string {
  const curr = p.measurements;
  const prev = prevMeasurements;

  const daysDiff = Math.round(
    (new Date(curr.measuredAt ?? new Date().toISOString()).getTime() -
      new Date(prevDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  // 预计算关键变化，直接传给 AI 减少计算误差
  const changes = {
    weight: +(curr.weight - prev.weight).toFixed(1),
    skeletalMuscleMass: +(
      curr.skeletalMuscleMass - prev.skeletalMuscleMass
    ).toFixed(2),
    bodyFatMass: +(curr.bodyFatMass - prev.bodyFatMass).toFixed(2),
    bodyFatPercentage: +(
      curr.bodyFatPercentage - prev.bodyFatPercentage
    ).toFixed(1),
    visceralFatLevel: curr.visceralFatLevel - prev.visceralFatLevel,
    totalBodyWater: +(curr.totalBodyWater - prev.totalBodyWater).toFixed(1),
    protein: +(curr.protein - prev.protein).toFixed(2),
    basalMetabolicRate: curr.basalMetabolicRate - prev.basalMetabolicRate,
    inBodyScore:
      curr.inBodyScore && prev.inBodyScore
        ? curr.inBodyScore - prev.inBodyScore
        : null,
  };

  return `
你是一位专业体成分追踪与进度分析专家，擅长解读两次 InBody 检测结果的变化趋势。

【用户基础信息】
年龄：${p.age}岁 | 性别：${genderLabel(p.gender)} | 目标：${goalLabel(p.goal)}

【两次检测数据对比】
检测间隔：${daysDiff} 天（上次：${prevDate}，本次：${curr.measuredAt ?? "今日"}）

指标          | 上次        | 本次        | 变化
体重 (kg)     | ${prev.weight}   | ${curr.weight}   | ${changes.weight > 0 ? "+" : ""}${changes.weight}
骨骼肌 (kg)   | ${prev.skeletalMuscleMass} | ${curr.skeletalMuscleMass} | ${changes.skeletalMuscleMass > 0 ? "+" : ""}${changes.skeletalMuscleMass}
体脂肪 (kg)   | ${prev.bodyFatMass} | ${curr.bodyFatMass} | ${changes.bodyFatMass > 0 ? "+" : ""}${changes.bodyFatMass}
体脂率 (%)    | ${prev.bodyFatPercentage} | ${curr.bodyFatPercentage} | ${changes.bodyFatPercentage > 0 ? "+" : ""}${changes.bodyFatPercentage}
内脏脂肪等级  | ${prev.visceralFatLevel} | ${curr.visceralFatLevel} | ${changes.visceralFatLevel > 0 ? "+" : ""}${changes.visceralFatLevel}
体水分 (L)    | ${prev.totalBodyWater} | ${curr.totalBodyWater} | ${changes.totalBodyWater > 0 ? "+" : ""}${changes.totalBodyWater}
蛋白质 (kg)   | ${prev.protein} | ${curr.protein} | ${changes.protein > 0 ? "+" : ""}${changes.protein}
BMR (kcal)    | ${prev.basalMetabolicRate} | ${curr.basalMetabolicRate} | ${changes.basalMetabolicRate > 0 ? "+" : ""}${changes.basalMetabolicRate}
${curr.inBodyScore && prev.inBodyScore ? `InBody评分  | ${prev.inBodyScore} | ${curr.inBodyScore} | ${changes.inBodyScore! > 0 ? "+" : ""}${changes.inBodyScore}` : ""}

【要求】
1. periodDays 填 ${daysDiff}，overallTrend 基于整体数据变化判断（excellent/good/neutral/concerning）。
2. overallSummary：100字以内的整体进度总结，重点说明是否朝目标方向前进。
3. changes：对上表中每个变化项进行解读--
   - trend：针对用户目标"${goalLabel(p.goal)}"来判断是 improved/worsened/stable（骨骼肌增加对增肌目标是improved，体脂减少对减脂目标是improved）
   - interpretation：1-2句专业解读，说明变化是否符合预期、速度是否合理
4. achievements：列出2-4条值得表扬的进步（即使是小进步）。
5. concerns：列出0-3条需要关注的问题（若无则为空数组，不要强行制造焦虑）。
6. adjustmentSuggestions：基于数据变化，给出2-4条具体的方案调整建议（训练/饮食/生活方式）。
7. nextCheckInRecommendation：基于变化速度，建议下次 InBody 检测的时间（通常4-8周）。
8. personalizedNote：1-2句鼓励性个性化说明，结合具体数字。

严格按以下 JSON 格式返回：
{
  "periodDays": ${daysDiff},
  "overallTrend": "good",
  "overallSummary": "整体进度总结",
  "changes": [
    {
      "metric": "骨骼肌量",
      "unit": "kg",
      "previous": ${prev.skeletalMuscleMass},
      "current": ${curr.skeletalMuscleMass},
      "change": ${changes.skeletalMuscleMass},
      "changePercent": 数字,
      "trend": "improved",
      "interpretation": "骨骼肌增加说明"
    }
  ],
  "achievements": ["成就1","成就2"],
  "concerns": [],
  "adjustmentSuggestions": ["建议1","建议2","建议3"],
  "nextCheckInRecommendation": "建议X周后再次检测",
  "personalizedNote": "个性化鼓励"
}
`;
}
