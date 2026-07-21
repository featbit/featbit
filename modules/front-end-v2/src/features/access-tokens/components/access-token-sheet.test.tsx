import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import "../access-tokens-i18n"
import type { AccessToken } from "../access-token-types"
import { AccessTokenSheet } from "./access-token-sheet"

const mocks = vi.hoisted(() => ({
  fetchAccessTokenResources: vi.fn(),
  updateAccessToken: vi.fn(),
}))

vi.mock("../access-tokens-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../access-tokens-api")>()),
  fetchAccessTokenResources: mocks.fetchAccessTokenResources,
  updateAccessToken: mocks.updateAccessToken,
}))

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
  beforeEach(() => {
    mocks.fetchAccessTokenResources.mockReset()
    mocks.updateAccessToken.mockReset()
    sharedProps.onSaved.mockReset()
  })

  it("shows inherited permissions separately from the Type field", () => {
    renderWithQueryClient(
      <AccessTokenSheet {...sharedProps} mode="new" token={null} />
    )

    expect(
      screen.queryByText("Personal tokens use your user permissions")
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText("Service tokens require explicit permissions")
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Permissions" })
    ).toBeInTheDocument()
    expect(screen.getByText("Uses your user permissions")).toBeInTheDocument()
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
    expect(
      screen.queryByText("Uses your user permissions")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: /Type/ })).toBeDisabled()
  })

  it("saves every resource selected in the Edit sheet", async () => {
    const existingRn = "project/shop:env/production:segment/beta-users"
    const addedRn = "project/shop:env/staging:segment/early-access"
    const token: AccessToken = {
      id: "service-token",
      name: "Production automation",
      type: "Service",
      permissions: [
        {
          id: "segment-access",
          resourceType: "segment",
          effect: "allow",
          actions: ["CreateSegment"],
          resources: [existingRn],
        },
      ],
    }
    mocks.fetchAccessTokenResources.mockResolvedValue([
      {
        id: "early-access",
        name: "Early access segment",
        rn: addedRn,
        type: "segment",
      },
    ])
    const updatedToken = {
      ...token,
      permissions: [
        {
          ...token.permissions![0],
          resources: [existingRn, addedRn],
        },
      ],
    }
    mocks.updateAccessToken.mockResolvedValue(updatedToken)

    renderWithQueryClient(
      <AccessTokenSheet {...sharedProps} mode="edit" token={token} />
    )

    fireEvent.click(screen.getByRole("button", { name: "Add resource" }))
    fireEvent.click(await screen.findByText("Early access segment"))
    fireEvent.click(screen.getByRole("button", { name: "Done" }))
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => expect(mocks.updateAccessToken).toHaveBeenCalledOnce())
    const [, payload] = mocks.updateAccessToken.mock.calls[0]
    expect(payload.permissions).toContainEqual(
      expect.objectContaining({
        resourceType: "segment",
        resources: [existingRn, addedRn],
      })
    )
    expect(sharedProps.onSaved).toHaveBeenCalledWith(updatedToken)
  })
})
