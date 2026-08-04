import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import {
  fetchCurrentUserPolicies,
  type CurrentUserPolicy,
} from "./current-user-permissions"
import { IamRouteGuard } from "./iam-route-guard"

vi.mock("./current-user-permissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./current-user-permissions")>()),
  fetchCurrentUserPolicies: vi.fn(),
}))

function policy(
  effect: "allow" | "deny",
  actions: string[],
  resources: string[]
): CurrentUserPolicy {
  return {
    type: "CustomerManaged",
    statements: [{ resourceType: "iam", effect, actions, resources }],
  }
}

function renderGuard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/en/iam/team"]}>
        <Routes>
          <Route path="/:lang" element={<Outlet />}>
            <Route path="iam" element={<IamRouteGuard />}>
              <Route path="team" element={<div>IAM team</div>} />
            </Route>
            <Route path="feature-flags" element={<div>Feature flags</div>} />
          </Route>
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.pathname}</output>
}

describe("IamRouteGuard", () => {
  beforeEach(async () => {
    vi.mocked(fetchCurrentUserPolicies).mockReset()
    await i18n.changeLanguage("en")
  })

  it("renders IAM routes only with CanManageIAM permission", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      policy("allow", ["CanManageIAM"], ["iam/*"]),
    ])

    renderGuard()

    expect(await screen.findByText("IAM team")).toBeInTheDocument()
  })

  it("shows an unavailable page without a matching permission", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      policy("allow", ["ListAccessTokens"], ["access-token/*"]),
    ])

    renderGuard()

    expect(
      await screen.findByRole("heading", { name: "IAM unavailable" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("/en/iam/team")
    expect(screen.queryByText("Feature flags")).not.toBeInTheDocument()
  })

  it("honors deny precedence", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockResolvedValue([
      policy("allow", ["CanManageIAM"], ["iam/*"]),
      policy("deny", ["CanManageIAM"], ["iam/*"]),
    ])

    renderGuard()

    expect(
      await screen.findByRole("heading", { name: "IAM unavailable" })
    ).toBeInTheDocument()
    expect(screen.queryByText("IAM team")).not.toBeInTheDocument()
  })

  it("fails closed when policies cannot be loaded", async () => {
    vi.mocked(fetchCurrentUserPolicies).mockRejectedValue(
      new Error("Policy request failed")
    )

    renderGuard()

    expect(
      await screen.findByRole("heading", { name: "IAM unavailable" })
    ).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("/en/iam/team")
  })
})
