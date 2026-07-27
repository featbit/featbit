import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import { FlagsCompareMatrix } from "./flags-compare-matrix"

describe("FlagsCompareMatrix environment links", () => {
  it("links the source and each existing target flag to isolated tab contexts", () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <FlagsCompareMatrix
            lang="en"
            source={{ projectId: "project-source", envId: "env-source" }}
            items={[
              {
                id: "flag-1",
                name: "Checkout rollout",
                key: "checkout/rollout",
                description: "",
                tags: [],
                diffs: [
                  {
                    targetEnvId: "env-target",
                    onOffState: false,
                    individualTargeting: false,
                    targetingRule: false,
                    defaultRule: false,
                    offVariation: false,
                  },
                ],
              },
            ]}
            targets={[
              {
                id: "env-target",
                projectId: "project-target",
                projectName: "Target project",
                environmentName: "Production",
                label: "Target project / Production",
              },
              {
                id: "env-missing",
                projectId: "project-missing",
                projectName: "Missing project",
                environmentName: "Development",
                label: "Missing project / Development",
              },
            ]}
            loading={false}
            hasFilters={false}
            permissionPending={false}
            canCopy={() => true}
            onReview={vi.fn()}
            onCopy={vi.fn()}
            onCopyKey={vi.fn()}
            onClearFilters={vi.fn()}
          />
        </TooltipProvider>
      </MemoryRouter>
    )

    const sourceLink = screen.getByRole("link", {
      name: "Checkout rollout (open details in a new tab)",
    })
    expect(sourceLink).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout%2Frollout/targeting?context=environment&projectId=project-source&envId=env-source"
    )
    expect(sourceLink).toHaveAttribute("target", "_blank")

    const targetLink = screen.getByRole("link", {
      name: "Open Checkout rollout in Target project / Production in a new tab",
    })
    expect(targetLink).toHaveAttribute(
      "href",
      "/en/feature-flags/checkout%2Frollout/targeting?context=environment&projectId=project-target&envId=env-target"
    )
    expect(targetLink).toHaveAttribute("target", "_blank")
    expect(targetLink).toHaveAttribute("rel", "noopener noreferrer")
    expect(targetLink).toHaveTextContent("Open flag in this environment")
    expect(targetLink).toHaveClass("text-primary", "hover:underline")
    expect(screen.getByText("Open flag in this environment")).toHaveClass(
      "leading-4"
    )
    expect(targetLink.querySelector("svg")).toHaveClass(
      "size-3.5",
      "-translate-y-px"
    )

    expect(
      screen.queryByRole("link", {
        name: "Open Checkout rollout in Missing project / Development in a new tab",
      })
    ).not.toBeInTheDocument()
  })
})
import "@/lib/i18n/i18n"
