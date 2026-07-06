import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { App } from "@/app/app"

describe("App shell", () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    window.history.pushState({}, "", "/")
  })

  it("redirects to the localized login route", async () => {
    render(<App />)

    expect(
      await screen.findByText("Sign in to your workspace")
    ).toBeInTheDocument()
  })

  it("renders the localized SSO route", async () => {
    window.history.pushState({}, "", "/en/login/sso")

    render(<App />)

    expect(await screen.findByText("Sign in with SSO")).toBeInTheDocument()
  })

  it("reads runtime env version with a dev fallback", async () => {
    window.history.pushState({}, "", "/en/app")

    render(<App />)

    expect(await screen.findByText("Version: dev")).toBeInTheDocument()
  })
})
