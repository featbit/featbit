import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ConnectSdkStep } from "./connect-sdk-step"

vi.mock("./code-block", () => ({
  CodeBlock: () => <div data-testid="code-block" />,
}))

const flag = {
  name: "Checkout redesign",
  key: "checkout-redesign",
  variationType: "boolean",
  isEnabled: false,
}

const environment = {
  id: "env-1",
  projectId: "project-1",
  name: "Production",
  key: "production",
  secrets: [
    {
      id: "client-secret-1",
      name: "Client Secret 1",
      type: "client" as const,
      value: "client-secret-value-1",
    },
    {
      id: "client-secret-2",
      name: "Client Secret 2",
      type: "client" as const,
      value: "client-secret-value-2",
    },
    {
      id: "server-secret-1",
      name: "Server Secret 1",
      type: "server" as const,
      value: "server-secret-value-1",
    },
  ],
}

function renderStep(
  overrides: Partial<React.ComponentProps<typeof ConnectSdkStep>> = {}
) {
  const props: React.ComponentProps<typeof ConnectSdkStep> = {
    lang: "en",
    flag,
    sdkId: "javascript",
    environment,
    environmentLoading: false,
    environmentError: false,
    selectedSecretId: "client-secret-1",
    onSdkChange: vi.fn(),
    onSecretChange: vi.fn(),
    onRetryEnvironment: vi.fn(),
    onBack: vi.fn(),
    onContinue: vi.fn(),
    ...overrides,
  }

  return render(
    <MemoryRouter>
      <ConnectSdkStep {...props} />
    </MemoryRouter>
  )
}

describe("ConnectSdkStep", () => {
  it("matches the compact left SDK rail and removes the redundant setup alert", () => {
    renderStep()

    const selector = screen.getByRole("combobox")
    expect(selector).toHaveAttribute("data-size", "sm")
    expect(selector).toHaveTextContent("Client Secret 1")
    expect(selector).not.toHaveTextContent("client")
    expect(screen.getByText("Choose SDK")).toBeVisible()
    expect(screen.getAllByRole("tab")).toHaveLength(6)
    const sdkRail = screen.getByRole("complementary")
    expect(sdkRail.parentElement).toHaveClass(
      "@min-[52rem]:grid-cols-[13rem_minmax(0,1fr)]"
    )
    const sdkList = screen.getByRole("tablist", { name: "Choose SDK" })
    expect(sdkList).toHaveClass("gap-1", "bg-transparent", "p-0")
    expect(sdkList).not.toHaveClass("border")
    const selectedSdk = screen.getByRole("tab", { name: "JavaScript" })
    expect(selectedSdk).toHaveAttribute("data-active")
    expect(selectedSdk).toHaveClass(
      "rounded-md",
      "data-active:border-border",
      "data-active:bg-muted"
    )
    expect(screen.getByText("JavaScript SDK")).toBeVisible()
    expect(screen.getByText("Client-side")).toBeVisible()
    expect(screen.queryByText("Run your app after setup")).toBeNull()
    expect(screen.queryByText("Waiting for your first evaluation")).toBeNull()
    expect(screen.getByRole("button", { name: "Endpoints (3)" })).toBeVisible()
    const footer = screen
      .getByRole("button", { name: "Continue to verification" })
      .closest("footer")
    expect(footer).not.toHaveClass("sticky")
    expect(footer).not.toHaveClass("bottom-0")
    expect(footer).toHaveClass("bg-card")
    expect(footer?.closest("section")).toHaveClass("isolate")
  })

  it("defaults to the first secret compatible with the selected SDK type", async () => {
    const onSecretChange = vi.fn()
    const { rerender } = renderStep({
      selectedSecretId: "",
      onSecretChange,
    })

    await waitFor(() =>
      expect(onSecretChange).toHaveBeenCalledWith("client-secret-1")
    )
    onSecretChange.mockClear()

    rerender(
      <MemoryRouter>
        <ConnectSdkStep
          lang="en"
          flag={flag}
          sdkId="node"
          environment={environment}
          environmentLoading={false}
          environmentError={false}
          selectedSecretId="client-secret-1"
          onSdkChange={vi.fn()}
          onSecretChange={onSecretChange}
          onRetryEnvironment={vi.fn()}
          onBack={vi.fn()}
          onContinue={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() =>
      expect(onSecretChange).toHaveBeenCalledWith("server-secret-1")
    )
  })

  it("keeps endpoint details behind the compact disclosure", async () => {
    renderStep()

    expect(screen.queryByText("Streaming URL")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Endpoints (3)" }))

    expect(await screen.findByText("Streaming URL")).toBeVisible()
    expect(screen.getByText("Event URL")).toBeVisible()
    expect(screen.getByText("Open API endpoint")).toBeVisible()
  })

  it("uses configuration-shaped skeleton rows while loading", () => {
    renderStep({
      environment: undefined,
      environmentLoading: true,
      selectedSecretId: "",
    })

    expect(
      screen.getByRole("status", {
        name: "Loading environment configuration...",
      })
    ).toBeVisible()
  })
})
