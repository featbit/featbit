import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/app/app";

function createLicense(plan: string) {
  const payload = btoa(JSON.stringify({ plan, exp: 4102444800000, features: ["*"] }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `test.${payload}.signature`;
}

function mockSignedInContext(options?: {
  workspace?: Record<string, unknown>;
  organization?: Record<string, unknown>;
  workspaceDetails?: Record<string, unknown> | null;
}) {
  const workspace = {
    id: "ws-1",
    key: "acme",
    name: "Acme Workspace",
    license: createLicense("Growth"),
    ...options?.workspace
  };
  const organization = {
    id: "org-1",
    key: "acme-org",
    name: "Acme Corp",
    initialized: true,
    ...options?.organization
  };

  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.endsWith("/api/v1/user/workspaces")) {
      return new Response(JSON.stringify({ success: true, data: [workspace] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.includes("/api/v1/organizations")) {
      return new Response(JSON.stringify({ success: true, data: [organization] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.endsWith("/api/v1/projects")) {
      return new Response(JSON.stringify({
        success: true,
        data: [{
          id: "project-1",
          key: "growth",
          name: "Growth Platform",
          environments: [{ id: "env-1", projectId: "project-1", key: "prod", name: "Production" }]
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (url.endsWith("/api/v1/workspaces")) {
      if (options?.workspaceDetails === null) {
        return new Response(JSON.stringify({ success: false, errors: ["Request failed"] }), { status: 500, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          ...workspace,
          sso: { oidc: {} },
          ...options?.workspaceDetails
        }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

describe("App scaffold", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
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
    mockSignedInContext({
      workspace: { key: "acme-workspace", license: createLicense("Growth") }
    });
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

  it("renders the workspace general page", async () => {
    mockSignedInContext({
      workspace: { license: createLicense("Enterprise") },
      workspaceDetails: { license: createLicense("Enterprise"), sso: { oidc: {} } }
    });
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "ws-1", key: "acme", name: "Acme Workspace", license: createLicense("Enterprise") })
    );
    window.history.pushState({}, "", "/en/workspace");

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "General" })).toHaveClass("text-blue-600");
    expect(await screen.findByLabelText("Name")).toHaveValue("Acme Workspace");
    expect(await screen.findByLabelText("Key")).toHaveValue("acme");
    expect(screen.getByRole("heading", { name: "Single sign-on" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save SSO settings" })).toBeInTheDocument();
  });

  it("loads single sign-on settings from the workspace API", async () => {
    mockSignedInContext({
      workspace: { license: createLicense("Enterprise") },
      workspaceDetails: {
        license: createLicense("Enterprise"),
        sso: {
          oidc: {
            clientId: "client-from-api",
            clientSecret: "secret-from-api",
            tokenEndpoint: "https://idp.example.com/oauth2/token",
            clientAuthenticationMethod: "Client secret post",
            authorizationEndpoint: "https://idp.example.com/oauth2/authorize",
            scope: "openid email",
            userEmailClaim: "mail"
          }
        }
      }
    });
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "ws-1", key: "acme", name: "Acme Workspace", license: createLicense("Enterprise") })
    );
    window.history.pushState({}, "", "/en/workspace");

    render(<App />);

    expect(await screen.findByDisplayValue("client-from-api")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://idp.example.com/oauth2/token")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Client secret post")).toBeInTheDocument();
    expect(screen.getByDisplayValue("mail")).toBeInTheDocument();
  });

  it("shows restricted single sign-on settings when the workspace API redacts SSO settings", async () => {
    mockSignedInContext({
      workspace: { license: createLicense("Enterprise") },
      workspaceDetails: {
        license: createLicense("Enterprise"),
        sso: null
      }
    });
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "ws-1", key: "acme", name: "Acme Workspace", license: createLicense("Enterprise") })
    );
    window.history.pushState({}, "", "/en/workspace");

    render(<App />);

    await screen.findByRole("heading", { name: "Workspace" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Access configuration" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Single sign-on" })).toBeInTheDocument();
    expect(screen.getByText("Restricted")).toBeInTheDocument();
    expect(screen.getByText("You do not have permission to view or edit SSO settings.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save SSO settings" })).not.toBeInTheDocument();
  });

  it("shows single sign-on as a paid feature when the workspace has no license", async () => {
    mockSignedInContext({
      workspace: { license: undefined },
      workspaceDetails: {
        license: undefined,
        sso: { oidc: {} }
      }
    });
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem(
      "current-workspace",
      JSON.stringify({ id: "ws-1", key: "acme", name: "Acme Workspace" })
    );
    window.history.pushState({}, "", "/en/workspace");

    render(<App />);

    await screen.findByRole("heading", { name: "Workspace" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Access configuration" })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Single sign-on" })).toBeInTheDocument();
    expect(screen.getByText("License required")).toBeInTheDocument();
    expect(screen.getByText("Single sign-on is a paid feature. Add a license that includes SSO to enable it for this workspace.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save SSO settings" })).not.toBeInTheDocument();
  });

  it("joins the selected organization after a first SSO login", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/api/v1/user/workspaces")) {
        return new Response(JSON.stringify({
          success: true,
          data: [{ id: "ws-1", key: "acme", name: "Acme Workspace", license: createLicense("Enterprise") }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/v1/organizations?isSsoFirstLogin=true")) {
        return new Response(JSON.stringify({
          success: true,
          data: [{ id: "org-1", key: "default-org", name: "Default Organization", initialized: true }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/v1/user/join-organization")) {
        return new Response(JSON.stringify({ success: true, data: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      if (url.endsWith("/api/v1/projects")) {
        return new Response(JSON.stringify({
          success: true,
          data: [{
            id: "project-1",
            key: "growth",
            name: "Growth Platform",
            environments: [{ id: "env-1", projectId: "project-1", key: "prod", name: "Production" }]
          }]
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    localStorage.setItem("token", "component-token");
    localStorage.setItem("auth", JSON.stringify({ email: "test@featbit.com", name: "Test User" }));
    localStorage.setItem("is-sso-first-login", "true");
    window.history.pushState({}, "", "/en/app");

    render(<App />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/organizations?isSsoFirstLogin=true"),
        expect.any(Object)
      );
    });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/user/join-organization"),
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(localStorage.getItem("is-sso-first-login")).toBeNull();
  });

});
