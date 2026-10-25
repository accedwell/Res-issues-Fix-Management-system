import { badRequest, notFound, today } from "../lib/http.js";
import { deleteCategory, getCategory, OTHER_CATEGORY } from "../store/categories.js";
import { listIssues, updateIssue } from "../store/issues.js";
import { deleteNotificationsFor } from "../store/notifications.js";
import { deleteUser, getUser } from "../store/users.js";
import { DONE_STATUSES, type User } from "../types.js";

// Removes a user. A removed staff member's unfinished jobs go back to the admin to re-assign.
export async function removeUser(actingAdmin: User, userId: string): Promise<{ unassignedJobs: number }> {
  if (userId === actingAdmin.id) throw badRequest("You cannot remove your own account");
  const user = await getUser(userId);
  if (!user) throw notFound("User not found");

  let unassignedJobs = 0;
  if (user.role === "maintenance") {
    const openJobs = (await listIssues({ assignedTo: userId })).filter((i) => !DONE_STATUSES.includes(i.status));
    for (const issue of openJobs) {
      await updateIssue(issue.id, {
        assignedTo: null,
        status: "Received",
        history: [...issue.history, { status: "Received", date: today(), note: `${user.name} was removed — waiting to be re-assigned.` }],
      });
    }
    unassignedJobs = openJobs.length;
  }

  await deleteNotificationsFor(userId);
  await deleteUser(userId);
  return { unassignedJobs };
}

// Removes a category. Reports in it move to "Other" so none are lost.
export async function removeCategory(key: string): Promise<{ movedReports: number }> {
  if (key === OTHER_CATEGORY) throw badRequest('"Other" is the default category and cannot be removed');
  if (!(await getCategory(key))) throw notFound("Category not found");

  const affected = await listIssues({ category: key });
  for (const issue of affected) await updateIssue(issue.id, { category: OTHER_CATEGORY });
  await deleteCategory(key);
  return { movedReports: affected.length };
}
