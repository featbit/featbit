import { describe, expect, it, vi } from "vitest"
import type { FeatureFlag, FlagListFilter } from "../flags-types"
import type { DocumentationRecord } from "../custom-fields/custom-fields-model"
import { fetchCustomFilteredFlags } from "./custom-filtered-flags"

const filter: FlagListFilter = {
  name: "release",
  tags: ["web"],
  isEnabled: true,
  isArchived: false,
  sortBy: "key",
  pageIndex: 1,
  pageSize: 10,
}
describe("filtering flags before pagination", () => {
  it("finds List matches on later pages using only saved values in the current environment", async () => {
    const flags = Array.from(
      { length: 35 },
      (_, index) => ({ key: `flag-${index}` }) as FeatureFlag
    )
    const fetchPage = vi.fn(async (_env: string, page: FlagListFilter) => ({
      items: flags.slice(
        (page.pageIndex - 1) * page.pageSize,
        page.pageIndex * page.pageSize
      ),
      totalCount: flags.length,
    }))
    const general = { name: "Flag", description: "", tags: [] }
    const records: Record<string, DocumentationRecord> = {
      "dev:flag-34": {
        general,
        customFields: { release: { apps: ["Web", "API"] } },
      },
      "prod:flag-0": { general, customFields: { release: { apps: ["Web"] } } },
    }
    const result = await fetchCustomFilteredFlags(
      "dev",
      filter,
      [
        {
          fieldId: "release",
          controlId: "apps",
          type: "list",
          condition: { operator: "any", values: ["Mobile", "Web"] },
        },
      ],
      [
        {
          fieldId: "release",
          controlId: "apps",
          name: "Applications",
          type: "list",
          options: ["Mobile", "Web", "API"],
        },
      ],
      records,
      fetchPage
    )
    expect(result.items.map((flag) => flag.key)).toEqual(["flag-34"])
    expect(result.totalCount).toBe(1)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
  it("finds matches beyond the first API page and keeps environment scope and built-in filters", async () => {
    const flags = Array.from(
      { length: 45 },
      (_, index) => ({ key: `flag-${index}` }) as FeatureFlag
    )
    const fetchPage = vi.fn(async (_env: string, page: FlagListFilter) => ({
      items: flags.slice(
        (page.pageIndex - 1) * page.pageSize,
        page.pageIndex * page.pageSize
      ),
      totalCount: flags.length,
    }))
    const records: Record<string, DocumentationRecord> = Object.fromEntries(
      flags.map((flag, index) => [
        `dev:${flag.key}`,
        {
          general: { name: flag.key, description: "", tags: [] },
          customFields: { release: { score: index } },
        },
      ])
    )
    records["prod:flag-0"] = {
      ...records["dev:flag-0"],
      customFields: { release: { score: 100 } },
    }
    const result = await fetchCustomFilteredFlags(
      "dev",
      filter,
      [
        {
          fieldId: "release",
          controlId: "score",
          condition: { operator: "gt", from: "39", to: "" },
        },
      ],
      [
        {
          fieldId: "release",
          controlId: "score",
          type: "number",
          name: "Score",
        },
      ],
      records,
      fetchPage
    )
    expect(result.items.map((flag) => flag.key)).toEqual([
      "flag-40",
      "flag-41",
      "flag-42",
      "flag-43",
      "flag-44",
    ])
    expect(result.totalCount).toBe(5)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    for (const [env, params] of fetchPage.mock.calls) {
      expect(env).toBe("dev")
      expect(params).toMatchObject({
        ...filter,
        pageIndex: expect.any(Number),
        pageSize: 30,
      })
    }
  })
  it("uses the unchanged paged API when no custom filter is applied", async () => {
    const fetchPage = vi.fn(async () => ({ items: [], totalCount: 55 }))
    await expect(
      fetchCustomFilteredFlags(
        "dev",
        { ...filter, pageIndex: 3 },
        [],
        [],
        {},
        fetchPage
      )
    ).resolves.toEqual({ items: [], totalCount: 55 })
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith("dev", {
      ...filter,
      pageIndex: 3,
    })
  })
})
