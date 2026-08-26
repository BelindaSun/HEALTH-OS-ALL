// lib/ai/providers/deepseek.ts
// DeepSeek API 调用封装，接口兼容 OpenAI 格式

export async function callDeepSeek(
  prompt: string,
  apiKey: string,
  model = "deepseek-v4-flash",
): Promise<string> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "你是一个健康管理AI助手。严格按照用户要求的JSON格式输出，不要输出任何其他内容，不要加markdown代码块。",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}
