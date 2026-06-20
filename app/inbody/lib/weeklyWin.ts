import { calcComplianceScore } from "./compliance";

// ── STORAGE KEY ───────────────────────────────────────────────
// Stores set of achievement IDs that have been unlocked (breakthrough type only)
const WIN_KEY = "inbody_wins_unlocked";

// ── TYPES ─────────────────────────────────────────────────────
export interface WeeklyWin {
  id: string;
  type: "breakthrough" | "sustained";
  emoji: string;
  title: string;
  desc: string;
  color: string;
  isNew: boolean; // true = first time seeing this (show celebration state)
}

// ── STORAGE HELPERS ───────────────────────────────────────────
function getUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(WIN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveUnlocked(ids: Set<string>) {
  try { localStorage.setItem(WIN_KEY, JSON.stringify([...ids])); } catch {}
}

// ── DATA HELPERS ──────────────────────────────────────────────

// Returns compliance data for past N days (index 0 = today)
function getPastCompliance(days: number): (number | null)[] {
  const results: (number | null)[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { results.push(null); continue; }
      const cr = calcComplianceScore(JSON.parse(raw));
      results.push(cr ? cr.total : null);
    } catch { results.push(null); }
  }
  return results;
}

// Returns protein pct for past N days (index 0 = today)
function getPastProtein(days: number): (number | null)[] {
  const results: (number | null)[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const checkinKey = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(checkinKey);
      if (!raw) { results.push(null); continue; }
      const ci = JSON.parse(raw);
      const pct = ci?.evening?.proteinPct;
      results.push(pct !== undefined ? pct : null);
    } catch { results.push(null); }
  }
  return results;
}

// Returns training status for past N days (index 0 = today)
function getPastTraining(days: number): (string | null)[] {
  const results: (string | null)[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `checkin_${d.toISOString().slice(0, 10)}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) { results.push(null); continue; }
      const ci = JSON.parse(raw);
      results.push(ci?.evening?.training ?? null);
    } catch { results.push(null); }
  }
  return results;
}

// Count consecutive days from index 0 matching a predicate
function countStreak(arr: (any | null)[], pred: (v: any) => boolean): number {
  let count = 0;
  for (const v of arr) {
    if (v !== null && pred(v)) count++;
    else break;
  }
  return count;
}

// ── MAIN ENGINE ───────────────────────────────────────────────
export function calcWeeklyWins(): WeeklyWin[] {
  const wins: WeeklyWin[] = [];
  const unlocked = getUnlocked();
  const newlyUnlocked = new Set<string>();

  const compliance7 = getPastCompliance(7);
  const compliance30 = getPastCompliance(30);
  const protein7 = getPastProtein(7);
  const training7 = getPastTraining(7);

  const scored7 = compliance7.filter((x): x is number => x !== null);
  const avg7 = scored7.length > 0 ? Math.round(scored7.reduce((a, b) => a + b, 0) / scored7.length) : 0;

  // ── BREAKTHROUGH ACHIEVEMENTS (persisted) ──────────────────

  // First time protein >= 80% in a day
  const everHighProtein = protein7.some(p => p !== null && p >= 80);
  if (everHighProtein) {
    const id = "protein_80_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "🥩", color: "#10b981",
      title: "蛋白达标里程碑",
      desc: "单日蛋白质完成率首次超过 80%",
    });
  }

  // First time compliance >= 85 in a day
  const everHighCompliance = compliance7.some(s => s !== null && s >= 85);
  if (everHighCompliance) {
    const id = "compliance_85_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "⭐", color: "#f59e0b",
      title: "优秀执行首达",
      desc: "执行分首次突破 85 分",
    });
  }

  // First time 7-day streak
  const streak7 = countStreak(compliance7, s => s >= 50);
  if (streak7 >= 7) {
    const id = "streak_7_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "🔥", color: "#f97316",
      title: "7天连续达标",
      desc: "连续 7 天完成 Check-in，习惯已初步形成",
    });
  }

  // First time protein >= 80% for 3+ consecutive days
  const proteinStreak3 = countStreak(protein7, p => p >= 80);
  if (proteinStreak3 >= 3) {
    const id = "protein_streak_3_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "💪", color: "#10b981",
      title: "蛋白连续达标",
      desc: "连续 3 天蛋白质完成率超过 80%",
    });
  }

  // First time weekly avg >= 75
  if (scored7.length >= 5 && avg7 >= 75) {
    const id = "weekly_avg_75_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "📈", color: "#0ea5e9",
      title: "周均分突破 75",
      desc: "本周平均执行分首次达到 75 分",
    });
  }

  // First perfect training week (5+ training days done in 7 days)
  const trainingDone7 = training7.filter(t => t === "done").length;
  if (trainingDone7 >= 5) {
    const id = "training_5_week_first";
    const isNew = !unlocked.has(id);
    if (isNew) newlyUnlocked.add(id);
    wins.push({
      id, type: "breakthrough", isNew,
      emoji: "🏋️", color: "#8b5cf6",
      title: "训练满勤里程碑",
      desc: "7天内完成 5 次训练，首次达成",
    });
  }

  // ── SUSTAINED ACHIEVEMENTS (realtime, no persistence needed) ──

  // Stable improvement: last 3 days each better than the day before
  const last3 = compliance7.slice(0, 3).filter((x): x is number => x !== null);
  if (last3.length === 3 && last3[0] > last3[1] && last3[1] > last3[2]) {
    wins.push({
      id: "improving_3d", type: "sustained", isNew: false,
      emoji: "📊", color: "#0ea5e9",
      title: "连续 3 天进步",
      desc: `执行分持续上升：${last3[2]} → ${last3[1]} → ${last3[0]}`,
    });
  }

  // Sustained high protein: 5+ days with protein >= 70% in past 7
  const proteinGood7 = protein7.filter(p => p !== null && p >= 70).length;
  if (proteinGood7 >= 5) {
    wins.push({
      id: "protein_sustained", type: "sustained", isNew: false,
      emoji: "🥗", color: "#10b981",
      title: "蛋白摄入稳定",
      desc: `本周 ${proteinGood7}/7 天蛋白完成率超过 70%`,
    });
  }

  // Sustained training: 4+ training days (done or rest) in 7
  const trainingActive = training7.filter(t => t === "done" || t === "rest").length;
  if (trainingActive >= 4) {
    wins.push({
      id: "training_sustained", type: "sustained", isNew: false,
      emoji: "⚡", color: "#8b5cf6",
      title: "训练节律稳定",
      desc: `本周 ${trainingActive}/7 天保持训练或主动休息计划`,
    });
  }

  // Sustained high weekly avg (no breakthrough threshold, just currently good)
  if (scored7.length >= 5 && avg7 >= 80) {
    wins.push({
      id: "high_avg_sustained", type: "sustained", isNew: false,
      emoji: "🌟", color: "#f59e0b",
      title: "高质量执行周",
      desc: `本周平均执行分 ${avg7}，保持优秀状态`,
    });
  }

  // Persist any newly unlocked breakthrough wins
  if (newlyUnlocked.size > 0) {
    newlyUnlocked.forEach(id => unlocked.add(id));
    saveUnlocked(unlocked);
  }

  // Sort: new breakthroughs first, then other breakthroughs, then sustained
  // Within each group: isNew first
  wins.sort((a, b) => {
    const scoreA = a.isNew ? 0 : a.type === "breakthrough" ? 1 : 2;
    const scoreB = b.isNew ? 0 : b.type === "breakthrough" ? 1 : 2;
    return scoreA - scoreB;
  });

  // Cap at 3 to avoid overwhelming the UI
  return wins.slice(0, 3);
}

// Utility: reset all unlocked wins (for testing / settings)
export function resetWeeklyWins() {
  try { localStorage.removeItem(WIN_KEY); } catch {}
}
