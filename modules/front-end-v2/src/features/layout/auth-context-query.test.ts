import { beforeEach, describe, expect, it } from "vitest"
import { authContextQueryKeys } from "@/features/layout/auth-context-query"

describe("authentication context query keys", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("does not reuse context data from a preceding authentication session", () => {
    localStorage.setItem("featbit:auth-session-id", "session-one")
    const precedingSessionKey = authContextQueryKeys.projects("user-1", "org-1")

    localStorage.setItem("featbit:auth-session-id", "session-two")
    const currentSessionKey = authContextQueryKeys.projects("user-1", "org-1")

    expect(currentSessionKey).not.toEqual(precedingSessionKey)
  })
})
