import type { ObservationWindowUpdate } from "./measuring-types"

export type ObservationEndMode = "open" | "duration" | "date"
export type ObservationDurationUnit = "hours" | "days" | "weeks"
export type ObservationWindowError =
  | "startRequired"
  | "durationInvalid"
  | "endRequired"
  | "endAfterStart"
  | "endCannotShorten"

export type ObservationWindowDraft = {
  start: string
  endMode: ObservationEndMode
  end: string
  duration: string
  durationUnit: ObservationDurationUnit
}

const durationUnitMilliseconds: Record<ObservationDurationUnit, number> = {
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000,
}

export function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return ""
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (part: number) => String(part).padStart(2, "0")

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function createObservationWindowDraft(
  start?: string | null,
  end?: string | null,
  defaultStartToNow = true
): ObservationWindowDraft {
  return {
    start: toDateTimeLocalValue(
      start ?? (defaultStartToNow ? new Date() : null)
    ),
    endMode: end ? "date" : "open",
    end: toDateTimeLocalValue(end),
    duration: "7",
    durationUnit: "days",
  }
}

export function resolveObservationWindow(
  draft: ObservationWindowDraft,
  minimumEnd?: string | null
):
  | { value: ObservationWindowUpdate; error?: never }
  | { value?: never; error: ObservationWindowError } {
  const start = new Date(draft.start)
  if (!draft.start || Number.isNaN(start.getTime())) {
    return { error: "startRequired" }
  }

  let end: Date | null = null
  if (draft.endMode === "duration") {
    const duration = Number(draft.duration)
    if (!Number.isFinite(duration) || duration <= 0) {
      return { error: "durationInvalid" }
    }
    end = new Date(
      start.getTime() + duration * durationUnitMilliseconds[draft.durationUnit]
    )
  }

  if (draft.endMode === "date") {
    end = new Date(draft.end)
    if (!draft.end || Number.isNaN(end.getTime())) {
      return { error: "endRequired" }
    }
  }

  if (end && end.getTime() <= start.getTime()) {
    return { error: "endAfterStart" }
  }

  if (end && minimumEnd) {
    const currentEnd = new Date(minimumEnd)
    if (
      !Number.isNaN(currentEnd.getTime()) &&
      end.getTime() < currentEnd.getTime()
    ) {
      return { error: "endCannotShorten" }
    }
  }

  return {
    value: {
      observationStart: start.toISOString(),
      observationEnd: end?.toISOString() ?? null,
    },
  }
}
