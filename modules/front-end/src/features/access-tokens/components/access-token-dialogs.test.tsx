import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import {
  AccessTokenConfirmDialog,
  AccessTokenCreatedDialog,
  type AccessTokenConfirmTarget,
} from "./access-token-dialogs"

const token = {
  id: "token-1",
  name: "Deployment automation",
  type: "Service" as const,
}

function renderConfirmDialog(kind: "deactivate" | "remove") {
  const target: AccessTokenConfirmTarget = { kind, token }

  render(
    <AccessTokenConfirmDialog
      target={target}
      saving={false}
      onOpenChange={vi.fn()}
      onConfirm={vi.fn()}
    />
  )
}

describe("AccessTokenConfirmDialog", () => {
  it.each(["deactivate", "remove"] as const)(
    "emphasizes the access token name in the %s dialog",
    (kind) => {
      renderConfirmDialog(kind)

      const tokenName = screen.getByText(token.name)
      expect(tokenName.tagName).toBe("STRONG")
      expect(tokenName).toHaveClass("font-semibold", "text-foreground")
    }
  )
})

describe("AccessTokenCreatedDialog", () => {
  it("vertically centers the token and copy button", () => {
    render(
      <AccessTokenCreatedDialog
        result={{ name: token.name, token: "secret-token" }}
        onClose={vi.fn()}
      />
    )

    const tokenValue = screen.getByText("secret-token")
    expect(tokenValue.parentElement).toHaveClass("items-center")
  })

  it("allows closing only after the token is copied successfully", async () => {
    const onClose = vi.fn()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    render(
      <AccessTokenCreatedDialog
        result={{ name: token.name, token: "secret-token" }}
        onClose={onClose}
      />
    )

    const doneButton = screen.getByRole("button", { name: "Done" })
    expect(doneButton).toBeDisabled()

    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Copy token" }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("secret-token"))
    await waitFor(() => expect(doneButton).toBeEnabled())

    fireEvent.click(doneButton)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("stays locked when copying the token fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })

    render(
      <AccessTokenCreatedDialog
        result={{ name: token.name, token: "secret-token" }}
        onClose={vi.fn()}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Copy token" }))

    const doneButton = screen.getByRole("button", { name: "Done" })
    await waitFor(() => expect(doneButton).toBeDisabled())
  })
})
