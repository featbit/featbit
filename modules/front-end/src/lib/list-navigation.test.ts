import { describe, expect, it } from "vitest"
import { createElement, type PropsWithChildren } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { listReturnUrl, withListReturn, useDetailHref } from "./list-navigation"

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

describe("detail tab environment context", () => {
  it.each([true, false])("preserves context with returnTo=%s", (hasOrigin) => {
    const origin = "/en/feature-flags/compare?name=checkout&page=3&envId=source"
    const params = new URLSearchParams({
      context: "environment",
      projectId: "target-project",
      envId: "target-env",
      unrelated: "ignored",
    })
    if (hasOrigin) params.set("returnTo", origin)
    const { result } = renderHook(() => useDetailHref(), {
      wrapper: ({ children }: PropsWithChildren) =>
        createElement(
          MemoryRouter,
          {
            initialEntries: [`/en/feature-flags/checkout/targeting?${params}`],
          },
          children
        ),
    })
    const tab = new URL(
      result.current(
        "/en/feature-flags/checkout/settings?view=advanced#section"
      ),
      "https://example.test"
    )
    expect(tab.searchParams.get("context")).toBe("environment")
    expect(tab.searchParams.get("projectId")).toBe("target-project")
    expect(tab.searchParams.get("envId")).toBe("target-env")
    expect(tab.searchParams.get("returnTo")).toBe(hasOrigin ? origin : null)
    expect(tab.searchParams.get("view")).toBe("advanced")
    expect(tab.searchParams.has("unrelated")).toBe(false)
    expect(tab.hash).toBe("#section")
    const explicit = new URL(
      result.current(
        "/en/feature-flags/checkout/settings?context=environment&projectId=other-project&envId=other-env"
      ),
      "https://example.test"
    )
    expect(explicit.searchParams.get("projectId")).toBe("other-project")
    expect(explicit.searchParams.get("envId")).toBe("other-env")
  })
})
