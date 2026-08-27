import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCurrentUserPolicies } from "@/features/iam/current-user-permissions"
import { i18n } from "@/lib/i18n/i18n"
import { fetchRelayProxies } from "./relay-proxies-api"
import { RelayProxiesPage } from "./relay-proxies-page"

vi.mock("./relay-proxies-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./relay-proxies-api")>()),
  fetchRelayProxies: vi.fn(),
}))

vi.mock("@/features/iam/current-user-permissions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/iam/current-user-permissions")
  >()),
  fetchCurrentUserPolicies: vi.fn(),
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentOrganization: () => ({ id: "organization-1" }),
  getCurrentWorkspace: () => ({ id: "workspace-1" }),
}))

function listPolicy() {
  return {
    type: "CustomerManaged" as const,
    statements: [
      {
        resourceType: "relay-proxy",
        effect: "allow" as const,
        actions: ["ListRelayProxies"],
        resources: ["relay-proxy/*"],
      },
    ],
  }
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <RelayProxiesPage />
    </QueryClientProvider>
  )
}

describe("RelayProxiesPage IAM", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("en")
  })

  it("does not request relay proxies without ListRelayProxies", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([])

    renderPage()

    expect(
      await screen.findByRole("heading", {
        name: "You don't have access to Relay proxies",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("Ask a workspace administrator to update your access.")
    ).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    expect(fetchRelayProxies).not.toHaveBeenCalled()
  })

  it("localizes the unavailable state through global i18n", async () => {
    await i18n.changeLanguage("zh")
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([])

    renderPage()

    expect(
      await screen.findByRole("heading", { name: "你没有中继代理访问权限" })
    ).toBeInTheDocument()
    expect(
      screen.getByText("请联系工作区管理员更新你的访问权限。")
    ).toBeInTheDocument()
  })

  it("fails closed and allows retry when permissions cannot be loaded", async () => {
    vi.mocked(fetchCurrentUserPolicies)
      .mockRejectedValueOnce(new Error("Policy request failed"))
      .mockResolvedValueOnce([listPolicy()])
    vi.mocked(fetchRelayProxies).mockResolvedValue({
      totalCount: 0,
      items: [],
    })

    renderPage()

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't verify your Relay proxies access",
      })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("No relay proxies yet.")).toBeInTheDocument()
  })
})
