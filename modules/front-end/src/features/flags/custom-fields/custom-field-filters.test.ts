import { describe, expect, it } from "vitest"
import {
  comparisonValue,
  filterableControls,
  filterConditionIssue,
  matchesCustomFieldFilters,
  validCustomFilters,
  type CustomFieldFilter,
} from "./custom-field-filters"
import type { CustomField } from "./custom-fields-model"

const field: CustomField = {
  id: "release",
  key: "release",
  name: "Release",
  required: false,
  controls: [
    { id: "score", key: "score", label: "Score", type: "number" },
    { id: "review", key: "review", label: "Review", type: "datetime" },
    { id: "count", key: "count", label: "Count", type: "number" },
    { id: "notes", key: "notes", label: "Notes", type: "markdown" },
    {
      id: "apps",
      key: "apps",
      label: "Applications",
      type: "list",
      options: ["Web"],
    },
  ],
}
const controls = filterableControls([field])
const condition = (
  operator: "gt" | "lt" | "range",
  from: string,
  to = ""
): CustomFieldFilter => ({
  fieldId: "release",
  controlId: "score",
  condition: { operator, from, to },
})

describe("custom field list filters", () => {
  it("offers numeric, datetime and List controls without preselecting any filter", () => {
    expect(controls.map((control) => control.controlId)).toEqual([
      "score",
      "review",
      "count",
      "apps",
    ])
    expect(validCustomFilters([], controls)).toEqual([])
    expect(matchesCustomFieldFilters({}, [], controls)).toBe(true)
  })
  it("matches any selected List value and combines the List filter with other fields using AND", () => {
    const list = { ...controls[3], options: ["Web", "API", "Mobile"] }
    const allControls = [...controls.slice(0, 3), list]
    const filter: CustomFieldFilter = {
      fieldId: "release",
      controlId: "apps",
      type: "list",
      condition: { operator: "any", values: ["Mobile", "Web"] },
    }
    const values = { release: { apps: ["Web", "API"], score: 5 } }
    expect(matchesCustomFieldFilters(values, [filter], allControls)).toBe(true)
    expect(
      matchesCustomFieldFilters(
        values,
        [filter, condition("gt", "4")],
        allControls
      )
    ).toBe(true)
    expect(
      matchesCustomFieldFilters(
        values,
        [filter, condition("gt", "5")],
        allControls
      )
    ).toBe(false)
    expect(
      matchesCustomFieldFilters(
        values,
        [{ ...filter, condition: { operator: "any", values: ["Mobile"] } }],
        allControls
      )
    ).toBe(false)
    for (const apps of [null, "Web", [], false])
      expect(
        matchesCustomFieldFilters({ release: { apps } }, [filter], allControls)
      ).toBe(false)
  })
  it("validates List options and clears conditions that reference removed options", () => {
    const list = controls[3]
    for (const values of [[], ["Unknown"], ["Web", "Web"]])
      expect(filterConditionIssue(list, { operator: "any", values })).toBe(
        "invalidOptions"
      )
    expect(
      filterConditionIssue(list, { operator: "any", values: ["Web"] })
    ).toBeNull()
    expect(filterConditionIssue(list, condition("gt", "0").condition!)).toBe(
      "invalidOptions"
    )
    expect(
      filterConditionIssue(controls[0], { operator: "any", values: ["Web"] })
    ).toBe("invalid")
    const filter: CustomFieldFilter = {
      fieldId: "release",
      controlId: "apps",
      type: "list",
      condition: { operator: "any", values: ["Web"] },
    }
    expect(
      validCustomFilters([filter], [{ ...list, options: ["API"] }])[0].condition
    ).toBeUndefined()
    expect(
      validCustomFilters([filter, controls[0], controls[1]], controls)
    ).toHaveLength(2)
  })
  it("uses exclusive greater/less comparisons and inclusive ranges, including zero", () => {
    const match = (value: number, filter: CustomFieldFilter) =>
      matchesCustomFieldFilters(
        { release: { score: value } },
        [filter],
        controls
      )
    expect(match(0, condition("gt", "-1"))).toBe(true)
    expect(match(0, condition("gt", "0"))).toBe(false)
    expect(match(0, condition("lt", "1"))).toBe(true)
    expect(match(1, condition("lt", "1"))).toBe(false)
    for (const value of [0, 1, 2])
      expect(match(value, condition("range", "0", "2"))).toBe(true)
    expect(match(3, condition("range", "0", "2"))).toBe(false)
    expect(match(0, condition("range", "0", "0"))).toBe(true)
  })
  it("requires all filters to match and excludes missing or incorrectly typed values", () => {
    const filters: CustomFieldFilter[] = [
      condition("gt", "0"),
      {
        fieldId: "release",
        controlId: "review",
        condition: {
          operator: "range",
          from: "2026-12-01T00:00:00Z",
          to: "2026-12-02T00:00:00Z",
        },
      },
    ]
    expect(
      matchesCustomFieldFilters(
        { release: { score: 5, review: "2026-12-01T08:00:00+08:00" } },
        filters,
        controls
      )
    ).toBe(true)
    expect(
      matchesCustomFieldFilters(
        { release: { score: 5, review: "2026-12-03T00:00:00Z" } },
        filters,
        controls
      )
    ).toBe(false)
    expect(
      matchesCustomFieldFilters({ release: { score: 5 } }, filters, controls)
    ).toBe(false)
    for (const score of [null, "5", false, ["5"]])
      expect(
        matchesCustomFieldFilters(
          { release: { score } },
          [condition("gt", "0")],
          controls
        )
      ).toBe(false)
  })
  it("rejects empty, invalid and reversed bounds", () => {
    for (const from of ["", " ", "NaN", "Infinity"])
      expect(
        filterConditionIssue(controls[0], condition("gt", from).condition!)
      ).toBe("invalid")
    expect(
      filterConditionIssue(controls[0], condition("range", "5", "4").condition!)
    ).toBe("reversed")
    expect(
      filterConditionIssue(controls[0], condition("range", "0", "").condition!)
    ).toBe("invalid")
    expect(comparisonValue("datetime", "invalid")).toBeNaN()
  })
  it("caps selection at two, rejects duplicates and removes deleted or retyped controls", () => {
    const filters = controls.map((control) => ({ ...control }))
    expect(validCustomFilters([...filters, ...filters], controls)).toHaveLength(
      2
    )
    expect(validCustomFilters([filters[0], filters[0]], controls)).toHaveLength(
      1
    )
    expect(
      validCustomFilters(filters, controls.slice(1)).map(
        (filter) => filter.controlId
      )
    ).toEqual(["review", "count"])
    expect(
      validCustomFilters([filters[0]], [{ ...controls[0], type: "datetime" }])
    ).toEqual([])
  })
})
