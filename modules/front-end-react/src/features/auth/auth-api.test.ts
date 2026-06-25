import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeLogin, getIdentityToken } from "@/features/auth/auth-api";

describe("auth persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { email: "user@example.com" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
  });

  it("stores login state in sessionStorage when remember me is off", async () => {
    const navigate = vi.fn();

    await completeLogin({ success: true, data: { token: "session-token" } }, navigate, "/en/app", false);

    expect(sessionStorage.getItem("token")).toBe("session-token");
    expect(localStorage.getItem("token")).toBeNull();
    expect(getIdentityToken()).toBe("session-token");
    expect(navigate).toHaveBeenCalledWith("/en/app");
  });

  it("stores login state in localStorage when remember me is on", async () => {
    const navigate = vi.fn();

    await completeLogin({ success: true, data: { token: "remembered-token" } }, navigate, "/en/app", true);

    expect(localStorage.getItem("token")).toBe("remembered-token");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(getIdentityToken()).toBe("remembered-token");
    expect(navigate).toHaveBeenCalledWith("/en/app");
  });
});
