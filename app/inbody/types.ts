// ── MEASUREMENTS ─────────────────────────────────────────────
export interface SegmentalLeanMass {
  rightArm: number;
  leftArm: number;
  trunk: number;
  rightLeg: number;
  leftLeg: number;
}

export interface Measurements {
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
  inBodyScore: number;
  segmentalLeanMass: SegmentalLeanMass;
}

// ── APP STATE ────────────────────────────────────────────────
export type Step = "welcome" | "import" | "measurements" | "profile" | "dashboard";
export type Gender = "male" | "female" | "other";
export type Goal = "muscle_gain" | "weight_loss" | "recomposition" | "maintain";
export type ActivityLevel = "low" | "medium" | "high";
export type HealthGoal = "fat_loss" | "muscle_gain" | "fitness" | "sleep_recovery";
export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type EquipmentList = "gym" | "home" | "none";
export type DietStyle = "budget" | "balanced" | "premium";

export interface AppState {
  step: Step;
  // image / import
  imageFile: File | null;
  imageBase64: string | null;
  preview: string | null;
  parseSuccess: boolean;
  parsedFields: number;
  // vision AI
  visionProvider: string;
  visionApiKey: string;
  visionModel: string;
  // measurements
  measurements: Measurements;
  // profile
  age: number;
  gender: Gender;
  heightCm: number;
  goal: Goal;
  healthGoal: HealthGoal;   // drives Compliance weight distribution
  fitnessLevel: FitnessLevel;
  activityLevel: ActivityLevel;
  availableMinutesPerDay: number;
  equipmentList: EquipmentList;
  weeklyBudget: number;
  dietStyle: DietStyle;
  sleepTime: string;
  wakeTime: string;
  // text AI
  provider: string;
  apiKey: string;
  modelName: string;
}

// ── CHECK-IN ─────────────────────────────────────────────────
export interface MorningData {
  sleepDuration?: number; // 0-4 index
  sleepQuality?: number;  // 1-5
  fatigue?: number;       // 1-10
  stress?: number;        // 1-10
  soreness?: number;      // 1-10
  weight?: string;
}

export interface EveningData {
  proteinPct?: number;    // 0-100
  waterMl?: number;
  training?: "done" | "skip" | "rest";
  mood?: number;          // 1-5
}

export interface CheckinData {
  morning?: MorningData;
  evening?: EveningData;
  morningDone?: boolean;
  eveningDone?: boolean;
}

// ── NUTRITION ─────────────────────────────────────────────────
export interface FoodItem {
  name: string;
  weight: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface MealData {
  items: FoodItem[];
  mealScore: number | null;
  mealScoreNote: string | null;
  proteinQuality: "high" | "medium" | "low" | null;
  proteinQualityNote: string | null;
}

export type MealsRecord = Record<string, MealData>;

// ── AI CONFIG (prop convenience) ────────────────────────────
export interface AiCfg {
  provider: string;
  apiKey: string;
  modelName: string;
}

// ── BODY STATE ────────────────────────────────────────────────
export interface LocalBodyScore {
  total: number;
  smmScore: number;
  bfScore: number;
  hydScore: number;
  vflScore: number;
  metScore: number;
  recoveryScore: number;
  behaviorScore: number;
  stressScore: number;
  baselineScore: number;
  stateKey: string;
  stateIcon: string;
  stateColor: string;
  stateDesc: string;
  todayFocus: string;
  topAlert: string;
  hasCheckinData: boolean;
}

// ── COMPLIANCE ───────────────────────────────────────────────
export interface ComplianceDim {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  color: string;
  icon: string;
  unit: string;
}

export interface ComplianceResult {
  total: number;
  dims: ComplianceDim[];
  level: { label: string; color: string; bg: string };
}

// ── TRAINING ─────────────────────────────────────────────────
export type TrainingType = "strength" | "cardio" | "hiit" | "sport";

export interface TrainingSession {
  id: string;           // uuid-lite: Date.now() + random
  type: TrainingType;
  durationMin: number;
  intensity: number;    // 1-10
  note?: string;
  // V1 load = duration * intensity
  // typeFactor reserved for future: strength=1.2, hiit=1.1, cardio=1.0, sport=0.9
  load: number;
}

export interface TrainingDay {
  sessions: TrainingSession[];
  totalLoad: number;    // sum of session.load
  totalDuration: number;
}

// ── CONSISTENCY ──────────────────────────────────────────────
export interface ConsistencyResult {
  streak: number;
  rate: number;
  avg: number;
  grade: "S" | "A" | "B" | "C" | "D";
  gradeColor: string;
  gradeDesc: string;
  heatmap: (number | null)[];
  scored: number[];
  isNewUser: boolean;
}

// ── RECOVERY ─────────────────────────────────────────────────
export interface RecoveryResult {
  score: number;          // 0-100
  debt: number;           // 0-100, 7-day weighted deficit
  recommendation: string; // "完全休息" | "主动恢复" | "中等训练" | "有效训练区间" | "可以全力训练"
  recommendColor: string;
}
