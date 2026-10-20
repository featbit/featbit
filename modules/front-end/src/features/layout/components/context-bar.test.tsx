import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ContextBar } from "./context-bar"

Element.prototype.scrollIntoView = vi.fn()

describe("ContextBar", () => {
  it("keeps endpoints available but hides the secrets section without read permission", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    window.env = {
      EVALUATION_URL: "https://evaluation.example.com",
      API_URL: "https://api.example.com",
    }
    render(
      <MemoryRouter>
        <ContextBar
          organization={null}
          currentProjectEnv={{
            projectId: "p",
            projectName: "Demo",
            projectKey: "demo",
            envId: "e",
            envName: "Production",
            envKey: "prod",
          }}
          projects={[
            {
              id: "p",
              name: "Demo",
              key: "demo",
              environments: [
                {
                  id: "e",
                  name: "Production",
                  secrets: [
                    {
                      id: "s",
                      name: "Server SDK",
                      type: "server",
                      value: "secret",
                    },
                  ],
                },
              ],
            },
          ]}
          canViewSecrets={false}
          onProjectEnvChange={vi.fn()}
        />
      </MemoryRouter>
    )
    expect(screen.getByRole("button", { name: /Production/ })).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "View and copy SDK configuration" })
    )
    expect(
      await screen.findByText("https://evaluation.example.com")
    ).toBeVisible()
    expect(screen.getByText("https://api.example.com")).toBeVisible()
    expect(screen.queryByText("Environment secrets")).not.toBeInTheDocument()
    expect(screen.queryByText("Server SDK")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: /Manage secrets/i })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Copy Streaming URL" })
    )
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("wss://evaluation.example.com")
    )
  })

  afterEach(() => {
    window.env = undefined
  })

  it("shows a Box icon for each environment result", async () => {
    render(
      <MemoryRouter initialEntries={["/en"]}>
        <ContextBar
          canViewSecrets
          organization={{ id: "org-1", key: "acme", name: "Acme" }}
          currentProjectEnv={{
            projectId: "project-1",
            projectName: "Platform",
            projectKey: "platform",
            envId: "env-production",
            envName: "Production",
            envKey: "production",
          }}
          projects={[
            {
              id: "project-1",
              key: "platform",
              name: "Platform",
              environments: [
                {
                  id: "env-production",
                  key: "production",
                  name: "Production",
                },
                {
                  id: "env-staging",
                  key: "staging",
                  name: "Staging",
                },
              ],
            },
          ]}
          onProjectEnvChange={vi.fn()}
        />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole("button", { name: /Production/ }))

    const stagingOption = await screen.findByRole("option", {
      name: "Staging",
    })
    const environmentIcon = stagingOption.querySelector(".lucide-box")

    expect(environmentIcon).toBeInTheDocument()
    expect(environmentIcon).toHaveAttribute("aria-hidden", "true")
  })

  it("shows and copies SDK endpoints alongside masked environment secrets", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    window.env = {
      API_URL: "http://internal-api:5000",
      EVALUATION_URL: "http://internal-evaluation:5100",
      DISPLAY_API_URL: "https://api.example.com",
      DISPLAY_EVALUATION_URL: "https://evaluation.example.com",
    }

    render(
      <MemoryRouter initialEntries={["/en"]}>
        <ContextBar
          canViewSecrets
          organization={{ id: "org-1", key: "acme", name: "Acme" }}
          currentProjectEnv={{
            projectId: "project-1",
            projectName: "Platform",
            projectKey: "platform",
            envId: "env-production",
            envName: "Production",
            envKey: "production",
          }}
          projects={[
            {
              id: "project-1",
              key: "platform",
              name: "Platform",
              environments: [
                {
                  id: "env-production",
                  key: "production",
                  name: "Production",
                  secrets: [
                    {
                      id: "secret-1",
                      name: "Server SDK",
                      type: "server",
                      value: "server-secret",
                    },
                  ],
                },
              ],
            },
          ]}
          onProjectEnvChange={vi.fn()}
        />
      </MemoryRouter>
    )

    const sdkConfigurationTrigger = screen.getByRole("button", {
      name: "View and copy SDK configuration",
    })

    expect(sdkConfigurationTrigger).toHaveTextContent("SDK config")
    expect(
      sdkConfigurationTrigger.querySelector(".lucide-braces")
    ).toBeInTheDocument()
    expect(
      sdkConfigurationTrigger.querySelector(".lucide-key-round")
    ).not.toBeInTheDocument()

    fireEvent.click(sdkConfigurationTrigger)

    expect(await screen.findByText("SDK configuration")).toBeInTheDocument()
    const sdkConfigurationMenu = screen.getByRole("menu", {
      name: "View and copy SDK configuration",
    })
    const currentEnvironmentIcon =
      sdkConfigurationMenu.querySelector(".lucide-box")

    expect(currentEnvironmentIcon).toBeInTheDocument()
    expect(currentEnvironmentIcon).toHaveAttribute("aria-hidden", "true")
    expect(currentEnvironmentIcon?.nextElementSibling).toHaveTextContent(
      "Platform"
    )
    expect(screen.getByText("wss://evaluation.example.com")).toBeInTheDocument()
    expect(
      screen.getByText("https://evaluation.example.com")
    ).toBeInTheDocument()
    expect(screen.getByText("https://api.example.com")).toBeInTheDocument()
    expect(screen.getByText("********cret")).toBeInTheDocument()
    expect(screen.queryByText("server-secret")).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("menuitem", { name: "Copy Streaming URL" })
    )

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("wss://evaluation.example.com")
    )
    expect(screen.getByText("Copied")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("menuitem", { name: "Copy Server SDK" }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("server-secret"))
    expect(screen.getByText("SDK configuration")).toBeInTheDocument()
  })
})
