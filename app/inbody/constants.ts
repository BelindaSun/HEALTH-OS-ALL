// ── STORAGE KEY ──────────────────────────────────────────────
export const STORAGE_KEY = "inbody_os_state";

// ── COLORS ───────────────────────────────────────────────────
export const C = {
  bg: "#020817",
  surface: "rgba(15,23,42,0.85)",
  border: "rgba(255,255,255,0.07)",
  emerald: "#10b981",
  emeraldDim: "rgba(16,185,129,0.12)",
  amber: "#f59e0b",
  amberDim: "rgba(245,158,11,0.12)",
  sky: "#0ea5e9",
  skyDim: "rgba(14,165,233,0.12)",
  rose: "#f43f5e",
  roseDim: "rgba(244,63,94,0.12)",
  violet: "#8b5cf6",
  violetDim: "rgba(139,92,246,0.12)",
  text: "#f1f5f9",
  textSub: "#94a3b8",
  textMuted: "#475569",
};

// Glass card style helper
export const g = (ex: Record<string, any> = {}): Record<string, any> => ({
  background: C.surface,
  backdropFilter: "blur(20px)",
  border: `1px solid ${C.border}`,
  borderRadius: 24,
  ...ex,
});

// ── PROVIDERS ────────────────────────────────────────────────
export const VISION_PROVIDERS = [
  { id: "qwen",   label: "Qwen-VL",      tag: "国内直连", vpn: false, color: C.emerald },
  { id: "openai", label: "GPT-4o",        tag: "需VPN",   vpn: true,  color: C.sky },
  { id: "claude", label: "Claude Vision", tag: "需VPN",   vpn: true,  color: C.violet },
  { id: "gemini", label: "Gemini",        tag: "需VPN",   vpn: true,  color: C.amber },
  { id: "ollama", label: "Ollama+LLaVA",  tag: "本地",    vpn: false, color: C.rose },
];

export const TEXT_PROVIDERS = [
  { id: "qwen",     label: "Qwen",     tag: "国内直连", vpn: false },
  { id: "deepseek", label: "DeepSeek", tag: "国内直连", vpn: false },
  { id: "openai",   label: "GPT-4o",   tag: "需VPN",   vpn: true  },
  { id: "claude",   label: "Claude",   tag: "需VPN",   vpn: true  },
  { id: "gemini",   label: "Gemini",   tag: "需VPN",   vpn: true  },
  { id: "ollama",   label: "Ollama",   tag: "本地",    vpn: false },
];

// ── MEAL CONSTANTS ───────────────────────────────────────────
export const MEAL_KEYS = ["breakfast", "lunch", "dinner", "snack"] as const;
export const MEAL_LABELS: Record<string, string> = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐", snack: "加餐" };
export const MEAL_ICONS:  Record<string, string> = { breakfast: "🌅",  lunch: "☀️",   dinner: "🌙",   snack: "🥛"  };
export const MEAL_COLORS: Record<string, string> = { breakfast: "#f59e0b", lunch: "#10b981", dinner: "#8b5cf6", snack: "#0ea5e9" };

// ── GOAL LABELS ──────────────────────────────────────────────
export const GOAL_CN: Record<string, string> = {
  muscle_gain:   "增肌塑形",
  weight_loss:   "减脂瘦身",
  recomposition: "体成分重塑",
  maintain:      "维持体形",
};
