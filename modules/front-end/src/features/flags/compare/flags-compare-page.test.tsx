import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCurrentUserPolicies } from "@/features/iam/current-user-permissions"
import { fetchProjects } from "@/features/layout/layout-context"
import { fetchApi } from "@/lib/api/authenticated-api"
import { i18n } from "@/lib/i18n/i18n"
import { fetchFeatureFlagTags } from "../flags-api"
import { FlagsComparePage } from "./flags-compare-page"

vi.mock("@/features/layout/layout-context", () => ({
  fetchProjects: vi.fn(),
  getCurrentOrganization: () => ({
    id: "organization-1",
    settings: { flagSortedBy: "created_at" },
  }),
  getCurrentProjectEnv: () => ({
    projectId: "project-1",
    projectKey: "project-key",
    envId: "env-1",
    envKey: "env-key",
  }),
  getCurrentWorkspace: () => ({ id: "workspace-1" }),
  localizedPath: (lang: string, href: string) => `/${lang}${href}`,
  resolveLang: (lang: string | undefined) => (lang === "zh" ? "zh" : "en"),
}))

vi.mock("../flags-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../flags-api")>()),
  fetchFeatureFlagTags: vi.fn(),
}))

vi.mock("@/features/iam/current-user-permissions", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/features/iam/current-user-permissions")
  >()),
  fetchCurrentUserPolicies: vi.fn(),
}))

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

function renderPage(path = "/en/feature-flags/compare") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={queryClient}>
        <Routes>
          <Route
            path="/:lang/feature-flags/compare"
            element={<FlagsComparePage />}
          />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

describe("FlagsComparePage license gate", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    window.env = { HOSTING_MODE: "saas" }
    await i18n.changeLanguage("en")
  })

  it("shows the full-page gate and skips compare data requests", () => {
    renderPage()

    expect(
      screen.getByRole("heading", {
        name: "Your license doesn't include Feature Flag Comparison",
      })
    ).toBeVisible()
    expect(screen.getByRole("link", { name: "Feature flags" })).toHaveAttribute(
      "href",
      "/en/feature-flags"
    )
    expect(
      screen.getByRole("button", { name: "Manage license" })
    ).toHaveAttribute("href", "/en/workspace/billing")
    expect(screen.queryByText("Compare environments")).not.toBeInTheDocument()
    expect(fetchProjects).not.toHaveBeenCalled()
    expect(fetchFeatureFlagTags).not.toHaveBeenCalled()
    expect(fetchCurrentUserPolicies).not.toHaveBeenCalled()
    expect(fetchApi).not.toHaveBeenCalled()
  })

  it("localizes the license gate through global i18n", async () => {
    await i18n.changeLanguage("zh")

    renderPage("/zh/feature-flags/compare")

    expect(
      screen.getByRole("heading", {
        name: "当前许可证不包含功能开关比较",
      })
    ).toBeVisible()
    expect(
      screen.getByText("升级后，你可以在这里跨环境比较功能开关。")
    ).toBeVisible()
  })
})
