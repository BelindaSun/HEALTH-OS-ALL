import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { nanoid } from "nanoid";

import type {
  InBodyUserProfile,
  InBodyMeasurements,
  InBodyPlan,
  InBodyHistoryEntry,
  ModuleStatus,
  BodyCompositionReport,
  InBodyWorkoutPlan,
  InBodyNutritionPlan,
  InBodyHydrationPlan,
  VisceralMetabolicPlan,
  ProgressReport,
  AIProvider,
} from "@/lib/types/inbody";

import {
  bodyCompositionPrompt,
  workoutPrompt,
  nutritionPrompt,
  hydrationPrompt,
  visceralMetabolicPrompt,
  progressPrompt,
} from "@/lib/ai/modules/inbody-prompts";

// ─── Store 类型定义 ──────────────────────────────────────────

export type PDFParseStatus =
  | "idle"
  | "parsing"
  | "success"
  | "error"
  | "manual";

interface InBodyStore {
  // ── 用户画像 ──
  profile: Partial<InBodyUserProfile>;
  setProfile: (partial: Partial<InBodyUserProfile>) => void;
  setMeasurements: (m: InBodyMeasurements) => void;
  resetProfile: () => void;

  // ── PDF 解析状态 ──
  pdfParseStatus: PDFParseStatus;
  pdfParseResult: any | null;
  setPDFParseStatus: (status: PDFParseStatus) => void;
  setPDFParseResult: (result: any) => void;
  clearPDFState: () => void;

  // ── 当前方案 ──
  currentPlan: InBodyPlan | null;
  initPlan: () => void; // 初始化一个空方案（profile 填好后调用）

  // ── 各模块生成 ──
  generateModule: (
    module: keyof Omit<InBodyPlan, "id" | "createdAt" | "profile">,
  ) => Promise<void>;
  generateAllModules: () => Promise<void>;

  // ── 历史记录 ──
  history: InBodyHistoryEntry[];
  saveCurrentToHistory: () => void;
  deleteHistoryEntry: (id: string) => void;
  clearHistory: () => void;

  // ── 进度追踪：加载历史对比 ──
  compareWithHistory: (previousEntryId: string) => Promise<void>;
}

// ─── 默认空 profile ──────────────────────────────────────────

const DEFAULT_PROFILE: Partial<InBodyUserProfile> = {
  activityLevel: "medium",
  fitnessLevel: "intermediate",
  hasEquipment: false,
  dietStyle: "balanced",
  weeklyBudget: 300,
  availableMinutesPerDay: 45,
  sleepTime: "23:00",
  wakeTime: "07:00",
  inputMethod: "pdf",
};

// ─── AI 调用工具函数 ─────────────────────────────────────────

async function callAI(
  prompt: string,
  profile: Partial<InBodyUserProfile>,
): Promise<string> {
  const provider = profile.provider ?? "deepseek";
  const apiKey = profile.apiKey ?? "";
  const modelName = profile.modelName;

  const providers: Record<
    AIProvider,
    {
      endpoint: string;
      buildBody: (p: string) => object;
      extractText: (d: unknown) => string;
    }
  > = {
    deepseek: {
      endpoint: "https://api.deepseek.com/v1/chat/completions",
      buildBody: (p) => ({
        model: modelName ?? "deepseek-chat",
        max_tokens: 4096,
        messages: [{ role: "user", content: p }],
      }),
      extractText: (d: unknown) =>
        (d as { choices: { message: { content: string } }[] }).choices[0]
          .message.content,
    },
    openai: {
      endpoint: "https://api.openai.com/v1/chat/completions",
      buildBody: (p) => ({
        model: modelName ?? "gpt-4o",
        max_tokens: 4096,
        messages: [{ role: "user", content: p }],
      }),
      extractText: (d: unknown) =>
        (d as { choices: { message: { content: string } }[] }).choices[0]
          .message.content,
    },
    claude: {
      endpoint: "https://api.anthropic.com/v1/messages",
      buildBody: (p) => ({
        model: modelName ?? "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: p }],
      }),
      extractText: (d: unknown) =>
        (d as { content: { text: string }[] }).content[0].text,
    },
    gemini: {
      endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      buildBody: (p) => ({
        contents: [{ parts: [{ text: p }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
      extractText: (d: unknown) =>
        (d as { candidates: { content: { parts: { text: string }[] } }[] })
          .candidates[0].content.parts[0].text,
    },
    qwen: {
      endpoint:
        "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      buildBody: (p) => ({
        model: modelName ?? "qwen-max",
        max_tokens: 4096,
        messages: [{ role: "user", content: p }],
      }),
      extractText: (d: unknown) =>
        (d as { choices: { message: { content: string } }[] }).choices[0]
          .message.content,
    },
    ollama: {
      endpoint: "http://localhost:11434/api/chat",
      buildBody: (p) => ({
        model: modelName ?? "qwen2.5:14b",
        stream: false,
        messages: [{ role: "user", content: p }],
      }),
      extractText: (d: unknown) =>
        (d as { message: { content: string } }).message.content,
    },
  };

  const config = providers[provider];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (provider === "claude") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (provider !== "gemini" && provider !== "ollama") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const resp = await fetch(config.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(config.buildBody(prompt)),
  });

  if (!resp.ok) throw new Error(`${provider} API error: ${resp.status}`);
  const data = await resp.json();
  return config.extractText(data);
}

function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("响应中未找到 JSON");
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

// ─── 创建空方案 ──────────────────────────────────────────────

function createEmptyPlan(profile: InBodyUserProfile): InBodyPlan {
  const idle = { status: "idle" as ModuleStatus, data: null };
  return {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    profile,
    bodyComposition: idle,
    workout: idle,
    nutrition: idle,
    hydration: idle,
    visceralMetabolic: idle,
    progress: idle,
  };
}

// ─── Store 实现 ──────────────────────────────────────────────

export const useInBodyStore = create<InBodyStore>()(
  persist(
    (set, get) => ({
      // ── 初始状态 ──
      profile: DEFAULT_PROFILE,
      pdfParseStatus: "idle",
      pdfParseResult: null,
      currentPlan: null,
      history: [],

      // ── Profile ──
      setProfile: (partial) =>
        set((s) => ({ profile: { ...s.profile, ...partial } })),

      setMeasurements: (m) =>
        set((s) => ({
          profile: { ...s.profile, measurements: m },
        })),

      resetProfile: () =>
        set({
          profile: DEFAULT_PROFILE,
          currentPlan: null,
          pdfParseStatus: "idle",
        }),

      // ── PDF 解析状态 ──
      setPDFParseStatus: (status) => set({ pdfParseStatus: status }),
      setPDFParseResult: (result) => set({ pdfParseResult: result }),
      clearPDFState: () =>
        set({ pdfParseStatus: "idle", pdfParseResult: null }),

      // ── 初始化方案 ──
      initPlan: () => {
        const { profile } = get();
        if (!profile.measurements || !profile.age || !profile.gender) {
          console.warn("InBodyStore: profile 未填完整，无法初始化方案");
          return;
        }
        const plan = createEmptyPlan(profile as InBodyUserProfile);
        set({ currentPlan: plan });
      },

      // ── 生成单个模块 ──
      generateModule: async (module) => {
        const { profile, currentPlan } = get();
        if (!currentPlan || !profile.measurements) return;

        const fullProfile = profile as InBodyUserProfile;

        // 设置 loading
        set((s) => ({
          currentPlan: s.currentPlan
            ? {
                ...s.currentPlan,
                [module]: { status: "loading", data: null },
              }
            : null,
        }));

        try {
          let prompt = "";
          switch (module) {
            case "bodyComposition":
              prompt = bodyCompositionPrompt(fullProfile);
              break;
            case "workout":
              prompt = workoutPrompt(fullProfile);
              break;
            case "nutrition":
              prompt = nutritionPrompt(fullProfile);
              break;
            case "hydration":
              prompt = hydrationPrompt(fullProfile);
              break;
            case "visceralMetabolic":
              prompt = visceralMetabolicPrompt(fullProfile);
              break;
            case "progress":
              // progress 模块需要历史数据，单独调用 compareWithHistory
              console.warn("请使用 compareWithHistory() 生成进度模块");
              set((s) => ({
                currentPlan: s.currentPlan
                  ? {
                      ...s.currentPlan,
                      progress: { status: "idle", data: null },
                    }
                  : null,
              }));
              return;
          }

          const raw = await callAI(prompt, profile);

          // 根据模块类型解析 JSON
          let data: unknown;
          switch (module) {
            case "bodyComposition":
              data = parseJSON<BodyCompositionReport>(raw);
              break;
            case "workout":
              data = parseJSON<InBodyWorkoutPlan>(raw);
              break;
            case "nutrition":
              data = parseJSON<InBodyNutritionPlan>(raw);
              break;
            case "hydration":
              data = parseJSON<InBodyHydrationPlan>(raw);
              break;
            case "visceralMetabolic":
              data = parseJSON<VisceralMetabolicPlan>(raw);
              break;
          }

          set((s) => ({
            currentPlan: s.currentPlan
              ? {
                  ...s.currentPlan,
                  [module]: {
                    status: "success",
                    data,
                    generatedAt: new Date().toISOString(),
                  },
                }
              : null,
          }));
        } catch (err) {
          const error = err instanceof Error ? err.message : "生成失败，请重试";
          set((s) => ({
            currentPlan: s.currentPlan
              ? {
                  ...s.currentPlan,
                  [module]: { status: "error", data: null, error },
                }
              : null,
          }));
        }
      },

      // ── 生成全部模块（并发 5 个，progress 跳过）──
      generateAllModules: async () => {
        const modules: (keyof Omit<
          InBodyPlan,
          "id" | "createdAt" | "profile" | "progress"
        >)[] = [
          "bodyComposition",
          "workout",
          "nutrition",
          "hydration",
          "visceralMetabolic",
        ];

        await Promise.all(modules.map((m) => get().generateModule(m)));
      },

      // ── 进度对比模块（需要历史数据）──
      compareWithHistory: async (previousEntryId) => {
        const { profile, currentPlan, history } = get();
        if (!currentPlan || !profile.measurements) return;

        const prevEntry = history.find((h) => h.id === previousEntryId);
        if (!prevEntry) {
          console.warn("未找到历史记录:", previousEntryId);
          return;
        }

        set((s) => ({
          currentPlan: s.currentPlan
            ? { ...s.currentPlan, progress: { status: "loading", data: null } }
            : null,
        }));

        try {
          const fullProfile = profile as InBodyUserProfile;
          const prompt = progressPrompt(
            fullProfile,
            prevEntry.plan.profile.measurements,
            prevEntry.plan.profile.measurements.measuredAt ??
              prevEntry.createdAt,
          );

          const raw = await callAI(prompt, profile);
          const data = parseJSON<ProgressReport>(raw);

          set((s) => ({
            currentPlan: s.currentPlan
              ? {
                  ...s.currentPlan,
                  progress: {
                    status: "success",
                    data,
                    generatedAt: new Date().toISOString(),
                  },
                }
              : null,
          }));
        } catch (err) {
          const error = err instanceof Error ? err.message : "进度对比生成失败";
          set((s) => ({
            currentPlan: s.currentPlan
              ? {
                  ...s.currentPlan,
                  progress: { status: "error", data: null, error },
                }
              : null,
          }));
        }
      },

      // ── 历史记录 ──
      saveCurrentToHistory: () => {
        const { currentPlan } = get();
        if (!currentPlan) return;

        const m = currentPlan.profile.measurements;
        const entry: InBodyHistoryEntry = {
          id: nanoid(),
          createdAt: new Date().toISOString(),
          snapshotSummary: {
            weight: m.weight,
            skeletalMuscleMass: m.skeletalMuscleMass,
            bodyFatPercentage: m.bodyFatPercentage,
            visceralFatLevel: m.visceralFatLevel,
            inBodyScore: m.inBodyScore,
          },
          plan: currentPlan,
        };

        set((s) => ({
          history: [entry, ...s.history].slice(0, 20), // 最多保存20条
        }));
      },

      deleteHistoryEntry: (id) =>
        set((s) => ({ history: s.history.filter((h) => h.id !== id) })),

      clearHistory: () => set({ history: [] }),
    }),

    {
      name: "inbody-os-store",
      storage: createJSONStorage(() => localStorage),
      // 只持久化必要数据，不存 loading 状态
      partialize: (s) => ({
        profile: s.profile,
        history: s.history,
        // currentPlan 也持久化，方便刷新后恢复
        currentPlan: s.currentPlan,
      }),
    },
  ),
);

// ─── 便捷 Selector Hooks ─────────────────────────────────────

export const useProfile = () => useInBodyStore((s) => s.profile);
export const useCurrentPlan = () => useInBodyStore((s) => s.currentPlan);
export const useHistory = () => useInBodyStore((s) => s.history);
export const usePDFParseStatus = () => useInBodyStore((s) => s.pdfParseStatus);
export const usePDFParseResult = () => useInBodyStore((s) => s.pdfParseResult);

/** 获取某个模块的状态 */
export const useModule = <
  K extends keyof Omit<InBodyPlan, "id" | "createdAt" | "profile">,
>(
  key: K,
) =>
  useInBodyStore((s) => s.currentPlan?.[key] ?? { status: "idle", data: null });

/** 是否所有核心模块都已生成完成 */
export const useAllModulesReady = () =>
  useInBodyStore((s) => {
    const plan = s.currentPlan;
    if (!plan) return false;
    return (
      plan.bodyComposition.status === "success" &&
      plan.workout.status === "success" &&
      plan.nutrition.status === "success" &&
      plan.hydration.status === "success" &&
      plan.visceralMetabolic.status === "success"
    );
  });
