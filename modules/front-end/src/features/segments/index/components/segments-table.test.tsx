import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import type { Segment } from "../../segments-types"
import { SegmentsTable } from "./segments-table"

const segment: Segment = {
  id: "segment-1",
  name: "Shared segment",
  key: "shared-segment",
  type: "shared",
  scopes: [
    "organization/acme",
    "organization/acme:project/payments",
    "organization/acme:project/payments:env/production",
  ],
  tags: [],
  description: "",
  updatedAt: "2026-07-24T08:00:00.000Z",
  isArchived: false,
  included: [],
  excluded: [],
  rules: [],
}

describe("SegmentsTable", () => {
  it("formats the last change date like the feature flags table", () => {
    render(
      <MemoryRouter>
        <SegmentsTable
          items={[segment]}
          loading={false}
          archived={false}
          lang="en"
          query=""
          mutatingId={null}
          canArchive={() => true}
          canRestore={() => true}
          canRemove={() => true}
          onCopy={vi.fn()}
          onArchive={vi.fn()}
          onRestore={vi.fn()}
          onRemove={vi.fn()}
          onClearSearch={vi.fn()}
          onCreate={vi.fn()}
        />
      </MemoryRouter>
    )

    const expected = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(segment.updatedAt))

    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("shows every tag without collapsing tags into a count", () => {
    render(
      <MemoryRouter>
        <SegmentsTable
          items={[
            {
              ...segment,
              tags: ["backend", "release", "production"],
            },
          ]}
          loading={false}
          archived={false}
          lang="en"
          query=""
          mutatingId={null}
          canArchive={() => true}
          canRestore={() => true}
          canRemove={() => true}
          onCopy={vi.fn()}
          onArchive={vi.fn()}
          onRestore={vi.fn()}
          onRemove={vi.fn()}
          onClearSearch={vi.fn()}
          onCreate={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(screen.getByText("backend")).toBeInTheDocument()
    expect(screen.getByText("release")).toBeInTheDocument()
    expect(screen.getByText("production")).toBeInTheDocument()
    expect(screen.queryByText("+1")).not.toBeInTheDocument()
  })

  it("shows shared scopes with resource icons on hover", async () => {
    render(
      <MemoryRouter>
        <SegmentsTable
          items={[segment]}
          loading={false}
          archived={false}
          lang="en"
          query=""
          mutatingId={null}
          canArchive={() => true}
          canRestore={() => true}
          canRemove={() => true}
          onCopy={vi.fn()}
          onArchive={vi.fn()}
          onRestore={vi.fn()}
          onRemove={vi.fn()}
          onClearSearch={vi.fn()}
          onCreate={vi.fn()}
        />
      </MemoryRouter>
    )

    const trigger = screen.getByRole("button", { name: "Shareable" })
    fireEvent.pointerMove(document, { pointerType: "mouse" })
    fireEvent.mouseEnter(trigger)

    const organization = await screen.findByText("organization/acme")
    const project = screen.getByText("organization/acme:project/payments")
    const environment = screen.getByText(
      "organization/acme:project/payments:env/production"
    )

    expect(organization.previousElementSibling).toHaveClass("lucide-building-2")
    expect(project.previousElementSibling).toHaveClass("lucide-folder")
    expect(environment.previousElementSibling).toHaveClass("lucide-box")
  })
})
