import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import "@/lib/i18n/i18n"
import {
  emptyCustomFieldsProject,
  readCustomFieldsProject,
  writeCustomFieldsProject,
} from "@/features/flags/custom-fields/custom-fields-storage"
import { ProjectCustomFieldsSheet } from "./project-custom-fields-sheet"

const project = {
  id: "project-b",
  key: "project-b",
  name: "Project B",
  environments: [],
}

beforeEach(() => {
  localStorage.clear()
  for (const id of ["project-a", "project-b"]) {
    writeCustomFieldsProject(id, {
      ...emptyCustomFieldsProject(),
      configured: true,
      fields: [
        {
          id: "notes",
          key: "notes",
          name: `${id} notes`,
          required: false,
          controls: [
            { id: "text", key: "text", label: "Notes", type: "markdown" },
          ],
        },
      ],
    })
  }
})

describe("Project custom field configuration", () => {
  it("loads and updates only the selected project's definitions", () => {
    const beforeA = readCustomFieldsProject("project-a")
    render(
      <ProjectCustomFieldsSheet
        project={project}
        canConfigure
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText("project-b notes")).toBeVisible()
    expect(screen.queryByText("project-a notes")).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("button", { name: "Edit project-b notes field" })
    )
    const dialog = within(
      screen.getByRole("dialog", { name: "Edit custom field" })
    )
    fireEvent.change(dialog.getByLabelText("Field name"), {
      target: { value: "Renamed project field" },
    })
    fireEvent.click(dialog.getByRole("button", { name: "Save field" }))
    expect(screen.getByText("Renamed project field")).toBeVisible()
    expect(readCustomFieldsProject("project-a")).toEqual(beforeA)
    expect(readCustomFieldsProject("project-b").fields[0]).toMatchObject({
      id: "notes",
      name: "Renamed project field",
      controls: [{ id: "text" }],
    })
    expect(
      readCustomFieldsProject("project-b").configurationHistory
    ).toHaveLength(1)
  })

  it("allows viewing definitions without offering configuration changes", () => {
    render(
      <ProjectCustomFieldsSheet
        project={project}
        canConfigure={false}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText("project-b notes")).toBeVisible()
    expect(screen.getByRole("button", { name: "Custom Field" })).toBeDisabled()
    expect(
      screen.queryByRole("button", { name: "Edit project-b notes field" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        /Only users with permission to edit this project \(UpdateProjectSettings\)/
      )
    ).toBeVisible()
  })
})
