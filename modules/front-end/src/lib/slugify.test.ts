import { describe, expect, it } from "vitest"
import { slugify } from "./slugify"

describe("slugify", () => {
  it.each([
    ["  Checkout redesign!  ", "checkout-redesign"],
    ["Release__Mode", "release-mode"],
    ["New Flag_Name.v2!", "new-flag-namev2"],
    ["A_B.C:D", "a-bcd"],
    ["A--B__C", "a-b-c"],
    ["A@B", "ab"],
    ["A中文B", "ab"],
    ["Café Test", "caf-test"],
    ["--Name__", "name"],
    ["Revenue / User", "revenue-user"],
    ["\t Hello\nWorld \r\n", "hello-world"],
    ["中文", ""],
    ["---", ""],
    ["", ""],
  ])("converts %j to %j", (value, expected) => {
    expect(slugify(value)).toBe(expected)
  })
})
