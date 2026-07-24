import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { AuditLog } from "../../segments-types"
import { RawDataDialog } from "./raw-data-dialog"

const mergeViewMock = vi.hoisted(() => vi.fn())

vi.mock("@codemirror/merge", () => ({
  MergeView: class {
    a = { requestMeasure: vi.fn() }
    b = { requestMeasure: vi.fn() }

    constructor(config: unknown) {
      mergeViewMock(config)
    }

    destroy() {}
  },
}))

const auditLog: AuditLog = {
  id: "audit-1",
  refId: "segment-1",
  refType: "Segment",
  operation: "Update",
  creatorId: "user-1",
  creatorName: "Alex Chen",
  creatorEmail: "alex@example.com",
  createdAt: "2026-07-23T08:42:00.000Z",
  comment: "",
  dataChange: {
    previous: '{"name":"Before","included":["user-1"]}',
    current: '{"name":"After","included":["user-1","user-2"]}',
  },
  instructions: [],
}

describe("RawDataDialog", () => {
  it("passes formatted previous and current snapshots to the merge view", async () => {
    render(<RawDataDialog auditLog={auditLog} onOpenChange={vi.fn()} />)

    await waitFor(() => expect(mergeViewMock).toHaveBeenCalledOnce())
    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[78vh]",
      "grid-rows-[auto_auto_auto]"
    )
    expect(screen.getByRole("dialog")).not.toHaveClass("h-[78vh]")
    expect(
      screen
        .getByText("segments.detailsPage.history.previous")
        .querySelector(".lucide-circle-minus")
    ).toBeInTheDocument()
    expect(
      screen
        .getByText("segments.detailsPage.history.current")
        .querySelector(".lucide-circle-plus")
    ).toBeInTheDocument()

    const config = mergeViewMock.mock.calls[0][0] as {
      a: { doc: string }
      b: { doc: string }
    }
    expect(config.a.doc).toBe(
      JSON.stringify(JSON.parse(auditLog.dataChange.previous!), null, 2)
    )
    expect(config.b.doc).toBe(
      JSON.stringify(JSON.parse(auditLog.dataChange.current!), null, 2)
    )
  })
})
