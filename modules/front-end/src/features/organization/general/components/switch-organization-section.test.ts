import { describe, expect, it } from "vitest"
import { shouldChangeOrganization } from "../organization-switch"

describe("shouldChangeOrganization", () => {
  it("does not switch when the selected organization is already current", () => {
    expect(shouldChangeOrganization("organization-1", "organization-1")).toBe(
      false
    )
  })

  it("switches when a different organization is selected", () => {
    expect(shouldChangeOrganization("organization-1", "organization-2")).toBe(
      true
    )
  })
})
