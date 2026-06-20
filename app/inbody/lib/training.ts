import { TrainingSession, TrainingDay, TrainingType } from "../types";

// ── STORAGE ───────────────────────────────────────────────────
export function trainingKey(date?: Date): string {
  const d = date ?? new Date();
  return `training_${d.toISOString().slice(0, 10)}`;
}

export function loadTrainingDay(date?: Date): TrainingDay {
  try {
    const raw = localStorage.getItem(trainingKey(date));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { sessions: [], totalLoad: 0, totalDuration: 0 };
}

function saveTrainingDay(day: TrainingDay, date?: Date) {
  try {
    localStorage.setItem(trainingKey(date), JSON.stringify(day));
  } catch {}
}

// ── LOAD CALC ─────────────────────────────────────────────────
// V1: Load = duration * intensity
// typeFactor interface reserved — multiply here when Phase 3+ adds it
export function calcLoad(durationMin: number, intensity: number): number {
  // typeFactor placeholder: currently 1.0 for all types
  // Future: { strength: 1.2, hiit: 1.1, cardio: 1.0, sport: 0.9 }[type] ?? 1.0
  return Math.round(durationMin * intensity);
}

// ── CRUD ──────────────────────────────────────────────────────
export function addSession(session: Omit<TrainingSession, "id" | "load">): TrainingDay {
  const day = loadTrainingDay();
  const newSession: TrainingSession = {
    ...session,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    load: calcLoad(session.durationMin, session.intensity),
  };
  const sessions = [...day.sessions, newSession];
  const updated: TrainingDay = {
    sessions,
    totalLoad: sessions.reduce((s, x) => s + x.load, 0),
    totalDuration: sessions.reduce((s, x) => s + x.durationMin, 0),
  };
  saveTrainingDay(updated);
  writebackToCompliance(updated);
  return updated;
}

export function removeSession(id: string): TrainingDay {
  const day = loadTrainingDay();
  const sessions = day.sessions.filter(s => s.id !== id);
  const updated: TrainingDay = {
    sessions,
    totalLoad: sessions.reduce((s, x) => s + x.load, 0),
    totalDuration: sessions.reduce((s, x) => s + x.durationMin, 0),
  };
  saveTrainingDay(updated);
  writebackToCompliance(updated);
  return updated;
}

// ── COMPLIANCE WRITEBACK ──────────────────────────────────────
// Replaces evening check-in training field so Compliance picks it up.
// Logic: any session recorded -> "done"; no sessions -> leave as-is (don't overwrite manual skip/rest)
export function writebackToCompliance(day: TrainingDay) {
  if (day.sessions.length === 0) return;
  try {
    const key = `checkin_${new Date().toISOString().slice(0, 10)}`;
    const raw = localStorage.getItem(key);
    const ci = raw ? JSON.parse(raw) : {};
    const updated = {
      ...ci,
      evening: { ...(ci.evening ?? {}), training: "done" },
    };
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {}
}

// ── LOAD ZONE LABEL ───────────────────────────────────────────
// Contextualises the raw load number for the user
export function loadZone(totalLoad: number): { label: string; color: string; desc: string } {
  if (totalLoad === 0)    return { label: "休息",   color: "#475569", desc: "今日无训练记录" };
  if (totalLoad < 150)    return { label: "低强度", color: "#0ea5e9", desc: "热身 / 恢复训练" };
  if (totalLoad < 300)    return { label: "中强度", color: "#10b981", desc: "有效训练范围" };
  if (totalLoad < 500)    return { label: "高强度", color: "#f59e0b", desc: "充分刺激，注意恢复" };
  return                         { label: "极高强度", color: "#f43f5e", desc: "超量负荷，明日必须恢复" };
}

// ── TYPE META ─────────────────────────────────────────────────
export const TRAINING_TYPES: { key: TrainingType; label: string; emoji: string; color: string }[] = [
  { key: "strength", label: "力量",  emoji: "🏋️", color: "#8b5cf6" },
  { key: "cardio",   label: "有氧",  emoji: "🏃", color: "#0ea5e9" },
  { key: "hiit",     label: "HIIT",  emoji: "⚡", color: "#f43f5e" },
  { key: "sport",    label: "运动",  emoji: "⚽", color: "#10b981" },
];

export function typeMeta(type: TrainingType) {
  return TRAINING_TYPES.find(t => t.key === type) ?? TRAINING_TYPES[0];
}
