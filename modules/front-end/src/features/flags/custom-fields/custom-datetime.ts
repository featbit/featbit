import { isValid, parseISO } from "date-fns"

export function parseCustomDatetime(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.replace(" ", "T")
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(
      normalized
    )
  )
    return undefined
  const date = parseISO(normalized)
  return isValid(date) ? date : undefined
}
