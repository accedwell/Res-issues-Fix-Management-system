import { HttpError } from "./http.js";

// Talks to Groq's chat API (it follows the OpenAI format). Only the report assistant uses it.
// The key lives in backend/.env as GROQ_API_KEY; without it the assistant is switched off.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 25_000;

export const isAssistantEnabled = () => !!process.env.GROQ_API_KEY;
export const assistantModel = () => process.env.GROQ_MODEL || DEFAULT_MODEL;

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

// Sends the conversation and returns the model's answer parsed as JSON.
// Every failure becomes a short message the student can act on; details go to the server log only.
export async function groqJson(messages: ChatTurn[]): Promise<unknown> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new HttpError(503, "The AI assistant is not set up on this server. Please use the form.");
  const model = assistantModel();

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_completion_tokens: 2000,
        response_format: { type: "json_object" },
        // gpt-oss models think before answering; a short think keeps replies fast.
        ...(model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    console.error("Groq request failed:", err instanceof Error ? err.message : err);
    throw new HttpError(502, "The AI assistant could not be reached. Please try again, or use the form.");
  }

  if (!res.ok) {
    console.error(`Groq answered ${res.status}:`, (await res.text().catch(() => "")).slice(0, 300));
    throw new HttpError(
      502,
      res.status === 429
        ? "The AI assistant is busy right now. Please try again in a minute, or use the form."
        : "The AI assistant could not answer. Please try again, or use the form.",
    );
  }

  const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
  try {
    return JSON.parse(data.choices?.[0]?.message?.content ?? "");
  } catch {
    throw new HttpError(502, "The AI assistant gave an answer that could not be read. Please try again.");
  }
}
