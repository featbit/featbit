import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import "../access-tokens-i18n"
import type { AccessToken } from "../access-token-types"
import { AccessTokenSheet } from "./access-token-sheet"

const sharedProps = {
  open: true,
  policies: [],
  fineGrainedGranted: true,
  canManagePersonal: true,
  canManageService: true,
  onOpenChange: vi.fn(),
  onCreated: vi.fn(),
  onSaved: vi.fn(),
}

function renderWithQueryClient(element: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  )
}

describe("AccessTokenSheet", () => {
  it("does not show Type helper copy in the New sheet", () => {
    renderWithQueryClient(
      <AccessTokenSheet {...sharedProps} mode="new" token={null} />
    )

    expect(
      screen.queryByText("Personal tokens use your user permissions")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Service tokens require explicit permissions")
    ).not.toBeInTheDocument()
  })

  it("keeps Type read-only in the Edit sheet without helper copy", () => {
    const token: AccessToken = {
      id: "service-token",
      name: "Production automation",
      type: "Service",
      permissions: [
        {
          id: "segment-access",
          resourceType: "segment",
          effect: "allow",
          actions: ["Get"],
          resources: ["project/shop:env/production:segment/beta-users"],
        },
      ],
    }

    renderWithQueryClient(
      <AccessTokenSheet {...sharedProps} mode="edit" token={token} />
    )

    expect(
      screen.queryByText("Service tokens require explicit permissions")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /Type/ })).toBeDisabled()
  })
})
