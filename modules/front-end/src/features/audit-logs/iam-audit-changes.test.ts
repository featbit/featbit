import { describe, expect, it } from "vitest"
import { iamChanges } from "./iam-audit-changes"
import { auditObjectIdentity } from "./audit-log-utils"
import type { AuditLog } from "./audit-logs-types"

function log(previous: object, current: object): AuditLog {
  return {
    id: "1",
    refId: "g1",
    refType: "Group",
    operation: "Update",
    creatorId: "u1",
    creatorName: "Alice",
    creatorEmail: "alice@example.com",
    createdAt: "2026-10-12T10:00:00Z",
    comment: "",
    instructions: [],
    dataChange: {
      previous: JSON.stringify(previous),
      current: JSON.stringify(current),
    },
  }
}
describe("IAM audit changes", () => {
  it.each([
    [
      "Member",
      { email: "alice@example.com", groups: [], policies: [] },
      { description: null, members: [], statements: [] },
    ],
    [
      "Group",
      { description: "", members: [], policies: [] },
      { email: null, groups: [], statements: [] },
    ],
    [
      "Policy",
      { description: "", members: [], groups: [], statements: [] },
      { email: null, policies: [] },
    ],
  ])(
    "reads legacy and resource-specific %s snapshots identically",
    (refType, relevant, unused) => {
      const previous = {
        id: "resource",
        name: "Before",
        rn: "resource/test",
        ...relevant,
      }
      const current = { ...previous, name: "After" }
      const modern = { ...log(previous, current), refType }
      const legacy = {
        ...log({ ...previous, ...unused }, { ...current, ...unused }),
        refType,
      }
      expect(iamChanges(modern)).toEqual(iamChanges(legacy))
      expect(iamChanges(modern)).toEqual([
        { field: "name", before: "Before", after: "After" },
      ])
      expect(auditObjectIdentity(modern, "Unknown")).toEqual(
        auditObjectIdentity(legacy, "Unknown")
      )
    }
  )
  it("shows IAM RN instead of key and distinguishes relation additions/removals", () => {
    const event = log(
      { members: [{ id: "a", name: "Alice", rn: "member/alice@example.com" }] },
      {
        name: "Engineering",
        rn: "group/Engineering",
        key: "ignored",
        members: [{ id: "b", name: "Bob", rn: "member/bob@example.com" }],
      }
    )
    expect(auditObjectIdentity(event, "Unknown").key).toBe("group/Engineering")
    expect(iamChanges(event)).toEqual(
      expect.arrayContaining([
        {
          field: "members",
          before: "Alice\nmember/alice@example.com",
          after: "",
        },
        { field: "members", before: "", after: "Bob\nmember/bob@example.com" },
      ])
    )
  })
  it("matches statements by ID and ignores set reordering", () => {
    const statement = {
      id: "s1",
      effect: "allow",
      resourceType: "flag",
      resources: ["project/*"],
      actions: ["a", "b"],
    }
    expect(
      iamChanges(
        log(
          { statements: [statement] },
          { statements: [{ ...statement, actions: ["b", "a"] }] }
        )
      )
    ).toEqual([])
    expect(
      iamChanges(
        log(
          { statements: [statement] },
          { statements: [{ ...statement, effect: "deny" }] }
        )
      )
    ).toEqual([
      { field: "effect", label: "s1", before: "allow", after: "deny" },
    ])
  })
})
