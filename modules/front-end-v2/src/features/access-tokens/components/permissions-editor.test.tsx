import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { useRef, useState } from "react"
import { describe, expect, it } from "vitest"
import "@/lib/i18n/i18n"
import {
  PERMISSION_CATEGORIES,
  createEmptyPermissionDraft,
} from "../access-token-permissions"
import type { PermissionDraft, UserPolicy } from "../access-token-types"
import { PermissionsEditor } from "./permissions-editor"

const ownerPolicies: UserPolicy[] = [
  {
    name: "Owner",
    type: "SysManaged",
    statements: [
      {
        id: crypto.randomUUID(),
        resourceType: "*",
        effect: "allow",
        actions: ["*"],
        resources: ["*"],
      },
    ],
  },
]

function PermissionsEditorHarness({
  initialDraft,
  fineGrainedGranted,
}: {
  initialDraft: PermissionDraft
  fineGrainedGranted: boolean
}) {
  const portalContainer = useRef<HTMLDivElement | null>(null)
  const [draft, setDraft] = useState(initialDraft)

  return (
    <div ref={portalContainer}>
      <PermissionsEditor
        portalContainer={portalContainer}
        draft={draft}
        policies={ownerPolicies}
        fineGrainedGranted={fineGrainedGranted}
        readOnly={false}
        validationAttempted={false}
        onChange={setDraft}
      />
      <output data-testid="permission-draft">{JSON.stringify(draft)}</output>
    </div>
  )
}

function categorySection(name: string) {
  const section = screen.getByRole("heading", { name }).closest("section")
  if (!section) throw new Error(`Permission category ${name} was not found`)
  return section
}

function renderedDraft() {
  return JSON.parse(
    screen.getByTestId("permission-draft").textContent ?? "{}"
  ) as PermissionDraft
}

describe("PermissionsEditor fine-grained license states", () => {
  it.each(["Feature flag", "Segment"])(
    "only offers Select all for a new unlicensed %s category",
    (categoryName) => {
      render(
        <PermissionsEditorHarness
          initialDraft={createEmptyPermissionDraft()}
          fineGrainedGranted={false}
        />
      )

      const category = categorySection(categoryName)
      const checkboxes = within(category).getAllByRole("checkbox")
      expect(checkboxes).toHaveLength(2)
      expect(within(category).getByText("*")).toBeVisible()
      expect(within(category).queryByText("CreateFlag")).not.toBeInTheDocument()
      expect(
        within(category).queryByText("CreateSegment")
      ).not.toBeInTheDocument()

      const selectAll = within(category).getByRole("checkbox", {
        name: "Select all",
      })
      const wildcardAction = checkboxes.find((item) => item !== selectAll)!
      fireEvent.click(wildcardAction)

      const resourceType = categoryName === "Feature flag" ? "flag" : "segment"
      expect(renderedDraft()[resourceType].selectedActions).toEqual(["*"])
      expect(within(category).getByText("1 selected")).toBeVisible()
    }
  )

  it("shows only concrete actions and selects all of them with a fine-grained license", () => {
    render(
      <PermissionsEditorHarness
        initialDraft={createEmptyPermissionDraft()}
        fineGrainedGranted
      />
    )

    const category = categorySection("Feature flag")
    const concreteActions = PERMISSION_CATEGORIES.find(
      (item) => item.type === "flag"
    )!.actions.filter((item) => item.name !== "*")

    expect(
      within(category).getByRole("checkbox", { name: /CreateFlag/ })
    ).toBeEnabled()

    fireEvent.click(
      within(category).getByRole("checkbox", { name: "Select all" })
    )

    expect(renderedDraft().flag.selectedActions).toEqual(
      concreteActions.map((item) => item.name)
    )
    expect(
      within(category).getByText(`${concreteActions.length} selected`)
    ).toBeVisible()
    concreteActions.forEach((action) => {
      expect(
        within(category).getByRole("checkbox", {
          name: new RegExp(action.name),
        })
      ).toBeChecked()
    })
  })

  it("keeps saved specific actions read-only until Select all deliberately replaces them", () => {
    const draft = createEmptyPermissionDraft()
    draft.flag.selectedActions = ["CreateFlag", "ToggleFlag"]

    render(
      <PermissionsEditorHarness
        initialDraft={draft}
        fineGrainedGranted={false}
      />
    )

    expect(screen.getByText("Specific actions preserved")).toBeVisible()
    const category = categorySection("Feature flag")
    const createFlag = within(category).getByRole("checkbox", {
      name: /CreateFlag/,
    })
    expect(createFlag).toBeChecked()
    expect(createFlag).toHaveAttribute("aria-disabled", "true")

    fireEvent.click(
      within(category).getByRole("checkbox", { name: "Select all" })
    )

    expect(renderedDraft().flag.selectedActions).toEqual(["*"])
    expect(
      within(category).queryByRole("checkbox", { name: /CreateFlag/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Specific actions preserved")
    ).not.toBeInTheDocument()
  })

  it("normalizes an all-resource RN edit back to the All scope", async () => {
    const draft = createEmptyPermissionDraft()
    draft.project = {
      selectedActions: ["CreateProject"],
      scope: "specific",
      specificResources: ["project/shop"],
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PermissionsEditorHarness
          initialDraft={draft}
          fineGrainedGranted={false}
        />
      </QueryClientProvider>
    )

    const category = categorySection("Project")
    fireEvent.click(within(category).getByRole("button", { name: "Edit shop" }))
    const project = screen.getByLabelText("Project")
    await waitFor(() => expect(project).toHaveValue("shop"))

    fireEvent.click(screen.getByRole("checkbox", { name: "Any project" }))
    const apply = screen.getByRole("button", { name: "Apply" })
    await waitFor(() => expect(apply).toBeEnabled())
    fireEvent.click(apply)

    await waitFor(() =>
      expect(renderedDraft().project).toMatchObject({
        scope: "all",
        specificResources: [],
      })
    )
  })
})
