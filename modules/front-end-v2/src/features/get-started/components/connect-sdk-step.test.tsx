import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ConnectSdkStep } from "./connect-sdk-step"

vi.mock("./code-block", () => ({
  CodeBlock: () => <div data-testid="code-block" />,
}))

describe("ConnectSdkStep", () => {
  it("uses a compact secret selector without repeating its type", () => {
    render(
      <MemoryRouter>
        <ConnectSdkStep
          lang="en"
          flag={{
            name: "Checkout redesign",
            key: "checkout-redesign",
            variationType: "boolean",
            isEnabled: false,
          }}
          sdkId="javascript"
          environment={{
            id: "env-1",
            projectId: "project-1",
            name: "Production",
            key: "production",
            secrets: [
              {
                id: "client-secret",
                name: "Client Key",
                type: "client",
                value: "client-secret-value",
              },
            ],
          }}
          environmentLoading={false}
          environmentError={false}
          selectedSecretId="client-secret"
          onSdkChange={vi.fn()}
          onSecretChange={vi.fn()}
          onRetryEnvironment={vi.fn()}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      </MemoryRouter>
    )

    const selector = screen.getByRole("combobox")
    expect(selector).toHaveAttribute("data-size", "sm")
    expect(selector).toHaveTextContent("Client Key")
    expect(selector).not.toHaveTextContent("client")
    expect(screen.getByText("Run your app after setup")).toBeVisible()
    expect(screen.queryByText("Waiting for your first evaluation")).toBeNull()
    expect(
      screen
        .getByRole("button", { name: "Continue to verification" })
        .closest("footer")
    ).toHaveClass("sticky", "bottom-0")
  })

  it("uses configuration-shaped skeleton rows while loading", () => {
    render(
      <MemoryRouter>
        <ConnectSdkStep
          lang="en"
          flag={{
            name: "Checkout redesign",
            key: "checkout-redesign",
            variationType: "boolean",
            isEnabled: false,
          }}
          sdkId="javascript"
          environmentLoading
          environmentError={false}
          selectedSecretId=""
          onSdkChange={vi.fn()}
          onSecretChange={vi.fn()}
          onRetryEnvironment={vi.fn()}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      </MemoryRouter>
    )

    expect(
      screen.getByRole("status", {
        name: "Loading environment configuration...",
      })
    ).toBeVisible()
  })
})
