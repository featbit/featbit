import type { PageCursor } from "./end-users-types"

export function parsePageCursor(raw: string | null): PageCursor | undefined {
  if (!raw) return undefined
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return undefined
    const cursor = value as Record<string, unknown>
    if (
      typeof cursor.id !== "string" ||
      !cursor.id ||
      typeof cursor.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(cursor.updatedAt)) ||
      (cursor.direction !== "forward" && cursor.direction !== "backward")
    )
      return undefined
    return {
      id: cursor.id,
      updatedAt: cursor.updatedAt,
      direction: cursor.direction,
    }
  } catch {
    return undefined
  }
}
