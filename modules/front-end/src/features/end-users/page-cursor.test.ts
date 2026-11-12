import { expect, it } from "vitest"
import { parsePageCursor } from "./page-cursor"

it("round-trips forward and backward cursors from query parameters", () => {
  for (const direction of ["forward", "backward"]) {
    const cursor = {
      id: "user-id",
      updatedAt: "2026-11-11T10:00:00Z",
      direction,
    }
    const params = new URLSearchParams({ cursor: JSON.stringify(cursor) })
    expect(
      parsePageCursor(new URLSearchParams(params.toString()).get("cursor"))
    ).toEqual(cursor)
  }
})

it.each([
  null,
  "{",
  "null",
  "[]",
  "{}",
  '{"id":"user","updatedAt":"invalid","direction":"forward"}',
  '{"id":"user","updatedAt":"2026-11-11","direction":"next"}',
])("ignores malformed cursor %s", (raw) => {
  expect(parsePageCursor(raw)).toBeUndefined()
})
