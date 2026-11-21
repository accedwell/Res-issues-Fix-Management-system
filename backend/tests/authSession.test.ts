import assert from "node:assert/strict";
import { test } from "node:test";

const tokenKey = "resifix-token";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("another tab's login and logout cannot replace the supervisor's assignment credentials", async () => {
  const shared = storage();
  const supervisorTab = storage();
  const staffTab = storage();
  const previousLocal = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const previousSession = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const setTab = (tab: ReturnType<typeof storage>) => Object.defineProperty(globalThis, "sessionStorage", { value: tab, configurable: true });
  Object.defineProperty(globalThis, "localStorage", { value: shared, configurable: true });
  try {
    setTab(supervisorTab);
    const supervisor = await import("../../frontend/resifix/src/authSession.ts?tab=supervisor");
    supervisor.saveToken("supervisor-token");
    setTab(staffTab);
    const staff = await import("../../frontend/resifix/src/authSession.ts?tab=staff");
    staff.saveToken("maintenance-token");
    assert.equal(staff.getToken(), "maintenance-token");
    setTab(supervisorTab);
    assert.equal(supervisor.getToken(), "supervisor-token");
    shared.setItem(tokenKey, "old-tab-student-token");
    assert.equal(supervisor.getToken(), "supervisor-token");
    setTab(staffTab);
    staff.clearToken();
    assert.equal(staff.getToken(), null);
    setTab(supervisorTab);
    assert.equal(supervisor.getToken(), "supervisor-token");

    // Reloading the supervisor tab restores its own account.
    const reloaded = await import("../../frontend/resifix/src/authSession.ts?tab=reloaded");
    assert.equal(reloaded.getToken(), "supervisor-token");
    reloaded.clearToken();
    shared.setItem(tokenKey, "legacy-token");
    assert.equal(reloaded.getToken(), "legacy-token");
    assert.equal(supervisorTab.getItem(tokenKey), "legacy-token");
    assert.equal(shared.getItem(tokenKey), null);
    reloaded.clearToken();

    // Disabled browser storage must not lose the current login or prevent logout.
    Object.defineProperty(globalThis, "sessionStorage", { get() { throw new Error("Storage disabled"); }, configurable: true });
    reloaded.saveToken("memory-token");
    assert.equal(reloaded.getToken(), "memory-token");
    reloaded.clearToken();
    assert.equal(reloaded.getToken(), null);
  } finally {
    for (const [name, descriptor] of [["localStorage", previousLocal], ["sessionStorage", previousSession]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
