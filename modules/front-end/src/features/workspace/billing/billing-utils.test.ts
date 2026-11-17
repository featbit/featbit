import { describe, expect, it } from "vitest"
import {
  currentTotal,
  FINE_GRAINED_ACCESS,
  planPriceBreakdown,
} from "./billing-utils"

describe("subscription pricing", () => {
  it("recognizes the API fine-grained access feature key", () => {
    expect(FINE_GRAINED_ACCESS).toBe("fine-grained-ac")
    expect(
      planPriceBreakdown({
        plan: "growth",
        billingCycle: "month",
        mau: 40000,
        addOnFeatures: ["fine-grained-ac"],
      })
    ).toEqual({
      basePrice: 149,
      extraMau: 0,
      extraMauPrice: 0,
      addOnPrice: 60,
    })
  })

  it("uses the API total in cents, including string amounts and zero", () => {
    expect(currentTotal({ plan: "pro", unitAmount: "6900" })).toBe(69)
    expect(currentTotal({ plan: "pro", unitAmount: 0 })).toBe(0)
  })

  it("does not charge feature add-ons twice", () => {
    expect(
      currentTotal({
        plan: "growth",
        unitAmount: 20900,
        addOnFeatures: [FINE_GRAINED_ACCESS],
      })
    ).toBe(209)
  })

  it("breaks the 20k MAU Pro subscription into $49 plus $20", () => {
    expect(
      planPriceBreakdown({
        plan: "pro",
        billingCycle: "month",
        mau: 20000,
        addOnFeatures: [],
      })
    ).toEqual({
      basePrice: 49,
      extraMau: 10000,
      extraMauPrice: 20,
      addOnPrice: 0,
    })
    expect(
      currentTotal({ plan: "pro", billingCycle: "month", mau: 20000 })
    ).toBe(69)
  })

  it.each(["year", "yearly"])("uses yearly prices for %s", (billingCycle) => {
    const subscription = {
      plan: "enterprise",
      billingCycle,
      mau: 90000,
      addOnFeatures: [FINE_GRAINED_ACCESS],
    }
    expect(planPriceBreakdown(subscription)).toEqual({
      basePrice: 4490,
      extraMau: 10000,
      extraMauPrice: 240,
      addOnPrice: 720,
    })
    expect(currentTotal(subscription)).toBe(5450)
  })
})
