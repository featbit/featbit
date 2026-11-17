import { describe, expect, it } from "vitest"
import {
  experimentRunSearchParams,
  experimentStageFromParam,
  experimentStageSearchParams,
} from "./experiment-stage-route"

describe("experiment stage URL state", () => {
  it.each([
    ["hypothesis", "hypothesis"],
    ["exposure", "implementing"],
    ["measuring", "measuring"],
    ["learning", "learning"],
  ] as const)("maps the %s URL value to %s", (param, stage) => {
    expect(experimentStageFromParam(param)).toBe(stage)
  })

  it("rejects missing and unknown stages", () => {
    expect(experimentStageFromParam(undefined)).toBeNull()
    expect(experimentStageFromParam("implementing")).toBeNull()
    expect(experimentStageFromParam("settings")).toBeNull()
  })

  it("serializes the implementing stage as exposure", () => {
    const next = experimentStageSearchParams(
      new URLSearchParams("stage=hypothesis"),
      "implementing"
    )

    expect(next.get("stage")).toBe("exposure")
  })

  it("updates the stage while preserving other query parameters", () => {
    const current = new URLSearchParams(
      "context=environment&projectId=project-1&stage=hypothesis"
    )

    const next = experimentStageSearchParams(current, "learning")

    expect(next.get("stage")).toBe("learning")
    expect(next.get("context")).toBe("environment")
    expect(next.get("projectId")).toBe("project-1")
    expect(current.get("stage")).toBe("hypothesis")
  })

  it("selects a run while preserving the measuring stage", () => {
    const current = new URLSearchParams("stage=measuring&context=environment")

    const next = experimentRunSearchParams(current, "run-4")

    expect(next.get("runId")).toBe("run-4")
    expect(next.get("stage")).toBe("measuring")
    expect(next.get("context")).toBe("environment")
    expect(current.has("runId")).toBe(false)
  })
})
