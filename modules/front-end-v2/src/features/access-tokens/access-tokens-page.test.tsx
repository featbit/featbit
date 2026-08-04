import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import {
  fetchAccessTokens,
  fetchCurrentUserPolicies,
} from "./access-tokens-api"
import { AccessTokensPage } from "./access-tokens-page"

vi.mock("./access-tokens-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./access-tokens-api")>()
  return {
    ...actual,
    fetchAccessTokens: vi.fn(),
    fetchCurrentUserPolicies: vi.fn(),
  }
})

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentWorkspace: () => ({ id: "workspace-1" }),
  resolveLang: () => "en",
}))

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/en/workspace/access-tokens"]}>
        <AccessTokensPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe("AccessTokensPage IAM", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await i18n.changeLanguage("en")
  })

  it("does not request or render access tokens without ListAccessTokens", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      {
        name: "Personal manager",
        type: "CustomerManaged",
        statements: [
          {
            id: "manage-personal",
            resourceType: "access-token",
            effect: "allow",
            actions: ["ManagePersonalAccessTokens"],
            resources: ["access-token/*"],
          },
        ],
      },
    ])

    renderPage()

    expect(
      await screen.findByRole("heading", { name: "Access tokens unavailable" })
    ).toBeInTheDocument()
    expect(fetchAccessTokens).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("button", { name: "New access token" })
    ).not.toBeInTheDocument()
  })

  it("requests the list after ListAccessTokens is granted", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      {
        name: "Token reader",
        type: "CustomerManaged",
        statements: [
          {
            id: "list",
            resourceType: "access-token",
            effect: "allow",
            actions: ["ListAccessTokens"],
            resources: ["access-token/*"],
          },
        ],
      },
    ])
    vi.mocked(fetchAccessTokens).mockResolvedValue({
      totalCount: 0,
      items: [],
    })

    renderPage()

    await waitFor(() => expect(fetchAccessTokens).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("No access tokens yet.")).toBeInTheDocument()
  })
})
