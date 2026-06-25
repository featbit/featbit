import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeLogin, getIdentityToken, getRememberedEmail } from "@/features/auth/auth-api";

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

  it("stores auth token in localStorage and forgets email when remember me is off", async () => {
    const navigate = vi.fn();

    localStorage.setItem("remembered-email", "old@example.com");

    await completeLogin(
      { success: true, data: { token: "auth-token" } },
      navigate,
      "/en/app",
      { email: "user@example.com", rememberMe: false }
    );

    expect(localStorage.getItem("token")).toBe("auth-token");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(getIdentityToken()).toBe("auth-token");
    expect(getRememberedEmail()).toBe("");
    expect(navigate).toHaveBeenCalledWith("/en/app");
  });

  it("stores auth token and remembered email when remember me is on", async () => {
    const navigate = vi.fn();

    await completeLogin(
      { success: true, data: { token: "auth-token" } },
      navigate,
      "/en/app",
      { email: "user@example.com", rememberMe: true }
    );

    expect(localStorage.getItem("token")).toBe("auth-token");
    expect(sessionStorage.getItem("token")).toBeNull();
    expect(getIdentityToken()).toBe("auth-token");
    expect(getRememberedEmail()).toBe("user@example.com");
    expect(navigate).toHaveBeenCalledWith("/en/app");
  });
});
