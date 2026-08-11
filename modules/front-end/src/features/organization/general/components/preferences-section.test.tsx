import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { PreferencesSection } from "./preferences-section"

describe("PreferencesSection", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("shows selected policy and group names in the read-only state", () => {
    render(
      <PreferencesSection
        sortBy="created_at"
        policyId="policy-1"
        groupId="group-1"
        policies={[
          {
            id: "policy-1",
            name: "Developer",
            key: "developer",
            type: "SysManaged",
          },
        ]}
        groups={[{ id: "group-1", name: "Release managers" }]}
        policiesLoading={false}
        groupsLoading={false}
        isSavingSorting={false}
        isSavingPermissions={false}
        canUpdateSorting={false}
        canUpdateDefaultPermissions={false}
        onSortByChange={vi.fn()}
        onPolicyChange={vi.fn()}
        onGroupChange={vi.fn()}
        onSaveSorting={vi.fn()}
        onSavePermissions={vi.fn()}
      />
    )

    const policySelect = screen.getByRole("combobox", {
      name: "Default policy",
    })
    const groupSelect = screen.getByRole("combobox", {
      name: "Default group",
    })

    expect(policySelect).toBeDisabled()
    expect(policySelect).toHaveTextContent("Developer")
    expect(policySelect).not.toHaveTextContent("policy-1")
    expect(groupSelect).toBeDisabled()
    expect(groupSelect).toHaveTextContent("Release managers")
    expect(groupSelect).not.toHaveTextContent("group-1")
  })
})
