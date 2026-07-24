import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { createSegmentEndUser, searchSegmentUsers } from "../../segments-api"
import type { SegmentEndUser } from "../../segments-types"
import { UserPicker } from "./targeting-tab"

vi.mock("../../segments-api", () => ({
  createSegmentEndUser: vi.fn(),
  searchSegmentUsers: vi.fn(),
  updateSegmentTargeting: vi.fn(),
}))

function renderPicker(shared = false, otherKeys: string[] = []) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  function Harness() {
    const [selectedUser, setSelectedUser] = useState<SegmentEndUser | null>(
      null
    )
    return (
      <>
        <UserPicker
          envId="env-1"
          shared={shared}
          selected={[]}
          excluded={otherKeys}
          disabled={false}
          onAdd={setSelectedUser}
        />
        {selectedUser ? <p>Selected {selectedUser.keyId}</p> : null}
      </>
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  )
}

describe("targeting UserPicker", () => {
  beforeEach(() => {
    vi.mocked(searchSegmentUsers).mockReset()
    vi.mocked(createSegmentEndUser).mockReset()
    vi.mocked(searchSegmentUsers).mockResolvedValue([])
    vi.mocked(createSegmentEndUser).mockResolvedValue({
      id: "user-1",
      envId: "env-1",
      keyId: "new-user",
      name: "new-user",
    })
  })

  it("creates a missing environment user and selects it", async () => {
    renderPicker()

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), {
      target: { value: "new-user" },
    })
    fireEvent.click(
      await screen.findByRole("option", {
        name: 'Create user "new-user"',
      })
    )

    await waitFor(() =>
      expect(createSegmentEndUser).toHaveBeenCalledWith("env-1", "new-user")
    )
    expect(await screen.findByText("Selected new-user")).toBeVisible()
  })

  it("does not offer creation for a shared segment", async () => {
    renderPicker(true)

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), {
      target: { value: "new-user" },
    })

    expect(
      await screen.findByText(
        "Shared segments can only target existing global users."
      )
    ).toBeVisible()
    expect(
      screen.queryByRole("option", { name: /Create user/ })
    ).not.toBeInTheDocument()
  })

  it("does not offer creation for a user selected on the other side", async () => {
    renderPicker(false, ["new-user"])

    fireEvent.click(screen.getByRole("button", { name: /Search by name/ }))
    fireEvent.change(await screen.findByPlaceholderText(/Search by name/), {
      target: { value: "new-user" },
    })

    expect(await screen.findByText("No users found.")).toBeVisible()
    expect(
      screen.queryByRole("option", { name: /Create user/ })
    ).not.toBeInTheDocument()
  })
})
