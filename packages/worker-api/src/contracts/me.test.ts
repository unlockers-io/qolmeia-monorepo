import { describe, expect, it } from "vitest";

import { activeMembership, OPERATOR_ROLES, type OrgRole } from "./me";

const membership = (id: string, role: OrgRole) => ({ id, role });

describe("activeMembership", () => {
  it("takes the customer membership on the customer surface", () => {
    const memberships = [membership("qolmeia", "OWNER"), membership("co_a", "CUSTOMER")];
    expect(activeMembership(memberships, "customer")?.id).toBe("co_a");
  });

  it("takes the operator membership on the operator surface", () => {
    const memberships = [membership("co_a", "CUSTOMER"), membership("qolmeia", "STAFF")];
    expect(activeMembership(memberships, "operator")?.id).toBe("qolmeia");
  });

  it("finds nothing when the caller has no membership on the surface", () => {
    expect(activeMembership([membership("co_a", "CUSTOMER")], "operator")).toBeNull();
    expect(activeMembership([], "customer")).toBeNull();
  });

  it("breaks a tie on one surface with the oldest membership", () => {
    const memberships = [membership("co_old", "CUSTOMER"), membership("co_new", "CUSTOMER")];
    expect(activeMembership(memberships, "customer")?.id).toBe("co_old");
  });
});

describe("OPERATOR_ROLES", () => {
  it("is every role that acts on the operator surface", () => {
    expect([...OPERATOR_ROLES].toSorted()).toEqual(["OWNER", "STAFF"]);
  });
});
