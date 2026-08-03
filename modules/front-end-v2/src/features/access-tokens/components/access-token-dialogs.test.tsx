import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import {
  AccessTokenConfirmDialog,
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
