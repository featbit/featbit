import { describe, expect, it } from "vitest"
import { listReturnUrl, withListReturn } from "./list-navigation"

describe("list return URL", () => {
  it("preserves nested list origins, escaped filters and fragments", () => {
    const list =
      "/en/feature-flags/compare?page=3&pageSize=20&name=a%26b&targetEnvIds=env-2#results"
    const detail = withListReturn(
      "/en/feature-flags/checkout/settings?context=environment&envId=env-2",
      list
    )
    const url = new URL(detail, "https://example.test")
    expect(url.searchParams.get("envId")).toBe("env-2")
    expect(listReturnUrl(url.search, "/en/feature-flags")).toBe(list)
  })
  it.each([
    "https://example.com/en/segments",
    "//example.com/en/segments",
    "/\\example.com/en/segments",
    "/en/login",
    "/en/segments/one/targeting",
    "javascript:alert(1)",
  ])("rejects an invalid return destination: %s", (returnTo) => {
    expect(
      listReturnUrl(
        new URLSearchParams({ returnTo }).toString(),
        "/en/segments"
      )
    ).toBe("/en/segments")
  })
  it("falls back when details were opened directly", () => {
    expect(listReturnUrl("?stage=measuring", "/en/experiments")).toBe(
      "/en/experiments"
    )
  })
})
