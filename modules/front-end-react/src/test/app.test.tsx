import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app/app";

describe("App scaffold", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

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

  it("renders the authenticated console shell", async () => {
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    window.history.pushState({}, "", "/en/app");

    render(<App />);

    expect(await screen.findByLabelText("Free Plan, Upgrade Now")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Feature Flags")).toBeInTheDocument();
    expect(screen.getByText("Console content will be added in the next migration steps.")).toBeInTheDocument();
  });
});
