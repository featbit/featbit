import { afterEach, describe, expect, it, vi } from "vitest"
import type { DecodedLicense, LicenseFeature } from "./license-types"
import {
  daysUntilExpiration,
  displayPlan,
  formatDate,
  getLicenseStatus,
  isFeatureGranted,
  parseLicense,
  toDate,
} from "./license-utils"

function encodeLicense(payload: DecodedLicense) {
  const encodedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  return `header.${encodedPayload}.signature`
}

const ssoFeature: LicenseFeature = {
  id: "sso",
  labelKey: "",
  descriptionKey: "",
}

describe("license utils", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("parses base64url license payloads", () => {
    const license = encodeLicense({
      plan: "growth",
      features: ["sso"],
      exp: 4102444800,
    })

    expect(parseLicense(license)).toMatchObject({
      plan: "growth",
      features: ["sso"],
      exp: 4102444800,
    })
  })

  it("returns null for missing or invalid licenses", () => {
    expect(parseLicense(undefined)).toBeNull()
    expect(parseLicense("not-a-license")).toBeNull()
    expect(parseLicense("header.invalid.signature")).toBeNull()
  })

  it("normalizes unix seconds and millisecond timestamps", () => {
    expect(toDate(1_704_067_200)?.toISOString()).toBe(
      "2024-01-01T00:00:00.000Z"
    )
    expect(toDate(1_704_067_200_000)?.toISOString()).toBe(
      "2024-01-01T00:00:00.000Z"
    )
    expect(toDate(undefined)).toBeNull()
  })

  it("formats dates for the active language", () => {
    expect(formatDate(1_704_067_200, "en")).toBe("Jan 01, 2024")
    expect(formatDate(undefined, "en")).toBe("-")
  })

  it("calculates days until expiration", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-06T00:00:00.000Z"))

    expect(daysUntilExpiration({ exp: 1_785_888_000 })).toBe(30)
    expect(daysUntilExpiration(null)).toBe(-1)
  })

  it("classifies missing, expired, expiring, and active licenses", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-06T00:00:00.000Z"))

    expect(getLicenseStatus(null)).toBe("missing")
    expect(getLicenseStatus({ exp: 1_783_209_600 })).toBe("expired")
    expect(getLicenseStatus({ exp: 1_785_888_000 })).toBe("expiring")
    expect(getLicenseStatus({ exp: 1_785_974_400 })).toBe("active")
  })

  it("checks feature grants and wildcard licenses", () => {
    expect(isFeatureGranted(ssoFeature, { features: ["sso"] }, "active")).toBe(
      true
    )
    expect(isFeatureGranted(ssoFeature, { features: ["*"] }, "active")).toBe(
      true
    )
    expect(
      isFeatureGranted(ssoFeature, { features: ["schedule"] }, "active")
    ).toBe(false)
    expect(isFeatureGranted(ssoFeature, { features: ["sso"] }, "expired")).toBe(
      false
    )
    expect(isFeatureGranted(ssoFeature, null, "missing")).toBe(false)
  })

  it("displays plan names", () => {
    expect(displayPlan("growth")).toBe("Growth")
    expect(displayPlan(undefined)).toBe("-")
  })
})
