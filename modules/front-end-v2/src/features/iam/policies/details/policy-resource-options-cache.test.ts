import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchPolicyResourceOptions,
  policyResourceOptionsQuery,
} from "./policy-resource-options-cache"

const mocks = vi.hoisted(() => ({
  fetchPolicyResources: vi.fn(),
}))

vi.mock("./policy-details-api", () => ({
  fetchPolicyResources: mocks.fetchPolicyResources,
}))

describe("policy resource options cache", () => {
  beforeEach(() => {
    mocks.fetchPolicyResources.mockReset()
  })

  it("normalizes searches and reuses fresh resource results", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const resources = [
      {
        id: "env-1",
        name: "Production",
        rn: "project/shop:env/prod",
        type: "env",
      },
    ]
    mocks.fetchPolicyResources.mockResolvedValue(resources)

    await fetchPolicyResourceOptions(queryClient, "env", " production ")
    await fetchPolicyResourceOptions(queryClient, "env", "production")

    expect(mocks.fetchPolicyResources).toHaveBeenCalledTimes(1)
    expect(mocks.fetchPolicyResources).toHaveBeenCalledWith("production", "env")
    expect(
      queryClient.getQueryData(
        policyResourceOptionsQuery("env", "production").queryKey
      )
    ).toEqual(resources)
  })
})
