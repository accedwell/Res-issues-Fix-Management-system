import { Router } from "express";
import { currentUser, requireAuth, requireRole } from "../middleware/auth.js";
import { chatTurn } from "../services/chatbot.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

// POST /api/chat — talk to the ResiFix AI assistant.
// Body: { message, draft?, confirm? }. The response contains the assistant reply,
// the accumulated draft, and (when confirmed) the created + auto-assigned issue.
chatRouter.post("/", requireRole("student"), async (req, res) => {
  res.json(await chatTurn(currentUser(req), req.body ?? {}));
});
