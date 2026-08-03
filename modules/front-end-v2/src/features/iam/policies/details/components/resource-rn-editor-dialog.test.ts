import { describe, expect, it } from "vitest"
import {
  buildResourceRn,
  parseResourceRn,
  type ResourceRnValues,
} from "./resource-rn"

describe("resource RN editor", () => {
  it("parses resource parts and tags from an RN", () => {
    expect(
      parseResourceRn("project/shop:env/prod:flag/checkout;release,beta")
    ).toEqual({
      project: "shop",
      env: "prod",
      flag: "checkout",
      segment: "",
      tags: "release,beta",
    })
  })

  it("builds an RN with wildcards and normalized tags", () => {
    const values: ResourceRnValues = {
      project: "shop",
      env: "*",
      flag: "",
      segment: "vip",
      tags: " paid, beta ",
    }

    expect(buildResourceRn("segment", values)).toBe(
      "project/shop:env/*:segment/vip;paid,beta"
    )
  })
})
