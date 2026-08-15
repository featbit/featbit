import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ChangeRequestsPage } from "./change-requests-page"
import { fetchChangeRequests } from "./change-requests-api"

vi.mock("@/features/auth/auth-api", () => ({
  getStoredUserProfile: () => ({ id: "user-1" }),
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentProjectEnv: () => ({ envId: "env-1" }),
  getCurrentWorkspace: () => ({ id: "workspace-1" }),
  localizedPath: (lang: string, href: string) => `/${lang}${href}`,
  resolveLang: (lang: string | undefined) => (lang === "zh" ? "zh" : "en"),
}))

vi.mock("./change-requests-api", () => ({
  fetchChangeRequests: vi.fn(),
  performChangeRequestAction: vi.fn(),
}))

describe("ChangeRequestsPage license gate", () => {
  beforeEach(() => {
    vi.mocked(fetchChangeRequests).mockReset()
    window.env = { HOSTING_MODE: "saas" }
  })

  it("shows the gate and skips the list request when the feature is unlicensed", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <MemoryRouter initialEntries={["/en/change-requests"]}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route
              path="/:lang/change-requests"
              element={<ChangeRequestsPage />}
            />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    )

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Change Requests",
      })
    ).toBeVisible()
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/billing")
    expect(fetchChangeRequests).not.toHaveBeenCalled()
  })
})
