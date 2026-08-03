import { describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import {
  auditDecisionSnapshot,
  auditEventTitle,
  auditHistoryChanges,
  auditObjectIdentity,
  dayAfter,
  hasAppliedFilters,
  startOfDay,
} from "./audit-log-utils"
import type { AuditLog } from "./audit-logs-types"

function log(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "audit-1",
    refId: "resource-1",
    refType: "FeatureFlag",
    operation: "Update",
    creatorId: "user-1",
    creatorName: "Alex",
    creatorEmail: "alex@example.com",
    createdAt: "2026-07-24T08:15:00.000Z",
    comment: "",
    dataChange: {},
    instructions: [],
    ...overrides,
  }
}

describe("audit log presentation", () => {
  it("uses the current snapshot for active object identity", () => {
    const identity = auditObjectIdentity(
      log({
        dataChange: {
          current: JSON.stringify({
            id: "flag-1",
            name: "Checkout redesign",
            key: "checkout-redesign",
          }),
        },
      }),
      "Unavailable"
    )

    expect(identity).toEqual({
      id: "flag-1",
      name: "Checkout redesign",
      key: "checkout-redesign",
      removed: false,
      available: true,
    })
  })

  it("keeps removed object identity from the previous snapshot", () => {
    const identity = auditObjectIdentity(
      log({
        operation: "Remove",
        dataChange: {
          previous: JSON.stringify({
            id: "segment-1",
            name: "Enterprise customers",
            key: "enterprise-customers",
          }),
        },
      }),
      "Unavailable"
    )

    expect(identity.name).toBe("Enterprise customers")
    expect(identity.key).toBe("enterprise-customers")
    expect(identity.removed).toBe(true)
    expect(identity.available).toBe(false)
  })

  it("classifies feature flag event groups", () => {
    expect(
      auditEventTitle(
        log({ instructions: [{ kind: "AddVariation", value: {} }] }),
        i18n.t
      )
    ).toBe("Updated variations")
    expect(
      auditEventTitle(
        log({ instructions: [{ kind: "AddRule", value: {} }] }),
        i18n.t
      )
    ).toBe("Updated targeting")
  })

  it("labels every change request decision as its own audit event", () => {
    expect(
      auditEventTitle(log({ operation: "ApproveFlagChangeRequest" }), i18n.t)
    ).toBe("Approved change request")
    expect(
      auditEventTitle(log({ operation: "DeclineFlagChangeRequest" }), i18n.t)
    ).toBe("Declined change request")
  })

  it("reads the immutable change request context from a decision snapshot", () => {
    const proposedDataChange = {
      previous: JSON.stringify({ id: "flag-1", rules: [] }),
      current: JSON.stringify({ id: "flag-1", rules: [{ id: "rule-1" }] }),
    }
    const snapshot = JSON.stringify({
      id: "flag-1",
      name: "Checkout",
      key: "checkout-v2",
      changeRequestId: "request-1",
      requestComment: "Ready for review",
      proposedDataChange,
    })

    expect(
      auditDecisionSnapshot(
        log({
          operation: "ApproveFlagChangeRequest",
          dataChange: { previous: snapshot, current: snapshot },
        })
      )
    ).toEqual({
      changeRequestId: "request-1",
      requestComment: "Ready for review",
      proposedDataChange,
    })
  })

  it("reuses segment semantic changes when complete snapshots are available", () => {
    const base = {
      id: "segment-1",
      envId: "env-1",
      name: "Enterprise customers",
      key: "enterprise-customers",
      type: "environment-specific",
      scopes: [],
      tags: [],
      description: "",
      updatedAt: "2026-07-24T08:00:00.000Z",
      isArchived: false,
      included: [],
      excluded: [],
      rules: [],
    }
    const changes = auditHistoryChanges(
      log({
        refType: "Segment",
        dataChange: {
          previous: JSON.stringify(base),
          current: JSON.stringify({ ...base, name: "Enterprise accounts" }),
        },
      }),
      i18n.t
    )

    expect(changes).toEqual([
      expect.objectContaining({
        kind: "field",
        label: "name",
        previous: "Enterprise customers",
        current: "Enterprise accounts",
      }),
    ])
  })

  it("builds semantic changes for a created feature flag snapshot", () => {
    const changes = auditHistoryChanges(
      log({
        operation: "Create",
        dataChange: {
          current: JSON.stringify({
            id: "flag-1",
            name: "Checkout redesign",
            key: "checkout-redesign",
            isEnabled: false,
            variationType: "boolean",
            tags: ["checkout"],
            variations: [
              { id: "on", name: "Enabled", value: "true" },
              { id: "off", name: "Disabled", value: "false" },
            ],
            disabledVariationId: "off",
            targetUsers: [],
            rules: [],
            fallthrough: {
              variations: [{ id: "on", rollout: [0, 1] }],
              dispatchKey: "keyId",
            },
          }),
        },
      }),
      i18n.t
    )

    expect(changes.length).toBeGreaterThan(0)
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Name",
          current: "Checkout redesign",
        }),
        expect.objectContaining({ label: "Variations" }),
        expect.objectContaining({ label: "Flag ON" }),
        expect.objectContaining({ label: "Flag OFF" }),
      ])
    )
  })

  it("uses inclusive local-day bounds and detects every filter type", () => {
    const date = new Date(2026, 6, 24, 18, 30)
    expect(startOfDay(date)).toBe(new Date(2026, 6, 24).getTime())
    expect(dayAfter(date)).toBe(new Date(2026, 6, 25).getTime())
    expect(
      hasAppliedFilters({ query: " ", from: undefined, to: undefined })
    ).toBe(false)
    expect(hasAppliedFilters({ query: "", refType: "Segment" })).toBe(true)
  })
})
