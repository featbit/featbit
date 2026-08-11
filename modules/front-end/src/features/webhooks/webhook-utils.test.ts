import { describe, expect, it } from "vitest"
import type { Project } from "@/features/layout/layout-types"
import { DEFAULT_PAYLOAD_TEMPLATE } from "./webhook-events"
import {
  formatDateTime,
  headersToText,
  renderTestPayload,
  scopeEnvironmentIds,
  serializeScopes,
  validateJsonHandlebars,
} from "./webhook-utils"

const projects: Project[] = [
  {
    id: "project-a",
    name: "Project A",
    key: "project-a",
    environments: [
      { id: "env-a1", name: "Development" },
      { id: "env-a2", name: "Production" },
    ],
  },
  {
    id: "project-b",
    name: "Project B",
    key: "project-b",
    environments: [{ id: "env-b1", name: "Production" }],
  },
]

describe("webhook utilities", () => {
  it("formats delivery timestamps with the selected interface language", () => {
    const timestamp = "2026-07-22T09:10:35.000Z"

    expect(formatDateTime(timestamp, "en")).toMatch(/[A-Za-z]/)
    expect(formatDateTime(timestamp, "zh")).toMatch(/\d{4}年/)
  })

  it("round-trips selected environments through project-scoped API values", () => {
    const scopes = serializeScopes(["env-b1", "env-a2", "env-a1"], projects)

    expect(scopes).toEqual(["project-a/env-a1,env-a2", "project-b/env-b1"])
    expect(scopeEnvironmentIds(scopes)).toEqual(["env-a1", "env-a2", "env-b1"])
  })

  it("renders a valid JSON Handlebars payload for live debug", () => {
    const payload = renderTestPayload(
      "feature_flag.toggled",
      DEFAULT_PAYLOAD_TEMPLATE
    )

    expect(JSON.parse(payload)).toMatchObject({
      event: "feature_flag.toggled",
      project: { id: expect.any(String), name: expect.any(String) },
      changes: ["test change description 1", "test change description 2"],
      data: {
        kind: "feature flag",
        object: {
          tags: ["test", "demo"],
          variations: expect.any(Array),
        },
      },
    })
    expect(validateJsonHandlebars(DEFAULT_PAYLOAD_TEMPLATE)).toBeNull()
  })

  it("reports templates that do not produce JSON", () => {
    expect(validateJsonHandlebars("not-json")).toBeTruthy()
  })

  it("normalizes delivery headers for the diagnostics panel", () => {
    expect(headersToText({ Authorization: "Bearer token" })).toBe(
      "Authorization: Bearer token"
    )
    expect(headersToText([{ key: "X-Test", value: "1" }])).toBe("X-Test: 1")
  })
})
