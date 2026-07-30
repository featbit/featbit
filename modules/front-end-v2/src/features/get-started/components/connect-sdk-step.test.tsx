import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { ConnectSdkStep } from "./connect-sdk-step"

vi.mock("./code-block", () => ({
  CodeBlock: () => <div data-testid="code-block" />,
}))

describe("ConnectSdkStep", () => {
  it("uses a compact secret selector", () => {
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

    expect(screen.getByRole("combobox")).toHaveAttribute("data-size", "sm")
  })
})
