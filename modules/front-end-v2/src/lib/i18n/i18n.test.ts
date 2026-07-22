import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "./i18n"

describe("integration page translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("resolves the English resources from the global bundle", async () => {
    await i18n.changeLanguage("en")

    expect(i18n.t("webhooks.title")).toBe("Webhooks")
    expect(i18n.t("relayProxies.title")).toBe("Relay proxies")
    expect(i18n.t("accessTokens.title")).toBe("Access Tokens")
    expect(i18n.t("segments.create.multipleScopes")).toBe("Shareable")
  })

  it("resolves the Chinese resources from the global bundle", async () => {
    await i18n.changeLanguage("zh")

    expect(i18n.t("webhooks.subtitle")).toBe(
      "将功能开关和用户组事件发送到外部服务。"
    )
    expect(i18n.t("relayProxies.title")).toBe("中继代理")
    expect(i18n.t("accessTokens.title")).toBe("访问令牌")
    expect(i18n.t("layout.nav.items.endUsers")).toBe("目标用户")
    expect(i18n.t("layout.nav.items.segments")).toBe("用户组")
    expect(i18n.t("workspace.globalUsers.evaluate.segments")).toBe("用户组")
    expect(i18n.t("segments.create.multipleScopes")).toBe("共享")
  })
})
