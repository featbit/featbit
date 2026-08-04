export const enWorkspaceSelection = {
          workspace: {
            title: "Select a workspace",
            subtitle: "Choose a workspace to continue as {{email}}.",
            search: "Search workspaces...",
            empty: "No workspaces found.",
          },
          organization: {
            title: "Select an organization",
            subtitle: "Choose an organization to continue as {{email}}.",
            search: "Search organizations...",
            empty: "No organizations found.",
            noneTitle: "No organizations available",
            noneDescription:
              "There are no organizations available in this workspace.",
          },
          backToWorkspaces: "Back to workspaces",
          signInWithAnotherEmail: "Sign in with another email",
          errors: {
            loadWorkspaces: "Unable to load workspaces. Please try again.",
            loadOrganizations:
              "Unable to load organizations. Please try again.",
            joinOrganization:
              "Unable to join this organization. Please try again.",
          },
        } as const

export const zhWorkspaceSelection = {
          workspace: {
            title: "选择工作区",
            subtitle: "请选择一个工作区，以 {{email}} 的身份继续。",
            search: "搜索工作区...",
            empty: "未找到工作区。",
          },
          organization: {
            title: "选择组织",
            subtitle: "请选择一个组织，以 {{email}} 的身份继续。",
            search: "搜索组织...",
            empty: "未找到组织。",
            noneTitle: "没有可用组织",
            noneDescription: "当前工作区下没有可用组织。",
          },
          backToWorkspaces: "返回工作区",
          signInWithAnotherEmail: "使用其他邮箱登录",
          errors: {
            loadWorkspaces: "无法加载工作区，请重试。",
            loadOrganizations: "无法加载组织，请重试。",
            joinOrganization: "无法加入该组织，请重试。",
          },
        } as const
