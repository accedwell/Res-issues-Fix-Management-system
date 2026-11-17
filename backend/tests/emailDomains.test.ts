import assert from "node:assert/strict";
import { test } from "node:test";
import { HttpError, requireRoleEmail } from "../src/lib/http.js";
import { isEmailForRole } from "../../frontend/resifix/src/utils.ts";
import type { Role } from "../src/types.js";

for (const role of ["student", "admin", "maintenance", "sysadmin"] as Role[]) {
  test(`${role}: validates the correct domain and normalizes mixed-case addresses`, () => {
    const domain = role === "student" ? "resStudent.ac.za" : "resStaff.ac.za";
    const address = `  Example@${domain}  `;
    assert.equal(requireRoleEmail({ email: address }, role), `example@${domain.toLowerCase()}`);
    assert.equal(isEmailForRole(address, role), true);
  });

  test(`${role}: rejects the other role's domain, subdomains, suffix tricks and malformed email`, () => {
    const domain = role === "student" ? "resstudent.ac.za" : "resstaff.ac.za";
    const wrongDomain = role === "student" ? "resstaff.ac.za" : "resstudent.ac.za";
    for (const email of [`user@${wrongDomain}`, "user@campus.ac.za", `user@sub.${domain}`, `user@${domain}.example`, `user@@${domain}`, `user name@${domain}`, `@${domain}`, ""]) {
      assert.throws(() => requireRoleEmail({ email }, role), (error) => error instanceof HttpError && error.status === 400);
      assert.equal(isEmailForRole(email, role), false);
    }
  });
}
