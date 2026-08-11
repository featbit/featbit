import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { GetStartedFlag } from "./get-started-types"
import { i18n } from "@/lib/i18n/i18n"
import { GetStartedPage } from "./get-started-page"

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      id: "env-1",
      projectId: "project-1",
      name: "Production",
      key: "production",
      secrets: [],
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}))

vi.mock("@/features/layout/layout-context", () => ({
  getCurrentProjectEnv: () => ({
    projectId: "project-1",
    envId: "env-1",
  }),
  localizedPath: (lang: string, path: string) => `/${lang}${path}`,
  resolveLang: () => "en",
}))

vi.mock("./components/create-feature-flag-step", () => ({
  CreateFeatureFlagStep: ({
    onComplete,
  }: {
    onComplete: (flag: GetStartedFlag) => void
  }) => (
    <section>
      <h2 data-get-started-step-heading tabIndex={-1}>
        Create a feature flag
      </h2>
      <button
        type="button"
        onClick={() =>
          onComplete({
            name: "Checkout redesign",
            key: "checkout-redesign",
            variationType: "boolean",
            isEnabled: false,
          })
        }
      >
        Complete flag step
      </button>
    </section>
  ),
}))

vi.mock("./components/connect-sdk-step", () => ({
  ConnectSdkStep: ({ onContinue }: { onContinue: () => void }) => (
    <section>
      <h2 data-get-started-step-heading tabIndex={-1}>
        Connect an SDK
      </h2>
      <button type="button" onClick={onContinue}>
        Continue to verification
      </button>
    </section>
  ),
}))

vi.mock("./components/verify-connection-step", () => ({
  VerifyConnectionStep: () => (
    <section>
      <h2 data-get-started-step-heading tabIndex={-1}>
        Verify connection
      </h2>
    </section>
  ),
}))

vi.mock("./components/resources-rail", () => ({
  ResourcesRail: () => <aside>Resources</aside>,
}))

describe("GetStartedPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("returns the main scroll container to the top and focuses each new step", async () => {
    render(
      <main>
        <MemoryRouter initialEntries={["/en/get-started"]}>
          <GetStartedPage />
        </MemoryRouter>
      </main>
    )

    const main = screen.getByRole("main")
    main.scrollTop = 480
    fireEvent.click(screen.getByRole("button", { name: "Complete flag step" }))

    const sdkHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Connect an SDK",
    })
    await waitFor(() => expect(main.scrollTop).toBe(0))
    expect(sdkHeading).toHaveFocus()

    main.scrollTop = 640
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to verification" })
    )

    const verifyHeading = await screen.findByRole("heading", {
      level: 2,
      name: "Verify connection",
    })
    await waitFor(() => expect(main.scrollTop).toBe(0))
    expect(verifyHeading).toHaveFocus()
  })
})
