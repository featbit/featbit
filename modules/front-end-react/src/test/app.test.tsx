import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/app/app";

describe("App scaffold", () => {
  it("renders the login page", async () => {
    window.history.pushState({}, "", "/en/login");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in to your workspace" })).toBeInTheDocument();
  });

  it("renders the SSO page", async () => {
    window.history.pushState({}, "", "/en/login/sso");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in with SSO" })).toBeInTheDocument();
  });
});
