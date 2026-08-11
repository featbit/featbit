import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ProjectInventory } from "./project-inventory"
import { SecretsSheet } from "./secrets-sheet"

const projects = [
  {
    id: "project-1",
    name: "Demo",
    key: "demo",
    environments: [
      {
        id: "env-1",
        projectId: "project-1",
        name: "Production",
        key: "production",
        description: "",
        settings: { requireChangeComment: false },
        secrets: [
          {
            id: "secret-1",
            name: "Server SDK",
            type: "server" as const,
            value: "secret-value",
          },
        ],
      },
    ],
  },
]

function renderInventory(canWrite: boolean) {
  render(
    <ProjectInventory
      projects={projects}
      currentProjectEnv={null}
      search=""
      loading={false}
      canCreateProject={canWrite}
      canUpdateProject={() => canWrite}
      canDeleteProject={() => canWrite}
      canCreateEnvironment={() => canWrite}
      canUpdateEnvironment={() => canWrite}
      canDeleteEnvironment={() => canWrite}
      canCreateSecret={() => canWrite}
      onSearchChange={vi.fn()}
      onCreateProject={vi.fn()}
      onEditProject={vi.fn()}
      onDeleteProject={vi.fn()}
      onCreateEnvironment={vi.fn()}
      onEditEnvironment={vi.fn()}
      onDeleteEnvironment={vi.fn()}
      onAddSecret={vi.fn()}
      onCopyText={vi.fn()}
      onCopySecret={vi.fn()}
      onViewSecrets={vi.fn()}
    />
  )
}

describe("ProjectInventory permissions", () => {
  it("hides write actions in read-only mode", () => {
    renderInventory(false)

    expect(
      screen.queryByRole("button", { name: "Create project" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add environment" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit project" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete project" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit environment" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete environment" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Add secret" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Copy project ID" })
    ).toBeVisible()
  })

  it("shows write actions when their permissions are granted", () => {
    renderInventory(true)

    expect(screen.getByRole("button", { name: "Create project" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Add environment" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Edit project" })).toBeVisible()
    expect(screen.getByRole("button", { name: "Delete project" })).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Edit environment" })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Delete environment" })
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "Add secret" })).toBeVisible()
  })
})

describe("SecretsSheet permissions", () => {
  it("keeps copy available but hides secret mutations without permission", () => {
    const project = projects[0]
    const environment = project.environments[0]

    render(
      <SecretsSheet
        open
        project={project}
        environment={environment}
        canCreateSecret={false}
        canUpdateSecret={false}
        canDeleteSecret={false}
        onOpenChange={vi.fn()}
        onAddSecret={vi.fn()}
        onCopySecret={vi.fn()}
        onEditSecret={vi.fn()}
        onDeleteSecret={vi.fn()}
      />
    )

    expect(
      screen.queryByRole("button", { name: "Add secret" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit secret name" })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Delete secret" })
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy secret" })).toBeVisible()
  })
})
