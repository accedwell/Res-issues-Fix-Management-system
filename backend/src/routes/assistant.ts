import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { isAssistantEnabled } from "../lib/groq.js";
import { rateLimit } from "../lib/rateLimit.js";
import { askAssistant, readConversation } from "../services/assistant.js";

// The AI report assistant's conversation. Kept out of /api/issues on purpose: nothing is saved
// here, so other browsers must not reload on every message. Submitting the finished report is
// POST /api/issues/assistant.
export const assistantRouter = Router();
assistantRouter.use(requireAuth);

// Each message costs a call to Groq, so one student can't run up the bill or hit its limits for everyone.
const messageLimit = rateLimit({
  max: 40,
  minutes: 15,
  key: (req) => `assistant:${currentUser(req).id}`,
  message: "You've sent a lot of messages to the assistant. Wait a few minutes, or use the form.",
});

// GET /api/assistant — whether the assistant is switched on, so the app knows whether to offer it.
assistantRouter.get("/", (_req, res) => {
  res.json({ enabled: isAssistantEnabled() });
});

// POST /api/assistant/chat — { messages: [{ role: "user" | "assistant", content }] }
// Returns the assistant's reply and the report it has put together so far.
assistantRouter.post("/chat", requireRole("student"), messageLimit, async (req, res) => {
  const conversation = readConversation(req.body?.messages);
  res.json(await askAssistant(currentUser(req), conversation));
});
