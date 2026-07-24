import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"

describe("segment details global translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("resolves the English details resources", async () => {
    await i18n.changeLanguage("en")
    expect(i18n.t("segments.detailsPage.tabs.targeting")).toBe("Targeting")
    expect(i18n.t("segments.detailsPage.history.columns.comment")).toBe(
      "Comment"
    )
    expect(
      i18n.t("segments.detailsPage.review.actions.addedCount", { count: 2 })
    ).toBe("Added · 2")
    expect(
      i18n.t("segments.detailsPage.settings.createTag", { tag: "release" })
    ).toBe('Create tag "release"')
  })

  it("uses the agreed Chinese product terminology", async () => {
    await i18n.changeLanguage("zh")
    expect(i18n.t("segments.detailsPage.tabsLabel")).toBe("用户组详情")
    expect(i18n.t("segments.detailsPage.tabs.targeting")).toBe("匹配规则")
    expect(i18n.t("segments.detailsPage.targeting.usersTitle")).toBe("目标用户")
    expect(
      i18n.t("segments.detailsPage.review.actions.removedCount", { count: 2 })
    ).toBe("已移除 · 2")
    expect(
      i18n.t("segments.detailsPage.settings.createTag", { tag: "发布" })
    ).toBe("创建标签“发布”")
  })
})
