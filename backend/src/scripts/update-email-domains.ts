import "dotenv/config";
import prisma from "../lib/prisma.js";
import { requireRoleEmail } from "../lib/http.js";
import { roleFromDb } from "../store/mappers.js";

const sampleAddresses: Record<string, string> = {
  "naledi.m@campus.ac.za": "naledi@resstudent.ac.za",
  "p.mokgadi@campus.ac.za": "mokgadi@resstaff.ac.za",
};

try {
  const updated = await prisma.$transaction(async (tx) => {
    const users = await tx.user.findMany({ where: { isActive: true } });
    const changed = [];
    for (const user of users) {
      const role = roleFromDb(user.role);
      const domain = role === "student" ? "resstudent.ac.za" : "resstaff.ac.za";
      const previous = user.email.toLowerCase();
      const email = requireRoleEmail({ email: sampleAddresses[previous] ?? `${previous.split("@")[0]}@${domain}` }, role);
      if (user.email !== email) {
        changed.push(await tx.user.update({ where: { id: user.id }, data: { email }, select: { email: true, role: true } }));
      }
    }
    return changed;
  });
  console.log(`Updated ${updated.length} account email address(es).`);
  for (const user of updated) console.log(`${user.role}: ${user.email}`);
} finally {
  await prisma.$disconnect();
}
