import { afterEach, describe, expect, it } from "vitest"
import { i18n } from "@/lib/i18n/i18n"
import "./end-users-i18n"

describe("end user Chinese translations", () => {
  afterEach(async () => {
    await i18n.changeLanguage("en")
  })

  it("uses the approved product terminology", async () => {
    await i18n.changeLanguage("zh")

    expect(i18n.t("endUsers.title")).toBe("目标用户")
    expect(i18n.t("endUsers.empty")).toBe("暂无目标用户")
    expect(i18n.t("endUsers.evaluateDrawer.segments")).toBe("用户组")
    expect(i18n.t("endUsers.evaluateDrawer.variation")).toBe("返回值")
    expect(i18n.t("endUsers.presetsDialog.valueHelp")).toBe("用于匹配规则")
  })

  it("does not contain the retired Chinese terms", () => {
    const resources = JSON.stringify(
      i18n.getResourceBundle("zh", "common").endUsers
    )

    expect(resources).not.toContain("终端用户")
    expect(resources).not.toContain("用户分群")
    expect(resources).not.toContain("目标规则")
    expect(resources).not.toContain("定向规则")
  })
})
