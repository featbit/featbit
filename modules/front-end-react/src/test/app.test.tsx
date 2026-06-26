import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/app/app";

function createLicense(plan: string) {
  const payload = btoa(JSON.stringify({ plan, exp: 4102444800000, features: ["*"] }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `test.${payload}.signature`;
}

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

  it("renders the authenticated layout", async () => {
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "ws-1", key: "acme-workspace", name: "Acme Workspace", license: createLicense("Growth") })
    );
    window.history.pushState({}, "", "/en/app");

    render(<App />);

    expect(await screen.findByLabelText("Current Plan, Growth")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Feature Flags")).toBeInTheDocument();
    expect(screen.getByText("Content will be added in the next migration steps.")).toBeInTheDocument();
  });
});


