import { expect, test, type Locator, type Page } from "@playwright/test"

const settingsUrl =
  "/en/feature-flags/rainy-day-rescue/settings?preview=flag-settings"
const listUrl = "/en/feature-flags?preview=flag-settings"

async function addControl(
  page: Page,
  dialog: Locator,
  label: string,
  type: string
) {
  await dialog.getByRole("button", { name: "Add control", exact: true }).click()
  const control = dialog.getByTestId("custom-control-definition").last()
  await control.getByLabel("Label", { exact: true }).fill(label)
  await control.getByRole("combobox").click()
  await page.getByRole("option", { name: type, exact: true }).click()
  return control
}

test("maintains List values at project scope and adds at most two explicit custom field filters", async ({
  page,
}) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1600, height: 1100 })
  await page.goto("/en/organization/projects?preview=flag-settings")
  await page
    .getByRole("button", {
      name: "Manage custom fields for FeatBit Demo",
      exact: true,
    })
    .click()
  await page.getByRole("button", { name: "Custom Field", exact: true }).click()
  const definition = page.getByRole("dialog", {
    name: "Add custom field",
    exact: true,
  })
  await definition
    .getByLabel("Field name", { exact: true })
    .fill("Release metadata")
  await definition
    .getByRole("switch", { name: "Required", exact: true })
    .check()
  await addControl(page, definition, "Risk score", "Numeric value")
  const listDefinition = await addControl(
    page,
    definition,
    "Applications",
    "List (multiple selections)"
  )
  await definition
    .getByRole("button", { name: "Save field", exact: true })
    .click()
  await expect(
    definition.getByText(
      "Add at least one available value to each List control."
    )
  ).toBeVisible()
  for (const value of ["Web storefront", "Promotions API", "Mobile app"]) {
    await listDefinition
      .getByLabel("Available values", { exact: true })
      .fill(value)
    await listDefinition
      .getByRole("button", { name: "Add value", exact: true })
      .click()
  }
  await listDefinition
    .getByLabel("Available values", { exact: true })
    .fill("web storefront")
  await listDefinition
    .getByRole("button", { name: "Add value", exact: true })
    .click()
  await expect(
    listDefinition.getByText("This value already exists in the list.")
  ).toBeVisible()
  await definition
    .getByRole("button", { name: "Save field", exact: true })
    .click()
  await expect(definition).not.toBeVisible()

  await page.goto(settingsUrl)
  await page.getByRole("tab", { name: /Custom fields/ }).click()
  const field = page.getByRole("region", {
    name: "Release metadata",
    exact: true,
  })
  await field.getByLabel("Risk score", { exact: true }).fill("5")
  await field.getByLabel("Applications", { exact: true }).click()
  await page
    .getByRole("option", { name: "Web storefront", exact: true })
    .click()
  await page
    .getByRole("option", { name: "Promotions API", exact: true })
    .click()
  await page
    .getByPlaceholder("Search available values…")
    .fill("arbitrary value")
  await expect(
    page.getByText("No matching values", { exact: true })
  ).toBeVisible()
  await page.getByPlaceholder("Search available values…").press("Escape")
  await expect(
    field.getByRole("button", { name: "Remove Web storefront", exact: true })
  ).toBeVisible()
  await expect(
    field.getByRole("button", { name: "Remove Promotions API", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Review & save", exact: true }).click()
  const review = page.getByRole("dialog")
  await expect(review).toContainText("Web storefront")
  await expect(review).toContainText("Promotions API")
  await review
    .getByRole("button", { name: "Save changes", exact: true })
    .click()
  await expect(review).not.toBeVisible()
  await page.reload()
  await page.getByRole("tab", { name: /Custom fields/ }).click()
  await expect(field.getByLabel("Risk score", { exact: true })).toHaveValue("5")
  await expect(field.getByLabel("Applications", { exact: true })).toContainText(
    "2 selected"
  )

  await page.goto(listUrl)
  const flag = page.getByRole("link", { name: "Rainy-day rescue", exact: true })
  await expect(flag).toBeVisible()
  await expect(page.getByTestId("custom-field-filter")).toHaveCount(0)
  const add = page.getByRole("button", { name: /Add custom field filter/ })
  await add.click()
  await expect(page.getByRole("option", { name: /Applications/ })).toHaveCount(
    1
  )
  await page
    .getByRole("option", { name: "Release metadata · Risk score", exact: true })
    .click()
  await page.getByLabel("Value", { exact: true }).fill("4")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toBeVisible()
  const numeric = page.getByRole("button", {
    name: "Filter Release metadata · Risk score",
    exact: true,
  })
  await numeric.click()
  await page.getByLabel("Condition", { exact: true }).click()
  await page.getByRole("option", { name: "Less than", exact: true }).click()
  await page.getByLabel("Value", { exact: true }).fill("5")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toHaveCount(0)
  await numeric.click()
  await page.getByLabel("Condition", { exact: true }).click()
  await page
    .getByRole("option", { name: "Range (inclusive)", exact: true })
    .click()
  await page.getByLabel("From", { exact: true }).fill("6")
  await page.getByLabel("To", { exact: true }).fill("4")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(
    page.getByText(
      "The start of the range must be less than or equal to the end."
    )
  ).toBeVisible()
  await page.getByLabel("From", { exact: true }).fill("5")
  await page.getByLabel("To", { exact: true }).fill("5")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toBeVisible()

  await add.click()
  await page
    .getByRole("option", {
      name: "Date expiry · Review date and time",
      exact: true,
    })
    .click()
  await page.getByLabel("Condition", { exact: true }).click()
  await page
    .getByRole("option", { name: "Range (inclusive)", exact: true })
    .click()
  await page.getByLabel("From", { exact: true }).fill("2026-12-01T00:00")
  await page.getByLabel("To", { exact: true }).fill("2026-12-31T23:59")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toBeVisible()
  await expect(page.getByTestId("custom-field-filter")).toHaveCount(2)
  await expect(add).toBeDisabled()
  await page
    .getByRole("button", {
      name: "Remove filter for Release metadata · Risk score",
      exact: true,
    })
    .click()
  await expect(add).toBeEnabled()
  const date = page.getByRole("button", {
    name: "Filter Date expiry · Review date and time",
    exact: true,
  })
  await date.click()
  await page.getByLabel("From", { exact: true }).fill("2027-01-01T00:00")
  await page.getByLabel("To", { exact: true }).fill("2027-12-31T23:59")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toHaveCount(0)
  await page
    .getByRole("table")
    .getByRole("button", { name: "Clear filters", exact: true })
    .click()
  await expect(page.getByTestId("custom-field-filter")).toHaveCount(0)
  await expect(flag).toBeVisible()

  await add.click()
  await page
    .getByRole("option", {
      name: "Release metadata · Applications",
      exact: true,
    })
    .click()
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(
    page.getByText("Select one or more values from the configured list.", {
      exact: true,
    })
  ).toBeVisible()
  await page.getByLabel("Includes any of", { exact: true }).click()
  await page.getByRole("option", { name: "Mobile app", exact: true }).click()
  await page.getByPlaceholder("Search available values…").press("Escape")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toHaveCount(0)
  const list = page.getByRole("button", {
    name: "Filter Release metadata · Applications",
    exact: true,
  })
  await list.click()
  await page.getByLabel("Includes any of", { exact: true }).click()
  await page
    .getByRole("option", { name: "Web storefront", exact: true })
    .click()
  await page.getByPlaceholder("Search available values…").press("Escape")
  await expect(
    page.getByRole("button", { name: "Remove Mobile app", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Remove Web storefront", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toBeVisible()
  await expect(list).toContainText("Mobile app, Web storefront")

  await add.click()
  await page
    .getByRole("option", { name: "Release metadata · Risk score", exact: true })
    .click()
  await page.getByLabel("Value", { exact: true }).fill("6")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toHaveCount(0)
  await expect(add).toBeDisabled()
  await numeric.click()
  await page.getByLabel("Value", { exact: true }).fill("4")
  await page.getByRole("button", { name: "Apply filter", exact: true }).click()
  await expect(flag).toBeVisible()
  await page
    .getByRole("button", {
      name: "Remove filter for Release metadata · Applications",
      exact: true,
    })
    .click()
  await expect(add).toBeEnabled()
  await page.getByRole("button", { name: "Clear filters", exact: true }).click()
  await expect(page.getByTestId("custom-field-filter")).toHaveCount(0)

  await page.getByRole("button", { name: "Compare", exact: true }).click()
  await page
    .getByRole("button", { name: "Select target environments", exact: true })
    .click()
  const staging = page.getByRole("option", {
    name: "FeatBit Demo / Staging",
    exact: true,
  })
  await staging.click()
  await staging.press("Escape")
  await page.getByRole("button", { name: "Apply", exact: true }).click()
  await page
    .getByRole("button", { name: "Review differences", exact: true })
    .click()
  const sheet = page.getByRole("dialog", {
    name: "Compare Rainy-day rescue",
    exact: true,
  })
  await sheet
    .getByRole("checkbox", { name: "Release metadata", exact: true })
    .check()
  await expect(
    sheet.getByText("1 setting selected", { exact: true })
  ).toBeVisible()
  await sheet
    .getByRole("button", { name: "Copy settings", exact: true })
    .click()
  await expect(sheet).not.toBeVisible()
  await page
    .getByRole("button", { name: "Review differences", exact: true })
    .click()
  const row = sheet
    .getByTestId(/^compare-setting-custom:/)
    .filter({ hasText: "Release metadata" })
  await expect(row).toContainText("No difference")
  await expect(row).toContainText("Web storefront")
  await expect(row).toContainText("Promotions API")
  await expect(row.getByRole("checkbox")).toBeDisabled()
})
