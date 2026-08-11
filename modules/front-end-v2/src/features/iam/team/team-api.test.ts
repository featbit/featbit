import { beforeEach, describe, expect, it } from "vitest"
import { teamQueryKeys } from "@/features/iam/team/team-api"

describe("team query keys", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("does not reuse member data from a preceding authentication session", () => {
    const params = { searchText: "", pageIndex: 0, pageSize: 10 }
    localStorage.setItem("featbit:auth-session-id", "session-one")
    const precedingSessionKey = teamQueryKeys.members("org-1", params)

    localStorage.setItem("featbit:auth-session-id", "session-two")
    const currentSessionKey = teamQueryKeys.members("org-1", params)

    expect(currentSessionKey).not.toEqual(precedingSessionKey)
  })
})
