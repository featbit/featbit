import { describe, expect, it } from "vitest"
import {
  createObservationWindowDraft,
  resolveObservationWindow,
  type ObservationWindowDraft,
} from "./observation-window-utils"

const baseDraft: ObservationWindowDraft = {
  start: "2026-09-03T10:00",
  endMode: "open",
  end: "",
  duration: "7",
  durationUnit: "days",
}

describe("observation window utils", () => {
  it("keeps an open-ended window without an end time", () => {
    const result = resolveObservationWindow(baseDraft)

    expect(result.error).toBeUndefined()
    expect(result.value?.observationStart).toBe(
      new Date(baseDraft.start).toISOString()
    )
    expect(result.value?.observationEnd).toBeNull()
  })

  it("calculates the end from a positive duration", () => {
    const result = resolveObservationWindow({
      ...baseDraft,
      endMode: "duration",
      duration: "2",
      durationUnit: "hours",
    })

    expect(result.value?.observationEnd).toBe(
      new Date(
        new Date(baseDraft.start).getTime() + 2 * 60 * 60 * 1000
      ).toISOString()
    )
  })

  it("requires an end later than the start", () => {
    expect(
      resolveObservationWindow({
        ...baseDraft,
        endMode: "date",
        end: "2026-09-03T09:00",
      }).error
    ).toBe("endAfterStart")
  })

  it("does not allow a collecting window to be shortened", () => {
    expect(
      resolveObservationWindow(
        {
          ...baseDraft,
          endMode: "date",
          end: "2026-09-05T10:00",
        },
        new Date("2026-09-06T10:00").toISOString()
      ).error
    ).toBe("endCannotShorten")
  })

  it("can preserve a missing start for a locked legacy run", () => {
    expect(createObservationWindowDraft(null, null, false).start).toBe("")
  })
})
