import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import "@/lib/i18n/i18n"
import type { Layer } from "../layers-types"
import { LayersTable } from "./layers-table"

const layer: Layer = {
  id: "layer-id",
  featBitEnvId: "env-id",
  name: "layer12",
  key: "layer1",
  description: "My first layer1",
  assignmentUnitSelector: "user.keyId",
  status: "active",
  createdAt: "2026-08-28T00:00:00Z",
  updatedAt: "2026-08-28T00:00:00Z",
  experimentRuns: [
    {
      id: "archived-run",
      experimentId: "experiment-1",
      experimentName: "expt 1",
      key: "run-2",
      start: 0,
      end: 50,
      status: "archived",
      includedInAllocation: false,
    },
    {
      id: "collecting-run",
      experimentId: "experiment-1",
      experimentName: "expt 1",
      key: "run-1",
      start: 0,
      end: 60,
      status: "collecting",
      includedInAllocation: true,
    },
    {
      id: "draft-run",
      experimentId: "experiment-2",
      experimentName: "expt 2",
      key: "run-1",
      start: 80,
      end: 90,
      status: "draft",
      includedInAllocation: true,
    },
  ],
  allocationSummary: {
    activeRunCount: 2,
    reservedPercent: 70,
    freePercent: 30,
    overlaps: [],
    mixedAssignmentUnits: false,
    overAllocated: false,
    status: "no-conflicts",
  },
}

function renderTable(item: Layer) {
  const noop = vi.fn()
  render(
    <MemoryRouter>
      <TooltipProvider>
        <LayersTable
          items={[item]}
          loading={false}
          archived={false}
          query=""
          lang="en"
          mutatingId={null}
          onCopy={noop}
          onEdit={noop}
          onArchive={noop}
          onRestore={noop}
          onClearSearch={noop}
          onCreate={noop}
        />
      </TooltipProvider>
    </MemoryRouter>
  )
}

describe("LayersTable server allocation summary", () => {
  it("shows every run and provides complete allocation tooltips", async () => {
    renderTable(layer)

    expect(screen.getByText("70% reserved · 30% free")).toBeInTheDocument()
    expect(screen.getByText("No conflicts")).toBeInTheDocument()
    expect(screen.getByText("Archived")).toBeInTheDocument()
    expect(screen.getByText("Collecting")).toBeInTheDocument()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Edit" }).querySelector("svg")
    ).toBeNull()
    expect(
      screen.getByRole("button", { name: "Archive" }).querySelector("svg")
    ).toBeNull()
    expect(
      screen.queryByLabelText("expt 1, run-2, 0–50%")
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText("expt 1, run-1, 0–60%")).toBeInTheDocument()
    const compactRun = screen.getByLabelText("expt 2, run-1, 80–90%")
    expect(compactRun).toHaveTextContent("expt 2")
    expect(compactRun).not.toHaveAttribute("title")
    expect(compactRun.firstElementChild).toHaveClass(
      "flex",
      "h-full",
      "items-center"
    )

    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(compactRun)
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="tooltip-content"]')
      ).toBeInTheDocument()
    )
    const tooltip = document.querySelector<HTMLElement>(
      '[data-slot="tooltip-content"]'
    )
    expect(tooltip).not.toBeNull()
    if (!tooltip) throw new Error("Expected the run tooltip to be rendered")
    expect(within(tooltip).getByText("expt 2")).toBeVisible()
    expect(within(tooltip).getByText("run-1")).toBeVisible()
    expect(within(tooltip).getByText("80–90%")).toBeVisible()
  })

  it("does not turn a missing server summary into an empty allocation", () => {
    renderTable({
      ...layer,
      experimentRuns: undefined,
      allocationSummary: undefined,
    })

    expect(screen.getAllByText("Allocation unavailable")).toHaveLength(2)
    expect(screen.queryByText("No allocation")).not.toBeInTheDocument()
    expect(screen.queryByText("No conflicts")).not.toBeInTheDocument()
  })

  it("uses aligned ghost actions and restores archived layers", () => {
    renderTable({ ...layer, status: "archived" })

    const edit = screen.getByRole("button", { name: "Edit" })
    const restore = screen.getByRole("button", { name: "Restore" })
    expect(edit).toHaveClass("inline-flex", "items-center", "leading-none")
    expect(restore).toHaveClass("inline-flex", "items-center", "leading-none")
    expect(edit.querySelector("svg")).toBeNull()
    expect(restore.querySelector("svg")).toBeNull()
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull()
  })
})
