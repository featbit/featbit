import { beforeEach, describe, expect, it } from "vitest"
import {
  copyDocumentation,
  controlSchema,
  customFieldReviewChanges,
  documentationRows,
  normalizeCustomValues,
  validateCustomValues,
  type CustomField,
  type DocumentationRecord,
} from "./custom-fields-model"
import {
  customFieldsStorageKey,
  emptyCustomFieldsProject,
  readCustomFieldsProject,
  saveDocumentationRecord,
  writeCustomFieldsProject,
} from "./custom-fields-storage"

const field: CustomField = {
  id: "release",
  key: "release",
  name: "Release checklist",
  required: true,
  controls: [
    { id: "time", key: "time", label: "Review at", type: "datetime" },
    { id: "number", key: "number", label: "Threshold", type: "number" },
    { id: "check", key: "check", label: "Reviewed", type: "checkbox" },
    { id: "notes", key: "notes", label: "Notes", type: "markdown" },
  ],
}
const source: DocumentationRecord = {
  general: { name: "Source", description: "## Source", tags: ["source"] },
  customFields: {
    release: {
      time: "2026-12-01T09:30:00.000Z",
      number: 0,
      check: false,
      notes: "**Keep** the standard flow.",
    },
  },
}
const target: DocumentationRecord = {
  general: { name: "Target", description: "## Target", tags: ["target"] },
  customFields: {
    release: {
      time: "2026-12-03T09:30:00.000Z",
      number: 5,
      check: true,
      notes: "Target notes",
    },
    unrelated: { note: "Preserve" },
  },
}

describe("project custom fields", () => {
  beforeEach(() => localStorage.clear())
  it("validates controlled multi-select values and compares them without depending on selection order", () => {
    const list: CustomField = {
      id: "apps",
      key: "apps",
      name: "Applications",
      required: true,
      controls: [
        {
          id: "values",
          key: "values",
          label: "Applications",
          type: "list",
          options: ["Web", "API"],
        },
      ],
    }
    expect(
      controlSchema.safeParse({ ...list.controls[0], options: [] }).success
    ).toBe(false)
    expect(
      controlSchema.safeParse({ ...list.controls[0], options: ["Web", "web"] })
        .success
    ).toBe(false)
    expect(normalizeCustomValues([list], {})).toEqual({ apps: { values: [] } })
    expect(validateCustomValues([list], { apps: { values: [] } })[0].code).toBe(
      "requiredValue"
    )
    for (const values of [["Other"], ["Web", "Web"], "Web"])
      expect(validateCustomValues([list], { apps: { values } })[0].code).toBe(
        "invalidValue"
      )
    const selected: DocumentationRecord = {
      ...source,
      customFields: { apps: { values: ["Web", "API"] } },
    }
    const reordered: DocumentationRecord = {
      ...target,
      customFields: { apps: { values: ["API", "Web"] } },
    }
    expect(
      documentationRows(selected, [list], reordered, [list])[1].different
    ).toBe(false)
    expect(
      customFieldReviewChanges(
        [list],
        selected.customFields,
        reordered.customFields
      )
    ).toEqual([])
    const copied = copyDocumentation(
      selected,
      [list],
      target,
      [list],
      new Set(["custom:apps"])
    )
    expect(copied.customFields.apps.values).toEqual(["API", "Web"])
    const narrower = {
      ...list,
      controls: [{ ...list.controls[0], options: ["Web"] }],
    }
    expect(() =>
      copyDocumentation(
        selected,
        [list],
        target,
        [narrower],
        new Set(["custom:apps"])
      )
    ).toThrow("copyInvalidValue")
  })
  it("validates all controls in a required group and treats zero and false as values", () => {
    expect(validateCustomValues([field], source.customFields)).toEqual([])
    expect(
      validateCustomValues([field], {
        release: { time: "invalid", number: "12", notes: " " },
      })
    ).toEqual([
      { fieldId: "release", controlId: "time", code: "invalidValue" },
      { fieldId: "release", controlId: "number", code: "invalidValue" },
      { fieldId: "release", controlId: "notes", code: "requiredValue" },
    ])
    expect(validateCustomValues([{ ...field, required: false }], {})).toEqual(
      []
    )
  })
  it("compares configured controls, ignores stale removed values, and retains identity on rename", () => {
    const renamed = { ...field, name: "Deployment record" }
    expect(
      documentationRows(source, [field], source, [renamed]).every(
        (row) => !row.different
      )
    ).toBe(true)
    expect(
      normalizeCustomValues([field], {
        ...source.customFields,
        removed: { value: "old" },
      })
    ).toEqual(source.customFields)
    expect(
      customFieldReviewChanges(
        [renamed],
        source.customFields,
        target.customFields
      )[0]
    ).toMatchObject({
      label: "custom:release",
      previous: expect.stringContaining("Threshold: 0"),
      current: expect.stringContaining("Threshold: 5"),
    })
  })
  it("copies selected multi-control groups with native types and preserves everything else", () => {
    const copied = copyDocumentation(
      source,
      [field],
      target,
      [field],
      new Set(["custom:release"])
    )
    expect(copied.general).toEqual(target.general)
    expect(copied.customFields.release).toEqual(source.customFields.release)
    expect(copied.customFields.unrelated).toEqual(target.customFields.unrelated)
    expect(typeof copied.customFields.release.number).toBe("number")
    expect(typeof copied.customFields.release.check).toBe("boolean")
    expect(target.customFields.release.number).toBe(5)
    const descriptionOnly = copyDocumentation(
      source,
      [field],
      target,
      [field],
      new Set(["description"])
    )
    expect(descriptionOnly.general).toEqual({
      ...target.general,
      description: source.general.description,
    })
    expect(descriptionOnly.customFields).toEqual(target.customFields)
  })
  it("matches stable keys across compatible projects and rejects missing definitions and invalid required values", () => {
    const targetField = {
      ...field,
      id: "other-field",
      controls: field.controls.map((control) => ({
        ...control,
        id: `other-${control.id}`,
      })),
    }
    const copied = copyDocumentation(
      source,
      [field],
      target,
      [targetField],
      new Set(["custom:release"])
    )
    expect(copied.customFields["other-field"]["other-number"]).toBe(0)
    expect(() =>
      copyDocumentation(
        source,
        [field],
        target,
        [],
        new Set(["custom:release"])
      )
    ).toThrow("incompatibleField")
    expect(() =>
      copyDocumentation(
        { ...source, customFields: {} },
        [field],
        target,
        [field],
        new Set(["custom:release"])
      )
    ).toThrow("copyInvalidValue")
    expect(() =>
      copyDocumentation(
        { ...source, customFields: {} },
        [field],
        target,
        [field],
        new Set(["description"])
      )
    ).not.toThrow()
  })
  it("stores definitions per project and flag values per environment without resetting configuration", () => {
    writeCustomFieldsProject("project", {
      ...emptyCustomFieldsProject(),
      configured: true,
      fields: [field],
    })
    saveDocumentationRecord(
      "project",
      "dev",
      "flag",
      source,
      target,
      "Save Dev"
    )
    saveDocumentationRecord(
      "project",
      "prod",
      "flag",
      target,
      source,
      "Save Prod"
    )
    const stored = readCustomFieldsProject("project")
    expect(stored.fields).toEqual([field])
    expect(stored.records["dev:flag"]).toEqual(source)
    expect(stored.records["prod:flag"]).toEqual(target)
    expect(stored.history).toHaveLength(2)
    expect(readCustomFieldsProject("other-project").fields).toEqual([])
    expect(localStorage.getItem(customFieldsStorageKey("project"))).toBeTruthy()
  })
})
