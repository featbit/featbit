import { describe, expect, it } from "vitest"
import {
  canUseSegmentAction,
  environmentRn,
  segmentRn,
} from "./segments-permissions"
import type { Segment, UserPolicy } from "./segments-types"

const envRn = environmentRn({
  projectKey: "payments",
  environmentKey: "production",
})

const segment: Pick<Segment, "key" | "tags"> = {
  key: "enterprise",
  tags: ["paid"],
}

function policy(
  resources: string[],
  actions: string[],
  effect = "allow"
): UserPolicy {
  return {
    type: "Custom",
    statements: [{ resourceType: "segment", effect, resources, actions }],
  }
}

describe("segment permissions", () => {
  it("builds the environment and tagged segment resource names", () => {
    expect(envRn).toBe("project/payments:env/production")
    expect(segmentRn(envRn, segment)).toBe(`${envRn}:segment/enterprise;paid`)
  })

  it("grants owners every segment action", () => {
    expect(
      canUseSegmentAction(
        [
          {
            name: "Owner",
            type: "SysManaged",
            statements: [
              {
                resourceType: "*",
                effect: "allow",
                resources: ["*"],
                actions: ["*"],
              },
            ],
          },
        ],
        segmentRn(envRn, segment),
        "DeleteSegment",
        false
      )
    ).toBe(true)
  })

  it("matches wildcard resources and the canonical all-actions value", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["*"])],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        false
      )
    ).toBe(true)
  })

  it("does not treat the frontend action key as a stored permission value", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["SegmentAllActions"])],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        false
      )
    ).toBe(false)
  })

  it("grants only the independently allowed General field", () => {
    const policies = [
      policy(["project/*:env/*:segment/*"], ["UpdateSegmentDescription"]),
    ]
    const resourceRn = segmentRn(envRn, segment)

    expect(
      canUseSegmentAction(
        policies,
        resourceRn,
        "UpdateSegmentDescription",
        true
      )
    ).toBe(true)
    expect(
      canUseSegmentAction(policies, resourceRn, "UpdateSegmentName", true)
    ).toBe(false)
    expect(
      canUseSegmentAction(policies, resourceRn, "UpdateSegmentTags", true)
    ).toBe(false)
  })

  it("matches parent scopes and tagged resources like the backend matcher", () => {
    const resourceRn = segmentRn(envRn, segment)

    expect(
      canUseSegmentAction(
        [policy(["project/payments:env/production"], ["ArchiveSegment"])],
        resourceRn,
        "ArchiveSegment",
        true
      )
    ).toBe(true)
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*;internal,pa*`], ["ArchiveSegment"])],
        resourceRn,
        "ArchiveSegment",
        true
      )
    ).toBe(true)
  })

  it("does not grant a matching action outside the statement resource", () => {
    expect(
      canUseSegmentAction(
        [policy(["project/other:env/*:segment/*"], ["ArchiveSegment"])],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        true
      )
    ).toBe(false)
  })

  it("does not grant denied statements", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["ArchiveSegment"], "deny")],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        true
      )
    ).toBe(false)
  })

  it("gives a matching deny statement precedence over an allow", () => {
    expect(
      canUseSegmentAction(
        [
          policy(["project/*:env/*:segment/*"], ["ArchiveSegment"]),
          policy([`${envRn}:segment/enterprise`], ["ArchiveSegment"], "deny"),
        ],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        true
      )
    ).toBe(false)
  })

  it("requires fine-grained access for a concrete action policy", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["ArchiveSegment"])],
        segmentRn(envRn, segment),
        "ArchiveSegment",
        false
      )
    ).toBe(false)
  })
})
