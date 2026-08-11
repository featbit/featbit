import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchApi } from "@/lib/api/authenticated-api"
import {
  currentUserPoliciesQueryKey,
  currentUserPoliciesQueryOptions,
} from "./current-user-policy-query"
import {
  canUseAction,
  environmentRn,
  fetchCurrentUserPolicies,
  projectRn,
  type CurrentUserPolicy,
} from "./current-user-permissions"

vi.mock("@/lib/api/authenticated-api", () => ({
  fetchApi: vi.fn(),
}))

function policy(
  effect: "allow" | "deny",
  actions: string[],
  resources: string[],
  resourceType = "project"
): CurrentUserPolicy {
  return {
    type: "CustomerManaged",
    statements: [{ resourceType, effect, actions, resources }],
  }
}

describe("current user permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("scopes the shared policy query by organization", () => {
    expect(currentUserPoliciesQueryKey("organization-1")).toEqual([
      "current-user-policies",
      "organization-1",
    ])
    expect(currentUserPoliciesQueryKey("organization-2")).not.toEqual(
      currentUserPoliciesQueryKey("organization-1")
    )
    expect(currentUserPoliciesQueryOptions("").enabled).toBe(false)
  })

  it("loads current-user policies through the shared endpoint", async () => {
    vi.mocked(fetchApi).mockResolvedValue([])

    await expect(fetchCurrentUserPolicies()).resolves.toEqual([])

    expect(fetchApi).toHaveBeenCalledWith("/api/v1/user/policies")
  })

  it("matches workspace, project, and environment resource names", () => {
    const policies = [
      policy("allow", ["UpdateWorkspaceGeneralSettings"], ["workspace/*"]),
      policy("allow", ["UpdateProjectSettings"], ["project/demo"]),
      policy(
        "allow",
        ["UpdateEnvSettings"],
        ["project/demo:env/production"],
        "env"
      ),
    ]

    expect(
      canUseAction(policies, "workspace/*", "UpdateWorkspaceGeneralSettings")
    ).toBe(true)
    expect(
      canUseAction(policies, projectRn("demo"), "UpdateProjectSettings")
    ).toBe(true)
    expect(
      canUseAction(
        policies,
        environmentRn("demo", "production"),
        "UpdateEnvSettings"
      )
    ).toBe(true)
  })

  it("uses deny precedence when allow and deny both match", () => {
    const policies = [
      policy("allow", ["DeleteEnvSecret"], ["project/*:env/*"], "env"),
      policy(
        "deny",
        ["DeleteEnvSecret"],
        ["project/demo:env/production"],
        "env"
      ),
    ]

    expect(
      canUseAction(
        policies,
        environmentRn("demo", "production"),
        "DeleteEnvSecret"
      )
    ).toBe(false)
  })

  it("fails closed when no statement matches", () => {
    expect(canUseAction([], "workspace/*", "UpdateWorkspaceSSOSettings")).toBe(
      false
    )
  })

  it("allows a project prefix statement to cover environment creation", () => {
    const policies = [policy("allow", ["CreateEnv"], ["project/demo"])]

    expect(canUseAction(policies, "project/demo:env/*", "CreateEnv")).toBe(true)
  })
})
