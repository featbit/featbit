import { describe, expect, it } from "vitest"
import {
  canUseSegmentAction,
  environmentRn,
  segmentRn,
} from "./segments-permissions"
import type { Segment, UserPolicy } from "./segments-types"

const envRn = environmentRn({
  organizationKey: "acme",
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
    expect(envRn).toBe("organization/acme:project/payments:env/production")
    expect(segmentRn(envRn, segment)).toBe(`${envRn}:segment/enterprise;paid`)
  })

  it("grants owners every segment action", () => {
    expect(
      canUseSegmentAction(
        [{ type: "Owner", statements: [] }],
        segmentRn(envRn, segment),
        "DeleteSegment"
      )
    ).toBe(true)
  })

  it("matches wildcard resources and SegmentAllActions", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["SegmentAllActions"])],
        segmentRn(envRn, segment),
        "ArchiveSegment"
      )
    ).toBe(true)
  })

  it("does not grant a matching action outside the statement resource", () => {
    expect(
      canUseSegmentAction(
        [
          policy(
            ["organization/acme:project/other:env/*:segment/*"],
            ["ArchiveSegment"]
          ),
        ],
        segmentRn(envRn, segment),
        "ArchiveSegment"
      )
    ).toBe(false)
  })

  it("does not grant denied statements", () => {
    expect(
      canUseSegmentAction(
        [policy([`${envRn}:segment/*`], ["ArchiveSegment"], "deny")],
        segmentRn(envRn, segment),
        "ArchiveSegment"
      )
    ).toBe(false)
  })
})
