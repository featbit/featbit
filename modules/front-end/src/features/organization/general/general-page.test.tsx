import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchOrganizations,
  getCurrentOrganization,
} from "@/features/layout/layout-context"
import {
  createOrganization,
  fetchOrganizationDefaultPermissionOptions,
  fetchOrganizationGroups,
  fetchOrganizationPolicies,
  updateOrganization,
} from "@/features/organization/organization-api"
import { fetchCurrentUserPolicies } from "@/features/iam/current-user-permissions"
import { OrganizationGeneralPage } from "./general-page"

vi.mock("@/features/auth/auth-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/auth/auth-api")>()),
  getAuthSessionId: () => "session-1",
  getStoredUserProfile: () => ({ id: "user-1" }),
}))

vi.mock("@/features/layout/layout-context", () => ({
  clearCurrentProjectEnv: vi.fn(),
  fetchOrganizations: vi.fn(),
  getCurrentOrganization: vi.fn(),
  getCurrentWorkspace: vi.fn(() => ({
    id: "workspace-1",
    name: "Workspace",
    key: "workspace",
  })),
  getIsSsoFirstLogin: vi.fn(() => false),
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
    createOrganization: vi.fn(),
    fetchOrganizationDefaultPermissionOptions: vi.fn(),
    fetchOrganizationGroups: vi.fn(),
    fetchOrganizationPolicies: vi.fn(),
    updateOrganization: vi.fn(),
  }
})

vi.mock("@/features/organization/components/organization-layout", () => ({
  OrganizationLayout: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/features/organization/general/components/identity-section", () => ({
  IdentitySection: ({ onSave }: { onSave: () => void }) => (
    <button onClick={onSave}>Save identity</button>
  ),
}))

vi.mock(
  "@/features/organization/general/components/preferences-section",
  () => ({
    PreferencesSection: ({
      policiesLoading,
      groupsLoading,
      canUpdateDefaultPermissions,
      onSaveSorting,
      onSavePermissions,
    }: {
      policiesLoading: boolean
      groupsLoading: boolean
      canUpdateDefaultPermissions: boolean
      onSaveSorting: () => void
      onSavePermissions: () => void
    }) => (
      <>
        <output data-testid="policies-loading">
          {String(policiesLoading)}
        </output>
        <output data-testid="groups-loading">{String(groupsLoading)}</output>
        <output data-testid="can-update-default-permissions">
          {String(canUpdateDefaultPermissions)}
        </output>
        <button onClick={onSaveSorting}>Save sorting</button>
        <button onClick={onSavePermissions}>Save permissions</button>
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
  () => ({
    CreateOrganizationSheet: ({
      onSubmit,
    }: {
      onSubmit: (values: { name: string; key: string }) => void
    }) => (
      <button onClick={() => onSubmit({ name: "Created", key: "created" })}>
        Create organization
      </button>
    ),
  })
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

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/en/organization/general"]}>
        <OrganizationGeneralPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

  return { ...result, queryClient }
}

describe("OrganizationGeneralPage IAM", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentOrganization).mockReturnValue(organization)
    vi.mocked(fetchOrganizations).mockResolvedValue([organization])
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      {
        name: "Owner",
        type: "SysManaged",
        statements: [
          {
            resourceType: "organization",
            effect: "allow",
            actions: ["*"],
            resources: ["*"],
          },
        ],
      },
    ])
    vi.mocked(fetchOrganizationDefaultPermissionOptions).mockResolvedValue({
      policies: [],
      groups: [],
    })
    vi.mocked(fetchOrganizationPolicies).mockResolvedValue({
      totalCount: 0,
      items: [],
    })
    vi.mocked(fetchOrganizationGroups).mockResolvedValue({
      totalCount: 0,
      items: [],
    })
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

  it("synchronizes the organizations query after organization mutations", async () => {
    const { queryClient } = renderPage()

    await waitFor(() => expect(fetchOrganizations).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(
        screen.getByTestId("can-update-default-permissions")
      ).toHaveTextContent("true")
    )

    const identityUpdate = { ...organization, name: "Renamed organization" }
    vi.mocked(updateOrganization).mockResolvedValueOnce(identityUpdate)
    fireEvent.click(screen.getByRole("button", { name: "Save identity" }))

    await waitFor(() =>
      expect(getOrganizationsQueryData(queryClient)).toEqual([identityUpdate])
    )

    const sortingUpdate = {
      ...identityUpdate,
      settings: { flagSortedBy: "key" as const },
    }
    vi.mocked(updateOrganization).mockResolvedValueOnce(sortingUpdate)
    fireEvent.click(screen.getByRole("button", { name: "Save sorting" }))

    await waitFor(() =>
      expect(getOrganizationsQueryData(queryClient)).toEqual([sortingUpdate])
    )

    const permissionsUpdate = {
      ...sortingUpdate,
      defaultPermissions: { policyIds: ["policy-1"], groupIds: ["group-1"] },
    }
    vi.mocked(updateOrganization).mockResolvedValueOnce(permissionsUpdate)
    fireEvent.click(screen.getByRole("button", { name: "Save permissions" }))

    await waitFor(() =>
      expect(getOrganizationsQueryData(queryClient)).toEqual([
        permissionsUpdate,
      ])
    )

    const createdOrganization = {
      ...organization,
      id: "organization-2",
      name: "Created",
      key: "created",
    }
    vi.mocked(createOrganization).mockResolvedValueOnce(createdOrganization)
    fireEvent.click(screen.getByRole("button", { name: "Create organization" }))

    await waitFor(() =>
      expect(getOrganizationsQueryData(queryClient)).toEqual([
        createdOrganization,
        permissionsUpdate,
      ])
    )
  })
})

function getOrganizationsQueryData(queryClient: QueryClient) {
  return queryClient
    .getQueryCache()
    .findAll()
    .find((query) => query.queryKey.includes("organizations"))?.state.data
}
