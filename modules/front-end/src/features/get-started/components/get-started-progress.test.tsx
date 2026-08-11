import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import { GetStartedProgress } from "./get-started-progress"

describe("GetStartedProgress", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("allows navigation to completed steps only", () => {
    const onStepChange = vi.fn()

    render(
      <GetStartedProgress
        step={2}
        flag={{
          name: "Checkout redesign",
          key: "checkout-redesign",
          variationType: "boolean",
          isEnabled: false,
        }}
        sdkId="javascript"
        onStepChange={onStepChange}
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: /create a feature flag/i })
    )
    expect(onStepChange).toHaveBeenCalledWith(0)
    expect(
      screen.queryByRole("button", { name: /verify connection/i })
    ).not.toBeInTheDocument()
  })
})
