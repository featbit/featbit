import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "./i18n"

describe("global feature translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("resolves the English resources from the global bundle", async () => {
    await i18n.changeLanguage("en")

    expect(i18n.t("webhooks.title")).toBe("Webhooks")
    expect(i18n.t("relayProxies.title")).toBe("Relay proxies")
    expect(i18n.t("accessTokens.title")).toBe("Access Tokens")
    expect(i18n.t("auditLogs.title")).toBe("Audit Logs")
    expect(i18n.t("auditLogs.changeCount", { count: 2 })).toBe("2 changes")
    expect(i18n.t("endUsers.title")).toBe("End Users")
    expect(i18n.t("segments.create.multipleScopes")).toBe("Shareable")
    expect(i18n.t("segments.detailsPage.tabs.targeting")).toBe("Targeting")
    expect(i18n.t("segments.detailsPage.history.columns.comment")).toBe(
      "Comment"
    )
    expect(i18n.t("segments.detailsPage.history.allUsers")).toBe("All users")
    expect(i18n.t("segments.detailsPage.targeting.globalUser")).toBe(
      "Global user"
    )
    expect(
      i18n.t("segments.detailsPage.rules.reorderRule", { rule: "Rule 1" })
    ).toBe("Reorder Rule 1")
    expect(i18n.t("segments.detailsPage.rules.removeRule")).toBe("Remove")
    expect(i18n.t("segments.detailsPage.rules.if")).toBe("IF")
    expect(i18n.t("segments.detailsPage.rules.and")).toBe("AND")
    expect(
      i18n.t("segments.detailsPage.review.actions.addedCount", { count: 2 })
    ).toBe("Added · 2")
    expect(
      i18n.t("segments.detailsPage.settings.createTag", { tag: "release" })
    ).toBe('Create tag "release"')
  })

  it("resolves the Chinese resources from the global bundle", async () => {
    await i18n.changeLanguage("zh")

    expect(i18n.t("webhooks.subtitle")).toBe(
      "将功能开关和用户组事件发送到外部服务。"
    )
    expect(i18n.t("relayProxies.title")).toBe("中继代理")
    expect(i18n.t("accessTokens.title")).toBe("访问令牌")
    expect(i18n.t("auditLogs.title")).toBe("审计日志")
    expect(i18n.t("auditLogs.keyName")).toBe("Key/名称")
    expect(i18n.t("auditLogs.changeCount", { count: 2 })).toBe("2 项变更")
    expect(i18n.t("endUsers.title")).toBe("目标用户")
    expect(i18n.t("endUsers.empty")).toBe("暂无目标用户")
    expect(i18n.t("endUsers.evaluateDrawer.segments")).toBe("用户组")
    expect(i18n.t("endUsers.evaluateDrawer.variation")).toBe("返回值")
    expect(i18n.t("endUsers.presetsDialog.valueHelp")).toBe("用于匹配规则")
    expect(i18n.t("layout.nav.items.endUsers")).toBe("目标用户")
    expect(i18n.t("layout.nav.items.segments")).toBe("用户组")
    expect(i18n.t("workspace.globalUsers.evaluate.segments")).toBe("用户组")
    expect(i18n.t("segments.create.multipleScopes")).toBe("共享")
    expect(i18n.t("segments.detailsPage.tabsLabel")).toBe("用户组详情")
    expect(i18n.t("segments.detailsPage.tabs.targeting")).toBe("匹配规则")
    expect(i18n.t("segments.detailsPage.history.allUsers")).toBe("所有用户")
    expect(i18n.t("segments.detailsPage.targeting.usersTitle")).toBe("目标用户")
    expect(i18n.t("segments.detailsPage.targeting.globalUser")).toBe("全局用户")
    expect(
      i18n.t("segments.detailsPage.rules.reorderRule", { rule: "规则 1" })
    ).toBe("重新排序 规则 1")
    expect(i18n.t("segments.detailsPage.rules.removeRule")).toBe("删除")
    expect(i18n.t("segments.detailsPage.rules.if")).toBe("如果")
    expect(i18n.t("segments.detailsPage.rules.and")).toBe("并且")
    expect(
      i18n.t("segments.detailsPage.review.actions.removedCount", { count: 2 })
    ).toBe("已移除 · 2")
    expect(
      i18n.t("segments.detailsPage.settings.createTag", { tag: "发布" })
    ).toBe("创建标签“发布”")
  })

  it("resolves Feature Flags copy from the global bundle", async () => {
    await i18n.changeLanguage("en")
    expect(i18n.t("featureFlags.title")).toBe("Feature flags")
    expect(i18n.t("featureFlags.selected", { count: 2 })).toBe("2 selected")
    expect(i18n.t("featureFlags.detailsPage.targetingRules")).toBe(
      "Targeting rules"
    )
    expect(i18n.t("targeting.rules.operators.IsOneOf")).toBe("is one of")

    await i18n.changeLanguage("zh")
    expect(i18n.t("featureFlags.title")).toBe("功能开关")
    expect(i18n.t("featureFlags.selected", { count: 2 })).toBe("已选择 2 项")
    expect(i18n.t("featureFlags.detailsPage.targetingRules")).toBe("定向规则")
    expect(i18n.t("targeting.rules.operators.IsOneOf")).toBe("属于其中之一")
  })

  it("does not expose retired Chinese end-user terminology", async () => {
    await i18n.changeLanguage("zh")

    const resources = JSON.stringify(
      i18n.getResourceBundle("zh", "common").endUsers
    )

    expect(resources).not.toContain("终端用户")
    expect(resources).not.toContain("用户分群")
    expect(resources).not.toContain("目标规则")
    expect(resources).not.toContain("定向规则")
  })
})
