import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkspaceDetails } from "@/features/workspace/workspace-api";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("workspace api", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("refreshes an expired access token before surfacing unauthorized errors", async () => {
    localStorage.setItem("token", "expired-token");
    localStorage.setItem("current-workspace", JSON.stringify({ id: "workspace-1", name: "Workspace", key: "workspace" }));
    localStorage.setItem("current-organization", JSON.stringify({ id: "organization-1", name: "Organization", key: "organization" }));

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({ success: false, errors: ["Unauthorized"] }, { status: 401, statusText: "Unauthorized" })
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { token: "fresh-token" } })
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: "workspace-1", name: "Workspace", key: "workspace" } })
    );

    await expect(fetchWorkspaceDetails()).resolves.toEqual({
      id: "workspace-1",
      name: "Workspace",
      key: "workspace"
    });

    expect(localStorage.getItem("token")).toBe("fresh-token");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://localhost:5000/api/v1/workspaces",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer fresh-token"
        })
      })
    );
  });
});
