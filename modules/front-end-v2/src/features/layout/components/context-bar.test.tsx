import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import "@/lib/i18n/i18n"
import { ContextBar } from "./context-bar"

Element.prototype.scrollIntoView = vi.fn()

describe("ContextBar", () => {
  it("shows a Box icon for each environment result", async () => {
    render(
      <MemoryRouter initialEntries={["/en"]}>
        <ContextBar
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
})
