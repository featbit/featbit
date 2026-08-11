import { describe, expect, it } from "vitest"
import { changeRequestsCopy } from "./change-requests-copy"

describe("changeRequestsCopy", () => {
  it("summarizes only the requests that need the current user's review", () => {
    expect(changeRequestsCopy("en").summary(2)).toBe("2 need your review")
    expect(changeRequestsCopy("zh").summary(2)).toBe("2 个需要你审核")
  })
})
