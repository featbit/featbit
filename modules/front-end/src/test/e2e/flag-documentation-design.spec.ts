import { expect, test, type Page, type Locator } from "@playwright/test"

const path = "/en/feature-flags/rainy-day-rescue/settings"
const preview = `${path}?preview=flag-settings`
const storeKey = "featbit:flag-custom-fields:v2:flag-settings-preview-project"
const sourceKey = "flag-settings-preview-dev:rainy-day-rescue"
const stagingKey = "flag-settings-preview-staging:rainy-day-rescue"

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.addInitScript(() => localStorage.setItem("featbit:theme", "light"))
})
async function openSettings(page: Page, role = "project-admin") {
  await page.goto(`${preview}&preview-role=${role}`)
  await expect(
    page.getByRole("heading", { name: "Rainy-day rescue", exact: true })
  ).toBeVisible()
  await expect(page.locator("#flag-description")).toBeVisible()
}
async function openCustom(page: Page) {
  await page.getByRole("tab", { name: /Custom fields/ }).click()
  await expect(
    page.getByRole("heading", { name: "Date expiry", exact: true })
  ).toBeVisible()
}
async function openProjectFields(page: Page, role = "project-admin") {
  await page.goto(
    `/en/organization/projects?preview=flag-settings&preview-role=${role}`
  )
  await page
    .getByRole("button", {
      name: "Manage custom fields for FeatBit Demo",
      exact: true,
    })
    .click()
  const sheet = page.getByRole("dialog", {
    name: "Custom fields · FeatBit Demo",
    exact: true,
  })
  await expect(sheet.getByText("Date expiry", { exact: true })).toBeVisible()
  return sheet
}
async function addControl(dialog: Locator, label: string, type: string) {
  await dialog.getByRole("button", { name: "Add control", exact: true }).click()
  const control = dialog.getByTestId("custom-control-definition").last()
  await control.getByLabel("Label", { exact: true }).fill(label)
  await control.getByRole("combobox").click()
  await dialog.page().getByRole("option", { name: type, exact: true }).click()
}
async function stateOf(page: Page) {
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storeKey
  )
}
async function saveFlag(page: Page) {
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  const review = page.getByRole("dialog")
  await expect(
    review.getByRole("button", { name: "Save changes", exact: true })
  ).toBeEnabled()
  await review
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  await expect(review).not.toBeVisible()
}
async function openComparison(page: Page, target = "Staging") {
  await page.getByRole("link", { name: "Feature flags", exact: true }).click()
  await page.getByRole("button", { name: "Compare", exact: true }).click()
  await expect(page).toHaveURL(/\/en\/feature-flags\/compare/)
  await page
    .getByRole("button", { name: "Select target environments", exact: true })
    .click()
  const option = page.getByRole("option", {
    name: `FeatBit Demo / ${target}`,
    exact: true,
  })
  await option.click()
  await option.press("Escape")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await page
    .getByRole("button", { name: "Review differences", exact: true })
    .click()
  const sheet = page.getByRole("dialog", {
    name: "Compare Rainy-day rescue",
    exact: true,
  })
  await expect(sheet.getByTestId("compare-setting-description")).toBeVisible()
  return sheet
}

test("keeps the existing Settings shell and Description; custom Markdown starts in Preview", async ({
  page,
}) => {
  await openSettings(page)
  await expect(
    page
      .getByRole("navigation", { name: "Feature flag details", exact: true })
      .getByRole("link")
  ).toHaveCount(6)
  await expect(page.getByRole("button", { name: /Compare/i })).toHaveCount(0)
  await page
    .locator("#flag-description")
    .fill(
      "## Recovery plan\nFirst line\nSecond line\n\n- Keep **standard offers** available."
    )
  await page.getByRole("button", { name: "Preview", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Recovery plan", exact: true })
  ).toBeVisible()
  await openCustom(page)
  await expect(
    page.getByRole("button", { name: "Custom Field", exact: true })
  ).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Edit .* field/ })).toHaveCount(
    0
  )
  await expect(page.getByRole("tab", { name: /Operational/ })).toHaveCount(0)
  const safe = page.getByRole("region", { name: "Default safe", exact: true })
  await expect(safe.getByText("standard offer", { exact: true })).toBeVisible()
  await expect(safe.getByRole("textbox")).toHaveCount(0)
  await safe.getByRole("button", { name: "Edit", exact: true }).click()
  await expect(safe.getByRole("textbox")).toHaveValue(
    /Keep the \*\*standard offer\*\*/
  )
  await safe
    .getByRole("textbox")
    .fill("Use **standard offers** when unresolved.")
  await saveFlag(page)
  const state = await stateOf(page)
  expect(state.records[sourceKey].general.description).toContain(
    "Recovery plan"
  )
  expect(state.records[sourceKey].customFields["default-safe"].behavior).toBe(
    "Use **standard offers** when unresolved."
  )
  expect(state.history).toHaveLength(1)
})

test("creates a required multi-control field and saves datetime, numeric zero, checkbox false, and Markdown", async ({
  page,
}) => {
  await openSettings(page)
  const projectFields = await openProjectFields(page)
  await projectFields
    .getByRole("button", { name: "Custom Field", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "Add custom field" })
  await expect(
    dialog.getByText(
      /Only users with permission to edit this project \(UpdateProjectSettings\)/
    )
  ).toBeVisible()
  await dialog
    .getByLabel("Field name", { exact: true })
    .fill("Release checklist")
  await dialog.getByRole("switch", { name: "Required", exact: true }).check()
  await addControl(dialog, "Review time", "Date and time")
  await addControl(dialog, "Error budget", "Numeric value")
  await addControl(dialog, "Reviewed", "Checkbox")
  await addControl(dialog, "Procedure", "Rich text (Markdown)")
  await dialog.getByRole("button", { name: "Save field", exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    projectFields.getByText("Release checklist", { exact: true })
  ).toBeVisible()
  await projectFields.getByRole("button", { name: "Done", exact: true }).click()
  await page.goto(preview)
  await openCustom(page)
  const field = page.getByRole("region", {
    name: "Release checklist",
    exact: true,
  })
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  await expect(
    field.getByText("Enter a value for this required control.")
  ).toHaveCount(3)
  await field
    .getByLabel("Review time", { exact: true })
    .fill("2026-12-10T14:30")
  await field.getByLabel("Error budget", { exact: true }).fill("0")
  await field.getByRole("checkbox", { name: "Reviewed", exact: true }).check()
  await field.getByRole("checkbox", { name: "Reviewed", exact: true }).uncheck()
  await field.getByRole("button", { name: "Edit", exact: true }).click()
  await field
    .getByRole("textbox", { name: "Procedure", exact: true })
    .fill("## Recovery\nUse **standard** flow.")
  await saveFlag(page)
  const state = await stateOf(page)
  const definition = state.fields.find(
    (item: { name: string }) => item.name === "Release checklist"
  )
  const values = state.records[sourceKey].customFields[definition.id]
  expect(new Date(values[definition.controls[0].id]).toISOString()).toContain(
    "2026-12-10"
  )
  expect(values[definition.controls[1].id]).toBe(0)
  expect(values[definition.controls[2].id]).toBe(false)
  expect(values[definition.controls[3].id]).toContain("## Recovery")
  expect(state.configurationHistory).toHaveLength(1)
  await page.reload()
  await openCustom(page)
  await expect(
    page
      .getByRole("region", { name: "Release checklist" })
      .getByRole("heading", { name: "Recovery" })
  ).toBeVisible()
  const sheet = await openComparison(page)
  const row = sheet.getByTestId(`compare-setting-custom:${definition.id}`)
  await row
    .getByRole("checkbox", { name: "Release checklist", exact: true })
    .check()
  await expect(row.getByText("After copy", { exact: true })).toBeVisible()
  await sheet
    .getByRole("button", { name: "Copy settings", exact: true })
    .click()
  await expect(sheet).not.toBeVisible()
  const copied = await stateOf(page)
  expect(copied.records[stagingKey].customFields[definition.id]).toEqual(values)
})

test("project schema edits from Projects update an open flag without losing its draft or stable IDs", async ({
  page,
}) => {
  await openSettings(page)
  await page.locator("#flag-description").fill("Unsaved description")
  await openCustom(page)
  const before = await stateOf(page)
  const projectsPage = await page.context().newPage()
  await openProjectFields(projectsPage)
  await projectsPage
    .getByRole("button", { name: "Edit Date expiry field", exact: true })
    .click()
  const dialog = projectsPage.getByRole("dialog", { name: "Edit custom field" })
  await dialog.getByLabel("Field name", { exact: true }).fill("Expiry record")
  await addControl(dialog, "Reviewed", "Checkbox")
  await dialog.getByRole("button", { name: "Save field", exact: true }).click()
  await projectsPage.close()
  await expect(
    page.getByRole("heading", { name: "Expiry record", exact: true })
  ).toBeVisible()
  await page.getByRole("tab", { name: "Description", exact: true }).click()
  await expect(page.locator("#flag-description")).toHaveValue(
    "Unsaved description"
  )
  const after = await stateOf(page)
  expect(after.fields[0].id).toBe(before.fields[0].id)
  expect(after.fields[0].controls[0].id).toBe(before.fields[0].controls[0].id)
  expect(after.records).toEqual(before.records)
})

test("definitions are shared at project scope while flag values remain environment-specific", async ({
  page,
}) => {
  await openSettings(page)
  await openCustom(page)
  const safe = page.getByRole("region", { name: "Default safe", exact: true })
  await safe.getByRole("button", { name: "Edit", exact: true }).click()
  await safe.getByRole("textbox").fill("Dev-specific fallback notes")
  await saveFlag(page)
  await page.goto(
    `${preview}&context=environment&projectId=flag-settings-preview-project&envId=flag-settings-preview-staging`
  )
  await page.getByRole("tab", { name: /Custom fields/ }).click()
  await expect(
    page.getByRole("region", { name: "Default safe", exact: true })
  ).toContainText("test accounts")
  const state = await stateOf(page)
  expect(state.fields).toHaveLength(2)
  expect(state.records[sourceKey].customFields["default-safe"].behavior).toBe(
    "Dev-specific fallback notes"
  )
  expect(
    state.records[stagingKey].customFields["default-safe"].behavior
  ).toContain("test accounts")
})

test("only project settings managers configure fields; flag editors can fill existing values", async ({
  page,
}) => {
  await openSettings(page, "flag-editor")
  await expect(
    page.getByRole("button", { name: "Custom Field", exact: true })
  ).toHaveCount(0)
  await openCustom(page)
  await expect(
    page.getByRole("button", { name: "Edit Date expiry field", exact: true })
  ).toHaveCount(0)
  const safe = page.getByRole("region", { name: "Default safe", exact: true })
  await safe.getByRole("button", { name: "Edit", exact: true }).click()
  await expect(safe.getByRole("textbox")).toBeEnabled()
  const projectFields = await openProjectFields(page, "flag-editor")
  await expect(
    projectFields.getByRole("button", { name: "Custom Field", exact: true })
  ).toBeDisabled()
  await expect(
    projectFields.getByRole("button", {
      name: "Edit Date expiry field",
      exact: true,
    })
  ).toHaveCount(0)
  await expect(
    projectFields.getByText(
      /Only users with permission to edit this project \(UpdateProjectSettings\)/
    )
  ).toBeVisible()
  await page.goto(`${preview}&preview-role=read-only`)
  await page.getByRole("tab", { name: /Custom fields/ }).click()
  await page
    .getByRole("region", { name: "Default safe", exact: true })
    .getByRole("button", { name: "Edit", exact: true })
    .click()
  await expect(
    page
      .getByRole("region", { name: "Default safe", exact: true })
      .getByRole("textbox")
  ).toBeDisabled()
})

test("native Compare selects a custom field, previews it, and copies only that group", async ({
  page,
}) => {
  await openSettings(page)
  const before = await stateOf(page)
  const sheet = await openComparison(page)
  const date = sheet.getByTestId("compare-setting-custom:date-expiry")
  const safe = sheet.getByTestId("compare-setting-custom:default-safe")
  await expect(date).toContainText("Different")
  await expect(safe).toContainText("Different")
  await date.getByRole("checkbox", { name: "Date expiry", exact: true }).check()
  await expect(date.getByText("After copy", { exact: true })).toBeVisible()
  await expect(
    sheet.getByText("1 setting selected", { exact: true })
  ).toBeVisible()
  await sheet
    .getByRole("button", { name: "Copy settings", exact: true })
    .click()
  await expect(sheet).not.toBeVisible()
  const after = await stateOf(page)
  expect(after.fields).toEqual(before.fields)
  expect(after.records[stagingKey].general).toEqual(
    before.records[stagingKey].general
  )
  expect(after.records[stagingKey].customFields["date-expiry"]).toEqual(
    before.records[sourceKey].customFields["date-expiry"]
  )
  expect(after.records[stagingKey].customFields["default-safe"]).toEqual(
    before.records[stagingKey].customFields["default-safe"]
  )
  await page
    .getByRole("button", { name: "Review differences", exact: true })
    .click()
  const reopened = page.getByRole("dialog", {
    name: "Compare Rainy-day rescue",
    exact: true,
  })
  await expect(
    reopened.getByTestId("compare-setting-custom:date-expiry")
  ).toContainText("No difference")
  await expect(
    reopened
      .getByTestId("compare-setting-custom:date-expiry")
      .getByRole("checkbox")
  ).toBeDisabled()
})

test("Compare select-all includes Description and dynamic fields without changing targeting", async ({
  page,
}) => {
  await openSettings(page)
  const before = await stateOf(page)
  const sheet = await openComparison(page)
  await sheet.getByRole("checkbox", { name: "Select all", exact: true }).check()
  await expect(
    sheet.getByText("3 settings selected", { exact: true })
  ).toBeVisible()
  for (const key of [
    "description",
    "custom:date-expiry",
    "custom:default-safe",
  ])
    await expect(
      sheet
        .getByTestId(`compare-setting-${key}`)
        .getByText("After copy", { exact: true })
    ).toBeVisible()
  await sheet
    .getByRole("button", { name: "Copy settings", exact: true })
    .click()
  await expect(sheet).not.toBeVisible()
  const after = await stateOf(page)
  expect(after.records[stagingKey].general).toEqual({
    ...before.records[stagingKey].general,
    description: before.records[sourceKey].general.description,
  })
  expect(after.records[stagingKey].customFields).toEqual(
    before.records[sourceKey].customFields
  )
  expect(after.fields).toEqual(before.fields)
  await expect(page.getByText("No differences", { exact: true })).toBeVisible()
})
