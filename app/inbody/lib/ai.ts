// ── VISION AI ────────────────────────────────────────────────
export async function callVisionAI(
  imageBase64: string,
  provider: string,
  apiKey: string,
  modelName?: string,
): Promise<string> {
  const prompt = `You are an InBody report OCR assistant. Extract all measurement values from this InBody body composition report image.

Return ONLY a JSON object with these exact keys (use null for missing values):

{
  "weight": number, "skeletalMuscleMass": number, "bodyFatMass": number,
  "bodyFatPercentage": number, "totalBodyWater": number, "intracellularWater": number,
  "extracellularWater": number, "protein": number, "minerals": number,
  "leanBodyMass": number, "basalMetabolicRate": number, "bmi": number,
  "visceralFatLevel": integer, "waistHipRatio": number, "inBodyScore": integer,
  "segmentalLeanMass": { "rightArm": number, "leftArm": number, "trunk": number, "rightLeg": number, "leftLeg": number }
}

No explanations, no markdown, just the JSON object.`;

  if (provider === "qwen") {
    const res = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName || "qwen-vl-max",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ]}],
      }),
    });
    if (!res.ok) throw new Error(`Qwen API error: ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: modelName || "gpt-4o",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: "text", text: prompt },
        ]}],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    return (await res.json()).choices[0].message.content;
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelName || "claude-opus-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
          { type: "text", text: prompt },
        ]}],
      }),
    });
    if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
    return (await res.json()).content[0].text;
  }

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
            { text: prompt },
          ]}],
          generationConfig: { maxOutputTokens: 1000 },
        }),
      },
    );
    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    return (await res.json()).candidates[0].content.parts[0].text;
  }

  if (provider === "ollama") {
    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName || "llava",
        stream: false,
        messages: [{ role: "user", content: prompt, images: [imageBase64] }],
      }),
    });
    if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
    return (await res.json()).message.content;
  }

  throw new Error(`Unsupported vision provider: ${provider}`);
}

// ── TEXT AI ──────────────────────────────────────────────────
export async function callTextAI(
  prompt: string,
  provider: string,
  apiKey: string,
  modelName?: string,
): Promise<string> {
  const configs: Record<string, any> = {
    deepseek: {
      url: "https://api.deepseek.com/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: { model: modelName || "deepseek-chat", max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      extract: (d: any) => d.choices[0].message.content,
    },
    qwen: {
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: { model: modelName || "qwen-max", max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      extract: (d: any) => d.choices[0].message.content,
    },
    openai: {
      url: "https://api.openai.com/v1/chat/completions",
      auth: `Bearer ${apiKey}`,
      body: { model: modelName || "gpt-4o", max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      extract: (d: any) => d.choices[0].message.content,
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      auth: null,
      body: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 4096 } },
      extract: (d: any) => d.candidates[0].content.parts[0].text,
    },
    ollama: {
      url: "http://localhost:11434/api/chat",
      auth: null,
      body: { model: modelName || "qwen2.5:3b", stream: false, messages: [{ role: "user", content: prompt }] },
      extract: (d: any) => d.message.content,
    },
    claude: {
      url: "https://api.anthropic.com/v1/messages",
      auth: null,
      body: { model: modelName || "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      extract: (d: any) => d.content[0].text,
    },
  };

  const cfg = configs[provider] || configs.deepseek;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "claude") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (cfg.auth) {
    headers["Authorization"] = cfg.auth;
  }

  const res = await fetch(cfg.url, { method: "POST", headers, body: JSON.stringify(cfg.body) });
  if (!res.ok) throw new Error(`${provider} API error: ${res.status}: ${await res.text()}`);
  return cfg.extract(await res.json());
}

// ── JSON PARSER ──────────────────────────────────────────────
export function parseJSON(raw: string): any {
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const s = clean.indexOf("{");
  const e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON found in response");
  return JSON.parse(clean.slice(s, e + 1));
}
