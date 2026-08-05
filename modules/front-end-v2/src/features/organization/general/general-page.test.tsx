import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchOrganizations,
  getCurrentOrganization,
} from "@/features/layout/layout-context"
import { fetchOrganizationDefaultPermissionOptions } from "@/features/organization/organization-api"
import { fetchCurrentUserPolicies } from "@/features/iam/current-user-permissions"
import { OrganizationGeneralPage } from "./general-page"

vi.mock("@/features/layout/layout-context", () => ({
  clearCurrentProjectEnv: vi.fn(),
  fetchOrganizations: vi.fn(),
  getCurrentOrganization: vi.fn(),
  persistCurrentOrganization: vi.fn(),
  resolveLang: () => "en",
}))

vi.mock("@/features/iam/current-user-permissions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/iam/current-user-permissions")
  >()),
  fetchCurrentUserPolicies: vi.fn(),
}))

vi.mock("@/features/organization/organization-api", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/features/organization/organization-api")
    >()

  return {
    ...actual,
    fetchOrganizationDefaultPermissionOptions: vi.fn(),
  }
})

vi.mock("@/features/organization/components/organization-layout", () => ({
  OrganizationLayout: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/organization/general/components/identity-section", () => ({
  IdentitySection: () => null,
}))

vi.mock(
  "@/features/organization/general/components/preferences-section",
  () => ({
    PreferencesSection: ({
      policiesLoading,
      groupsLoading,
      canUpdateDefaultPermissions,
    }: {
      policiesLoading: boolean
      groupsLoading: boolean
      canUpdateDefaultPermissions: boolean
    }) => (
      <>
        <output data-testid="policies-loading">
          {String(policiesLoading)}
        </output>
        <output data-testid="groups-loading">{String(groupsLoading)}</output>
        <output data-testid="can-update-default-permissions">
          {String(canUpdateDefaultPermissions)}
        </output>
      </>
    ),
  })
)

vi.mock(
  "@/features/organization/general/components/switch-organization-section",
  () => ({ SwitchOrganizationSection: () => null })
)

vi.mock(
  "@/features/organization/general/components/create-organization-sheet",
  () => ({ CreateOrganizationSheet: () => null })
)

const organization = {
  id: "organization-1",
  name: "Test organization",
  key: "test-organization",
  settings: { flagSortedBy: "created_at" as const },
  defaultPermissions: { policyIds: [], groupIds: [] },
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/en/organization/general"]}>
        <OrganizationGeneralPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("OrganizationGeneralPage IAM", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentOrganization).mockReturnValue(organization)
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
  })

  it("finishes loading but keeps permission controls disabled when the policy query fails", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockRejectedValue(
      new Error("Policy request failed")
    )

    renderPage()

    await waitFor(() =>
      expect(screen.getByTestId("policies-loading")).toHaveTextContent("false")
    )
    expect(screen.getByTestId("groups-loading")).toHaveTextContent("false")
    expect(
      screen.getByTestId("can-update-default-permissions")
    ).toHaveTextContent("false")
    expect(fetchOrganizationDefaultPermissionOptions).not.toHaveBeenCalled()
  })
})
