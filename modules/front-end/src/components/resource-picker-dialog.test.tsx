import { fireEvent, render, screen } from "@testing-library/react"
import { Folder } from "lucide-react"
import { describe, expect, it, vi } from "vitest"
import {
  ResourcePickerDialog,
  type ResourcePickerGroup,
  type ResourcePickerResource,
} from "./resource-picker-dialog"

const labels = {
  title: "Choose environments",
  description: "Select environments for this resource.",
  selected: "Selected",
  search: "Search environments",
  available: "Available environments",
  loadFailed: "Could not load environments.",
  retry: "Retry",
  empty: "No environments found.",
  cancel: "Cancel",
  apply: (count: number) => `Apply (${count})`,
  remove: (name: string) => `Remove ${name}`,
  current: "Current",
  includedBy: (name: string) => `Included by ${name}`,
}

const resources: ResourcePickerResource[] = [
  {
    id: "env-production",
    name: "Production",
    pathName: "Shop / Production",
    rn: "project/shop:env/production",
    type: "env",
  },
  {
    id: "env-staging",
    name: "Staging",
    pathName: "Shop / Staging",
    rn: "project/shop:env/staging",
    type: "env",
  },
  {
    id: "env-internal",
    name: "Internal",
    pathName: "Platform / Internal",
    rn: "project/platform:env/internal",
    type: "env",
  },
]

function groupByProject(
  filtered: ResourcePickerResource[]
): ResourcePickerGroup<ResourcePickerResource>[] {
  return ["Shop", "Platform"].map((project) => ({
    key: project,
    label: project,
    icon: <Folder className="size-3.5" />,
    items: filtered.filter((resource) => resource.pathName.startsWith(project)),
  }))
}

describe("ResourcePickerDialog", () => {
  it("renders Project groups with Environment rows and applies the draft", () => {
    const onApply = vi.fn()
    render(
      <ResourcePickerDialog
        open
        resources={resources}
        selected={[resources[0]]}
        loading={false}
        error={false}
        labels={labels}
        groupResources={groupByProject}
        getResourceDescription={(resource) => resource.rn}
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onApply={onApply}
      />
    )

    expect(screen.getByText("Shop")).toBeInTheDocument()
    expect(screen.getByText("Platform")).toBeInTheDocument()
    expect(screen.getByText("project/shop:env/production")).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole("checkbox")[1])
    fireEvent.click(screen.getByRole("button", { name: "Apply (2)" }))

    expect(onApply).toHaveBeenCalledWith([resources[0], resources[1]])
  })

  it("keeps a required environment selected when its parent is chosen", () => {
    const project: ResourcePickerResource = {
      id: "project-shop",
      name: "Shop",
      pathName: "Shop",
      rn: "project/shop",
      type: "project",
    }
    const environment = resources[0]
    const onApply = vi.fn()
    render(
      <ResourcePickerDialog
        open
        resources={[project, environment]}
        selected={[environment]}
        requiredKeys={[environment.rn]}
        loading={false}
        error={false}
        labels={labels}
        getKey={(resource) => resource.rn}
        groupResources={(filtered) => [
          {
            key: "project",
            label: "Projects",
            items: filtered.filter((resource) => resource.type === "project"),
          },
          {
            key: "environment",
            label: "Environments",
            items: filtered.filter((resource) => resource.type === "env"),
          },
        ]}
        isChildOf={(child, parent) =>
          child.rn !== parent.rn && `${child.rn}:`.startsWith(`${parent.rn}:`)
        }
        onOpenChange={vi.fn()}
        onRetry={vi.fn()}
        onApply={onApply}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "ShopShop" }))
    fireEvent.click(screen.getByRole("button", { name: "Apply (2)" }))

    expect(onApply).toHaveBeenCalledWith([project, environment])
  })
})
