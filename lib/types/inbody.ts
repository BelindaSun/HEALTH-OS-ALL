// InBody OS — Types v1.0
export type Gender = "male" | "female" | "other";
export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type ActivityLevel = "low" | "medium" | "high";
export type DietGoal =
  | "weight_loss"
  | "muscle_gain"
  | "maintain"
  | "recomposition";
export type DietStyle = "budget" | "balanced" | "premium";
export type AIProvider =
  | "ollama"
  | "deepseek"
  | "openai"
  | "claude"
  | "gemini"
  | "qwen";
export type InBodyInputMethod = "pdf" | "manual";

export interface InBodyMeasurements {
  weight: number;
  skeletalMuscleMass: number;
  bodyFatMass: number;
  bodyFatPercentage: number;
  totalBodyWater: number;
  intracellularWater: number;
  extracellularWater: number;
  protein: number;
  minerals: number;
  leanBodyMass: number;
  basalMetabolicRate: number;
  bmi: number;
  visceralFatLevel: number;
  waistHipRatio: number;
  inBodyScore?: number;
  segmentalLeanMass?: {
    rightArm: number;
    leftArm: number;
    trunk: number;
    rightLeg: number;
    leftLeg: number;
  };
  measuredAt?: string;
}

export type BodyCompositionRating =
  | "severely_low"
  | "low"
  | "normal"
  | "high"
  | "severely_high";

export interface BodyCompositionAnalysis {
  smmRating: BodyCompositionRating;
  bodyFatRating: BodyCompositionRating;
  visceralRisk: "low" | "moderate" | "high";
  ecwRatio: number;
  isEdemaRisk: boolean;
}

export type ModuleStatus = "idle" | "loading" | "success" | "error";

export interface ModuleState<T> {
  status: ModuleStatus;
  data: T | null;
  error?: string;
  generatedAt?: string;
}

export interface InBodyUserProfile {
  age: number;
  gender: Gender;
  heightCm: number;
  goal: DietGoal;
  fitnessLevel: FitnessLevel;
  activityLevel: ActivityLevel;
  availableMinutesPerDay: number;
  hasEquipment: boolean;
  equipmentList?: string;
  weeklyBudget: number;
  dietStyle: DietStyle;
  sleepTime: string;
  wakeTime: string;
  measurements: InBodyMeasurements;
  inputMethod: InBodyInputMethod;
  provider?: AIProvider;
  apiKey?: string;
  modelName?: string;
}

export interface Meal {
  name: string;
  foods: string[];
  calories: number;
  protein: number;
  notes?: string;
}

export interface DayMealPlan {
  day: string;
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snack?: Meal;
  totalCalories: number;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  duration?: string;
  tip: string;
  muscleGroup: string;
  inBodyRationale?: string;
}

export interface WorkoutDay {
  day: string;
  focus: string;
  warmup: string[];
  exercises: Exercise[];
  cooldown: string[];
  durationMinutes: number;
}

export interface BodyCompositionReport {
  summary: string;
  analysis: BodyCompositionAnalysis;
  keyFindings: {
    title: string;
    value: string;
    interpretation: string;
    priority: "critical" | "important" | "info";
  }[];
  targetRanges: {
    metric: string;
    current: number;
    idealMin: number;
    idealMax: number;
    unit: string;
    gapNote: string;
  }[];
  actionPriority: string[];
  personalizedNote: string;
}

export interface InBodyWorkoutPlan {
  overview: string;
  dataDriverNotes: string;
  weeklySchedule: WorkoutDay[];
  progressionLogic: string;
  safetyNote: string;
  muscleBalanceStrategy?: string;
  personalizedNote: string;
}

export interface InBodyNutritionPlan {
  bmrSource: "inbody_measured";
  basalMetabolicRate: number;
  tdee: number;
  dailyCalorieTarget: number;
  macroSplit: { protein: number; carbs: number; fat: number };
  proteinTargetGrams: number;
  weeklyPlan: DayMealPlan[];
  keyPrinciples: string[];
  inBodyDataRationale: string;
  personalizedNote: string;
}

export interface HydrationEvent {
  time: string;
  amount: string;
  note: string;
}

export interface InBodyHydrationPlan {
  currentTBW: number;
  currentECWRatio: number;
  isEdemaRisk: boolean;
  edemaNote?: string;
  dailyWaterTargetMl: number;
  hydrationSchedule: HydrationEvent[];
  electrolyteTips: string[];
  hydrationPrinciples: string[];
  warningSignals: string[];
  sleepOptimizationTips: string[];
  scienceNote: string;
  personalizedNote: string;
}

export interface VisceralMetabolicPlan {
  visceralFatLevel: number;
  visceralRiskLevel: "low" | "moderate" | "high" | "critical";
  visceralInterpretation: string;
  metabolicAge?: number;
  bmrAnalysis: string;
  interventionPlan: {
    category: "diet" | "exercise" | "lifestyle";
    action: string;
    frequency: string;
    rationale: string;
    expectedEffect: string;
  }[];
  progressMetrics: string[];
  timelineExpectation: string;
  medicalNote?: string;
  personalizedNote: string;
}

export interface ProgressReport {
  periodDays: number;
  overallTrend: "excellent" | "good" | "neutral" | "concerning";
  overallSummary: string;
  changes: {
    metric: string;
    unit: string;
    previous: number;
    current: number;
    change: number;
    changePercent: number;
    trend: "improved" | "worsened" | "stable";
    interpretation: string;
  }[];
  achievements: string[];
  concerns: string[];
  adjustmentSuggestions: string[];
  nextCheckInRecommendation: string;
  personalizedNote: string;
}

export interface InBodyPlan {
  id: string;
  createdAt: string;
  profile: InBodyUserProfile;
  bodyComposition: ModuleState<BodyCompositionReport>;
  workout: ModuleState<InBodyWorkoutPlan>;
  nutrition: ModuleState<InBodyNutritionPlan>;
  hydration: ModuleState<InBodyHydrationPlan>;
  visceralMetabolic: ModuleState<VisceralMetabolicPlan>;
  progress: ModuleState<ProgressReport>;
}

export interface InBodyHistoryEntry {
  id: string;
  createdAt: string;
  snapshotSummary: {
    weight: number;
    skeletalMuscleMass: number;
    bodyFatPercentage: number;
    visceralFatLevel: number;
    inBodyScore?: number;
  };
  plan: InBodyPlan;
}
