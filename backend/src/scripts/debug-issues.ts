import { getUser } from "../store/users.js";
import { listIssuesFor } from "../services/issueWorkflow.js";
import { chatSummaries } from "../services/chat.js";

const user = await getUser("stu-1");
if (!user) throw new Error("student not found");
console.log("USER:", user.id, user.role, user.block, user.room);
try {
  const issues = await listIssuesFor(user, {});
  console.log("ISSUES:", issues.length);
  const chats = await chatSummaries(user, issues);
  console.log("CHATS:", chats.size);
} catch (error) {
  console.error("FAILED:", error);
  process.exitCode = 1;
}
