import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { EditAssignmentSheet } from "./edit-assignment-sheet"
import type { MeasuringRun } from "./measuring-types"

const variations = [
  { id: "a", name: "Original", value: "a" },
  { id: "b", name: "Candidate", value: "b" },
  { id: "c", name: "Alternative", value: "c" },
]
const run: MeasuringRun = {
  id: "run-1",
  slug: "run-1",
  method: "bayesian_ab",
  controlVariant: "a",
  treatmentVariants: ["b"],
  variations,
  analysisResult: "previous analysis",
  decision: null,
  decisionSummary: null,
  decisionReason: null,
  whatChanged: null,
  whatHappened: null,
  confirmedOrRefuted: null,
  whyItHappened: null,
  nextHypothesis: null,
  createdAt: "2026-09-21T00:00:00Z",
}

function show(
  decision: string | null = null,
  analysisResult: string | null = run.analysisResult ?? null
) {
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <EditAssignmentSheet
      open
      run={{ ...run, decision, analysisResult }}
      variations={variations}
      layers={[]}
      saving={false}
      saveError={false}
      onOpenChange={vi.fn()}
      onSave={onSave}
    />
  )
  return onSave
}

describe("run selection protection", () => {
  it("locks decided selections and explains how to make another comparison", () => {
    show("ADOPT")
    expect(
      screen.getByText(/This run already has a decision/)
    ).toBeInTheDocument()
    for (const control of screen.getAllByRole("radio"))
      expect(control).toHaveAttribute("aria-disabled", "true")
    for (const treatment of screen.getAllByRole("checkbox"))
      expect(treatment).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(screen.getByRole("radio", { name: "Candidate" }))
    expect(screen.getByRole("radio", { name: "Original" })).toHaveAttribute(
      "aria-checked",
      "true"
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "Alternative" }))
    expect(
      screen.getByRole("checkbox", { name: "Alternative" })
    ).toHaveAttribute("aria-checked", "false")
    expect(
      screen.queryByRole("button", { name: "Save and clear analysis" })
    ).not.toBeInTheDocument()
  })

  it("requires confirmation before clearing analysis and preserves edits on cancellation", async () => {
    const onSave = show()
    fireEvent.click(screen.getByRole("checkbox", { name: "Alternative" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(
      screen.getByText("Change groups and clear analysis?")
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Collected exposure and metric data will not be deleted/)
    ).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Back to editing" }))
    await waitFor(() =>
      expect(
        screen.queryByText("Change groups and clear analysis?")
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("checkbox", { name: "Alternative" })
    ).toHaveAttribute("aria-checked", "true")
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Save and clear analysis" })
    )
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        controlVariant: "a",
        treatmentVariants: ["b", "c"],
      })
    )
  })

  it.each([false, true])(
    "saves without confirmation when selection is unchanged (reverted: %s)",
    (reverted) => {
      const onSave = show()
      if (reverted) {
        fireEvent.click(screen.getByRole("checkbox", { name: "Alternative" }))
        fireEvent.click(screen.getByRole("checkbox", { name: "Alternative" }))
      }
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
      expect(onSave).toHaveBeenCalledTimes(1)
      expect(
        screen.queryByText("Change groups and clear analysis?")
      ).not.toBeInTheDocument()
    }
  )

  it("saves changed groups directly when no analysis exists", () => {
    const onSave = show(null, null)
    fireEvent.click(screen.getByRole("checkbox", { name: "Alternative" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText("Change groups and clear analysis?")
    ).not.toBeInTheDocument()
  })
})
